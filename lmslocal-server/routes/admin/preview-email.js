/*
=======================================================================================================================================
API Route: admin/preview-email
=======================================================================================================================================
Method: POST
Purpose: Show the operator exactly who an email would go to and what it would look like, without
         sending or queuing anything.

The recipient list comes from the same services/pickReminder.findCandidates the send uses, and
the HTML from the same buildPickReminderEmail. Nothing here re-implements either, so a preview
showing three recipients cannot be followed by a send that mails five.

The rendered sample is built for the FIRST candidate. Every recipient gets different fixtures
struck through and a different name, so there is no single "the" email - the preview is a
representative one, and the response says whose it is.
=======================================================================================================================================
Request Payload:
{
  "email_type": "pick_reminder",       // string, required - which outline email
  "competition_id": 210                // integer, required - competition to preview against
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "recipient_count": 3,                // integer, how many would be sent
  "recipients": [                      // array, capped at MAX_LISTED
    {
      "user_id": 862,                  // integer
      "email": "player@example.com",   // string
      "display_name": "Brookfield",    // string
      "round_number": 1                // integer, which round they are being reminded about
    }
  ],
  "truncated": false,                  // boolean, true if more recipients than listed
  "sample": {                          // object or null, null when nobody qualifies
    "for_email": "player@example.com", // string, whose copy this is
    "subject": "...",                  // string
    "html": "<!DOCTYPE html>..."       // string, the real template output
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "VALIDATION_ERROR",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"UNSUPPORTED_EMAIL_TYPE"
"UNAUTHORIZED"
"TOKEN_EXPIRED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const { findCandidates, buildTemplateData } = require('../../services/pickReminder');
const { buildPickReminderEmail } = require('../../services/emailService');
const { logApiCall } = require('../../utils/apiLogger');

const router = express.Router();

// How many addresses come back. Enough to sanity-check a list, short of dumping the user base.
const MAX_LISTED = 50;

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('admin/preview-email');

  try {
    const { email_type, competition_id } = req.body;

    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'competition_id is required and must be an integer'
      });
    }

    if (email_type !== 'pick_reminder') {
      return res.json({
        return_code: 'UNSUPPORTED_EMAIL_TYPE',
        message: `${email_type || 'That email'} is not wired up yet. Only pick_reminder can be previewed.`
      });
    }

    const candidates = await findCandidates({ competition_id });

    // Nobody qualifies. Still a success - the screen shows a count of zero and disables send.
    if (candidates.length === 0) {
      return res.json({
        return_code: 'SUCCESS',
        recipient_count: 0,
        recipients: [],
        truncated: false,
        sample: null
      });
    }

    /*
    Build the sample from real data rather than a fixture. buildTemplateData writes nothing -
    it only reads the round's fixtures and the player's own past picks - so this is safe to run
    on a preview.
    */
    const first = candidates[0];
    const templateData = await buildTemplateData(first);
    const built = buildPickReminderEmail(first.user_email, templateData);

    return res.json({
      return_code: 'SUCCESS',
      recipient_count: candidates.length,
      recipients: candidates.slice(0, MAX_LISTED).map((c) => ({
        user_id: c.user_id,
        email: c.user_email,
        display_name: c.user_display_name,
        round_number: c.round_number
      })),
      truncated: candidates.length > MAX_LISTED,
      sample: {
        for_email: first.user_email,
        subject: built.subject,
        html: built.html
      }
    });

  } catch (error) {
    console.error('admin/preview-email error:', { error: error.message, stack: error.stack });
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not build the preview.'
    });
  }
});

module.exports = router;
