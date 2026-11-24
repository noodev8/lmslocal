/*
=======================================================================================================================================
API Route: remove-party-player
=======================================================================================================================================
Method: POST
Purpose: The host removes a player from the room (docs/matchday-party.md §8: names are shown on a TV,
         and someone may leave early). Their name goes from the TV and the tables, and the round no
         longer waits for them.
=======================================================================================================================================
Request Payload:
{
  "code": "KXBRT",                     // string, required
  "player_id": 42                      // integer, required
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "room": { "state": "open", "current_round": 2, "version": 26 },
  "round_locked": false                // boolean, true if everyone left had already sent a coupon, so the round was played
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"      - code or player_id not given
"PARTY_NOT_FOUND"     - no live room with that code
"PLAYER_NOT_FOUND"    - no player with that id in this room, or already removed
"UNAUTHORIZED"        - invalid or missing JWT token
"FORBIDDEN"           - the caller is not this room's host, or is trying to remove themselves
"INVALID_STATE"       - the game has finished
"SERVER_ERROR"        - unexpected server error
=======================================================================================================================================
Business Logic:
- The host cannot remove themselves; ending the game is end-party-game (§10: the host leaving ends it).
- The row is kept with removed_at set; their token stops working and they drop out of every table.
- If the round was only waiting for this player, it locks and is played now, as it would have when
  their coupon arrived.
=======================================================================================================================================
*/

const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const party = require('../services/party');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  logApiCall('remove-party-player');
  try {
    const playerId = Number(req.body.player_id);
    if (!req.body.player_id || !Number.isInteger(playerId)) {
      return res.json({ return_code: 'MISSING_FIELDS', message: 'code and player_id are required' });
    }

    const allowed = ['lobby', 'open', 'revealing', 'table'];
    const result = await party.hostAction(req.user.id, req.body.code, allowed, async (client, room) => {
      const target = (await client.query(
        'SELECT id, is_host FROM mdparty_player WHERE id = $1 AND room_id = $2 AND removed_at IS NULL',
        [playerId, room.id]
      )).rows[0];
      if (!target) return { return_code: 'PLAYER_NOT_FOUND', message: 'That player is not in this game' };
      if (target.is_host) return { return_code: 'FORBIDDEN', message: 'The host cannot be removed. End the game instead' };

      await client.query('UPDATE mdparty_player SET removed_at = NOW() WHERE id = $1', [target.id]);
      await party.bumpVersion(client, room.id);

      let roundLocked = false;
      if (room.state === 'open' && await party.everyoneSubmitted(client, room)) {
        await party.lockAndPlayRound(client, room);
        roundLocked = true;
      }
      return { round_locked: roundLocked };
    });
    return res.json(result);
  } catch (error) {
    console.error('remove-party-player error:', error);
    return res.json({ return_code: 'SERVER_ERROR', message: 'Failed to remove the player' });
  }
});

module.exports = router;
