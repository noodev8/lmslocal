/*
=======================================================================================================================================
API Route: update-email-preferences
=======================================================================================================================================
Method: POST
Purpose: Update user's email notification preferences (global or per-competition)
=======================================================================================================================================
Request Payload:
{
  "competition_id": 0,                 // integer, required - 0 = global, specific ID = competition override
  "email_type": "pick_reminder",       // string, required - "all", "pick_reminder", "welcome", "results", or null for competition mute
  "enabled": false                     // boolean, required - true = send emails, false = don't send
}

Success Response:
{
  "return_code": "SUCCESS",
  "message": "Email preference updated successfully",
  "preference": {
    "competition_id": 0,
    "email_type": "pick_reminder",
    "enabled": false
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
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  logApiCall('update-email-preferences');

  try {
    // Extract authenticated user ID from JWT token
    const user_id = req.user.id;
    const { competition_id, email_type, enabled } = req.body;

    // === INPUT VALIDATION ===

    // Validate competition_id is provided and is a valid integer
    if (competition_id === undefined || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "competition_id is required and must be a number (0 for global)"
      });
    }

    // Validate email_type is provided (can be null for "mute competition")
    // Valid values: "all", "pick_reminder", "welcome", "results", null
    const validEmailTypes = ['all', 'pick_reminder', 'welcome', 'results', null];
    if (email_type !== null && !validEmailTypes.includes(email_type)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "email_type must be 'all', 'pick_reminder', 'welcome', 'results', or null"
      });
    }

    // Validate enabled is a boolean
    if (typeof enabled !== 'boolean') {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "enabled must be a boolean (true or false)"
      });
    }

    // === BUSINESS LOGIC VALIDATION ===

    // If competition_id is specific (not 0), verify user is member of that competition
    if (competition_id !== 0) {
      const membershipCheck = await query(`
        SELECT id
        FROM competition_user
        WHERE competition_id = $1
          AND user_id = $2
      `, [competition_id, user_id]);

      if (membershipCheck.rows.length === 0) {
        return res.json({
          return_code: "VALIDATION_ERROR",
          message: "You are not a member of this competition"
        });
      }
    }

    // === UPSERT PREFERENCE ===
    // Check if preference already exists
    const existingPref = await query(`
      SELECT id
      FROM email_preference
      WHERE user_id = $1
        AND competition_id = $2
        AND (email_type = $3 OR (email_type IS NULL AND $3 IS NULL))
    `, [user_id, competition_id, email_type]);

    let result;
    if (existingPref.rows.length > 0) {
      // Update existing preference
      result = await query(`
        UPDATE email_preference
        SET enabled = $1,
            updated_at = NOW()
        WHERE user_id = $2
          AND competition_id = $3
          AND (email_type = $4 OR (email_type IS NULL AND $4 IS NULL))
        RETURNING id, user_id, competition_id, email_type, enabled
      `, [enabled, user_id, competition_id, email_type]);
    } else {
      // Insert new preference
      result = await query(`
        INSERT INTO email_preference (
          user_id,
          competition_id,
          email_type,
          enabled,
          updated_at
        ) VALUES (
          $1,  -- user_id
          $2,  -- competition_id (0 for global, specific ID for competition)
          $3,  -- email_type ("all", "pick_reminder", etc., or NULL for mute competition)
          $4,  -- enabled (true/false)
          NOW()
        )
        RETURNING id, user_id, competition_id, email_type, enabled
      `, [user_id, competition_id, email_type, enabled]);
    }

    const savedPref = result.rows[0];

    // === HANDLE CASCADING LOGIC ===
    // If user disables "all emails" globally (competition_id=0, email_type='all', enabled=false),
    // we could optionally delete all other preferences, but for now we'll keep them
    // The email sending logic will check "all" first before checking specific types

    // === SUCCESS RESPONSE ===
    return res.json({
      return_code: "SUCCESS",
      message: "Email preference updated successfully",
      preference: {
        competition_id: savedPref.competition_id,
        email_type: savedPref.email_type,
        enabled: savedPref.enabled
      }
    });

  } catch (error) {
    // Log error details for debugging
    console.error('Error in update-email-preferences:', {
      error: error.message,
      stack: error.stack,
      user_id: req.user?.id,
      body: req.body
    });

    // Return generic server error to client
    return res.json({
      return_code: "SERVER_ERROR",
      message: "Failed to update email preference. Please try again."
    });
  }
});

module.exports = router;
