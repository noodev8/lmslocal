/*
=======================================================================================================================================
Get Current Pick Route - Get player's current pick for a round
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
API Route: /get-current-pick
=======================================================================================================================================
Method: POST
Purpose: Get player's current pick for a specific round
=======================================================================================================================================
Request Payload:
{
  "round_id": 5
}

Success Response:
{
  "return_code": "SUCCESS",
  "pick": {
    "team": "AVL",
    "fixture_id": 15,
    "created_at": "2025-08-28T12:00:00Z"
  }
}

No Pick Response:
{
  "return_code": "SUCCESS",
  "pick": null
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

    // Get current pick for this round
    const result = await query(`
      SELECT p.team, p.fixture_id, p.created_at
      FROM pick p
      WHERE p.round_id = $1 AND p.user_id = $2
    `, [round_id, user_id]);

    const pick = result.rows.length > 0 ? result.rows[0] : null;

    res.json({
      return_code: "SUCCESS",
      pick: pick
    });

  } catch (error) {
    console.error('Get current pick error:', error);
    res.status(500).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;