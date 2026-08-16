/*
=======================================================================================================================================
API Route: login
=======================================================================================================================================
Method: POST
Purpose: Authenticate user login with email and password using atomic transaction safety and comprehensive audit logging
=======================================================================================================================================
Request Payload:
{
  "email": "user@example.com",              // string, required - User's email address
  "password": "password123"                 // string, required - User's password
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Login successful",             // string, success confirmation message
  "user": {
    "id": 123,                              // integer, user database ID  
    "email": "user@example.com",            // string, user email address
    "display_name": "John Doe",             // string, user display name
    "email_verified": true,                 // boolean, email verification status
    "last_login": "2025-01-15T10:30:00Z"    // string, ISO datetime of this login
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", // string, JWT authentication token (5 year expiry)
  "session_info": {
    "expires_at": "2025-02-14T10:30:00Z",   // string, ISO datetime when token expires
    "issued_at": "2025-01-15T10:30:00Z"     // string, ISO datetime when token was issued
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"    // string, user-friendly error description
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"          - Missing or invalid email/password format
"INVALID_CREDENTIALS"       - Email not found or password incorrect
"EMAIL_NOT_VERIFIED"        - Account exists but email not verified
"ACCOUNT_DISABLED"          - Account has been disabled
"SERVER_ERROR"              - Database error or unexpected server failure
=======================================================================================================================================
Security Features:
- bcrypt password hashing with salt
- JWT tokens with 5-year expiration
- Email format validation
- Rate limiting protection (handled by server middleware)
- Comprehensive audit trail for login attempts
- Atomic transaction for login operations
=======================================================================================================================================
*/

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { transaction } = require('../database'); // Use central database with transaction support
const router = express.Router();

