/*
=======================================================================================================================================
API Route: get-reset-quote
=======================================================================================================================================
Method: POST
Purpose: What resetting this competition will cost, so the organiser is told the price before the
         button rather than by pressing it. Read-only - nothing is charged here.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 206                    // integer, required - competition being reset
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "cost": 180,                             // integer, places the reset will use (0 = free)
  "balance": 225,                          // integer, organiser's current credit balance
  "affordable": true,                      // boolean, whether balance covers cost
  "chargeable_players": 200,               // integer, members of THIS competition who cost a place
  "free_limit": 20                         // integer, the organiser's free allowance
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"COMPETITION_NOT_FOUND"
"UNAUTHORIZED"
"SERVER_ERROR"
=======================================================================================================================================
Why a reset costs anything:

The product sells places, which are spent. A reset starts the competition again with everyone
still in it, so it is the same event as all of them joining again - and the previous run's places
were spent on the previous run. See docs/reset-billing.md §2.

The quote is ADVISORY, not binding. reset-competition recalculates inside its own transaction and
refuses if the real cost has moved above what was quoted - a player joining between the two must
not commit a price that was never true.
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const { calculateResetCost } = require('../services/resetCost');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  logApiCall('get-reset-quote');

  try {
    const { competition_id } = req.body;
    const user_id = req.user.id;

    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required and must be a valid integer"
      });
    }

    const competitionResult = await query(
      'SELECT id, organiser_id FROM competition WHERE id = $1',
      [competition_id]
    );

    if (competitionResult.rows.length === 0) {
      return res.json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition not found"
      });
    }

    // Only the organiser can reset, so only the organiser is quoted. Anyone else being told what
    // an organiser's balance is would be a leak in its own right.
    if (competitionResult.rows[0].organiser_id !== user_id) {
      return res.json({
        return_code: "UNAUTHORIZED",
        message: "Only the competition organiser can reset this competition"
      });
    }

    // The same calculation reset-competition uses, so the price shown is the price charged.
    const quote = await calculateResetCost({ query }, competition_id, user_id);

    res.json({
      return_code: "SUCCESS",
      cost: quote.cost,
      balance: quote.balance,
      affordable: quote.balance >= quote.cost,
      chargeable_players: quote.here,
      free_limit: quote.freeLimit
    });

  } catch (error) {
    console.error('Get reset quote error:', error);
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;
