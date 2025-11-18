/*
=======================================================================================================================================
API Route: update-player-display-name
=======================================================================================================================================
Method: POST
Purpose: Updates user's display name for a specific competition (how they appear as a player in that competition)
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,                    // integer, required - ID of competition to update
  "player_display_name": "JS"               // string, optional - Player display name (null/empty to use global display_name)
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Player display name updated successfully",
  "player_display_name": "JS"               // string or null, updated player display name
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
"COMPETITION_NOT_FOUND"
"UNAUTHORIZED"
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
  logApiCall('update-player-display-name');

  try {
    const { competition_id, player_display_name } = req.body;
    const user_id = req.user.id;

    // === STEP 1: VALIDATE REQUEST ===
    // Validate required competition_id parameter
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required and must be a valid integer"
      });
    }

    // Validate player_display_name if provided (allow null/empty to use global display_name)
    if (player_display_name !== undefined && player_display_name !== null && player_display_name !== '') {
      if (typeof player_display_name !== 'string') {
        return res.json({
          return_code: "VALIDATION_ERROR",
          message: "Player display name must be a string"
        });
      }

      const trimmedName = player_display_name.trim();

      // Check length constraints (2-50 characters to match global display_name rules)
      if (trimmedName.length < 2) {
        return res.json({
          return_code: "VALIDATION_ERROR",
          message: "Player display name must be at least 2 characters long"
        });
      }

      if (trimmedName.length > 50) {
        return res.json({
          return_code: "VALIDATION_ERROR",
          message: "Player display name must be no more than 50 characters long"
        });
      }

      // Check for inappropriate characters or patterns (same as global display_name)
      const displayNamePattern = /^[a-zA-Z0-9\s\-_.']+$/;
      if (!displayNamePattern.test(trimmedName)) {
        return res.json({
          return_code: "VALIDATION_ERROR",
          message: "Player display name contains invalid characters. Only letters, numbers, spaces, hyphens, underscores, apostrophes, and periods are allowed"
        });
      }
    }

    // === STEP 2: VERIFY USER IS PARTICIPANT IN THIS COMPETITION ===
    // Check if user is a participant in this competition
    const accessCheck = await query(
      `SELECT id
       FROM competition_user
       WHERE competition_id = $1 AND user_id = $2`,
      [competition_id, user_id]
    );

    // User must be a participant to update their display name
    if (accessCheck.rows.length === 0) {
      return res.json({
        return_code: "UNAUTHORIZED",
        message: "You are not a participant in this competition"
      });
    }

    // === STEP 3: UPDATE PLAYER DISPLAY NAME ===
    // Prepare the player_display_name value (null for empty strings = use global display_name)
    const nameValue = (player_display_name && player_display_name.trim()) ? player_display_name.trim() : null;

    // Update the player_display_name in competition_user table
    const updateResult = await query(
      `UPDATE competition_user
       SET player_display_name = $1
       WHERE competition_id = $2 AND user_id = $3
       RETURNING player_display_name`,
      [nameValue, competition_id, user_id]
    );

    // Verify update was successful
    if (updateResult.rows.length === 0) {
      return res.json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition participation not found"
      });
    }

    // === STEP 4: RETURN SUCCESS RESPONSE ===
    res.json({
      return_code: "SUCCESS",
      message: "Player display name updated successfully",
      player_display_name: updateResult.rows[0].player_display_name
    });

  } catch (error) {
    // Log detailed error for debugging
    console.error('Update player display name error:', error);

    // Return generic error response
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;
