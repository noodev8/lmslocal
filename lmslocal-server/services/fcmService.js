/*
=======================================================================================================================================
FCM Service - Firebase Cloud Messaging Integration
=======================================================================================================================================
Purpose: Handle push notifications via Firebase Cloud Messaging for the mobile app
=======================================================================================================================================
*/

/*
firebase-admin v14 removed the namespaced API (`admin.credential.cert`, `admin.messaging()`).
Using the modular entry points instead. This matters quietly: the old call failed inside a
try/catch that returns { success: false }, so notifications would have stopped sending without
raising an error anywhere.
*/
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const path = require('path');

// ===========================================================================================================
// Firebase Admin SDK Initialization
// ===========================================================================================================
// Uses service account JSON file for authentication
// File should be in lmslocal-server/ folder and gitignored
// ===========================================================================================================

let firebaseInitialized = false;

const initializeFirebase = () => {
  if (firebaseInitialized) return true;

  try {
    // Look for service account file - pattern: lms-local-*-firebase-adminsdk-*.json
    const fs = require('fs');
    const serverDir = path.join(__dirname, '..');
    const files = fs.readdirSync(serverDir);
    const serviceAccountFile = files.find(f => f.includes('firebase-adminsdk') && f.endsWith('.json'));

    if (!serviceAccountFile) {
      console.error('FCM Service: Firebase service account file not found');
      return false;
    }

    const serviceAccountPath = path.join(serverDir, serviceAccountFile);
    const serviceAccount = require(serviceAccountPath);

    // Guard against a second initializeApp call, which throws in the modular API
    if (getApps().length === 0) {
      initializeApp({
        credential: cert(serviceAccount)
      });
    }

    firebaseInitialized = true;
    console.log('FCM Service: Firebase initialized successfully');
    return true;
  } catch (error) {
    console.error('FCM Service: Failed to initialize Firebase:', error.message);
    return false;
  }
};

// ===========================================================================================================
// Notification Messages
// ===========================================================================================================
// Predefined messages for each notification type
// ===========================================================================================================

const NOTIFICATION_MESSAGES = {
  new_round: {
    title: 'Results Are In',
    body: 'Results are in - see how you did!'
  },
  pick_reminder: {
    title: 'Pick Reminder',
    body: "Don't forget to make your pick before it locks!"
  }
};

/**
 * Build the data payload the app uses to decide where a tap should land.
 *
 * Every value must be a string. FCM rejects a data map containing numbers, and it does so
 * for the whole message - a single integer competition_id would stop the notification
 * being delivered at all rather than merely arriving without its id.
 *
 * Nulls are dropped rather than sent as "null", so the app can test for a key's presence
 * instead of having to know that the string "null" means absent.
 *
 * The app maps type -> screen itself, and falls back to the competition's own page for a
 * type it does not recognise. That is what lets a new notification type ship from the
 * server without stranding taps on the app versions already on people's phones - which
 * matters here, because an app release takes days to reach everyone and never reaches
 * everyone.
 */
const buildDataPayload = (notificationType, data) => {
  const payload = { type: notificationType };

  for (const [key, value] of Object.entries(data || {})) {
    if (value !== null && value !== undefined) {
      payload[key] = String(value);
    }
  }

  return payload;
};

/**
 * Send a push notification to a single device
 * @param {string} fcmToken - The device's FCM token
 * @param {string} notificationType - 'new_round' | 'pick_reminder'
 * @param {Object} [data] - Routing context: competition_id, round_id, round_number
 * @returns {Promise<{success: boolean, error?: string}>}
 */
const sendNotification = async (fcmToken, notificationType, data = {}) => {
  // Ensure Firebase is initialized
  if (!initializeFirebase()) {
    return { success: false, error: 'Firebase not initialized' };
  }

  const messageConfig = NOTIFICATION_MESSAGES[notificationType];
  if (!messageConfig) {
    return { success: false, error: `Unknown notification type: ${notificationType}` };
  }

  try {
    const message = {
      token: fcmToken,
      notification: {
        title: messageConfig.title,
        body: messageConfig.body
      },
      // Where a tap should land. Delivered to the app on both platforms via
      // onMessageOpenedApp (backgrounded) and getInitialMessage (cold start).
      data: buildDataPayload(notificationType, data),
      // Android-specific configuration
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          // Must match the channel the app declares as its default in
          // AndroidManifest.xml. A channel id that does not exist on the device is not a
          // formatting detail - Android will not display the notification at all.
          channelId: 'lms_notifications'
        }
      },
      // iOS-specific configuration
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    const response = await getMessaging().send(message);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('FCM Service: Error sending notification:', error.message);

    // Check for invalid token errors
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      return { success: false, error: 'invalid_token', shouldRemoveToken: true };
    }

    return { success: false, error: error.message };
  }
};

/**
 * Send notifications to multiple devices for the same user
 * @param {string[]} fcmTokens - Array of FCM tokens for the user's devices
 * @param {string} notificationType - 'new_round' | 'pick_reminder'
 * @param {Object} [data] - Routing context: competition_id, round_id, round_number
 * @returns {Promise<{success: boolean, sent: number, failed: number, invalidTokens: string[]}>}
 */
const sendNotificationToUser = async (fcmTokens, notificationType, data = {}) => {
  const results = {
    success: true,
    sent: 0,
    failed: 0,
    invalidTokens: []
  };

  // Send to all user's devices
  for (const token of fcmTokens) {
    const result = await sendNotification(token, notificationType, data);

    if (result.success) {
      results.sent++;
    } else {
      results.failed++;
      if (result.shouldRemoveToken) {
        results.invalidTokens.push(token);
      }
    }
  }

  // Consider success if at least one notification was sent
  results.success = results.sent > 0;

  return results;
};

module.exports = {
  initializeFirebase,
  sendNotification,
  sendNotificationToUser,
  NOTIFICATION_MESSAGES
};
