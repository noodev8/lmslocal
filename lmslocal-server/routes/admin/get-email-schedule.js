/*
=======================================================================================================================================
API Route: admin/get-email-schedule
=======================================================================================================================================
Method: POST
Purpose: Which outline emails are sent unattended by the cron, and in which bucket. Read-only, and
         cheap - it reads services/emailCatalog.js and touches no other table.

Separate from /admin/get-email-targets on purpose, even though that route already returns `cron`
alongside its counts.

WHY IT EXISTS. Counts are live candidate queries - the pick reminder's joins four tables across
every round - so the Emails screen deliberately loads none of them until the operator presses
Count on a card. That is right for a count and wrong for a schedule: whether an email goes out on
its own is a fact about configuration, true before anybody asks, and gating it behind a query
meant the screen showed no schedule at all until you ran one. An operator reading that screen
would reasonably conclude nothing was scheduled - the exact wrong answer, arrived at silently.

So this answers the static question with no candidate queries at all, and the screen can call it
on mount for every email at once without paying for eleven candidate scans.

It is NOT a duplicate source. Both routes read the same `cron` field on the same catalog, which is
the same constant scripts/email-sweep.js reads - so the badge on the screen cannot disagree with
what actually runs.
=======================================================================================================================================
Request Payload:
{}                                     // no fields - the whole catalog every time

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "schedule": {
    "empty_comp": {
      "cron": "daily",                 // string or null, the bucket that sends it unattended
      "scoped": true                   // boolean, whether the competition picker applies
    }
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "SERVER_ERROR",
  "message": "Could not read the email schedule."
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"UNAUTHORIZED"
"TOKEN_EXPIRED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const { CATALOG } = require('../../services/emailCatalog');
const { logApiCall } = require('../../utils/apiLogger');

const router = express.Router();

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('admin/get-email-schedule');

  try {
    const schedule = {};

    for (const [emailType, entry] of Object.entries(CATALOG)) {
      schedule[emailType] = {
        cron: entry.cron || null,
        scoped: entry.scoped === true
      };
    }

    return res.json({
      return_code: 'SUCCESS',
      schedule
    });

  } catch (error) {
    console.error('admin/get-email-schedule error:', { error: error.message, stack: error.stack });
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not read the email schedule.'
    });
  }
});

module.exports = router;
