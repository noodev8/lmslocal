/*
=======================================================================================================================================
API Route: push-results-to-competition
=======================================================================================================================================
Method: POST
Purpose: Pushes the staged results in fixture_load to ONE competition and processes them
         (eliminations, no-pick penalties, competition completion).

         1. Updates fixture.result for this competition only, from the staged scores
         2. Processes those results: outcomes, player_progress, lives, no-picks, completion
         3. Does NOT touch fixture_load - see "Why the staging table is left alone" below

         This is the per-competition replacement for push-results-to-competitions.js (plural),
         which did every affected competition in one transaction. That route is deprecated and
         no longer registered; read its header before reviving it. The difference that matters:

           plural   - one call, every competition, ONE transaction. Cost is the sum across the
                      batch, and a timeout anywhere rolls back every competition in it.
           this one - one call, one competition, its own transaction. The admin pushes each in
                      turn and sees each result before moving on. Nothing compounds.

         SHARED LOGIC WARNING: the processing block below (outcome, player_progress,
         lives/elimination threshold, no-pick penalties, competition completion, notification
         cleanup, audit log) is intentionally kept identical to routes/organizer-process-results.js.
         That route runs the same steps for organiser-managed (fixture_service = false)
         competitions. If you change the rules here - the lives/elimination threshold in
         particular - change them there too, or the two halves of the customer base end up
         playing different games. They are two copies of one ruleset, not two rulesets, until
         they get consolidated into one shared function (not done yet - deliberately deferred).
=======================================================================================================================================
Why the staging table is left alone:

  The plural route deleted the pushed rows from fixture_load as its final step, which is what
  enforced "only one pending batch at a time". Pushing one competition at a time cannot do that:
  the other subscribed competitions still need those same staged rows to match against. So
  clearing the batch is now its own deliberate step - /admin/clear-staged-batch - which the admin
  presses once every competition has been pushed. Until then the batch stays put and staging a
  new one stays blocked, exactly as before.
=======================================================================================================================================
Why a re-push is harmless:

  Step 1 only writes fixtures where result IS NULL, and step 2 only processes fixtures where
  processed IS NULL. So pushing a competition that has already been pushed changes nothing and
  returns ALREADY_PUSHED. That matters because the admin drives this by hand, one row at a time,
  and a failed row whose real outcome is unclear can simply be pressed again.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 149                     // integer, required - the competition to push to
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "competition_id": 149,                    // integer, the competition pushed to
  "fixtures_updated": 10,                   // integer, fixtures given a result from the staged batch
  "fixtures_processed": 10,                 // integer, fixtures whose picks were settled
  "players_eliminated": 3,                  // integer, players who lost their last life this round
  "no_pick_penalties": 2,                   // integer, active players penalised for not picking
  "competition_status": "active",           // string, "active" or "COMPLETE" (if a winner was decided)
  "active_players_remaining": 5,            // integer, active players after processing
  "message": "Results pushed and processed"
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"            - competition_id absent or not an integer
"COMPETITION_NOT_FOUND"     - No competition with that id
"NOT_SUBSCRIBED"            - Competition has fixture_service = false; the organiser owns its results
"NO_RESULTS_TO_PUSH"        - Nothing staged in fixture_load with both scores filled in
"ALREADY_PUSHED"            - Nothing left to do: no fixture matched, and none awaits processing
"NO_ROUNDS"                 - Competition has no rounds yet
"UNAUTHORIZED"              - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"             - Admin session has expired
"SERVER_ERROR"              - Database or unexpected error
=======================================================================================================================================
*/

