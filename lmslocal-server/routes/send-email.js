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
  "failed_count": 1                    // integer, number of emails that failed
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
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const { sendPickReminderEmail, sendResultsEmail } = require('../services/emailService');
const router = express.Router();

router.post('/', async (req, res) => {
  logApiCall('send-email');

  try {
    // Fetch all pending emails from the queue
    // Status 'pending' means the email has been queued but not yet sent
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
      ORDER BY scheduled_send_at ASC
    `);

    const pendingEmails = pendingEmailsResult.rows;

    // If no pending emails, return early
    if (pendingEmails.length === 0) {
      return res.json({
        return_code: "NO_PENDING_EMAILS",
        message: "No pending emails to send",
        sent_count: 0,
        failed_count: 0
      });
    }

    // Track success and failure counts
    let sentCount = 0;
    let failedCount = 0;

    // Process each pending email
    for (const emailRecord of pendingEmails) {
      const queueId = emailRecord.id;
      const templateData = emailRecord.template_data;

      try {
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
          emailResult = await sendResultsEmail(userEmail, templateData);
        } else {
          throw new Error(`Unknown email type: ${emailRecord.email_type}`);
        }

        if (emailResult.success) {
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
      message: `Processed ${pendingEmails.length} emails: ${sentCount} sent, ${failedCount} failed`,
      sent_count: sentCount,
      failed_count: failedCount
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
