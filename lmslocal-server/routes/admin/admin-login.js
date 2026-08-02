/*
=======================================================================================================================================
API Route: admin-login
=======================================================================================================================================
Method: POST
Purpose: Authenticate a platform administrator for the lmslocal-admin tool. Same credentials as
         the normal player login, but a separate door: this route refuses any account without
         is_admin = true and issues a short-lived token signed with JWT_ADMIN_SECRET.
=======================================================================================================================================
Request Payload:
{
  "email": "admin@example.com",             // string, required - administrator email address
  "password": "password123"                 // string, required - account password
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Login successful",            // string, confirmation message
  "admin": {
    "id": 50,                               // integer, app_user id
    "email": "admin@example.com",           // string, email address
    "display_name": "Andreas"               // string, display name
  },
  "token": "eyJhbGciOiJIUzI1NiIs...",       // string, admin-scoped JWT (12h expiry by default)
  "expires_at": "2026-08-02T22:30:00.000Z"  // string, ISO datetime the token stops working
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"    // string, user-friendly error description
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"          - Missing or malformed email/password
"INVALID_CREDENTIALS"       - Email not found, wrong password, or account is not an admin
"SERVER_ERROR"              - Database error or unexpected server failure
=======================================================================================================================================
Security Notes:
- Non-admin accounts get INVALID_CREDENTIALS, not a distinct code. A correct password on a
  non-admin account must not be distinguishable from a wrong one, or this route becomes an
  oracle for "is this address an administrator".
- MASTER_PASSWORD is deliberately NOT honoured here. It exists so support can log in as any
  player during development; accepting it for admin would make it a platform-wide backdoor.
- Every attempt, successful or not, writes to audit_log.
=======================================================================================================================================
*/

const express = require('express');
const bcrypt = require('bcrypt');
const { transaction } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { signAdminToken } = require('../../middleware/admin-auth');
const router = express.Router();

router.post('/', async (req, res) => {
  logApiCall('admin-login');

  try {
    const { email, password } = req.body;
    const attemptedAt = new Date();

    // STEP 1: Validate input
    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'Email is required'
      });
    }

    if (!password || typeof password !== 'string' || password.length === 0) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'Password is required'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Single generic failure used for every rejection below, so that none of them can be
    // told apart by the caller.
    const invalidCredentials = {
      return_code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password'
    };

    const result = await transaction(async (client) => {

      // STEP 2: Look up the account
      const userResult = await client.query(`
        SELECT id, email, display_name, password_hash, is_admin
        FROM app_user
        WHERE email = $1
      `, [normalizedEmail]);

      if (userResult.rows.length === 0) {
        await client.query(`
          INSERT INTO audit_log (action, details, created_at)
          VALUES ($1, $2, $3)
        `, [
          'ADMIN_LOGIN_FAILED_USER_NOT_FOUND',
          `attempted admin login: ${normalizedEmail}`,
          attemptedAt
        ]);
        throw invalidCredentials;
      }

      const user = userResult.rows[0];

      // STEP 3: Verify the password before checking the admin flag.
      // Order matters: checking is_admin first would let an attacker probe which addresses
      // are admins without knowing any password (by timing the bcrypt compare).
      const passwordValid = user.password_hash
        ? await bcrypt.compare(password, user.password_hash)
        : false;

      if (!passwordValid) {
        await client.query(`
          INSERT INTO audit_log (user_id, action, details, created_at)
          VALUES ($1, $2, $3, $4)
        `, [
          user.id,
          'ADMIN_LOGIN_FAILED_WRONG_PASSWORD',
          'admin login failed: wrong password',
          attemptedAt
        ]);
        throw invalidCredentials;
      }

      // STEP 4: Admin flag check. Correct password on a normal account still fails here,
      // and is logged loudly - it means someone with valid credentials probed the admin tool.
      if (user.is_admin !== true) {
        await client.query(`
          INSERT INTO audit_log (user_id, action, details, created_at)
          VALUES ($1, $2, $3, $4)
        `, [
          user.id,
          'ADMIN_LOGIN_DENIED_NOT_ADMIN',
          'admin login denied: valid password but account is not an admin',
          attemptedAt
        ]);
        throw invalidCredentials;
      }

      // STEP 5: Issue the admin-scoped token
      const token = signAdminToken(user);

      // Decode the expiry the signer chose rather than recomputing it here, so the two can
      // never drift apart if ADMIN_TOKEN_EXPIRES_IN changes.
      const expiresAt = new Date(
        JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).exp * 1000
      );

      // STEP 6: Track activity and log the successful sign-in
      await client.query(
        'UPDATE app_user SET last_active_at = $1 WHERE id = $2',
        [attemptedAt, user.id]
      );

      await client.query(`
        INSERT INTO audit_log (user_id, action, details, created_at)
        VALUES ($1, $2, $3, $4)
      `, [
        user.id,
        'ADMIN_LOGIN_SUCCESSFUL',
        'signed in to admin tool',
        attemptedAt
      ]);

      return {
        return_code: 'SUCCESS',
        message: 'Login successful',
        admin: {
          id: user.id,
          email: user.email,
          display_name: user.display_name
        },
        token: token,
        expires_at: expiresAt.toISOString()
      };
    });

    return res.json(result);

  } catch (error) {
    // Business logic rejections thrown from inside the transaction
    if (error.return_code) {
      return res.json({
        return_code: error.return_code,
        message: error.message
      });
    }

    console.error('admin-login error:', error.message);
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Login failed due to a server error. Please try again.'
    });
  }
});

module.exports = router;