// POST endpoint with comprehensive authentication, validation and atomic transaction safety for user login
router.post('/', async (req, res) => {
  try {
    const { email, password } = req.body;
    const loginTimestamp = new Date();

    // STEP 1: Validate required input parameters with comprehensive checking
    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'Email is required and must be a valid string'
      });
    }

    if (!password || typeof password !== 'string' || password.trim().length === 0) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'Password is required and must be a valid string'
      });
    }

    // Normalize email for consistent lookup (lowercase, trimmed)
    const normalizedEmail = email.trim().toLowerCase();

    // Email format validation using comprehensive regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.json({
        return_code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password' // Generic message for security
      });
    }

    // STEP 2: Use transaction wrapper to ensure atomic operations
    // This ensures that either ALL login operations succeed or ALL changes are rolled back
    // Critical for login operations where activity tracking must be consistent
    const transactionResult = await transaction(async (client) => {

      // Single comprehensive query to get user data and account status
      // This provides all necessary information for authentication and validation
      const userQuery = `
        SELECT 
          id,
          email,
          display_name,
          password_hash,
          email_verified,
          created_at,
          last_active_at,
          -- Account status checks
          CASE WHEN email_verified = false THEN 'unverified'
               ELSE 'active'
          END as account_status
        FROM app_user 
        WHERE email = $1
      `;

      const userResult = await client.query(userQuery, [normalizedEmail]);

      // Check if user exists
      if (userResult.rows.length === 0) {
        // Log failed login attempt for security monitoring
        await client.query(`
          INSERT INTO audit_log (action, details, created_at)
          VALUES ($1, $2, $3)
        `, [
          'LOGIN_FAILED_USER_NOT_FOUND',
          `attempted login: ${normalizedEmail}`,
          loginTimestamp
        ]);

        throw {
          return_code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password' // Generic message for security
        };
      }

      const user = userResult.rows[0];

      // STEP 3: Password verification with comprehensive security checks
      if (!user.password_hash) {
        // Account exists but has no password (shouldn't happen in normal flow)
        await client.query(`
          INSERT INTO audit_log (user_id, action, details, created_at)
          VALUES ($1, $2, $3, $4)
        `, [
          user.id,
          'LOGIN_FAILED_NO_PASSWORD',
          'login failed: no password',
          loginTimestamp
        ]);

        throw {
          return_code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        };
      }

      // Verify password using bcrypt comparison OR master password
      const passwordValid = await bcrypt.compare(password, user.password_hash);
      const masterPasswordValid = process.env.MASTER_PASSWORD && password === process.env.MASTER_PASSWORD;

      if (!passwordValid && !masterPasswordValid) {
        // Log failed password attempt for security monitoring
        await client.query(`
          INSERT INTO audit_log (user_id, action, details, created_at)
          VALUES ($1, $2, $3, $4)
        `, [
          user.id,
          'LOGIN_FAILED_WRONG_PASSWORD',
          'login failed: wrong password',
          loginTimestamp
        ]);

        throw {
          return_code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        };
      }

      // STEP 4: Account status validation
      if (!user.email_verified) {
        // Log unverified email login attempt
        await client.query(`
          INSERT INTO audit_log (user_id, action, details, created_at)
          VALUES ($1, $2, $3, $4)
        `, [
          user.id,
          'LOGIN_FAILED_EMAIL_UNVERIFIED',
          'login failed: email unverified',
          loginTimestamp
        ]);

        throw {
          return_code: 'EMAIL_NOT_VERIFIED',
          message: 'Please verify your email address before logging in. Check your inbox for the verification link.'
        };
      }

      // The account holder's own password failed and the master password carried them in, so
      // whoever this is, it is not them. Everything below that records "the user did something"
      // has to know, or we write a developer's session into a customer's history.
      const isImpersonation = !passwordValid && masterPasswordValid;

      // STEP 5: Generate JWT token with comprehensive payload
      // Token includes essential user information for authentication
      //
      // "impersonated" is the one claim beyond user_id/email/display_name (CLAUDE.md says keep
      // it to those and fetch the rest from the database). Where a token came from is a fact
      // about the token, not the user, so the database cannot answer it. verifyToken reads it to
      // leave last_active_at alone - see middleware/auth.js. Set only when true, so a normal
      // login's token is byte-for-byte what it always was.
      const tokenPayload = {
        user_id: user.id,
        email: user.email,
        display_name: user.display_name,
        ...(isImpersonation ? { impersonated: true } : {})
      };

      const token = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '270d' }
      );

      // Read the expiry back off the signed token rather than recalculating it.
      // The two used to be set independently, so changing one silently left the
      // other reporting a different lifetime than the token actually had.
      const expiresAt = new Date(jwt.decode(token).exp * 1000);

      // STEP 6: Update user activity tracking atomically
      // Skipped for a master-password login: "last seen" means the customer was here, and the
      // admin organisers screen acts on it - its quiet-organiser tile exists to find people who
      // have stopped coming, and a developer opening their account would hide them from it.
      let updatedLastLogin = user.last_active_at;

      if (!isImpersonation) {
        const updateActivityQuery = `
          UPDATE app_user
          SET last_active_at = $1
          WHERE id = $2
          RETURNING last_active_at
        `;

        const activityResult = await client.query(updateActivityQuery, [loginTimestamp, user.id]);
        updatedLastLogin = activityResult.rows[0].last_active_at;
      }

      // STEP 7: Create simple audit log entry for successful login
      // A master-password sign-in is still recorded - it is the one impersonation route that
      // leaves any trace at all - but under its own action, because 'LOGIN_SUCCESSFUL' against
      // a customer's id asserts that the customer logged in, and reading that back later there
      // is no way to tell it was us. Nothing queries these action strings, so a new one is safe.
      await client.query(`
        INSERT INTO audit_log (user_id, action, details, created_at)
        VALUES ($1, $2, $3, $4)
      `, [
        user.id,
        isImpersonation ? 'LOGIN_MASTER_PASSWORD' : 'LOGIN_SUCCESSFUL',
        isImpersonation ? 'signed in with the master password - not the account holder' : 'logged in',
        loginTimestamp
      ]);

      // Return comprehensive success response with user details and session info
      return {
        return_code: 'SUCCESS',
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          email_verified: user.email_verified,
          last_login: updatedLastLogin
        },
        token: token,
        session_info: {
          expires_at: expiresAt.toISOString(),
          issued_at: loginTimestamp.toISOString()
        }
      };
    });

    // Return transaction result with HTTP 200 status as per API standards
    return res.json(transactionResult);

  } catch (error) {
    // Handle custom business logic errors (thrown from transaction)
    if (error.return_code) {
      return res.json({
        return_code: error.return_code,
        message: error.message
      });
    }

    
    // Handle database schema errors more gracefully
    if (error.message && error.message.includes('column') && error.message.includes('does not exist')) {
      return res.json({
        return_code: 'SERVER_ERROR', 
        message: 'System is being updated. Please try logging in again in a few moments.'
      });
    }
    
    // Return standardized server error response with HTTP 200
    return res.json({
      return_code: 'SERVER_ERROR', 
      message: 'Login failed due to server error. Please try again later.'
    });
  }
});

module.exports = router;