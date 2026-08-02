/*
=======================================================================================================================================
API Route: add-staged-fixtures
=======================================================================================================================================
Method: POST
Purpose: Add a batch of fixtures to the fixture_load staging table, for later distribution to
         every competition subscribed to the fixture service.

         Replaces the old /admin-add-fixtures, which was gated only by the hardcoded string
         '12221' in the request body and hardwired to team_list_id 1 / 'Premier League'.

         One submission is one gameweek. The gameweek number is assigned here rather than by the
         caller, and every fixture in the batch shares a single kickoff time, which becomes the
         lock time of the round this batch eventually creates (see services/fixtureService.js).
         That is why a real football gameweek spread over Friday to Sunday is entered as several
         batches - each becomes its own round with its own deadline.
=======================================================================================================================================
Request Payload:
{
  "team_list_id": 1,                         // integer, required - which team list these belong to
  "kickoff_time": "2026-08-21T18:30:00.000Z",// string, required - ISO 8601 UTC, shared by the whole batch
  "fixtures": [                              // array, required - at least one fixture
    {
      "home_team_short": "ARS",              // string, required - must be a team in this list
      "away_team_short": "CHE"               // string, required - must be a team in this list
    }
  ]
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "fixtures_added": 10,                      // integer, rows written to fixture_load
  "gameweek": 4,                             // integer, gameweek assigned to this batch
  "team_list_name": "English Premier League 2026-27"  // string, for the confirmation message
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"          - Missing fields, unknown team code, repeated team, or team playing itself
"TEAM_LIST_NOT_FOUND"       - team_list_id does not exist or is not active
"UNAUTHORIZED"              - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"             - Admin session has expired
"SERVER_ERROR"              - Database error or unexpected server failure
=======================================================================================================================================
Data Notes:
- Team codes are validated against the chosen list before anything is written. The old route
  accepted any string, so a typo became a fixture that silently never matched a result.
- A team may appear only once per batch. Two fixtures for the same team in one round would give
  a player an unresolvable pick.
- kickoff_time is stored as sent. The client converts UK wall-clock time to UTC, because the
  server may not be running in Europe/London.
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const router = express.Router();

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('add-staged-fixtures');

  try {
    const { team_list_id, kickoff_time, fixtures } = req.body;

    // ========================================
    // STEP 1: Shape of the request
    // ========================================
    if (!Number.isInteger(team_list_id)) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'team_list_id is required'
      });
    }

    if (!kickoff_time || Number.isNaN(Date.parse(kickoff_time))) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'kickoff_time is required and must be a valid ISO 8601 datetime'
      });
    }

    if (!Array.isArray(fixtures) || fixtures.length === 0) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'fixtures must be a non-empty array'
      });
    }

    // ========================================
    // STEP 2: The list must exist and still be in use
    // ========================================
    const listResult = await query(
      'SELECT id, name FROM team_list WHERE id = $1 AND is_active = true',
      [team_list_id]
    );

    if (listResult.rows.length === 0) {
      return res.json({
        return_code: 'TEAM_LIST_NOT_FOUND',
        message: 'That team list does not exist or is no longer active'
      });
    }

    const teamList = listResult.rows[0];

    // ========================================
    // STEP 3: Every code must be a real team in this list, used at most once
    // ========================================
    const teamsResult = await query(
      'SELECT short_name FROM team WHERE team_list_id = $1 AND is_active = true',
      [team_list_id]
    );
    const validShortNames = new Set(teamsResult.rows.map((row) => row.short_name));

    const seen = new Set();
    for (let i = 0; i < fixtures.length; i++) {
      const { home_team_short: home, away_team_short: away } = fixtures[i] || {};

      if (!home || !away) {
        return res.json({
          return_code: 'VALIDATION_ERROR',
          message: `Fixture ${i + 1} is missing a home or away team`
        });
      }

      if (home === away) {
        return res.json({
          return_code: 'VALIDATION_ERROR',
          message: `Fixture ${i + 1} has ${home} playing itself`
        });
      }

      for (const code of [home, away]) {
        if (!validShortNames.has(code)) {
          return res.json({
            return_code: 'VALIDATION_ERROR',
            message: `"${code}" is not a team in ${teamList.name}`
          });
        }
        if (seen.has(code)) {
          return res.json({
            return_code: 'VALIDATION_ERROR',
            message: `${code} appears more than once in this batch`
          });
        }
        seen.add(code);
      }
    }

    // ========================================
    // STEP 4: Assign the gameweek and insert, atomically
    // ========================================
    // The read and the writes share one transaction so two admins submitting at the same
    // moment cannot both be handed the same gameweek number.
    const gameweek = await transaction(async (client) => {
      const gameweekResult = await client.query(
        'SELECT COALESCE(MAX(gameweek), 0) + 1 AS next_gameweek FROM fixture_load WHERE team_list_id = $1',
        [team_list_id]
      );
      const nextGameweek = gameweekResult.rows[0].next_gameweek;

      for (const fixture of fixtures) {
        await client.query(`
          INSERT INTO fixture_load
            (team_list_id, league, home_team_short, away_team_short, kickoff_time, gameweek, results_pushed)
          VALUES ($1, $2, $3, $4, $5, $6, false)
        `, [
          team_list_id,
          teamList.name,                // league - the list's own name, not a hardcoded string
          fixture.home_team_short,
          fixture.away_team_short,
          kickoff_time,
          nextGameweek
        ]);
      }

      return nextGameweek;
    });

    return res.json({
      return_code: 'SUCCESS',
      fixtures_added: fixtures.length,
      gameweek,
      team_list_name: teamList.name
    });

  } catch (error) {
    console.error('add-staged-fixtures error:', error.message);
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not add fixtures'
    });
  }
});

module.exports = router;
