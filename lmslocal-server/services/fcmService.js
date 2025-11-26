/*
=======================================================================================================================================
FCM Service - Firebase Cloud Messaging Integration
=======================================================================================================================================
Purpose: Handle push notifications via Firebase Cloud Messaging for the mobile app
=======================================================================================================================================
*/

const admin = require('firebase-admin');
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

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

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
    title: 'New Round Open',
    body: 'Fixtures are ready - time to make your pick!'
  },
  pick_reminder: {
    title: 'Pick Reminder',
    body: "Don't forget to make your pick before it locks!"
  },
  results: {
    title: 'Results Are In',
    body: 'Results are in - see how you did!'
  }
};

/**
 * Send a push notification to a single device
 * @param {string} fcmToken - The device's FCM token
 * @param {string} notificationType - 'new_round' | 'pick_reminder' | 'results'
 * @returns {Promise<{success: boolean, error?: string}>}
 */
const sendNotification = async (fcmToken, notificationType) => {
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
      // Android-specific configuration
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
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

    const response = await admin.messaging().send(message);
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
 * @param {string} notificationType - 'new_round' | 'pick_reminder' | 'results'
 * @returns {Promise<{success: boolean, sent: number, failed: number, invalidTokens: string[]}>}
 */
const sendNotificationToUser = async (fcmTokens, notificationType) => {
  const results = {
    success: true,
    sent: 0,
    failed: 0,
    invalidTokens: []
  };

  // Send to all user's devices
  for (const token of fcmTokens) {
    const result = await sendNotification(token, notificationType);

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
