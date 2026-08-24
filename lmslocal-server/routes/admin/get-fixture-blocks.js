/*
=======================================================================================================================================
API Route: get-fixture-blocks
=======================================================================================================================================
Method: GET
Purpose: The forward fixture calendar for one team list - every block, promoted or not, with its
         fixtures and derived lock time.

         Blocks are what a new competition picks its start date from, and what the operator
         promotes into fixture_load when kickoffs are confirmed. See docs/competition-start.md.
=======================================================================================================================================
Request Payload:
  None (GET). Query string:
    team_list_id=1                           // integer, required

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "blocks": [
    {
      "id": 7,                               // integer, fixture_block.id
      "label": "Sat 29 Aug",                 // string, what an organiser is shown
      "opens_gameweek": true,                // boolean, may a competition start on this block
      "staged_at": null,                     // string or null - promoted into fixture_load when set
      "created_at": "2026-08-14T09:00:00Z",  // string
      "lock_time": "2026-08-29T14:00:00Z",   // string or null - MIN kickoff, null if no fixtures
      "competition_count": 3,                // integer, competitions whose round 1 came from here
      "in_staging": false,                   // boolean, rows still in fixture_load - "out now"
                                             //   rather than staged-and-since-closed
      "fixtures": [
        {
          "id": 41,                          // integer, fixture_block_item.id
          "home_team_short": "ARS",          // string
          "away_team_short": "CHE",          // string
          "home_team_name": "Arsenal",       // string, falls back to the code
          "away_team_name": "Chelsea",       // string, falls back to the code
          "kickoff_time": "2026-08-29T14:00:00Z"  // string
        }
      ]
    }
  ],
  "pending_batch": false                     // boolean, true blocks promoting - fixture_load is busy
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"          - team_list_id missing or not an integer
"TEAM_LIST_NOT_FOUND"       - team_list_id does not exist or is not active
"UNAUTHORIZED"              - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"             - Admin session has expired
"SERVER_ERROR"              - Database error or unexpected server failure
=======================================================================================================================================
Data Notes:
- Promoted blocks (staged_at set) stay in the list rather than disappearing. A block that vanished
  the moment it was promoted would make the screen look like it had lost work, and the record of
  what was sent out is worth keeping in front of whoever sends the next one.
- pending_batch mirrors get-fixture-team-lists.pending_fixtures: fixture_load already holds a
  batch for this list, so promoting another would be refused. Surfaced here so the screen can
  disable the button rather than explain a rejection afterwards.
- lock_time is MIN(kickoff_time) across the block's fixtures, derived not stored - see
  services/fixtureBlock.js.
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const { loadBlocks } = require('../../services/fixtureBlock');
const router = express.Router();

router.get('/', verifyAdminToken, async (req, res) => {
  logApiCall('get-fixture-blocks');

  try {
    const teamListId = parseInt(req.query.team_list_id, 10);

    if (!Number.isInteger(teamListId)) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'team_list_id is required'
      });
    }

    const listResult = await query(
      'SELECT id FROM team_list WHERE id = $1 AND is_active = true',
      [teamListId]
    );

    if (listResult.rows.length === 0) {
      return res.json({
        return_code: 'TEAM_LIST_NOT_FOUND',
        message: 'That team list does not exist or is no longer active'
      });
    }

    const [blocks, pendingResult] = await Promise.all([
      loadBlocks(teamListId),
      query('SELECT EXISTS (SELECT 1 FROM fixture_load WHERE team_list_id = $1) AS pending', [teamListId])
    ]);

    return res.json({
      return_code: 'SUCCESS',
      blocks,
      pending_batch: pendingResult.rows[0].pending
    });

  } catch (error) {
    console.error('get-fixture-blocks error:', error.message);
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not load the fixture calendar'
    });
  }
});

module.exports = router;
