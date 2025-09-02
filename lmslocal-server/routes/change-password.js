/*
=======================================================================================================================================
API Route: change-password
=======================================================================================================================================
Method: POST
Purpose: Allow authenticated users to securely change their password with comprehensive validation and atomic transaction safety
=======================================================================================================================================
Request Payload:
{
  "current_password": "oldpassword123",     // string, required - User's current password for verification
  "new_password": "newpassword456"          // string, required - New password (min 6 chars, must be different)
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Password changed successfully", // string, success confirmation message
  "user_info": {
    "id": 123,                              // integer, user database ID
    "email": "user@example.com",            // string, user email for confirmation
    "display_name": "John Smith",           // string, user display name
    "password_updated_at": "2025-01-15T10:30:00Z" // string, ISO datetime when password was changed
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
"VALIDATION_ERROR"          - Missing fields, invalid password format, or business rule violation
"UNAUTHORIZED"              - Invalid JWT token
"CURRENT_PASSWORD_INCORRECT" - Current password verification failed
"MANAGED_ACCOUNT"           - Account is managed and cannot change password
"SERVER_ERROR"              - Database error or unexpected server failure
=======================================================================================================================================
Password Requirements:
- Minimum 6 characters length
- Must be different from current password
- Cannot be empty or null
- Must be a valid string type
=======================================================================================================================================
*/

const express = require('express');
const bcrypt = require('bcrypt');
const { query, transaction } = require('../database'); // Use central database with transaction support
const { verifyToken } = require('../middleware/auth'); // Use standard verifyToken middleware
const router = express.Router();

// POST endpoint with comprehensive authentication, validation and atomic transaction safety for password changes
router.post('/', verifyToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const user_id = req.user.id; // Set by verifyToken middleware
    const user_email = req.user.email; // For audit trail and response
    const user_display_name = req.user.display_name; // For audit trail and response

    // STEP 1: Validate required input parameters with comprehensive business rule checking
    
    // Check if this is a managed player account (admin-created accounts without passwords)
    // Managed players use magic link authentication and cannot change passwords
    if (req.user.is_managed) {
      return res.json({
        return_code: "MANAGED_ACCOUNT",
        message: "This is a managed account. Password changes are not allowed for managed players."
      });
    }

    // Validate current password input
    if (!current_password || typeof current_password !== 'string' || current_password.trim().length === 0) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Current password is required and must be a valid string"
      });
    }

    // Validate new password input
    if (!new_password || typeof new_password !== 'string' || new_password.trim().length === 0) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "New password is required and must be a valid string"
      });
    }

    // Business Rule: Enforce minimum password length for security
    if (new_password.length < 6) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "New password must be at least 6 characters long"
      });
    }

    // Business Rule: Prevent users from setting the same password (no security benefit)
    if (current_password === new_password) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "New password must be different from your current password"
      });
    }

    // Verify account has a password set (some legacy accounts might not)
    if (!req.user.password_hash) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "No password is currently set for this account. Please contact support."
      });
    }

    // STEP 2: Security validation - verify current password before allowing change
    // This is critical security measure to prevent unauthorized password changes
    const isCurrentPasswordValid = await bcrypt.compare(current_password, req.user.password_hash);
    if (!isCurrentPasswordValid) {
      return res.json({
        return_code: "CURRENT_PASSWORD_INCORRECT",
        message: "Current password is incorrect. Please try again."
      });
    }

    // STEP 3: Use transaction wrapper to ensure atomic operations
    // This ensures that either BOTH password update AND audit logging succeed or BOTH are rolled back
    // Critical for security operations where audit trail must be consistent with actual changes
    const transactionResult = await transaction(async (client) => {

      // Generate secure password hash with industry-standard salt rounds
      // Salt rounds = 10 provides good security/performance balance (approx 100ms to hash)
      const saltRounds = 10;
      const newPasswordHash = await bcrypt.hash(new_password, saltRounds);

      // Atomic password update with timestamp tracking
      const updateQuery = `
        UPDATE app_user 
        SET 
          password_hash = $1, 
          updated_at = NOW()
        WHERE id = $2
        RETURNING id, email, display_name, updated_at
      `;
      
      const updateResult = await client.query(updateQuery, [newPasswordHash, user_id]);
      const updatedUser = updateResult.rows[0];

      // Create comprehensive audit log entry within the same transaction
      // This ensures complete accountability for all password changes
      const auditDetails = {
        action: 'PASSWORD_CHANGED',
        user: {
          id: user_id,
          email: user_email,
          display_name: user_display_name
        },
        security_info: {
          password_hash_algorithm: 'bcrypt',
          salt_rounds: saltRounds,
          changed_at: updatedUser.updated_at
        },
        client_info: {
          user_agent: req.get('User-Agent') || 'Unknown',
          ip_address: req.ip || 'Unknown'
        }
      };

      const auditQuery = `
        INSERT INTO audit_log (user_id, action, details, created_at)
        VALUES ($1, $2, $3, NOW())
      `;
      
      await client.query(auditQuery, [
        user_id,
        'PASSWORD_CHANGED',
        JSON.stringify(auditDetails)
      ]);

      // Return comprehensive success response with user confirmation details
      return {
        return_code: "SUCCESS",
        message: "Password changed successfully",
        user_info: {
          id: updatedUser.id,
          email: updatedUser.email,
          display_name: updatedUser.display_name,
          password_updated_at: updatedUser.updated_at
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
    console.error('Change password error:', {
      error: error.message,
      stack: error.stack?.substring(0, 500), // Truncate stack trace
      user_id: req.user?.id,
      user_email: req.user?.email,
      has_current_password: !!req.body?.current_password, // Boolean only, not the actual password
      has_new_password: !!req.body?.new_password, // Boolean only, not the actual password
      timestamp: new Date().toISOString()
    });
    
    // Return standardized server error response with HTTP 200
    return res.json({
      return_code: "SERVER_ERROR", 
      message: "Failed to change password. Please try again later."
    });
  }
});

module.exports = router;