/*
=======================================================================================================================================
API Route: get-fixture-team-lists
=======================================================================================================================================
Method: GET
Purpose: Team lists and their teams, for the fixture entry screen in lmslocal-admin.

         The player app reads teams through /get-teams, which requires a player JWT. The admin
         tool holds an admin token and nothing else, so it needs its own door rather than an
         is_admin bypass inside the player route.

         Everything comes back in one call. Both lists together are a few dozen rows, so paying
         a second round trip to fetch teams after a list is picked would cost more than it saves.
=======================================================================================================================================
Request Payload:
  None (GET). Authentication is by admin token in the Authorization header.

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "team_lists": [
    {
      "id": 1,                                 // integer, team_list.id
      "name": "English Premier League 2026-27",// string
      "type": "epl",                           // string, e.g. 'epl', 'knockout'
      "season": "2026-27",                     // string, may be null
      "pending_fixtures": false,               // boolean - true blocks staging a new batch
      "pending_cutoff": null,                  // string or null - earliest kickoff of the pending batch
      "teams": [
        {
          "id": 12,                            // integer, team.id
          "name": "Arsenal",                   // string, full name
          "short_name": "ARS"                  // string, code stored on fixtures
        }
      ]
    }
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
"UNAUTHORIZED"              - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"             - Admin session has expired
"SERVER_ERROR"              - Database error or unexpected server failure
=======================================================================================================================================
Data Notes:
- Only team_list.is_active = true lists are returned, and only team.is_active = true teams
  within them. A retired list should not be loadable with fixtures.
- pending_fixtures is true when fixture_load has any row for that team list - only one batch is
  allowed pending at a time, so add-staged-fixtures refuses a new one until this clears (which
  happens when push-results-to-competitions empties the table). Surfaced here so the fixtures
  screen can block staging before the admin fills in a whole batch, rather than rejecting on
  submit.
- pending_cutoff is the earliest kickoff_time among that pending batch's rows (null when there
  is no pending batch) - the deadline the round will lock on the moment it's pushed. Surfaced so
  the fixtures screen can stop the admin pushing a batch whose deadline has already passed,
  which would create a round that's locked before any player can pick.
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const router = express.Router();

router.get('/', verifyAdminToken, async (req, res) => {
  logApiCall('get-fixture-team-lists');

  try {
    // Lists, each with whether they already have a pending (unresolved) staged batch, and its
    // deadline if so.
    const listsResult = await query(`
      SELECT
        tl.id,
        tl.name,
        tl.type,
        tl.season,
        EXISTS (SELECT 1 FROM fixture_load fl WHERE fl.team_list_id = tl.id) AS pending_fixtures,
        (SELECT MIN(fl.kickoff_time) FROM fixture_load fl WHERE fl.team_list_id = tl.id) AS pending_cutoff
      FROM team_list tl
      WHERE tl.is_active = true
      ORDER BY tl.id
    `);

    if (listsResult.rows.length === 0) {
      return res.json({ return_code: 'SUCCESS', team_lists: [] });
    }

    // Teams for all of those lists in one go, then grouped in JS.
    const listIds = listsResult.rows.map((row) => row.id);
    const teamsResult = await query(`
      SELECT id, team_list_id, name, short_name
      FROM team
      WHERE team_list_id = ANY($1::int[])
        AND is_active = true
      ORDER BY name
    `, [listIds]);

    const teamsByList = new Map(listIds.map((id) => [id, []]));
    for (const team of teamsResult.rows) {
      teamsByList.get(team.team_list_id).push({
        id: team.id,
        name: team.name,
        short_name: team.short_name
      });
    }

    return res.json({
      return_code: 'SUCCESS',
      team_lists: listsResult.rows.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        season: row.season,
        pending_fixtures: row.pending_fixtures,
        pending_cutoff: row.pending_cutoff,
        teams: teamsByList.get(row.id) || []
      }))
    });

  } catch (error) {
    console.error('get-fixture-team-lists error:', error.message);
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not load team lists'
    });
  }
});

module.exports = router;
