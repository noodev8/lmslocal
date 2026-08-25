/*
=======================================================================================================================================
API Route: update-fixture-block
=======================================================================================================================================
Method: POST
Purpose: Change a block that has not been promoted yet - its label, whether it opens a gameweek,
         and its fixtures.

         Calendar fixtures are keyed weeks ahead from provisional information, so they move. This
         is how a moved kickoff or a corrected pairing is fixed before the block goes out.
=======================================================================================================================================
Request Payload:
{
  "block_id": 7,                             // integer, required
  "opens_gameweek": true,                    // boolean, optional - default true
  "fixtures": [                              // array, required - replaces the block's fixtures wholesale
    {
      "home_team_short": "ARS",              // string, required
      "away_team_short": "CHE",              // string, required
      "kickoff_time": "2026-08-29T14:00:00.000Z"  // string, required - ISO 8601 UTC
    }
  ]
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "block_id": 7,                             // integer
  "fixtures_added": 10                       // integer, rows now on the block
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
"BLOCK_NOT_FOUND"           - block_id does not exist
"ALREADY_PROMOTED"          - The block has been staged into fixture_load and can no longer change
"UNAUTHORIZED"              - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"             - Admin session has expired
"SERVER_ERROR"              - Database error or unexpected server failure
=======================================================================================================================================
Data Notes:
- Fixtures are REPLACED, not merged. Editing a block is re-keying it, and a merge would need
  stable ids the entry screen does not have.
- A promoted block is frozen. Once it is in fixture_load it is the batch going out, and the
  screen that pushes it reads fixture_load - so editing here would change nothing downstream
  while looking like it had.
- Editing a block that competitions are already sitting on IS allowed, and is the normal case:
  a competition created two weeks ago has round 1 from this block, and a kickoff moving is
  exactly what the reconcile step at promotion time exists to carry through. Their rounds are
  updated when the block is pushed, not here.
=======================================================================================================================================
*/

const express = require('express');
const { transaction } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const { validateFixtures, labelForFixtures, loadBlockContext } = require('../../services/fixtureBlock');
const router = express.Router();

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('update-fixture-block');

  try {
    const { block_id, fixtures } = req.body;
    const opensGameweek = req.body.opens_gameweek !== false;

    // ========================================
    // STEP 1: Shape of the request
    // ========================================
    if (!Number.isInteger(block_id)) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'block_id is required'
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
    // STEP 2: The block must exist and still be editable
    // ========================================
    const context = await loadBlockContext(block_id);

    if (!context) {
      return res.json({
        return_code: 'BLOCK_NOT_FOUND',
        message: 'That block no longer exists'
      });
    }

    if (context.staged_at) {
      return res.json({
        return_code: 'ALREADY_PROMOTED',
        message: 'This block has been staged already. Edit it on the fixtures screen instead.'
      });
    }

    // ========================================
    // STEP 3: Every code a real team in this list, used at most once
    // ========================================
    const check = await validateFixtures(context.team_list_id, fixtures, context.team_list_name);
    if (!check.ok) {
      return res.json({ return_code: 'VALIDATION_ERROR', message: check.message });
    }

    // ========================================
    // STEP 4: Replace in one transaction - a half-replaced block is a broken round
    // ========================================
    await transaction(async (client) => {
      await client.query(`
        UPDATE fixture_block SET label = $1, opens_gameweek = $2 WHERE id = $3
      `, [labelForFixtures(fixtures), opensGameweek, block_id]);

      await client.query('DELETE FROM fixture_block_item WHERE block_id = $1', [block_id]);

      for (const fixture of fixtures) {
        await client.query(`
          INSERT INTO fixture_block_item
            (block_id, home_team_short, away_team_short, kickoff_time)
          VALUES ($1, $2, $3, $4)
        `, [block_id, fixture.home_team_short, fixture.away_team_short, fixture.kickoff_time]);
      }
    });

    return res.json({
      return_code: 'SUCCESS',
      block_id,
      fixtures_added: fixtures.length
    });

  } catch (error) {
    console.error('update-fixture-block error:', error.message);
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not save that block'
    });
  }
});

module.exports = router;
