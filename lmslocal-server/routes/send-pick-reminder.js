/*
=======================================================================================================================================
API Route: send-pick-reminder
=======================================================================================================================================
Method: POST
Purpose: Sends a pick reminder email to a specific user for a specific round. Queues the email in email_queue table for processing.
=======================================================================================================================================
Request Payload:
{
  "user_id": 123,                      // integer, required - User who will receive the reminder
  "round_id": 45,                      // integer, required - Round to remind about
  "competition_id": 12                 // integer, required - Competition context
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Pick reminder queued successfully",  // string, confirmation message
  "queue_id": 789,                                 // integer, email_queue record ID
  "scheduled_send_at": "2025-10-05T14:00:00Z"     // string, ISO datetime when email will send
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"           // string, user-friendly error description
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"PICK_ALREADY_MADE"     // User has already made their pick for this round
"ROUND_LOCKED"          // Round is already locked, too late to remind
"COMPETITION_NOT_FOUND"
"ROUND_NOT_FOUND"
"USER_NOT_IN_COMPETITION"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const { sendPickReminderEmail } = require('../services/emailService');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  logApiCall('send-pick-reminder');

  try {
    // Extract request parameters
    const { user_id, round_id, competition_id } = req.body;

    // === INPUT VALIDATION ===
    // Validate all required fields are provided and are valid integers
    if (!user_id || !Number.isInteger(user_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "User ID is required and must be a number"
      });
    }

    if (!round_id || !Number.isInteger(round_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Round ID is required and must be a number"
      });
    }

    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required and must be a number"
      });
    }

    // === COMPREHENSIVE DATA COLLECTION QUERY ===
    // Single optimized query to gather all data needed for the email:
    // 1. Validate competition, round, and user membership
    // 2. Get competition and round details for email content
    // 3. Get user email and display name
    // 4. Check if user has already picked (skip reminder if picked)
    // 5. Get all fixtures for this round
    // 6. Get teams user has already used in previous rounds
    // 7. Get organizer name for email personalization
    const dataResult = await query(`
      SELECT
        -- === COMPETITION & ROUND INFO ===
        c.id as competition_id,
        c.name as competition_name,
        c.organiser_id,
        r.id as round_id,
        r.round_number,
        r.lock_time,

        -- === USER INFO ===
        u.id as user_id,
        u.email as user_email,
        u.display_name as user_display_name,

        -- === ORGANIZER INFO ===
        org.display_name as organizer_name,

        -- === MEMBERSHIP & PICK STATUS ===
        cu.id as membership_id,
        cu.status as player_status,
        (
          SELECT COUNT(*)
          FROM pick p
          WHERE p.round_id = r.id
            AND p.user_id = u.id
        ) as has_picked,

        -- === TEAMS ALREADY USED (for email content) ===
        -- Using a subquery to get teams used in previous rounds
        (
          SELECT COALESCE(json_agg(team ORDER BY team), '[]'::json)
          FROM (
            SELECT DISTINCT p.team
            FROM pick p
            INNER JOIN round prev_r ON prev_r.id = p.round_id
            WHERE p.user_id = u.id
              AND prev_r.competition_id = c.id
              AND prev_r.round_number < r.round_number
          ) AS distinct_teams
        ) as teams_used

      FROM competition c

      -- Join to validate round exists and belongs to competition
      INNER JOIN round r
        ON r.id = $2
        AND r.competition_id = c.id

      -- Join to validate user exists
      INNER JOIN app_user u
        ON u.id = $1

      -- Join to validate user is member of competition
      INNER JOIN competition_user cu
        ON cu.competition_id = c.id
        AND cu.user_id = u.id

      -- Get organizer details for email personalization
      LEFT JOIN app_user org
        ON org.id = c.organiser_id

      WHERE c.id = $3

      GROUP BY
        c.id, c.name, c.organiser_id,
        r.id, r.round_number, r.lock_time,
        u.id, u.email, u.display_name,
        org.display_name,
        cu.id, cu.status
    `, [user_id, round_id, competition_id]);

    // Check if competition/round/user combination exists
    if (dataResult.rows.length === 0) {
      return res.json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition, round, or user membership not found"
      });
    }

    const data = dataResult.rows[0];

    // === BUSINESS LOGIC VALIDATION ===

    // Check if user is not in competition
    if (!data.membership_id) {
      return res.json({
        return_code: "USER_NOT_IN_COMPETITION",
        message: "User is not a member of this competition"
      });
    }

    // Check if user has already made their pick (no need to remind)
    if (data.has_picked > 0) {
      return res.json({
        return_code: "PICK_ALREADY_MADE",
        message: "User has already made their pick for this round"
      });
    }

    // Check if round is already locked (too late to remind)
    if (data.lock_time && new Date(data.lock_time) < new Date()) {
      return res.json({
        return_code: "ROUND_LOCKED",
        message: "Round is already locked, too late to send reminder"
      });
    }

    // === GET FIXTURES FOR THIS ROUND ===
    // Separate query to get all fixtures (not included in main query for clarity)
    const fixturesResult = await query(`
      SELECT
        id,
        home_team,
        away_team,
        home_team_short,
        away_team_short,
        kickoff_time
      FROM fixture
      WHERE round_id = $1
      ORDER BY kickoff_time ASC
    `, [round_id]);

    // Convert fixtures to array for email template
    const fixtures = fixturesResult.rows.map(f => ({
      id: f.id,
      home_team: f.home_team,
      away_team: f.away_team,
      home_team_short: f.home_team_short,
      away_team_short: f.away_team_short,
      kickoff_time: f.kickoff_time
    }));

    // === GENERATE UNIQUE EMAIL TRACKING ID ===
    // This ID will be embedded in email links and headers for tracking
    // Format: pick_reminder_{user_id}_{competition_id}_{round_id}_{timestamp}
    // Example: pick_reminder_123_45_7_1696512000000
    const emailTrackingId = `pick_reminder_${user_id}_${competition_id}_${round_id}_${Date.now()}`;

    // === PREPARE EMAIL TEMPLATE DATA ===
    // Capture all data needed to render email at queue time
    // This preserves state even if data changes before email sends
    const templateData = {
      email_tracking_id: emailTrackingId,
      user_display_name: data.user_display_name,
      competition_name: data.competition_name,
      organizer_name: data.organizer_name || 'Competition Organizer',
      round_number: data.round_number,
      lock_time: data.lock_time,
      fixtures: fixtures,
      teams_used: data.teams_used || [],
      competition_id: competition_id,
      round_id: round_id,
      user_id: user_id
    };

    // === QUEUE EMAIL FOR SENDING ===
    // Email will be processed by cron job (queue processor)
    // scheduled_send_at is NOW because this is manual trigger
    // In future, cron scheduler will set scheduled_send_at based on lock_time
    const queueResult = await query(`
      INSERT INTO email_queue (
        user_id,
        competition_id,
        email_type,
        scheduled_send_at,
        template_data,
        status,
        attempts
      ) VALUES (
        $1,     -- user_id
        $2,     -- competition_id
        $3,     -- email_type: 'pick_reminder'
        NOW(),  -- scheduled_send_at: send immediately for manual trigger
        $4,     -- template_data: JSON object with all email content
        $5,     -- status: 'pending'
        0       -- attempts: initial value
      )
      RETURNING id, scheduled_send_at
    `, [
      user_id,
      competition_id,
      'pick_reminder',
      JSON.stringify(templateData),
      'pending'
    ]);

    const queueRecord = queueResult.rows[0];

    // === CREATE TRACKING RECORD ===
    // Pre-create tracking record for this email
    await query(`
      INSERT INTO email_tracking (
        email_id,
        user_id,
        competition_id,
        email_type,
        subject
      ) VALUES (
        $1,  -- email_id: our tracking UUID
        $2,  -- user_id
        $3,  -- competition_id
        $4,  -- email_type
        $5   -- subject: preview for tracking
      )
    `, [
      emailTrackingId,
      user_id,
      competition_id,
      'pick_reminder',
      `${data.organizer_name} (${data.competition_name}): Pick reminder for Round ${data.round_number}`
    ]);

    // === SEND EMAIL IMMEDIATELY ===
    // For manual trigger, send the email right away
    // Update queue status to 'processing' first
    await query(`
      UPDATE email_queue
      SET status = 'processing',
          attempts = attempts + 1,
          last_attempt_at = NOW()
      WHERE id = $1
    `, [queueRecord.id]);

    // Send the email via Resend
    const emailResult = await sendPickReminderEmail(data.user_email, templateData);

    // Update queue and tracking based on send result
    if (emailResult.success) {
      // Email sent successfully - update queue status to 'sent'
      await query(`
        UPDATE email_queue
        SET status = 'sent',
            sent_at = NOW()
        WHERE id = $1
      `, [queueRecord.id]);

      // Update tracking record with Resend message ID
      await query(`
        UPDATE email_tracking
        SET resend_message_id = $1,
            sent_at = NOW()
        WHERE email_id = $2
      `, [emailResult.resend_message_id, emailTrackingId]);

      // === SUCCESS RESPONSE ===
      return res.json({
        return_code: "SUCCESS",
        message: "Pick reminder sent successfully",
        queue_id: queueRecord.id,
        email_sent: true,
        resend_message_id: emailResult.resend_message_id
      });

    } else {
      // Email failed to send - mark as failed
      await query(`
        UPDATE email_queue
        SET status = 'failed',
            error_message = $1
        WHERE id = $2
      `, [emailResult.error, queueRecord.id]);

      // Return error response
      return res.json({
        return_code: "EMAIL_SEND_FAILED",
        message: "Failed to send email: " + emailResult.error,
        queue_id: queueRecord.id,
        email_sent: false
      });
    }

  } catch (error) {
    // Log error details for debugging
    console.error('Error in send-pick-reminder:', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });

    // Return generic server error to client
    return res.json({
      return_code: "SERVER_ERROR",
      message: "Failed to queue pick reminder. Please try again."
    });
  }
});

module.exports = router;
