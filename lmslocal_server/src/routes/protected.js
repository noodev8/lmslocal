/*
=======================================================================================================================================
API Route: /protected/profile
=======================================================================================================================================
Method: POST
Purpose: Get authenticated user's profile information (protected route example)
=======================================================================================================================================
Request Payload:
{
  // No payload required - user info comes from JWT
}

Success Response:
{
  "return_code": "SUCCESS",
  "user_id": 123,                          // number, user ID from JWT
  "display_name": "John Smith",             // string, user's display name
  "email": "user@example.com",              // string, user's email
  "message": "Profile retrieved successfully" // string, confirmation message
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"AUTHENTICATION_REQUIRED"
"TOKEN_EXPIRED"
"TOKEN_INVALID"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// Apply authentication to all routes in this router
router.use(requireAuth);

// Protected route example - get user profile
router.post('/profile', async (req, res) => {
    try {
        console.log('👤 Getting user profile');
        
        // req.user is populated by the requireAuth middleware
        const { id, display_name, email } = req.user;
        
        res.json({
            return_code: 'SUCCESS',
            user_id: id,
            display_name: display_name,
            email: email,
            message: 'Profile retrieved successfully'
        });

    } catch (error) {
        console.error('❌ Get profile failed:', error.message);
        res.status(500).json({
            return_code: 'SERVER_ERROR',
            message: 'Failed to get profile',
            error: error.message
        });
    }
});

module.exports = router;