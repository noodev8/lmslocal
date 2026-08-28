/*
=======================================================================================================================================
API Route: load-pick-reminder
=======================================================================================================================================
Method: POST
Purpose: Validates users and queues pick reminder emails to email_queue table. Does NOT send emails - use send-email API for that.
=======================================================================================================================================
Request Payload (Batch Mode - Cron):
{
  // Empty body = scan all users and queue reminders for those who need them
}

Request Payload (Single User Mode - With Validation):
{
  "user_id": 123,                      // integer, required - User to queue reminder for
  "round_id": 45,                      // integer, required - Round to remind about
  "competition_id": 12,                // integer, required - Competition context
  "validate": true                     // boolean, optional - Run validation checks (default: false)
}

Request Payload (Single User Mode - Force Queue):
{
  "user_id": 123,                      // integer, required
  "round_id": 45,                      // integer, required
  "competition_id": 12,                // integer, required
  "validate": false                    // boolean, skip validation and force queue
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Pick reminders queued successfully",
  "queued_count": 5                    // integer, number of emails queued
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
"PICK_ALREADY_MADE"
"ROUND_LOCKED"
"COMPETITION_COMPLETE"
"NO_FIXTURES"
"USER_ELIMINATED"
"EMAIL_DISABLED"
"ALREADY_QUEUED"
"UNAUTHORIZED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
/*
Machine-invoked. Requires the X-Service-Token header, applied at mount time in server.js.
This matters here: the handler takes user_id, round_id and competition_id straight from the
request body, so without that gate anyone could queue email to arbitrary users.
See middleware/service-auth.js.
*/
const { findCandidates, buildTemplateData, subjectFor } = require('../services/pickReminder');
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();

// === INTERNAL HELPER FUNCTION: QUEUE EMAIL ===
// This function prepares template data and queues email to database (does NOT send)
//
// The template data itself is built by services/pickReminder.js, which is also what the admin
// screen's preview and send use. Keeping the shape in one place means a change to what a pick
// reminder contains cannot land in one path and not the other.
async function queueEmailInternal(params) {
  const {
    user_id,
    round_id,
    competition_id,
    competition_name
  } = params;

  try {
    const templateData = await buildTemplateData(params);
    const emailTrackingId = templateData.email_tracking_id;

    // Insert email into queue with 'pending' status
    // The send-email API will process this later
    const queueResult = await query(`
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
        $1, $2, $3, $4, NOW(), $5, 'pending', 0
      )
      RETURNING id
    `, [
      user_id,
      competition_id,
      round_id,
      'pick_reminder',
      JSON.stringify(templateData)
    ]);

    const queueId = queueResult.rows[0].id;

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
      user_id,
      competition_id,
      'pick_reminder',
      subjectFor(competition_name, templateData.lock_time)
    ]);

    return { success: true, queue_id: queueId };
  } catch (error) {
    console.error('Error in queueEmailInternal:', error);
    return { success: false, error: error.message };
  }
}

