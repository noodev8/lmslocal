/*
=======================================================================================================================================
API Route: update-round
=======================================================================================================================================
Method: POST
Purpose: Updates round lock time and automatically manages competition invite codes based on Round 1 lock status
=======================================================================================================================================
Request Payload:
{
  "round_id": 123,                         // integer, required - ID of the round to update
  "lock_time": "2025-08-25T14:00:00Z"     // string, required - ISO datetime when round locks for picks
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Round updated successfully", // string, confirmation message
  "round": {
    "id": 123,                             // integer, round ID
    "round_number": 1,                     // integer, round number
    "lock_time": "2025-08-25T14:00:00Z",   // string, ISO datetime when round locks
    "created_at": "2025-08-23T10:00:00Z"   // string, ISO datetime when round was created
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"   // string, user-friendly error description
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
const { query, transaction } = require('../database');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  try {
    // Extract request parameters and authenticated user ID
    const { round_id, lock_time } = req.body;
    const user_id = req.user.id;

    // === INPUT VALIDATION ===
    // Validate round_id is provided and is a valid integer
    if (!round_id || !Number.isInteger(round_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Round ID is required and must be a number"
      });
    }

    // Validate lock_time is provided (ISO datetime string expected)
    if (!lock_time) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Lock time is required"
      });
    }

    // === AUTHORIZATION CHECK ===
    // Verify round exists and get competition ownership details
    // This single query gets round info AND checks if user is the organiser
    const roundCheck = await query(`
      SELECT r.id, r.round_number, c.organiser_id, c.name as competition_name, c.id as competition_id
      FROM round r
      JOIN competition c ON r.competition_id = c.id
      WHERE r.id = $1
    `, [round_id]);

    // Check if round exists in database
    if (roundCheck.rows.length === 0) {
      return res.json({
        return_code: "ROUND_NOT_FOUND",
        message: "Round not found"
      });
    }

    // Extract round and competition data for further processing
    const roundData = roundCheck.rows[0];
    
    // Verify authenticated user is the competition organiser (only organisers can update rounds)
    if (roundData.organiser_id !== user_id) {
      return res.json({
        return_code: "UNAUTHORIZED",
        message: "Only the competition organiser can update rounds"
      });
    }

    // === ATOMIC DATABASE OPERATIONS ===
    // Wrap all updates in transaction to ensure data consistency
    const updatedRound = await transaction(async (client) => {
      // Update the round lock_time and return the updated record
      const result = await client.query(`
        UPDATE round 
        SET lock_time = $2
        WHERE id = $1
        RETURNING *
      `, [round_id, lock_time]);

      const round = result.rows[0];

      // === BUSINESS LOGIC: AUTO-CLOSE REGISTRATION ===
      // Special handling for Round 1: If lock time is now in the past (competition has started),
      // automatically remove the invite code to prevent new players from joining mid-competition
      if (roundData.round_number === 1 && new Date(lock_time) <= new Date()) {
        await client.query(`
          UPDATE competition 
          SET invite_code = NULL 
          WHERE id = $1
        `, [roundData.competition_id]);
        
        console.log(`Deleted invite code for competition ${roundData.competition_id} as Round 1 is now locked`);
      }

      // === AUDIT LOGGING ===
      // Record this administrative action for competition audit trail
      await client.query(`
        INSERT INTO audit_log (competition_id, user_id, action, details)
        VALUES ($1, $2, 'Round Updated', $3)
      `, [
        roundData.competition_id,
        user_id,
        `Updated Round ${roundData.round_number} lock time to ${lock_time}`
      ]);

      return round;
    });

    // === SUCCESS RESPONSE ===
    // Return updated round details to frontend for immediate UI updates
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
    // === ERROR HANDLING ===
    // Log detailed error for debugging but return generic message to client for security
    console.error('Update round error:', error);
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;