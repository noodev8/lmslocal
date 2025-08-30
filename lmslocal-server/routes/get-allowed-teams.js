/*
=======================================================================================================================================
Get Allowed Teams Route - Get teams player is allowed to pick
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
    const userId = decoded.user_id || decoded.userId; // Handle both formats
    const result = await query('SELECT id, email, display_name, email_verified FROM app_user WHERE id = $1', [userId]);
    
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
API Route: /get-allowed-teams
=======================================================================================================================================
Method: POST
Purpose: Get teams that user is allowed to pick in a competition
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123
}

Success Response:
{
  "return_code": "SUCCESS",
  "allowed_teams": [
    {
      "team_id": 1,
      "name": "Arsenal",
      "short_name": "ARS"
    }
  ]
}
=======================================================================================================================================
*/
router.post('/', verifyToken, async (req, res) => {
  try {
    const { competition_id, user_id: requested_user_id } = req.body;
    const authenticated_user_id = req.user.id;
    
    // Use requested user_id if provided (admin feature), otherwise use authenticated user
    const target_user_id = requested_user_id || authenticated_user_id;

    // Basic validation
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.status(400).json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required and must be a number"
      });
    }

    // If requesting for another user, verify admin permissions
    if (requested_user_id && requested_user_id !== authenticated_user_id) {
      // Check if authenticated user is the competition organiser
      const competitionCheck = await query(`
        SELECT organiser_id FROM competition WHERE id = $1
      `, [competition_id]);

      if (competitionCheck.rows.length === 0) {
        return res.status(400).json({
          return_code: "VALIDATION_ERROR",
          message: "Competition not found"
        });
      }

      if (competitionCheck.rows[0].organiser_id !== authenticated_user_id) {
        return res.status(403).json({
          return_code: "UNAUTHORIZED",
          message: "Only competition organiser can view other players' allowed teams"
        });
      }
    }

    // Get current round to check for fixtures
    const currentRoundResult = await query(`
      SELECT r.id, r.round_number
      FROM round r
      WHERE r.competition_id = $1
      ORDER BY r.round_number DESC
      LIMIT 1
    `, [competition_id]);

    if (currentRoundResult.rows.length === 0) {
      return res.json({
        return_code: "SUCCESS",
        allowed_teams: []
      });
    }

    const currentRound = currentRoundResult.rows[0];

    // Get allowed teams for user that also have fixtures in the current round
    const result = await query(`
      SELECT DISTINCT at.team_id, t.name, t.short_name
      FROM allowed_teams at
      JOIN team t ON at.team_id = t.id
      JOIN fixture f ON (f.home_team = t.name OR f.away_team = t.name)
      WHERE at.competition_id = $1 
        AND at.user_id = $2
        AND f.round_id = $3
      ORDER BY t.name
    `, [competition_id, target_user_id, currentRound.id]);

    res.json({
      return_code: "SUCCESS",
      allowed_teams: result.rows
    });

  } catch (error) {
    console.error('Get allowed teams error:', error);
    res.status(500).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;