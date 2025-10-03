/*
=======================================================================================================================================
API Route: get-email-preferences
=======================================================================================================================================
Method: POST
Purpose: Retrieve user's email notification preferences (global and per-competition settings)
=======================================================================================================================================
Request Payload:
{
  "competition_id": 91                 // integer, optional - if provided, returns preferences for this competition
}

Success Response:
{
  "return_code": "SUCCESS",
  "preferences": {
    "global": {
      "all_emails": true,              // boolean, master switch for all emails
      "pick_reminder": true,           // boolean, pick reminder emails across all competitions
      "welcome": true,                 // boolean, welcome emails
      "results": true                  // boolean, results emails
    },
    "competition_specific": [          // array, competition-level overrides (if competition_id provided)
      {
        "competition_id": 91,
        "competition_name": "Crown Pub LMS",
        "all_emails": true,            // boolean, mute entire competition
        "pick_reminder": true,
        "results": true
      }
    ]
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
  logApiCall('get-email-preferences');

  try {
    // Extract authenticated user ID from JWT token
    const user_id = req.user.id;
    const { competition_id } = req.body;

    // === GET GLOBAL PREFERENCES ===
    // Query all global preferences (competition_id = 0) for this user
    const globalPrefsResult = await query(`
      SELECT
        email_type,
        enabled
      FROM email_preference
      WHERE user_id = $1
        AND competition_id = 0
      ORDER BY email_type
    `, [user_id]);

    // Build global preferences object with defaults (opt-out model = all true by default)
    const globalPrefs = {
      all_emails: true,
      pick_reminder: true,
      welcome: true,
      results: true
    };

    // Override with any saved preferences
    globalPrefsResult.rows.forEach(pref => {
      if (pref.email_type === 'all') {
        globalPrefs.all_emails = pref.enabled;
      } else if (pref.email_type) {
        globalPrefs[pref.email_type] = pref.enabled;
      }
    });

    // === GET COMPETITION-SPECIFIC PREFERENCES (if requested) ===
    let competitionSpecific = [];

    if (competition_id && Number.isInteger(competition_id)) {
      // Get competition details and preferences for this specific competition
      const compPrefsResult = await query(`
        SELECT
          c.id as competition_id,
          c.name as competition_name,
          cu.personal_name,
          ep.email_type,
          ep.enabled
        FROM competition c
        INNER JOIN competition_user cu
          ON cu.competition_id = c.id
          AND cu.user_id = $1
        LEFT JOIN email_preference ep
          ON ep.competition_id = c.id
          AND ep.user_id = $1
        WHERE c.id = $2
      `, [user_id, competition_id]);

      // If user is member of this competition, build preferences
      if (compPrefsResult.rows.length > 0) {
        const firstRow = compPrefsResult.rows[0];

        const compPref = {
          competition_id: firstRow.competition_id,
          competition_name: firstRow.competition_name,
          personal_name: firstRow.personal_name,
          all_emails: true,      // Default to enabled
          pick_reminder: true,
          results: true
        };

        // Override with any saved preferences
        compPrefsResult.rows.forEach(row => {
          if (row.email_type === null) {
            // NULL email_type means "mute entire competition"
            compPref.all_emails = row.enabled;
          } else if (row.email_type) {
            compPref[row.email_type] = row.enabled;
          }
        });

        competitionSpecific.push(compPref);
      }
    } else {
      // No specific competition requested - get preferences for ALL user's competitions
      const allCompsResult = await query(`
        SELECT
          c.id as competition_id,
          c.name as competition_name,
          cu.personal_name,
          ep.email_type,
          ep.enabled
        FROM competition c
        INNER JOIN competition_user cu
          ON cu.competition_id = c.id
        LEFT JOIN email_preference ep
          ON ep.competition_id = c.id
          AND ep.user_id = cu.user_id
        WHERE cu.user_id = $1
        ORDER BY COALESCE(cu.personal_name, c.name), ep.email_type
      `, [user_id]);

      // Group by competition
      const compMap = new Map();

      allCompsResult.rows.forEach(row => {
        if (!compMap.has(row.competition_id)) {
          compMap.set(row.competition_id, {
            competition_id: row.competition_id,
            competition_name: row.competition_name,
            personal_name: row.personal_name,
            all_emails: true,      // Default enabled
            pick_reminder: true,
            results: true
          });
        }

        const compPref = compMap.get(row.competition_id);

        if (row.email_type === null && row.enabled !== null) {
          // NULL email_type with enabled value = "mute entire competition"
          compPref.all_emails = row.enabled;
        } else if (row.email_type && row.enabled !== null) {
          compPref[row.email_type] = row.enabled;
        }
      });

      competitionSpecific = Array.from(compMap.values());
    }

    // === SUCCESS RESPONSE ===
    return res.json({
      return_code: "SUCCESS",
      preferences: {
        global: globalPrefs,
        competition_specific: competitionSpecific
      }
    });

  } catch (error) {
    // Log error details for debugging
    console.error('Error in get-email-preferences:', {
      error: error.message,
      stack: error.stack,
      user_id: req.user?.id
    });

    // Return generic server error to client
    return res.json({
      return_code: "SERVER_ERROR",
      message: "Failed to retrieve email preferences. Please try again."
    });
  }
});

module.exports = router;
