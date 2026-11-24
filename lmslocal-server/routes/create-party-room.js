/*
=======================================================================================================================================
API Route: create-party-room
=======================================================================================================================================
Method: POST
Purpose: The host sets up a Matchday Party room for one evening (docs/matchday-party.md §5, step 1).
         Returns the room code for the TV and the host's own player token, since the host also plays.
=======================================================================================================================================
Request Payload:
{
  "rounds": 6                          // integer, required - 4, 6 or 8
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "code": "KXBRT",                     // string, the room code to show on the TV
  "player_token": "Zq3...",            // string, the host's player token for this room; keep it on the host's device
  "player_id": 41,                     // integer, the host's player row
  "expires_at": "2026-11-25T20:00:00Z" // string, ISO datetime the room is deleted after
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"   - rounds not given
"INVALID_ROUNDS"   - rounds is not 4, 6 or 8
"UNAUTHORIZED"     - invalid or missing JWT token
"FORBIDDEN"        - this user may not host (preview: PARTY_PREVIEW_HOST_IDS in services/party.js)
"SERVER_ERROR"     - unexpected server error
=======================================================================================================================================
Business Logic:
- The host is a signed-in user; players never need an account (§3).
- One live game per host. Creating a room finishes any other room this host has not finished: a
  host starting a new game has left the old one, and the host leaving ends the game (§10).
- The host's player name is their account display name, cut to the 20-character limit.
- The room is deleted ROOM_LIFETIME_HOURS after creation by scripts/prune-party-rooms.js.
=======================================================================================================================================
*/

const express = require('express');
const { transaction } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const party = require('../services/party');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  logApiCall('create-party-room');
  try {
    const userId = req.user.id;
    const { rounds } = req.body;

    if (rounds === undefined || rounds === null) {
      return res.json({ return_code: 'MISSING_FIELDS', message: 'rounds is required' });
    }
    if (!party.ROUND_OPTIONS.includes(Number(rounds))) {
      return res.json({ return_code: 'INVALID_ROUNDS', message: 'A game is 4, 6 or 8 rounds' });
    }
    if (!party.canHostParty(userId)) {
      return res.json({ return_code: 'FORBIDDEN', message: 'Matchday Party is not open yet' });
    }

    const result = await transaction(async (client) => {
      const user = (await client.query('SELECT display_name FROM app_user WHERE id = $1', [userId])).rows[0];
      if (!user) return { return_code: 'UNAUTHORIZED', message: 'User not found' };

      await client.query(
        `UPDATE party_room SET state = 'finished', ended_early = TRUE, finished_at = NOW(), version = version + 1
         WHERE host_user_id = $1 AND state <> 'finished' AND expires_at > NOW()`,
        [userId]
      );

      // Codes are unique across every stored room, live or expired-but-not-yet-pruned. Checking
      // first rather than catching the unique violation keeps the transaction usable; a clash in
      // the instant between check and insert is not worth a savepoint at this size.
      let code = null;
      for (let attempt = 0; attempt < 10 && !code; attempt++) {
        const candidate = party.newRoomCode();
        const taken = await client.query('SELECT 1 FROM party_room WHERE code = $1', [candidate]);
        if (taken.rows.length === 0) code = candidate;
      }
      if (!code) throw new Error('create-party-room: no free room code after 10 attempts');

      const room = (await client.query(
        `INSERT INTO party_room (code, host_user_id, rounds_total, expires_at)
         VALUES ($1, $2, $3, NOW() + ($4 || ' hours')::interval)
         RETURNING id, code, expires_at`,
        [code, userId, Number(rounds), String(party.ROOM_LIFETIME_HOURS)]
      )).rows[0];

      const name = party.normaliseName(user.display_name) || 'Host';
      const { token, hash } = party.newPlayerToken();
      const player = (await client.query(
        `INSERT INTO party_player (room_id, user_id, display_name, token_hash, is_host)
         VALUES ($1, $2, $3, $4, TRUE) RETURNING id`,
        [room.id, userId, name, hash]
      )).rows[0];

      return {
        return_code: 'SUCCESS',
        code: room.code,
        player_token: token,
        player_id: player.id,
        expires_at: room.expires_at
      };
    });

    return res.json(result);
  } catch (error) {
    console.error('create-party-room error:', error);
    return res.json({ return_code: 'SERVER_ERROR', message: 'Failed to create the game' });
  }
});

module.exports = router;
