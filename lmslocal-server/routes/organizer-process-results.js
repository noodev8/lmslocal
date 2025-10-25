/*
=======================================================================================================================================
API Route: organizer-process-results
=======================================================================================================================================
Method: POST
Purpose: Processes all results for the current round. Handles player eliminations, no-pick penalties, and competition completion.
         Only processes fixtures that have results set but are not yet marked as processed.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123                       // integer, required - Competition ID
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "fixtures_processed": 10,                   // integer, Count of fixtures processed
  "players_eliminated": 3,                    // integer, Count of players eliminated this round
  "no_pick_penalties": 2,                     // integer, Count of players penalized for not picking
  "competition_status": "active",             // string, "active" or "COMPLETE" (if winner determined)
  "active_players_remaining": 5,              // integer, Count of active players after processing
  "message": "Round processed successfully"   // string, Summary message
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "NO_RESULTS_TO_PROCESS",
  "message": "All fixtures have been processed or have no results set"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"              - Required fields are missing
"UNAUTHORIZED"                - User is not the organiser of this competition
"COMPETITION_NOT_FOUND"       - Competition doesn't exist
"NO_ROUNDS"                   - No rounds exist for this competition
"NO_RESULTS_TO_PROCESS"       - No unprocessed results to process
"SERVER_ERROR"                - Database or unexpected error
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const { canManageResults } = require('../utils/permissions');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  logApiCall('organizer-process-results');

  try {
    const { competition_id } = req.body;
    const user_id = req.user.id;

    // ========================================
    // STEP 1: VALIDATE REQUEST PAYLOAD
    // ========================================

    // Validate competition_id
    if (!competition_id || !Number.isInteger(parseInt(competition_id))) {
      return res.status(200).json({
        return_code: "MISSING_FIELDS",
        message: "competition_id is required and must be an integer"
      });
    }

    const competitionIdInt = parseInt(competition_id);

    // ========================================
    // STEP 2: VERIFY COMPETITION AND AUTHORIZATION
    // ========================================

    // Get competition details and verify user is organiser
    const competitionResult = await query(`
      SELECT
        id,
        name,
        organiser_id,
        status
      FROM competition
      WHERE id = $1
    `, [competitionIdInt]);

    // Check if competition exists
    if (competitionResult.rows.length === 0) {
      return res.status(200).json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition not found"
      });
    }

    const competition = competitionResult.rows[0];

    // Verify user has permission to manage results (organiser or delegated permission)
    const permission = await canManageResults(user_id, competition_id);
    if (!permission.authorized) {
      return res.status(200).json({
        return_code: "UNAUTHORIZED",
        message: "You do not have permission to process results for this competition"
      });
    }

    // ========================================
    // STEP 3: PROCESS RESULTS IN TRANSACTION
    // ========================================

    const result = await transaction(async (client) => {
      // Get the current round for this competition
      const roundResult = await client.query(`
        SELECT id as round_id, round_number
        FROM round
        WHERE competition_id = $1
        ORDER BY round_number DESC
        LIMIT 1
      `, [competitionIdInt]);

      // Check if any rounds exist
      if (roundResult.rows.length === 0) {
        throw new Error('NO_ROUNDS');
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

      // Check if there are any results to process
      if (unprocessedResults.rows.length === 0) {
        throw new Error('NO_RESULTS_TO_PROCESS');
      }

      // Mark all unprocessed results as processed
      const fixtureIds = unprocessedResults.rows.map(row => row.id);
      await client.query(`
        UPDATE fixture
        SET processed = NOW()
        WHERE id = ANY($1::integer[])
      `, [fixtureIds]);

      // ========================================
      // PROCESS PLAYER PICKS AND ELIMINATIONS
      // ========================================

      let playersEliminated = 0;

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
          `, [pick.user_id, competitionIdInt, roundId, fixture.id, pick.team, outcome]);

          // Update player lives based on outcome
          if (outcome === 'LOSE') {
            const updateResult = await client.query(`
              UPDATE competition_user
              SET
                lives_remaining = GREATEST(lives_remaining - 1, 0),
                status = CASE
                  WHEN lives_remaining - 1 < 0 THEN 'out'
                  ELSE status
                END
              WHERE competition_id = $1 AND user_id = $2
              RETURNING status
            `, [competitionIdInt, pick.user_id]);

            // Track if player was eliminated this round
            if (updateResult.rows[0] && updateResult.rows[0].status === 'out') {
              playersEliminated++;
            }
          }
        }
      }

      // ========================================
      // PROCESS NO-PICK PENALTIES
      // ========================================

      let noPickPenalties = 0;

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
        `, [competitionIdInt, roundId]);

        noPickPenalties = noPickPlayersResult.rows.length;

        // Process each no-pick player
        for (const player of noPickPlayersResult.rows) {
          // Insert player progress record for NO-PICK
          await client.query(`
            INSERT INTO player_progress (player_id, competition_id, round_id, chosen_team, outcome)
            VALUES ($1, $2, $3, $4, $5)
          `, [player.user_id, competitionIdInt, roundId, 'NO-PICK', 'LOSE']);

          // Deduct life and potentially eliminate player
          const updateResult = await client.query(`
            UPDATE competition_user
            SET
              lives_remaining = GREATEST(lives_remaining - 1, 0),
              status = CASE
                WHEN lives_remaining - 1 < 0 THEN 'out'
                ELSE status
              END
            WHERE competition_id = $1 AND user_id = $2
            RETURNING status
          `, [competitionIdInt, player.user_id]);

          // Track if player was eliminated
          if (updateResult.rows[0] && updateResult.rows[0].status === 'out') {
            playersEliminated++;
          }
        }
      }

      // ========================================
      // CHECK FOR COMPETITION COMPLETION
      // ========================================

      let competitionStatus = 'active';
      let activePlayersRemaining = 0;

      // Only check for completion if ALL fixtures in round are processed
      if (total_fixtures > 0 && total_fixtures == processed_fixtures) {
        const activePlayersResult = await client.query(`
          SELECT COUNT(*) as active_count
          FROM competition_user
          WHERE competition_id = $1 AND status = 'active'
        `, [competitionIdInt]);

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
            `, [competitionIdInt]);

            if (winnerResult.rows.length > 0) {
              winnerId = winnerResult.rows[0].user_id;
            }
          }

          // Update competition with status and winner
          await client.query(`
            UPDATE competition
            SET status = 'COMPLETE', winner_id = $2
            WHERE id = $1
          `, [competitionIdInt, winnerId]);

          competitionStatus = 'COMPLETE';
        }
      }

      // ========================================
      // ADD AUDIT LOG ENTRY
      // ========================================

      await client.query(`
        INSERT INTO audit_log (competition_id, user_id, action, details)
        VALUES ($1, $2, 'Organiser Processed Results', $3)
      `, [
        competitionIdInt,
        user_id,
        `Processed ${fixtureIds.length} fixtures in Round ${roundNumber}. ${playersEliminated} players eliminated, ${noPickPenalties} no-pick penalties`
      ]);

      // Return processing summary
      return {
        fixtures_processed: fixtureIds.length,
        players_eliminated: playersEliminated,
        no_pick_penalties: noPickPenalties,
        competition_status: competitionStatus,
        active_players_remaining: activePlayersRemaining
      };
    });

    // ========================================
    // STEP 4: RETURN SUCCESS RESPONSE
    // ========================================

    return res.status(200).json({
      return_code: "SUCCESS",
      fixtures_processed: result.fixtures_processed,
      players_eliminated: result.players_eliminated,
      no_pick_penalties: result.no_pick_penalties,
      competition_status: result.competition_status,
      active_players_remaining: result.active_players_remaining,
      message: "Round processed successfully"
    });

  } catch (error) {
    // ========================================
    // ERROR HANDLING
    // ========================================

    // Handle specific business logic errors
    if (error.message === 'NO_ROUNDS') {
      return res.status(200).json({
        return_code: "NO_ROUNDS",
        message: "No rounds exist for this competition yet"
      });
    }

    if (error.message === 'NO_RESULTS_TO_PROCESS') {
      return res.status(200).json({
        return_code: "NO_RESULTS_TO_PROCESS",
        message: "All fixtures have been processed or have no results set"
      });
    }

    // Log unexpected errors
    console.error('Error in organizer-process-results:', error);
    return res.status(200).json({
      return_code: "SERVER_ERROR",
      message: "An error occurred while processing results"
    });
  }
});

module.exports = router;
