/*
=======================================================================================================================================
API Route: add-fixture-block
=======================================================================================================================================
Method: POST
Purpose: Key a block of fixtures into the forward calendar - a future round's worth, weeks ahead
         of it being staged.

         Unlike add-staged-fixtures, there is NO one-at-a-time rule here. Holding several blocks
         at once is the entire point: it is what lets a competition created today be given a real
         round 1 for a Saturday two weeks out. See docs/competition-start.md.
=======================================================================================================================================
Request Payload:
{
  "team_list_id": 1,                         // integer, required - which team list these belong to
  "opens_gameweek": true,                    // boolean, optional - default true
  "fixtures": [                              // array, required - at least one fixture
    {
      "home_team_short": "ARS",              // string, required - must be a team in this list
      "away_team_short": "CHE",              // string, required - must be a team in this list
      "kickoff_time": "2026-08-29T14:00:00.000Z"  // string, required - ISO 8601 UTC, per fixture
    }
  ]
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "block_id": 7,                             // integer, the new fixture_block.id
  "fixtures_added": 10                       // integer, rows written to fixture_block_item
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"          - Missing fields, bad kickoff, unknown team code, repeated team, or
                              a team playing itself
"TEAM_LIST_NOT_FOUND"       - team_list_id does not exist or is not active
"UNAUTHORIZED"              - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"             - Admin session has expired
"SERVER_ERROR"              - Database error or unexpected server failure
=======================================================================================================================================
Data Notes:
- kickoff_time is PER FIXTURE here, where add-staged-fixtures takes one for the whole batch. A
  block is still one round with one lock time - MIN(kickoff) - but a Saturday block genuinely
  holds a 12:30 and a 15:00, and flattening them loses information the player screen can show.
  The lock time is the earliest, so the round still closes before anyone has kicked a ball.
- Kickoffs in the past are refused. A block is a future thing by definition, and one keyed with
  last week's date would offer a start option no competition could ever use.
- Team validation is shared with add-staged-fixtures via services/fixtureBlock.js, so a block
  cannot pass here and then fail when it is promoted.
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const { validateFixtures, labelForFixtures } = require('../../services/fixtureBlock');
const router = express.Router();

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('add-fixture-block');

  try {
    const { team_list_id, fixtures } = req.body;
    // Defaults true: a block is its own gameweek unless told otherwise, the ordinary case.
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

    /*
    No label validation: the label is DERIVED from the fixtures, never sent. See labelForKickoff
    in services/fixtureBlock.js - it was the only part of a start option not taken from the
    fixtures, so a typed one could contradict the kick-off time shown directly beneath it.
    */
    if (!Array.isArray(fixtures) || fixtures.length === 0) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'fixtures must be a non-empty array'
      });
    }

    const now = Date.now();
    for (let i = 0; i < fixtures.length; i++) {
      const kickoff = fixtures[i]?.kickoff_time;
      if (!kickoff || Number.isNaN(Date.parse(kickoff))) {
        return res.json({
          return_code: 'VALIDATION_ERROR',
          message: `Fixture ${i + 1} needs a valid kick off time`
        });
      }
      if (Date.parse(kickoff) <= now) {
        return res.json({
          return_code: 'VALIDATION_ERROR',
          message: `Fixture ${i + 1} kicks off in the past`
        });
      }
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
    // STEP 3: Every code a real team in this list, used at most once
    // ========================================
    const check = await validateFixtures(team_list_id, fixtures, teamList.name);
    if (!check.ok) {
      return res.json({ return_code: 'VALIDATION_ERROR', message: check.message });
    }

    // ========================================
    // STEP 4: Write the block and its fixtures together
    // ========================================
    const blockId = await transaction(async (client) => {
      const blockResult = await client.query(`
        INSERT INTO fixture_block (team_list_id, label, opens_gameweek)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [team_list_id, labelForFixtures(fixtures), opensGameweek]);

      const id = blockResult.rows[0].id;

      for (const fixture of fixtures) {
        await client.query(`
          INSERT INTO fixture_block_item
            (block_id, home_team_short, away_team_short, kickoff_time)
          VALUES ($1, $2, $3, $4)
        `, [id, fixture.home_team_short, fixture.away_team_short, fixture.kickoff_time]);
      }

      return id;
    });

    return res.json({
      return_code: 'SUCCESS',
      block_id: blockId,
      fixtures_added: fixtures.length
    });

  } catch (error) {
    console.error('add-fixture-block error:', error.message);
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not save that block'
    });
  }
});

module.exports = router;
