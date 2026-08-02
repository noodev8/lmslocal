/*
=======================================================================================================================================
API Route: push-fixtures-to-competitions
=======================================================================================================================================
Method: POST
Purpose: Pushes fixtures from fixture_load table to competitions using gameweek-based system.
         - Identifies competitions needing fixtures (blank round or completed round)
         - Finds the earliest gameweek (gameweek > 0) whose first kickoff is at or after the
           competition's earliest_start_date, falling back to NOW() when that is not set
         - Pushes that gameweek to eligible competitions
         - Creates new rounds or populates blank rounds as needed

         Authentication: admin token. This route used to accept the shared string
         BOT_MAGIC_2025 in the request body, which was compiled into the public lmslocal-web
         JavaScript bundle by the old /admin-fixtures page - so anyone who read the site's
         source could create rounds across every subscribed competition.
=======================================================================================================================================
Request Payload:
  None. Authentication is by admin token in the Authorization header.

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "competitions_updated": 3,              // integer, number of competitions that received fixtures
  "competitions_skipped": 1,              // integer, number of competitions skipped (no fixtures available)
  "fixtures_pushed": 10,                  // integer, total number of fixtures inserted
  "message": "Fixtures pushed successfully"  // string, summary message
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"NO_ACTIVE_FIXTURES"         - Nothing staged: fixture_load holds no rows with gameweek > 0
"NO_SUBSCRIBED_COMPETITIONS" - No competitions have fixture_service = true
"UNAUTHORIZED"               - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"              - Admin session has expired
"SERVER_ERROR"               - Database or unexpected errors
=======================================================================================================================================
*/

const express = require('express');
const { transaction } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const { pushFixturesToCompetitions } = require('../../services/fixtureService');
const router = express.Router();

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('push-fixtures-to-competitions');

  try {
    // Execute all operations in a single atomic transaction
    const result = await transaction(async (client) => {
      return await pushFixturesToCompetitions(client);
    });

    // Transaction completed successfully - send response
    res.json({
      return_code: "SUCCESS",
      competitions_updated: result.competitions_updated,
      competitions_skipped: result.competitions_skipped,
      fixtures_pushed: result.fixtures_pushed,
      message: "Fixtures pushed successfully"
    });

  } catch (error) {
    console.error('Push fixtures error:', error);

    // Handle specific business logic errors with appropriate return codes
    if (error.message === 'NO_ACTIVE_FIXTURES') {
      return res.json({
        return_code: "NO_ACTIVE_FIXTURES",
        message: "No fixtures are staged"
      });
    }

    if (error.message === 'NO_SUBSCRIBED_COMPETITIONS') {
      return res.json({
        return_code: "NO_SUBSCRIBED_COMPETITIONS",
        message: "No competitions are subscribed to the fixture service"
      });
    }

    // Database or unexpected errors
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;