const express = require('express');
const { transaction } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const router = express.Router();

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('push-results-to-competition');

  try {
    const { competition_id } = req.body;

    if (!competition_id || !Number.isInteger(parseInt(competition_id))) {
      return res.json({
        return_code: 'MISSING_FIELDS',
        message: 'competition_id is required and must be an integer'
      });
    }

    const competitionId = parseInt(competition_id);

    // TEST MODE: when FIXTURE_SERVICE_TEST_MODE is set in .env, only competitions organised by
    // that email are eligible - every other subscribed competition is left untouched (result
    // stays NULL, picked up again once test mode is turned off). See fixtureService.js for the
    // matching push-fixtures-side restriction, and get-fixture-team-lists.js for the admin
    // banner that surfaces this. Leave the var blank for normal production behaviour.
    const testModeEmail = process.env.FIXTURE_SERVICE_TEST_MODE || null;

    const result = await transaction(async (client) => {

      // === STEP 0: THE COMPETITION MUST BE ONE WE OWN THE RESULTS FOR ===
      const competitionResult = await client.query(`
        SELECT c.id, c.name, c.fixture_service, u.email AS organiser_email
        FROM competition c
        JOIN app_user u ON u.id = c.organiser_id
        WHERE c.id = $1
      `, [competitionId]);

      if (competitionResult.rows.length === 0) {
        throw new Error('COMPETITION_NOT_FOUND');
      }

      const competition = competitionResult.rows[0];

      // fixture_service = false means the organiser drives results from their own screen
      // (organizer-process-results). Pushing into one would fight them for the same rounds.
      if (competition.fixture_service !== true) {
        throw new Error('NOT_SUBSCRIBED');
      }

      // Test mode is a hard filter, not a warning - honour it here as well as in the matching
      // UPDATE, so a competition outside the test organiser cannot be pushed to by id either.
      if (testModeEmail && competition.organiser_email !== testModeEmail) {
        throw new Error('NOT_SUBSCRIBED');
      }

      // === STEP 1: GET THE STAGED BATCH ===
      // fixture_load only ever holds the currently staged batch, so any row with both scores
      // filled in is ready to push.
      const stagedResults = await client.query(`
        SELECT home_team_short, away_team_short, home_score, away_score, kickoff_time
        FROM fixture_load
        WHERE home_score IS NOT NULL
        AND away_score IS NOT NULL
      `);

      // An empty batch is deliberately NOT fatal here. The batch can be cleared while a
      // competition still has results written but never processed, and step 3 is the only thing
      // that can finish those. Bailing out now would strand that round with no route able to
      // apply its eliminations. If there turns out to be nothing to process either, step 3
      // reports it below.

      // === STEP 2: WRITE THOSE RESULTS ONTO THIS COMPETITION'S FIXTURES ===
      // Match criteria:
      // - this competition only
      // - home_team_short and away_team_short match
      // - kickoff_time matches (see below)
      // - result IS NULL (NEVER override an existing result)
      //
      // Result value logic:
      // - home_score > away_score -> result = home_team_short (home team won)
      // - away_score > home_score -> result = away_team_short (away team won)
      // - scores equal            -> result = 'DRAW'
      //
      // Teams alone are not unique across time - the same fixture recurs season to season - so
      // kickoff_time is what makes the match unambiguous. push-fixtures copies kickoff_time
      // verbatim from the staged row, so this costs nothing for a legitimate match and excludes
      // coincidental repeats. (result IS NULL already stops resulted rounds being touched; this
      // closes the case of an old round left unresolved.)
      let fixturesUpdated = 0;

      for (const staged of stagedResults.rows) {
        let resultValue;
        if (staged.home_score > staged.away_score) {
          resultValue = staged.home_team_short;
        } else if (staged.away_score > staged.home_score) {
          resultValue = staged.away_team_short;
        } else {
          resultValue = 'DRAW';
        }

        const fixtureUpdateResult = await client.query(`
          UPDATE fixture
          SET result = $1
          WHERE competition_id = $2
          AND home_team_short = $3
          AND away_team_short = $4
          AND kickoff_time = $5
          AND result IS NULL
        `, [resultValue, competitionId, staged.home_team_short, staged.away_team_short, staged.kickoff_time]);

        fixturesUpdated += fixtureUpdateResult.rowCount || 0;
      }

      // === STEP 3: PROCESS THIS COMPETITION'S RESULTS ===
      const roundResult = await client.query(`
        SELECT r.id AS round_id, r.round_number
        FROM round r
        WHERE r.competition_id = $1
        ORDER BY r.round_number DESC
        LIMIT 1
      `, [competitionId]);

      if (roundResult.rows.length === 0) {
        throw new Error('NO_ROUNDS');
      }

      const roundId = roundResult.rows[0].round_id;
      const roundNumber = roundResult.rows[0].round_number;

      // Find fixtures with results that are NOT yet processed. Deliberately not gated on
      // fixturesUpdated > 0: a previous attempt may have written the results and then failed
      // before processing them, and this is the path that finishes that job.
      const unprocessedResults = await client.query(`
        SELECT id, result, home_team_short, away_team_short
        FROM fixture
        WHERE round_id = $1
        AND result IS NOT NULL
        AND processed IS NULL
      `, [roundId]);

      if (unprocessedResults.rows.length === 0) {
        // Nothing to process. Which of the two this is depends on whether a batch was staged at
        // all - "no batch" and "this competition is already done" are different things to the
        // admin driving the screen.
        throw new Error(stagedResults.rows.length === 0 ? 'NO_RESULTS_TO_PUSH' : 'ALREADY_PUSHED');
      }

      // Claim the fixtures before any player state is touched. Same claim as the one in
      // routes/organizer-process-results.js, and the `processed IS NULL` carries the same
      // weight: under READ COMMITTED the loser of a race against a concurrent run
      // re-evaluates this predicate once the winner commits, matches nothing, and drops out
      // instead of deducting a second life for the same pick.
      const claimResult = await client.query(`
        UPDATE fixture
        SET processed = NOW()
        WHERE id = ANY($1::integer[])
        AND processed IS NULL
        RETURNING id
      `, [unprocessedResults.rows.map(row => row.id)]);

      // Work from what was actually claimed rather than what was selected - a concurrent run may
      // have taken some of them. Claiming nothing means it took all of them and there is no work
      // left, which is the same outcome as having found nothing unprocessed above.
      const claimedIds = new Set(claimResult.rows.map(row => row.id));
      if (claimedIds.size === 0) {
        throw new Error('ALREADY_PUSHED');
      }

      const fixturesToProcess = unprocessedResults.rows.filter(fixture => claimedIds.has(fixture.id));
      const fixtureIds = fixturesToProcess.map(fixture => fixture.id);

      let playersEliminated = 0;
      let noPickPenalties = 0;

      // === PLAYER OUTCOME PROCESSING ===
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
      let competitionStatus = 'active';
      let activePlayersRemaining = 0;

      if (total_fixtures > 0 && total_fixtures == processed_fixtures) {
        const activePlayersResult = await client.query(`
          SELECT COUNT(*) as active_count
          FROM competition_user
          WHERE competition_id = $1 AND status = 'active'
        `, [competitionId]);

        activePlayersRemaining = parseInt(activePlayersResult.rows[0].active_count);

        // If only one or zero players remain active, mark competition as complete
        if (activePlayersRemaining <= 1) {
          // Query for the winner (if there is one)
          let winnerId = null;
          if (activePlayersRemaining === 1) {
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

      return {
        competition_id: competitionId,
        competition_name: competition.name,
        fixtures_updated: fixturesUpdated,
        fixtures_processed: fixtureIds.length,
        players_eliminated: playersEliminated,
        no_pick_penalties: noPickPenalties,
        competition_status: competitionStatus,
        active_players_remaining: activePlayersRemaining
      };
    });

    return res.json({
      return_code: 'SUCCESS',
      ...result,
      message: 'Results pushed and processed'
    });

  } catch (error) {
    // Business-logic outcomes are thrown so the transaction rolls back cleanly; map them here.
    const known = {
      COMPETITION_NOT_FOUND: 'Competition not found',
      NOT_SUBSCRIBED: 'This competition is not on the fixture service, so its organiser owns its results',
      NO_RESULTS_TO_PUSH: 'No staged results are waiting to be pushed',
      ALREADY_PUSHED: 'Nothing left to push - this competition already has these results processed',
      NO_ROUNDS: 'This competition has no rounds yet'
    };

    if (known[error.message]) {
      return res.json({ return_code: error.message, message: known[error.message] });
    }

    console.error('push-results-to-competition error:', error);
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Internal server error'
    });
  }
});

module.exports = router;
