/*
=======================================================================================================================================
API Route: register
=======================================================================================================================================
Method: POST
Purpose: Registers a new user account with automatic verification and comprehensive validation
=======================================================================================================================================
Request Payload:
{
  "display_name": "John Doe",                 // string, required - User's display name (2-50 characters, duplicates allowed)
  "email": "user@example.com",                // string, required - User's email address (must be unique)
  "password": "password123"                   // string, required - User's password (minimum 6 characters)
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Registration successful. You can now log in to your account.", // string, confirmation message
  "user": {                                   // object, created user information
    "id": 123,                                // integer, unique user ID
    "display_name": "John Doe",               // string, user's display name
    "email": "user@example.com",              // string, user's email address
    "email_verified": true,                   // boolean, email verification status (auto-verified)
    "user_type": "player",                    // string, user account type
    "created_at": "2025-08-31T15:00:00Z"      // string, ISO datetime when account was created
  },
  "verification_sent": false                  // boolean, whether verification email was sent (disabled)
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"      // string, user-friendly error description
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"EMAIL_EXISTS"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const bcrypt = require('bcrypt');
const { query, transaction } = require('../database');
const emailService = require('../services/emailService');
const tokenUtils = require('../utils/tokenUtils');
const router = express.Router();
router.post('/', async (req, res) => {
  try {
    // Extract and sanitize request parameters
    const { display_name, email, password } = req.body;

    // === COMPREHENSIVE INPUT VALIDATION ===
    // Validate all required fields are provided
    if (!display_name || !email || !password) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Display name, email, and password are required"
      });
    }

    // === DISPLAY NAME VALIDATION ===
    // Sanitize and validate display name (duplicates allowed per requirement)
    const trimmedDisplayName = display_name.trim();
    
    if (trimmedDisplayName.length < 2) {
      return res.json({
        return_code: "VALIDATION_ERROR", 
        message: "Display name must be at least 2 characters long"
      });
    }

    if (trimmedDisplayName.length > 50) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Display name must be no more than 50 characters long"
      });
    }

    // Check for inappropriate characters in display name
    const displayNamePattern = /^[a-zA-Z0-9\s\-_.']+$/;
    if (!displayNamePattern.test(trimmedDisplayName)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Display name contains invalid characters. Only letters, numbers, spaces, hyphens, underscores, apostrophes, and periods are allowed"
      });
    }

    // === EMAIL VALIDATION ===
    // Sanitize and validate email address
    const trimmedEmail = email.trim().toLowerCase();
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Please enter a valid email address"
      });
    }

    if (trimmedEmail.length > 255) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Email address is too long"
      });
    }

    // === PASSWORD VALIDATION (Preserving Current Rules) ===
    // Validate password meets minimum requirements (keeping existing 6 char rule)
    if (password.length < 6) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Password must be at least 6 characters long"
      });
    }

    // === EMAIL DUPLICATE CHECK ===
    // Check if email is already registered (single optimized query)
    const existingUserCheck = await query(`
      SELECT 
        id,                           -- User ID if email exists
        email_verified,               -- Whether existing account is verified
        created_at                    -- When existing account was created
      FROM app_user 
      WHERE email = $1
    `, [trimmedEmail]);

    if (existingUserCheck.rows.length > 0) {
      return res.json({
        return_code: "EMAIL_EXISTS",
        message: "An account with this email already exists"
      });
    }

    // === SECURITY PREPARATION ===
    // Hash password with secure salt rounds
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Email verification disabled - no tokens needed
    // const verificationToken = tokenUtils.generateToken('verify_');
    // const tokenExpiry = tokenUtils.getTokenExpiry(24); // 24 hours for email verification

    // === ATOMIC TRANSACTION EXECUTION ===
    // Execute user creation and audit logging in transaction for data consistency
    let newUser = null;
    let emailSent = false;
    
    await transaction(async (client) => {
      // Step 1: Create new user account with all required fields
      const userResult = await client.query(`
        INSERT INTO app_user (
          display_name,               -- User's chosen display name
          email,                      -- Normalized email address
          password_hash,              -- Securely hashed password
          email_verified,             -- Auto-verified (no email verification required)
          auth_token,                 -- No verification token needed
          auth_token_expires,         -- No token expiry needed
          user_type,                  -- Account type (player for regular users)
          created_at,                 -- Account creation timestamp
          updated_at                  -- Last update timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, display_name, email, email_verified, user_type, created_at
      `, [
        trimmedDisplayName,
        trimmedEmail,
        hashedPassword,
        true,                         // Email auto-verified (no verification needed)
        null,                         // No verification token stored
        null,                         // No token expiry needed
        'player'                      // Default user type for registrations
      ]);

      newUser = userResult.rows[0];

      // Step 2: Add registration audit log for security compliance
      await client.query(`
        INSERT INTO audit_log (user_id, action, details, created_at)
        VALUES ($1, 'User Registration', $2, CURRENT_TIMESTAMP)
      `, [
        newUser.id,
        `New user registered: ${trimmedDisplayName} (${trimmedEmail})`
      ]);
    });

    // === EMAIL VERIFICATION DISABLED ===
    // Email verification is disabled - no verification email sent
    // Users are automatically verified upon registration
    emailSent = false; // No email sent (verification disabled)

    // === SUCCESS RESPONSE ===
    // Return comprehensive user data and email status for frontend handling
    res.json({
      return_code: "SUCCESS",
      message: "Registration successful. You can now log in to your account.",
      user: {
        id: newUser.id,                         // User's unique identifier
        display_name: newUser.display_name,     // Confirmed display name
        email: newUser.email,                   // Confirmed email address
        email_verified: newUser.email_verified, // Verification status (auto-verified)
        user_type: newUser.user_type,           // Account type
        created_at: newUser.created_at          // Account creation timestamp
      },
      verification_sent: emailSent              // Whether verification email was sent successfully
    });

  } catch (error) {
    // === ERROR HANDLING ===
    // Log detailed error for debugging but return generic message to client for security
    console.error('Registration error:', error);
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;