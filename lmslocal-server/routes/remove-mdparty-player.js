/*
=======================================================================================================================================
API Route: remove-mdparty-player
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
- The host cannot remove themselves; ending the game is end-mdparty-game (§10: the host leaving ends it).
- The row is kept with removed_at set; their token stops working and they drop out of every table.
- The round is never locked here: kicking off is the host's (lock-mdparty-round). If everyone left
  has sent a coupon, the host's screen now offers Kick off.
=======================================================================================================================================
*/

const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const party = require('../services/mdParty');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  logApiCall('remove-mdparty-player');
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
      return null;
    });
    return res.json(result);
  } catch (error) {
    console.error('remove-mdparty-player error:', error);
    return res.json({ return_code: 'SERVER_ERROR', message: 'Failed to remove the player' });
  }
});

module.exports = router;
