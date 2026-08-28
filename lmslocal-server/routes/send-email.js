/*
=======================================================================================================================================
API Route: send-email
=======================================================================================================================================
Method: POST
Purpose: Processes pending emails from email_queue table and sends them via Resend service. Updates status to 'sent' or 'failed'.
=======================================================================================================================================
Request Payload:
{
  // Empty body = process all pending emails
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Emails processed successfully",
  "sent_count": 5,                     // integer, number of emails sent successfully
  "failed_count": 1,                   // integer, number of emails that failed
  "suppressed_count": 0,               // integer, held back because the recipient has unsubscribed
                                       //          since the row was queued; marked 'suppressed'
  "expired_count": 0,                  // integer, held back because the email stopped being true
                                       //          before it was drained - a pick reminder whose
                                       //          round has locked; marked 'expired'
  "skipped_stale": 0                   // integer, pending emails older than the freshness floor,
                                       //          left unsent and still visible in email_queue
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"NO_PENDING_EMAILS"
"UNAUTHORIZED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
/*
Machine-invoked. Requires the X-Service-Token header, applied at mount time in server.js.
See middleware/service-auth.js.
*/
const { logApiCall } = require('../utils/apiLogger');
const { sendPickReminderEmail, sendRoundOverEmail, sendWelcomeCompetitionEmail, sendHintEmail, sendJoinBlockedEmail, sendBroadcastEmail, sendCompetitionAnnouncementEmail } = require('../services/emailService');
/*
The hint list itself decides which types this route renders as hints, so adding a hint to
services/hints.js is enough. This route used to name them one by one, and the next hint added
would have fallen through to "Unknown email type" and failed every row it queued.
*/
const { HINT_TYPES } = require('../services/hints');
const { checkExpiry } = require('../services/emailExpiry');
const { formatUkDateTime } = require('../services/dateFormat');
const router = express.Router();

/*
Freshness floor. A queued email older than this is never dispatched - it is left pending and
reported as skipped_stale. Guards against a dormant queue being emptied in one burst.
*/
const MAX_AGE_DAYS = 10;

