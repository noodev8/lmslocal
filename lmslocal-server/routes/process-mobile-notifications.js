/*
=======================================================================================================================================
API Route: process-mobile-notifications
=======================================================================================================================================
Method: POST
Purpose: Processes the mobile notification queue and sends push notifications via FCM.
         Called by server cron job every 5 minutes.
=======================================================================================================================================
Request Payload:
{
  // No authentication required - endpoint is safe and idempotent
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "processed": 15,                         // integer, total queue entries processed
  "sent": 8,                               // integer, notifications successfully sent
  "skipped": 7,                            // integer, entries skipped (conditions not met)
  "users_notified": 5,                     // integer, unique users who received a notification
  "old_entries_deleted": 0                 // integer, entries older than 30 days deleted
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"   // string, user-friendly error description
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const { logApiCall } = require('../utils/apiLogger');
const { sendNotificationToUser } = require('../services/fcmService');
const router = express.Router();

// ===========================================================================================================
// Notification Priority Order (highest first)
// ===========================================================================================================
// 1. new_round - Inform player of new round first
// 2. pick_reminder - Reminder if they haven't picked (24hrs before lock)
// 3. results - Informational
// ===========================================================================================================
const PRIORITY_ORDER = ['new_round', 'pick_reminder', 'results'];

router.post('/', async (req, res) => {
  // Log API call for debugging when enabled
  logApiCall('process-mobile-notifications');

  try {
    // === STEP 0: CLEANUP STALE NOTIFICATIONS ===
    // Mark as skipped any pending notifications for rounds that are no longer current
    const staleCleanupResult = await query(`
      UPDATE mobile_notification_queue mnq
      SET status = 'skipped', sent_at = NOW()
      WHERE mnq.status = 'pending'
        AND mnq.round_number < (
          SELECT MAX(r.round_number)
          FROM round r
          WHERE r.competition_id = mnq.competition_id
        )
    `);

    if (staleCleanupResult.rowCount > 0) {
      console.log(`Marked ${staleCleanupResult.rowCount} stale notifications as skipped`);
    }

    // Delete pending/skipped 'new_round' and 'pick_reminder' entries for rounds that are complete
    // Don't delete 'results' - they need to be sent after results are processed
    // Keep 'sent' entries for record-keeping
    const deleteCompletedResult = await query(`
      DELETE FROM mobile_notification_queue mnq
      WHERE mnq.status IN ('pending', 'skipped')
        AND mnq.type IN ('new_round', 'pick_reminder')
        AND EXISTS (
          SELECT 1 FROM fixture f
          WHERE f.round_id = mnq.round_id
            AND f.processed IS NOT NULL
        )
    `);

    if (deleteCompletedResult.rowCount > 0) {
      console.log(`Deleted ${deleteCompletedResult.rowCount} notifications for completed rounds`);
    }

    // === STEP 1: GET PENDING NOTIFICATIONS ===
    // Get 'new_round' and 'results' entries that are ready to send immediately
    // Get 'pick_reminder' entries only if we're within 24 hours of lock time
    const pendingResult = await query(`
      SELECT
        mnq.id,
        mnq.user_id,
        mnq.type,
        mnq.competition_id,
        mnq.round_id,
        mnq.round_number,
        r.lock_time
      FROM mobile_notification_queue mnq
      JOIN round r ON r.id = mnq.round_id
      WHERE mnq.status = 'pending'
        AND (
          -- new_round and results: send immediately
          mnq.type IN ('new_round', 'results')
          OR
          -- pick_reminder: only send if within 24 hours of lock time
          (mnq.type = 'pick_reminder' AND r.lock_time - INTERVAL '24 hours' <= NOW())
        )
      ORDER BY mnq.user_id, mnq.created_at
    `);

    const pendingEntries = pendingResult.rows;

    if (pendingEntries.length === 0) {
      return res.json({
        return_code: "SUCCESS",
        processed: 0,
        sent: 0,
        skipped: 0,
        users_notified: 0
      });
    }

    // === STEP 2: CHECK CONDITIONS AND GROUP BY USER ===
    // For each entry, verify player conditions are still met
    // Then group valid entries by user_id

    const validEntriesByUser = {}; // { user_id: [entries] }
    const entriesToSkip = []; // Entry IDs to mark as skipped

    for (const entry of pendingEntries) {
      const isValid = await checkEntryConditions(entry);

      if (isValid) {
        if (!validEntriesByUser[entry.user_id]) {
          validEntriesByUser[entry.user_id] = [];
        }
        validEntriesByUser[entry.user_id].push(entry);
      } else {
        entriesToSkip.push(entry.id);
      }
    }

    // === STEP 3: APPLY ONE-NOTIFICATION RULE ===
    // For each user, select only the highest priority notification

    const notificationsToSend = []; // { user_id, entry, type }

    for (const userId of Object.keys(validEntriesByUser)) {
      const userEntries = validEntriesByUser[userId];

      // Find highest priority entry
      let selectedEntry = null;
      let selectedPriority = Infinity;

      for (const entry of userEntries) {
        const priority = PRIORITY_ORDER.indexOf(entry.type);
        if (priority !== -1 && priority < selectedPriority) {
          selectedPriority = priority;
          selectedEntry = entry;
        }
      }

      if (selectedEntry) {
        notificationsToSend.push({
          user_id: userId,
          entry: selectedEntry,
          type: selectedEntry.type
        });

        // Mark other entries for this user as skipped
        for (const entry of userEntries) {
          if (entry.id !== selectedEntry.id) {
            entriesToSkip.push(entry.id);
          }
        }
      }
    }

    // === STEP 4: GET DEVICE TOKENS FOR USERS ===
    // Fetch FCM tokens for all users we need to notify

    const userIds = notificationsToSend.map(n => parseInt(n.user_id));

    let deviceTokensByUser = {};

    if (userIds.length > 0) {
      const tokensResult = await query(`
        SELECT user_id, fcm_token
        FROM device_tokens
        WHERE user_id = ANY($1)
      `, [userIds]);

      // Group tokens by user
      for (const row of tokensResult.rows) {
        if (!deviceTokensByUser[row.user_id]) {
          deviceTokensByUser[row.user_id] = [];
        }
        deviceTokensByUser[row.user_id].push(row.fcm_token);
      }
    }

    // === STEP 5: SEND NOTIFICATIONS ===
    // Send one notification per user (to all their devices)

    const entriesToMarkSent = [];
    const invalidTokensToRemove = [];
    let usersNotified = 0;

    for (const notification of notificationsToSend) {
      const userTokens = deviceTokensByUser[notification.user_id];

      if (!userTokens || userTokens.length === 0) {
        // User has no registered devices, skip this notification
        entriesToSkip.push(notification.entry.id);
        continue;
      }

      // Send notification to all user's devices
      const result = await sendNotificationToUser(userTokens, notification.type);

      if (result.success) {
        entriesToMarkSent.push(notification.entry.id);
        usersNotified++;

        // Collect invalid tokens for cleanup
        if (result.invalidTokens.length > 0) {
          invalidTokensToRemove.push(...result.invalidTokens);
        }
      } else {
        // All sends failed, mark as skipped
        entriesToSkip.push(notification.entry.id);
      }
    }

    // === STEP 6: UPDATE QUEUE STATUS ===
    // Mark entries as sent or skipped

    if (entriesToMarkSent.length > 0) {
      await query(`
        UPDATE mobile_notification_queue
        SET status = 'sent', sent_at = NOW()
        WHERE id = ANY($1)
      `, [entriesToMarkSent]);
    }

    if (entriesToSkip.length > 0) {
      await query(`
        UPDATE mobile_notification_queue
        SET status = 'skipped', sent_at = NOW()
        WHERE id = ANY($1)
      `, [entriesToSkip]);
    }

    // === STEP 7: CLEANUP INVALID TOKENS ===
    // Remove tokens that Firebase reported as invalid

    if (invalidTokensToRemove.length > 0) {
      await query(`
        DELETE FROM device_tokens
        WHERE fcm_token = ANY($1)
      `, [invalidTokensToRemove]);

      console.log(`Removed ${invalidTokensToRemove.length} invalid device tokens`);
    }

    // === STEP 8: CLEANUP OLD ENTRIES ===
    // Delete notification queue entries older than 30 days to prevent table bloat

    const cleanupResult = await query(`
      DELETE FROM mobile_notification_queue
      WHERE created_at < NOW() - INTERVAL '30 days'
    `);

    const entriesDeleted = cleanupResult.rowCount || 0;
    if (entriesDeleted > 0) {
      console.log(`Cleaned up ${entriesDeleted} notification queue entries older than 30 days`);
    }

    // === SUCCESS RESPONSE ===
    res.json({
      return_code: "SUCCESS",
      processed: pendingEntries.length,
      sent: entriesToMarkSent.length,
      skipped: entriesToSkip.length,
      users_notified: usersNotified,
      old_entries_deleted: entriesDeleted
    });

  } catch (error) {
    // === ERROR HANDLING ===
    console.error('Process mobile notifications error:', error);
    res.json({
      return_code: "SERVER_ERROR",
      message: "Failed to process notifications"
    });
  }
});

/**
 * Check if a notification entry's conditions are still met
 * @param {Object} entry - Queue entry with user_id, type, competition_id, round_id, round_number
 * @returns {Promise<boolean>} - True if notification should be sent
 */
