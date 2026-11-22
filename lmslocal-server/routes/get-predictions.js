/*
=======================================================================================================================================
API Route: get-predictions
=======================================================================================================================================
Method: POST
Purpose: A player's Matchday coupon for one round: every fixture, the team they backed (or null
         for skipped), and once results arrive, each fixture's result and the points it scored.
         The coupon is the game's home while a round is open (docs/matchday.md §8.2), so this is
         the screen's one read. Matchday only.

         Other players' predictions are not returned. Seeing them after lock, as LMS shows picks,
         is a later addition and would be a separate field gated on the lock.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 412,                    // integer, required
  "round_number": 3                         // integer, optional - defaults to the latest round
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "competition": {
    "id": 412,
    "name": "The Crown Matchday",
    "status": "ACTIVE",                     // string, competition status
    "end_rule": "points",                   // string, 'points' or 'rounds'
    "end_value": 100                        // integer, the target or the number of rounds
  },
  "is_player": true,                        // boolean, false for an organiser not playing
  "round": {                                // object or null - null before the first round exists
    "id": 901,
    "round_number": 3,
    "lock_time": "2026-11-28T12:30:00Z",    // string, ISO - when predictions close
    "locked": false,                        // boolean, true once lock_time has passed
    "latest": true                          // boolean, this is the competition's latest round
  },
  "fixtures": [
    {
      "fixture_id": 5012,
      "home_team": "Arsenal",  "home_team_short": "ARS",
      "away_team": "Chelsea",  "away_team_short": "CHE",
      "kickoff_time": "2026-11-28T12:30:00Z",
      "result": null,                       // string or null - a team short code or 'DRAW'
      "settled": false,                     // boolean, points have been applied for this fixture
      "my_team": "ARS",                     // string or null - null means skipped
      "my_points": null                     // integer or null - 3, 1, -1 (0 by hand); null until settled
    }
  ],
  "predicted": 7,                           // integer, fixtures this player has backed
  "total_fixtures": 10                      // integer
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
"FORBIDDEN"                 - Not a Matchday competition, or the caller neither plays nor organises it
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
  logApiCall('get-predictions');

  try {
    const { competition_id, round_number } = req.body;
    const userId = req.user.id;

    if (!Number.isInteger(competition_id)
        || (round_number !== undefined && round_number !== null && !Number.isInteger(round_number))) {
      return res.json({
        return_code: 'MISSING_FIELDS',
        message: 'competition_id (integer) is required; round_number must be an integer if given'
      });
    }

    const competitionResult = await query(`
      SELECT c.id, c.name, c.status, c.game_type, c.organiser_id, c.end_rule, c.end_value,
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

    const isPlayer = competition.member_id !== null;
    if (!isPlayer && competition.organiser_id !== userId) {
      return res.json({ return_code: 'FORBIDDEN', message: 'You are not in this competition' });
    }

    // The requested round, or the latest. "latest" is reported so the screen can tell a look
    // back at round 2 from the round being played now.
    const roundResult = await query(`
      SELECT r.id, r.round_number, r.lock_time,
             (r.lock_time IS NOT NULL AND r.lock_time <= NOW()) AS locked,
             r.round_number = (SELECT MAX(round_number) FROM round WHERE competition_id = $1) AS latest
      FROM round r
      WHERE r.competition_id = $1
        AND ($2::integer IS NULL OR r.round_number = $2::integer)
      ORDER BY r.round_number DESC
      LIMIT 1
    `, [competition_id, Number.isInteger(round_number) ? round_number : null]);

    const competitionOut = {
      id: competition.id,
      name: competition.name,
      status: competition.status,
      end_rule: competition.end_rule,
      end_value: competition.end_value
    };

    if (roundResult.rows.length === 0) {
      if (Number.isInteger(round_number)) {
        return res.json({ return_code: 'ROUND_NOT_FOUND', message: 'No such round' });
      }
      // No round yet is a normal state (a competition waiting for its first fixtures), not an
      // error - the screen says so rather than failing.
      return res.json({
        return_code: 'SUCCESS',
        competition: competitionOut,
        is_player: isPlayer,
        round: null,
        fixtures: [],
        predicted: 0,
        total_fixtures: 0
      });
    }

    const round = roundResult.rows[0];

    // Fixtures with this player's prediction on each, in kickoff order. An organiser who is not
    // playing gets the fixtures with every prediction null - user_id cannot match.
    const fixturesResult = await query(`
      SELECT f.id AS fixture_id,
             f.home_team, f.home_team_short, f.away_team, f.away_team_short,
             f.kickoff_time, f.result, (f.processed IS NOT NULL) AS settled,
             p.team AS my_team, p.points AS my_points
      FROM fixture f
      LEFT JOIN prediction p ON p.fixture_id = f.id AND p.user_id = $2
      WHERE f.round_id = $1
      ORDER BY f.kickoff_time, f.id
    `, [round.id, userId]);

    const fixtures = fixturesResult.rows;

    return res.json({
      return_code: 'SUCCESS',
      competition: competitionOut,
      is_player: isPlayer,
      round: {
        id: round.id,
        round_number: round.round_number,
        lock_time: round.lock_time,
        locked: round.locked,
        latest: round.latest
      },
      fixtures,
      predicted: fixtures.filter(fixture => fixture.my_team !== null).length,
      total_fixtures: fixtures.length
    });

  } catch (error) {
    console.error('get-predictions error:', error);
    return res.json({ return_code: 'SERVER_ERROR', message: 'Internal server error' });
  }
});

module.exports = router;
