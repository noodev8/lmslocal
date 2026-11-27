/*
=======================================================================================================================================
FCM Service - Firebase Cloud Messaging Integration
=======================================================================================================================================
Purpose: Deliver push notifications to the mobile app. Transport only - it is handed finished
         messages and knows nothing about who should get one or what it says.

Since 2026-11-27 the only caller is services/emailPush.js: a push goes WITH an email, built from
that email's data, never on its own (docs/mobile-notifications.md §1). The fixed per-type wording
that used to live here went with the old queue; the words now come from the email's service.
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

/** One FCM message for one device. */
const buildMessage = ({ token, type, title, body, data }) => ({
  token,
  notification: { title, body },
  // Where a tap should land. Delivered to the app on both platforms via
  // onMessageOpenedApp (backgrounded) and getInitialMessage (cold start).
  data: buildDataPayload(type, data),
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
  apns: {
    payload: {
      aps: {
        sound: 'default',
        badge: 1
      }
    }
  }
});

// The token is dead - uninstalled, or the app's data cleared. Firebase will never take it again.
const DEAD_TOKEN_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered'
]);

// sendEach's own ceiling per call.
const BATCH_LIMIT = 500;

/**
 * Send a batch of messages, one per device, and report on each.
 *
 * sendEach rather than a call per device: one round trip per 500 rather than per phone, and a
 * failure on one token does not stop the rest.
 *
 * @param {Array<{token: string, type: string, title: string, body: string, data?: object}>} messages
 * @returns {Promise<{ok: boolean, results: Array<{success: boolean, dead: boolean, error?: string}>, error?: string}>}
 *          `results` lines up with `messages`. ok is false only when nothing could be attempted.
 */
const sendPushes = async (messages) => {
  if (messages.length === 0) return { ok: true, results: [] };

  if (!initializeFirebase()) {
    return {
      ok: false,
      error: 'Firebase not initialized',
      results: messages.map(() => ({ success: false, dead: false, error: 'Firebase not initialized' }))
    };
  }

  const results = [];

  for (let i = 0; i < messages.length; i += BATCH_LIMIT) {
    const chunk = messages.slice(i, i + BATCH_LIMIT);

    try {
      const response = await getMessaging().sendEach(chunk.map(buildMessage));
      for (const r of response.responses) {
        results.push(r.success
          ? { success: true, dead: false }
          : {
              success: false,
              dead: DEAD_TOKEN_CODES.has(r.error?.code),
              error: r.error?.message || 'unknown'
            });
      }
    } catch (error) {
      // The whole call failed - credentials, network. Every message in the chunk is a failure.
      console.error('FCM Service: sendEach failed:', error.message);
      for (let j = 0; j < chunk.length; j++) {
        results.push({ success: false, dead: false, error: error.message });
      }
    }
  }

  return { ok: true, results };
};

module.exports = {
  initializeFirebase,
  buildDataPayload,
  sendPushes
};
