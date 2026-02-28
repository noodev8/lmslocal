/*
=======================================================================================================================================
API Route: load-competition-announcement
=======================================================================================================================================
Method: POST
Purpose: Validates users and queues competition announcement emails to email_queue table. Supports dry_run mode to preview
         recipients before queuing. Does NOT send emails - use send-email API for that.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,               // integer, required - Competition to announce
  "dry_run": true                      // boolean, optional - If true, return recipient list without queuing (default: false)
}

Success Response - Dry Run (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Dry run complete - 15 eligible recipients found",
  "dry_run": true,
  "recipient_count": 15,
  "recipients": [
    {
      "user_id": 1,
      "email": "user@example.com",
      "display_name": "John"
    }
  ]
}

Success Response - Queue (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Competition announcement emails queued successfully",
  "queued_count": 15,
  "failed_count": 0,
  "competition_name": "Premier League 2026/27"
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
"NOT_FOUND"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const jwt = require('jsonwebtoken');
const { query } = require('../database');
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();

router.post('/', async (req, res) => {
  logApiCall('load-competition-announcement');

  try {
    const { competition_id, dry_run } = req.body;

    // === INPUT VALIDATION ===

    // Validate competition_id is provided and is a number
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "competition_id is required and must be an integer"
      });
    }

    // === FETCH COMPETITION DETAILS ===
    // Get competition name, access_code, and slug for email template data
    const competitionResult = await query(`
      SELECT
        id,
        name,
        access_code,
        slug
      FROM competition
      WHERE id = $1
    `, [competition_id]);

    // Check competition exists
    if (competitionResult.rows.length === 0) {
      return res.json({
        return_code: "NOT_FOUND",
        message: "Competition not found"
      });
    }

    const competition = competitionResult.rows[0];

    // === FIND ELIGIBLE RECIPIENTS ===
    // Query all users from app_user who:
    // 1. Have a valid email (not null, not empty, not @lms-guest.com)
    // 2. Are NOT already in this competition (NOT EXISTS on competition_user)
    // 3. Have NOT opted out globally (email_preference: competition_id=0, email_type='all', enabled=false)
    // 4. Have NOT opted out of announcements (email_preference: competition_id=0, email_type='competition_announcement', enabled=false)
    const recipientsResult = await query(`
      SELECT
        u.id AS user_id,
        u.email,
        u.display_name
      FROM app_user u

      -- Exclude users already in this competition
      WHERE NOT EXISTS (
        SELECT 1
        FROM competition_user cu
        WHERE cu.user_id = u.id
          AND cu.competition_id = $1
      )

      -- Valid email filter (not null, not empty, not guest)
      AND u.email IS NOT NULL
      AND u.email != ''
      AND u.email NOT LIKE '%@lms-guest.com'

      -- Exclude users who disabled ALL emails globally
      AND NOT EXISTS (
        SELECT 1
        FROM email_preference ep
        WHERE ep.user_id = u.id
          AND ep.competition_id = 0
          AND ep.email_type = 'all'
          AND ep.enabled = false
      )

      -- Exclude users who disabled competition_announcement emails globally
      AND NOT EXISTS (
        SELECT 1
        FROM email_preference ep
        WHERE ep.user_id = u.id
          AND ep.competition_id = 0
          AND ep.email_type = 'competition_announcement'
          AND ep.enabled = false
      )

      ORDER BY u.id
    `, [competition_id]);

    const recipients = recipientsResult.rows;

    // === DRY RUN MODE ===
    // If dry_run is true, return the recipient list without queuing anything
    if (dry_run === true) {
      return res.json({
        return_code: "SUCCESS",
        message: `Dry run complete - ${recipients.length} eligible recipients found`,
        dry_run: true,
        recipient_count: recipients.length,
        competition_name: competition.name,
        recipients: recipients.map(r => ({
          user_id: r.user_id,
          email: r.email,
          display_name: r.display_name
        }))
      });
    }

    // === QUEUE MODE ===
    // If no recipients, return success with zero count
    if (recipients.length === 0) {
      return res.json({
        return_code: "SUCCESS",
        message: "No eligible recipients for this competition announcement",
        queued_count: 0,
        failed_count: 0,
        competition_name: competition.name
      });
    }

    // Queue all recipients to email_queue and email_tracking
    let successCount = 0;
    let failCount = 0;

    for (const recipient of recipients) {
      try {
        // Generate unique tracking ID for this email
        const emailTrackingId = `competition_announcement_${recipient.user_id}_${competition_id}_${Date.now()}`;

        // Generate unsubscribe JWT token (no expiry - permanent unsubscribe link)
        const unsubscribeToken = jwt.sign(
          {
            user_id: recipient.user_id,
            email_type: 'competition_announcement',
            purpose: 'unsubscribe'
          },
          process.env.JWT_SECRET
          // No expiresIn - permanent unsubscribe link
        );

        // Prepare template data that will be used when email is sent
        const templateData = {
          email_tracking_id: emailTrackingId,
          user_email: recipient.email,
          user_display_name: recipient.display_name,
          competition_name: competition.name,
          access_code: competition.access_code,
          competition_slug: competition.slug,
          competition_id: competition_id,
          user_id: recipient.user_id,
          unsubscribe_token: unsubscribeToken
        };

        // Insert email into queue with 'pending' status
        // The send-email API will process this later
        await query(`
          INSERT INTO email_queue (
            user_id,
            competition_id,
            round_id,
            email_type,
            scheduled_send_at,
            template_data,
            status,
            attempts
          ) VALUES (
            $1, $2, NULL, $3, NOW(), $4, 'pending', 0
          )
        `, [
          recipient.user_id,
          competition_id,
          'competition_announcement',
          JSON.stringify(templateData)
        ]);

        // Create initial tracking record (will be updated when email is sent)
        await query(`
          INSERT INTO email_tracking (
            email_id,
            user_id,
            competition_id,
            email_type,
            subject
          ) VALUES (
            $1, $2, $3, $4, $5
          )
        `, [
          emailTrackingId,
          recipient.user_id,
          competition_id,
          'competition_announcement',
          `New Competition: ${competition.name} - LMS Local`
        ]);

        successCount++;

      } catch (error) {
        failCount++;
        console.error(`Failed to queue announcement for user ${recipient.user_id}:`, error.message);
      }
    }

    // Return summary of queuing results
    return res.json({
      return_code: "SUCCESS",
      message: `Competition announcement emails queued successfully`,
      queued_count: successCount,
      failed_count: failCount,
      competition_name: competition.name
    });

  } catch (error) {
    console.error('Error in load-competition-announcement:', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });

    return res.json({
      return_code: "SERVER_ERROR",
      message: "Failed to load competition announcement. Please try again."
    });
  }
});

module.exports = router;
