/*
=======================================================================================================================================
Lock Unlock Competition Route
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
API Route: /lock-unlock-competition
=======================================================================================================================================
Method: POST
Purpose: Change competition status (LOCKED/UNLOCKED) - Admin action for competition management
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,
  "status": "LOCKED"
}

OR

{
  "competition_id": 123,
  "status": "UNLOCKED"
}

Success Response:
{
  "return_code": "SUCCESS",
  "message": "Competition locked successfully",
  "competition": {
    "id": 123,
    "name": "Premier League Survivor",
    "status": "LOCKED"
  }
}
=======================================================================================================================================
*/
router.post('/', verifyToken, async (req, res) => {
  try {
    const { competition_id, status } = req.body;
    const user_id = req.user.id;

    // Basic validation
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.status(400).json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required and must be a number"
      });
    }

    // Validate status
    if (!status || !['UNLOCKED', 'LOCKED'].includes(status)) {
      return res.status(400).json({
        return_code: "VALIDATION_ERROR",
        message: "Status must be either UNLOCKED or LOCKED"
      });
    }

    // Verify user is the organiser
    const competitionCheck = await query(
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
        message: "Only the competition organiser can change competition status"
      });
    }

    // Update competition status
    const result = await query(`
      UPDATE competition 
      SET status = $1 
      WHERE id = $2
      RETURNING *
    `, [status, competition_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition not found"
      });
    }

    const competition = result.rows[0];

    // Log the action
    await query(`
      INSERT INTO audit_log (competition_id, user_id, action, details)
      VALUES ($1, $2, 'Competition Status Changed', $3)
    `, [
      competition_id,
      user_id,
      `Changed competition "${competition.name}" status to ${status}`
    ]);

    res.json({
      return_code: "SUCCESS",
      message: `Competition ${status === 'UNLOCKED' ? 'unlocked' : 'locked'} successfully`,
      competition: {
        id: competition.id,
        name: competition.name,
        status: competition.status
      }
    });

  } catch (error) {
    console.error('Change competition status error:', error);
    res.status(500).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;