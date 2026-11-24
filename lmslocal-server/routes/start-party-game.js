/*
=======================================================================================================================================
API Route: start-party-game
=======================================================================================================================================
Method: POST
Purpose: The host starts the game: joining closes and round 1's fixtures are drawn
         (docs/matchday-party.md §5, step 3).
=======================================================================================================================================
Request Payload:
{
  "code": "KXBRT"                      // string, required
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "room": { "state": "open", "current_round": 1, "version": 9 }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"       - code not given
"PARTY_NOT_FOUND"      - no live room with that code
"UNAUTHORIZED"         - invalid or missing JWT token
"FORBIDDEN"            - the caller is not this room's host
"INVALID_STATE"        - the game has already started
"NOT_ENOUGH_PLAYERS"   - fewer than MIN_PLAYERS_TO_START in the room, host included
"SERVER_ERROR"         - unexpected server error
=======================================================================================================================================
Business Logic:
- No late joiners (§10): once started, join-party-room refuses the room.
=======================================================================================================================================
*/

const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const party = require('../services/party');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  logApiCall('start-party-game');
  try {
    const result = await party.hostAction(req.user.id, req.body.code, ['lobby'], async (client, room) => {
      const count = (await client.query(
        'SELECT COUNT(*)::int AS n FROM party_player WHERE room_id = $1 AND removed_at IS NULL',
        [room.id]
      )).rows[0].n;
      if (count < party.MIN_PLAYERS_TO_START) {
        return { return_code: 'NOT_ENOUGH_PLAYERS', message: `A game needs at least ${party.MIN_PLAYERS_TO_START} players` };
      }
      await client.query('UPDATE party_room SET started_at = NOW() WHERE id = $1', [room.id]);
      await party.openRound(client, room, 1);
      return null;
    });
    return res.json(result);
  } catch (error) {
    console.error('start-party-game error:', error);
    return res.json({ return_code: 'SERVER_ERROR', message: 'Failed to start the game' });
  }
});

module.exports = router;
