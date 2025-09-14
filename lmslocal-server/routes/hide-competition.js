/*
=======================================================================================================================================
API Route: hide-competition
=======================================================================================================================================
Method: POST
Purpose: Hide a competition for a specific user by setting the hidden flag to true in competition_user table
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123                     // integer, required - Competition ID to hide for this user
}

Success Response:
{
  "return_code": "SUCCESS",
  "message": "Competition hidden successfully"  // string, confirmation message
}

Error Response:
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"        // string, user-friendly error description
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"
"INVALID_COMPETITION_ID"
"NOT_MEMBER"
"ALREADY_HIDDEN"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  // Log API call for monitoring
  logApiCall('hide-competition');

  try {
    // Extract authenticated user ID from JWT token
    const user_id = req.user.id;

    // Extract request payload
    const { competition_id } = req.body;

    // === VALIDATION ===
    // Check if competition_id is provided
    if (!competition_id) {
      return res.status(200).json({
        return_code: "MISSING_FIELDS",
        message: "competition_id is required"
      });
    }

    // Validate competition_id is a valid integer
    if (!Number.isInteger(competition_id) || competition_id <= 0) {
      return res.status(200).json({
        return_code: "INVALID_COMPETITION_ID",
        message: "competition_id must be a valid positive integer"
      });
    }

    // === CHECK USER MEMBERSHIP ===
    // Verify user is actually a member of this competition
    const membershipQuery = `
      SELECT
        id,
        status,
        hidden,
        competition_id
      FROM competition_user
      WHERE competition_id = $1 AND user_id = $2
    `;

    const membershipResult = await query(membershipQuery, [competition_id, user_id]);

    // User is not a member of this competition
    if (membershipResult.rows.length === 0) {
      return res.status(200).json({
        return_code: "NOT_MEMBER",
        message: "You are not a member of this competition"
      });
    }

    const membership = membershipResult.rows[0];

    // Check if competition is already hidden for this user
    if (membership.hidden === true) {
      return res.status(200).json({
        return_code: "ALREADY_HIDDEN",
        message: "Competition is already hidden for you"
      });
    }

    // === UPDATE HIDDEN FLAG ===
    // Set hidden flag to true for this user in this competition
    const hideQuery = `
      UPDATE competition_user
      SET hidden = true
      WHERE competition_id = $1 AND user_id = $2
      RETURNING id, hidden
    `;

    const hideResult = await query(hideQuery, [competition_id, user_id]);

    // Verify update was successful
    if (hideResult.rows.length === 0) {
      return res.status(200).json({
        return_code: "SERVER_ERROR",
        message: "Failed to hide competition - update returned no rows"
      });
    }

    // === SUCCESS RESPONSE ===
    return res.status(200).json({
      return_code: "SUCCESS",
      message: "Competition hidden successfully"
    });

  } catch (error) {
    // Log error for debugging
    console.error('Hide competition error:', error);

    // Return generic server error
    return res.status(200).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error occurred while hiding competition"
    });
  }
});

module.exports = router;