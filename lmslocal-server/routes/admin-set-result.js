/*
=======================================================================================================================================
API Route: admin-set-result
=======================================================================================================================================
Method: POST
Purpose: Sets the result for a single fixture in fixture_load table. Converts win/draw choice to score values.
=======================================================================================================================================
Request Payload:
{
  "access_code": "12221",             // string, required - admin access code
  "fixture_id": 123,                  // integer, required - fixture ID from fixture_load
  "result": "home_win"                // string, required - "home_win", "away_win", or "draw"
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "fixture_id": 123,                  // integer, fixture that was updated
  "home_score": 1,                    // integer, score set for home team
  "away_score": 0,                    // integer, score set for away team
  "result": "home_win"                // string, result type that was set
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "VALIDATION_ERROR",
  "message": "Invalid result type. Must be: home_win, away_win, or draw"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"UNAUTHORIZED"          // Invalid access code
"VALIDATION_ERROR"      // Missing fields or invalid result type
"FIXTURE_NOT_FOUND"     // Fixture ID doesn't exist in fixture_load
"SERVER_ERROR"          // Database or server error
=======================================================================================================================================
*/

const express = require('express');
const router = express.Router();
const { query } = require('../database'); // Destructured database import
const { logApiCall } = require('../utils/apiLogger'); // API logging

// Hardcoded access code - must match admin-add-fixtures
const ADMIN_ACCESS_CODE = '12221';

router.post('/', async (req, res) => {
  // Log API call for monitoring
  logApiCall('admin-set-result');

  const { access_code, fixture_id, result } = req.body;

  try {
    // ========================================
    // STEP 1: Validate access code
    // ========================================
    if (!access_code || access_code !== ADMIN_ACCESS_CODE) {
      return res.status(200).json({
        return_code: 'UNAUTHORIZED',
        message: 'Invalid access code'
      });
    }

    // ========================================
    // STEP 2: Validate request payload
    // ========================================
    if (!fixture_id || !result) {
      return res.status(200).json({
        return_code: 'VALIDATION_ERROR',
        message: 'Missing required fields: fixture_id and result required'
      });
    }

    // Validate result type
    const validResults = ['home_win', 'away_win', 'draw'];
    if (!validResults.includes(result)) {
      return res.status(200).json({
        return_code: 'VALIDATION_ERROR',
        message: 'Invalid result type. Must be: home_win, away_win, or draw'
      });
    }

    // ========================================
    // STEP 3: Convert result to score values
    // ========================================
    let home_score, away_score;

    switch (result) {
      case 'home_win':
        home_score = 1;
        away_score = 0;
        break;
      case 'away_win':
        home_score = 0;
        away_score = 1;
        break;
      case 'draw':
        home_score = 1;
        away_score = 1;
        break;
    }

    // ========================================
    // STEP 4: Update fixture in database
    // ========================================
    const updateResult = await query(
      `UPDATE fixture_load
       SET home_score = $1,
           away_score = $2
       WHERE fixture_id = $3
         AND team_list_id = 1
       RETURNING fixture_id`,
      [home_score, away_score, fixture_id]
    );

    // Check if fixture was found and updated
    if (updateResult.rows.length === 0) {
      return res.status(200).json({
        return_code: 'FIXTURE_NOT_FOUND',
        message: 'Fixture not found in fixture_load table'
      });
    }

    // ========================================
    // STEP 5: Return success response
    // ========================================
    return res.status(200).json({
      return_code: 'SUCCESS',
      fixture_id: fixture_id,
      home_score: home_score,
      away_score: away_score,
      result: result
    });

  } catch (error) {
    // ========================================
    // ERROR HANDLING
    // ========================================
    console.error('Error setting result:', error);
    return res.status(200).json({
      return_code: 'SERVER_ERROR',
      message: 'An error occurred while setting the result'
    });
  }
});

module.exports = router;
