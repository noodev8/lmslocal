/*
=======================================================================================================================================
API Route: lock-party-round
=======================================================================================================================================
Method: POST
Purpose: The host locks the current round without waiting for everyone, and it is played there and
         then (docs/matchday-party.md §2: the host can push things on). Matches a player left blank,
         or never sent, score 0.
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
- The same lock-and-play as the automatic one in set-party-predictions (services/party.js
  lockAndPlayRound). The room row is held FOR UPDATE, so the two can never both play a round.
=======================================================================================================================================
*/

const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const party = require('../services/party');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  logApiCall('lock-party-round');
  try {
    const result = await party.hostAction(req.user.id, req.body.code, ['open'], async (client, room) => {
      await party.lockAndPlayRound(client, room);
      return null;
    });
    return res.json(result);
  } catch (error) {
    console.error('lock-party-round error:', error);
    return res.json({ return_code: 'SERVER_ERROR', message: 'Failed to lock the round' });
  }
});

module.exports = router;
