/*
=======================================================================================================================================
Remove Player Route - Completely remove player from competition (organiser only)
=======================================================================================================================================
Purpose: Remove player and all their associated data (picks, progress, allowed teams)
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
      return res.status(200).json({
        return_code: "UNAUTHORIZED",
        message: "No token provided"
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const userId = decoded.user_id || decoded.userId; // Handle both formats
    const result = await query('SELECT id, email, display_name, email_verified FROM app_user WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(200).json({
        return_code: "UNAUTHORIZED",
        message: "Invalid token"
      });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    return res.status(200).json({
      return_code: "UNAUTHORIZED",
      message: "Invalid token"
    });
  }
};

/*
=======================================================================================================================================
API Route: /remove-player
=======================================================================================================================================
Method: POST
Purpose: Completely remove player from competition (organiser only)
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,        // number, required
  "player_id": 456             // number, required
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Player removed successfully",
  "removed_data": {
    "picks_deleted": 5,
    "allowed_teams_deleted": 20
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"UNAUTHORIZED" 
"COMPETITION_NOT_FOUND"
"PLAYER_NOT_FOUND"
"SERVER_ERROR"
=======================================================================================================================================
*/
router.post('/', verifyToken, async (req, res) => {
  try {
    const { competition_id, player_id } = req.body;
    const user_id = req.user.id;

    // Basic validation
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required and must be a number"
      });
    }

    if (!player_id || !Number.isInteger(player_id)) {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "Player ID is required and must be a number"
      });
    }

    // Verify user is the organiser
    const competitionCheck = await query(
      'SELECT id, name, organiser_id FROM competition WHERE id = $1',
      [competition_id]
    );

    if (competitionCheck.rows.length === 0) {
      return res.status(200).json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition not found"
      });
    }

    const competition = competitionCheck.rows[0];
    if (competition.organiser_id !== user_id) {
      return res.status(200).json({
        return_code: "UNAUTHORIZED",
        message: "Only the competition organiser can remove players"
      });
    }

    // Verify player exists in this competition
    const playerCheck = await query(
      'SELECT u.display_name FROM competition_user cu JOIN app_user u ON cu.user_id = u.id WHERE cu.competition_id = $1 AND cu.user_id = $2',
      [competition_id, player_id]
    );

    if (playerCheck.rows.length === 0) {
      return res.status(200).json({
        return_code: "PLAYER_NOT_FOUND",
        message: "Player not found in this competition"
      });
    }

    const playerName = playerCheck.rows[0].display_name;

    // Start transaction for complete removal
    await query('BEGIN');

    try {
      // 1. Delete picks (for all rounds in this competition)
      const picksResult = await query(`
        DELETE FROM pick 
        WHERE user_id = $1 AND round_id IN (
          SELECT id FROM round WHERE competition_id = $2
        )
      `, [player_id, competition_id]);

      // 2. Delete allowed teams
      const allowedTeamsResult = await query(
        'DELETE FROM allowed_teams WHERE user_id = $1 AND competition_id = $2',
        [player_id, competition_id]
      );

      // 3. Delete player progress records
      const progressResult = await query(
        'DELETE FROM player_progress WHERE player_id = $1 AND competition_id = $2',
        [player_id, competition_id]
      );

      // 4. Finally, remove from competition_user
      const competitionUserResult = await query(
        'DELETE FROM competition_user WHERE user_id = $1 AND competition_id = $2',
        [player_id, competition_id]
      );

      // Commit transaction
      await query('COMMIT');

      // Log the removal
      await query(`
        INSERT INTO audit_log (competition_id, user_id, action, details)
        VALUES ($1, $2, 'Player Removed', $3)
      `, [
        competition_id,
        user_id,
        `Removed player "${playerName}" and all associated data (picks: ${picksResult.rowCount}, allowed_teams: ${allowedTeamsResult.rowCount}, progress: ${progressResult.rowCount})`
      ]);

      res.status(200).json({
        return_code: "SUCCESS",
        message: "Player removed successfully",
        removed_data: {
          picks_deleted: picksResult.rowCount || 0,
          allowed_teams_deleted: allowedTeamsResult.rowCount || 0,
          progress_deleted: progressResult.rowCount || 0
        }
      });

    } catch (error) {
      // Rollback transaction on any error
      await query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Remove player error:', error);
    res.status(200).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;