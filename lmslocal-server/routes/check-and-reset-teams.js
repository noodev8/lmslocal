/*
=======================================================================================================================================
Check and Reset Teams Route - Auto-reset available teams when a player runs out
=======================================================================================================================================
Method: POST
Purpose: Check if a player has no available teams left, and if so, reset their allowed teams
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,                   // number, required
  "user_id": 456                          // number, required
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Teams checked successfully",
  "teams_reset": true,                    // boolean, true if reset was performed
  "available_teams_count": 20             // number of teams now available
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "User-friendly error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"COMPETITION_NOT_FOUND"
"USER_NOT_FOUND"
"SERVER_ERROR"
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
      return res.status(200).json({
        return_code: "UNAUTHORIZED",
        message: "No token provided"
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const userId = decoded.user_id || decoded.userId;
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

router.post('/', verifyToken, async (req, res) => {
  try {
    const { competition_id, user_id } = req.body;

    // Basic validation
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required and must be a number"
      });
    }

    if (!user_id || !Number.isInteger(user_id)) {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "User ID is required and must be a number"
      });
    }

    // Get competition info to get the team_list_id
    const competitionResult = await query(`
      SELECT c.id, c.name, c.team_list_id, c.organiser_id
      FROM competition c
      WHERE c.id = $1
    `, [competition_id]);

    if (competitionResult.rows.length === 0) {
      return res.status(200).json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition not found"
      });
    }

    const competition = competitionResult.rows[0];

    // Verify user is in this competition
    const userInCompResult = await query(`
      SELECT id FROM competition_user 
      WHERE competition_id = $1 AND user_id = $2
    `, [competition_id, user_id]);

    if (userInCompResult.rows.length === 0) {
      return res.status(200).json({
        return_code: "USER_NOT_FOUND",
        message: "User not found in this competition"
      });
    }

    // Check how many teams the user has in allowed_teams
    const availableTeamsResult = await query(`
      SELECT COUNT(*) as available_count
      FROM allowed_teams 
      WHERE competition_id = $1 AND user_id = $2
    `, [competition_id, user_id]);

    const availableCount = parseInt(availableTeamsResult.rows[0].available_count);
    let teamsReset = false;

    // If no teams in allowed_teams, reset by loading all teams
    if (availableCount === 0) {
      await transaction(async (client) => {
        // Delete current allowed_teams for this user and competition
        await client.query(`
          DELETE FROM allowed_teams 
          WHERE competition_id = $1 AND user_id = $2
        `, [competition_id, user_id]);

        // Insert all active teams from the competition's team list
        await client.query(`
          INSERT INTO allowed_teams (competition_id, user_id, team_id, created_at)
          SELECT $1, $2, t.id, NOW()
          FROM team t
          WHERE t.team_list_id = $3 AND t.is_active = true
        `, [competition_id, user_id, competition.team_list_id]);
      });

      teamsReset = true;
    }

    // Get the final count of teams in allowed_teams
    const finalCountResult = await query(`
      SELECT COUNT(*) as final_count
      FROM allowed_teams 
      WHERE competition_id = $1 AND user_id = $2
    `, [competition_id, user_id]);

    const finalAvailableCount = parseInt(finalCountResult.rows[0].final_count);

    // Log the reset action if it occurred
    if (teamsReset) {
      await query(`
        INSERT INTO audit_log (competition_id, user_id, action, details)
        VALUES ($1, $2, 'Teams Auto-Reset', 'Player ran out of available teams - automatically reset to all teams')
      `, [competition_id, user_id]);
    }

    res.status(200).json({
      return_code: "SUCCESS",
      message: teamsReset ? "Teams have been reset - all teams are now available again" : "Teams checked successfully",
      teams_reset: teamsReset,
      available_teams_count: finalAvailableCount
    });

  } catch (error) {
    console.error('Check and reset teams error:', error);
    res.status(200).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;