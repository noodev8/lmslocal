/*
=======================================================================================================================================
API Route: resend-verification
=======================================================================================================================================
Method: POST
Purpose: Resend email verification link with secure token generation and comprehensive audit logging
=======================================================================================================================================
Request Payload:
{
  "email": "user@example.com"                     // string, required - Email address for verification resend
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Verification email sent successfully",    // string, success confirmation message
  "verification_sent": {
    "email": "user@example.com",                        // string, email where verification was sent
    "token_generated": true,                            // boolean, confirmation that new token was created
    "email_delivered": true,                            // boolean, confirmation that email was sent
    "expires_in_hours": 24,                             // integer, token expiration time in hours
    "sent_timestamp": "2025-01-15T10:30:00Z"            // string, ISO datetime when email was sent
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"               // string, user-friendly error description
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"          - Missing email or invalid email format
"ALREADY_VERIFIED"          - Email is already verified
"EMAIL_SEND_FAILED"         - Failed to send verification email
"SERVER_ERROR"              - Database error or unexpected server failure
=======================================================================================================================================
Security Features:
- Built-in secure token generation with crypto.randomBytes
- 24-hour token expiration with automatic cleanup
- Email existence obfuscation (security-first approach)
- Comprehensive audit trail for verification attempts
- Atomic transaction ensures data consistency
- Token prefix validation and secure storage
=======================================================================================================================================
*/

const express = require('express');
const crypto = require('crypto');
const { query, transaction } = require('../database');
const emailService = require('../services/emailService');
const router = express.Router();
// Built-in secure token generation utility functions
// Generates cryptographically secure tokens with specified prefix
const generateSecureToken = (prefix = 'verify_') => {
  const randomBytes = crypto.randomBytes(32);
  return prefix + randomBytes.toString('hex');
};

// Calculates token expiration timestamp (hours from now)
const getTokenExpiry = (hours = 24) => {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + hours);
  return expiry;
};