router.post('/', async (req, res) => {
  logApiCall('send-email');

  try {
    /*
    Fetch pending emails that are due AND still fresh.

    The MAX_AGE_DAYS floor is the important half. Without it a row queued months ago is still
    "due", so a single call can dispatch an entire backlog at once. That is not theoretical:
    on 2 Aug 2026 one call sent 232 welcome emails queued between Oct 2025 and Jul 2026, and
    one player received ten of them in a burst.

    Rows older than the floor are left pending and reported as skipped_stale rather than being
    sent or deleted, so they stay visible in email_queue for inspection. A welcome email a few
    days late is fine; one ten months late is not.
    */
    const pendingEmailsResult = await query(`
      SELECT
        id,
        user_id,
        competition_id,
        round_id,
        email_type,
        template_data,
        attempts
      FROM email_queue
      WHERE status = 'pending'
        AND scheduled_send_at <= NOW()
        AND scheduled_send_at > NOW() - ($1 || ' days')::interval
      ORDER BY scheduled_send_at ASC
    `, [MAX_AGE_DAYS]);

    // Count what the freshness floor held back, so a caller can see the backlog exists
    const staleResult = await query(`
      SELECT COUNT(*) AS stale_count
      FROM email_queue
      WHERE status = 'pending'
        AND scheduled_send_at <= NOW() - ($1 || ' days')::interval
    `, [MAX_AGE_DAYS]);

    const staleCount = parseInt(staleResult.rows[0].stale_count, 10) || 0;

    if (staleCount > 0) {
      console.warn(`send-email: ${staleCount} pending email(s) older than ${MAX_AGE_DAYS} days were skipped as stale`);
    }

    const pendingEmails = pendingEmailsResult.rows;

    // If no pending emails, return early
    if (pendingEmails.length === 0) {
      return res.json({
        return_code: "NO_PENDING_EMAILS",
        message: staleCount > 0
          ? `No emails due to send. ${staleCount} pending email(s) were skipped as older than ${MAX_AGE_DAYS} days.`
          : "No pending emails to send",
        sent_count: 0,
        failed_count: 0,
        suppressed_count: 0,
        expired_count: 0,
        skipped_stale: staleCount
      });
    }

    // Track success and failure counts
    let sentCount = 0;
    let failedCount = 0;
    // Held back because the recipient unsubscribed after the row was queued. Counted separately
    // so a run that suppresses half its batch does not read as a run that failed half of it.
    let suppressedCount = 0;
    // Held back because the email itself went off between queueing and now - see
    // services/emailExpiry.js. Its own count for the same reason as suppressedCount.
    let expiredCount = 0;

    // Process each pending email
    for (const emailRecord of pendingEmails) {
      const queueId = emailRecord.id;
      const templateData = emailRecord.template_data;

      try {
        /*
        Refuse anything that has gone off since it was queued, BEFORE it is marked processing or
        counted as an attempt - nothing was attempted, and the row is finished either way.

        The case this exists for is a pick reminder drained after its round locked. The subject
        names the deadline, so sending it late does not just arrive late, it tells the player
        they still have time to pick when they do not.
        */
        const { expired, deadline } = checkExpiry(emailRecord.email_type, templateData);
        if (expired) {
          await query(`
            UPDATE email_queue
            SET status = 'expired',
                error_message = $1
            WHERE id = $2
          `, [`Deadline passed ${formatUkDateTime(deadline)} before this was sent`, queueId]);

          expiredCount++;
          console.warn(`send-email: ${emailRecord.email_type} queue row ${queueId} expired at ${deadline.toISOString()}`);
          continue;
        }

        // Update status to 'processing' and increment attempts
        await query(`
          UPDATE email_queue
          SET status = 'processing',
              attempts = attempts + 1,
              last_attempt_at = NOW()
          WHERE id = $1
        `, [queueId]);

        // Extract user email from template data
        const userEmail = templateData.user_email;

        // Send email via Resend service - use appropriate function based on email type
        let emailResult;
        if (emailRecord.email_type === 'pick_reminder') {
          emailResult = await sendPickReminderEmail(userEmail, templateData);
        } else if (emailRecord.email_type === 'results') {
          // Round Over, now built to the catalog shape in services/roundOver.js. The old
          // sendResultsEmail template took a different template_data and is no longer reachable
          // from here; there were no pending 'results' rows when this changed, so nothing queued
          // under the old shape can arrive at the new sender.
          emailResult = await sendRoundOverEmail(userEmail, templateData);
        } else if (emailRecord.email_type === 'welcome') {
          emailResult = await sendWelcomeCompetitionEmail(userEmail, templateData);
        } else if (HINT_TYPES.includes(emailRecord.email_type)) {
          // Hints, all rendered by one builder - see services/hints.js, which is also where the
          // list of them lives, so a new hint needs nothing here. There is no pending row under
          // the old sendOrganiserTipEmail shape, so nothing queued can reach the wrong renderer.
          emailResult = await sendHintEmail(userEmail, templateData);
        } else if (emailRecord.email_type === 'join_blocked') {
          emailResult = await sendJoinBlockedEmail(userEmail, templateData);
        } else if (emailRecord.email_type === 'broadcast_admin') {
          // A broadcast queues everyone and sends only up to its cap, so the remainder arrives
          // here on later runs. Without this branch those rows would sit pending until they aged
          // past the freshness floor and were silently dropped.
          emailResult = await sendBroadcastEmail(userEmail, templateData);
        } else if (emailRecord.email_type === 'competition_announcement') {
          emailResult = await sendCompetitionAnnouncementEmail(userEmail, templateData);
        } else {
          throw new Error(`Unknown email type: ${emailRecord.email_type}`);
        }

        /*
        deliver() refused this one because the person has unsubscribed since it was queued. Its
        own status, not 'sent' and not 'failed': 'sent' would record a message id of null against
        an email nobody received, and 'failed' would have this row retried on every run against
        their explicit wish.
        */
        if (emailResult.suppressed) {
          await query(`
            UPDATE email_queue
            SET status = 'suppressed',
                error_message = $1
            WHERE id = $2
          `, [emailResult.error, queueId]);

          suppressedCount++;

        } else if (emailResult.success) {
          // Email sent successfully - update queue status to 'sent'
          await query(`
            UPDATE email_queue
            SET status = 'sent',
                sent_at = NOW()
            WHERE id = $1
          `, [queueId]);

          // Update email tracking with Resend message ID and sent timestamp
          await query(`
            UPDATE email_tracking
            SET resend_message_id = $1,
                sent_at = NOW()
            WHERE email_id = $2
          `, [emailResult.resend_message_id, templateData.email_tracking_id]);

          sentCount++;

        } else {
          // Email failed - update queue status to 'failed' with error message
          await query(`
            UPDATE email_queue
            SET status = 'failed',
                error_message = $1
            WHERE id = $2
          `, [emailResult.error, queueId]);

          failedCount++;
          console.error(`Failed to send email queue ID ${queueId}:`, emailResult.error);
        }

      } catch (error) {
        // Catch any unexpected errors during processing
        console.error(`Error processing email queue ID ${queueId}:`, error);

        // Mark as failed with error details
        await query(`
          UPDATE email_queue
          SET status = 'failed',
              error_message = $1
          WHERE id = $2
        `, [error.message, queueId]);

        failedCount++;
      }
    }

    // Return summary of processing results
    return res.json({
      return_code: "SUCCESS",
      message: `Processed ${pendingEmails.length} emails: ${sentCount} sent, ${failedCount} failed`
        + (suppressedCount > 0 ? `, ${suppressedCount} suppressed (unsubscribed)` : '')
        + (expiredCount > 0 ? `, ${expiredCount} expired (deadline passed)` : '')
        + (staleCount > 0 ? `. ${staleCount} skipped as older than ${MAX_AGE_DAYS} days.` : ''),
      sent_count: sentCount,
      failed_count: failedCount,
      suppressed_count: suppressedCount,
      expired_count: expiredCount,
      skipped_stale: staleCount
    });

  } catch (error) {
    console.error('Error in send-email:', {
      error: error.message,
      stack: error.stack
    });

    return res.json({
      return_code: "SERVER_ERROR",
      message: "Failed to process email queue. Please try again."
    });
  }
});

module.exports = router;
