/*
=======================================================================================================================================
Calculate Results Route (REDESIGNED)
=======================================================================================================================================
Method: POST
Purpose: Calculate pick outcomes based on fixture results for a round - ULTRA-EFFICIENT VERSION
Design: Single transaction with bulk SQL operations instead of N+1 queries
=======================================================================================================================================
*/

const express = require('express');
const jwt = require('jsonwebtoken');
const { query, transaction } = require('../database');
const router = express.Router();

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        return_code: "UNAUTHORIZED",
        message: "No token provided"
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await query('SELECT id, email, display_name, email_verified FROM app_user WHERE id = $1', [decoded.user_id || decoded.userId]);
    if (result.rows.length === 0) {
      return res.status(401).json({
        return_code: "UNAUTHORIZED",
        message: "Invalid token"
      });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    return res.status(401).json({
      return_code: "UNAUTHORIZED",
      message: "Invalid token"
    });
  }
};

router.post('/', verifyToken, async (req, res) => {
  try {
    const { round_id } = req.body;
    const user_id = req.user.id;

    // Validation
    if (!round_id || !Number.isInteger(round_id)) {
      return res.status(400).json({
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
      return res.status(404).json({
        return_code: "ROUND_NOT_FOUND",
        message: "Round not found"
      });
    }

    const round = roundResult.rows[0];

    if (round.organiser_id !== user_id) {
      return res.status(403).json({
        return_code: "UNAUTHORIZED",
        message: "Only the competition organiser can calculate results"
      });
    }

    // ULTRA-EFFICIENT TRANSACTION: ALL OPERATIONS IN SINGLE ATOMIC BLOCK
    const transactionQueries = [];

    // PHASE 2: BULK CALCULATE ALL PICK OUTCOMES
    transactionQueries.push({
      text: `
        UPDATE pick 
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
    transactionQueries.push({
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
    transactionQueries.push({
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
    transactionQueries.push({
      text: `
        SELECT 
          COUNT(*) as total_fixtures,
          COUNT(CASE WHEN result IS NOT NULL THEN 1 END) as fixtures_with_results
        FROM fixture 
        WHERE round_id = $1`,
      params: [round_id]
    });

    // Execute the main transaction
    const results = await transaction(transactionQueries);
    
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

      const noPickResults = await transaction(noPickQueries);
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

    // PHASE 8: INSERT AUDIT LOG
    await query(`
      INSERT INTO audit_log (competition_id, user_id, action, details)
      VALUES ($1, $2, 'Results Calculated', $3)
    `, [
      round.competition_id,
      user_id,
      `Calculated outcomes for Round ${round.round_number}: ${processed + noPickProcessed} picks processed`
    ]);

    // Return success with statistics
    res.json({
      return_code: "SUCCESS",
      message: "Pick outcomes calculated successfully",
      results: {
        winners,
        losers,
        draws,
        processed: processed + noPickProcessed,
        skipped: 0,
        playersEliminated,
        noPickProcessed,
        total: winners + losers + draws + noPickProcessed
      }
    });

  } catch (error) {
    console.error('Calculate results error:', error);
    res.status(500).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;