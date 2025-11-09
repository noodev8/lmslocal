/*
=======================================================================================================================================
API Route: check-user-type
=======================================================================================================================================
Method: POST
Purpose: Dynamically calculates user's primary role (admin/player/both) based on actual competition participation and provides user analytics
=======================================================================================================================================
Request Payload:
{}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "user_type": "admin",                        // string, user's primary role: "admin", "player", or "both"
  "suggested_route": "/dashboard",             // string, recommended dashboard route
  "organized_count": 3,                       // integer, number of competitions organized
  "participating_count": 5,                   // integer, number of competitions participating in
  "has_organized": true,                      // boolean, has created at least one competition
  "has_participated": true                    // boolean, has joined at least one competition
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"      // string, user-friendly error description
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"UNAUTHORIZED"
"USER_NOT_FOUND"  
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  logApiCall('check-user-type');

  try {
    const user_id = req.user.id;

    // Verify user exists
    const userResult = await query(
      'SELECT id FROM app_user WHERE id = $1',
      [user_id]
    );

    if (userResult.rows.length === 0) {
      return res.json({
        return_code: "USER_NOT_FOUND",
        message: "User not found"
      });
    }

    // Get competition statistics for enhanced user insights
    const organizedResult = await query(
      'SELECT COUNT(*) as count FROM competition WHERE organiser_id = $1',
      [user_id]
    );

    const participatingResult = await query(
      'SELECT COUNT(*) as count FROM competition_user WHERE user_id = $1',
      [user_id]
    );

    const organized_count = parseInt(organizedResult.rows[0].count);
    const participating_count = parseInt(participatingResult.rows[0].count);
    const has_organized = organized_count > 0;
    const has_participated = participating_count > 0;

    // Calculate user_type dynamically based on actual participation
    let user_type;
    if (has_organized && has_participated) {
      user_type = 'both';
    } else if (has_organized) {
      user_type = 'admin';
    } else {
      user_type = 'player';
    }

    // Determine suggested route based on calculated user type
    let suggested_route;
    if (user_type === 'admin' || user_type === 'both') {
      suggested_route = "/dashboard";
    } else {
      suggested_route = "/play";
    }

    // Return comprehensive user analytics
    res.json({
      return_code: "SUCCESS",
      user_type: user_type,
      suggested_route: suggested_route,
      organized_count: organized_count,
      participating_count: participating_count,
      has_organized: has_organized,
      has_participated: has_participated
    });

  } catch (error) {
    console.error('Check user type error:', error);
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;