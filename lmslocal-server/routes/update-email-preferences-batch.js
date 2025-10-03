/*
=======================================================================================================================================
API Route: update-email-preferences-batch
=======================================================================================================================================
Method: POST
Purpose: Update multiple email preferences in a single request (batch operation)
=======================================================================================================================================
Request Payload:
{
  "preferences": [                         // array, required - list of preferences to update
    {
      "competition_id": 0,                 // integer, required - 0 = global, specific ID = competition
      "email_type": "pick_reminder",       // string, required - "all", "pick_reminder", "results", or null
      "enabled": false                     // boolean, required - true = send emails, false = don't send
    },
    {
      "competition_id": 91,
      "email_type": null,
      "enabled": true
    }
  ]
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Email preferences updated successfully",
  "updated_count": 5                       // integer, number of preferences updated
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
const { query, transaction } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  logApiCall('update-email-preferences-batch');

  try {
    // Extract authenticated user ID from JWT token
    const user_id = req.user.id;
    const { preferences } = req.body;

    // === INPUT VALIDATION ===

    // Validate preferences array is provided
    if (!Array.isArray(preferences) || preferences.length === 0) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "preferences must be a non-empty array"
      });
    }

    // Validate each preference object
    const validEmailTypes = ['all', 'pick_reminder', 'welcome', 'results', null];

    for (let i = 0; i < preferences.length; i++) {
      const pref = preferences[i];

      if (!pref || typeof pref !== 'object') {
        return res.json({
          return_code: "VALIDATION_ERROR",
          message: `preferences[${i}] must be an object`
        });
      }

      if (pref.competition_id === undefined || !Number.isInteger(pref.competition_id)) {
        return res.json({
          return_code: "VALIDATION_ERROR",
          message: `preferences[${i}].competition_id is required and must be a number`
        });
      }

      if (pref.email_type !== null && !validEmailTypes.includes(pref.email_type)) {
        return res.json({
          return_code: "VALIDATION_ERROR",
          message: `preferences[${i}].email_type must be 'all', 'pick_reminder', 'welcome', 'results', or null`
        });
      }

      if (typeof pref.enabled !== 'boolean') {
        return res.json({
          return_code: "VALIDATION_ERROR",
          message: `preferences[${i}].enabled must be a boolean`
        });
      }
    }

    // === BATCH UPDATE IN TRANSACTION ===
    const result = await transaction(async (client) => {
      let updatedCount = 0;

      for (const pref of preferences) {
        const { competition_id, email_type, enabled } = pref;

        // Verify user is member of competition if not global (competition_id !== 0)
        if (competition_id !== 0) {
          const membershipCheck = await client.query(`
            SELECT id
            FROM competition_user
            WHERE competition_id = $1
              AND user_id = $2
          `, [competition_id, user_id]);

          if (membershipCheck.rows.length === 0) {
            // Skip non-member competitions instead of failing entire batch
            continue;
          }
        }

        // Check if preference already exists
        const existingPref = await client.query(`
          SELECT id
          FROM email_preference
          WHERE user_id = $1
            AND competition_id = $2
            AND (email_type = $3 OR (email_type IS NULL AND $3 IS NULL))
        `, [user_id, competition_id, email_type]);

        if (existingPref.rows.length > 0) {
          // Update existing preference
          await client.query(`
            UPDATE email_preference
            SET enabled = $1,
                updated_at = NOW()
            WHERE user_id = $2
              AND competition_id = $3
              AND (email_type = $4 OR (email_type IS NULL AND $4 IS NULL))
          `, [enabled, user_id, competition_id, email_type]);
        } else {
          // Insert new preference
          await client.query(`
            INSERT INTO email_preference (
              user_id,
              competition_id,
              email_type,
              enabled,
              updated_at
            ) VALUES (
              $1, $2, $3, $4, NOW()
            )
          `, [user_id, competition_id, email_type, enabled]);
        }

        updatedCount++;
      }

      return updatedCount;
    });

    // === SUCCESS RESPONSE ===
    return res.json({
      return_code: "SUCCESS",
      message: "Email preferences updated successfully",
      updated_count: result
    });

  } catch (error) {
    // Log error details for debugging
    console.error('Error in update-email-preferences-batch:', {
      error: error.message,
      stack: error.stack,
      user_id: req.user?.id,
      body: req.body
    });

    // Return generic server error to client
    return res.json({
      return_code: "SERVER_ERROR",
      message: "Failed to update email preferences. Please try again."
    });
  }
});

module.exports = router;
