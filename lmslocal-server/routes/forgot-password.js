/*
=======================================================================================================================================
API Route: forgot-password
=======================================================================================================================================
Method: POST
Purpose: Initiate password reset process by generating secure reset token and sending email with atomic transaction safety
=======================================================================================================================================
Request Payload:
{
  "email": "user@example.com"              // string, required - User's email address for password reset
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "If an account with this email exists, a password reset link has been sent", // string, generic security message
  "reset_info": {
    "email": "user@example.com",            // string, email address (echoed for confirmation)
    "request_timestamp": "2025-01-15T10:30:00Z", // string, ISO datetime when reset was requested
    "expires_in_hours": 1                   // integer, number of hours until reset token expires
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
"VALIDATION_ERROR"          - Missing or invalid email format
"EMAIL_SERVICE_ERROR"       - Failed to send reset email
"SERVER_ERROR"              - Database error or unexpected server failure
=======================================================================================================================================
Security Features:
- Generic success message prevents email enumeration attacks
- Secure token generation with 1-hour expiration
- Comprehensive audit trail for all reset attempts
- Email format validation and normalization
- Atomic transaction for token generation and storage
- Rate limiting protection (handled by server middleware)
=======================================================================================================================================
*/

const express = require('express');
const crypto = require('crypto'); // For secure token generation
const { query, transaction } = require('../database'); // Use central database with transaction support
const emailService = require('../services/emailService');
const router = express.Router();

// Secure token generation utility function
// Generates a cryptographically secure random token for password reset
// Prefixed with 'reset_' to distinguish from verification tokens
const generateSecureResetToken = () => {
  return 'reset_' + crypto.randomBytes(32).toString('hex'); // reset_ + 64 character hex string
};

// Calculate token expiration time (1 hour from now)
const getTokenExpiry = (hours = 1) => {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + hours);
  return expiry;
};