router.post('/', async (req, res) => {
  logApiCall('load-pick-reminder');

  try {
    const { user_id, round_id, competition_id, validate } = req.body;

    // ========================================
    // BATCH MODE (Cron) - No user_id provided
    // ========================================
    if (!user_id && !round_id && !competition_id) {

      /*
      Eligibility lives in services/pickReminder.js. It used to be a 90-line query inlined here,
      which meant the admin screen could not ask "who would this reach" without either calling
      this route or writing a second copy of the rules.
      */
      const candidates = await findCandidates();


      // If no candidates found, return success with zero count
      if (candidates.length === 0) {
        return res.json({
          return_code: "SUCCESS",
          queued_count: 0,
          message: "No users need pick reminders at this time"
        });
      }

      // Queue all candidates to database
      let successCount = 0;
      let failCount = 0;

      for (const candidate of candidates) {
        const result = await queueEmailInternal(candidate);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
          console.error(`Failed to queue for user ${candidate.user_id}:`, result.error);
        }
      }

      return res.json({
        return_code: "SUCCESS",
        queued_count: successCount,
        failed_count: failCount,
        message: `Queued ${successCount} pick reminders (${failCount} failed)`
      });
    }

    // ========================================
    // SINGLE USER MODE (Manual Trigger)
    // ========================================

    // Validate required fields for single user mode
    if (!user_id || !Number.isInteger(user_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "user_id is required and must be a number"
      });
    }

    if (!round_id || !Number.isInteger(round_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "round_id is required and must be a number"
      });
    }

    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "competition_id is required and must be a number"
      });
    }

    // === OPTIONAL VALIDATION FOR SINGLE USER ===
    if (validate === true) {

      // Get all data needed for validation checks
      const validationResult = await query(`
        SELECT
          c.id as competition_id,
          c.name as competition_name,
          c.status as competition_status,
          r.id as round_id,
          r.round_number,
          r.lock_time,
          u.id as user_id,
          u.email as user_email,
          u.display_name as user_display_name,
          cu.status as player_status,
          org.display_name as organizer_name,
          (
            SELECT COUNT(*)
            FROM pick p
            WHERE p.round_id = r.id
              AND p.user_id = u.id
          ) as has_picked,
          (
            SELECT COUNT(*)
            FROM fixture f
            WHERE f.round_id = r.id
          ) as fixture_count,
          (
            SELECT COUNT(*)
            FROM email_queue eq
            WHERE eq.user_id = u.id
              AND eq.competition_id = c.id
              AND eq.round_id = r.id
              AND eq.email_type = 'pick_reminder'
          ) as already_queued

        FROM competition c
        INNER JOIN round r ON r.id = $2 AND r.competition_id = c.id
        INNER JOIN app_user u ON u.id = $1
        LEFT JOIN competition_user cu ON cu.competition_id = c.id AND cu.user_id = u.id
        LEFT JOIN app_user org ON org.id = c.organiser_id
        WHERE c.id = $3
      `, [user_id, round_id, competition_id]);

      if (validationResult.rows.length === 0) {
        return res.json({
          return_code: "VALIDATION_ERROR",
          message: "Competition, round, or user not found"
        });
      }

      const data = validationResult.rows[0];

      // CHECK: Competition is not complete.
      // Normalised before comparing, matching emailService.js - competition.status is upper case,
      // so the previous lower-case comparison never fired.
      if ((data.competition_status || '').toUpperCase() === 'COMPLETE') {
        return res.json({
          return_code: "COMPETITION_COMPLETE",
          message: "Competition is already complete"
        });
      }

      // CHECK: User is member of competition
      if (!data.player_status) {
        return res.json({
          return_code: "VALIDATION_ERROR",
          message: "User is not a member of this competition"
        });
      }

      // CHECK: User is not eliminated
      if (data.player_status !== 'active') {
        return res.json({
          return_code: "USER_ELIMINATED",
          message: "User is eliminated from this competition"
        });
      }

      // CHECK: User has not already picked
      if (data.has_picked > 0) {
        return res.json({
          return_code: "PICK_ALREADY_MADE",
          message: "User has already made their pick for this round"
        });
      }

      // CHECK: Round is not locked
      if (data.lock_time && new Date(data.lock_time) < new Date()) {
        return res.json({
          return_code: "ROUND_LOCKED",
          message: "Round is already locked"
        });
      }

      // CHECK: Round has fixtures
      if (data.fixture_count === 0) {
        return res.json({
          return_code: "NO_FIXTURES",
          message: "Round has no fixtures"
        });
      }

      // CHECK: User has valid email
      if (!data.user_email || data.user_email === '' || data.user_email.includes('@lms-guest.com')) {
        return res.json({
          return_code: "VALIDATION_ERROR",
          message: "User does not have a valid email address"
        });
      }

      // CHECK: Not already queued
      if (data.already_queued > 0) {
        return res.json({
          return_code: "ALREADY_QUEUED",
          message: "Pick reminder already queued for this round"
        });
      }

      // CHECK: Email preferences allow sending
      const emailPrefsResult = await query(`
        SELECT email_type, enabled, competition_id
        FROM email_preference
        WHERE user_id = $1
          AND (
            (competition_id = 0 AND email_type IN ('all', 'pick_reminder'))
            OR (competition_id = $2 AND email_type IS NULL)
          )
      `, [user_id, competition_id]);

      for (const pref of emailPrefsResult.rows) {
        if (pref.competition_id === 0 && pref.email_type === 'all' && pref.enabled === false) {
          return res.json({
            return_code: "EMAIL_DISABLED",
            message: "User has disabled all email notifications"
          });
        }
        if (pref.competition_id === 0 && pref.email_type === 'pick_reminder' && pref.enabled === false) {
          return res.json({
            return_code: "EMAIL_DISABLED",
            message: "User has disabled pick reminder emails"
          });
        }
        if (pref.competition_id === competition_id && pref.enabled === false) {
          return res.json({
            return_code: "EMAIL_DISABLED",
            message: "User has disabled emails for this competition"
          });
        }
      }

      // Validation passed - queue the email
      const result = await queueEmailInternal(data);

      if (result.success) {
        return res.json({
          return_code: "SUCCESS",
          message: "Pick reminder queued successfully",
          queue_id: result.queue_id
        });
      } else {
        return res.json({
          return_code: "SERVER_ERROR",
          message: "Failed to queue email: " + result.error
        });
      }

    } else {
      // === NO VALIDATION - FORCE QUEUE ===
      // Get minimal data needed for queuing
      const dataResult = await query(`
        SELECT
          c.id as competition_id,
          c.name as competition_name,
          r.id as round_id,
          r.round_number,
          r.lock_time,
          u.id as user_id,
          u.email as user_email,
          u.display_name as user_display_name,
          org.display_name as organizer_name
        FROM competition c
        INNER JOIN round r ON r.id = $2 AND r.competition_id = c.id
        INNER JOIN app_user u ON u.id = $1
        LEFT JOIN app_user org ON org.id = c.organiser_id
        WHERE c.id = $3
      `, [user_id, round_id, competition_id]);

      if (dataResult.rows.length === 0) {
        return res.json({
          return_code: "VALIDATION_ERROR",
          message: "Competition, round, or user not found"
        });
      }

      const data = dataResult.rows[0];
      const result = await queueEmailInternal(data);

      if (result.success) {
        return res.json({
          return_code: "SUCCESS",
          message: "Pick reminder queued successfully (forced)",
          queue_id: result.queue_id
        });
      } else {
        return res.json({
          return_code: "SERVER_ERROR",
          message: "Failed to queue email: " + result.error
        });
      }
    }

  } catch (error) {
    console.error('Error in load-pick-reminder:', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });

    return res.json({
      return_code: "SERVER_ERROR",
      message: "Failed to load pick reminder. Please try again."
    });
  }
});

module.exports = router;
