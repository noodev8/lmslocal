/*
=======================================================================================================================================
API Route: organizer-set-result
=======================================================================================================================================
Method: POST
Purpose: Sets the result for a single fixture. Converts win/draw choice to the appropriate team short code or "DRAW".
         Does NOT process eliminations - that happens separately via organizer-process-results.
=======================================================================================================================================
Request Payload:
{
  "fixture_id": 456,                          // integer, required - Fixture ID
  "result": "home_win"                        // string, required - "home_win", "away_win", or "draw"
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "fixture_id": 456,                          // integer, Fixture that was updated
  "result": "ARS",                            // string, Result value saved ("ARS", "CHE", or "DRAW")
  "message": "Result saved"                   // string, Confirmation message
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "INVALID_RESULT",
  "message": "Result must be: home_win, away_win, or draw"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"           - Required fields are missing
"INVALID_RESULT"           - Result type is not valid (must be home_win, away_win, or draw)
"UNAUTHORIZED"             - User is not the organiser of this competition
"FIXTURE_NOT_FOUND"        - Fixture doesn't exist
"ALREADY_PROCESSED"        - Fixture has already been processed (cannot change result)
"SERVER_ERROR"             - Database or unexpected error
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  logApiCall('organizer-set-result');

  try {
    const { fixture_id, result } = req.body;
    const user_id = req.user.id;

    // ========================================
    // STEP 1: VALIDATE REQUEST PAYLOAD
    // ========================================

    // Validate fixture_id
    if (!fixture_id || !Number.isInteger(parseInt(fixture_id))) {
      return res.status(200).json({
        return_code: "MISSING_FIELDS",
        message: "fixture_id is required and must be an integer"
      });
    }

    // Validate result
    if (!result || typeof result !== 'string') {
      return res.status(200).json({
        return_code: "MISSING_FIELDS",
        message: "result is required and must be a string"
      });
    }

    // Validate result type
    const validResults = ['home_win', 'away_win', 'draw'];
    if (!validResults.includes(result)) {
      return res.status(200).json({
        return_code: "INVALID_RESULT",
        message: "Result must be: home_win, away_win, or draw"
      });
    }

    const fixtureIdInt = parseInt(fixture_id);

    // ========================================
    // STEP 2: GET FIXTURE AND VERIFY AUTHORIZATION
    // ========================================

    // Get fixture details and verify user is organiser of the competition
    const fixtureResult = await query(`
      SELECT
        f.id,
        f.home_team_short,
        f.away_team_short,
        f.competition_id,
        f.processed,
        c.organiser_id,
        c.name as competition_name,
        c.fixture_service
      FROM fixture f
      JOIN competition c ON f.competition_id = c.id
      WHERE f.id = $1
    `, [fixtureIdInt]);

    // Check if fixture exists
    if (fixtureResult.rows.length === 0) {
      return res.status(200).json({
        return_code: "FIXTURE_NOT_FOUND",
        message: "Fixture not found"
      });
    }

    const fixture = fixtureResult.rows[0];

    // Verify user is the organiser of this competition
    if (fixture.organiser_id !== user_id) {
      return res.status(200).json({
        return_code: "UNAUTHORIZED",
        message: "Only the competition organiser can set results"
      });
    }

    // Verify competition is in manual mode (fixture_service = false)
    if (fixture.fixture_service !== false) {
      return res.status(200).json({
        return_code: "UNAUTHORIZED",
        message: "This competition uses automated fixture service"
      });
    }

    // Prevent changing results for already processed fixtures
    if (fixture.processed !== null) {
      return res.status(200).json({
        return_code: "ALREADY_PROCESSED",
        message: "Cannot change result - fixture has already been processed"
      });
    }

    // ========================================
    // STEP 3: CONVERT RESULT TYPE TO TEAM CODE
    // ========================================

    let resultValue;

    switch (result) {
      case 'home_win':
        resultValue = fixture.home_team_short;
        break;
      case 'away_win':
        resultValue = fixture.away_team_short;
        break;
      case 'draw':
        resultValue = 'DRAW';
        break;
    }

    // ========================================
    // STEP 4: UPDATE FIXTURE RESULT
    // ========================================

    await query(`
      UPDATE fixture
      SET result = $1
      WHERE id = $2
    `, [resultValue, fixtureIdInt]);

    // ========================================
    // STEP 5: RETURN SUCCESS RESPONSE
    // ========================================

    return res.status(200).json({
      return_code: "SUCCESS",
      fixture_id: fixtureIdInt,
      result: resultValue,
      message: "Result saved"
    });

  } catch (error) {
    // ========================================
    // ERROR HANDLING
    // ========================================
    console.error('Error in organizer-set-result:', error);
    return res.status(200).json({
      return_code: "SERVER_ERROR",
      message: "An error occurred while setting the result"
    });
  }
});

module.exports = router;
