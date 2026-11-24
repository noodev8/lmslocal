/*
=======================================================================================================================================
API Route: end-mdparty-game
=======================================================================================================================================
Method: POST
Purpose: The host ends the game early (docs/matchday-party.md §10: the host leaving ends the game).
         Every screen moves to the finished state, with the table as it stands.
=======================================================================================================================================
Request Payload:
{
  "code": "KXBRT"                      // string, required
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "room": { "state": "finished", "current_round": 3, "version": 27 }
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
"INVALID_STATE"     - the game has already finished
"SERVER_ERROR"      - unexpected server error
=======================================================================================================================================
Business Logic:
- An open round is NOT played on the way out: ending means stopping, and the table stands as it was
  after the last round played.
- ended_early is set so a screen can say the game was stopped rather than won.
- The room stays readable until it expires, so the final table can still be shown.
=======================================================================================================================================
*/

const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const party = require('../services/mdParty');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  logApiCall('end-mdparty-game');
  try {
    const allowed = ['lobby', 'open', 'revealing', 'table'];
    const result = await party.hostAction(req.user.id, req.body.code, allowed, async (client, room) => {
      await client.query(
        `UPDATE mdparty_room SET state = 'finished', ended_early = TRUE, finished_at = NOW(), version = version + 1
         WHERE id = $1`,
        [room.id]
      );
      return null;
    });
    return res.json(result);
  } catch (error) {
    console.error('end-mdparty-game error:', error);
    return res.json({ return_code: 'SERVER_ERROR', message: 'Failed to end the game' });
  }
});

module.exports = router;
