/*
=======================================================================================================================================
API Route: get-staged-results
=======================================================================================================================================
Method: GET
Purpose: The currently staged batch of fixtures for a team list, for the results screen in
         lmslocal-admin.

         Replaces the old /admin-get-fixtures-for-results, which was gated by the hardcoded
         string '12221' and hardwired to team_list_id 1.

         Only one batch can ever be pending per team list (add-staged-fixtures refuses a new one
         while fixture_load already holds rows for that list), so this simply returns whatever
         is there - no gameweek selection needed.
=======================================================================================================================================
Request Payload:
  None (GET). Query string:
    ?team_list_id=1   - integer, required

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "fixtures": [
    {
      "fixture_id": 123,                     // integer, fixture_load.fixture_id
      "home_team_short": "ARS",              // string
      "away_team_short": "CHE",              // string
      "home_team_name": "Arsenal",           // string, resolved from the team table
      "away_team_name": "Chelsea",           // string, resolved from the team table
      "kickoff_time": "2026-08-21T18:30:00.000Z", // string, ISO datetime
      "home_score": null,                    // integer or null - null means not yet entered
      "away_score": null                     // integer or null - null means not yet entered
    }
  ],
  "total_fixtures": 10,                      // integer, fixtures in the staged batch
  "remaining_fixtures": 3                    // integer, still without a result
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"          - team_list_id missing or not a number
"UNAUTHORIZED"              - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"             - Admin session has expired
"SERVER_ERROR"              - Database error or unexpected server failure
=======================================================================================================================================
Data Notes:
- Full team names are resolved from the team table rather than a map in the frontend. The old
  results page carried its own hardcoded list, which still named Luton and Sheffield United two
  seasons after they went down.
- fixtures includes every row in the staged batch, not just unresulted ones, so a result already
  entered (but not yet pushed) still shows on reload instead of vanishing - the screen locks
  those rows rather than hiding them.
- An empty fixtures array means nothing is staged for this list - the "everything is done"
  screen in the admin tool, and staging a new batch is allowed again.
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const router = express.Router();

router.get('/', verifyAdminToken, async (req, res) => {
  logApiCall('get-staged-results');

  try {
    const teamListId = parseInt(req.query.team_list_id, 10);

    if (!Number.isInteger(teamListId)) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'team_list_id is required'
      });
    }

    // The staged batch for this list, resulted or not, with full team names joined from the
    // master list.
    const fixturesResult = await query(`
      SELECT
        fl.fixture_id,
        fl.home_team_short,
        fl.away_team_short,
        COALESCE(home.name, fl.home_team_short) AS home_team_name,
        COALESCE(away.name, fl.away_team_short) AS away_team_name,
        fl.kickoff_time,
        fl.home_score,
        fl.away_score
      FROM fixture_load fl
      LEFT JOIN team home
        ON home.team_list_id = fl.team_list_id AND home.short_name = fl.home_team_short
      LEFT JOIN team away
        ON away.team_list_id = fl.team_list_id AND away.short_name = fl.away_team_short
      WHERE fl.team_list_id = $1
      ORDER BY fl.kickoff_time, fl.fixture_id
    `, [teamListId]);

    return res.json({
      return_code: 'SUCCESS',
      fixtures: fixturesResult.rows,
      total_fixtures: fixturesResult.rows.length,
      remaining_fixtures: fixturesResult.rows.filter(
        (f) => f.home_score === null || f.away_score === null
      ).length
    });

  } catch (error) {
    console.error('get-staged-results error:', error.message);
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not load fixtures awaiting results'
    });
  }
});

module.exports = router;
