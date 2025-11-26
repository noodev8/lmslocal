/*
=======================================================================================================================================
API Route: register-device-token
=======================================================================================================================================
Method: POST
Purpose: Registers or updates a device's FCM token for push notifications. Called by Flutter app on login/startup.
=======================================================================================================================================
Request Payload:
{
  "fcm_token": "abc123...",              // string, required - Firebase Cloud Messaging token
  "platform": "ios"                       // string, required - 'ios' or 'android'
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Device token registered"   // string, confirmation message
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message" // string, user-friendly error description
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"
"VALIDATION_ERROR"
"UNAUTHORIZED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  // Log API call for debugging when enabled
  logApiCall('register-device-token');

  try {
    // Extract request parameters and authenticated user ID
    const { fcm_token, platform } = req.body;
    const user_id = req.user.id;

    // === INPUT VALIDATION ===
    // Ensure required fields are provided

    if (!fcm_token) {
      return res.json({
        return_code: "MISSING_FIELDS",
        message: "FCM token is required"
      });
    }

    if (!platform) {
      return res.json({
        return_code: "MISSING_FIELDS",
        message: "Platform is required"
      });
    }

    // Validate platform is one of the expected values
    const validPlatforms = ['ios', 'android'];
    const normalizedPlatform = platform.toLowerCase();

    if (!validPlatforms.includes(normalizedPlatform)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Platform must be 'ios' or 'android'"
      });
    }

    // === UPSERT DEVICE TOKEN ===
    // Insert new token or update existing one for this user/token combination
    // Uses ON CONFLICT to handle the UNIQUE(user_id, fcm_token) constraint
    await query(`
      INSERT INTO device_tokens (user_id, fcm_token, platform, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id, fcm_token)
      DO UPDATE SET
        platform = EXCLUDED.platform,
        updated_at = NOW()
    `, [user_id, fcm_token, normalizedPlatform]);

    // === SUCCESS RESPONSE ===
    res.json({
      return_code: "SUCCESS",
      message: "Device token registered"
    });

  } catch (error) {
    // === ERROR HANDLING ===
    // Log detailed error for debugging but return generic message to client
    console.error('Register device token error:', error);
    res.json({
      return_code: "SERVER_ERROR",
      message: "Failed to register device token"
    });
  }
});

module.exports = router;
