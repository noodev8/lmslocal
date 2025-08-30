/*
=======================================================================================================================================
Update Profile Route
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const verifyToken = require('../middleware/verifyToken');
const router = express.Router();

/*
=======================================================================================================================================
API Route: /update-profile
=======================================================================================================================================
Method: POST
Purpose: Update user profile information
=======================================================================================================================================
Request Payload:
{
  "display_name": "New Name"
}

Success Response:
{
  "return_code": "SUCCESS",
  "message": "Profile updated successfully"
}
=======================================================================================================================================
*/
router.post('/', verifyToken, async (req, res) => {
  try {
    const { display_name } = req.body;

    // Validation
    if (!display_name || !display_name.trim()) {
      return res.status(400).json({
        return_code: "VALIDATION_ERROR",
        message: "Display name is required"
      });
    }

    if (display_name.trim().length < 2) {
      return res.status(400).json({
        return_code: "VALIDATION_ERROR",
        message: "Display name must be at least 2 characters long"
      });
    }

    // Update user profile
    await query(
      'UPDATE app_user SET display_name = $1, updated_at = NOW() WHERE id = $2',
      [display_name.trim(), req.user.id]
    );

    res.json({
      return_code: "SUCCESS",
      message: "Profile updated successfully"
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;