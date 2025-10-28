/*
=======================================================================================================================================
API Route: get-round-statistics
=======================================================================================================================================
Method: POST
Purpose: Fetches enhanced statistics for a completed round including total players, wins, losses, and actual eliminations.
         Distinguishes between players who lost a life vs players who were eliminated from the competition.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,               // integer, required - ID of the competition
  "round_id": 456                      // integer, required - ID of the round
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "round_number": 2,                   // integer, round number
  "statistics": {
    "total_players": 15,               // integer, players who started this round
    "won": 9,                          // integer, players who won (outcome = 'WIN')
    "lost": 6,                         // integer, players who lost (outcome = 'LOSE')
    "eliminated": 2                    // integer, players actually eliminated from competition
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "MISSING_FIELDS",
  "message": "competition_id and round_id are required"
}

{
  "return_code": "NOT_FOUND",
  "message": "Round not found"
}

{
  "return_code": "NO_DATA",
  "message": "No statistics available for this round"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"
"NOT_FOUND"
"NO_DATA"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const router = express.Router();
const { query } = require('../database');
const verifyToken = require('../middleware/verifyToken');

router.post('/', verifyToken, async (req, res) => {
  try {
    const { competition_id, round_id } = req.body;

    // Validate required fields
    if (!competition_id || !round_id) {
      return res.status(200).json({
        return_code: 'MISSING_FIELDS',
        message: 'competition_id and round_id are required'
      });
    }

    // Verify round exists and get round number
    const roundResult = await query(
      `SELECT id, round_number, competition_id
       FROM round
       WHERE id = $1 AND competition_id = $2`,
      [round_id, competition_id]
    );

    if (roundResult.rows.length === 0) {
      return res.status(200).json({
        return_code: 'NOT_FOUND',
        message: 'Round not found'
      });
    }

    const round = roundResult.rows[0];

    // Get enhanced statistics
    const statsResult = await query(
      `SELECT
        COUNT(*) as total_players,
        COUNT(*) FILTER (WHERE pp.outcome = 'WIN') as won,
        COUNT(*) FILTER (WHERE pp.outcome = 'LOSE') as lost,
        COUNT(*) FILTER (WHERE pp.outcome = 'LOSE' AND cu.status = 'out') as eliminated
      FROM player_progress pp
      LEFT JOIN competition_user cu
        ON pp.player_id = cu.user_id
        AND pp.competition_id = cu.competition_id
      WHERE pp.competition_id = $1
        AND pp.round_id = $2`,
      [competition_id, round_id]
    );

    if (statsResult.rows.length === 0 || statsResult.rows[0].total_players === '0') {
      return res.status(200).json({
        return_code: 'NO_DATA',
        message: 'No statistics available for this round'
      });
    }

    const stats = statsResult.rows[0];

    // Return success response
    return res.status(200).json({
      return_code: 'SUCCESS',
      round_number: round.round_number,
      statistics: {
        total_players: parseInt(stats.total_players),
        won: parseInt(stats.won),
        lost: parseInt(stats.lost),
        eliminated: parseInt(stats.eliminated)
      }
    });

  } catch (error) {
    console.error('Error in get-round-statistics:', error);
    return res.status(200).json({
      return_code: 'SERVER_ERROR',
      message: 'An unexpected error occurred'
    });
  }
});

module.exports = router;
