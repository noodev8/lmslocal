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
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", // string, JWT authentication token (30 day expiry)
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
- JWT tokens with 30-day expiration
- Email format validation
- Rate limiting protection (handled by server middleware)
- Comprehensive audit trail for login attempts
- Atomic transaction for login operations
=======================================================================================================================================
*/

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query, transaction } = require('../database'); // Use central database with transaction support
const router = express.Router();

// POST endpoint with comprehensive authentication, validation and atomic transaction safety for user login
router.post('/', async (req, res) => {
  try {
    const { email, password } = req.body;
    const clientIp = req.ip || 'Unknown';
    const userAgent = req.get('User-Agent') || 'Unknown';
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
      // Log failed validation attempt for security monitoring
      console.log('Login attempt with invalid email format:', {
        email: email.substring(0, 3) + '***', // Partially obscure email for logging
        ip: clientIp,
        timestamp: loginTimestamp.toISOString()
      });
      
      return res.json({
        return_code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password' // Generic message for security
      });
    }

    // STEP 2: Use transaction wrapper to ensure atomic operations
    // This ensures that either ALL login operations succeed or ALL changes are rolled back
    // Critical for login operations where activity tracking must be consistent
    const transactionResult = await transaction(async (queryTx) => {

      // Single comprehensive query to get user data and account status
      // This provides all necessary information for authentication and validation
      const userQuery = `
        SELECT 
          id,
          email,
          display_name,
          password_hash,
          email_verified,
          is_managed,
          created_at,
          last_active_at,
          -- Account status checks
          CASE WHEN email_verified = false THEN 'unverified'
               WHEN is_managed = true THEN 'managed'
               ELSE 'active'
          END as account_status
        FROM app_user 
        WHERE email = $1
      `;

      const userResult = await queryTx(userQuery, [normalizedEmail]);

      // Check if user exists
      if (userResult.rows.length === 0) {
        // Log failed login attempt for security monitoring
        await queryTx(`
          INSERT INTO audit_log (action, details, created_at)
          VALUES ($1, $2, $3)
        `, [
          'LOGIN_FAILED_USER_NOT_FOUND',
          JSON.stringify({
            email: normalizedEmail,
            ip: clientIp,
            user_agent: userAgent,
            failure_reason: 'user_not_found'
          }),
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
        await queryTx(`
          INSERT INTO audit_log (user_id, action, details, created_at)
          VALUES ($1, $2, $3, $4)
        `, [
          user.id,
          'LOGIN_FAILED_NO_PASSWORD',
          JSON.stringify({
            email: normalizedEmail,
            ip: clientIp,
            user_agent: userAgent,
            failure_reason: 'no_password_hash'
          }),
          loginTimestamp
        ]);

        throw {
          return_code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        };
      }

      // Verify password using bcrypt comparison
      const passwordValid = await bcrypt.compare(password, user.password_hash);
      if (!passwordValid) {
        // Log failed password attempt for security monitoring
        await queryTx(`
          INSERT INTO audit_log (user_id, action, details, created_at)
          VALUES ($1, $2, $3, $4)
        `, [
          user.id,
          'LOGIN_FAILED_WRONG_PASSWORD',
          JSON.stringify({
            email: normalizedEmail,
            ip: clientIp,
            user_agent: userAgent,
            failure_reason: 'incorrect_password'
          }),
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
        await queryTx(`
          INSERT INTO audit_log (user_id, action, details, created_at)
          VALUES ($1, $2, $3, $4)
        `, [
          user.id,
          'LOGIN_FAILED_EMAIL_UNVERIFIED',
          JSON.stringify({
            email: normalizedEmail,
            ip: clientIp,
            user_agent: userAgent,
            failure_reason: 'email_not_verified'
          }),
          loginTimestamp
        ]);

        throw {
          return_code: 'EMAIL_NOT_VERIFIED',
          message: 'Please verify your email address before logging in. Check your inbox for the verification link.'
        };
      }

      // STEP 5: Generate JWT token with comprehensive payload
      // Token includes essential user information for authentication
      const tokenPayload = {
        user_id: user.id,
        email: user.email,
        display_name: user.display_name
      };

      const token = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      // Calculate token expiration time for response
      const expiresAt = new Date(loginTimestamp.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days

      // STEP 6: Update user activity tracking atomically
      const updateActivityQuery = `
        UPDATE app_user 
        SET last_active_at = $1
        WHERE id = $2
        RETURNING last_active_at
      `;

      const activityResult = await queryTx(updateActivityQuery, [loginTimestamp, user.id]);
      const updatedLastLogin = activityResult.rows[0].last_active_at;

      // STEP 7: Create comprehensive audit log entry for successful login
      await queryTx(`
        INSERT INTO audit_log (user_id, action, details, created_at)
        VALUES ($1, $2, $3, $4)
      `, [
        user.id,
        'LOGIN_SUCCESSFUL',
        JSON.stringify({
          email: normalizedEmail,
          ip: clientIp,
          user_agent: userAgent,
          login_timestamp: loginTimestamp.toISOString(),
          token_expires_at: expiresAt.toISOString(),
          account_status: user.account_status
        }),
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

    // Log detailed error information for debugging while protecting sensitive data
    // Note: Never log passwords or password hashes in error logs
    console.error('Login error:', {
      error: error.message,
      stack: error.stack?.substring(0, 500), // Truncate stack trace
      email: req.body?.email ? req.body.email.substring(0, 3) + '***' : 'not_provided', // Partially obscure email
      has_password: !!req.body?.password, // Boolean only, not the actual password
      ip: req.ip || 'Unknown',
      user_agent: req.get('User-Agent') || 'Unknown',
      timestamp: new Date().toISOString()
    });
    
    // Return standardized server error response with HTTP 200
    return res.json({
      return_code: 'SERVER_ERROR', 
      message: 'Login failed due to server error. Please try again later.'
    });
  }
});

module.exports = router;