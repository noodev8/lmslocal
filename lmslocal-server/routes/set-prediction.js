/*
=======================================================================================================================================
API Route: set-prediction
=======================================================================================================================================
Method: POST
Purpose: Predict the winner of one fixture in a Matchday round, or change the prediction.
         Matchday only - the Last Man Standing equivalent is set-pick. docs/matchday.md.

         One call per fixture: the card deck sends each card as it is answered, so a player who
         stops halfway keeps what they have done. Changing a prediction updates the row; there is
         never a second one for the same fixture.
=======================================================================================================================================
Request Payload:
{
  "fixture_id": 5012,                       // integer, required - the fixture being predicted
  "team": "ARS"                             // string, required - the home or away team's short code.
                                            //   A draw cannot be predicted (docs/matchday.md §1)
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "prediction": {
    "fixture_id": 5012,                     // integer
    "team": "ARS"                           // string, the team now predicted
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"            - fixture_id not an integer, or team not a string
"FIXTURE_NOT_FOUND"         - No fixture with that id
"FORBIDDEN"                 - Not a Matchday competition, or the caller is not a player in it
"COMPETITION_COMPLETE"      - The game is over
"INVALID_TEAM"              - team is neither side of this fixture
"ROUND_LOCKED"              - The round has locked; predictions can no longer change
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
  logApiCall('set-prediction');

  try {
    const { fixture_id, team } = req.body;
    const userId = req.user.id;

    if (!Number.isInteger(fixture_id) || typeof team !== 'string' || team.trim() === '') {
      return res.json({
        return_code: 'MISSING_FIELDS',
        message: 'fixture_id (integer) and team (string) are required'
      });
    }

    const teamCode = team.trim();

    // Everything the checks need, in one round trip: the fixture, its round's lock, the game,
    // and whether the caller is a player in it.
    const contextResult = await query(`
      SELECT f.id, f.round_id, f.home_team_short, f.away_team_short,
             c.id AS competition_id, c.game_type, c.status,
             cu.user_id AS member_id
      FROM fixture f
      JOIN round r ON r.id = f.round_id
      JOIN competition c ON c.id = r.competition_id
      LEFT JOIN competition_user cu ON cu.competition_id = c.id AND cu.user_id = $2
      WHERE f.id = $1
    `, [fixture_id, userId]);

    if (contextResult.rows.length === 0) {
      return res.json({ return_code: 'FIXTURE_NOT_FOUND', message: 'Fixture not found' });
    }

    const context = contextResult.rows[0];

    if (context.game_type !== 'matchday') {
      return res.json({ return_code: 'FORBIDDEN', message: 'This competition is not a Matchday game' });
    }

    if (context.member_id === null) {
      return res.json({ return_code: 'FORBIDDEN', message: 'You are not a player in this competition' });
    }

    if (String(context.status).toUpperCase() === 'COMPLETE') {
      return res.json({ return_code: 'COMPETITION_COMPLETE', message: 'This game is over' });
    }

    if (teamCode !== context.home_team_short && teamCode !== context.away_team_short) {
      return res.json({ return_code: 'INVALID_TEAM', message: 'Choose the home team or the away team in this fixture' });
    }

    /*
    The lock is checked IN the write, not before it. A separate check-then-insert leaves a gap in
    which the round locks and the prediction still lands - a prediction made after the first
    kickoff. No row back means the round had locked by the time the statement ran.

    lock_time NULL means no lock was ever set, which a pushed round never is; treated as open,
    matching set-pick.
    */
    const writeResult = await query(`
      INSERT INTO prediction (competition_id, round_id, fixture_id, user_id, team)
      SELECT $1, $2, $3, $4, $5
      WHERE EXISTS (
        SELECT 1 FROM round r
        WHERE r.id = $2
          AND (r.lock_time IS NULL OR r.lock_time > NOW())
      )
      ON CONFLICT (user_id, fixture_id)
      DO UPDATE SET team = EXCLUDED.team, updated_at = NOW()
      RETURNING fixture_id, team
    `, [context.competition_id, context.round_id, fixture_id, userId, teamCode]);

    if (writeResult.rows.length === 0) {
      return res.json({ return_code: 'ROUND_LOCKED', message: 'This round has locked' });
    }

    return res.json({
      return_code: 'SUCCESS',
      prediction: writeResult.rows[0]
    });

  } catch (error) {
    console.error('set-prediction error:', error);
    return res.json({ return_code: 'SERVER_ERROR', message: 'Internal server error' });
  }
});

module.exports = router;
