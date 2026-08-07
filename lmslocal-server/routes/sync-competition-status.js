/*
=======================================================================================================================================
API Route: sync-competition-status
=======================================================================================================================================
Method: POST
Purpose: Promote competitions from SETUP to ACTIVE once their Round 1 lock time has passed.
         Machine-invoked nightly; there is no user context.
=======================================================================================================================================
Request Payload:
{}                                     // none

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "promoted_count": 3,                 // number, competitions moved SETUP -> ACTIVE
  "promoted": [                        // array, empty when nothing needed promoting
    {
      "competition_id": 199,           // number
      "name": "Andreas Test Comp",     // string
      "lock_time": "2026-08-08T11:00:00.000Z"  // ISO string, Round 1 lock that had passed
    }
  ]
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "SERVER_ERROR",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"UNAUTHORIZED"
"SERVER_ERROR"
=======================================================================================================================================
Why this exists

competition.status is a stored value that lags reality. It was only ever written when the
organiser loaded their own dashboard (get-user-dashboard.js), so a competition that started
read SETUP until its organiser next signed in - indefinitely, if they never did. Admin
reporting counts by status and undercounted started competitions as a result.

This does NOT make status safe to gate on. The join gate computes the same condition live from
Round 1's lock time and must keep doing so: between a round locking and this route next running,
the column is still wrong. See §4.2 of docs/player-onboarding.md.

The invite code is deliberately left alone. It is the competition's identity for its whole life
and must never be recycled while the competition exists - a reissued code would send people
holding an old poster into a different organiser's competition. See §3.1.
=======================================================================================================================================
*/

const express = require('express');
const router = express.Router();
const { query } = require('../database');
const { logApiCall } = require('../utils/apiLogger');

router.post('/', async (req, res) => {
  logApiCall('sync-competition-status');

  try {
    // One statement: find every SETUP competition whose Round 1 has locked and promote it.
    // Restricting the UPDATE to status = 'SETUP' makes the route idempotent, so a scheduler
    // that fires twice does no extra work and reports nothing the second time.
    const result = await query(`
      UPDATE competition c
      SET    status = 'ACTIVE'
      FROM   round r
      WHERE  r.competition_id = c.id
        AND  r.round_number = 1
        AND  r.lock_time <= CURRENT_TIMESTAMP
        AND  c.status = 'SETUP'
      RETURNING c.id AS competition_id, c.name, r.lock_time
    `);

    const promoted = result.rows.map(row => ({
      competition_id: row.competition_id,
      name: row.name,
      lock_time: row.lock_time
    }));

    return res.status(200).json({
      return_code: "SUCCESS",
      promoted_count: promoted.length,
      promoted
    });

  } catch (error) {
    console.error('sync-competition-status error:', error);

    return res.status(200).json({
      return_code: "SERVER_ERROR",
      message: "Failed to sync competition status"
    });
  }
});

module.exports = router;
