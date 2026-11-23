/*
=======================================================================================================================================
API Route: get-matchday-table
=======================================================================================================================================
Method: POST
Purpose: The Matchday league table: every player's position, total and the tie-break figures,
         with the game's ending so the screen can say how far there is to go. Matchday only.

         The figures come from services/matchdayTable.js, the one place totals are calculated -
         the same function the results push uses to decide whether the game is over, so the table
         a player reads is the table the winner was picked from. docs/matchday.md §8.3.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 412                     // integer, required
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "competition": {
    "id": 412,
    "name": "The Crown Matchday",
    "status": "ACTIVE",                     // string - 'COMPLETE' once the game is over
    "end_rule": "points",                   // string, 'points' or 'rounds'
    "end_value": 100,                       // integer, the target or the number of rounds
    "winner_id": null                       // integer or null - null on a shared win too
  },
  "rounds_settled": 4,                      // integer, rounds with every fixture processed
  "latest_round_number": 5,                 // integer or null
  "latest_round_settled": false,            // boolean
  "table": [
    {
      "position": 1,                        // integer - shared when total, wins and predictions tie
      "user_id": 88,
      "display_name": "Sam",
      "total": 34,                          // integer, the sum of settled points (3 / 1 / 0)
      "wins": 10, "draws": 4, "losses": 6,  // integers
      "predictions": 20,                    // integer, settled predictions - the second tie-break
      "provisional": true,                  // boolean, includes a round still being played
      "is_me": false                        // boolean, this row is the caller
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
"MISSING_FIELDS"            - competition_id not an integer
"COMPETITION_NOT_FOUND"     - No competition with that id
"FORBIDDEN"                 - Not a Matchday competition, or the caller neither plays nor organises it
"UNAUTHORIZED"              - Missing or invalid token
"SERVER_ERROR"              - Database or unexpected error
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const { getMatchdayTable } = require('../services/matchdayTable');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  logApiCall('get-matchday-table');

  try {
    const { competition_id } = req.body;
    const userId = req.user.id;

    if (!Number.isInteger(competition_id)) {
      return res.json({ return_code: 'MISSING_FIELDS', message: 'competition_id (integer) is required' });
    }

    const competitionResult = await query(`
      SELECT c.id, c.name, c.status, c.game_type, c.organiser_id, c.end_rule, c.end_value, c.winner_id,
             cu.user_id AS member_id
      FROM competition c
      LEFT JOIN competition_user cu ON cu.competition_id = c.id AND cu.user_id = $2
      WHERE c.id = $1
    `, [competition_id, userId]);

    if (competitionResult.rows.length === 0) {
      return res.json({ return_code: 'COMPETITION_NOT_FOUND', message: 'Competition not found' });
    }

    const competition = competitionResult.rows[0];

    if (competition.game_type !== 'matchday') {
      return res.json({ return_code: 'FORBIDDEN', message: 'This competition is not a Matchday game' });
    }

    if (competition.member_id === null && competition.organiser_id !== userId) {
      return res.json({ return_code: 'FORBIDDEN', message: 'You are not in this competition' });
    }

    const table = await getMatchdayTable(competition_id);

    return res.json({
      return_code: 'SUCCESS',
      competition: {
        id: competition.id,
        name: competition.name,
        status: competition.status,
        end_rule: competition.end_rule,
        end_value: competition.end_value,
        winner_id: competition.winner_id
      },
      rounds_settled: table.rounds_settled,
      latest_round_number: table.latest_round_number,
      latest_round_settled: table.latest_round_settled,
      table: table.rows.map(row => ({ ...row, is_me: row.user_id === userId }))
    });

  } catch (error) {
    console.error('get-matchday-table error:', error);
    return res.json({ return_code: 'SERVER_ERROR', message: 'Internal server error' });
  }
});

module.exports = router;
