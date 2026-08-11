/*
=======================================================================================================================================
API Route: admin/send-emails
=======================================================================================================================================
Method: POST
Purpose: Send one outline email to everyone who qualifies for it in one competition, from the
         admin Emails screen. Operator-driven - there is no schedule behind this.

Two modes, and they are deliberately not the same code path:

  test_mode true  - builds ONE email for the first candidate and sends it to the test address.
                    Nothing is queued and nothing is recorded against a player.
  test_mode false - queues every candidate, then sends each one, updating email_queue and
                    email_tracking as it goes.

Test mode must not queue. Candidacy excludes anyone with a row already in email_queue for that
round, so a test run that queued would make every one of those players permanently ineligible
for the real send that follows - the operator would test, see it work, press send for real and
reach nobody.

test_mode defaults to TRUE when the field is absent. A caller that forgets it gets the harmless
outcome rather than a live send to the whole competition.
=======================================================================================================================================
Request Payload:
{
  "email_type": "pick_reminder",       // string, required - which outline email
  "competition_id": 210,               // integer, required
  "test_mode": true                    // boolean, optional - defaults to true
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "test_mode": true,                   // boolean, what actually happened
  "sent_count": 1,                     // integer, emails accepted by Resend
  "failed_count": 0,                   // integer, sends that came back with an error
  "candidate_count": 3,                // integer, who qualified
  "sent_to": "aandreou25@gmail.com",   // string or null, set in test mode only
  "message": "..."                     // string, plain summary for the screen
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "NO_RECIPIENTS",
  "message": "Nobody currently qualifies for this email."
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"NO_RECIPIENTS"
"VALIDATION_ERROR"
"UNSUPPORTED_EMAIL_TYPE"
"UNAUTHORIZED"
"TOKEN_EXPIRED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../../database');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const { findCandidates, buildTemplateData, queueCandidate } = require('../../services/pickReminder');
const { sendPickReminderEmail } = require('../../services/emailService');
const { logApiCall } = require('../../utils/apiLogger');

const router = express.Router();

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('admin/send-emails');

  try {
    const { email_type, competition_id, test_mode } = req.body;

    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'competition_id is required and must be an integer'
      });
    }

    if (email_type !== 'pick_reminder') {
      return res.json({
        return_code: 'UNSUPPORTED_EMAIL_TYPE',
        message: `${email_type || 'That email'} is not wired up yet. Only pick_reminder can be sent.`
      });
    }

    // Absent means test. Only an explicit false goes live.
    const testMode = test_mode !== false;

    const candidates = await findCandidates({ competition_id });

    if (candidates.length === 0) {
      return res.json({
        return_code: 'NO_RECIPIENTS',
        message: 'Nobody currently qualifies for this email.',
        candidate_count: 0,
        sent_count: 0,
        failed_count: 0,
        test_mode: testMode
      });
    }

    // ===============================================================================
    // TEST MODE - one email, to the test address, nothing written
    // ===============================================================================
    if (testMode) {
      const first = candidates[0];
      const templateData = await buildTemplateData(first);

      const result = await sendPickReminderEmail(first.user_email, templateData, { testMode: true });

      if (!result.success) {
        console.error('admin/send-emails test send failed:', result.error);
        return res.json({
          return_code: 'SUCCESS',
          test_mode: true,
          candidate_count: candidates.length,
          sent_count: 0,
          failed_count: 1,
          sent_to: null,
          message: `Test send failed: ${result.error}`
        });
      }

      return res.json({
        return_code: 'SUCCESS',
        test_mode: true,
        candidate_count: candidates.length,
        sent_count: 1,
        failed_count: 0,
        sent_to: process.env.EMAIL_TEST_RECIPIENT || 'aandreou25@gmail.com',
        message: `Test copy of ${first.user_display_name}'s email sent. ${candidates.length} real recipient${candidates.length === 1 ? '' : 's'} untouched.`
      });
    }

    // ===============================================================================
    // LIVE MODE - queue everyone, then send
    // ===============================================================================
    let sentCount = 0;
    let failedCount = 0;

    for (const candidate of candidates) {
      const queued = await queueCandidate(candidate);

      if (!queued.success) {
        failedCount++;
        continue;
      }

      const result = await sendPickReminderEmail(
        candidate.user_email,
        queued.template_data,
        { testMode: false }
      );

      if (result.success) {
        await query(
          `UPDATE email_queue SET status = 'sent', sent_at = NOW() WHERE id = $1`,
          [queued.queue_id]
        );
        await query(
          `UPDATE email_tracking SET resend_message_id = $1, sent_at = NOW() WHERE email_id = $2`,
          [result.resend_message_id, queued.template_data.email_tracking_id]
        );
        sentCount++;
      } else {
        /*
        Left as 'failed' rather than deleted. The queue row is the only record that we tried,
        and the ALREADY_QUEUED guard reads it - so a failed address is not silently retried on
        the next press without someone looking at why it failed.
        */
        await query(
          `UPDATE email_queue SET status = 'failed', error_message = $1, attempts = attempts + 1, last_attempt_at = NOW() WHERE id = $2`,
          [result.error, queued.queue_id]
        );
        failedCount++;
        console.error(`admin/send-emails: send failed for user ${candidate.user_id}:`, result.error);
      }
    }

    return res.json({
      return_code: 'SUCCESS',
      test_mode: false,
      candidate_count: candidates.length,
      sent_count: sentCount,
      failed_count: failedCount,
      sent_to: null,
      message: `Sent ${sentCount} of ${candidates.length}${failedCount > 0 ? `, ${failedCount} failed` : ''}.`
    });

  } catch (error) {
    console.error('admin/send-emails error:', { error: error.message, stack: error.stack });
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Send failed. Check the server log.'
    });
  }
});

module.exports = router;
