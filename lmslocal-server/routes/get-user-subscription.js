/*
=======================================================================================================================================
API Route: get-user-subscription
=======================================================================================================================================
Method: POST
Purpose: Retrieves the current user's subscription details, plan information, and player usage statistics across all competitions they organize.
=======================================================================================================================================
Request Payload:
{
  // No additional payload required - user identified via JWT token
}

Success Response:
{
  "return_code": "SUCCESS",
  "subscription": {
    "plan": "lite",                    // string, current plan: "lite", "starter", "pro"
    "expiry": "2024-01-15T10:30:00Z",  // string (ISO date) or null for lite plan
    "player_count": 23,                // integer, total active players across all competitions
    "player_limit": 50,                // integer, max players allowed for current plan
    "usage_percentage": 46             // integer, percentage of limit used (0-100)
  },
  "plan_limits": {
    "lite": 10,                        // integer, player limit for lite plan
    "starter": 50,                     // integer, player limit for starter plan
    "pro": 500                         // integer, player limit for pro plan
  }
}

Error Response:
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"UNAUTHORIZED"
"USER_NOT_FOUND"
"SERVER_ERROR"

Edge Cases Handled:
- Invalid subscription_plan values (NULL, undefined, or unknown plans) default to "lite"
- Invalid subscription_expiry dates are set to NULL
- Negative player counts are set to 0
- Division by zero protection in usage percentage calculation
- Missing plan limits fallback to "lite" plan limits
=======================================================================================================================================
*/

const express = require('express');
const router = express.Router();
const { query, transaction } = require('../database'); // Use destructured database import
const { verifyToken } = require('../middleware/auth'); // JWT authentication middleware
const { logApiCall } = require('../utils/apiLogger'); // API logging utility

// Define plan limits as constants for consistency
const PLAN_LIMITS = {
  lite: 10,
  starter: 50,
  pro: 500
};

/**
 * POST /get-user-subscription
 * Retrieves user's subscription details and player usage statistics
 */
router.post('/', verifyToken, async (req, res) => {
  const startTime = Date.now();
  let userId;

  try {
    // Extract user ID from JWT token (set by verifyToken middleware)
    userId = req.user.id;

    // Log the API call for monitoring and debugging
    logApiCall('get-user-subscription');

    // Use transaction wrapper for atomic queries to ensure data consistency
    const result = await transaction(async (client) => {

      // Query 1: Get user's current subscription details from app_user table
      const userQuery = `
        SELECT
          subscription_plan,
          subscription_expiry
        FROM app_user
        WHERE id = $1
      `;

      const userResult = await client.query(userQuery, [userId]);

      // Check if user exists in database
      if (userResult.rows.length === 0) {
        throw new Error('USER_NOT_FOUND');
      }

      const userData = userResult.rows[0];

      // Query 2: Count total active players across all competitions organized by this user
      // This query joins competition and competition_user tables to count players
      // where the user is the organizer and players have 'active' status
      const playerCountQuery = `
        SELECT COUNT(DISTINCT cu.user_id) as total_players
        FROM competition c
        INNER JOIN competition_user cu ON c.id = cu.competition_id
        WHERE c.organiser_id = $1
          AND cu.status = 'active'
      `;

      const playerCountResult = await client.query(playerCountQuery, [userId]);

      // Parse and validate player count - ensure it's a non-negative integer
      let totalPlayers = parseInt(playerCountResult.rows[0].total_players) || 0;
      if (totalPlayers < 0) {
        console.warn(`Negative player count ${totalPlayers} for user ${userId}, setting to 0`);
        totalPlayers = 0;
      }

      return {
        userData,
        totalPlayers
      };
    });

    // Extract and validate subscription plan from user data
    let currentPlan = result.userData.subscription_plan;

    // Handle NULL, undefined, or invalid plan values - ensures we always have a valid plan
    if (!currentPlan || !PLAN_LIMITS[currentPlan]) {
      console.warn(`Invalid subscription plan '${currentPlan}' for user ${userId}, defaulting to 'lite'`);
      currentPlan = 'lite';
    }

    // Extract and validate subscription expiry date
    let subscriptionExpiry = result.userData.subscription_expiry;

    // Validate expiry date format if present - ensure it's a valid date
    if (subscriptionExpiry && !Date.parse(subscriptionExpiry)) {
      console.warn(`Invalid subscription expiry date '${subscriptionExpiry}' for user ${userId}, setting to null`);
      subscriptionExpiry = null;
    }

    // Get the player limit for the current plan with fallback protection
    const playerLimit = PLAN_LIMITS[currentPlan] || PLAN_LIMITS.lite;

    // Calculate usage percentage with division by zero protection (0-100)
    const usagePercentage = playerLimit > 0 ? Math.round((result.totalPlayers / playerLimit) * 100) : 0;

    // Construct the success response with subscription details
    const responseData = {
      return_code: 'SUCCESS',
      subscription: {
        plan: currentPlan,
        expiry: subscriptionExpiry, // Will be null for lite plan
        player_count: result.totalPlayers,
        player_limit: playerLimit,
        usage_percentage: usagePercentage
      },
      plan_limits: PLAN_LIMITS
    };

    // Always return HTTP 200 with success/error in return_code
    return res.status(200).json(responseData);

  } catch (error) {
    // Log error for debugging and monitoring
    console.error('Error in get-user-subscription:', error);

    // Handle specific error types
    let returnCode = 'SERVER_ERROR';
    let message = 'An unexpected error occurred';

    if (error.message === 'USER_NOT_FOUND') {
      returnCode = 'USER_NOT_FOUND';
      message = 'User not found in system';
    }

    // Always return HTTP 200 with error details in return_code
    return res.status(200).json({
      return_code: returnCode,
      message: message
    });
  }
});

module.exports = router;