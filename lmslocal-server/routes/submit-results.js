/*
=======================================================================================================================================
API Route: submit-results
=======================================================================================================================================
Method: POST
Purpose: Store fixture results in database, then process unprocessed results
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,                // integer, required - competition to submit results for
  "results": [                          // array, required - fixture results to submit
    {
      "fixture_id": 456,                // integer, required - unique fixture identifier  
      "result": "ARS"                   // string, required - winning team short name or "DRAW"
    },
    {
      "fixture_id": 789,
      "result": "DRAW"
    }
  ]
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Results saved successfully",
  "fixtures_updated": 2,                // integer, number of fixtures updated
  "fixtures_processed": 5               // integer, number of fixtures marked as processed
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "VALIDATION_ERROR",
  "message": "competition_id is required and must be an integer"
}
OR
{
  "return_code": "UNAUTHORIZED",
  "message": "Only the competition organizer can submit results"
}
OR
{
  "return_code": "COMPETITION_NOT_FOUND",
  "message": "Competition not found or inactive"
}
OR
{
  "return_code": "SERVER_ERROR",
  "message": "Database error occurred during result saving"
}
=======================================================================================================================================
Return Codes:
"SUCCESS" - Results saved successfully
"VALIDATION_ERROR" - Invalid request data
"UNAUTHORIZED" - User not competition organizer
"COMPETITION_NOT_FOUND" - Competition does not exist
"SERVER_ERROR" - Database or server error
=======================================================================================================================================
*/

const express = require('express');
const { transaction } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  try {
    // Log API call for monitoring and debugging
    logApiCall('submit-results');
    
    const { competition_id, results = [] } = req.body;

    // === VALIDATION PHASE ===
    // Validate required competition_id parameter
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "competition_id is required and must be an integer"
      });
    }

    // Validate results array structure
    if (!Array.isArray(results)) {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "results must be an array"
      });
    }

    // Validate each result item structure
    for (const result of results) {
      if (!result.fixture_id || !Number.isInteger(result.fixture_id)) {
        return res.status(200).json({
          return_code: "VALIDATION_ERROR",
          message: "Each result must have a valid integer fixture_id"
        });
      }
      
      if (result.result !== null && (typeof result.result !== 'string' || result.result.trim() === '')) {
        return res.status(200).json({
          return_code: "VALIDATION_ERROR",
          message: "Each result must be a valid string or null"
        });
      }
    }

    // === ATOMIC TRANSACTION PROCESSING ===
    // Execute all database operations within a single atomic transaction
    const response = await transaction(async (client) => {
      
      // === STEP 1: AUTHENTICATION & AUTHORIZATION ===
      // Verify competition exists and user is the organizer
      const competitionResult = await client.query(`
        SELECT organiser_id, name, status
        FROM competition 
        WHERE id = $1
      `, [competition_id]);
      
      if (competitionResult.rows.length === 0) {
        return {
          return_code: "COMPETITION_NOT_FOUND",
          message: "Competition not found or inactive"
        };
      }

      const competition = competitionResult.rows[0];
      
      // Verify user is the competition organizer
      if (competition.organiser_id !== req.user.id) {
        return {
          return_code: "UNAUTHORIZED",
          message: "Only the competition organizer can submit results"
        };
      }

      // === STEP 2: UPDATE FIXTURE RESULTS ===
      // Simply store the results in the fixture table without any processing
      let fixturesUpdated = 0;
      
      if (results.length > 0) {
        // Bulk update fixture results using efficient VALUES clause
        const updateValues = results.map((result, index) => 
          `($${index * 2 + 1}::integer, $${index * 2 + 2}::text)`
        ).join(', ');
        
        const updateParams = results.flatMap(result => [result.fixture_id, result.result]);
        
        const updateResult = await client.query(`
          UPDATE fixture 
          SET result = data.result
          FROM (VALUES ${updateValues}) AS data(fixture_id, result)
          WHERE fixture.id = data.fixture_id::integer
        `, updateParams);
        
        fixturesUpdated = updateResult.rowCount || 0;
      }

      // === STEP 3: PROCESS UNPROCESSED RESULTS ===
      // After storing results, find and process any unprocessed results in this round
      const processResults = async () => {
        // Get the current round for this competition
        const roundResult = await client.query(`
          SELECT r.id as round_id
          FROM round r
          WHERE r.competition_id = $1
          ORDER BY r.round_number DESC
          LIMIT 1
        `, [competition_id]);
        
        if (roundResult.rows.length === 0) {
          return 0; // No rounds found
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
          return 0; // No unprocessed results to process
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
            `, [pick.user_id, competition_id, roundId, fixture.id, pick.team, outcome]);
            
            // Update player lives based on outcome
            if (outcome === 'LOSE') {
              await client.query(`
                UPDATE competition_user 
                SET 
                  lives_remaining = GREATEST(lives_remaining - 1, 0),
                  status = CASE 
                    WHEN lives_remaining <= 1 THEN 'out' 
                    ELSE status 
                  END
                WHERE competition_id = $1 AND user_id = $2
              `, [competition_id, pick.user_id]);
            }
          }
        }
        
        // === NO-PICK PENALTY PROCESSING ===
        // Only process no-pick penalties if we actually processed some fixtures
        // and ALL fixtures in the round are now processed
        if (fixtureIds.length > 0) {
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
            `, [competition_id, roundId]);
            
            // Process each no-pick player
            for (const player of noPickPlayersResult.rows) {
              // Insert player progress record for NO-PICK
              await client.query(`
                INSERT INTO player_progress (player_id, competition_id, round_id, chosen_team, outcome)
                VALUES ($1, $2, $3, $4, $5)
              `, [player.user_id, competition_id, roundId, 'NO-PICK', 'LOSE']);
              
              // Deduct life and potentially eliminate player
              await client.query(`
                UPDATE competition_user 
                SET 
                  lives_remaining = GREATEST(lives_remaining - 1, 0),
                  status = CASE 
                    WHEN lives_remaining <= 1 THEN 'out' 
                    ELSE status 
                  END
                WHERE competition_id = $1 AND user_id = $2
              `, [competition_id, player.user_id]);
            }
          }
        }
        
        return fixtureIds.length;
      };
      
      const processedCount = await processResults();

      return {
        return_code: "SUCCESS",
        message: "Results saved successfully",
        fixtures_updated: fixturesUpdated,
        fixtures_processed: processedCount
      };

    }); // End of transaction

    // Return the response from the transaction
    return res.status(200).json(response);

  } catch (error) {
    // Log detailed error information for debugging
    console.error('Error in submit-results:', {
      error: error.message,
      stack: error.stack,
      competition_id: req.body?.competition_id,
      user_id: req.user?.id,
      results_count: req.body?.results?.length || 0
    });
    
    // Return generic server error to client
    return res.status(200).json({
      return_code: "SERVER_ERROR",
      message: "Database error occurred during result saving"
    });
  }
});

module.exports = router;