/*
=======================================================================================================================================
API Route: reset-password
=======================================================================================================================================
Method: POST
Purpose: Complete password reset process using secure token with atomic transaction safety and comprehensive audit logging
=======================================================================================================================================
Request Payload:
{
  "token": "reset_abc123...",               // string, required - Password reset token from email
  "new_password": "newpassword123"          // string, required - New password (min 6 chars)
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Password reset successfully", // string, success confirmation message
  "reset_completed": {
    "user_id": 123,                         // integer, user database ID
    "email": "user@example.com",            // string, user email for confirmation
    "reset_timestamp": "2025-01-15T10:30:00Z", // string, ISO datetime when reset was completed
    "token_used": "reset_abc...",           // string, truncated token for audit (first 10 chars)
    "password_updated": true                // boolean, confirmation that password was changed
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
"VALIDATION_ERROR"          - Missing token/password or invalid password format
"INVALID_TOKEN"             - Token not found or not a valid reset token
"TOKEN_EXPIRED"             - Reset token has expired (1 hour limit)
"SERVER_ERROR"              - Database error or unexpected server failure
=======================================================================================================================================
Security Features:
- Secure token validation with expiration checking
- bcrypt password hashing with configurable salt rounds
- Single-use token consumption (cleared after use)
- Comprehensive audit trail for password reset completion
- Atomic transaction ensures data consistency
- Token prefix validation (only "reset_" tokens accepted)
=======================================================================================================================================
*/

const express = require('express');
const bcrypt = require('bcrypt');
const { query, transaction } = require('../database'); // Use central database with transaction support
const router = express.Router();

