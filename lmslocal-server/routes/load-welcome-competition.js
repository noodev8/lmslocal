/*
=======================================================================================================================================
API Route: load-welcome-competition
=======================================================================================================================================
Method: POST
Purpose: Queues a welcome email for a user who just joined a competition. Email scheduled for next day.
=======================================================================================================================================
Request Payload:
{
  "user_id": 123,                      // integer, required - User who joined
  "competition_id": 45                 // integer, required - Competition they joined
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Welcome email queued successfully",
  "queue_id": 789                      // integer, email queue ID
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
"COMPETITION_NOT_FOUND"
"USER_NOT_FOUND"
"EMAIL_DISABLED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();

router.post('/', async (req, res) => {
  logApiCall('load-welcome-competition');

  try {
    const { user_id, competition_id } = req.body;

    // === INPUT VALIDATION ===
    if (!user_id || !Number.isInteger(user_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "user_id is required and must be a number"
      });
    }

    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "competition_id is required and must be a number"
      });
    }

    // === GET USER AND COMPETITION DATA ===
    const dataResult = await query(`
      SELECT
        u.id as user_id,
        u.email as user_email,
        u.display_name as user_display_name,
        c.id as competition_id,
        c.name as competition_name,
        c.lives_per_player,
        c.no_team_twice,
        org.display_name as organizer_name,
        (
          SELECT MIN(r.lock_time)
          FROM round r
          WHERE r.competition_id = c.id
          AND r.lock_time > NOW()
        ) as next_round_lock_time,
        (
          SELECT r.round_number
          FROM round r
          WHERE r.competition_id = c.id
          AND r.lock_time > NOW()
          ORDER BY r.round_number ASC
          LIMIT 1
        ) as next_round_number
      FROM app_user u
      INNER JOIN competition c ON c.id = $2
      LEFT JOIN app_user org ON org.id = c.organiser_id
      WHERE u.id = $1
    `, [user_id, competition_id]);

    if (dataResult.rows.length === 0) {
      return res.json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "User or competition not found"
      });
    }

    const data = dataResult.rows[0];

    // === CHECK: User has valid email ===
    if (!data.user_email || data.user_email === '' || data.user_email.includes('@lms-guest.com')) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "User does not have a valid email address"
      });
    }

    // === CHECK: Email preferences allow sending ===
    const emailPrefsResult = await query(`
      SELECT email_type, enabled, competition_id
      FROM email_preference
      WHERE user_id = $1
        AND (
          (competition_id = 0 AND email_type IN ('all', 'welcome'))
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
      if (pref.competition_id === 0 && pref.email_type === 'welcome' && pref.enabled === false) {
        return res.json({
          return_code: "EMAIL_DISABLED",
          message: "User has disabled welcome emails"
        });
      }
      if (pref.competition_id === competition_id && pref.enabled === false) {
        return res.json({
          return_code: "EMAIL_DISABLED",
          message: "User has disabled emails for this competition"
        });
      }
    }

    // === QUEUE THE EMAIL ===
    // Generate unique tracking ID for this email
    const emailTrackingId = `welcome_${user_id}_${competition_id}_${Date.now()}`;

    // Prepare template data that will be used when email is sent
    const templateData = {
      email_tracking_id: emailTrackingId,
      user_email: data.user_email,
      user_display_name: data.user_display_name,
      competition_name: data.competition_name,
      organizer_name: data.organizer_name || 'Competition Organizer',
      lives_per_player: data.lives_per_player,
      no_team_twice: data.no_team_twice,
      next_round_number: data.next_round_number,
      next_round_lock_time: data.next_round_lock_time,
      competition_id,
      user_id
    };

    // Insert email into queue with 'pending' status, scheduled for next day
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
        $1, $2, NULL, 'welcome', NOW() + INTERVAL '1 day', $3, 'pending', 0
      )
      RETURNING id
    `, [
      user_id,
      competition_id,
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
      'welcome',
      `Welcome to ${data.competition_name}!`
    ]);

    return res.json({
      return_code: "SUCCESS",
      message: "Welcome email queued successfully",
      queue_id: queueId
    });

  } catch (error) {
    console.error('Error in load-welcome-competition:', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });

    return res.json({
      return_code: "SERVER_ERROR",
      message: "Failed to queue welcome email. Please try again."
    });
  }
});

module.exports = router;