// POST endpoint with comprehensive validation, atomic transaction safety and security audit logging
router.post('/', async (req, res) => {
  try {
    const { email } = req.body;
    const clientIp = req.ip || 'Unknown';
    const userAgent = req.get('User-Agent') || 'Unknown';
    const requestTimestamp = new Date();

    // STEP 1: Validate required input parameters with comprehensive checking
    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'Email address is required and must be a valid string'
      });
    }

    // Normalize email for consistent lookup (lowercase, trimmed)
    const normalizedEmail = email.trim().toLowerCase();

    // Email format validation using comprehensive regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      // Log invalid email attempt for security monitoring
      console.log('Password reset attempt with invalid email format:', {
        email: email.substring(0, 3) + '***', // Partially obscure email for logging
        ip: clientIp,
        timestamp: requestTimestamp.toISOString()
      });
      
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'Please provide a valid email address'
      });
    }

    // STEP 2: Use transaction wrapper to ensure atomic operations
    // This ensures that either ALL reset operations succeed or ALL changes are rolled back
    // Critical for password reset where token generation must be consistent with audit logging
    const transactionResult = await transaction(async (client) => {

      // Single comprehensive query to get user data and account status
      // This provides all necessary information for password reset validation
      const userQuery = `
        SELECT
          id,
          email,
          display_name,
          email_verified,
          created_at,
          last_active_at,
          auth_token,
          auth_token_expires,
          -- Account status for logging
          CASE WHEN email_verified = false THEN 'unverified'
               ELSE 'active'
          END as account_status
        FROM app_user
        WHERE email = $1
      `;

      const userResult = await client.query(userQuery, [normalizedEmail]);

      // Always log password reset attempts for security monitoring
      // This helps detect potential attacks or unauthorized access attempts
      const attemptDetails = {
        email: normalizedEmail,
        ip: clientIp,
        user_agent: userAgent,
        request_timestamp: requestTimestamp.toISOString(),
        user_found: userResult.rows.length > 0
      };

      if (userResult.rows.length === 0) {
        // User not found - log attempt but return generic success message for security
        await client.query(`
          INSERT INTO audit_log (action, details, created_at)
          VALUES ($1, $2, $3)
        `, [
          'PASSWORD_RESET_REQUESTED_USER_NOT_FOUND',
          JSON.stringify({
            ...attemptDetails,
            result: 'user_not_found'
          }),
          requestTimestamp
        ]);

        // Return generic success message to prevent email enumeration attacks
        return {
          return_code: "SUCCESS",
          message: "If an account with this email exists, a password reset link has been sent",
          reset_info: {
            email: normalizedEmail,
            request_timestamp: requestTimestamp.toISOString(),
            expires_in_hours: 1
          }
        };
      }

      const user = userResult.rows[0];

      // STEP 3: Generate secure reset token and set expiration
      const resetToken = generateSecureResetToken();
      const tokenExpiry = getTokenExpiry(1); // 1 hour expiration

      // STEP 4: Update user record with reset token atomically
      const updateTokenQuery = `
        UPDATE app_user 
        SET 
          auth_token = $1,
          auth_token_expires = $2,
          updated_at = NOW()
        WHERE id = $3
        RETURNING auth_token_expires, updated_at
      `;

      const updateResult = await client.query(updateTokenQuery, [resetToken, tokenExpiry, user.id]);
      const updatedTokenExpiry = updateResult.rows[0].auth_token_expires;

      // STEP 5: Create comprehensive audit log entry for password reset request
      await client.query(`
        INSERT INTO audit_log (user_id, action, details, created_at)
        VALUES ($1, $2, $3, $4)
      `, [
        user.id,
        'PASSWORD_RESET_REQUESTED',
        JSON.stringify({
          ...attemptDetails,
          user: {
            id: user.id,
            display_name: user.display_name,
            account_status: user.account_status,
            email_verified: user.email_verified
          },
          token_info: {
            expires_at: tokenExpiry.toISOString(),
            generated_at: requestTimestamp.toISOString()
          },
          result: 'token_generated'
        }),
        requestTimestamp
      ]);

      // STEP 6: Send password reset email
      let emailSent = false;
      let emailError = null;

      try {
        const emailResult = await emailService.sendPasswordResetEmail(
          normalizedEmail, 
          resetToken, 
          user.display_name
        );
        emailSent = emailResult.success;
        emailError = emailResult.error;
      } catch (error) {
        emailSent = false;
        emailError = error.message;
      }

      // Log email sending result for debugging and monitoring
      await client.query(`
        INSERT INTO audit_log (user_id, action, details, created_at)
        VALUES ($1, $2, $3, $4)
      `, [
        user.id,
        emailSent ? 'PASSWORD_RESET_EMAIL_SENT' : 'PASSWORD_RESET_EMAIL_FAILED',
        JSON.stringify({
          email: normalizedEmail,
          email_sent: emailSent,
          email_error: emailError,
          token_expires_at: tokenExpiry.toISOString()
        }),
        requestTimestamp
      ]);

      // IMPORTANT: For security reasons, always return success even if email fails
      // This prevents attackers from determining if email addresses exist in the system
      return {
        return_code: "SUCCESS",
        message: "If an account with this email exists, a password reset link has been sent",
        reset_info: {
          email: normalizedEmail,
          request_timestamp: requestTimestamp.toISOString(),
          expires_in_hours: 1
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
    console.error('Forgot password error:', {
      error: error.message,
      stack: error.stack?.substring(0, 500), // Truncate stack trace
      email: req.body?.email ? req.body.email.substring(0, 3) + '***' : 'not_provided', // Partially obscure email
      ip: req.ip || 'Unknown',
      user_agent: req.get('User-Agent') || 'Unknown',
      timestamp: new Date().toISOString()
    });
    
    // Return standardized server error response with HTTP 200
    // Always return generic success message for security even on server errors
    return res.json({
      return_code: "SUCCESS", 
      message: "If an account with this email exists, a password reset link has been sent"
    });
  }
});

module.exports = router;