// Token expiration checker utility function
// Checks if a given timestamp is in the past (expired)
const isTokenExpired = (expiresAt) => {
  if (!expiresAt) return true; // No expiration time means expired
  return new Date() > new Date(expiresAt);
};
// POST endpoint with comprehensive validation, atomic transaction safety and security audit logging
router.post('/', async (req, res) => {
  try {
    const { token, new_password } = req.body;
    const clientIp = req.ip || 'Unknown';
    const userAgent = req.get('User-Agent') || 'Unknown';
    const resetTimestamp = new Date();

    // STEP 1: Validate required input parameters with comprehensive checking
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'Reset token is required and must be a valid string'
      });
    }

    if (!new_password || typeof new_password !== 'string' || new_password.trim().length === 0) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'New password is required and must be a valid string'
      });
    }

    // Business Rule: Enforce minimum password length for security
    if (new_password.length < 6) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'New password must be at least 6 characters long'
      });
    }

    // Security validation: Ensure token has correct prefix for reset tokens
    if (!token.startsWith('reset_')) {
      return res.json({
        return_code: 'INVALID_TOKEN',
        message: 'Invalid reset token format'
      });
    }

    // STEP 2: Use transaction wrapper to ensure atomic operations
    // This ensures that either ALL password reset operations succeed or ALL changes are rolled back
    // Critical for password reset where token clearing must be consistent with password update
    const transactionResult = await transaction(async (queryTx) => {

      // Single comprehensive query to get user data and token validation information
      // This provides all necessary information for password reset validation
      const userQuery = `
        SELECT 
          id,
          email,
          display_name,
          auth_token,
          auth_token_expires,
          email_verified,
          is_managed,
          created_at,
          last_active_at,
          -- Account status for logging
          CASE WHEN email_verified = false THEN 'unverified'
               WHEN is_managed = true THEN 'managed'
               ELSE 'active'
          END as account_status
        FROM app_user 
        WHERE auth_token = $1 AND auth_token LIKE 'reset_%'
      `;

      const userResult = await queryTx(userQuery, [token]);

      // Check if token exists and is a valid reset token
      if (userResult.rows.length === 0) {
        // Log failed reset attempt for security monitoring
        await queryTx(`
          INSERT INTO audit_log (action, details, created_at)
          VALUES ($1, $2, $3)
        `, [
          'PASSWORD_RESET_FAILED_INVALID_TOKEN',
          JSON.stringify({
            token_prefix: token.substring(0, 10) + '...', // Log partial token for debugging
            ip: clientIp,
            user_agent: userAgent,
            failure_reason: 'token_not_found',
            attempt_timestamp: resetTimestamp.toISOString()
          }),
          resetTimestamp
        ]);

        throw {
          return_code: 'INVALID_TOKEN',
          message: 'Invalid or expired reset token. Please request a new password reset.'
        };
      }

      const user = userResult.rows[0];

      // STEP 3: Token expiration validation
      if (isTokenExpired(user.auth_token_expires)) {
        // Log expired token attempt for security monitoring
        await queryTx(`
          INSERT INTO audit_log (user_id, action, details, created_at)
          VALUES ($1, $2, $3, $4)
        `, [
          user.id,
          'PASSWORD_RESET_FAILED_TOKEN_EXPIRED',
          JSON.stringify({
            email: user.email,
            token_expired_at: user.auth_token_expires,
            ip: clientIp,
            user_agent: userAgent,
            failure_reason: 'token_expired'
          }),
          resetTimestamp
        ]);

        throw {
          return_code: 'TOKEN_EXPIRED',
          message: 'Reset token has expired. Please request a new password reset link.'
        };
      }

      // STEP 4: Generate secure password hash with configurable salt rounds
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      const hashedPassword = await bcrypt.hash(new_password, saltRounds);

      // STEP 5: Update password and clear reset token atomically
      const updatePasswordQuery = `
        UPDATE app_user 
        SET 
          password_hash = $1,
          auth_token = NULL,
          auth_token_expires = NULL,
          updated_at = NOW()
        WHERE id = $2
        RETURNING id, email, display_name, updated_at
      `;

      const updateResult = await queryTx(updatePasswordQuery, [hashedPassword, user.id]);
      const updatedUser = updateResult.rows[0];

      // STEP 6: Create comprehensive audit log entry for successful password reset
      await queryTx(`
        INSERT INTO audit_log (user_id, action, details, created_at)
        VALUES ($1, $2, $3, $4)
      `, [
        user.id,
        'PASSWORD_RESET_COMPLETED',
        JSON.stringify({
          user: {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            account_status: user.account_status
          },
          reset_info: {
            token_used: token.substring(0, 10) + '...', // Log partial token for audit
            token_expired_at: user.auth_token_expires,
            reset_completed_at: resetTimestamp.toISOString()
          },
          security_info: {
            password_hash_algorithm: 'bcrypt',
            salt_rounds: saltRounds,
            ip: clientIp,
            user_agent: userAgent
          }
        }),
        resetTimestamp
      ]);

      // Return comprehensive success response with reset confirmation details
      return {
        return_code: 'SUCCESS',
        message: 'Password reset successfully',
        reset_completed: {
          user_id: user.id,
          email: user.email,
          reset_timestamp: resetTimestamp.toISOString(),
          token_used: token.substring(0, 10) + '...', // Partial token for confirmation
          password_updated: true
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
    // Note: Never log the actual password or full tokens in error logs
    console.error('Password reset error:', {
      error: error.message,
      stack: error.stack?.substring(0, 500), // Truncate stack trace
      token_prefix: req.body?.token ? req.body.token.substring(0, 10) + '...' : 'not_provided',
      has_password: !!req.body?.new_password, // Boolean only, not the actual password
      password_length: req.body?.new_password?.length || 0, // Length for validation debugging
      ip: req.ip || 'Unknown',
      user_agent: req.get('User-Agent') || 'Unknown',
      timestamp: new Date().toISOString()
    });
    
    // Return standardized server error response with HTTP 200
    return res.json({
      return_code: 'SERVER_ERROR', 
      message: 'Failed to reset password. Please try again later.'
    });
  }
});

module.exports = router;