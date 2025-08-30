/*
=======================================================================================================================================
Resend Verification Route
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const emailService = require('../services/emailService');
const tokenUtils = require('../utils/tokenUtils');
const router = express.Router();

/*
=======================================================================================================================================
API Route: /resend-verification
=======================================================================================================================================
Method: POST
Purpose: Resend email verification link
=======================================================================================================================================
Request Payload:
{
  "email": "user@example.com"
}

Success Response:
{
  "return_code": "SUCCESS",
  "message": "Verification email sent successfully"
}
=======================================================================================================================================
*/
router.post('/', async (req, res) => {
  try {
    const { email } = req.body;

    // Validation
    if (!email) {
      return res.status(400).json({
        return_code: "VALIDATION_ERROR",
        message: "Email is required"
      });
    }

    // Get user from database
    const result = await query(
      'SELECT id, display_name, email_verified FROM app_user WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      // Don't reveal if email exists or not for security
      return res.json({
        return_code: "SUCCESS",
        message: "If an account with this email exists, a verification email has been sent"
      });
    }

    const user = result.rows[0];

    if (user.email_verified) {
      return res.status(400).json({
        return_code: "ALREADY_VERIFIED",
        message: "Email is already verified"
      });
    }

    // Generate new verification token
    const verificationToken = tokenUtils.generateToken('verify_');
    const tokenExpiry = tokenUtils.getTokenExpiry(24); // 24 hours

    // Update user with new token
    await query(
      'UPDATE app_user SET auth_token = $1, auth_token_expires = $2, updated_at = NOW() WHERE id = $3',
      [verificationToken, tokenExpiry, user.id]
    );

    // Send verification email
    const emailResult = await emailService.sendVerificationEmail(email.toLowerCase(), verificationToken, user.display_name);
    
    if (!emailResult.success) {
      console.error('Failed to send verification email:', emailResult.error);
      return res.status(500).json({
        return_code: "EMAIL_SEND_FAILED",
        message: "Failed to send verification email. Please try again later."
      });
    }

    res.json({
      return_code: "SUCCESS",
      message: "Verification email sent successfully"
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;