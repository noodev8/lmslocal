/*
=======================================================================================================================================
API Route: admin/get-email-targets
=======================================================================================================================================
Method: POST
Purpose: Recipient counts for each wired email on the outline. Drives the counts column on the
         admin Emails screen.

Which emails are wired comes from services/emailCatalog.js, so this route never needs editing
when one is added. Unwired rows are simply absent from `counts` rather than reported as zero:
"we cannot work this out yet" and "nobody qualifies" mean very different things to whoever is
about to press send, and 0 would be a lie about the second.

competition_id is required because most emails are competition-scoped, but the platform-wide ones
(Join LMS, News) ignore it - their counts are the same whatever is selected in the picker.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 210                // integer, required - competition to count scoped emails against
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "counts": {
    "pick_reminder": 3,                // integer, one key per wired email; absent = not wired
    "join_lms": 12
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "VALIDATION_ERROR",
  "message": "competition_id is required"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
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
  logApiCall('admin/get-email-targets');

  try {
    const { competition_id } = req.body;

    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'competition_id is required and must be an integer'
      });
    }

    /*
    Sequential rather than Promise.all. These are the heavier queries on the platform - the pick
    reminder candidate query joins four tables across every round - and the screen loads them on
    every competition change. One at a time keeps a page load off the connection pool's limit.
    */
    const counts = {};
    for (const [emailType, entry] of Object.entries(CATALOG)) {
      const candidates = await entry.service.findCandidates(
        entry.scoped ? { competition_id } : {}
      );
      counts[emailType] = candidates.length;
    }

    return res.json({
      return_code: 'SUCCESS',
      counts
    });

  } catch (error) {
    console.error('admin/get-email-targets error:', { error: error.message, stack: error.stack });
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not work out email recipients.'
    });
  }
});

module.exports = router;
