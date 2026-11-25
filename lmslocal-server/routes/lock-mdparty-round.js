/*
=======================================================================================================================================
API Route: lock-mdparty-round
=======================================================================================================================================
Method: POST
Purpose: KICK OFF. The host locks the current round and it is played there and then; every screen
         starts the reveal from this moment (docs/matchday-party.md §2, §6). The only way a round
         locks: once everyone has sent a coupon the host's screen offers it, and the host can also kick
         off early. Matches a player left blank, or never sent, score 0.
=======================================================================================================================================
Request Payload:
{
  "code": "KXBRT"                      // string, required
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "room": { "state": "revealing", "current_round": 2, "version": 23 }
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
"INVALID_STATE"     - no round is open (it may have locked itself a moment ago)
"SERVER_ERROR"      - unexpected server error
=======================================================================================================================================
Business Logic:
- services/mdParty.js lockAndPlayRound. The room row is held FOR UPDATE, so a double tap plays the
  round once; the second is refused as INVALID_STATE.
=======================================================================================================================================
*/

const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const party = require('../services/mdParty');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  logApiCall('lock-mdparty-round');
  try {
    const result = await party.hostAction(req.user.id, req.body.code, ['open'], async (client, room) => {
      await party.lockAndPlayRound(client, room);
      return null;
    });
    return res.json(result);
  } catch (error) {
    console.error('lock-mdparty-round error:', error);
    return res.json({ return_code: 'SERVER_ERROR', message: 'Failed to lock the round' });
  }
});

module.exports = router;
