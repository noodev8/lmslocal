/*
=======================================================================================================================================
API Route: impersonate-organiser
=======================================================================================================================================
Method: POST
Purpose: Mint a short-lived, ordinary player-scoped JWT for a competition's organiser so an
         admin can open the player app "as" them - for tracking down what a competition
         actually looks like without needing the master password or a second browser.

         The returned token is a normal player login token (same secret as /login) - it is not
         admin-scoped and carries no record of WHO requested it. It just expires fast, and
         carries an "impersonated" claim so the server can tell it is not the account holder.
         This is an internal convenience tool, not an audited support-impersonation feature; do
         not present it as one.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123                    // integer, required
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "token": "eyJhbGciOiJIUzI1NiIs...",      // string, normal JWT_SECRET-signed token, expires in 1 hour
  "user": {
    "id": 45,                              // integer, organiser's app_user id
    "email": "landlord@pub.com",           // string
    "display_name": "Dave"                 // string
  },
  "competition_id": 123                    // integer, echoed back so the caller can deep-link
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"COMPETITION_NOT_FOUND"
"NO_ORGANISER"              - Competition has no organiser account to impersonate (e.g. removed)
"UNAUTHORIZED"              - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"             - Admin session has expired
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const jwt = require('jsonwebtoken');
const { query } = require('../../database');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const { logApiCall } = require('../../utils/apiLogger');
const router = express.Router();

// Deliberately short - this token is meant for "click, look, done", not a working session
const IMPERSONATION_TOKEN_EXPIRES_IN = '1h';

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('impersonate-organiser');

  try {
    const { competition_id } = req.body;

    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'Competition ID is required and must be a valid integer'
      });
    }

    const result = await query(`
      SELECT u.id, u.email, u.display_name
      FROM competition c
      LEFT JOIN app_user u ON u.id = c.organiser_id
      WHERE c.id = $1
    `, [competition_id]);

    if (result.rows.length === 0) {
      return res.json({
        return_code: 'COMPETITION_NOT_FOUND',
        message: 'Competition not found'
      });
    }

    const organiser = result.rows[0];

    if (!organiser.id) {
      return res.json({
        return_code: 'NO_ORGANISER',
        message: 'This competition has no organiser account to view as'
      });
    }

    // Same payload shape as /login - the player app cannot tell this apart from a real login,
    // which is the point, plus one claim that the SERVER reads.
    //
    // "impersonated" is the documented exception to keeping the token to user_id/email/
    // display_name (CLAUDE.md). That rule says to fetch anything else from the database, and
    // everything else can be - but where a token came from is a fact about the token, not about
    // the user, so there is nowhere else for it to live. verifyToken reads it to skip the
    // last_active_at touch: without it, an admin clicking "view as organiser" marked that
    // customer as seen today, and the admin organisers screen believed it.
    const token = jwt.sign(
      {
        user_id: organiser.id,
        email: organiser.email,
        display_name: organiser.display_name,
        impersonated: true
      },
      process.env.JWT_SECRET,
      { expiresIn: IMPERSONATION_TOKEN_EXPIRES_IN }
    );

    return res.json({
      return_code: 'SUCCESS',
      token,
      user: {
        id: organiser.id,
        email: organiser.email,
        display_name: organiser.display_name
      },
      competition_id
    });

  } catch (error) {
    console.error('impersonate-organiser error:', error.message);
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not create impersonation token'
    });
  }
});

module.exports = router;
