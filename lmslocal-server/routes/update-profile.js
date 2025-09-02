/*
=======================================================================================================================================
API Route: update-profile
=======================================================================================================================================
Method: POST
Purpose: Updates user profile information with comprehensive validation and atomic transaction safety
=======================================================================================================================================
Request Payload:
{
  "display_name": "New Name",                 // string, required - User's new display name (2-50 characters)
  "email": "new@example.com"                  // string, optional - User's new email address (if changing)
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Profile updated successfully", // string, confirmation message
  "user": {                                  // object, updated user information
    "id": 123,                               // integer, unique user ID
    "display_name": "New Name",              // string, updated display name
    "email": "user@example.com",             // string, current email address
    "email_verified": true,                  // boolean, email verification status
    "updated_at": "2025-08-31T15:00:00Z"     // string, ISO datetime when profile was last updated
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"     // string, user-friendly error description
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"DISPLAY_NAME_TAKEN"
"EMAIL_ALREADY_EXISTS"
"UNAUTHORIZED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../database');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();
router.post('/', verifyToken, async (req, res) => {
  try {
    // Extract request parameters and authenticated user ID
    const { display_name, email } = req.body;
    const user_id = req.user.id;

    // === INPUT VALIDATION ===
    // Comprehensive validation of profile update fields
    
    // Validate display name is provided and meets requirements
    if (!display_name || !display_name.trim()) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Display name is required"
      });
    }

    const trimmedDisplayName = display_name.trim();

    // Check display name length constraints
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

    // Check for inappropriate characters or patterns
    const displayNamePattern = /^[a-zA-Z0-9\s\-_.']+$/;
    if (!displayNamePattern.test(trimmedDisplayName)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Display name contains invalid characters. Only letters, numbers, spaces, hyphens, underscores, apostrophes, and periods are allowed"
      });
    }

    // Optional email validation if provided
    let trimmedEmail = null;
    if (email) {
      trimmedEmail = email.trim().toLowerCase();
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(trimmedEmail)) {
        return res.json({
          return_code: "VALIDATION_ERROR",
          message: "Invalid email format"
        });
      }
    }

    // === COMPREHENSIVE VALIDATION QUERY ===
    // Check for duplicate display name and email conflicts in single query
    // Also get current user data for comparison and response
    const validationResult = await query(`
      SELECT 
        current_user.id as current_user_id,
        current_user.display_name as current_display_name,
        current_user.email as current_email,
        current_user.email_verified,
        current_user.updated_at as current_updated_at,
        duplicate_name.id as duplicate_name_user_id,
        duplicate_email.id as duplicate_email_user_id
      FROM app_user current_user
      LEFT JOIN app_user duplicate_name ON duplicate_name.display_name = $2 AND duplicate_name.id != $1
      LEFT JOIN app_user duplicate_email ON duplicate_email.email = $3 AND duplicate_email.id != $1 AND $3 IS NOT NULL
      WHERE current_user.id = $1
    `, [user_id, trimmedDisplayName, trimmedEmail]);

    // Check if user exists (should always be true due to JWT verification)
    if (validationResult.rows.length === 0) {
      return res.json({
        return_code: "UNAUTHORIZED",
        message: "User not found"
      });
    }

    const validation = validationResult.rows[0];

    // Check for display name conflicts
    if (validation.duplicate_name_user_id) {
      return res.json({
        return_code: "DISPLAY_NAME_TAKEN",
        message: "This display name is already taken by another user"
      });
    }

    // Check for email conflicts (only if email is being changed)
    if (trimmedEmail && validation.duplicate_email_user_id) {
      return res.json({
        return_code: "EMAIL_ALREADY_EXISTS",
        message: "This email address is already associated with another account"
      });
    }

    // === ATOMIC TRANSACTION EXECUTION ===
    // Execute profile update in transaction to ensure data consistency
    let updatedUser = null;
    await transaction(async (client) => {
      // Step 1: Update user profile with new information
      const updateFields = ['display_name = $2', 'updated_at = CURRENT_TIMESTAMP'];
      const updateValues = [user_id, trimmedDisplayName];
      let paramIndex = 3;

      // Add email update if provided
      if (trimmedEmail && trimmedEmail !== validation.current_email) {
        updateFields.push(`email = $${paramIndex}`);
        updateFields.push('email_verified = false'); // Reset verification when email changes
        updateValues.push(trimmedEmail);
        paramIndex++;
      }

      const updateQuery = `
        UPDATE app_user 
        SET ${updateFields.join(', ')}
        WHERE id = $1
        RETURNING id, display_name, email, email_verified, updated_at
      `;

      const updateResult = await client.query(updateQuery, updateValues);
      updatedUser = updateResult.rows[0];

      // Step 2: Add audit log for profile changes (optional but good practice)
      const changes = [];
      if (trimmedDisplayName !== validation.current_display_name) {
        changes.push(`display_name: "${validation.current_display_name}" → "${trimmedDisplayName}"`);
      }
      if (trimmedEmail && trimmedEmail !== validation.current_email) {
        changes.push(`email: "${validation.current_email}" → "${trimmedEmail}"`);
      }

      if (changes.length > 0) {
        await client.query(`
          INSERT INTO audit_log (user_id, action, details)
          VALUES ($1, 'Profile Updated', $2)
        `, [user_id, `Profile changes: ${changes.join(', ')}`]);
      }
    });

    // === SUCCESS RESPONSE ===
    // Return updated user information for frontend synchronization
    res.json({
      return_code: "SUCCESS",
      message: "Profile updated successfully",
      user: {
        id: updatedUser.id,                         // User's ID for reference
        display_name: updatedUser.display_name,     // Updated display name
        email: updatedUser.email,                   // Current email address
        email_verified: updatedUser.email_verified, // Email verification status
        updated_at: updatedUser.updated_at          // When profile was last updated
      }
    });

  } catch (error) {
    // === ERROR HANDLING ===
    // Log detailed error for debugging but return generic message to client for security
    console.error('Update profile error:', error);
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;