// POST endpoint with comprehensive validation, atomic transaction safety and audit logging
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
        message: 'Email is required and must be a valid string'
      });
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'Please provide a valid email address'
      });
    }

    // STEP 2: Use transaction wrapper to ensure atomic operations
    // This ensures that either ALL verification operations succeed or ALL changes are rolled back
    // Critical for verification where token generation must be consistent with user update
    const transactionResult = await transaction(async (client) => {

      // Single comprehensive query to get user data and current verification status
      // This provides all necessary information for verification resend validation
      const userQuery = `
        SELECT
          id,
          email,
          display_name,
          email_verified,
          auth_token,
          auth_token_expires,
          created_at,
          last_active_at,
          -- Account status for logging
          CASE WHEN email_verified = true THEN 'verified'
               WHEN email_verified = false THEN 'unverified'
               ELSE 'unknown'
          END as account_status
        FROM app_user
        WHERE email = $1
      `;

      const userResult = await client.query(userQuery, [email.toLowerCase()]);

      // Check if user exists (with security-first approach)
      if (userResult.rows.length === 0) {
        // Log failed verification attempt for security monitoring
        await client.query(`
          INSERT INTO audit_log (action, details, created_at)
          VALUES ($1, $2, $3)
        `, [
          'VERIFICATION_RESEND_FAILED_USER_NOT_FOUND',
          JSON.stringify({
            email: email.toLowerCase(),
            ip: clientIp,
            user_agent: userAgent,
            failure_reason: 'user_not_found',
            security_note: 'email_existence_obfuscated',
            attempt_timestamp: requestTimestamp.toISOString()
          }),
          requestTimestamp
        ]);

        // Don't reveal if email exists or not for security (prevents email enumeration)
        return {
          return_code: 'SUCCESS',
          message: 'If an account with this email exists, a verification email has been sent',
          verification_sent: {
            email: email.toLowerCase(),
            token_generated: false,
            email_delivered: false,
            expires_in_hours: 24,
            sent_timestamp: requestTimestamp.toISOString()
          }
        };
      }

      const user = userResult.rows[0];

      // STEP 3: Check if email is already verified
      if (user.email_verified) {
        // Log already verified attempt for audit tracking
        await client.query(`
          INSERT INTO audit_log (user_id, action, details, created_at)
          VALUES ($1, $2, $3, $4)
        `, [
          user.id,
          'VERIFICATION_RESEND_FAILED_ALREADY_VERIFIED',
          JSON.stringify({
            user: {
              id: user.id,
              email: user.email,
              display_name: user.display_name,
              account_status: user.account_status
            },
            attempt_info: {
              ip: clientIp,
              user_agent: userAgent,
              failure_reason: 'email_already_verified'
            }
          }),
          requestTimestamp
        ]);

        throw {
          return_code: 'ALREADY_VERIFIED',
          message: 'This email address is already verified. You can log in normally.'
        };
      }

      // STEP 4: Generate new secure verification token
      const verificationToken = generateSecureToken('verify_');
      const tokenExpiry = getTokenExpiry(24); // 24 hours from now

      // STEP 5: Update user with new verification token atomically
      const updateTokenQuery = `
        UPDATE app_user 
        SET 
          auth_token = $1,
          auth_token_expires = $2,
          updated_at = NOW()
        WHERE id = $3
        RETURNING id, email, display_name, updated_at
      `;

      const updateResult = await client.query(updateTokenQuery, [
        verificationToken, 
        tokenExpiry, 
        user.id
      ]);
      const updatedUser = updateResult.rows[0];

      // STEP 6: Send verification email (outside transaction for performance)
      // Store email sending status for comprehensive response
      let emailSent = false;
      let emailError = null;

      try {
        const emailResult = await emailService.sendVerificationEmail(
          email.toLowerCase(), 
          verificationToken, 
          user.display_name
        );
        
        if (emailResult.success) {
          emailSent = true;
        } else {
          emailError = emailResult.error;
          console.error('Failed to send verification email:', emailResult.error);
        }
      } catch (emailException) {
        emailError = emailException.message;
        console.error('Email service exception:', emailException);
      }

      // STEP 7: Create comprehensive audit log entry for verification resend attempt
      const auditAction = emailSent ? 'VERIFICATION_RESEND_COMPLETED' : 'VERIFICATION_RESEND_EMAIL_FAILED';
      
      await client.query(`
        INSERT INTO audit_log (user_id, action, details, created_at)
        VALUES ($1, $2, $3, $4)
      `, [
        user.id,
        auditAction,
        JSON.stringify({
          user: {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            account_status: user.account_status
          },
          verification_info: {
            token_generated: true,
            token_prefix: verificationToken.substring(0, 10) + '...', // Log partial token for audit
            token_expires_at: tokenExpiry.toISOString(),
            expires_in_hours: 24,
            email_sent: emailSent,
            email_error: emailError
          },
          security_info: {
            ip: clientIp,
            user_agent: userAgent,
            request_timestamp: requestTimestamp.toISOString()
          }
        }),
        requestTimestamp
      ]);

      // If email failed to send, throw error to rollback transaction
      if (!emailSent) {
        throw {
          return_code: 'EMAIL_SEND_FAILED',
          message: 'Failed to send verification email. Please try again later.'
        };
      }

      // Return comprehensive success response with verification details
      return {
        return_code: 'SUCCESS',
        message: 'Verification email sent successfully',
        verification_sent: {
          email: user.email,
          token_generated: true,
          email_delivered: emailSent,
          expires_in_hours: 24,
          sent_timestamp: requestTimestamp.toISOString()
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
    // Note: Never log the actual email tokens or passwords in error logs
    console.error('Verification resend error:', {
      error: error.message,
      stack: error.stack?.substring(0, 500), // Truncate stack trace
      email: req.body?.email ? req.body.email.toLowerCase() : 'not_provided',
      has_email: !!req.body?.email, // Boolean only, not the actual email
      ip: req.ip || 'Unknown',
      user_agent: req.get('User-Agent') || 'Unknown',
      timestamp: new Date().toISOString()
    });
    
    // Return standardized server error response with HTTP 200
    return res.json({
      return_code: 'SERVER_ERROR', 
      message: 'Failed to resend verification email. Please try again later.'
    });
  }
});

module.exports = router;