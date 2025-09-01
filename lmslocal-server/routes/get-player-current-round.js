/*
=======================================================================================================================================
API Route: get-player-current-round
=======================================================================================================================================
Method: POST
Purpose: Get current round information, fixtures, and player's pick for a competition with optimized single-query performance
=======================================================================================================================================
Request Payload:
{
  "slug": "10001"                      // string, required - Competition slug for player access
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "current_round": {
    "id": 1,                           // integer, round database ID
    "round_number": 1,                 // integer, human-readable round number
    "lock_time": "2025-08-26T14:00:00Z", // string, ISO datetime when picks lock
    "is_locked": false,                // boolean, whether picks are currently locked
    "fixtures": [                      // array, all fixtures for this round
      {
        "id": 16,                      // integer, fixture database ID
        "home_team": "Arsenal",        // string, home team full name
        "away_team": "Aston Villa",    // string, away team full name
        "home_team_short": "ARS",      // string, home team short code
        "away_team_short": "AVL",      // string, away team short code
        "kickoff_time": "2025-08-26T15:00:00Z" // string, ISO datetime of kickoff
      }
    ]
  },
  "player_pick": {                     // object, player's pick for current round (null if no pick)
    "team": "ARS",                     // string, team short code player picked
    "fixture_id": 16,                  // integer, fixture ID player picked from
    "created_at": "2025-08-25T10:00:00Z" // string, ISO datetime when pick was made
  },
  "competition": {
    "id": 123,                         // integer, competition database ID
    "name": "Premier League Survivor", // string, competition display name
    "status": "UNLOCKED"               // string, competition status
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"  // string, user-friendly error description
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"      - Missing or invalid slug parameter
"COMPETITION_NOT_FOUND" - Competition does not exist or is inaccessible
"UNAUTHORIZED"          - Invalid or missing JWT token
"NOT_MEMBER"           - User is not a member of this competition
"NO_ROUNDS"            - Competition exists but no rounds have been created yet
"SERVER_ERROR"         - Database error or unexpected server failure
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../database'); // Use central database with transaction support
const { verifyToken } = require('../middleware/auth'); // Use standard verifyToken middleware
const router = express.Router();
// POST endpoint with comprehensive authentication and optimized single-query data retrieval
router.post('/', verifyToken, async (req, res) => {
  try {
    const { slug } = req.body;
    const user_id = req.user.id; // Set by verifyToken middleware

    // Validate required input parameters with strict type checking
    if (!slug || typeof slug !== 'string') {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Competition slug is required and must be a string"
      });
    }

    // STEP 1: Single optimized query to get all required data
    // This eliminates N+1 query problems by joining all necessary tables in one database call
    // Main query: Get competition, verify membership, get current round, and player pick
    // This replaces 5 separate queries with 1 comprehensive query for optimal performance
    const mainQuery = `
      WITH current_round_cte AS (
        -- Get the current round (latest round by round_number for this competition)
        SELECT 
          r.id as round_id,
          r.round_number,
          r.lock_time,
          r.competition_id
        FROM competition c
        INNER JOIN round r ON c.id = r.competition_id
        WHERE c.slug = $1
        ORDER BY r.round_number DESC
        LIMIT 1
      )
      SELECT 
        -- Competition information
        c.id as competition_id,
        c.name as competition_name,
        c.status as competition_status,
        c.slug as competition_slug,
        
        -- User membership verification
        cu.status as user_status,
        cu.lives_remaining,
        
        -- Current round information (null if no rounds exist)
        crc.round_id,
        crc.round_number,
        crc.lock_time,
        
        -- Current time for lock calculation
        NOW() as current_time,
        
        -- Player's pick for current round (null if no pick made)
        p.team as player_pick_team,
        p.fixture_id as player_pick_fixture_id,
        p.created_at as player_pick_created_at
        
      FROM competition c
      -- Verify user membership in competition (INNER JOIN ensures user is member)
      INNER JOIN competition_user cu ON c.id = cu.competition_id AND cu.user_id = $2
      -- Get current round info (LEFT JOIN allows competitions with no rounds)
      LEFT JOIN current_round_cte crc ON c.id = crc.competition_id
      -- Get player's pick for current round (LEFT JOIN allows no pick made yet)
      LEFT JOIN pick p ON crc.round_id = p.round_id AND p.user_id = $2
      WHERE c.slug = $1
    `;

    const mainResult = await query(mainQuery, [slug, user_id]);

    // Check if competition exists and user is a member
    if (mainResult.rows.length === 0) {
      // Could be competition not found OR user not a member - check which one for better error message
      const competitionCheck = await query('SELECT id FROM competition WHERE slug = $1', [slug]);
      
      if (competitionCheck.rows.length === 0) {
        return res.json({
          return_code: "COMPETITION_NOT_FOUND",
          message: "Competition not found or access denied"
        });
      } else {
        return res.json({
          return_code: "NOT_MEMBER",
          message: "You are not a member of this competition"
        });
      }
    }

    const mainData = mainResult.rows[0];

    // If no rounds exist, return early with appropriate response
    if (!mainData.round_id) {
      return res.json({
        return_code: "NO_ROUNDS",
        current_round: null,
        player_pick: null,
        competition: {
          id: mainData.competition_id,
          name: mainData.competition_name,
          status: mainData.competition_status
        },
        message: "No rounds have been created for this competition yet"
      });
    }

    // Get fixtures for the current round (separate query for clean data structure)
    // This is acceptable as it's only 1 additional query vs the original 5 queries
    const fixturesQuery = `
      SELECT 
        id,
        home_team,
        away_team,
        home_team_short,
        away_team_short,
        kickoff_time
      FROM fixture
      WHERE round_id = $1
      ORDER BY kickoff_time ASC
    `;
    const fixturesResult = await query(fixturesQuery, [mainData.round_id]);

    // Calculate if round is locked based on current time vs lock time
    const now = new Date(mainData.current_time);
    const lockTime = new Date(mainData.lock_time);
    const isLocked = now >= lockTime;

    // Build player pick object (null if no pick made)
    const playerPick = mainData.player_pick_team ? {
      team: mainData.player_pick_team,
      fixture_id: mainData.player_pick_fixture_id,
      created_at: mainData.player_pick_created_at
    } : null;

    // Return successful response with all data using HTTP 200 as per API standards
    return res.json({
      return_code: "SUCCESS",
      current_round: {
        id: mainData.round_id,
        round_number: mainData.round_number,
        lock_time: mainData.lock_time,
        is_locked: isLocked,
        fixtures: fixturesResult.rows
      },
      player_pick: playerPick,
      competition: {
        id: mainData.competition_id,
        name: mainData.competition_name,
        status: mainData.competition_status
      }
    });

  } catch (error) {
    // Log detailed error information for debugging while protecting sensitive data
    console.error('Get player current round error:', {
      error: error.message,
      stack: error.stack?.substring(0, 500), // Truncate stack trace
      slug: req.body?.slug,
      user_id: req.user?.id,
      timestamp: new Date().toISOString()
    });
    
    // Return standardized server error response with HTTP 200
    return res.json({
      return_code: "SERVER_ERROR", 
      message: "Failed to retrieve current round information"
    });
  }
});

module.exports = router;