/*
=======================================================================================================================================
API Route: unsubscribe
=======================================================================================================================================
Method: GET
Purpose: One-click email unsubscribe via link in emails. Decodes JWT token, saves preference to email_preference table,
         and returns a simple HTML confirmation page. No login required (same pattern as verify-email.js).
=======================================================================================================================================
Request Parameters (Query String):
{
  "token": "eyJhbGciOi..."                  // string, required - JWT unsubscribe token from email link
}

Success Response (ALWAYS HTTP 200 - HTML Page):
- User-friendly HTML page confirming unsubscribe from competition announcements
- Preference saved to email_preference table

Error Response (ALWAYS HTTP 200 - HTML Page):
- User-friendly HTML error page for invalid/missing token
=======================================================================================================================================
Response Types:
"SUCCESS_PAGE"              - Successfully unsubscribed
"INVALID_TOKEN_PAGE"        - Token missing, invalid, or wrong purpose
"SERVER_ERROR_PAGE"         - Database error or unexpected server failure
=======================================================================================================================================
Note: This is a GET route exception to the "all routes use POST" rule, same as verify-email.js.
      Email links must be clickable without JS/forms.
=======================================================================================================================================
*/

const express = require('express');
const jwt = require('jsonwebtoken');
const { query } = require('../database');
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();

// Environment-aware frontend URL generator (same pattern as verify-email.js)
// Returns appropriate frontend URL based on environment configuration
const getFrontendUrl = () => {
  if (process.env.CLIENT_URL) {
    // CLIENT_URL may contain comma-separated URLs, use the first one
    const urls = process.env.CLIENT_URL.split(',').map(url => url.trim());
    return urls[0] || 'http://localhost:3000';
  }
  return 'http://localhost:3000';
};

// HTML template generator for consistent page styling (same pattern as verify-email.js)
const generateHtmlPage = (title, heading, message, buttonText, buttonLink, isSuccess = false) => {
  const headingClass = isSuccess ? 'success' : 'error';
  const checkmark = isSuccess ? '<div class="checkmark"></div>' : '';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title} - LMS Local</title>
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
          .error { color: #dc2626; }
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
            content: '\\2713';
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
          ${checkmark}
          <h2 class="${headingClass}">${heading}</h2>
          ${message}
          <a href="${buttonLink}" class="button">${buttonText}</a>
        </div>
      </body>
    </html>
  `;
};

// GET endpoint - unsubscribe via email link click (no login required)
router.get('/', async (req, res) => {
  logApiCall('unsubscribe');

  try {
    const { token } = req.query;
    const frontendUrl = getFrontendUrl();

    // === STEP 1: Validate token is present ===
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return res.send(generateHtmlPage(
        'Invalid Link',
        'Invalid Unsubscribe Link',
        '<p>The unsubscribe link is invalid or missing the token.</p><p>Please check your email for the correct unsubscribe link.</p>',
        'Go to LMS Local',
        `${frontendUrl}`
      ));
    }

    // === STEP 2: Decode and verify JWT token ===
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      // JWT verification failed (invalid signature, malformed, etc.)
      console.error('Unsubscribe JWT verification failed:', jwtError.message);
      return res.send(generateHtmlPage(
        'Invalid Token',
        'Invalid Unsubscribe Link',
        '<p>This unsubscribe link is invalid or has been tampered with.</p><p>Please use the unsubscribe link from a recent email.</p>',
        'Go to LMS Local',
        `${frontendUrl}`
      ));
    }

    // === STEP 3: Validate token purpose ===
    // Ensure the token was created for unsubscribe, not some other purpose
    if (decoded.purpose !== 'unsubscribe') {
      return res.send(generateHtmlPage(
        'Invalid Token',
        'Invalid Unsubscribe Link',
        '<p>This link is not a valid unsubscribe link.</p>',
        'Go to LMS Local',
        `${frontendUrl}`
      ));
    }

    // Extract fields from decoded token
    const { user_id, email_type } = decoded;

    // Validate required fields exist in token
    if (!user_id || !email_type) {
      return res.send(generateHtmlPage(
        'Invalid Token',
        'Invalid Unsubscribe Link',
        '<p>This unsubscribe link is missing required information.</p>',
        'Go to LMS Local',
        `${frontendUrl}`
      ));
    }

    // === STEP 4: Upsert email preference ===
    // Set enabled=false for this email_type at the global level (competition_id=0)
    // Check if preference already exists
    const existingPref = await query(`
      SELECT id
      FROM email_preference
      WHERE user_id = $1
        AND competition_id = 0
        AND email_type = $2
    `, [user_id, email_type]);

    if (existingPref.rows.length > 0) {
      // Update existing preference to disabled
      await query(`
        UPDATE email_preference
        SET enabled = false,
            updated_at = NOW()
        WHERE user_id = $1
          AND competition_id = 0
          AND email_type = $2
      `, [user_id, email_type]);
    } else {
      // Insert new preference as disabled
      await query(`
        INSERT INTO email_preference (
          user_id,
          competition_id,
          email_type,
          enabled,
          updated_at
        ) VALUES (
          $1, 0, $2, false, NOW()
        )
      `, [user_id, email_type]);
    }

    // === STEP 5: Return success HTML page ===
    // Format email_type for display (e.g., 'competition_announcement' -> 'competition announcements')
    const displayEmailType = email_type.replace(/_/g, ' ') + 's';

    return res.send(generateHtmlPage(
      'Unsubscribed',
      'Successfully Unsubscribed',
      `<p>You have been unsubscribed from <strong>${displayEmailType}</strong>.</p><p>You will no longer receive these emails from LMS Local.</p><p style="color: #9ca3af; font-size: 13px; margin-top: 20px;">If you change your mind, you can re-enable notifications in your profile settings.</p>`,
      'Go to LMS Local',
      `${frontendUrl}`,
      true // isSuccess
    ));

  } catch (error) {
    console.error('Error in unsubscribe:', {
      error: error.message,
      stack: error.stack,
      token_present: !!req.query?.token
    });

    const frontendUrl = getFrontendUrl();
    return res.send(generateHtmlPage(
      'Unsubscribe Error',
      'Something Went Wrong',
      '<p>An error occurred while processing your unsubscribe request.</p><p>Please try again or contact support if the problem persists.</p>',
      'Go to LMS Local',
      `${frontendUrl}`
    ));
  }
});

module.exports = router;
