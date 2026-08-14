/*
=======================================================================================================================================
API Route: delete-fixture-block
=======================================================================================================================================
Method: POST
Purpose: Remove a block from the forward calendar - one keyed by mistake, or a gameweek that is
         no longer happening.
=======================================================================================================================================
Request Payload:
{
  "block_id": 7                              // integer, required
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "block_id": 7                              // integer, the block that was removed
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"          - block_id missing or not an integer
"BLOCK_NOT_FOUND"           - block_id does not exist
"ALREADY_PROMOTED"          - The block has been staged into fixture_load
"COMPETITIONS_BOUND"        - Competitions have their first round from this block
"UNAUTHORIZED"              - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"             - Admin session has expired
"SERVER_ERROR"              - Database error or unexpected server failure
=======================================================================================================================================
Data Notes:
- Two refusals, both protecting something already sent.

  ALREADY_PROMOTED - the block is in fixture_load and being pushed. Deleting the calendar copy
  would not stop it, so the refusal is honest about what deletion can and cannot undo.

  COMPETITIONS_BOUND - a competition's round 1 was created from this block. Those players have
  been shown fixtures and a deadline, and some may have picked. Deleting would strand the round
  with fixtures pointing at nothing. If the gameweek really is off, those competitions need
  moving to another block first - which is a decision, not a cascade.

- fixture_block_item rows go with the block (ON DELETE CASCADE). round.source_block_id is a
  plain reference with no cascade, deliberately: the FK is what makes COMPETITIONS_BOUND
  enforceable at the database level even if this check were somehow skipped.
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const { loadBlockContext } = require('../../services/fixtureBlock');
const router = express.Router();

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('delete-fixture-block');

  try {
    const { block_id } = req.body;

    if (!Number.isInteger(block_id)) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'block_id is required'
      });
    }

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
        message: 'This block has been staged. Clear the staged batch on the fixtures screen instead.'
      });
    }

    if (context.competition_count > 0) {
      return res.json({
        return_code: 'COMPETITIONS_BOUND',
        message: `${context.competition_count} competition${context.competition_count === 1 ? ' has its' : 's have their'} first round on this block. Move ${context.competition_count === 1 ? 'it' : 'them'} before deleting it.`
      });
    }

    // Items go with it - fixture_block_item is ON DELETE CASCADE.
    await query('DELETE FROM fixture_block WHERE id = $1', [block_id]);

    return res.json({
      return_code: 'SUCCESS',
      block_id
    });

  } catch (error) {
    console.error('delete-fixture-block error:', error.message);
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not delete that block'
    });
  }
});

module.exports = router;
