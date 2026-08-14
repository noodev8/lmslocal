/*
=======================================================================================================================================
API Route: promote-fixture-block
=======================================================================================================================================
Method: POST
Purpose: Copy a calendar block into fixture_load, making it the batch going out. This is the
         handover point between the two halves of the fixture system.

           fixture_block  --promote-->  fixture_load  --push-->  round + fixture
           (calendar, weeks ahead)      (batch, one at a time)   (per competition)

         Everything downstream of this call is unchanged: push per competition from the fixtures
         screen, then Clear staged batch. See docs/competition-start.md.
=======================================================================================================================================
Request Payload:
{
  "block_id": 7                              // integer, required
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "block_id": 7,                             // integer
  "fixtures_staged": 10,                     // integer, rows written to fixture_load
  "team_list_id": 1,                         // integer, which list's batch this now is
  "lock_time": "2026-08-29T14:00:00Z"        // string, earliest kickoff - the round's lock time
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"          - block_id missing, or the block has no fixtures
"BLOCK_NOT_FOUND"           - block_id does not exist
"ALREADY_PROMOTED"          - This block is already staged
"PENDING_BATCH"             - fixture_load already holds a batch for this team list
"KICKOFF_PASSED"            - The earliest kickoff is in the past
"UNAUTHORIZED"              - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"             - Admin session has expired
"SERVER_ERROR"              - Database error or unexpected server failure
=======================================================================================================================================
Data Notes:
- PENDING_BATCH is the SAME rule add-staged-fixtures enforces, checked in the same place against
  the same table. The calendar deliberately does not relax it: fixture_load may still hold only
  one batch at a time, because a round is one batch and the results screen has no way to tell two
  apart. The calendar removes the need to work around that rule, not the rule.

- KICKOFF_PASSED stops a batch that would create a round locked the moment it arrived, which no
  player could pick in. fixtureService.js enforces the same floor at push time; failing here is
  the earlier and more legible of the two.

- Kickoffs are copied PER FIXTURE. add-staged-fixtures writes one time across a whole batch
  because its form asks for one; a block holds a real 12:30 and a real 15:00 and there is no
  reason to flatten them - players would be shown the wrong time for half the round. The lock
  time is still MIN(kickoff), so the round closes before anything kicks off.

  One knock-on: the results screen unlocks result entry once the earliest kickoff has passed,
  so on a mixed block it opens while later games are still to play. Entry is per fixture and the
  push tolerates a partly-resulted batch, so this is a slightly earlier door rather than a wrong
  one.

- staged_at is stamped in the same transaction as the copy. A block that reached fixture_load but
  was still marked provisional could be promoted twice, which would double every fixture in the
  round.
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const { loadBlockContext } = require('../../services/fixtureBlock');
const router = express.Router();

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('promote-fixture-block');

  try {
    const { block_id } = req.body;

    if (!Number.isInteger(block_id)) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'block_id is required'
      });
    }

    // ========================================
    // STEP 1: The block must exist and not already be out
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
        message: 'This block has already been staged'
      });
    }

    // ========================================
    // STEP 2: One batch at a time - the same rule add-staged-fixtures enforces
    // ========================================
    const pendingResult = await query(
      'SELECT COUNT(*) AS count FROM fixture_load WHERE team_list_id = $1',
      [context.team_list_id]
    );

    if (parseInt(pendingResult.rows[0].count, 10) > 0) {
      return res.json({
        return_code: 'PENDING_BATCH',
        message: `${context.team_list_name} already has a staged batch. Push it to every competition and clear it before staging this one.`
      });
    }

    // ========================================
    // STEP 3: The block must have fixtures, and they must still be ahead of us
    // ========================================
    const itemsResult = await query(`
      SELECT home_team_short, away_team_short, kickoff_time
      FROM fixture_block_item
      WHERE block_id = $1
      ORDER BY kickoff_time
    `, [block_id]);

    if (itemsResult.rows.length === 0) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'That block has no fixtures in it'
      });
    }

    // Ordered by kickoff, so the first row carries the lock time.
    const lockTime = itemsResult.rows[0].kickoff_time;

    if (new Date(lockTime) <= new Date()) {
      return res.json({
        return_code: 'KICKOFF_PASSED',
        message: 'The first kick off in this block has already passed, so it would create a round nobody could pick in.'
      });
    }

    // ========================================
    // STEP 4: Copy into fixture_load and mark the block as gone, together
    // ========================================
    await transaction(async (client) => {
      for (const item of itemsResult.rows) {
        await client.query(`
          INSERT INTO fixture_load
            (team_list_id, league, home_team_short, away_team_short, kickoff_time, opens_gameweek)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          context.team_list_id,
          context.team_list_name,       // league - the list's own name, as add-staged-fixtures does
          item.home_team_short,
          item.away_team_short,
          item.kickoff_time,
          // Carried from the block rather than re-asked. Whoever keyed the block already
          // answered this, and answering it twice invites the two disagreeing.
          context.opens_gameweek
        ]);
      }

      await client.query(
        'UPDATE fixture_block SET staged_at = NOW() WHERE id = $1',
        [block_id]
      );
    });

    return res.json({
      return_code: 'SUCCESS',
      block_id,
      fixtures_staged: itemsResult.rows.length,
      team_list_id: context.team_list_id,
      lock_time: lockTime
    });

  } catch (error) {
    console.error('promote-fixture-block error:', error.message);
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not stage that block'
    });
  }
});

module.exports = router;
