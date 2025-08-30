/*
=======================================================================================================================================
Calculate Results Route
=======================================================================================================================================
*/

const express = require('express');
const jwt = require('jsonwebtoken');
const { query } = require('../database');
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
    
    // Get user from database
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

/*
=======================================================================================================================================
API Route: /calculate-results
=======================================================================================================================================
Method: POST
Purpose: Calculate pick outcomes based on fixture results for a round
=======================================================================================================================================
Request Payload:
{
  "round_id": 1
}

Success Response:
{
  "return_code": "SUCCESS",
  "message": "Pick outcomes calculated successfully",
  "results": {
    "winners": 5,
    "losers": 3,
    "draws": 2,
    "processed": 10,
    "skipped": 0
  }
}
=======================================================================================================================================
*/
router.post('/', verifyToken, async (req, res) => {
  try {
    const { round_id } = req.body;
    const user_id = req.user.id;

    // Basic validation
    if (!round_id || !Number.isInteger(round_id)) {
      return res.status(400).json({
        return_code: "VALIDATION_ERROR",
        message: "Round ID is required and must be a number"
      });
    }

    // Get round details and verify user is organiser
    const roundResult = await query(`
      SELECT r.id, r.round_number, r.competition_id, r.no_pick_processed, c.organiser_id, c.name as competition_name
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


    // Get all fixtures that have results but haven't been processed yet
    const unprocessedFixtures = await query(`
      SELECT id, result, home_team_short, away_team_short
      FROM fixture 
      WHERE round_id = $1 
        AND result IS NOT NULL 
        AND processed IS NULL
    `, [round_id]);


    let winners = 0;
    let losers = 0;
    let draws = 0;
    let processed = 0;
    let skipped = 0;
    let playersEliminated = 0;

    // Process each unprocessed fixture
    for (const fixture of unprocessedFixtures.rows) {
      // Get all picks for this fixture
      const picksForFixture = await query(`
        SELECT p.id as pick_id, p.team, p.user_id, p.outcome,
               COALESCE(u.display_name, 'Unknown User') as display_name
        FROM pick p
        LEFT JOIN app_user u ON p.user_id = u.id
        WHERE p.fixture_id = $1
      `, [fixture.id]);

      // Process each pick for this fixture
      for (const pick of picksForFixture.rows) {
        let outcome = null;

        if (fixture.result === 'DRAW') {
          outcome = 'LOSE';
          draws++;
          losers++;
        } else if (pick.team === fixture.result) {
          outcome = 'WIN';
          winners++;
        } else {
          outcome = 'LOSE';
          losers++;
        }

        // Update the pick with the calculated outcome
        await query(`
          UPDATE pick 
          SET outcome = $1
          WHERE id = $2
        `, [outcome, pick.pick_id]);
        
        processed++;

        // Reduce lives for LOSE outcomes only
        if (outcome === 'LOSE') {
          const livesResult = await query(`
            SELECT lives_remaining, status
            FROM competition_user
            WHERE competition_id = $1 AND user_id = $2
          `, [round.competition_id, pick.user_id]);

          if (livesResult.rows.length > 0) {
            const currentLives = livesResult.rows[0].lives_remaining;
            const newLives = currentLives - 1;

            if (newLives < 0) {
              await query(`
                UPDATE competition_user
                SET lives_remaining = 0, status = 'OUT'
                WHERE competition_id = $1 AND user_id = $2
              `, [round.competition_id, pick.user_id]);
              playersEliminated++;
            } else {
              await query(`
                UPDATE competition_user
                SET lives_remaining = $1
                WHERE competition_id = $2 AND user_id = $3
              `, [newLives, round.competition_id, pick.user_id]);
            }
          }
        }
      }

      // Mark fixture as processed
      await query(`
        UPDATE fixture 
        SET processed = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [fixture.id]);
    }

    // NO_PICK PROCESSING - Only when ALL fixtures in round have results
    // MAJOR CHECK: Do we have results for ALL fixtures in this round?
    const allFixturesCheck = await query(`
      SELECT 
        COUNT(*) as total_fixtures,
        COUNT(CASE WHEN result IS NOT NULL THEN 1 END) as fixtures_with_results
      FROM fixture 
      WHERE round_id = $1
    `, [round_id]);

    const totalFixtures = parseInt(allFixturesCheck.rows[0].total_fixtures);
    const fixturesWithResults = parseInt(allFixturesCheck.rows[0].fixtures_with_results);
    
    // Only process NO_PICK if ALL fixtures have results AND no_pick_processed is false
    if (totalFixtures > 0 && totalFixtures === fixturesWithResults && !round.no_pick_processed) {
        
      // Find players who didn't make picks
      const noPickPlayers = await query(`
        SELECT cu.user_id, cu.lives_remaining, cu.status
        FROM competition_user cu
        WHERE cu.competition_id = $1 
          AND cu.status != 'OUT'
          AND cu.user_id NOT IN (
            SELECT p.user_id FROM pick p WHERE p.round_id = $2
          )
      `, [round.competition_id, round_id]);

      // Handle no-pick players - lose life
      for (const player of noPickPlayers.rows) {
        // Create NO_PICK record
        await query(`
          INSERT INTO pick (round_id, user_id, outcome)
          VALUES ($1, $2, 'NO_PICK')
        `, [round_id, player.user_id]);
        
        // Also create player_progress record for NO_PICK
        await query(`
          INSERT INTO player_progress (player_id, competition_id, round_id, fixture_id, chosen_team, outcome)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          player.user_id,
          round.competition_id,
          round_id,
          null, // No fixture_id for no-pick
          null, // No chosen_team for no-pick
          'NO_PICK'
        ]);
        
        // Reduce life for not making a pick
        const newLives = player.lives_remaining - 1;
        
        if (newLives < 0) {
          await query(`
            UPDATE competition_user
            SET lives_remaining = 0, status = 'OUT'
            WHERE competition_id = $1 AND user_id = $2
          `, [round.competition_id, player.user_id]);
          playersEliminated++;
        } else {
          await query(`
            UPDATE competition_user
            SET lives_remaining = $1
            WHERE competition_id = $2 AND user_id = $3
          `, [newLives, round.competition_id, player.user_id]);
        }
        
        processed++;
        losers++; // Count no-pick as a loss (life penalty)
      }

      // Always mark NO_PICK processing as completed for this round (even if no NO_PICK players found)
      await query(`
        UPDATE round 
        SET no_pick_processed = true 
        WHERE id = $1
      `, [round_id]);
    }


    // Now populate player_progress table for all players
    const allCompetitionPlayersResult = await query(`
      SELECT cu.user_id, p.fixture_id, p.team, p.outcome
      FROM competition_user cu
      LEFT JOIN pick p ON p.user_id = cu.user_id AND p.round_id = $1
      WHERE cu.competition_id = $2
    `, [round_id, round.competition_id]);

    // Insert player progress records - but only for players who actually made picks (not NO_PICK)
    for (const player of allCompetitionPlayersResult.rows) {
      // Only insert records for players who have actual picks (not null outcome and not NO_PICK)
      if (player.outcome && player.outcome !== null && player.outcome !== 'NO_PICK') {
        await query(`
          INSERT INTO player_progress (player_id, competition_id, round_id, fixture_id, chosen_team, outcome)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          player.user_id,
          round.competition_id, 
          round_id,
          player.fixture_id,
          player.team,
          player.outcome
        ]);
      }
    }

    // Log the calculation
    await query(`
      INSERT INTO audit_log (competition_id, user_id, action, details)
      VALUES ($1, $2, 'Results Calculated', $3)
    `, [
      round.competition_id,
      user_id,
      `Calculated outcomes for Round ${round.round_number}: ${processed} picks processed`
    ]);

    res.json({
      return_code: "SUCCESS",
      message: "Pick outcomes calculated successfully",
      results: {
        winners,
        losers,
        draws,
        processed,
        skipped,
        playersEliminated,
        total: winners + losers + draws
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