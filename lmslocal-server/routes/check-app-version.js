/*
=======================================================================================================================================
API Route: check-app-version
=======================================================================================================================================
Method: POST
Purpose: Checks if the mobile app version meets minimum requirements and provides store URL for updates if needed
=======================================================================================================================================
Request Payload:
{
  "current_version": "1.1.2",          // string, required - Current app version (semantic versioning)
  "platform": "android"                 // string, required - Platform: "android" or "ios"
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "update_required": false,             // boolean, true if app must be updated
  "minimum_version": "1.1.1",          // string, minimum version required
  "store_url": "https://..."           // string, platform-specific store URL
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
"INVALID_PLATFORM"
"PLATFORM_NOT_CONFIGURED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();

/**
 * Compare two semantic version strings (e.g., "1.1.2" vs "1.2.0")
 * Returns:
 *   -1 if v1 < v2
 *    0 if v1 === v2
 *    1 if v1 > v2
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 < part2) return -1;
    if (part1 > part2) return 1;
  }

  return 0;
}

router.post('/', async (req, res) => {
  logApiCall('check-app-version');

  try {
    const { current_version, platform } = req.body;

    // Validate required fields
    if (!current_version || !platform) {
      return res.json({
        return_code: "MISSING_FIELDS",
        message: "current_version and platform are required"
      });
    }

    // Validate platform value
    const validPlatforms = ['android', 'ios'];
    if (!validPlatforms.includes(platform.toLowerCase())) {
      return res.json({
        return_code: "INVALID_PLATFORM",
        message: "Platform must be 'android' or 'ios'"
      });
    }

    // Query app_version table for platform-specific configuration
    const versionResult = await query(
      'SELECT minimum_version, store_url FROM app_version WHERE LOWER(platform) = LOWER($1)',
      [platform]
    );

    // Check if platform is configured in database
    if (versionResult.rows.length === 0) {
      return res.json({
        return_code: "PLATFORM_NOT_CONFIGURED",
        message: "Version information not configured for this platform"
      });
    }

    const { minimum_version, store_url } = versionResult.rows[0];

    // Compare current version with minimum required version
    const versionComparison = compareVersions(current_version, minimum_version);
    const update_required = versionComparison < 0; // current version is less than minimum

    // Return version check results
    res.json({
      return_code: "SUCCESS",
      update_required: update_required,
      minimum_version: minimum_version,
      store_url: store_url
    });

  } catch (error) {
    console.error('Check app version error:', error);
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;
