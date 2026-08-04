/*
=======================================================================================================================================
API Route: push-results-to-competitions   ** DEPRECATED - NOT REGISTERED - DO NOT EDIT **
=======================================================================================================================================
        THIS ROUTE IS NOT WIRED UP. It is not in server.js and nothing can call it. It is kept
        on disk only as a reference for the migration, and should be deleted once nobody wants
        to look at it any more.

        Replaced by:
          /admin/push-results-to-competition   (singular) - one competition, its own transaction
          /admin/clear-staged-batch            - the fixture_load delete that used to be step 3

        Why it was replaced: it processed every affected competition inside ONE transaction, so
        its duration was the sum across the batch and a timeout anywhere rolled back every
        competition in it - nobody got their results and the whole push had to be retried. The
        admin now pushes one competition at a time and sees each result before moving on, so
        nothing compounds and a failure is confined to a single competition.

        DO NOT change the rules in this file. It is a frozen copy. The live copies of the
        processing block are routes/admin/push-results-to-competition.js and
        routes/organizer-process-results.js - change those two, and leave this alone.

        Everything below this banner is the original header, left as it was.
=======================================================================================================================================
Method: POST
Purpose: Pushes results from fixture_load to competition fixtures and automatically processes them (cron/ad-hoc execution).
         1. Updates fixture.result field with winning team short name or "DRAW"
         2. Only updates fixtures in competitions where fixture_service = true
         3. Automatically processes results (eliminations, no-picks, competition completion)
         4. Only updates fixtures where result is NULL (never overrides existing results)

         SHARED LOGIC WARNING: step 3 - the per-player processing block (outcome, player_progress,
         lives/elimination threshold, no-pick penalties, competition completion, notification
         cleanup, audit log) - is intentionally kept identical to
         routes/organizer-process-results.js. That route runs the same steps for
         organiser-managed (fixture_service = false) competitions. If you change the rules here,
         change them there too, or the two halves of the customer base end up playing different
         games. They are two copies of one ruleset, not two rulesets, until they get consolidated
         into one shared function (not done yet - deliberately deferred).

         The two differ in SCOPE, and that part is not duplication:
           - organizer-process-results runs for ONE competition, in its own transaction. An
             organiser with several competitions processes each separately.
           - this route loops over EVERY affected competition inside a SINGLE transaction, so its
             cost is the sum across the batch and a failure anywhere rolls all of them back.

         Authentication: admin token. This route used to accept the shared string
         BOT_MAGIC_2025 in the request body, which was compiled into the public lmslocal-web
         JavaScript bundle by the old /admin-results page - so anyone who read the site's source
         could process eliminations across every subscribed competition.

         SHARED LOGIC WARNING: the per-competition processing block below (eliminations,
         no-pick penalties, competition completion, notification cleanup, audit log) is
         intentionally kept identical to routes/organizer-process-results.js. That route runs
         the same steps for manually-run (fixture_service = false) competitions. If you change
         the rules here - the lives/elimination threshold in particular - change it there too,
         or the two paths will disagree on when a player is out. They are two copies of one
         ruleset, not two different rulesets, until they get consolidated into one shared
         function (not done yet - deliberately deferred).
=======================================================================================================================================
Request Payload:
  None. Authentication is by admin token in the Authorization header.

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "fixtures_updated": 15,                 // integer, number of competition fixtures updated with results
  "results_cleared": 15,                  // integer, number of fixture_load rows removed from staging
  "competitions_processed": [             // array, details of each competition processed
    {
      "competition_id": 1,                // integer, competition ID
      "status": "processed",              // string, "processed", "skipped", or "error"
      "fixtures_processed": 10,           // integer, number of fixtures processed (if status = "processed")
      "competition_status": "active"      // string, "active" or "COMPLETE" (if winner determined)
    },
    {
      "competition_id": 2,
      "status": "skipped",
      "reason": "No unprocessed results"  // string, reason for skip (if status = "skipped" or "error")
    }
  ],
  "message": "15 results pushed and 2 competitions processed"
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"NO_RESULTS_TO_PUSH"
"UNAUTHORIZED"                          - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"                         - Admin session has expired
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { transaction } = require('../../database');       // Destructured database import from central pooling (using transaction for atomicity)
const { logApiCall } = require('../../utils/apiLogger');  // API logging utility
const { verifyAdminToken } = require('../../middleware/admin-auth');
const router = express.Router();

router.post('/', verifyAdminToken, async (req, res) => {
  // Log this API call for monitoring and debugging
  logApiCall('push-results-to-competitions');

  try {
    // TEST MODE: when FIXTURE_SERVICE_TEST_MODE is set in .env, only the competitions organised
    // by that email are eligible - every other subscribed competition's fixtures are left
    // untouched (result stays NULL, picked up again once test mode is turned off). See
    // fixtureService.js for the matching push-fixtures-side restriction, and
    // get-fixture-team-lists.js for the admin banner that surfaces this. Leave the var blank for
    // normal production behaviour.
    const testModeEmail = process.env.FIXTURE_SERVICE_TEST_MODE || null;

    // Execute all operations in a single atomic transaction
    // This ensures either ALL changes succeed or ALL are rolled back
    const result = await transaction(async (client) => {

      // === STEP 1: GET ALL RESULTED FIXTURES WAITING TO BE PUSHED ===
      // fixture_load only ever holds the currently staged batch, so any row with both scores
      // filled in is ready to push.
      const unpushedResults = await client.query(`
        SELECT
          fixture_id,
          home_team_short,
          away_team_short,
          home_score,
          away_score,
          kickoff_time
        FROM fixture_load
        WHERE home_score IS NOT NULL
        AND away_score IS NOT NULL
      `);

      if (unpushedResults.rows.length === 0) {
        throw new Error('NO_RESULTS_TO_PUSH');
      }

      const resultsData = unpushedResults.rows;

      // === STEP 2: UPDATE COMPETITION FIXTURES WITH RESULTS ===
      // For each result from fixture_load, find matching fixtures in competitions
      // and update their result field with the winning team or "DRAW"
      //
      // Match criteria:
      // - home_team_short matches
      // - away_team_short matches
      // - kickoff_time matches (see below)
      // - result IS NULL (NEVER override existing results)
      //
      // Result value logic:
      // - If home_score > away_score → result = home_team_short (home team won)
      // - If away_score > home_score → result = away_team_short (away team won)
      // - If home_score = away_score → result = "DRAW"
      let totalFixturesUpdated = 0;
      const affectedCompetitions = new Set(); // Track which competitions had results updated

      for (const resultData of resultsData) {
        // Calculate the winner or draw from the scores
        let resultValue;
        if (resultData.home_score > resultData.away_score) {
          resultValue = resultData.home_team_short;  // Home team won
        } else if (resultData.away_score > resultData.home_score) {
          resultValue = resultData.away_team_short;  // Away team won
        } else {
          resultValue = 'DRAW';  // It's a draw
        }

        // Update all matching fixtures in SUBSCRIBED competitions only
        // Only updates fixtures where:
        // - Competition has fixture_service = true (subscribed to service)
        // - Teams match (home_team_short and away_team_short)
        // - Kickoff matches (see below)
        // - result IS NULL (NEVER override existing results)
        // - test mode, if set, restricts this to one organiser's competitions
        //
        // Teams alone are not unique across time - the same fixture recurs season to season -
        // so kickoff_time is what makes the match unambiguous. push-fixtures copies kickoff_time
        // verbatim from the staged row, so this costs nothing for a legitimate match and
        // excludes coincidental repeats. (result IS NULL already stops resulted rounds being
        // touched; this closes the case of an old round left unresolved.)
        // RETURNING clause gives us the competition_ids that were affected
        const fixtureUpdateResult = await client.query(`
          UPDATE fixture f
          SET result = $1
          FROM competition c
          JOIN app_user u ON u.id = c.organiser_id
          WHERE f.competition_id = c.id
          AND c.fixture_service = true
          AND f.home_team_short = $2
          AND f.away_team_short = $3
          AND f.kickoff_time = $4
          AND f.result IS NULL
          AND ($5::text IS NULL OR u.email = $5)
          RETURNING f.competition_id
        `, [resultValue, resultData.home_team_short, resultData.away_team_short, resultData.kickoff_time, testModeEmail]);

        // Track how many fixtures were updated
        totalFixturesUpdated += fixtureUpdateResult.rowCount || 0;

        // Track which competitions were affected (for automatic processing)
        fixtureUpdateResult.rows.forEach(row => {
          affectedCompetitions.add(row.competition_id);
        });
      }

      // === STEP 3: CLEAR THESE ROWS FROM FIXTURE_LOAD ===
      // Now that we've successfully updated all competition fixtures, remove these rows from
      // staging. This is what "one pending batch at a time" actually means in practice - once
      // every fixture is resulted and pushed, the table is empty again and add-staged-fixtures
      // allows a new batch.
      const clearedResult = await client.query(`
        DELETE FROM fixture_load
        WHERE fixture_id = ANY($1::int[])
        RETURNING fixture_id
      `, [resultsData.map(r => r.fixture_id)]);

      const resultsCleared = clearedResult.rows.length;

      // === STEP 4: AUTO-PROCESS RESULTS FOR AFFECTED COMPETITIONS ===
      // For all competitions that had results updated (fixture_service = true),
      // automatically process the results (eliminations, no-picks, competition completion)
      // This replicates the submit-results processing logic
      const competitionsProcessed = [];

      for (const competitionId of affectedCompetitions) {
        try {
          // Get the latest round for this competition
          const roundResult = await client.query(`
            SELECT r.id as round_id, r.round_number
            FROM round r
            WHERE r.competition_id = $1
            ORDER BY r.round_number DESC
            LIMIT 1
          `, [competitionId]);

          if (roundResult.rows.length === 0) {
            competitionsProcessed.push({
              competition_id: competitionId,
              status: 'skipped',
              reason: 'No rounds found'
            });
            continue;
          }

          const roundId = roundResult.rows[0].round_id;
          const roundNumber = roundResult.rows[0].round_number;

          // Find fixtures with results that are NOT yet processed
          const unprocessedResults = await client.query(`
            SELECT id, result, home_team_short, away_team_short
            FROM fixture
            WHERE round_id = $1
            AND result IS NOT NULL
            AND processed IS NULL
          `, [roundId]);

          if (unprocessedResults.rows.length === 0) {
            competitionsProcessed.push({
              competition_id: competitionId,
              status: 'skipped',
              reason: 'No unprocessed results'
            });
            continue;
          }

          // Claim the fixtures before any player state is touched. Same claim as the one in
          // routes/organizer-process-results.js, and the `processed IS NULL` carries the same
          // weight: under READ COMMITTED the loser of a race against a concurrent run
          // re-evaluates this predicate once the winner commits, matches nothing, and skips this
          // competition instead of deducting a second life for the same pick.
          const claimResult = await client.query(`
            UPDATE fixture
            SET processed = NOW()
            WHERE id = ANY($1::integer[])
            AND processed IS NULL
            RETURNING id
          `, [unprocessedResults.rows.map(row => row.id)]);

          // Work from what was actually claimed rather than what was selected - a concurrent run
          // may have taken some of them. Claiming nothing leaves nothing to do, so this is the
          // same skip as finding no unprocessed results above. It is reported rather than thrown
          // because a throw would be caught below and mislabelled as an error.
          const claimedIds = new Set(claimResult.rows.map(row => row.id));
          if (claimedIds.size === 0) {
            competitionsProcessed.push({
              competition_id: competitionId,
              status: 'skipped',
              reason: 'No unprocessed results'
            });
            continue;
          }

          const fixturesToProcess = unprocessedResults.rows.filter(fixture => claimedIds.has(fixture.id));
          const fixtureIds = fixturesToProcess.map(fixture => fixture.id);

          let playersEliminated = 0;
          let noPickPenalties = 0;

          // === PLAYER OUTCOME PROCESSING ===
          // Update pick outcomes for all processed fixtures
          for (const fixture of fixturesToProcess) {
            // Get all picks for this fixture
            const picksResult = await client.query(`
              SELECT p.id, p.user_id, p.team, au.display_name
              FROM pick p
              JOIN app_user au ON p.user_id = au.id
              WHERE p.fixture_id = $1
            `, [fixture.id]);

            // Process each pick and determine outcome
            for (const pick of picksResult.rows) {
              let outcome;

              // Determine outcome based on pick vs fixture result
              if (fixture.result === 'DRAW') {
                outcome = 'LOSE'; // Draw eliminates all players
              } else if (pick.team === fixture.result) {
                outcome = 'WIN';  // Player picked winning team
              } else {
                outcome = 'LOSE'; // Player picked losing team
              }

              // Update pick outcome
              await client.query(`
                UPDATE pick
                SET outcome = $1
                WHERE id = $2
              `, [outcome, pick.id]);

              // Insert player progress record
              await client.query(`
                INSERT INTO player_progress (player_id, competition_id, round_id, round_number, fixture_id, chosen_team, outcome)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
              `, [pick.user_id, competitionId, roundId, roundNumber, fixture.id, pick.team, outcome]);

              // Update player lives based on outcome
              if (outcome === 'LOSE') {
                const livesUpdateResult = await client.query(`
                  UPDATE competition_user
                  SET
                    lives_remaining = GREATEST(lives_remaining - 1, 0),
                    status = CASE
                      WHEN lives_remaining - 1 < 0 THEN 'out'
                      ELSE status
                    END
                  WHERE competition_id = $1 AND user_id = $2
                  RETURNING user_id, lives_remaining, status
                `, [competitionId, pick.user_id]);

                // Log warning if no rows were updated (data integrity issue)
                if (livesUpdateResult.rowCount === 0) {
                  console.warn(`WARNING: Failed to deduct life for user ${pick.user_id} (${pick.display_name}) in competition ${competitionId} - no competition_user record found`);
                } else if (livesUpdateResult.rows[0].status === 'out') {
                  playersEliminated++;
                }
              }
            }
          }

          // === NO-PICK PENALTY PROCESSING ===
          // Check if ALL fixtures in this round are now processed
          const allFixturesResult = await client.query(`
            SELECT COUNT(*) as total_fixtures,
                   COUNT(CASE WHEN processed IS NOT NULL THEN 1 END) as processed_fixtures
            FROM fixture
            WHERE round_id = $1
          `, [roundId]);

          const { total_fixtures, processed_fixtures } = allFixturesResult.rows[0];

          // Only proceed if ALL fixtures are processed
          if (total_fixtures > 0 && total_fixtures == processed_fixtures) {
            // Find active players who did NOT make any pick for this round
            const noPickPlayersResult = await client.query(`
              SELECT cu.user_id, au.display_name, cu.lives_remaining
              FROM competition_user cu
              JOIN app_user au ON cu.user_id = au.id
              WHERE cu.competition_id = $1
              AND cu.status = 'active'
              AND cu.user_id NOT IN (
                SELECT DISTINCT user_id
                FROM pick
                WHERE round_id = $2
              )
            `, [competitionId, roundId]);

            noPickPenalties = noPickPlayersResult.rows.length;

            // Process each no-pick player
            for (const player of noPickPlayersResult.rows) {
              // Insert player progress record for NO-PICK
              await client.query(`
                INSERT INTO player_progress (player_id, competition_id, round_id, round_number, chosen_team, outcome)
                VALUES ($1, $2, $3, $4, $5, $6)
              `, [player.user_id, competitionId, roundId, roundNumber, 'NO-PICK', 'LOSE']);

              // Deduct life and potentially eliminate player
              const noPickLivesUpdateResult = await client.query(`
                UPDATE competition_user
                SET
                  lives_remaining = GREATEST(lives_remaining - 1, 0),
                  status = CASE
                    WHEN lives_remaining - 1 < 0 THEN 'out'
                    ELSE status
                  END
                WHERE competition_id = $1 AND user_id = $2
                RETURNING user_id, lives_remaining, status
              `, [competitionId, player.user_id]);

              // Log warning if no rows were updated (data integrity issue)
              if (noPickLivesUpdateResult.rowCount === 0) {
                console.warn(`WARNING: Failed to deduct life for NO-PICK user ${player.user_id} (${player.display_name}) in competition ${competitionId} - no competition_user record found`);
              } else if (noPickLivesUpdateResult.rows[0].status === 'out') {
                playersEliminated++;
              }
            }
          }

          // === COMPETITION COMPLETION CHECK ===
          // Check if competition should be marked as complete
          let competitionStatus = 'active';
          if (total_fixtures > 0 && total_fixtures == processed_fixtures) {
            const activePlayersResult = await client.query(`
              SELECT COUNT(*) as active_count
              FROM competition_user
              WHERE competition_id = $1 AND status = 'active'
            `, [competitionId]);

            const activeCount = parseInt(activePlayersResult.rows[0].active_count);

            // If only one or zero players remain active, mark competition as complete
            if (activeCount <= 1) {
              // Query for the winner (if there is one)
              let winnerId = null;
              if (activeCount === 1) {
                const winnerResult = await client.query(`
                  SELECT user_id
                  FROM competition_user
                  WHERE competition_id = $1 AND status = 'active'
                  LIMIT 1
                `, [competitionId]);

                if (winnerResult.rows.length > 0) {
                  winnerId = winnerResult.rows[0].user_id;
                }
              }

              // Update competition with status and winner
              await client.query(`
                UPDATE competition
                SET status = 'COMPLETE', winner_id = $2
                WHERE id = $1
              `, [competitionId, winnerId]);
              competitionStatus = 'COMPLETE';
            }
          }

          // NOTE: No 'results' notification queued here - the 'new_round' notification
          // (sent when fixtures are added) now serves this purpose with message
          // "Results are in - see how you did!"

          // === CLEANUP OLD NOTIFICATIONS FOR THIS ROUND ===
          // Mark any pending 'new_round' or 'pick_reminder' for this round as skipped - they're
          // no longer relevant now results are processed.
          await client.query(`
            UPDATE mobile_notification_queue
            SET status = 'skipped', sent_at = NOW()
            WHERE competition_id = $1
              AND round_id = $2
              AND type IN ('new_round', 'pick_reminder')
              AND status = 'pending'
          `, [competitionId, roundId]);

          // ADD AUDIT LOG ENTRY - user_id NULL, same convention as fixtureService.js's
          // "Fixtures Pushed" entry: this was triggered by the fixture service, not a person.
          await client.query(`
            INSERT INTO audit_log (competition_id, user_id, action, details)
            VALUES ($1, NULL, 'Fixture Service Processed Results', $2)
          `, [
            competitionId,
            `Processed ${fixtureIds.length} fixtures in Round ${roundNumber}. ${playersEliminated} players eliminated, ${noPickPenalties} no-pick penalties`
          ]);

          competitionsProcessed.push({
            competition_id: competitionId,
            status: 'processed',
            fixtures_processed: fixtureIds.length,
            competition_status: competitionStatus
          });

        } catch (error) {
          console.error(`Error processing competition ${competitionId}:`, error);
          competitionsProcessed.push({
            competition_id: competitionId,
            status: 'error',
            reason: 'Processing failed'
          });
        }
      }

      // Return all data needed for response
      return {
        fixtures_updated: totalFixturesUpdated,
        results_cleared: resultsCleared,
        competitions_processed: competitionsProcessed
      };
    });

    // === STEP 5: SUCCESS RESPONSE ===
    // Transaction completed successfully - send response with detailed counts
    // Always return HTTP 200 with return_code for consistency
    res.json({
      return_code: "SUCCESS",
      fixtures_updated: result.fixtures_updated,
      results_cleared: result.results_cleared,
      competitions_processed: result.competitions_processed,
      message: `${result.fixtures_updated} result${result.fixtures_updated === 1 ? '' : 's'} pushed and ${result.competitions_processed.length} competition${result.competitions_processed.length === 1 ? '' : 's'} processed`
    });

  } catch (error) {
    console.error('Push results error:', error);

    // === ERROR HANDLING ===
    // Handle specific business logic errors with appropriate return codes
    if (error.message === 'NO_RESULTS_TO_PUSH') {
      return res.json({
        return_code: "NO_RESULTS_TO_PUSH",
        message: "No results available to push"
      });
    }

    // Database or unexpected errors
    // Always return HTTP 200 with return_code for consistency
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;
