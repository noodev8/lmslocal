/*
=======================================================================================================================================
API Route: admin/get-email-targets
=======================================================================================================================================
Method: POST
Purpose: Recipient counts for each email on the outline, for one competition. Drives the counts
         column on the admin Emails screen.

Only pick_reminder is wired so far. Every other row returns a null count rather than a zero:
"we cannot work this out yet" and "nobody qualifies" mean very different things to whoever is
about to press send, and showing 0 for both would be a lie about the second.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 210                // integer, required - competition to count against
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "counts": {
    "pick_reminder": 3,                // integer or null, null = not wired up yet
    "welcome": null
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "VALIDATION_ERROR",
  "message": "competition_id is required"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"UNAUTHORIZED"
"TOKEN_EXPIRED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const { findCandidates } = require('../../services/pickReminder');
const { logApiCall } = require('../../utils/apiLogger');

const router = express.Router();

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('admin/get-email-targets');

  try {
    const { competition_id } = req.body;

    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'competition_id is required and must be an integer'
      });
    }

    const pickReminderCandidates = await findCandidates({ competition_id });

    return res.json({
      return_code: 'SUCCESS',
      counts: {
        pick_reminder: pickReminderCandidates.length
      }
    });

  } catch (error) {
    console.error('admin/get-email-targets error:', { error: error.message, stack: error.stack });
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not work out email recipients.'
    });
  }
});

module.exports = router;
