/*
=======================================================================================================================================
API Route: get-join-status
=======================================================================================================================================
Method: POST
Purpose: Tell a signed-in player whether they are already a member of the competition behind a
         given invite code, so the join page can send them straight in instead of showing them a
         Join button for something they have already joined.
=======================================================================================================================================
Request Payload:
{
  "competition_code": "1252"           // string, required - invite code, case-insensitive
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "is_member": true,                   // boolean, whether the caller is in this competition
  "competition_id": 199                // integer|null, id when a competition matched, else null
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"      - Missing or invalid competition_code parameter
"UNAUTHORIZED"          - Invalid or missing JWT
"SERVER_ERROR"          - Database error or unexpected server failure
=======================================================================================================================================
Why this is separate from get-competition-by-code

That route is deliberately unauthenticated and deliberately silent about competitions nobody can
join (§4.3 of docs/player-onboarding.md). Membership is the opposite: it is meaningless without an
identity, and it is only ever disclosed to the person it is about. Folding an optional token into
the public route would put the two concerns in one place and make it easy to leak from the wrong
branch later.

It answers about membership and nothing else. A caller who is not a member learns only that -
never whether the competition has started, is full, or exists at all, all of which stay the public
route's business.
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  logApiCall('get-join-status');

  try {
    const { competition_code } = req.body;
    const user_id = req.user.id;

    if (!competition_code || typeof competition_code !== 'string' || competition_code.trim().length === 0) {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "Competition code is required and must be a non-empty string"
      });
    }

    // Normalised the same way as the other two resolvers, and matching the same expression
    // idx_competition_invite_code indexes.
    const code = competition_code.trim().toUpperCase();

    const result = await query(`
      SELECT c.id AS competition_id,
             (cu.id IS NOT NULL) AS is_member
      FROM   competition c
      LEFT JOIN competition_user cu
             ON cu.competition_id = c.id AND cu.user_id = $2
      WHERE  UPPER(c.invite_code) = $1
      LIMIT  1
    `, [code, user_id]);

    if (result.rows.length === 0) {
      // No competition with that code. Says nothing about why - that is the public route's job.
      return res.status(200).json({
        return_code: "SUCCESS",
        is_member: false,
        competition_id: null
      });
    }

    return res.status(200).json({
      return_code: "SUCCESS",
      is_member: result.rows[0].is_member === true,
      competition_id: result.rows[0].competition_id
    });

  } catch (error) {
    console.error('Error in get-join-status:', error);
    return res.status(200).json({
      return_code: "SERVER_ERROR",
      message: "Unable to check that competition right now. Please try again."
    });
  }
});

module.exports = router;
