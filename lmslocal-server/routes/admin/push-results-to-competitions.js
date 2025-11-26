/*
=======================================================================================================================================
API Route: push-results-to-competitions
=======================================================================================================================================
Method: POST
Purpose: Pushes results from fixture_load to competition fixtures and automatically processes them (cron/ad-hoc execution).
         1. Updates fixture.result field with winning team short name or "DRAW"
         2. Only updates fixtures in competitions where fixture_service = true
         3. Automatically processes results (eliminations, no-picks, competition completion)
         4. Only updates fixtures where result is NULL (never overrides existing results)
=======================================================================================================================================
Request Payload:
{
  "bot_manage": "BOT_MAGIC_2025"       // string, required - bot management identifier
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "fixtures_updated": 15,                 // integer, number of competition fixtures updated with results
  "results_marked_pushed": 15,            // integer, number of fixture_load records marked as pushed
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
"UNAUTHORIZED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { transaction } = require('../../database');       // Destructured database import from central pooling (using transaction for atomicity)
const { logApiCall } = require('../../utils/apiLogger');  // API logging utility
const router = express.Router();

// Bot management identifier for testing endpoints
const BOT_MANAGE = "BOT_MAGIC_2025";

router.post('/', async (req, res) => {
  // Log this API call for monitoring and debugging
  logApiCall('push-results-to-competitions');

  try {
    const { bot_manage } = req.body;

    // STEP 1: Validate bot management identifier
    if (!bot_manage || bot_manage !== BOT_MANAGE) {
      return res.json({
        return_code: "UNAUTHORIZED",
        message: "Invalid bot management identifier"
      });
    }

    // Execute all operations in a single atomic transaction
    // This ensures either ALL changes succeed or ALL are rolled back
    const result = await transaction(async (client) => {

      // === STEP 1: GET ALL UNPUSHED RESULTS ===
      // Get all results that haven't been pushed yet
      // The gameweek field in each result will be used to match fixtures correctly
      const unpushedResults = await client.query(`
        SELECT
          fixture_id,
          home_team_short,
          away_team_short,
          home_score,
          away_score,
          gameweek
        FROM fixture_load
        WHERE gameweek > 0
        AND results_pushed = false
        AND home_score IS NOT NULL
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
      // - gameweek matches (critical to avoid applying results to wrong round)
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
        // - Gameweek matches (prevents applying results to wrong fixtures)
        // - result IS NULL (NEVER override existing results)
        // RETURNING clause gives us the competition_ids that were affected
        const fixtureUpdateResult = await client.query(`
          UPDATE fixture f
          SET result = $1
          FROM competition c
          WHERE f.competition_id = c.id
          AND c.fixture_service = true
          AND f.home_team_short = $2
          AND f.away_team_short = $3
          AND f.gameweek = $4
          AND f.result IS NULL
          RETURNING f.competition_id
        `, [resultValue, resultData.home_team_short, resultData.away_team_short, resultData.gameweek]);

        // Track how many fixtures were updated
        totalFixturesUpdated += fixtureUpdateResult.rowCount || 0;

        // Track which competitions were affected (for automatic processing)
        fixtureUpdateResult.rows.forEach(row => {
          affectedCompetitions.add(row.competition_id);
        });
      }

      // === STEP 3: MARK RESULTS AS PUSHED IN FIXTURE_LOAD ===
      // Now that we've successfully updated all competition fixtures,
      // mark these results as pushed in the fixture_load table
      // This prevents them from being processed again on the next run
      const markPushedResult = await client.query(`
        UPDATE fixture_load
        SET results_pushed = true, results_pushed_at = NOW()
        WHERE gameweek > 0
        AND results_pushed = false
        AND home_score IS NOT NULL
        AND away_score IS NOT NULL
        RETURNING fixture_id
      `);

      const resultsMarkedPushed = markPushedResult.rows.length;

      // === STEP 4: AUTO-PROCESS RESULTS FOR AFFECTED COMPETITIONS ===
      // For all competitions that had results updated (fixture_service = true),
      // automatically process the results (eliminations, no-picks, competition completion)
      // This replicates the submit-results processing logic
      const competitionsProcessed = [];

      for (const competitionId of affectedCompetitions) {
        try {
          // Get the latest round for this competition
          const roundResult = await client.query(`
            SELECT r.id as round_id
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

          // Mark all unprocessed results as processed
          const fixtureIds = unprocessedResults.rows.map(row => row.id);
          await client.query(`
            UPDATE fixture
            SET processed = NOW()
            WHERE id = ANY($1::integer[])
          `, [fixtureIds]);

          // === PLAYER OUTCOME PROCESSING ===
          // Update pick outcomes for all processed fixtures
          for (const fixture of unprocessedResults.rows) {
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
                INSERT INTO player_progress (player_id, competition_id, round_id, fixture_id, chosen_team, outcome)
                VALUES ($1, $2, $3, $4, $5, $6)
              `, [pick.user_id, competitionId, roundId, fixture.id, pick.team, outcome]);

              // Update player lives based on outcome
              if (outcome === 'LOSE') {
                const livesUpdateResult = await client.query(`
                  UPDATE competition_user
                  SET
                    lives_remaining = GREATEST(lives_remaining - 1, 0),
                    status = CASE
                      WHEN lives_remaining - 1 <= 0 THEN 'out'
                      ELSE status
                    END
                  WHERE competition_id = $1 AND user_id = $2
                  RETURNING user_id, lives_remaining, status
                `, [competitionId, pick.user_id]);

                // Log warning if no rows were updated (data integrity issue)
                if (livesUpdateResult.rowCount === 0) {
                  console.warn(`WARNING: Failed to deduct life for user ${pick.user_id} (${pick.display_name}) in competition ${competitionId} - no competition_user record found`);
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

            // Process each no-pick player
            for (const player of noPickPlayersResult.rows) {
              // Insert player progress record for NO-PICK
              await client.query(`
                INSERT INTO player_progress (player_id, competition_id, round_id, chosen_team, outcome)
                VALUES ($1, $2, $3, $4, $5)
              `, [player.user_id, competitionId, roundId, 'NO-PICK', 'LOSE']);

              // Deduct life and potentially eliminate player
              const noPickLivesUpdateResult = await client.query(`
                UPDATE competition_user
                SET
                  lives_remaining = GREATEST(lives_remaining - 1, 0),
                  status = CASE
                    WHEN lives_remaining - 1 <= 0 THEN 'out'
                    ELSE status
                  END
                WHERE competition_id = $1 AND user_id = $2
                RETURNING user_id, lives_remaining, status
              `, [competitionId, player.user_id]);

              // Log warning if no rows were updated (data integrity issue)
              if (noPickLivesUpdateResult.rowCount === 0) {
                console.warn(`WARNING: Failed to deduct life for NO-PICK user ${player.user_id} (${player.display_name}) in competition ${competitionId} - no competition_user record found`);
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

          // === QUEUE MOBILE NOTIFICATIONS ===
          // Queue 'results' notifications for all players who were active this round
          // (either they made a pick or they were penalized for no-pick)
          // Excludes guest users (email starts with 'lms-guest')
          await client.query(`
            INSERT INTO mobile_notification_queue (user_id, type, competition_id, round_id, round_number, status, created_at)
            SELECT DISTINCT pp.player_id, 'results', $1, $2, r.round_number, 'pending', NOW()
            FROM player_progress pp
            JOIN round r ON r.id = pp.round_id
            JOIN app_user au ON au.id = pp.player_id
            WHERE pp.competition_id = $1
              AND pp.round_id = $2
              AND au.email NOT LIKE '%@lms-guest.%'
          `, [competitionId, roundId]);

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
        results_marked_pushed: resultsMarkedPushed,
        competitions_processed: competitionsProcessed
      };
    });

    // === STEP 5: SUCCESS RESPONSE ===
    // Transaction completed successfully - send response with detailed counts
    // Always return HTTP 200 with return_code for consistency
    res.json({
      return_code: "SUCCESS",
      fixtures_updated: result.fixtures_updated,
      results_marked_pushed: result.results_marked_pushed,
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
