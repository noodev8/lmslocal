/*
=======================================================================================================================================
API Route: get-calculated-fixtures
=======================================================================================================================================
Method: POST
Purpose: Retrieve fixtures that have been processed for pick calculations in a specific round with proper authorization checks
=======================================================================================================================================
Request Payload:
{
  "round_id": 123                      // integer, required - ID of round to check for calculated fixtures
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "round_info": {
    "id": 123,                         // integer, round database ID
    "round_number": 3,                 // integer, human-readable round number
    "competition_id": 456,             // integer, competition this round belongs to
    "competition_name": "Premier League", // string, competition name for context
    "total_fixtures": 10,              // integer, total number of fixtures in this round
    "calculated_fixtures": 7           // integer, number of fixtures that have been processed
  },
  "calculated_fixture_ids": [123, 124, 125], // array of integers, fixture IDs that have been processed
  "calculated_fixtures": [             // array, detailed info about processed fixtures
    {
      "id": 123,                       // integer, fixture database ID
      "home_team": "Arsenal",          // string, home team name
      "away_team": "Chelsea",          // string, away team name
      "home_team_short": "ARS",        // string, home team short code
      "away_team_short": "CHE",        // string, away team short code
      "kickoff_time": "2025-08-26T15:00:00Z", // string, ISO datetime of kickoff
      "result": "ARS",                 // string, match result (team short code or "DRAW" or null)
      "processed_at": "2025-08-26T17:30:00Z"  // string, ISO datetime when fixture was processed
    }
  ]
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"  // string, user-friendly error description
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"      - Missing or invalid round_id parameter
"ROUND_NOT_FOUND"       - Round does not exist in database
"UNAUTHORIZED"          - Invalid JWT token or user lacks access to this round
"COMPETITION_ACCESS_DENIED" - User is not organiser or participant in this competition
"SERVER_ERROR"          - Database error or unexpected server failure
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../database'); // Use central database with transaction support
const { verifyToken } = require('../middleware/auth'); // Use standard verifyToken middleware
const router = express.Router();

// POST endpoint with comprehensive authentication, authorization and detailed fixture information
router.post('/', verifyToken, async (req, res) => {
  try {
    const { round_id } = req.body;
    const user_id = req.user.id; // Set by verifyToken middleware

    // STEP 1: Validate required input parameters with strict type checking
    if (!round_id || !Number.isInteger(round_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Round ID is required and must be an integer"
      });
    }

    // STEP 2: Single comprehensive query to get round info, verify authorization, and get fixture data
    // This eliminates N+1 query problems by joining all necessary tables in one database call
    // Business Context: "Processed" fixtures are those where pick calculations have been completed
    // This typically happens after fixture results are set and player outcomes are determined
    const mainQuery = `
      WITH round_data AS (
        -- Get round information and verify it exists
        SELECT 
          r.id as round_id,
          r.round_number,
          r.competition_id,
          c.name as competition_name,
          c.organiser_id,
          -- Check if user has access (either organiser or participant)
          CASE 
            WHEN c.organiser_id = $2 THEN 'organiser'
            WHEN EXISTS (
              SELECT 1 FROM competition_user cu 
              WHERE cu.competition_id = c.id AND cu.user_id = $2
            ) THEN 'participant'
            ELSE 'no_access'
          END as user_access_level
        FROM round r
        INNER JOIN competition c ON r.competition_id = c.id
        WHERE r.id = $1
      ),
      fixture_stats AS (
        -- Get fixture processing statistics for this round
        SELECT 
          COUNT(*) as total_fixtures,
          COUNT(CASE WHEN f.processed IS NOT NULL THEN 1 END) as calculated_fixtures
        FROM fixture f
        WHERE f.round_id = $1
      )
      SELECT 
        rd.*,
        fs.total_fixtures,
        fs.calculated_fixtures
      FROM round_data rd
      CROSS JOIN fixture_stats fs
    `;

    const mainResult = await query(mainQuery, [round_id, user_id]);

    // Check if round exists
    if (mainResult.rows.length === 0) {
      return res.json({
        return_code: "ROUND_NOT_FOUND",
        message: "Round not found or does not exist"
      });
    }

    const roundData = mainResult.rows[0];

    // Verify user authorization - must be organiser or participant in competition
    if (roundData.user_access_level === 'no_access') {
      return res.json({
        return_code: "COMPETITION_ACCESS_DENIED",
        message: "You do not have access to this competition"
      });
    }

    // STEP 3: Get detailed information about calculated (processed) fixtures
    // These are fixtures where pick outcomes have been determined and processed
    // This is useful for frontend to show processing progress and fixture status
    const fixturesQuery = `
      SELECT 
        f.id,
        f.home_team,
        f.away_team,
        f.home_team_short,
        f.away_team_short,
        f.kickoff_time,
        f.result,
        f.processed as processed_at
      FROM fixture f
      WHERE f.round_id = $1 
        AND f.processed IS NOT NULL  -- Only fixtures that have been processed
      ORDER BY f.kickoff_time ASC
    `;

    const fixturesResult = await query(fixturesQuery, [round_id]);

    // Extract fixture IDs for backward compatibility (some frontends may only need IDs)
    const calculatedFixtureIds = fixturesResult.rows.map(row => row.id);

    // Build comprehensive response with round context and detailed fixture information
    // This provides both summary statistics and detailed fixture data in one response
    return res.json({
      return_code: "SUCCESS",
      round_info: {
        id: roundData.round_id,
        round_number: roundData.round_number,
        competition_id: roundData.competition_id,
        competition_name: roundData.competition_name,
        total_fixtures: parseInt(roundData.total_fixtures) || 0,
        calculated_fixtures: parseInt(roundData.calculated_fixtures) || 0
      },
      calculated_fixture_ids: calculatedFixtureIds, // For backward compatibility
      calculated_fixtures: fixturesResult.rows.map(row => ({
        id: row.id,
        home_team: row.home_team,
        away_team: row.away_team,
        home_team_short: row.home_team_short,
        away_team_short: row.away_team_short,
        kickoff_time: row.kickoff_time,
        result: row.result,
        processed_at: row.processed_at
      }))
    });

  } catch (error) {
    // Log detailed error information for debugging while protecting sensitive data
    console.error('Get calculated fixtures error:', {
      error: error.message,
      stack: error.stack?.substring(0, 500), // Truncate stack trace
      round_id: req.body?.round_id,
      user_id: req.user?.id,
      timestamp: new Date().toISOString()
    });
    
    // Return standardized server error response with HTTP 200
    return res.json({
      return_code: "SERVER_ERROR", 
      message: "Failed to retrieve calculated fixtures information"
    });
  }
});

module.exports = router;