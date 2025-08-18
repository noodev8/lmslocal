/*
=======================================================================================================================================
API Route: /auth/request-login
=======================================================================================================================================
Method: POST
Purpose: Send magic link email for passwordless authentication
=======================================================================================================================================
Request Payload:
{
  "email": "user@example.com"               // string, required - user's email address
}

Success Response:
{
  "return_code": "SUCCESS",
  "message": "Login link sent to email",    // string, confirmation message
  "email": "user@example.com"               // string, email address used
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"EMAIL_SEND_FAILED"
"DATABASE_ERROR"
"SERVER_ERROR"
=======================================================================================================================================

=======================================================================================================================================
API Route: /auth/verify-token
=======================================================================================================================================
Method: POST
Purpose: Verify magic link token and return JWT for authenticated sessions
=======================================================================================================================================
Request Payload:
{
  "token": "abc123xyz789"                   // string, required - auth token from magic link
}

Success Response:
{
  "return_code": "SUCCESS",
  "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", // string, JWT token for future requests
  "user_id": 123,                          // number, user ID
  "display_name": "John Smith",             // string, user's display name
  "email": "user@example.com",              // string, user's email
  "expires_in": "7d"                        // string, token expiry duration
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"TOKEN_INVALID"
"TOKEN_EXPIRED"
"USER_NOT_FOUND"
"DATABASE_ERROR"
"SERVER_ERROR"
=======================================================================================================================================

=======================================================================================================================================
API Route: /auth/validate-jwt
=======================================================================================================================================
Method: POST
Purpose: Validate JWT token and return user information
=======================================================================================================================================
Request Payload:
{
  "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." // string, required - JWT token
}

Success Response:
{
  "return_code": "SUCCESS",
  "valid": true,                            // boolean, token validity
  "user_id": 123,                          // number, user ID
  "display_name": "John Smith",             // string, user's display name
  "email": "user@example.com"               // string, user's email
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"TOKEN_INVALID"
"TOKEN_EXPIRED"
"USER_NOT_FOUND"
"DATABASE_ERROR"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Resend } = require('resend');
const { pool } = require('../config/database');
const router = express.Router();

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Generate secure random token
function generateAuthToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Create HTML email template
function createMagicLinkEmail(magicLink, userDisplayName) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login to Last Man Standing</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 24px; font-weight: bold; color: #2c3e50; margin-bottom: 10px; }
        .subtitle { color: #7f8c8d; font-size: 16px; }
        .content { margin-bottom: 30px; }
        .login-button { display: inline-block; background-color: #3498db; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
        .login-button:hover { background-color: #2980b9; }
        .footer { font-size: 14px; color: #7f8c8d; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ecf0f1; }
        .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🏆 Last Man Standing</div>
            <div class="subtitle">Your login link is ready</div>
        </div>
        
        <div class="content">
            <p>Hello${userDisplayName ? ` ${userDisplayName}` : ''},</p>
            <p>Click the button below to securely log in to your Last Man Standing account:</p>
            
            <div style="text-align: center;">
                <a href="${magicLink}" class="login-button">🔐 Log In to LMS</a>
            </div>
            
            <div class="warning">
                <strong>⚠️ Security Note:</strong> This login link will expire in 30 minutes for your security. Do not share this link with anyone.
            </div>
            
            <p>If you didn't request this login link, you can safely ignore this email.</p>
        </div>
        
        <div class="footer">
            <p>This email was sent from Last Man Standing<br>
            If you have any questions, please contact your competition organizer.</p>
            <p><em>Link expires: 30 minutes from now</em></p>
        </div>
    </div>
</body>
</html>`;
}

// Request login (send magic link)
router.post('/request-login', async (req, res) => {
    try {
        console.log('🔐 Processing login request');
        
        const { email } = req.body;

        // Validation
        if (!email) {
            console.log('❌ Validation failed: missing email');
            return res.status(400).json({
                return_code: 'VALIDATION_ERROR',
                message: 'Missing required field: email'
            });
        }

        // Basic email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            console.log('❌ Validation failed: invalid email format');
            return res.status(400).json({
                return_code: 'VALIDATION_ERROR',
                message: 'Invalid email format'
            });
        }

        const client = await pool.connect();
        
        try {
            // Find or create user
            let user = await client.query(
                'SELECT id, display_name, email FROM app_user WHERE email = $1 AND is_managed = false',
                [email]
            );

            let userId, displayName;
            if (user.rows.length === 0) {
                // Create new user (email as display name initially)
                const displayNameFromEmail = email.split('@')[0];
                const newUser = await client.query(
                    'INSERT INTO app_user (email, display_name, is_managed, email_verified) VALUES ($1, $2, $3, $4) RETURNING id, display_name',
                    [email, displayNameFromEmail, false, false]
                );
                userId = newUser.rows[0].id;
                displayName = newUser.rows[0].display_name;
                console.log(`👤 Created new user with ID: ${userId}`);
            } else {
                userId = user.rows[0].id;
                displayName = user.rows[0].display_name;
                console.log(`👤 Using existing user with ID: ${userId}`);
            }

            // Generate auth token and expiry
            const authToken = generateAuthToken();
            const expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + 30); // 30 minutes from now

            // Store auth token in database
            await client.query(
                'UPDATE app_user SET auth_token = $1, auth_token_expires = $2, last_active_at = CURRENT_TIMESTAMP WHERE id = $3',
                [authToken, expiresAt, userId]
            );

            // Create magic link
            const magicLink = `${process.env.EMAIL_VERIFICATION_URL}/api/auth/verify-token?token=${authToken}`;

            // Send email via Resend
            const emailResult = await resend.emails.send({
                from: `${process.env.EMAIL_NAME} <${process.env.EMAIL_FROM}>`,
                to: [email],
                subject: '🔐 Your Last Man Standing Login Link',
                html: createMagicLinkEmail(magicLink, displayName)
            });

            console.log('📧 Email sent via Resend:', emailResult.data?.id);

            res.json({
                return_code: 'SUCCESS',
                message: 'Login link sent to email',
                email: email
            });

        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Login request failed:', error.message);
        
        // Check if it's a Resend error
        if (error.name === 'ResendError') {
            return res.status(500).json({
                return_code: 'EMAIL_SEND_FAILED',
                message: 'Failed to send login email',
                error: error.message
            });
        }

        res.status(500).json({
            return_code: 'DATABASE_ERROR',
            message: 'Failed to process login request',
            error: error.message
        });
    }
});

// Verify token and return JWT
router.post('/verify-token', async (req, res) => {
    try {
        console.log('🔍 Verifying auth token');
        
        const { token } = req.body;

        // Validation
        if (!token) {
            console.log('❌ Validation failed: missing token');
            return res.status(400).json({
                return_code: 'VALIDATION_ERROR',
                message: 'Missing required field: token'
            });
        }

        const client = await pool.connect();
        
        try {
            // Find user with this auth token
            const result = await client.query(
                'SELECT id, email, display_name, auth_token_expires FROM app_user WHERE auth_token = $1 AND is_managed = false',
                [token]
            );

            if (result.rows.length === 0) {
                console.log('❌ Invalid auth token');
                return res.status(401).json({
                    return_code: 'TOKEN_INVALID',
                    message: 'Invalid or expired token'
                });
            }

            const user = result.rows[0];

            // Check if token is expired
            if (new Date() > new Date(user.auth_token_expires)) {
                console.log('❌ Auth token expired');
                return res.status(401).json({
                    return_code: 'TOKEN_EXPIRED',
                    message: 'Token has expired'
                });
            }

            // Clear the auth token (one-time use)
            await client.query(
                'UPDATE app_user SET auth_token = NULL, auth_token_expires = NULL, email_verified = true, last_active_at = CURRENT_TIMESTAMP WHERE id = $1',
                [user.id]
            );

            // Generate JWT
            const jwtPayload = {
                user_id: user.id,
                email: user.email,
                display_name: user.display_name
            };

            const jwtToken = jwt.sign(jwtPayload, process.env.JWT_SECRET, {
                expiresIn: process.env.JWT_EXPIRES_IN || '7d'
            });

            console.log(`✅ Token verified for user: ${user.display_name}`);

            res.json({
                return_code: 'SUCCESS',
                jwt: jwtToken,
                user_id: user.id,
                display_name: user.display_name,
                email: user.email,
                expires_in: process.env.JWT_EXPIRES_IN || '7d'
            });

        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Token verification failed:', error.message);
        res.status(500).json({
            return_code: 'DATABASE_ERROR',
            message: 'Failed to verify token',
            error: error.message
        });
    }
});

// Alternative route for direct browser access (GET with query param)
router.get('/verify-token', async (req, res) => {
    try {
        const { token } = req.query;
        
        if (!token) {
            return res.status(400).send(`
                <html><body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                    <h2>❌ Invalid Link</h2>
                    <p>This login link is missing required information.</p>
                </body></html>
            `);
        }

        // Use the same verification logic but return different response
        const mockReq = { body: { token } };
        const mockRes = {
            json: (data) => {
                if (data.return_code === 'SUCCESS') {
                    return res.send(`
                        <html><body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                            <h2>✅ Login Successful!</h2>
                            <p>Welcome back, ${data.display_name}!</p>
                            <p><strong>Your JWT Token:</strong></p>
                            <textarea style="width: 90%; height: 100px; font-family: monospace;" readonly>${data.jwt}</textarea>
                            <p><em>Copy this token for API requests</em></p>
                            <p><small>Token expires in: ${data.expires_in}</small></p>
                        </body></html>
                    `);
                } else {
                    return res.status(401).send(`
                        <html><body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                            <h2>❌ ${data.message}</h2>
                            <p>This login link may have expired or been used already.</p>
                        </body></html>
                    `);
                }
            },
            status: (code) => ({ json: mockRes.json, send: (html) => res.status(code).send(html) })
        };

        // Call the POST handler logic
        await router.post('/verify-token', mockReq, mockRes);

    } catch (error) {
        console.error('❌ GET token verification failed:', error.message);
        res.status(500).send(`
            <html><body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h2>❌ Server Error</h2>
                <p>Something went wrong. Please try again.</p>
            </body></html>
        `);
    }
});

// Validate JWT
router.post('/validate-jwt', async (req, res) => {
    try {
        console.log('🔍 Validating JWT token');
        
        const { jwt: jwtToken } = req.body;

        // Validation
        if (!jwtToken) {
            console.log('❌ Validation failed: missing JWT');
            return res.status(400).json({
                return_code: 'VALIDATION_ERROR',
                message: 'Missing required field: jwt'
            });
        }

        // Verify JWT
        const decoded = jwt.verify(jwtToken, process.env.JWT_SECRET);
        console.log(`✅ JWT valid for user: ${decoded.display_name}`);

        res.json({
            return_code: 'SUCCESS',
            valid: true,
            user_id: decoded.user_id,
            display_name: decoded.display_name,
            email: decoded.email
        });

    } catch (error) {
        console.error('❌ JWT validation failed:', error.message);
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                return_code: 'TOKEN_EXPIRED',
                valid: false,
                message: 'JWT token has expired'
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                return_code: 'TOKEN_INVALID',
                valid: false,
                message: 'Invalid JWT token'
            });
        }

        res.status(500).json({
            return_code: 'SERVER_ERROR',
            valid: false,
            message: 'Failed to validate JWT',
            error: error.message
        });
    }
});

module.exports = router;