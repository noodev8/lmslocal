/*
=======================================================================================================================================
API Route: join-party-room
=======================================================================================================================================
Method: POST
Purpose: A player joins a Matchday Party room with its code and a name (docs/matchday-party.md §5,
         step 2). No account: the response carries a player token for this room only.
=======================================================================================================================================
Request Payload:
{
  "code": "KXBRT",                     // string, required - the room code from the TV
  "name": "Nan"                        // string, required - shown on the TV; up to 20 characters
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "player_token": "Zq3...",            // string, keep it on this device; it is the player's only key to the room
  "player_id": 42,                     // integer
  "name": "Nan"                        // string, the name as stored (tidied and cut to 20 characters)
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"        - code or name not given
"INVALID_NAME"          - nothing usable in the name once tidied
"PARTY_NOT_FOUND"       - no live room with that code
"GAME_ALREADY_STARTED"  - joining closes when the host starts the game (§10: no late joiners)
"ROOM_FULL"             - MAX_PLAYERS already in the room
"NAME_TAKEN"            - somebody in the room already has that name
"RATE_LIMIT_EXCEEDED"   - too many joins from this address (server.js partyJoinLimit)
"SERVER_ERROR"          - unexpected server error
=======================================================================================================================================
Business Logic:
- Public and unauthenticated, like the competition join lookup, so it is rate limited in server.js.
- Names are unique in a room, ignoring case: the TV is how people tell each other apart.
- The room row is locked for the join, so two people cannot take the last place or the same name.
=======================================================================================================================================
*/

const express = require('express');
const { transaction } = require('../database');
const { logApiCall } = require('../utils/apiLogger');
const party = require('../services/party');
const router = express.Router();

router.post('/', async (req, res) => {
  logApiCall('join-party-room');
  try {
    const { code, name: rawName } = req.body;
    if (!code || rawName === undefined || rawName === null) {
      return res.json({ return_code: 'MISSING_FIELDS', message: 'code and name are required' });
    }
    const name = party.normaliseName(rawName);
    if (!name) return res.json({ return_code: 'INVALID_NAME', message: 'Please type a name' });

    const result = await transaction(async (client) => {
      const room = await party.findRoom(client, code, { forUpdate: true });
      if (!room) return { return_code: 'PARTY_NOT_FOUND', message: 'No game with that code. Check the TV' };
      if (room.state !== 'lobby') {
        return { return_code: 'GAME_ALREADY_STARTED', message: 'This game has already started' };
      }

      const players = (await client.query(
        'SELECT LOWER(display_name) AS name FROM mdparty_player WHERE room_id = $1 AND removed_at IS NULL',
        [room.id]
      )).rows;
      if (players.length >= party.MAX_PLAYERS) {
        return { return_code: 'ROOM_FULL', message: `This game already has ${party.MAX_PLAYERS} players` };
      }
      if (players.some((p) => p.name === name.toLowerCase())) {
        return { return_code: 'NAME_TAKEN', message: 'Somebody here already has that name. Try another' };
      }

      const { token, hash } = party.newPlayerToken();
      const player = (await client.query(
        'INSERT INTO mdparty_player (room_id, display_name, token_hash) VALUES ($1, $2, $3) RETURNING id',
        [room.id, name, hash]
      )).rows[0];
      await party.bumpVersion(client, room.id);

      return { return_code: 'SUCCESS', player_token: token, player_id: player.id, name };
    });

    return res.json(result);
  } catch (error) {
    console.error('join-party-room error:', error);
    return res.json({ return_code: 'SERVER_ERROR', message: 'Failed to join the game' });
  }
});

module.exports = router;
