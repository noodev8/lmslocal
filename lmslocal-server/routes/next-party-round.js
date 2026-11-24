/*
=======================================================================================================================================
API Route: next-party-round
=======================================================================================================================================
Method: POST
Purpose: The host moves on from the tables: the next round's fixtures are drawn, or after the last
         round the game is finished and the final table stands (docs/matchday-party.md §5, steps 8-9).
=======================================================================================================================================
Request Payload:
{
  "code": "KXBRT"                      // string, required
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "room": { "state": "open", "current_round": 3, "version": 25 }   // or state "finished" after the last round
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"    - code not given
"PARTY_NOT_FOUND"   - no live room with that code
"UNAUTHORIZED"      - invalid or missing JWT token
"FORBIDDEN"         - the caller is not this room's host
"INVALID_STATE"     - the room is not showing the tables
"SERVER_ERROR"      - unexpected server error
=======================================================================================================================================
Business Logic:
- The form and the league-position bonus for the new round come from every round played so far
  (services/partyEngine.js); nothing about them is stored.
=======================================================================================================================================
*/

const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const party = require('../services/party');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  logApiCall('next-party-round');
  try {
    const result = await party.hostAction(req.user.id, req.body.code, ['table'], async (client, room) => {
      if (room.current_round < room.rounds_total) {
        await party.openRound(client, room, room.current_round + 1);
      } else {
        await client.query(
          `UPDATE party_room SET state = 'finished', finished_at = NOW(), version = version + 1 WHERE id = $1`,
          [room.id]
        );
      }
      return null;
    });
    return res.json(result);
  } catch (error) {
    console.error('next-party-round error:', error);
    return res.json({ return_code: 'SERVER_ERROR', message: 'Failed to start the next round' });
  }
});

module.exports = router;
