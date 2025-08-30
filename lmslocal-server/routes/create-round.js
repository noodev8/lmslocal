/*
=======================================================================================================================================
Create Round Route - Create new round for competition
=======================================================================================================================================
Purpose: Create new round for a specific competition
=======================================================================================================================================
*/

const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../database');
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
    const userId = decoded.user_id || decoded.userId; // Handle both formats
    const result = await db.query('SELECT id, email, display_name, email_verified FROM app_user WHERE id = $1', [userId]);
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
API Route: /create-round
=======================================================================================================================================
Method: POST
Purpose: Create a new round for a competition (organiser only)
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,
  "lock_time": "2025-08-25T14:00:00Z"
}

Success Response:
{
  "return_code": "SUCCESS",
  "message": "Round created successfully",
  "round": {
    "id": 1,
    "round_number": 1,
    "lock_time": "2025-08-25T14:00:00Z",
    "status": "LOCKED",
    "created_at": "2025-08-23T10:00:00Z"
  }
}
=======================================================================================================================================
*/
router.post('/', verifyToken, async (req, res) => {
  try {
    const { competition_id, lock_time } = req.body;
    const user_id = req.user.id;

    // Basic validation
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.status(400).json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required and must be a number"
      });
    }

    if (!lock_time) {
      return res.status(400).json({
        return_code: "VALIDATION_ERROR",
        message: "Lock time is required"
      });
    }

    // Verify user is the organiser
    const competitionCheck = await db.query(
      'SELECT organiser_id, name FROM competition WHERE id = $1',
      [competition_id]
    );

    if (competitionCheck.rows.length === 0) {
      return res.status(404).json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition not found"
      });
    }

    if (competitionCheck.rows[0].organiser_id !== user_id) {
      return res.status(403).json({
        return_code: "UNAUTHORIZED",
        message: "Only the competition organiser can create rounds"
      });
    }

    // Get the next round number
    const maxRoundResult = await db.query(
      'SELECT COALESCE(MAX(round_number), 0) as max_round FROM round WHERE competition_id = $1',
      [competition_id]
    );
    const nextRoundNumber = maxRoundResult.rows[0].max_round + 1;

    // Use INSERT with a subquery to prevent race conditions
    const result = await db.query(`
      INSERT INTO round (
        competition_id,
        round_number,
        lock_time,
        created_at
      )
      SELECT $1, $2, $3, CURRENT_TIMESTAMP
      WHERE NOT EXISTS (
        SELECT 1 FROM round 
        WHERE competition_id = $1 AND round_number = $2
      )
      RETURNING *
    `, [competition_id, nextRoundNumber, lock_time]);

    // If no rows returned, round already exists
    if (result.rows.length === 0) {
      // Get the existing round
      const existingResult = await db.query(
        'SELECT * FROM round WHERE competition_id = $1 AND round_number = $2',
        [competition_id, nextRoundNumber]
      );
      
      const existingRound = existingResult.rows[0];
      return res.json({
        return_code: "SUCCESS",
        message: "Round already exists",
        round: {
          id: existingRound.id,
          round_number: existingRound.round_number,
          lock_time: existingRound.lock_time,
          status: existingRound.status,
          created_at: existingRound.created_at
        }
      });
    }

    const round = result.rows[0];

    // Log the creation
    await db.query(`
      INSERT INTO audit_log (competition_id, user_id, action, details)
      VALUES ($1, $2, 'Round Created', $3)
    `, [
      competition_id,
      user_id,
      `Created Round ${nextRoundNumber} for "${competitionCheck.rows[0].name}" with lock time ${lock_time}`
    ]);

    // Auto-reset teams for players who have none left
    try {
      // Get competition's team_list_id
      const compResult = await db.query(`
        SELECT team_list_id FROM competition WHERE id = $1
      `, [competition_id]);
      
      if (compResult.rows.length > 0) {
        const teamListId = compResult.rows[0].team_list_id;
        
        // Find all players in this competition who have zero allowed_teams
        const playersNeedingResetResult = await db.query(`
          SELECT DISTINCT cu.user_id, u.display_name
          FROM competition_user cu
          JOIN app_user u ON cu.user_id = u.id
          WHERE cu.competition_id = $1 
          AND cu.status = 'active'
          AND NOT EXISTS (
            SELECT 1 FROM allowed_teams at 
            WHERE at.competition_id = $1 AND at.user_id = cu.user_id
          )
        `, [competition_id]);

        // Reset teams for each player who needs it
        for (const player of playersNeedingResetResult.rows) {
          // Insert all active teams for this player
          await db.query(`
            INSERT INTO allowed_teams (competition_id, user_id, team_id, created_at)
            SELECT $1, $2, t.id, NOW()
            FROM team t
            WHERE t.team_list_id = $3 AND t.is_active = true
          `, [competition_id, player.user_id, teamListId]);

          // Log the reset
          await db.query(`
            INSERT INTO audit_log (competition_id, user_id, action, details)
            VALUES ($1, $2, 'Teams Auto-Reset', $3)
          `, [
            competition_id, 
            player.user_id, 
            `Teams automatically reset for ${player.display_name} at start of Round ${nextRoundNumber}`
          ]);
        }

        if (playersNeedingResetResult.rows.length > 0) {
          console.log(`Auto-reset teams for ${playersNeedingResetResult.rows.length} players in competition ${competition_id} for Round ${nextRoundNumber}`);
        }
      }
    } catch (resetError) {
      // Don't fail the round creation if team reset fails
      console.error('Team reset error during round creation:', resetError);
    }

    res.json({
      return_code: "SUCCESS",
      message: "Round created successfully",
      round: {
        id: round.id,
        round_number: round.round_number,
        lock_time: round.lock_time,
        status: round.status,
        created_at: round.created_at
      }
    });

  } catch (error) {
    console.error('Create round error:', error);
    res.status(500).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;