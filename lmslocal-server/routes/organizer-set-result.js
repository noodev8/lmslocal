/*
=======================================================================================================================================
API Route: organizer-set-result
=======================================================================================================================================
Method: POST
Purpose: Sets or clears the result for a single fixture. Converts win/draw choice to the appropriate team short code or "DRAW";
         "clear" sets the result back to NULL so a mis-tap can be undone.
         Does NOT process eliminations - that happens separately via organizer-process-results.
=======================================================================================================================================
Request Payload:
{
  "fixture_id": 456,                          // integer, required - Fixture ID
  "result": "home_win"                        // string, required - "home_win", "away_win", "draw", or "clear"
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "fixture_id": 456,                          // integer, Fixture that was updated
  "result": "ARS",                            // string|null, Value saved ("ARS", "CHE", "DRAW", or null when cleared)
  "message": "Result saved"                   // string, Confirmation message
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "INVALID_RESULT",
  "message": "Result must be: home_win, away_win, draw, or clear"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"           - Required fields are missing
"INVALID_RESULT"           - Result type is not valid (must be home_win, away_win, draw, or clear)
"UNAUTHORIZED"             - User is not the organiser of this competition
"FIXTURE_NOT_FOUND"        - Fixture doesn't exist
"AUTOMATED_COMPETITION"    - Competition uses fixture_service (automated mode)
"ROUND_NOT_STARTED"        - Round has not locked yet; picks are still open
"ALREADY_PROCESSED"        - Fixture has already been processed (cannot change result)
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

    // Validate result type. "clear" un-sets a result the organiser entered by mistake; it takes
    // the identical path to a set, so every guard below - permission, automated, round locked,
    // already processed - applies to it too. A processed fixture stays immutable either way.
    const validResults = ['home_win', 'away_win', 'draw', 'clear'];
    if (!validResults.includes(result)) {
      return res.status(200).json({
        return_code: "INVALID_RESULT",
        message: "Result must be: home_win, away_win, draw, or clear"
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
        c.fixture_service,
        r.lock_time
      FROM fixture f
      JOIN competition c ON f.competition_id = c.id
      JOIN round r ON f.round_id = r.id
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

    // Verify user has permission to manage results (organiser or delegated permission)
    const permission = await canManageResults(user_id, fixture.competition_id);
    if (!permission.authorized) {
      return res.status(200).json({
        return_code: "UNAUTHORIZED",
        message: "You do not have permission to set results for this competition"
      });
    }

    // Verify competition is in manual mode (fixture_service = false) - automated competitions
    // are read-only on the organiser side, the fixture service owns their results.
    if (fixture.fixture_service !== false) {
      return res.status(200).json({
        return_code: "AUTOMATED_COMPETITION",
        message: "This competition uses automated fixture service"
      });
    }

    // Refuse until the round has locked. Picks are still open before lock_time, so a result
    // entered now could be processed against a half-complete set of picks - every player who
    // had not picked yet would take a no-pick penalty for a round they were still entitled to
    // play. The UI already hides the buttons until lock time; this makes it a rule rather than
    // a presentational courtesy. A null lock_time means no lock was ever set, so nothing to wait for.
    if (fixture.lock_time !== null && new Date(fixture.lock_time) > new Date()) {
      return res.status(200).json({
        return_code: "ROUND_NOT_STARTED",
        message: "This round has not started yet - results cannot be entered until picks close"
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
      case 'clear':
        // NULL is the same "no result yet" the fixture was created with, so the round drops back
        // a phase on its own - see docs/round-state-machine.md.
        resultValue = null;
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
      message: resultValue === null ? "Result cleared" : "Result saved"
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
