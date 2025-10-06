/*
=======================================================================================================================================
API Route: admin-add-fixtures
=======================================================================================================================================
Method: POST
Purpose: Allows admin to add fixtures to the fixture_load staging table for distribution to competitions.
=======================================================================================================================================
Request Payload:
{
  "access_code": "your-secret-code",         // string, required - hardcoded admin access
  "kickoff_time": "2025-10-15T15:00:00Z",    // string, required - ISO 8601 datetime for all fixtures
  "fixtures": [                              // array, required - list of fixtures to add
    {
      "home_team_short": "ARS",              // string, required - home team abbreviation
      "away_team_short": "CHE"               // string, required - away team abbreviation
    }
  ]
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "fixtures_added": 5,                       // integer, count of fixtures added
  "gameweek": 12                             // integer, gameweek number assigned
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "UNAUTHORIZED",
  "message": "Invalid access code"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"UNAUTHORIZED"          // Invalid access code
"VALIDATION_ERROR"      // Missing required fields or invalid data
"SERVER_ERROR"          // Database or server error
=======================================================================================================================================
*/

const express = require('express');
const router = express.Router();
const { query, transaction } = require('../database'); // Destructured database import
const { logApiCall } = require('../utils/apiLogger'); // API logging

// Hardcoded access code - change this to your secret code
const ADMIN_ACCESS_CODE = '12221';

router.post('/', async (req, res) => {
  // Log API call for monitoring
  logApiCall('admin-add-fixtures');

  const { access_code, kickoff_time, fixtures } = req.body;

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
    if (!kickoff_time || !fixtures || !Array.isArray(fixtures) || fixtures.length === 0) {
      return res.status(200).json({
        return_code: 'VALIDATION_ERROR',
        message: 'Missing required fields: kickoff_time and fixtures array required'
      });
    }

    // Validate each fixture has required fields
    for (let i = 0; i < fixtures.length; i++) {
      const fixture = fixtures[i];
      if (!fixture.home_team_short || !fixture.away_team_short) {
        return res.status(200).json({
          return_code: 'VALIDATION_ERROR',
          message: `Fixture at index ${i} missing home_team_short or away_team_short`
        });
      }
    }

    // ========================================
    // STEP 3: Get next gameweek number
    // ========================================
    const gameweekQuery = await query(
      'SELECT COALESCE(MAX(gameweek), 0) + 1 AS next_gameweek FROM fixture_load WHERE team_list_id = 1'
    );
    const nextGameweek = gameweekQuery.rows[0].next_gameweek;

    // ========================================
    // STEP 4: Insert fixtures in a transaction
    // ========================================
    await transaction(async (client) => {
      // Insert all fixtures with the same gameweek and kickoff time
      for (const fixture of fixtures) {
        await client.query(
          `INSERT INTO fixture_load
           (team_list_id, league, home_team_short, away_team_short, kickoff_time, gameweek, results_pushed)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            1,                            // team_list_id - always 1 for now
            'Premier League',             // league - always Premier League for now
            fixture.home_team_short,      // home team abbreviation
            fixture.away_team_short,      // away team abbreviation
            kickoff_time,                 // kickoff time (same for all)
            nextGameweek,                 // gameweek number
            false                         // results_pushed - initially false
          ]
        );
      }
    });

    // ========================================
    // STEP 5: Return success response
    // ========================================
    return res.status(200).json({
      return_code: 'SUCCESS',
      fixtures_added: fixtures.length,
      gameweek: nextGameweek
    });

  } catch (error) {
    // ========================================
    // ERROR HANDLING
    // ========================================
    console.error('Error adding fixtures:', error);
    return res.status(200).json({
      return_code: 'SERVER_ERROR',
      message: 'An error occurred while adding fixtures'
    });
  }
});

module.exports = router;
