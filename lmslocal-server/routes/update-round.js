/*
=======================================================================================================================================
Update Round Route
=======================================================================================================================================
Method: POST
Purpose: Update round lock time and other properties (organiser only)
=======================================================================================================================================
Request Payload:
{
  "round_id": 123,                    // number, required
  "lock_time": "2025-08-25T14:00:00Z" // string, required
}

Success Response:
{
  "return_code": "SUCCESS",
  "message": "Round updated successfully",
  "round": {
    "id": 123,
    "round_number": 1,
    "lock_time": "2025-08-25T14:00:00Z",
    "created_at": "2025-08-23T10:00:00Z"
  }
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"UNAUTHORIZED"
"ROUND_NOT_FOUND"
"SERVER_ERROR"
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

router.post('/', verifyToken, async (req, res) => {
  try {
    const { round_id, lock_time } = req.body;
    const user_id = req.user.id;

    // Basic validation
    if (!round_id || !Number.isInteger(round_id)) {
      return res.status(400).json({
        return_code: "VALIDATION_ERROR",
        message: "Round ID is required and must be a number"
      });
    }

    if (!lock_time) {
      return res.status(400).json({
        return_code: "VALIDATION_ERROR",
        message: "Lock time is required"
      });
    }

    // Verify round exists and user is the organiser
    const roundCheck = await db.query(`
      SELECT r.id, r.round_number, c.organiser_id, c.name as competition_name, c.id as competition_id
      FROM round r
      JOIN competition c ON r.competition_id = c.id
      WHERE r.id = $1
    `, [round_id]);

    if (roundCheck.rows.length === 0) {
      return res.status(404).json({
        return_code: "ROUND_NOT_FOUND",
        message: "Round not found"
      });
    }

    const roundData = roundCheck.rows[0];
    if (roundData.organiser_id !== user_id) {
      return res.status(403).json({
        return_code: "UNAUTHORIZED",
        message: "Only the competition organiser can update rounds"
      });
    }

    // Update the round
    const result = await db.query(`
      UPDATE round 
      SET lock_time = $2
      WHERE id = $1
      RETURNING *
    `, [round_id, lock_time]);

    const updatedRound = result.rows[0];

    // If this is Round 1 and the lock time is in the past (locked now), delete the invite code
    if (roundData.round_number === 1 && new Date(lock_time) <= new Date()) {
      await db.query(`
        UPDATE competition 
        SET invite_code = NULL 
        WHERE id = $1
      `, [roundData.competition_id]);
      
      console.log(`Deleted invite code for competition ${roundData.competition_id} as Round 1 is now locked`);
    }

    // Log the update
    await db.query(`
      INSERT INTO audit_log (competition_id, user_id, action, details)
      VALUES ($1, $2, 'Round Updated', $3)
    `, [
      roundData.competition_id,
      user_id,
      `Updated Round ${roundData.round_number} lock time to ${lock_time}`
    ]);

    res.json({
      return_code: "SUCCESS",
      message: "Round updated successfully",
      round: {
        id: updatedRound.id,
        round_number: updatedRound.round_number,
        lock_time: updatedRound.lock_time,
        created_at: updatedRound.created_at
      }
    });

  } catch (error) {
    console.error('Update round error:', error);
    res.status(500).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;