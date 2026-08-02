/*
=======================================================================================================================================
API Route: get-staged-results
=======================================================================================================================================
Method: GET
Purpose: The next batch of staged fixtures needing a result, for the results screen in
         lmslocal-admin.

         Replaces the old /admin-get-fixtures-for-results, which was gated by the hardcoded
         string '12221' and hardwired to team_list_id 1.

         Results are worked oldest first: the lowest gameweek still missing scores is the one
         served, and it stays served until every fixture in it has a result. That ordering is
         what stops a half-resulted gameweek being left behind while a later one is filled in.
=======================================================================================================================================
Request Payload:
  None (GET). Query string:
    ?team_list_id=1   - integer, required

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "gameweek": 4,                             // integer or null when nothing is pending
  "fixtures": [
    {
      "fixture_id": 123,                     // integer, fixture_load.fixture_id
      "home_team_short": "ARS",              // string
      "away_team_short": "CHE",              // string
      "home_team_name": "Arsenal",           // string, resolved from the team table
      "away_team_name": "Chelsea",           // string, resolved from the team table
      "kickoff_time": "2026-08-21T18:30:00.000Z"  // string, ISO datetime
    }
  ],
  "total_fixtures": 10,                      // integer, fixtures in this gameweek
  "remaining_fixtures": 3,                   // integer, still without a result
  "pushed_to_competitions": 4,               // integer, competitions holding a round from this gameweek
  "pending_gameweeks": [                     // array, every gameweek still awaiting results, oldest first
    { "gameweek": 4, "remaining": 3, "first_kickoff": "2026-08-21T18:30:00.000Z" }
  ]
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
- pushed_to_competitions counts competitions with a fixture carrying this gameweek. Zero means
  entering results here will change nothing downstream - the gameweek was staged but never
  pushed, so no round exists to receive them. Surfaced so that state is visible rather than
  silently jamming the front of the queue.
- pending_gameweeks lets the screen show what is behind the current one without a second call.
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

    // Every gameweek still missing at least one score, oldest first. The first row is the one
    // being worked on; the rest are what the screen shows as queued behind it.
    const pendingResult = await query(`
      SELECT
        gameweek,
        COUNT(*) FILTER (WHERE home_score IS NULL OR away_score IS NULL) AS remaining,
        MIN(kickoff_time)                                                AS first_kickoff
      FROM fixture_load
      WHERE team_list_id = $1
      GROUP BY gameweek
      HAVING COUNT(*) FILTER (WHERE home_score IS NULL OR away_score IS NULL) > 0
      ORDER BY gameweek
    `, [teamListId]);

    const pendingGameweeks = pendingResult.rows.map((row) => ({
      gameweek: row.gameweek,
      remaining: parseInt(row.remaining, 10) || 0,
      first_kickoff: row.first_kickoff
    }));

    if (pendingGameweeks.length === 0) {
      return res.json({
        return_code: 'SUCCESS',
        gameweek: null,
        fixtures: [],
        total_fixtures: 0,
        remaining_fixtures: 0,
        pushed_to_competitions: 0,
        pending_gameweeks: []
      });
    }

    const currentGameweek = pendingGameweeks[0].gameweek;

    // The fixtures themselves, with full team names joined from the master list.
    const fixturesResult = await query(`
      SELECT
        fl.fixture_id,
        fl.home_team_short,
        fl.away_team_short,
        COALESCE(home.name, fl.home_team_short) AS home_team_name,
        COALESCE(away.name, fl.away_team_short) AS away_team_name,
        fl.kickoff_time
      FROM fixture_load fl
      LEFT JOIN team home
        ON home.team_list_id = fl.team_list_id AND home.short_name = fl.home_team_short
      LEFT JOIN team away
        ON away.team_list_id = fl.team_list_id AND away.short_name = fl.away_team_short
      WHERE fl.team_list_id = $1
        AND fl.gameweek = $2
        AND (fl.home_score IS NULL OR fl.away_score IS NULL)
      ORDER BY fl.kickoff_time, fl.fixture_id
    `, [teamListId, currentGameweek]);

    // Size of the gameweek, and whether it ever reached a competition.
    //
    // Identity is the team pairing at the same kickoff instant, not the gameweek number.
    // Gameweek numbers are reused across seasons - they restart when fixture_load is emptied,
    // while competition fixtures keep the number they were pushed with - so matching on the
    // number alone counts last season's rounds as though they were this one's.
    const contextResult = await query(`
      SELECT
        (SELECT COUNT(*)
           FROM fixture_load
          WHERE team_list_id = $1 AND gameweek = $2)                    AS total_fixtures,
        (SELECT COUNT(DISTINCT f.competition_id)
           FROM fixture f
           JOIN fixture_load fl
             ON fl.home_team_short = f.home_team_short
            AND fl.away_team_short = f.away_team_short
            AND fl.kickoff_time    = f.kickoff_time
           JOIN competition c ON c.id = f.competition_id
          WHERE fl.team_list_id = $1
            AND fl.gameweek = $2
            AND c.team_list_id = $1)                                    AS pushed_to_competitions
    `, [teamListId, currentGameweek]);

    const context = contextResult.rows[0];

    return res.json({
      return_code: 'SUCCESS',
      gameweek: currentGameweek,
      fixtures: fixturesResult.rows,
      total_fixtures: parseInt(context.total_fixtures, 10) || 0,
      remaining_fixtures: fixturesResult.rows.length,
      pushed_to_competitions: parseInt(context.pushed_to_competitions, 10) || 0,
      pending_gameweeks: pendingGameweeks
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
