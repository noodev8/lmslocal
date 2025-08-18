/*
=======================================================================================================================================
API Route: /user/create
=======================================================================================================================================
Method: POST
Purpose: Create a new user (regular or managed)
=======================================================================================================================================
Request Payload:
{
  "email": "john@example.com",          // string, optional - user's email (required for regular users)
  "display_name": "John Smith",         // string, required - user's display name
  "is_managed": false,                  // boolean, optional - default false (true for managed players)
  "created_by_user_id": null            // number, optional - ID of organizer who created managed player
}

Success Response:
{
  "return_code": "SUCCESS",
  "user_id": 123,                       // number, unique user ID
  "email": "john@example.com",          // string, user's email (null for managed users)
  "display_name": "John Smith",         // string, user's display name
  "is_managed": false,                  // boolean, managed player flag
  "created_at": "2024-01-01T12:00:00Z"  // string, creation timestamp
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"DUPLICATE_EMAIL_ERROR"
"DATABASE_ERROR"
"SERVER_ERROR"
=======================================================================================================================================

=======================================================================================================================================
API Route: /user/get
=======================================================================================================================================
Method: POST
Purpose: Get user details by ID or email
=======================================================================================================================================
Request Payload:
{
  "user_id": 123,                      // number, optional - user ID
  "email": "john@example.com"          // string, optional - user's email
}
// Note: Provide either user_id OR email, not both

Success Response:
{
  "return_code": "SUCCESS",
  "user_id": 123,                      // number, unique user ID
  "email": "john@example.com",         // string, user's email (null for managed users)
  "display_name": "John Smith",        // string, user's display name
  "is_managed": false,                 // boolean, managed player flag
  "email_verified": true,              // boolean, email verification status
  "created_at": "2024-01-01T12:00:00Z", // string, creation timestamp
  "last_active_at": "2024-01-01T12:00:00Z" // string, last activity timestamp
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"USER_NOT_FOUND"
"DATABASE_ERROR"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { pool } = require('../config/database');
const router = express.Router();

// Create user
router.post('/create', async (req, res) => {
    try {
        console.log('👤 Creating new user');
        
        const { email, display_name, is_managed = false, created_by_user_id = null } = req.body;

        // Validation
        if (!display_name) {
            console.log('❌ Validation failed: missing display_name');
            return res.status(400).json({
                return_code: 'VALIDATION_ERROR',
                message: 'Missing required field: display_name'
            });
        }

        // For regular users, email is required
        if (!is_managed && !email) {
            console.log('❌ Validation failed: email required for regular users');
            return res.status(400).json({
                return_code: 'VALIDATION_ERROR',
                message: 'Email is required for regular users'
            });
        }

        const client = await pool.connect();
        
        try {
            // Check if email already exists (if email provided)
            if (email) {
                const existingUser = await client.query(
                    'SELECT id FROM app_user WHERE email = $1',
                    [email]
                );

                if (existingUser.rows.length > 0) {
                    console.log('❌ User with email already exists');
                    return res.status(400).json({
                        return_code: 'DUPLICATE_EMAIL_ERROR',
                        message: 'User with this email already exists'
                    });
                }
            }

            // Create user
            const result = await client.query(`
                INSERT INTO app_user (email, display_name, is_managed, created_by_user_id, email_verified)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, email, display_name, is_managed, created_at
            `, [email, display_name, is_managed, created_by_user_id, false]);

            const user = result.rows[0];
            console.log(`✅ User created successfully with ID: ${user.id}`);

            res.json({
                return_code: 'SUCCESS',
                user_id: user.id,
                email: user.email,
                display_name: user.display_name,
                is_managed: user.is_managed,
                created_at: user.created_at
            });

        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ User creation failed:', error.message);
        res.status(500).json({
            return_code: 'DATABASE_ERROR',
            message: 'Failed to create user',
            error: error.message
        });
    }
});

// Get user
router.post('/get', async (req, res) => {
    try {
        console.log('🔍 Getting user details');
        
        const { user_id, email } = req.body;

        // Validation - need either user_id or email
        if (!user_id && !email) {
            console.log('❌ Validation failed: missing user_id or email');
            return res.status(400).json({
                return_code: 'VALIDATION_ERROR',
                message: 'Provide either user_id or email'
            });
        }

        const client = await pool.connect();
        
        try {
            let query = `
                SELECT id, email, display_name, is_managed, created_by_user_id,
                       email_verified, created_at, last_active_at
                FROM app_user
                WHERE ${user_id ? 'id = $1' : 'email = $1'}
            `;
            
            const params = [user_id || email];
            const result = await client.query(query, params);

            if (result.rows.length === 0) {
                console.log('❌ User not found');
                return res.status(404).json({
                    return_code: 'USER_NOT_FOUND',
                    message: 'User not found'
                });
            }

            const user = result.rows[0];
            console.log(`✅ User found: ${user.display_name}`);

            res.json({
                return_code: 'SUCCESS',
                user_id: user.id,
                email: user.email,
                display_name: user.display_name,
                is_managed: user.is_managed,
                email_verified: user.email_verified,
                created_at: user.created_at,
                last_active_at: user.last_active_at
            });

        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Get user failed:', error.message);
        res.status(500).json({
            return_code: 'DATABASE_ERROR',
            message: 'Failed to get user',
            error: error.message
        });
    }
});

module.exports = router;