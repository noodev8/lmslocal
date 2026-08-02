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
      "next_gameweek": 4,                      // integer, the gameweek a new batch would be given
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
- next_gameweek is MAX(gameweek) + 1 within that list, which is what add-staged-fixtures will
  assign. It is shown in the UI so the number is never a surprise. Gameweeks do not reset per
  season - emptying fixture_load is what takes the count back to 1.
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
    // Lists, each with the gameweek a new batch would land on.
    const listsResult = await query(`
      SELECT
        tl.id,
        tl.name,
        tl.type,
        tl.season,
        COALESCE(
          (SELECT MAX(fl.gameweek) FROM fixture_load fl WHERE fl.team_list_id = tl.id),
          0
        ) + 1 AS next_gameweek
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
        next_gameweek: parseInt(row.next_gameweek, 10) || 1,
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
