/*
=======================================================================================================================================
API Route: get-round-predictions
=======================================================================================================================================
Method: POST
Purpose: Every player's Matchday predictions for one LOCKED round - who predicted which team on
         each match, and the points once settled. View only. Feeds the who-predicted-what line on
         each card and a player's page off the table (docs/matchday.md §8.6).

         Hidden until the lock, as LMS picks are: before it, a player could copy the leader. So an
         unlocked round is refused, and with no round named the latest LOCKED round is returned,
         not the latest round. Display names only - never emails.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 412,                    // integer, required
  "round_number": 3                         // integer, optional - defaults to the latest locked round
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "round": {                                // object or null - null while no round has locked yet
    "round_number": 3,
    "lock_time": "2026-11-28T12:30:00Z",    // string, ISO
    "latest_locked_round_number": 3         // integer, the newest round that can be viewed
  },
  "fixtures": [
    {
      "fixture_id": 5012,
      "home_team": "Arsenal",  "home_team_short": "ARS",
      "away_team": "Chelsea",  "away_team_short": "CHE",
      "kickoff_time": "2026-11-28T12:30:00Z",
      "result": "ARS",                      // string or null - a team short code or 'DRAW'
      "settled": true                       // boolean, points have been applied for this fixture
    }
  ],
  "players": [                              // every member, predicted or not, by name
    { "user_id": 50, "display_name": "Andreas", "is_me": true }
  ],
  "predictions": [
    { "user_id": 50, "fixture_id": 5012, "team": "ARS", "points": 3 }   // points null until settled
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
"MISSING_FIELDS"            - competition_id not an integer, or round_number given but not an integer
"COMPETITION_NOT_FOUND"     - No competition with that id
"ROUND_NOT_FOUND"           - round_number given and no such round
"FORBIDDEN"                 - Not a Matchday competition, the caller neither plays nor organises it,
                              or the round named has not locked yet
"UNAUTHORIZED"              - Missing or invalid token
"SERVER_ERROR"              - Database or unexpected error
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  logApiCall('get-round-predictions');

  try {
    const { competition_id, round_number } = req.body;
    const userId = req.user.id;
    const roundAsked = Number.isInteger(round_number) ? round_number : null;

    if (!Number.isInteger(competition_id)
        || (round_number !== undefined && round_number !== null && roundAsked === null)) {
      return res.json({
        return_code: 'MISSING_FIELDS',
        message: 'competition_id (integer) is required; round_number must be an integer if given'
      });
    }

    const competitionResult = await query(`
      SELECT c.id, c.game_type, c.organiser_id, cu.user_id AS member_id
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

    // The round asked for (locked or not, so an unlocked one can be refused by name rather than
    // reported missing), or else the latest locked one. Plus the newest locked round number, for
    // the screens' "next round" link.
    const roundResult = await query(`
      SELECT r.id, r.round_number, r.lock_time,
             (r.lock_time IS NOT NULL AND r.lock_time <= NOW()) AS locked,
             (SELECT MAX(round_number) FROM round
              WHERE competition_id = $1 AND lock_time <= NOW()) AS latest_locked_round_number
      FROM round r
      WHERE r.competition_id = $1
        AND ($2::integer IS NOT NULL AND r.round_number = $2::integer
             OR $2::integer IS NULL AND r.lock_time <= NOW())
      ORDER BY r.round_number DESC
      LIMIT 1
    `, [competition_id, roundAsked]);

    if (roundResult.rows.length === 0) {
      if (roundAsked !== null) {
        return res.json({ return_code: 'ROUND_NOT_FOUND', message: 'No such round' });
      }
      // Nothing has locked yet: a normal state for a new competition, not an error.
      return res.json({ return_code: 'SUCCESS', round: null, fixtures: [], players: [], predictions: [] });
    }

    const round = roundResult.rows[0];
    if (!round.locked) {
      return res.json({
        return_code: 'FORBIDDEN',
        message: 'Everyone\'s predictions are shown once the round locks'
      });
    }

    // Three small reads, each one query: the matches, the members, and every prediction on the
    // round. Players x matches is at most a few thousand rows for the biggest competition.
    const [fixturesResult, playersResult, predictionsResult] = await Promise.all([
      query(`
        SELECT f.id AS fixture_id,
               f.home_team, f.home_team_short, f.away_team, f.away_team_short,
               f.kickoff_time, f.result, (f.processed IS NOT NULL) AS settled
        FROM fixture f
        WHERE f.round_id = $1
        ORDER BY f.kickoff_time, f.id
      `, [round.id]),
      // The same name the table shows, so a name on one screen is the name on the other.
      query(`
        SELECT cu.user_id, COALESCE(cu.player_display_name, u.display_name, 'Player') AS display_name
        FROM competition_user cu
        JOIN app_user u ON u.id = cu.user_id
        WHERE cu.competition_id = $1
        ORDER BY LOWER(COALESCE(cu.player_display_name, u.display_name, 'Player')), cu.user_id
      `, [competition_id]),
      query(`
        SELECT p.user_id, p.fixture_id, p.team, p.points
        FROM prediction p
        WHERE p.round_id = $1 AND p.fixture_id IS NOT NULL
      `, [round.id])
    ]);

    return res.json({
      return_code: 'SUCCESS',
      round: {
        round_number: round.round_number,
        lock_time: round.lock_time,
        latest_locked_round_number: round.latest_locked_round_number
      },
      fixtures: fixturesResult.rows,
      players: playersResult.rows.map(row => ({
        user_id: row.user_id,
        display_name: row.display_name,
        is_me: row.user_id === userId
      })),
      predictions: predictionsResult.rows
    });

  } catch (error) {
    console.error('get-round-predictions error:', error);
    return res.json({ return_code: 'SERVER_ERROR', message: 'Internal server error' });
  }
});

module.exports = router;
