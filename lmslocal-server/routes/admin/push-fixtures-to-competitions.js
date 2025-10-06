/*
=======================================================================================================================================
API Route: push-fixtures-to-competitions
=======================================================================================================================================
Method: POST
Purpose: Pushes fixtures from fixture_load table to competitions using gameweek-based system.
         - Identifies competitions needing fixtures (blank round or completed round)
         - Finds earliest available gameweek (gameweek > 0, kickoff >= NOW() + 6 days)
         - Pushes that gameweek to eligible competitions
         - Creates new rounds or populates blank rounds as needed
=======================================================================================================================================
Request Payload:
{
  "bot_manage": "BOT_MAGIC_2025"       // string, required - bot management identifier
}

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
"NO_ACTIVE_FIXTURES"         - No gameweeks available with kickoff >= NOW() + 6 days and gameweek > 0
"NO_SUBSCRIBED_COMPETITIONS" - No competitions have fixture_service = true
"UNAUTHORIZED"               - Invalid bot management identifier
"SERVER_ERROR"               - Database or unexpected errors
=======================================================================================================================================
*/

const express = require('express');
const { transaction } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { pushFixturesToCompetitions } = require('../../services/fixtureService');
const router = express.Router();

// Bot management identifier for testing endpoints
const BOT_MANAGE = "BOT_MAGIC_2025";

router.post('/', async (req, res) => {
  logApiCall('push-fixtures-to-competitions');

  try {
    const { bot_manage } = req.body;

    // STEP 1: Validate bot management identifier
    if (!bot_manage || bot_manage !== BOT_MANAGE) {
      return res.json({
        return_code: "UNAUTHORIZED",
        message: "Invalid bot management identifier"
      });
    }

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
        message: "No gameweeks available with kickoff >= NOW() + 6 days and gameweek > 0"
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