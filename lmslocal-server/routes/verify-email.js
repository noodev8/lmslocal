/*
=======================================================================================================================================
Email Verification Routes
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const emailService = require('../services/emailService');
const tokenUtils = require('../utils/tokenUtils');
const router = express.Router();

/*
=======================================================================================================================================
API Route: /verify-email
=======================================================================================================================================
Method: GET
Purpose: Verify user email address via token from email link
=======================================================================================================================================
*/
router.get('/', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Invalid Link - LMS Local</title>
            <style>
              body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
              .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; text-align: center; }
              .error { color: #dc2626; }
              .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>LMS Local</h1>
              <h2 class="error">Invalid Verification Link</h2>
              <p>The verification link is invalid or missing the token.</p>
              <a href="http://localhost:3000/login" class="button">Back to Login</a>
            </div>
          </body>
        </html>
      `);
    }

    // Find user by token
    const result = await query(
      'SELECT id, email, display_name, auth_token_expires, email_verified FROM app_user WHERE auth_token = $1',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Invalid Token - LMS Local</title>
            <style>
              body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
              .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; text-align: center; }
              .error { color: #dc2626; }
              .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>LMS Local</h1>
              <h2 class="error">Invalid or Expired Token</h2>
              <p>This verification link is invalid or has already been used.</p>
              <p>Please request a new verification email or contact support.</p>
              <a href="http://localhost:3000/login" class="button">Back to Login</a>
            </div>
          </body>
        </html>
      `);
    }

    const user = result.rows[0];

    // Check if already verified
    if (user.email_verified) {
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Already Verified - LMS Local</title>
            <style>
              body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
              .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; text-align: center; }
              .success { color: #059669; }
              .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>LMS Local</h1>
              <h2 class="success">Email Already Verified</h2>
              <p>Your email address has already been verified.</p>
              <p>You can now log in to your account.</p>
              <a href="http://localhost:3000/login" class="button">Continue to Login</a>
            </div>
          </body>
        </html>
      `);
    }

    // Check if token expired
    if (tokenUtils.isTokenExpired(user.auth_token_expires)) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Token Expired - LMS Local</title>
            <style>
              body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
              .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; text-align: center; }
              .error { color: #dc2626; }
              .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>LMS Local</h1>
              <h2 class="error">Verification Link Expired</h2>
              <p>This verification link has expired.</p>
              <p>Please request a new verification email.</p>
              <a href="http://localhost:3000/register" class="button">Request New Link</a>
            </div>
          </body>
        </html>
      `);
    }

    // Verify the email
    await query(
      'UPDATE app_user SET email_verified = true, auth_token = NULL, auth_token_expires = NULL, updated_at = NOW() WHERE id = $1',
      [user.id]
    );

    // Success page
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verified - LMS Local</title>
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
            <div class="checkmark"></div>
            <h2>Email Verified Successfully!</h2>
            <p>Welcome <strong>${user.display_name}</strong>!</p>
            <p>Your email address has been verified. You can now log in to your LMS Local account and start creating Last Man Standing competitions.</p>
            <a href="http://localhost:3000/login" class="button">Continue to Login</a>
          </div>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Error - LMS Local</title>
          <style>
            body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; text-align: center; }
            .error { color: #dc2626; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>LMS Local</h1>
            <h2 class="error">Verification Error</h2>
            <p>An error occurred while verifying your email. Please try again or contact support.</p>
            <a href="http://localhost:3000/login" class="button">Back to Login</a>
          </div>
        </body>
      </html>
    `);
  }
});

module.exports = router;