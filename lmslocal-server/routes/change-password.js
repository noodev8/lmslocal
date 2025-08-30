/*
=======================================================================================================================================
Change Password Route - Allow authenticated users to change their password
=======================================================================================================================================
Method: POST
Purpose: Allow users to change their password by providing current password
=======================================================================================================================================
Request Payload:
{
  "current_password": "oldpassword123",     // string, required
  "new_password": "newpassword456"          // string, required
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Password changed successfully"
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "User-friendly error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"UNAUTHORIZED"
"CURRENT_PASSWORD_INCORRECT"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../database');
const router = express.Router();

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(200).json({
        return_code: "UNAUTHORIZED",
        message: "No token provided"
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const userId = decoded.user_id || decoded.userId;
    const result = await query('SELECT id, email, display_name, password_hash, is_managed FROM app_user WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(200).json({
        return_code: "UNAUTHORIZED",
        message: "Invalid token"
      });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    return res.status(200).json({
      return_code: "UNAUTHORIZED",
      message: "Invalid token"
    });
  }
};

router.post('/', verifyToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const user = req.user;

    // Check if this is a managed player (they don't have passwords)
    if (user.is_managed) {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "Managed players cannot change passwords"
      });
    }

    // Validate input
    if (!current_password || typeof current_password !== 'string') {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "Current password is required"
      });
    }

    if (!new_password || typeof new_password !== 'string') {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "New password is required"
      });
    }

    if (new_password.length < 6) {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "New password must be at least 6 characters long"
      });
    }

    if (current_password === new_password) {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "New password must be different from current password"
      });
    }

    // Verify current password
    if (!user.password_hash) {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "No password set for this account"
      });
    }

    const isCurrentPasswordValid = await bcrypt.compare(current_password, user.password_hash);
    if (!isCurrentPasswordValid) {
      return res.status(200).json({
        return_code: "CURRENT_PASSWORD_INCORRECT",
        message: "Current password is incorrect"
      });
    }

    // Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(new_password, saltRounds);

    // Update password in database
    await query(`
      UPDATE app_user 
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
    `, [newPasswordHash, user.id]);

    // Log the action
    await query(`
      INSERT INTO audit_log (user_id, action, details)
      VALUES ($1, 'Password Changed', $2)
    `, [user.id, `Password changed for user "${user.display_name}" (${user.email})`]);

    res.status(200).json({
      return_code: "SUCCESS",
      message: "Password changed successfully"
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(200).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;