/*
=======================================================================================================================================
API Route: add-staged-fixtures
=======================================================================================================================================
Method: POST
Purpose: Add a batch of fixtures to the fixture_load staging table, for later distribution to
         every competition subscribed to the fixture service.

         Replaces the old /admin-add-fixtures, which was gated only by the hardcoded string
         '12221' in the request body and hardwired to team_list_id 1 / 'Premier League'.

         Only one batch may be pending per team list at a time - fixture_load itself IS the
         pending batch. If it holds any row for this team_list_id, staging is refused until that
         batch is fully resulted and pushed (which empties the table - see
         push-results-to-competitions.js). Every fixture in a batch shares a single kickoff time,
         which becomes the lock time of the round this batch eventually creates (see
         services/fixtureService.js).
=======================================================================================================================================
Request Payload:
{
  "team_list_id": 1,                         // integer, required - which team list these belong to
  "kickoff_time": "2026-08-21T18:30:00.000Z",// string, required - ISO 8601 UTC, shared by the whole batch
  "opens_gameweek": true,                    // boolean, optional - default true; false when this
                                             //   batch continues a gameweek already being pushed
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
"PENDING_BATCH"             - This list already has a staged batch that has not been fully
                              resulted and pushed yet - only one pending batch at a time
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
- opens_gameweek says whether this batch is the START of a gameweek or a later slice of one
  already going out. A real Fri-Sun gameweek is staged as several batches, one round each, so a
  competition that first became eligible on the Saturday would otherwise get a round 1 made of
  Sunday's two matches while everyone else played a full slate. A competition with no rounds yet
  can only start on a batch with this true. Nothing in the data can work this out - kickoff times
  look identical either way - so whoever stages the batch says.
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const { validateFixtures } = require('../../services/fixtureBlock');
const router = express.Router();

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('add-staged-fixtures');

  try {
    const { team_list_id, kickoff_time, fixtures } = req.body;
    // Defaults true: a lone batch IS its own gameweek, which is the ordinary case.
    const opensGameweek = req.body.opens_gameweek !== false;

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
    // STEP 2b: Only one pending batch at a time - fixture_load itself is the pending batch
    // ========================================
    const pendingResult = await query(
      'SELECT COUNT(*) AS count FROM fixture_load WHERE team_list_id = $1',
      [team_list_id]
    );

    if (parseInt(pendingResult.rows[0].count, 10) > 0) {
      return res.json({
        return_code: 'PENDING_BATCH',
        message: `${teamList.name} already has a staged batch that needs results entered and pushed before you can stage another.`
      });
    }

    // ========================================
    // STEP 3: Every code must be a real team in this list, used at most once
    // ========================================
    // Shared with the calendar blocks (services/fixtureBlock.js) so a block cannot pass
    // validation when it is keyed and then fail it when it is promoted into this table.
    const check = await validateFixtures(team_list_id, fixtures, teamList.name);
    if (!check.ok) {
      return res.json({ return_code: 'VALIDATION_ERROR', message: check.message });
    }

    // ========================================
    // STEP 4: Insert the batch
    // ========================================
    await transaction(async (client) => {
      for (const fixture of fixtures) {
        await client.query(`
          INSERT INTO fixture_load
            (team_list_id, league, home_team_short, away_team_short, kickoff_time, opens_gameweek)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          team_list_id,
          teamList.name,                // league - the list's own name, not a hardcoded string
          fixture.home_team_short,
          fixture.away_team_short,
          kickoff_time,
          opensGameweek
        ]);
      }
    });

    return res.json({
      return_code: 'SUCCESS',
      fixtures_added: fixtures.length,
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
