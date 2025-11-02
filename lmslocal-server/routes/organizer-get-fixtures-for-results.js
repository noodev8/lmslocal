/*
=======================================================================================================================================
API Route: organizer-get-fixtures-for-results
=======================================================================================================================================
Method: POST
Purpose: Gets all fixtures from the current round for result entry. Returns fixtures with their current result status.
         Only accessible by competition organiser.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123                       // integer, required - Competition ID
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "round_id": 5,                              // integer, Current round ID
  "round_number": 5,                          // integer, Current round number
  "round_start_time": "2025-10-25T15:00:00Z", // string or null, Round lock time (when results can be entered)
  "fixtures": [                               // array, List of fixtures in current round
    {
      "id": 456,                              // integer, Fixture ID
      "home_team_short": "ARS",               // string, Home team short code
      "away_team_short": "CHE",               // string, Away team short code
      "home_team": "Arsenal",                 // string, Home team full name
      "away_team": "Chelsea",                 // string, Away team full name
      "kickoff_time": "2025-10-25T15:00:00Z", // string, ISO datetime
      "result": null,                         // string or null, Result if already set (team short or "DRAW")
      "processed": null                       // timestamp or null, When fixture was processed (null if not processed)
    }
  ],
  "total_fixtures": 10,                       // integer, Total fixtures in round
  "fixtures_with_results": 3,                 // integer, Count of fixtures with results entered
  "fixtures_pending": 7                       // integer, Count of fixtures still needing results
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "NO_ROUNDS",
  "message": "No rounds exist for this competition yet"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"           - Required fields are missing
"UNAUTHORIZED"             - User is not the organiser of this competition
"COMPETITION_NOT_FOUND"    - Competition doesn't exist
"NO_ROUNDS"                - No rounds exist for this competition
"SERVER_ERROR"             - Database or unexpected error
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const { canManageResults } = require('../utils/permissions');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  logApiCall('organizer-get-fixtures-for-results');

  try {
    const { competition_id } = req.body;
    const user_id = req.user.id;

    // ========================================
    // STEP 1: VALIDATE REQUEST PAYLOAD
    // ========================================

    // Validate competition_id
    if (!competition_id || !Number.isInteger(parseInt(competition_id))) {
      return res.status(200).json({
        return_code: "MISSING_FIELDS",
        message: "competition_id is required and must be an integer"
      });
    }

    const competitionIdInt = parseInt(competition_id);

    // ========================================
    // STEP 2: VERIFY COMPETITION AND AUTHORIZATION
    // ========================================

    // Get competition details and verify user is organiser
    const competitionResult = await query(`
      SELECT
        id,
        name,
        organiser_id,
        status
      FROM competition
      WHERE id = $1
    `, [competitionIdInt]);

    // Check if competition exists
    if (competitionResult.rows.length === 0) {
      return res.status(200).json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition not found"
      });
    }

    const competition = competitionResult.rows[0];

    // Verify user has permission to manage results (organiser or delegated permission)
    const permission = await canManageResults(user_id, competition_id);
    if (!permission.authorized) {
      return res.status(200).json({
        return_code: "UNAUTHORIZED",
        message: "You do not have permission to view fixtures for this competition"
      });
    }

    // ========================================
    // STEP 3: GET CURRENT ROUND
    // ========================================

    // Get the latest round (most recent round_number)
    const roundResult = await query(`
      SELECT id, round_number, lock_time
      FROM round
      WHERE competition_id = $1
      ORDER BY round_number DESC
      LIMIT 1
    `, [competitionIdInt]);

    // Check if any rounds exist
    if (roundResult.rows.length === 0) {
      return res.status(200).json({
        return_code: "NO_ROUNDS",
        message: "No rounds exist for this competition yet"
      });
    }

    const round = roundResult.rows[0];

    // ========================================
    // STEP 4: GET ALL FIXTURES FOR CURRENT ROUND
    // ========================================

    const fixturesResult = await query(`
      SELECT
        id,
        home_team,
        away_team,
        home_team_short,
        away_team_short,
        kickoff_time,
        result,
        processed
      FROM fixture
      WHERE round_id = $1
      ORDER BY kickoff_time ASC, id ASC
    `, [round.id]);

    const fixtures = fixturesResult.rows;

    // ========================================
    // STEP 5: CALCULATE STATISTICS
    // ========================================

    const totalFixtures = fixtures.length;
    const fixturesWithResults = fixtures.filter(f => f.result !== null).length;
    const fixturesPending = totalFixtures - fixturesWithResults;

    // ========================================
    // STEP 6: RETURN SUCCESS RESPONSE
    // ========================================

    return res.status(200).json({
      return_code: "SUCCESS",
      round_id: round.id,
      round_number: round.round_number,
      round_start_time: round.lock_time,
      fixtures: fixtures,
      total_fixtures: totalFixtures,
      fixtures_with_results: fixturesWithResults,
      fixtures_pending: fixturesPending
    });

  } catch (error) {
    // ========================================
    // ERROR HANDLING
    // ========================================
    console.error('Error in organizer-get-fixtures-for-results:', error);
    return res.status(200).json({
      return_code: "SERVER_ERROR",
      message: "An error occurred while retrieving fixtures"
    });
  }
});

module.exports = router;
