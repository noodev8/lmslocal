/*
=======================================================================================================================================
API Route: set-staged-result
=======================================================================================================================================
Method: POST
Purpose: Record the outcome of one staged fixture, ready to be pushed to every subscribed
         competition holding that gameweek.

         Replaces the old /admin-set-result, which was gated by the hardcoded string '12221' and
         carried "AND team_list_id = 1" in its UPDATE, so it silently matched nothing for any
         other list.
=======================================================================================================================================
Request Payload:
{
  "fixture_id": 123,                         // integer, required - fixture_load.fixture_id
  "result": "home_win"                       // string, required - "home_win" | "away_win" | "draw"
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "fixture_id": 123,                         // integer
  "home_score": 1,                           // integer
  "away_score": 0,                           // integer
  "result": "home_win"                       // string, echoed back
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"          - Missing fixture_id, or result not one of the three allowed values
"FIXTURE_NOT_FOUND"         - No such row in fixture_load - also what a fixture whose result was
                              already pushed looks like, since pushing deletes the row
"UNAUTHORIZED"              - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"             - Admin session has expired
"SERVER_ERROR"              - Database error or unexpected server failure
=======================================================================================================================================
Data Notes:
- fixture_load stores scores, not outcomes; push-results-to-competitions turns them into the
  winning team's short code (or 'DRAW') on the competition fixture. The scores written here are
  therefore tokens for an outcome, not real ones - a home win is always 1-0.
- A result can be corrected by calling this again with a different value, right up until it is
  pushed. That is deliberate: a misclick used to need a hand-written UPDATE against production.
- Once pushed, push-results-to-competitions deletes the fixture_load row (see that route), so a
  further edit attempt here naturally hits FIXTURE_NOT_FOUND rather than a dedicated check.
  Undoing a pushed result is a game-state change that belongs in the competition, not in staging.
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const router = express.Router();

// A home win is 1-0, an away win 0-1, a draw 1-1. Only the comparison matters downstream.
const RESULT_SCORES = {
  home_win: { home: 1, away: 0 },
  away_win: { home: 0, away: 1 },
  draw: { home: 1, away: 1 }
};

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('set-staged-result');

  try {
    const { fixture_id, result } = req.body;

    if (!Number.isInteger(fixture_id)) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'fixture_id is required'
      });
    }

    const scores = RESULT_SCORES[result];
    if (!scores) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: `result must be one of: ${Object.keys(RESULT_SCORES).join(', ')}`
      });
    }

    const existing = await query(
      'SELECT fixture_id FROM fixture_load WHERE fixture_id = $1',
      [fixture_id]
    );

    if (existing.rows.length === 0) {
      return res.json({
        return_code: 'FIXTURE_NOT_FOUND',
        message: 'That fixture is not in the staging table'
      });
    }

    await query(`
      UPDATE fixture_load
      SET home_score = $1,
          away_score = $2
      WHERE fixture_id = $3
    `, [scores.home, scores.away, fixture_id]);

    return res.json({
      return_code: 'SUCCESS',
      fixture_id,
      home_score: scores.home,
      away_score: scores.away,
      result
    });

  } catch (error) {
    console.error('set-staged-result error:', error.message);
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not save the result'
    });
  }
});

module.exports = router;
