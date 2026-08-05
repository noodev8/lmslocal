/*
=======================================================================================================================================
API Route: create-bots
=======================================================================================================================================
Method: POST
Purpose: Grow the bot pool. The original 20 were inserted by hand; this is how the next ones
         are added when 20 is no longer enough to fill a competition.

         Bots are shared - the same bot can be in any number of competitions at once - so the
         pool only needs to be as large as the biggest single competition, not the total.
=======================================================================================================================================
Request Payload:
{
  "count": 5                               // integer, required - how many to create (1-20 per call)
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "5 bots created",             // string
  "bots_created": 5,                       // integer
  "pool_size": 25,                         // integer, the whole pool after this call
  "bots": [                                // array, just the new ones
    {
      "id": 902,                           // integer, app_user id
      "display_name": "Bot Uma",           // string
      "email": "bot_uma@lms-guest.com"     // string
    }
  ]
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"  - count missing, not an integer, or outside 1-20
"UNAUTHORIZED"      - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"     - Admin session has expired
"SERVER_ERROR"      - Database error or unexpected server failure
=======================================================================================================================================
Data Notes:
- New accounts get a bcrypt hash of random bytes rather than a null password_hash. Bots are
  never meant to sign in, and the login route compares against the stored hash - a null there
  is a shape nothing else in app_user has.
- email_verified is set true to keep bots out of any "unverified accounts" sweep. It changes
  nothing about email itself: the @lms-guest.com domain is already skipped by every send route.
=======================================================================================================================================
*/

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { query, transaction } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const { BOT_EMAIL_LIKE, nextBotNames } = require('../../services/botPool');
const router = express.Router();

// Per call, not a pool ceiling. Keeps one fat-fingered number from adding hundreds of accounts.
const MAX_PER_CALL = 20;

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('create-bots');

  try {
    const { count } = req.body;

    if (!Number.isInteger(count) || count < 1 || count > MAX_PER_CALL) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: `count must be an integer between 1 and ${MAX_PER_CALL}`
      });
    }

    const existing = await query(
      'SELECT display_name FROM app_user WHERE email LIKE $1',
      [BOT_EMAIL_LIKE]
    );

    const names = nextBotNames(count, existing.rows.map((row) => row.display_name));

    // One hash for all of them. It is a throwaway secret nobody holds, so per-bot hashes would
    // cost a second of bcrypt each to protect nothing.
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);

    const created = [];

    await transaction(async (client) => {
      for (const name of names) {
        const result = await client.query(`
          INSERT INTO app_user (email, display_name, password_hash, email_verified, created_at, updated_at)
          VALUES ($1, $2, $3, true, NOW(), NOW())
          RETURNING id, display_name, email
        `, [name.email, name.display_name, passwordHash]);

        created.push(result.rows[0]);
      }
    });

    const poolSize = await query(
      'SELECT COUNT(*)::int AS total FROM app_user WHERE email LIKE $1',
      [BOT_EMAIL_LIKE]
    );

    return res.json({
      return_code: 'SUCCESS',
      message: `${created.length} bot${created.length === 1 ? '' : 's'} created`,
      bots_created: created.length,
      pool_size: poolSize.rows[0].total,
      bots: created
    });

  } catch (error) {
    console.error('create-bots error:', {
      error: error.message,
      stack: error.stack?.substring(0, 500),
      count: req.body?.count
    });

    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Failed to create bots'
    });
  }
});

module.exports = router;
