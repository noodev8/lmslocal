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
    const { competition_id } = req.body;
    const user_id = req.user.id;

    // Basic validation
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.status(400).json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required and must be a number"
      });
    }

    // Get allowed teams for user in this competition
    const result = await query(`
      SELECT at.team_id, t.name, t.short_name
      FROM allowed_teams at
      JOIN team t ON at.team_id = t.id
      WHERE at.competition_id = $1 AND at.user_id = $2
      ORDER BY t.name
    `, [competition_id, user_id]);

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