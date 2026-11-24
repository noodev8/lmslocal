/*
=======================================================================================================================================
API Route: set-party-predictions
=======================================================================================================================================
Method: POST
Purpose: A player sends their coupon for the current round of a Matchday Party (docs/matchday-party.md
         §5, step 4): the winner they predict for each match, all at once. When the last player still
         in the room has sent theirs, the round locks and is played there and then (§2).
=======================================================================================================================================
Request Payload:
{
  "code": "KXBRT",                     // string, required
  "player_token": "Zq3...",            // string, required
  "round": 2,                          // integer, required - the round this coupon is for
  "predictions": [                     // array, required - may be empty: every match left blank
    { "fixture_id": 901, "team_id": 20 }   // team_id is the home or the away team of that fixture
  ]
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "round_locked": true                 // boolean, true if this coupon was the last one and the round has been played
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"        - code, player_token, round or predictions not given
"PARTY_NOT_FOUND"       - no live room with that code
"PLAYER_NOT_FOUND"      - the token holds no place in this room (never joined, or removed).
                          Not UNAUTHORIZED: the web client signs the user out on that code, and a
                          stale room token must not sign anyone out of LMSLocal
"ROUND_CLOSED"          - the room is not taking predictions, or this is not the current round
"INVALID_PREDICTION"    - a fixture not in this round, a team not in its fixture, or a fixture twice
"SERVER_ERROR"          - unexpected server error
=======================================================================================================================================
Business Logic:
- A coupon replaces any earlier one for the round, so a player can change their mind until it locks.
- Winners only: a draw cannot be predicted (§2). A blank is simply a fixture missing from the list.
- The room row is held FOR UPDATE, so of two players sending the last two coupons at once exactly
  one sees everyone submitted and plays the round.
=======================================================================================================================================
*/

const express = require('express');
const { transaction } = require('../database');
const { logApiCall } = require('../utils/apiLogger');
const party = require('../services/party');
const router = express.Router();

router.post('/', async (req, res) => {
  logApiCall('set-party-predictions');
  try {
    const { code, player_token: token, round, predictions } = req.body;
    if (!code || !token || round === undefined || !Array.isArray(predictions)) {
      return res.json({ return_code: 'MISSING_FIELDS', message: 'code, player_token, round and predictions are required' });
    }

    const result = await transaction(async (client) => {
      const room = await party.findRoom(client, code, { forUpdate: true });
      if (!room) return { return_code: 'PARTY_NOT_FOUND', message: 'No game with that code' };

      const player = await party.findPlayer(client, room.id, token);
      if (!player) return { return_code: 'PLAYER_NOT_FOUND', message: 'You are not in this game' };

      if (room.state !== 'open' || Number(round) !== room.current_round) {
        return { return_code: 'ROUND_CLOSED', message: 'This round is no longer taking predictions' };
      }

      const roundRow = (await client.query(
        'SELECT id FROM mdparty_round WHERE room_id = $1 AND round_number = $2',
        [room.id, room.current_round]
      )).rows[0];
      const fixtures = new Map((await client.query(
        'SELECT id, home_team_id, away_team_id FROM mdparty_fixture WHERE round_id = $1',
        [roundRow.id]
      )).rows.map((f) => [f.id, f]));

      const seen = new Set();
      for (const p of predictions) {
        const fixture = fixtures.get(Number(p && p.fixture_id));
        const team = Number(p && p.team_id);
        if (!fixture || seen.has(fixture.id) || (team !== fixture.home_team_id && team !== fixture.away_team_id)) {
          return { return_code: 'INVALID_PREDICTION', message: 'One of those predictions is not a match in this round' };
        }
        seen.add(fixture.id);
      }

      await client.query(
        'DELETE FROM mdparty_prediction WHERE player_id = $1 AND fixture_id = ANY($2::int[])',
        [player.id, [...fixtures.keys()]]
      );
      if (predictions.length > 0) {
        const params = [];
        const values = predictions.map((p) => {
          params.push(Number(p.fixture_id), player.id, Number(p.team_id));
          return `($${params.length - 2}, $${params.length - 1}, $${params.length})`;
        });
        await client.query(
          `INSERT INTO mdparty_prediction (fixture_id, player_id, team_id) VALUES ${values.join(', ')}`,
          params
        );
      }
      await client.query(
        `INSERT INTO mdparty_submission (round_id, player_id) VALUES ($1, $2)
         ON CONFLICT (round_id, player_id) DO UPDATE SET submitted_at = NOW()`,
        [roundRow.id, player.id]
      );
      await party.bumpVersion(client, room.id);

      let roundLocked = false;
      if (await party.everyoneSubmitted(client, room)) {
        await party.lockAndPlayRound(client, room);
        roundLocked = true;
      }
      return { return_code: 'SUCCESS', round_locked: roundLocked };
    });

    return res.json(result);
  } catch (error) {
    console.error('set-party-predictions error:', error);
    return res.json({ return_code: 'SERVER_ERROR', message: 'Failed to send your predictions' });
  }
});

module.exports = router;
