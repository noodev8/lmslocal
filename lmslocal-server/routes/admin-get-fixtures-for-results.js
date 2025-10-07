/*
=======================================================================================================================================
API Route: admin-get-fixtures-for-results
=======================================================================================================================================
Method: POST
Purpose: Gets fixtures from the LOWEST gameweek in fixture_load that have NULL scores (need results entered)
=======================================================================================================================================
Request Payload:
{
  "access_code": "12221"              // string, required - admin access code
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "gameweek": 12,                     // integer, the gameweek number
  "fixtures": [                       // array of fixtures needing results
    {
      "fixture_id": 123,              // integer, unique fixture ID
      "home_team_short": "ARS",       // string, home team code
      "away_team_short": "CHE",       // string, away team code
      "kickoff_time": "2025-10-15T15:00:00Z",  // string, ISO datetime
      "home_score": null,             // null (always null for this endpoint)
      "away_score": null              // null (always null for this endpoint)
    }
  ],
  "total_fixtures": 10,               // integer, total fixtures in this gameweek
  "remaining_fixtures": 10            // integer, fixtures without results
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "UNAUTHORIZED",
  "message": "Invalid access code"
}

No Fixtures Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "gameweek": null,
  "fixtures": [],
  "total_fixtures": 0,
  "remaining_fixtures": 0,
  "message": "All fixtures have results"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"UNAUTHORIZED"          // Invalid access code
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
  logApiCall('admin-get-fixtures-for-results');

  const { access_code } = req.body;

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
    // STEP 2: Find the LOWEST gameweek with NULL scores
    // ========================================
    const gameweekQuery = await query(
      `SELECT MIN(gameweek) as lowest_gameweek
       FROM fixture_load
       WHERE team_list_id = 1
         AND (home_score IS NULL OR away_score IS NULL)`
    );

    const lowestGameweek = gameweekQuery.rows[0]?.lowest_gameweek;

    // If no gameweek found, all results are entered
    if (!lowestGameweek) {
      return res.status(200).json({
        return_code: 'SUCCESS',
        gameweek: null,
        fixtures: [],
        total_fixtures: 0,
        remaining_fixtures: 0,
        message: 'All fixtures have results'
      });
    }

    // ========================================
    // STEP 3: Get all fixtures from that gameweek with NULL scores
    // ========================================
    const fixturesQuery = await query(
      `SELECT
         fixture_id,
         home_team_short,
         away_team_short,
         kickoff_time,
         home_score,
         away_score
       FROM fixture_load
       WHERE team_list_id = 1
         AND gameweek = $1
         AND (home_score IS NULL OR away_score IS NULL)
       ORDER BY kickoff_time ASC, fixture_id ASC`,
      [lowestGameweek]
    );

    // ========================================
    // STEP 4: Get total count for this gameweek
    // ========================================
    const totalQuery = await query(
      `SELECT COUNT(*) as total
       FROM fixture_load
       WHERE team_list_id = 1
         AND gameweek = $1`,
      [lowestGameweek]
    );

    const totalFixtures = parseInt(totalQuery.rows[0].total, 10);
    const remainingFixtures = fixturesQuery.rows.length;

    // ========================================
    // STEP 5: Return success response
    // ========================================
    return res.status(200).json({
      return_code: 'SUCCESS',
      gameweek: lowestGameweek,
      fixtures: fixturesQuery.rows,
      total_fixtures: totalFixtures,
      remaining_fixtures: remainingFixtures
    });

  } catch (error) {
    // ========================================
    // ERROR HANDLING
    // ========================================
    console.error('Error getting fixtures for results:', error);
    return res.status(200).json({
      return_code: 'SERVER_ERROR',
      message: 'An error occurred while fetching fixtures'
    });
  }
});

module.exports = router;
