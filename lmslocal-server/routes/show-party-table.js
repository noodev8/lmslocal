/*
=======================================================================================================================================
API Route: show-party-table
=======================================================================================================================================
Method: POST
Purpose: The host moves the room on from the vidiprinter to the tables (docs/matchday-party.md §5,
         step 7): the teams' table and the players' table, with this round's points.
=======================================================================================================================================
Request Payload:
{
  "code": "KXBRT"                      // string, required
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "room": { "state": "table", "current_round": 2, "version": 24 }
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
"INVALID_STATE"     - the room is not showing a reveal
"SERVER_ERROR"      - unexpected server error
=======================================================================================================================================
Business Logic:
- The reveal's length is the TV's business (§6). The server only records that the host has moved on,
  so every screen changes together.
=======================================================================================================================================
*/

const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const party = require('../services/party');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  logApiCall('show-party-table');
  try {
    const result = await party.hostAction(req.user.id, req.body.code, ['revealing'], async (client, room) => {
      await client.query(`UPDATE mdparty_room SET state = 'table', version = version + 1 WHERE id = $1`, [room.id]);
      return null;
    });
    return res.json(result);
  } catch (error) {
    console.error('show-party-table error:', error);
    return res.json({ return_code: 'SERVER_ERROR', message: 'Failed to show the table' });
  }
});

module.exports = router;
