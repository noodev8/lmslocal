/*
=======================================================================================================================================
API Route: admin/broadcast-audience
=======================================================================================================================================
Method: POST
Purpose: How many people an admin broadcast would reach, and a sample of who, before anything is
         sent. Read-only.

Exists so the count on the screen and the count the send uses come from the same function
(services/broadcast.js findRecipients). A broadcast is the one email where "I thought it was going
to about thirty people" is a plausible and expensive mistake, so the number is shown before the
button rather than reported afterwards.

The count is of people NOT opted out, which is usually smaller than the raw membership. That gap
is the point of showing both.
=======================================================================================================================================
Request Payload:
{
  "audience": "all",                   // string, required - "all" or "competition"
  "competition_id": 210                // integer, required when audience is "competition"
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "recipient_count": 187,              // integer, who would actually be emailed
  "total_count": 216,                  // integer, before opt-outs
  "opted_out_count": 29,               // integer, the difference
  "send_cap": 80,                      // integer, how many go out in one press
  "sample": [                          // array, first few recipients for a sanity check
    { "user_id": 50, "display_name": "Andreas", "email": "a@example.com" }
  ]
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "VALIDATION_ERROR",
  "message": "competition_id is required for a competition broadcast"
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
const { query } = require('../../database');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const { findRecipients, AUDIENCES, SEND_CAP } = require('../../services/broadcast');
const { logApiCall } = require('../../utils/apiLogger');

const router = express.Router();

const SAMPLE_SIZE = 5;

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('admin/broadcast-audience');

  try {
    const { audience, competition_id } = req.body;

    if (audience !== AUDIENCES.ALL && audience !== AUDIENCES.COMPETITION) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'audience must be "all" or "competition"'
      });
    }

    if (audience === AUDIENCES.COMPETITION && !Number.isInteger(competition_id)) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'competition_id is required for a competition broadcast'
      });
    }

    const recipients = await findRecipients({ audience, competition_id });

    /*
    The same population without the opt-out clause, so the screen can say "187 of 216" rather than
    just 187. Deliberately a separate count rather than something findRecipients returns: that
    function's job is who may be emailed, and it should not grow a second meaning.
    */
    const totalResult = audience === AUDIENCES.COMPETITION
      ? await query(`
          SELECT COUNT(DISTINCT u.id) AS total
          FROM competition_user cu
          INNER JOIN app_user u ON u.id = cu.user_id
          WHERE cu.competition_id = $1
            AND u.email IS NOT NULL AND u.email != ''
            AND u.email NOT LIKE '%@lms-guest.com'
        `, [competition_id])
      : await query(`
          SELECT COUNT(*) AS total FROM app_user u
          WHERE u.email IS NOT NULL AND u.email != ''
            AND u.email NOT LIKE '%@lms-guest.com'
        `);

    const total = Number(totalResult.rows[0].total) || 0;

    return res.json({
      return_code: 'SUCCESS',
      recipient_count: recipients.length,
      total_count: total,
      opted_out_count: Math.max(total - recipients.length, 0),
      send_cap: SEND_CAP,
      sample: recipients.slice(0, SAMPLE_SIZE).map((r) => ({
        user_id: r.user_id,
        display_name: r.user_display_name,
        email: r.user_email
      }))
    });

  } catch (error) {
    console.error('admin/broadcast-audience error:', { error: error.message, stack: error.stack });
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not work out the audience. Check the server log.'
    });
  }
});

module.exports = router;
