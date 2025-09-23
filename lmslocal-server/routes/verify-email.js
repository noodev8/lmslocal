/*
=======================================================================================================================================
API Route: verify-email
=======================================================================================================================================
Method: GET
Purpose: Verify user email address via token from email link with atomic transaction safety and comprehensive audit logging
=======================================================================================================================================
Request Parameters:
{
  "token": "verify_abc123..."                    // string, required - Email verification token from email link
}

Success Response (ALWAYS HTTP 200 - HTML Page):
- User-friendly HTML success page confirming email verification
- Automatic token cleanup and email_verified flag update
- Redirect link to login page with environment-aware URL

Error Response (ALWAYS HTTP 200 - HTML Page):
- User-friendly HTML error pages for different failure scenarios
- No sensitive information disclosure for security
- Helpful action buttons for user recovery

=======================================================================================================================================
Response Types:
"SUCCESS_PAGE"              - Email verified successfully, user can now log in
"ALREADY_VERIFIED_PAGE"     - Email was previously verified, redirect to login
"INVALID_TOKEN_PAGE"        - Token not found or invalid format
"TOKEN_EXPIRED_PAGE"        - Verification token has expired (24 hour limit)
"SERVER_ERROR_PAGE"         - Database error or unexpected server failure
=======================================================================================================================================
Security Features:
- Built-in token expiration validation (no external dependencies)
- Atomic transaction ensures email verification consistency
- Comprehensive audit trail for all verification attempts
- Token prefix validation for security ("verify_" tokens only)
- Environment-aware frontend URLs for production deployment
- Single-use token consumption (cleared after successful verification)
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../database');
const router = express.Router();

// Built-in token expiration checker utility function
// Checks if a given timestamp is in the past (expired)
const isTokenExpired = (expiresAt) => {
  if (!expiresAt) return true; // No expiration time means expired
  return new Date() > new Date(expiresAt);
};

// Environment-aware frontend URL generator
// Returns appropriate frontend URL based on environment configuration
const getFrontendUrl = () => {
  // Production: Use environment variable if available
  if (process.env.CLIENT_URL) {
    return process.env.CLIENT_URL;
  }
  // Development: Default to localhost
  return 'http://localhost:3000';
};

// HTML template generator for consistent page styling
const generateHtmlPage = (title, heading, message, buttonText, buttonLink, isSuccess = false) => {
  const headingClass = isSuccess ? 'success' : 'error';
  const checkmark = isSuccess ? '<div class="checkmark"></div>' : '';
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title} - LMS Local</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); 
            margin: 0; 
            padding: 20px; 
            min-height: 100vh;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white; 
            padding: 40px; 
            border-radius: 15px; 
            text-align: center; 
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          }
          .success { color: #059669; }
          .error { color: #dc2626; }
          .checkmark {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: #059669;
            margin: 0 auto 20px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .checkmark::after {
            content: '✓';
            color: white;
            font-size: 30px;
            font-weight: bold;
          }
          .button { 
            display: inline-block; 
            background: #2563eb; 
            color: white; 
            padding: 15px 30px; 
            text-decoration: none; 
            border-radius: 8px; 
            margin-top: 25px; 
            font-weight: bold;
            transition: background-color 0.2s;
          }
          .button:hover { background: #1d4ed8; }
          h1 { color: #2563eb; margin-bottom: 10px; }
          h2 { color: #1f2937; margin-bottom: 15px; }
          p { color: #6b7280; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>LMS Local</h1>
          ${checkmark}
          <h2 class="${headingClass}">${heading}</h2>
          ${message}
          <a href="${buttonLink}" class="button">${buttonText}</a>
        </div>
      </body>
    </html>
  `;
};

// GET endpoint with comprehensive validation, atomic transaction safety and audit logging
router.get('/', async (req, res) => {
  try {
    const { token } = req.query;
    const clientIp = req.ip || 'Unknown';
    const userAgent = req.get('User-Agent') || 'Unknown';
    const verificationTimestamp = new Date();
    const frontendUrl = getFrontendUrl();

    // STEP 1: Validate required token parameter with comprehensive checking
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return res.send(generateHtmlPage(
        'Invalid Link',
        'Invalid Verification Link', 
        '<p>The verification link is invalid or missing the token.</p><p>Please check your email for the correct verification link.</p>',
        'Back to Login',
        `${frontendUrl}/login`
      ));
    }

    // Security validation: Ensure token has correct prefix for verification tokens
    if (!token.startsWith('verify_')) {
      return res.send(generateHtmlPage(
        'Invalid Token Format',
        'Invalid Verification Link',
        '<p>This verification link has an invalid format.</p><p>Please use the verification link from your email.</p>',
        'Back to Login',
        `${frontendUrl}/login`
      ));
    }

    // STEP 2: Use transaction wrapper to ensure atomic operations
    // This ensures that either ALL email verification operations succeed or ALL changes are rolled back
    // Critical for email verification where token clearing must be consistent with verification flag update
    const transactionResult = await transaction(async (client) => {

      // Single comprehensive query to get user data and token validation information
      // This provides all necessary information for email verification validation
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
          CASE WHEN email_verified = true THEN 'verified'
               WHEN email_verified = false THEN 'unverified'
               WHEN is_managed = true THEN 'managed'
               ELSE 'unknown'
          END as account_status
        FROM app_user 
        WHERE auth_token = $1 AND auth_token LIKE 'verify_%'
      `;

      const userResult = await client.query(userQuery, [token]);

      // Check if token exists and is a valid verification token
      if (userResult.rows.length === 0) {
        // Log failed verification attempt for security monitoring
        await client.query(`
          INSERT INTO audit_log (action, details, created_at)
          VALUES ($1, $2, $3)
        `, [
          'EMAIL_VERIFICATION_FAILED_INVALID_TOKEN',
          JSON.stringify({
            token_prefix: token.substring(0, 10) + '...', // Log partial token for debugging
            ip: clientIp,
            user_agent: userAgent,
            failure_reason: 'token_not_found',
            attempt_timestamp: verificationTimestamp.toISOString()
          }),
          verificationTimestamp
        ]);

        throw {
          page_type: 'INVALID_TOKEN_PAGE',
          title: 'Invalid Token',
          heading: 'Invalid or Expired Token',
          message: '<p>This verification link is invalid or has already been used.</p><p>Please request a new verification email if needed.</p>',
          buttonText: 'Request New Link',
          buttonLink: `${frontendUrl}/register`
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
          'EMAIL_VERIFICATION_FAILED_ALREADY_VERIFIED',
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
          verificationTimestamp
        ]);

        throw {
          page_type: 'ALREADY_VERIFIED_PAGE',
          title: 'Already Verified',
          heading: 'Email Already Verified',
          message: '<p>Your email address has already been verified.</p><p>You can log in to your account normally.</p>',
          buttonText: 'Continue to Login',
          buttonLink: `${frontendUrl}/login`,
          isSuccess: true
        };
      }

      // STEP 4: Token expiration validation using built-in function
      if (isTokenExpired(user.auth_token_expires)) {
        // Log expired token attempt for security monitoring
        await client.query(`
          INSERT INTO audit_log (user_id, action, details, created_at)
          VALUES ($1, $2, $3, $4)
        `, [
          user.id,
          'EMAIL_VERIFICATION_FAILED_TOKEN_EXPIRED',
          JSON.stringify({
            user: {
              id: user.id,
              email: user.email,
              display_name: user.display_name,
              account_status: user.account_status
            },
            token_info: {
              token_expired_at: user.auth_token_expires,
              failure_reason: 'token_expired'
            },
            attempt_info: {
              ip: clientIp,
              user_agent: userAgent
            }
          }),
          verificationTimestamp
        ]);

        throw {
          page_type: 'TOKEN_EXPIRED_PAGE',
          title: 'Token Expired',
          heading: 'Verification Link Expired',
          message: '<p>This verification link has expired.</p><p>Please request a new verification email to complete your registration.</p>',
          buttonText: 'Request New Link',
          buttonLink: `${frontendUrl}/register`
        };
      }

      // STEP 5: Verify email and clear token atomically
      const verifyEmailQuery = `
        UPDATE app_user 
        SET 
          email_verified = true,
          auth_token = NULL,
          auth_token_expires = NULL,
          updated_at = NOW()
        WHERE id = $1
        RETURNING id, email, display_name, updated_at
      `;

      const verifyResult = await client.query(verifyEmailQuery, [user.id]);
      const verifiedUser = verifyResult.rows[0];

      // STEP 6: Create comprehensive audit log entry for successful email verification
      await client.query(`
        INSERT INTO audit_log (user_id, action, details, created_at)
        VALUES ($1, $2, $3, $4)
      `, [
        user.id,
        'EMAIL_VERIFICATION_COMPLETED',
        JSON.stringify({
          user: {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            account_status: 'verified' // Status after verification
          },
          verification_info: {
            token_used: token.substring(0, 10) + '...', // Log partial token for audit
            token_expired_at: user.auth_token_expires,
            verification_completed_at: verificationTimestamp.toISOString()
          },
          security_info: {
            ip: clientIp,
            user_agent: userAgent,
            request_timestamp: verificationTimestamp.toISOString()
          }
        }),
        verificationTimestamp
      ]);

      // Return success page data
      return {
        page_type: 'SUCCESS_PAGE',
        title: 'Email Verified',
        heading: 'Email Verified Successfully!',
        message: `<p>Welcome <strong>${user.display_name}</strong>!</p><p>Your email address has been verified. You can now log in to your LMS Local account and start creating Last Man Standing competitions.</p>`,
        buttonText: 'Continue to Login',
        buttonLink: `${frontendUrl}/login`,
        isSuccess: true
      };
    });

    // Generate and return success HTML page
    return res.send(generateHtmlPage(
      transactionResult.title,
      transactionResult.heading,
      transactionResult.message,
      transactionResult.buttonText,
      transactionResult.buttonLink,
      transactionResult.isSuccess
    ));

  } catch (error) {
    // Handle custom business logic errors (thrown from transaction)
    if (error.page_type) {
      return res.send(generateHtmlPage(
        error.title,
        error.heading,
        error.message,
        error.buttonText,
        error.buttonLink,
        error.isSuccess || false
      ));
    }

    // Log detailed error information for debugging while protecting sensitive data
    // Note: Never log the actual tokens in error logs
    console.error('Email verification error:', {
      error: error.message,
      stack: error.stack?.substring(0, 500), // Truncate stack trace
      token_prefix: req.query?.token ? req.query.token.substring(0, 10) + '...' : 'not_provided',
      has_token: !!req.query?.token, // Boolean only, not the actual token
      ip: req.ip || 'Unknown',
      user_agent: req.get('User-Agent') || 'Unknown',
      timestamp: new Date().toISOString()
    });
    
    // Return standardized server error page with HTTP 200
    const frontendUrl = getFrontendUrl();
    return res.send(generateHtmlPage(
      'Verification Error',
      'Verification Error',
      '<p>An error occurred while verifying your email.</p><p>Please try again or contact support if the problem persists.</p>',
      'Back to Login',
      `${frontendUrl}/login`
    ));
  }
});

module.exports = router;