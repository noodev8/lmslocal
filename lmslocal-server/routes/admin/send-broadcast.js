/*
=======================================================================================================================================
API Route: admin/send-broadcast
=======================================================================================================================================
Method: POST
Purpose: Send an operator-written message to every subscribed account, or to one competition's
         members.

Separate from admin/send-emails on purpose. That route sends an outline email whose words and
recipients both come from the data, which is what makes a single button safe. This one carries a
sentence somebody typed and can reach every account on the platform, so it has its own guards and
does not share a code path with the reminders.

  test_mode true  - builds ONE copy for the first recipient and sends it to the test address.
                    Nothing queued, nothing recorded. This is the default when the field is absent.
  test_mode false - queues EVERY recipient, then sends up to SEND_CAP of them.

QUEUE EVERYONE, SEND SOME. Resend allows 100 sends a day and the platform has over 200 accounts,
so "send to all" cannot complete in one press however it is written. Sending the first 80 and
failing the rest would leave no record of who missed out; queuing all of them first means the
pending rows ARE that record, and /send-email drains them on subsequent days. The response says
plainly how many are still waiting.

confirm_count must equal the number the audience route reported. It is not ceremony: the audience
can change between opening the screen and pressing send - somebody joins, somebody unsubscribes -
and this is the one email where sending to a larger group than the operator was looking at is a
real harm. A mismatch is refused with both numbers.
=======================================================================================================================================
Request Payload:
{
  "audience": "all",                   // string, required - "all" or "competition"
  "competition_id": 210,               // integer, required when audience is "competition"
  "subject": "Scheduled maintenance",  // string, required
  "message": "We will be down...",     // string, required
  "test_mode": true,                   // boolean, optional - defaults to true
  "confirm_count": 187                 // integer, required for a live send - what the operator saw
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "test_mode": false,
  "recipient_count": 187,              // integer, who qualified
  "queued_count": 187,                 // integer, rows written
  "sent_count": 80,                    // integer, accepted by Resend in this press
  "failed_count": 0,
  "pending_count": 107,                // integer, queued and still waiting for a later run
  "sent_to": null,                     // string in test mode only
  "message": "..."
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "COUNT_CHANGED",
  "message": "The audience is now 189, not 187. Check and try again."
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"NO_RECIPIENTS"
"VALIDATION_ERROR"
"COUNT_CHANGED"
"UNAUTHORIZED"
"TOKEN_EXPIRED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../../database');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const { findRecipients, queueRecipient, AUDIENCES, SEND_CAP } = require('../../services/broadcast');
const { sendBroadcastEmail } = require('../../services/emailService');
const { logApiCall } = require('../../utils/apiLogger');

const router = express.Router();

const MAX_SUBJECT = 200;

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('admin/send-broadcast');

  try {
    const { audience, competition_id, subject, message, test_mode, confirm_count } = req.body;

    if (audience !== AUDIENCES.ALL && audience !== AUDIENCES.COMPETITION) {
      return res.json({ return_code: 'VALIDATION_ERROR', message: 'audience must be "all" or "competition"' });
    }

    if (audience === AUDIENCES.COMPETITION && !Number.isInteger(competition_id)) {
      return res.json({ return_code: 'VALIDATION_ERROR', message: 'competition_id is required for a competition broadcast' });
    }

    const cleanSubject = typeof subject === 'string' ? subject.trim() : '';
    const cleanMessage = typeof message === 'string' ? message.trim() : '';

    if (!cleanSubject || !cleanMessage) {
      return res.json({ return_code: 'VALIDATION_ERROR', message: 'A subject and a message are both required' });
    }

    if (cleanSubject.length > MAX_SUBJECT) {
      return res.json({ return_code: 'VALIDATION_ERROR', message: `Subject must be ${MAX_SUBJECT} characters or fewer` });
    }

    // Absent means test. Only an explicit false goes live.
    const testMode = test_mode !== false;
    const scopedCompetition = audience === AUDIENCES.COMPETITION ? competition_id : null;

    const recipients = await findRecipients({ audience, competition_id: scopedCompetition });

    if (recipients.length === 0) {
      return res.json({
        return_code: 'NO_RECIPIENTS',
        message: 'Nobody would receive this — everyone in that audience has unsubscribed, or there is nobody in it.',
        recipient_count: 0,
        sent_count: 0,
        failed_count: 0,
        test_mode: testMode
      });
    }

    const content = { subject: cleanSubject, message: cleanMessage };

    // ===============================================================================
    // TEST MODE - one copy, to the test address, nothing written
    // ===============================================================================
    if (testMode) {
      const first = recipients[0];
      const { buildTemplateData } = require('../../services/broadcast');
      const templateData = await buildTemplateData(first, content, scopedCompetition);

      const result = await sendBroadcastEmail(first.user_email, templateData, { testMode: true });

      if (!result.success) {
        return res.json({
          return_code: 'SUCCESS',
          test_mode: true,
          recipient_count: recipients.length,
          queued_count: 0,
          sent_count: 0,
          failed_count: 1,
          pending_count: 0,
          sent_to: null,
          message: `Test send failed: ${result.error}`
        });
      }

      return res.json({
        return_code: 'SUCCESS',
        test_mode: true,
        recipient_count: recipients.length,
        queued_count: 0,
        sent_count: 1,
        failed_count: 0,
        pending_count: 0,
        sent_to: process.env.EMAIL_TEST_RECIPIENT || 'aandreou25@gmail.com',
        message: `Test copy sent. ${recipients.length} real recipient${recipients.length === 1 ? '' : 's'} untouched.`
      });
    }

    /*
    Live from here. The count the operator confirmed must still be the count we have - see the
    header. Checked after findRecipients rather than before, so the numbers compared are both real.
    */
    if (!Number.isInteger(confirm_count)) {
      return res.json({ return_code: 'VALIDATION_ERROR', message: 'confirm_count is required for a live send' });
    }

    if (confirm_count !== recipients.length) {
      return res.json({
        return_code: 'COUNT_CHANGED',
        message: `The audience is now ${recipients.length}, not ${confirm_count}. Check and try again.`,
        recipient_count: recipients.length
      });
    }

    // ===============================================================================
    // LIVE - queue everyone first, then send what the daily cap allows
    // ===============================================================================
    let queuedCount = 0;
    let sentCount = 0;
    let failedCount = 0;

    const queued = [];

    for (const recipient of recipients) {
      const row = await queueRecipient(recipient, content, scopedCompetition);
      if (row.success) {
        queuedCount++;
        queued.push({ recipient, row });
      } else {
        failedCount++;
      }
    }

    for (const { recipient, row } of queued.slice(0, SEND_CAP)) {
      const result = await sendBroadcastEmail(recipient.user_email, row.template_data, { testMode: false });

      if (result.success) {
        await query(`UPDATE email_queue SET status = 'sent', sent_at = NOW() WHERE id = $1`, [row.queue_id]);
        await query(
          `UPDATE email_tracking SET resend_message_id = $1, sent_at = NOW() WHERE email_id = $2`,
          [result.resend_message_id, row.template_data.email_tracking_id]
        );
        sentCount++;
      } else if (result.suppressed) {
        /*
        Should not happen - findRecipients already excluded opt-outs - but deliver() checks again
        at send time and somebody can unsubscribe in between. Recorded as its own status rather
        than a failure, same as the queue drain does.
        */
        await query(
          `UPDATE email_queue SET status = 'suppressed', error_message = $1 WHERE id = $2`,
          [result.error, row.queue_id]
        );
      } else {
        await query(
          `UPDATE email_queue SET status = 'failed', error_message = $1, attempts = attempts + 1, last_attempt_at = NOW() WHERE id = $2`,
          [result.error, row.queue_id]
        );
        failedCount++;
        console.error('admin/send-broadcast: send failed for user', recipient.user_id, result.error);
      }
    }

    const pendingCount = Math.max(queuedCount - sentCount - failedCount, 0);

    return res.json({
      return_code: 'SUCCESS',
      test_mode: false,
      recipient_count: recipients.length,
      queued_count: queuedCount,
      sent_count: sentCount,
      failed_count: failedCount,
      pending_count: pendingCount,
      sent_to: null,
      message: `Sent ${sentCount} now${pendingCount > 0 ? `, ${pendingCount} queued for later runs` : ''}${failedCount > 0 ? `, ${failedCount} failed` : ''}.`
    });

  } catch (error) {
    console.error('admin/send-broadcast error:', { error: error.message, stack: error.stack });
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Broadcast failed. Check the server log.'
    });
  }
});

module.exports = router;
