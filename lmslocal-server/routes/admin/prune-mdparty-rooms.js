/*
=======================================================================================================================================
API Route: prune-mdparty-rooms
=======================================================================================================================================
Method: POST
Purpose: Matchday Party room counts for the admin tool, and the button that deletes expired rooms
         (docs/matchday-party.md §7). The same prune runs nightly as scripts/prune-mdparty-rooms.js.
=======================================================================================================================================
Request Payload:
{
  "dry_run": true                      // boolean, optional - true counts only and deletes nothing (how the page loads)
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "deleted": 3,                        // integer, rooms deleted by this call; 0 on a dry run
  "counts": {                          // after the prune
    "live": 2,                         // integer, rooms not yet expired
    "in_play": 1,                      // integer, live rooms not yet finished
    "expired": 0                       // integer, rooms past expiry and waiting to be pruned
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"UNAUTHORIZED"   - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"  - Admin session has expired
"SERVER_ERROR"   - Database error or unexpected server failure
=======================================================================================================================================
Data Notes:
- Only EXPIRED rooms are deleted (24 hours after creation). A live room, finished or not, is never
  touched, so pressing this mid-game is safe.
- Deleting a room takes its players, rounds, fixtures, coupons and predictions with it (the mdparty_
  foreign keys cascade). mdparty_team is never touched.
=======================================================================================================================================
*/

const express = require('express');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const { roomCounts, pruneExpiredRooms } = require('../../services/mdParty');
const router = express.Router();

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('prune-mdparty-rooms');
  try {
    const deleted = req.body && req.body.dry_run === true ? 0 : await pruneExpiredRooms();
    const counts = await roomCounts();
    return res.json({ return_code: 'SUCCESS', deleted, counts });
  } catch (error) {
    console.error('prune-mdparty-rooms error:', error);
    return res.json({ return_code: 'SERVER_ERROR', message: 'Failed to prune party rooms' });
  }
});

module.exports = router;
