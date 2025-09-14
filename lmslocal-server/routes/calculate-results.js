/*
=======================================================================================================================================
API Route: calculate_results
=======================================================================================================================================
Method: POST
Purpose: Calculate pick outcomes based on fixture results for a round. Processes wins/losses, updates player lives, handles eliminations, and manages no-pick scenarios using bulk operations for optimal performance.
=======================================================================================================================================
Request Payload:
{
  "round_id": 123                      // integer, required - ID of round to calculate results for
}

Success Response:
{
  "return_code": "SUCCESS",
  "message": "Pick outcomes calculated successfully",
  "results": {
    "winners": 5,                      // integer, players with winning picks this round
    "losers": 3,                       // integer, players with losing picks this round  
    "draws": 0,                        // integer, players who picked draws (counted as losses)
    "processed": 10,                   // integer, total picks processed this round
    "playersEliminated": 2,            // integer, players eliminated (lives reduced to 0)
    "noPickProcessed": 2,              // integer, players who didn't pick (life deducted)
    "total": 10                        // integer, total players affected by calculation
  }
}

Error Response:
{
  "return_code": "VALIDATION_ERROR",   // or "ROUND_NOT_FOUND", "UNAUTHORIZED", "SERVER_ERROR"  
  "message": "Round ID is required and must be a number"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"    - Invalid or missing round_id parameter
"ROUND_NOT_FOUND"     - Round with specified ID does not exist
"UNAUTHORIZED"        - User not authenticated or not competition organiser
"SERVER_ERROR"        - Database error or unexpected system failure
=======================================================================================================================================
Algorithm:
1. Validate round exists and user is organiser
2. BULK calculate all pick outcomes (WIN/LOSE) based on fixture results
3. BULK update player lives based on losses
4. Mark all processed fixtures as complete
5. If all fixtures complete: process no-pick players (deduct lives)
6. Insert audit trail and player progress records
7. Return comprehensive statistics
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction, transactionQueries } = require('../database');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  try {
    const { round_id } = req.body;
    const user_id = req.user.id;

    // Validation
    if (!round_id || !Number.isInteger(round_id)) {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "Round ID is required and must be a number"
      });
    }

    // PHASE 1: GET ROUND DETAILS AND VALIDATE PERMISSIONS
    const roundResult = await query(`
      SELECT 
        r.id, r.round_number, r.competition_id, r.no_pick_processed,
        c.organiser_id, c.name as competition_name
      FROM round r
      JOIN competition c ON r.competition_id = c.id
      WHERE r.id = $1
    `, [round_id]);

    if (roundResult.rows.length === 0) {
      return res.status(200).json({
        return_code: "ROUND_NOT_FOUND",
        message: "Round not found"
      });
    }

    const round = roundResult.rows[0];

    if (round.organiser_id !== user_id) {
      return res.status(200).json({
        return_code: "UNAUTHORIZED",
        message: "Only the competition organiser can calculate results"
      });
    }

    // ULTRA-EFFICIENT TRANSACTION: ALL OPERATIONS IN SINGLE ATOMIC BLOCK
    const queries = [];

    // PHASE 2: BULK CALCULATE ALL PICK OUTCOMES
    queries.push({
      text: `
        UPDATE pick p
        SET outcome = CASE 
          WHEN f.result = 'DRAW' THEN 'LOSE'
          WHEN p.team = f.result THEN 'WIN'
          ELSE 'LOSE'
        END
        FROM fixture f
        WHERE p.fixture_id = f.id 
          AND f.round_id = $1 
          AND f.result IS NOT NULL 
          AND f.processed IS NULL
          AND p.outcome IS NULL
        RETURNING p.id, p.outcome`,
      params: [round_id]
    });

    // PHASE 3: BULK UPDATE PLAYER LIVES BASED ON LOSSES
    queries.push({
      text: `
        WITH losing_picks AS (
          SELECT p.user_id, COUNT(*) as losses
          FROM pick p
          JOIN fixture f ON p.fixture_id = f.id  
          WHERE f.round_id = $1 
            AND p.outcome = 'LOSE'
          GROUP BY p.user_id
        )
        UPDATE competition_user cu
        SET 
          lives_remaining = GREATEST(0, cu.lives_remaining - COALESCE(lp.losses, 0)),
          status = CASE 
            WHEN cu.lives_remaining - COALESCE(lp.losses, 0) <= 0 THEN 'OUT'
            ELSE cu.status 
          END
        FROM losing_picks lp
        WHERE cu.competition_id = $2 
          AND cu.user_id = lp.user_id
        RETURNING cu.user_id, cu.lives_remaining, cu.status`,
      params: [round_id, round.competition_id]
    });

    // PHASE 4: MARK FIXTURES AS PROCESSED
    queries.push({
      text: `
        UPDATE fixture 
        SET processed = CURRENT_TIMESTAMP
        WHERE round_id = $1 
          AND result IS NOT NULL 
          AND processed IS NULL
        RETURNING id, home_team_short, away_team_short, result`,
      params: [round_id]
    });

    // PHASE 5: CHECK IF ALL FIXTURES COMPLETE FOR NO_PICK PROCESSING
    queries.push({
      text: `
        SELECT 
          COUNT(*) as total_fixtures,
          COUNT(CASE WHEN result IS NOT NULL THEN 1 END) as fixtures_with_results
        FROM fixture 
        WHERE round_id = $1`,
      params: [round_id]
    });

    // Execute the main transaction
    const results = await transactionQueries(queries);
    
    const [pickResults, livesResults, fixtureResults, fixtureCountResults] = results;
    
    // Calculate statistics from results
    const picks = pickResults.rows;
    const winners = picks.filter(p => p.outcome === 'WIN').length;
    const losers = picks.filter(p => p.outcome === 'LOSE').length;
    const draws = picks.filter(p => p.outcome === 'LOSE').length; // Draws count as losses
    const processed = picks.length;
    const playersEliminated = livesResults.rows.filter(p => p.status === 'OUT').length;

    // NO_PICK PROCESSING - Only if all fixtures complete and not already processed
    const totalFixtures = parseInt(fixtureCountResults.rows[0].total_fixtures);
    const fixturesWithResults = parseInt(fixtureCountResults.rows[0].fixtures_with_results);
    
    let noPickProcessed = 0;
    
    if (totalFixtures > 0 && totalFixtures === fixturesWithResults && !round.no_pick_processed) {
      // PHASE 6: BULK NO_PICK PROCESSING
      const noPickQueries = [];

      // Insert NO_PICK records for players who didn't make picks
      noPickQueries.push({
        text: `
          INSERT INTO pick (round_id, user_id, outcome)
          SELECT $1, cu.user_id, 'NO_PICK'
          FROM competition_user cu
          WHERE cu.competition_id = $2 
            AND cu.status != 'OUT'
            AND cu.user_id NOT IN (
              SELECT p.user_id FROM pick p WHERE p.round_id = $1
            )
          RETURNING user_id`,
        params: [round_id, round.competition_id]
      });

      // Insert player_progress records for NO_PICK
      noPickQueries.push({
        text: `
          INSERT INTO player_progress (player_id, competition_id, round_id, fixture_id, chosen_team, outcome)
          SELECT cu.user_id, $2, $1, null, null, 'NO_PICK'
          FROM competition_user cu
          WHERE cu.competition_id = $2 
            AND cu.status != 'OUT'
            AND cu.user_id NOT IN (
              SELECT p.user_id FROM pick p WHERE p.round_id = $1
            )`,
        params: [round_id, round.competition_id]
      });

      // Reduce lives for NO_PICK players
      noPickQueries.push({
        text: `
          UPDATE competition_user
          SET 
            lives_remaining = GREATEST(0, lives_remaining - 1),
            status = CASE 
              WHEN lives_remaining - 1 <= 0 THEN 'OUT'
              ELSE status 
            END
          WHERE competition_id = $1 
            AND status != 'OUT'
            AND user_id NOT IN (
              SELECT p.user_id FROM pick p WHERE p.round_id = $2
            )
          RETURNING user_id, lives_remaining, status`,
        params: [round.competition_id, round_id]
      });

      // Mark NO_PICK processing as complete
      noPickQueries.push({
        text: `
          UPDATE round 
          SET no_pick_processed = true 
          WHERE id = $1`,
        params: [round_id]
      });

      const noPickResults = await transactionQueries(noPickQueries);
      noPickProcessed = noPickResults[0].rows.length;
    }

    // PHASE 7: BULK INSERT PLAYER_PROGRESS FOR REGULAR PICKS
    await query(`
      INSERT INTO player_progress (player_id, competition_id, round_id, fixture_id, chosen_team, outcome)
      SELECT p.user_id, $2, $1, p.fixture_id, p.team, p.outcome
      FROM pick p
      JOIN fixture f ON p.fixture_id = f.id
      WHERE f.round_id = $1 
        AND p.outcome IS NOT NULL 
        AND p.outcome != 'NO_PICK'
      ON CONFLICT DO NOTHING
    `, [round_id, round.competition_id]);

    // PHASE 8: CHECK IF COMPETITION SHOULD BE MARKED AS COMPLETE
    // Only check for winner if ALL fixtures in the round have results
    let competitionComplete = false;
    let activePlayers = 0;
    
    if (totalFixtures > 0 && totalFixtures === fixturesWithResults) {
      const activePlayersResult = await query(`
        SELECT COUNT(*) as active_count
        FROM competition_user 
        WHERE competition_id = $1 AND status != 'OUT'
      `, [round.competition_id]);
      
      activePlayers = parseInt(activePlayersResult.rows[0].active_count);
      
      // If 0 or 1 active players remain, mark competition as complete
      if (activePlayers <= 1) {
        await query(`
          UPDATE competition 
          SET status = 'COMPLETE'
          WHERE id = $1
        `, [round.competition_id]);
        competitionComplete = true;
        
        // Log competition completion
        const completionMessage = activePlayers === 0 
          ? 'Competition ended - all players eliminated'
          : 'Competition ended - single winner determined';
          
        await query(`
          INSERT INTO audit_log (competition_id, user_id, action, details)
          VALUES ($1, $2, 'Competition Completed', $3)
        `, [round.competition_id, user_id, completionMessage]);
      }
    } else {
      // Get active players count for response even if not checking for completion
      const activePlayersResult = await query(`
        SELECT COUNT(*) as active_count
        FROM competition_user 
        WHERE competition_id = $1 AND status != 'OUT'
      `, [round.competition_id]);
      
      activePlayers = parseInt(activePlayersResult.rows[0].active_count);
    }

    // PHASE 9: INSERT AUDIT LOG FOR RESULTS CALCULATION
    await query(`
      INSERT INTO audit_log (competition_id, user_id, action, details)
      VALUES ($1, $2, 'Results Calculated', $3)
    `, [
      round.competition_id,
      user_id,
      `Calculated outcomes for Round ${round.round_number}: ${processed + noPickProcessed} picks processed, ${activePlayers} players remaining`
    ]);

    // Return success with statistics
    res.json({
      return_code: "SUCCESS",
      message: competitionComplete 
        ? `Results calculated - Competition completed! ${activePlayers === 0 ? 'All players eliminated' : 'Winner determined'}`
        : "Pick outcomes calculated successfully",
      results: {
        winners,
        losers,
        draws,
        processed: processed + noPickProcessed,
        skipped: 0,
        playersEliminated,
        noPickProcessed,
        total: winners + losers + draws + noPickProcessed,
        activePlayers,
        competitionComplete
      }
    });

  } catch (error) {
    console.error('Calculate results error:', error);
    res.status(200).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;