async function checkEntryConditions(entry) {
  try {
    // === CHECK 1: Is player still active in competition? ===
    // Player must have status = 'active' and not be hidden
    const playerResult = await query(`
      SELECT status, hidden
      FROM competition_user
      WHERE user_id = $1 AND competition_id = $2
    `, [entry.user_id, entry.competition_id]);

    if (playerResult.rows.length === 0) {
      // Player not in competition
      return false;
    }

    const player = playerResult.rows[0];

    if (player.status !== 'active' || player.hidden === true) {
      // Player is eliminated or hidden
      return false;
    }

    // === TYPE-SPECIFIC CHECKS ===

    if (entry.type === 'pick_reminder' || entry.type === 'new_round') {
      // === CHECK 2: Has player already made a pick for this round? ===
      const pickResult = await query(`
        SELECT id FROM pick
        WHERE user_id = $1 AND round_id = $2
      `, [entry.user_id, entry.round_id]);

      if (pickResult.rows.length > 0) {
        // Player already picked, don't send notification
        return false;
      }

      // === CHECK 3: Is round still open (not locked)? ===
      const roundResult = await query(`
        SELECT lock_time FROM round WHERE id = $1
      `, [entry.round_id]);

      if (roundResult.rows.length > 0) {
        const lockTime = new Date(roundResult.rows[0].lock_time);
        if (lockTime <= new Date()) {
          // Round already locked
          return false;
        }
      }
    }

    // For 'results', active player check is sufficient

    return true;
  } catch (error) {
    console.error('Error checking entry conditions:', error);
    return false;
  }
}

module.exports = router;
