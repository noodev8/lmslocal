/*
=======================================================================================================================================
API Route: load-results-email
=======================================================================================================================================
Method: POST
Purpose: Validates users and queues results emails to email_queue table. Does NOT send emails - use send-email API for that.
=======================================================================================================================================
Request Payload:
{
  "round_id": 45,                      // integer, required - Round to send results for
  "competition_id": 12                 // integer, required - Competition context
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Results emails queued successfully",
  "queued_count": 15                   // integer, number of emails queued
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
"ROUND_NOT_CALCULATED"
"COMPETITION_NOT_FOUND"
"ROUND_NOT_FOUND"
"UNAUTHORIZED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();

// === INTERNAL HELPER FUNCTION: QUEUE RESULTS EMAIL ===
// This function prepares result template data and queues email to database (does NOT send)
async function queueResultsEmailInternal(params) {
  const {
    user_id,
    round_id,
    competition_id,
    user_email,
    user_display_name,
    competition_name,
    organizer_name,
    round_number,
    user_pick,
    pick_result,
    user_outcome,
    lives_remaining,
    new_status
  } = params;

  try {
    // Generate unique tracking ID for this email
    const emailTrackingId = `results_${user_id}_${competition_id}_${round_id}_${Date.now()}`;

    // Prepare template data that will be used when email is sent
    const templateData = {
      email_tracking_id: emailTrackingId,
      user_email,
      user_display_name,
      competition_name,
      organizer_name: organizer_name || 'Competition Organizer',
      round_number,

      // User's specific result data
      user_pick: user_pick || 'No pick made',
      pick_result, // 'win', 'loss', 'draw', 'no_pick'
      user_outcome, // 'advanced', 'eliminated', 'life_lost'
      lives_remaining,
      new_status, // 'active', 'eliminated'

      competition_id,
      round_id,
      user_id
    };

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
      'results',
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
      'results',
      `${organizer_name || 'Competition Organizer'} (${competition_name}): Round ${round_number} Results`
    ]);

    return { success: true, queue_id: queueId };
  } catch (error) {
    console.error('Error in queueResultsEmailInternal:', error);
    return { success: false, error: error.message };
  }
}

router.post('/', verifyToken, async (req, res) => {
  logApiCall('load-results-email');

  try {
    const { round_id, competition_id } = req.body;

    // ========================================
    // BATCH MODE (Cron/Auto) - No parameters provided
    // ========================================
    if (!round_id && !competition_id) {

      // Find all rounds that have calculated results but haven't had emails queued yet
      const eligibleRoundsResult = await query(`
        SELECT DISTINCT
          pp.round_id,
          pp.competition_id,
          r.round_number,
          c.name as competition_name,
          org.display_name as organizer_name
        FROM player_progress pp
        INNER JOIN round r ON r.id = pp.round_id
        INNER JOIN competition c ON c.id = pp.competition_id
        LEFT JOIN app_user org ON org.id = c.organiser_id
        WHERE
          -- Results have been calculated (player_progress entries exist)
          pp.created_at IS NOT NULL

          -- Competition is not complete (optional - could still send for completed comps)
          AND c.status != 'complete'

          -- But results emails haven't been queued yet for this round
          AND NOT EXISTS (
            SELECT 1 FROM email_queue eq
            WHERE eq.round_id = pp.round_id
            AND eq.competition_id = pp.competition_id
            AND eq.email_type = 'results'
          )

          -- Optional: Only recent results (last 7 days to avoid sending old results)
          AND pp.created_at > NOW() - INTERVAL '7 days'

        ORDER BY pp.created_at DESC
      `);

      const eligibleRounds = eligibleRoundsResult.rows;

      // If no eligible rounds found, return success with zero count
      if (eligibleRounds.length === 0) {
        return res.json({
          return_code: "SUCCESS",
          queued_count: 0,
          rounds_processed: 0,
          message: "No rounds need results emails at this time"
        });
      }

      // Process each eligible round
      let totalQueued = 0;
      let totalFailed = 0;
      let roundsProcessed = 0;

      for (const roundInfo of eligibleRounds) {
        // Get candidates for this specific round using the existing logic
        const candidatesResult = await query(`
          SELECT DISTINCT
            pp.player_id as user_id,
            u.email as user_email,
            u.display_name as user_display_name,
            pp.chosen_team as user_pick,
            pp.outcome as user_outcome,
            cu.status as new_status,
            cu.lives_remaining,

            -- Determine pick result from outcome
            CASE
              WHEN pp.outcome = 'advanced' THEN 'win'
              WHEN pp.outcome = 'eliminated' THEN 'loss'
              WHEN pp.outcome = 'life_lost' THEN 'draw'
              WHEN pp.outcome = 'no_pick' THEN 'no_pick'
              ELSE 'unknown'
            END as pick_result

          FROM player_progress pp

          -- Join to get user details
          INNER JOIN app_user u
            ON u.id = pp.player_id
            AND u.email IS NOT NULL
            AND u.email != ''
            AND u.email NOT LIKE '%@lms-guest.com'

          -- Join to get current player status and lives
          INNER JOIN competition_user cu
            ON cu.user_id = pp.player_id
            AND cu.competition_id = pp.competition_id

          WHERE pp.round_id = $1
            AND pp.competition_id = $2

            -- OPTION C: Include if player is CURRENTLY active OR was eliminated in THIS round
            AND (
              cu.status = 'active'
              OR (cu.status = 'eliminated' AND pp.outcome = 'eliminated')
            )

            -- Check email preferences: Global "all emails" is ON
            AND NOT EXISTS (
              SELECT 1
              FROM email_preference ep
              WHERE ep.user_id = pp.player_id
                AND ep.competition_id = 0
                AND ep.email_type = 'all'
                AND ep.enabled = false
            )

            -- Check email preferences: Global "results" is ON
            AND NOT EXISTS (
              SELECT 1
              FROM email_preference ep
              WHERE ep.user_id = pp.player_id
                AND ep.competition_id = 0
                AND ep.email_type = 'results'
                AND ep.enabled = false
            )

            -- Check email preferences: Competition-specific override allows emails
            AND NOT EXISTS (
              SELECT 1
              FROM email_preference ep
              WHERE ep.user_id = pp.player_id
                AND ep.competition_id = $2
                AND ep.email_type IS NULL
                AND ep.enabled = false
            )

            -- Not already queued/sent (redundant check but ensures safety)
            AND NOT EXISTS (
              SELECT 1
              FROM email_queue eq
              WHERE eq.user_id = pp.player_id
                AND eq.competition_id = $2
                AND eq.round_id = $1
                AND eq.email_type = 'results'
            )

          ORDER BY pp.player_id
        `, [roundInfo.round_id, roundInfo.competition_id]);

        const candidates = candidatesResult.rows;

        // Queue all candidates for this round
        for (const candidate of candidates) {
          // Merge round data with candidate data
          const emailData = {
            ...candidate,
            competition_id: roundInfo.competition_id,
            competition_name: roundInfo.competition_name,
            organizer_name: roundInfo.organizer_name,
            round_id: roundInfo.round_id,
            round_number: roundInfo.round_number
          };

          const result = await queueResultsEmailInternal(emailData);
          if (result.success) {
            totalQueued++;
          } else {
            totalFailed++;
            console.error(`Failed to queue results email for user ${candidate.user_id}:`, result.error);
          }
        }

        roundsProcessed++;
        console.log(`Processed round ${roundInfo.round_number} for competition ${roundInfo.competition_name}: queued ${candidates.length} emails`);
      }

      return res.json({
        return_code: "SUCCESS",
        queued_count: totalQueued,
        failed_count: totalFailed,
        rounds_processed: roundsProcessed,
        message: `Queued ${totalQueued} results emails across ${roundsProcessed} rounds (${totalFailed} failed)`
      });
    }

    // ========================================
    // SINGLE ROUND MODE - round_id and competition_id provided
    // ========================================

    // === INPUT VALIDATION ===
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

    // === CHECK: Competition and round exist ===
    const roundCheck = await query(`
      SELECT
        r.id,
        r.round_number,
        c.id as competition_id,
        c.name as competition_name,
        c.status as competition_status,
        org.display_name as organizer_name
      FROM round r
      INNER JOIN competition c ON c.id = r.competition_id
      LEFT JOIN app_user org ON org.id = c.organiser_id
      WHERE r.id = $1 AND c.id = $2
    `, [round_id, competition_id]);

    if (roundCheck.rows.length === 0) {
      return res.json({
        return_code: "ROUND_NOT_FOUND",
        message: "Round or competition not found"
      });
    }

    const roundData = roundCheck.rows[0];

    // === CHECK: Results have been calculated (player_progress entries exist) ===
    const resultsCheck = await query(`
      SELECT COUNT(*) as result_count
      FROM player_progress
      WHERE round_id = $1 AND competition_id = $2
    `, [round_id, competition_id]);

    if (resultsCheck.rows[0].result_count === 0) {
      return res.json({
        return_code: "ROUND_NOT_CALCULATED",
        message: "Results have not been calculated for this round yet"
      });
    }

    // === OPTION C LOGIC: Active players + newly eliminated from THIS round ===
    // Get all users who need results emails:
    // 1. Currently active players in competition
    // 2. Players who were eliminated in THIS specific round
    const candidatesResult = await query(`
      SELECT DISTINCT
        pp.player_id as user_id,
        u.email as user_email,
        u.display_name as user_display_name,
        pp.chosen_team as user_pick,
        pp.outcome as user_outcome,
        cu.status as new_status,
        cu.lives_remaining,

        -- Determine pick result from outcome
        CASE
          WHEN pp.outcome = 'advanced' THEN 'win'
          WHEN pp.outcome = 'eliminated' THEN 'loss'
          WHEN pp.outcome = 'life_lost' THEN 'draw'
          WHEN pp.outcome = 'no_pick' THEN 'no_pick'
          ELSE 'unknown'
        END as pick_result

      FROM player_progress pp

      -- Join to get user details
      INNER JOIN app_user u
        ON u.id = pp.player_id
        AND u.email IS NOT NULL
        AND u.email != ''
        AND u.email NOT LIKE '%@lms-guest.com'

      -- Join to get current player status and lives
      INNER JOIN competition_user cu
        ON cu.user_id = pp.player_id
        AND cu.competition_id = pp.competition_id

      WHERE pp.round_id = $1
        AND pp.competition_id = $2

        -- OPTION C: Include if player is CURRENTLY active OR was eliminated in THIS round
        AND (
          cu.status = 'active'
          OR (cu.status = 'eliminated' AND pp.outcome = 'eliminated')
        )

        -- Check email preferences: Global "all emails" is ON
        AND NOT EXISTS (
          SELECT 1
          FROM email_preference ep
          WHERE ep.user_id = pp.player_id
            AND ep.competition_id = 0
            AND ep.email_type = 'all'
            AND ep.enabled = false
        )

        -- Check email preferences: Global "results" is ON
        AND NOT EXISTS (
          SELECT 1
          FROM email_preference ep
          WHERE ep.user_id = pp.player_id
            AND ep.competition_id = 0
            AND ep.email_type = 'results'
            AND ep.enabled = false
        )

        -- Check email preferences: Competition-specific override allows emails
        AND NOT EXISTS (
          SELECT 1
          FROM email_preference ep
          WHERE ep.user_id = pp.player_id
            AND ep.competition_id = $2
            AND ep.email_type IS NULL
            AND ep.enabled = false
        )

        -- Not already queued/sent
        AND NOT EXISTS (
          SELECT 1
          FROM email_queue eq
          WHERE eq.user_id = pp.player_id
            AND eq.competition_id = $2
            AND eq.round_id = $1
            AND eq.email_type = 'results'
        )

      ORDER BY pp.player_id
    `, [round_id, competition_id]);

    const candidates = candidatesResult.rows;

    // If no candidates found, return success with zero count
    if (candidates.length === 0) {
      return res.json({
        return_code: "SUCCESS",
        queued_count: 0,
        message: "No users need results emails (already sent or preferences disabled)"
      });
    }

    // Queue all candidates to database
    let successCount = 0;
    let failCount = 0;

    for (const candidate of candidates) {
      // Merge round data with candidate data
      const emailData = {
        ...candidate,
        competition_id: roundData.competition_id,
        competition_name: roundData.competition_name,
        organizer_name: roundData.organizer_name,
        round_id,
        round_number: roundData.round_number
      };

      const result = await queueResultsEmailInternal(emailData);
      if (result.success) {
        successCount++;
      } else {
        failCount++;
        console.error(`Failed to queue results email for user ${candidate.user_id}:`, result.error);
      }
    }

    return res.json({
      return_code: "SUCCESS",
      queued_count: successCount,
      failed_count: failCount,
      message: `Queued ${successCount} results emails (${failCount} failed)`
    });

  } catch (error) {
    console.error('Error in load-results-email:', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });

    return res.json({
      return_code: "SERVER_ERROR",
      message: "Failed to load results emails. Please try again."
    });
  }
});

module.exports = router;
