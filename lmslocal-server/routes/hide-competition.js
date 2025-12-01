/*
=======================================================================================================================================
API Route: hide-competition
=======================================================================================================================================
Method: POST
Purpose: Allow a player to leave or hide a competition from their dashboard (triggered by BIN button in Flutter app)

IMPORTANT BEHAVIOR (added Dec 2024):
- If competition has NOT started: Player is FULLY REMOVED from the competition (all data deleted)
- If competition HAS started: Competition is just HIDDEN from their dashboard (data preserved)

"Competition started" is defined as:
- Round number >= 2, OR
- Round 1 exists AND its lock_time has passed

This allows players to "undo" joining a competition before it begins, but prevents them from
deleting their participation history once the competition is underway.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123                     // integer, required - Competition ID to hide/leave
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "action": "removed" | "hidden",           // string, which action was taken
  "message": "You have left the competition" | "Competition hidden successfully"
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"
"INVALID_COMPETITION_ID"
"NOT_MEMBER"
"ALREADY_HIDDEN"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  // Log API call for monitoring
  logApiCall('hide-competition');

  try {
    // Extract authenticated user ID from JWT token
    const user_id = req.user.id;
    const user_email = req.user.email;

    // Extract request payload
    const { competition_id } = req.body;

    // === VALIDATION ===
    if (!competition_id) {
      return res.status(200).json({
        return_code: "MISSING_FIELDS",
        message: "competition_id is required"
      });
    }

    if (!Number.isInteger(competition_id) || competition_id <= 0) {
      return res.status(200).json({
        return_code: "INVALID_COMPETITION_ID",
        message: "competition_id must be a valid positive integer"
      });
    }

    // === CHECK MEMBERSHIP AND COMPETITION STATUS ===
    // Single query to get membership info AND determine if competition has started
    const statusQuery = `
      SELECT
        cu.id as membership_id,
        cu.status,
        cu.hidden,
        c.name as competition_name,
        -- Get the maximum round number for this competition
        COALESCE(MAX(r.round_number), 0) as max_round_number,
        -- Get round 1's lock time (if it exists)
        (
          SELECT r1.lock_time
          FROM round r1
          WHERE r1.competition_id = c.id AND r1.round_number = 1
          LIMIT 1
        ) as round_1_lock_time,
        NOW() as current_time
      FROM competition_user cu
      INNER JOIN competition c ON c.id = cu.competition_id
      LEFT JOIN round r ON r.competition_id = c.id
      WHERE cu.competition_id = $1 AND cu.user_id = $2
      GROUP BY cu.id, cu.status, cu.hidden, c.name, c.id
    `;

    const statusResult = await query(statusQuery, [competition_id, user_id]);

    // User is not a member of this competition
    if (statusResult.rows.length === 0) {
      return res.status(200).json({
        return_code: "NOT_MEMBER",
        message: "You are not a member of this competition"
      });
    }

    const data = statusResult.rows[0];

    // Check if competition is already hidden
    if (data.hidden === true) {
      return res.status(200).json({
        return_code: "ALREADY_HIDDEN",
        message: "Competition is already hidden for you"
      });
    }

    // === DETERMINE IF COMPETITION HAS STARTED ===
    // Competition is considered "started" if:
    // 1. Round number >= 2 (we're past round 1), OR
    // 2. Round 1 exists AND its lock_time has passed
    const maxRound = parseInt(data.max_round_number) || 0;
    const round1LockTime = data.round_1_lock_time ? new Date(data.round_1_lock_time) : null;
    const currentTime = new Date(data.current_time);

    const competitionStarted =
      maxRound >= 2 ||
      (round1LockTime !== null && currentTime >= round1LockTime);

    // === BRANCH: FULL REMOVAL vs HIDE ===
    if (!competitionStarted) {
      // =====================================================================
      // COMPETITION NOT STARTED: Full removal - delete player from all tables
      // =====================================================================
      // This allows players to "undo" joining before the competition begins.
      // Uses same deletion logic as remove-player.js for consistency.
      // =====================================================================

      const removalResult = await transaction(async (client) => {
        // 1. Delete all picks for this player in this competition
        const picksDeleteQuery = `
          DELETE FROM pick
          WHERE user_id = $1 AND round_id IN (
            SELECT id FROM round WHERE competition_id = $2
          )
        `;
        const picksResult = await client.query(picksDeleteQuery, [user_id, competition_id]);

        // 2. Delete allowed teams for this player
        const allowedTeamsDeleteQuery = `
          DELETE FROM allowed_teams
          WHERE user_id = $1 AND competition_id = $2
        `;
        const allowedTeamsResult = await client.query(allowedTeamsDeleteQuery, [user_id, competition_id]);

        // 3. Delete player progress records
        const progressDeleteQuery = `
          DELETE FROM player_progress
          WHERE player_id = $1 AND competition_id = $2
        `;
        const progressResult = await client.query(progressDeleteQuery, [user_id, competition_id]);

        // 4. Delete pending mobile notifications
        const notificationsDeleteQuery = `
          DELETE FROM mobile_notification_queue
          WHERE user_id = $1 AND competition_id = $2
        `;
        const notificationsResult = await client.query(notificationsDeleteQuery, [user_id, competition_id]);

        // 5. Delete pending emails
        const emailQueueDeleteQuery = `
          DELETE FROM email_queue
          WHERE user_id = $1 AND competition_id = $2
        `;
        const emailQueueResult = await client.query(emailQueueDeleteQuery, [user_id, competition_id]);

        // 6. Delete email preferences
        const emailPrefsDeleteQuery = `
          DELETE FROM email_preference
          WHERE user_id = $1 AND competition_id = $2
        `;
        const emailPrefsResult = await client.query(emailPrefsDeleteQuery, [user_id, competition_id]);

        // 7. Finally, remove the player from competition membership
        const membershipDeleteQuery = `
          DELETE FROM competition_user
          WHERE user_id = $1 AND competition_id = $2
        `;
        const membershipResult = await client.query(membershipDeleteQuery, [user_id, competition_id]);

        // Calculate total records removed
        const totalRecordsDeleted =
          (picksResult.rowCount || 0) +
          (allowedTeamsResult.rowCount || 0) +
          (progressResult.rowCount || 0) +
          (notificationsResult.rowCount || 0) +
          (emailQueueResult.rowCount || 0) +
          (emailPrefsResult.rowCount || 0) +
          (membershipResult.rowCount || 0);

        // 8. Create audit log entry
        const auditDetails = {
          action: 'PLAYER_LEFT',
          reason: 'Player voluntarily left before competition started',
          player: {
            id: user_id,
            email: user_email
          },
          competition: {
            id: competition_id,
            name: data.competition_name
          },
          records_deleted: {
            picks: picksResult.rowCount || 0,
            allowed_teams: allowedTeamsResult.rowCount || 0,
            progress: progressResult.rowCount || 0,
            notifications: notificationsResult.rowCount || 0,
            email_queue: emailQueueResult.rowCount || 0,
            email_preferences: emailPrefsResult.rowCount || 0,
            membership: membershipResult.rowCount || 0,
            total: totalRecordsDeleted
          }
        };

        await client.query(`
          INSERT INTO audit_log (competition_id, user_id, action, details, created_at)
          VALUES ($1, $2, $3, $4, NOW())
        `, [competition_id, user_id, 'PLAYER_LEFT', JSON.stringify(auditDetails)]);

        return { totalRecordsDeleted };
      });

      console.log(`✓ Player ${user_id} left competition ${competition_id} (${removalResult.totalRecordsDeleted} records deleted)`);

      return res.status(200).json({
        return_code: "SUCCESS",
        action: "removed",
        message: "You have left the competition"
      });

    } else {
      // =====================================================================
      // COMPETITION STARTED: Just hide - preserve all player data
      // =====================================================================
      // Competition is underway, so we only hide it from the player's dashboard.
      // Their picks, progress, and history are preserved.
      // =====================================================================

      const hideQuery = `
        UPDATE competition_user
        SET hidden = true
        WHERE competition_id = $1 AND user_id = $2
        RETURNING id, hidden
      `;

      const hideResult = await query(hideQuery, [competition_id, user_id]);

      if (hideResult.rows.length === 0) {
        return res.status(200).json({
          return_code: "SERVER_ERROR",
          message: "Failed to hide competition - update returned no rows"
        });
      }

      console.log(`✓ Player ${user_id} hid competition ${competition_id} (competition already started)`);

      return res.status(200).json({
        return_code: "SUCCESS",
        action: "hidden",
        message: "Competition hidden successfully"
      });
    }

  } catch (error) {
    console.error('Hide/leave competition error:', error);

    return res.status(200).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error occurred"
    });
  }
});

module.exports = router;
