/*
=======================================================================================================================================
API Route: get-rounds
=======================================================================================================================================
Method: POST
Purpose: Retrieve all rounds for a specific competition with fixture counts, lock status, and proper authorization checks
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123                // integer, required - Competition ID to get rounds for
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "competition": {
    "id": 123,                         // integer, competition database ID
    "name": "Premier League LMS",      // string, competition name for context
    "user_access_level": "organiser"   // string, user's access level: "organiser" or "participant"
  },
  "rounds": [                          // array, all rounds for this competition (most recent first)
    {
      "id": 456,                       // integer, round database ID
      "round_number": 3,               // integer, human-readable round number
      "lock_time": "2025-08-25T15:00:00Z", // string, ISO datetime when picks lock
      "is_locked": true,               // boolean, whether round is currently locked
      "fixture_count": 10,             // integer, number of fixtures in this round
      "completed_fixtures": 8,         // integer, number of fixtures with results set
      "created_at": "2025-08-20T10:00:00Z", // string, ISO datetime when round was created
      "status": "COMPLETE"             // string, calculated status: "UPCOMING", "ACTIVE", "LOCKED", "COMPLETE"
    }
  ],
  "summary": {
    "total_rounds": 3,                 // integer, total number of rounds in competition
    "active_round": 3,                 // integer, current active round number (null if none)
    "completed_rounds": 2              // integer, number of completed rounds
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
"VALIDATION_ERROR"      - Missing or invalid competition_id parameter
"COMPETITION_NOT_FOUND" - Competition does not exist in database
"UNAUTHORIZED"          - Invalid JWT token
"ACCESS_DENIED"         - User is not organiser or participant in this competition
"SERVER_ERROR"          - Database error or unexpected server failure
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../database'); // Use central database with transaction support
const { verifyToken } = require('../middleware/auth'); // Use standard verifyToken middleware
const { logApiCall } = require('../utils/apiLogger'); // API call logging utility
const router = express.Router();
// POST endpoint with comprehensive authentication, authorization and enhanced round information
router.post('/', verifyToken, async (req, res) => {
  // Log API call for monitoring/debugging when enabled
  logApiCall('get-rounds');
  
  try {
    const { competition_id } = req.body;
    const user_id = req.user.id; // Set by verifyToken middleware

    // STEP 1: Validate required input parameters with strict type checking
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required and must be an integer"
      });
    }

    // STEP 2: Single comprehensive query to get competition info, verify authorization, and get all round data
    // This eliminates N+1 query problems by combining competition check, authorization, and round data in one call
    // High Performance: Replaces 3 separate queries with 1 optimized query for better user experience
    const mainQuery = `
      WITH competition_access AS (
        -- Get competition info and determine user's access level
        SELECT 
          c.id as competition_id,
          c.name as competition_name,
          c.organiser_id,
          -- Determine user access level for authorization and frontend context
          CASE 
            WHEN c.organiser_id = $2 THEN 'organiser'  -- Full admin access
            WHEN EXISTS (
              SELECT 1 FROM competition_user cu 
              WHERE cu.competition_id = c.id AND cu.user_id = $2
            ) THEN 'participant'  -- Player access
            ELSE 'no_access'  -- No access to this competition
          END as user_access_level
        FROM competition c
        WHERE c.id = $1
      ),
      round_details AS (
        -- Get comprehensive round information with fixture statistics
        SELECT 
          r.id as round_id,
          r.round_number,
          r.lock_time,
          r.created_at,
          -- Get current server time for lock status calculation
          NOW() as current_time,
          -- Count total fixtures in this round
          COUNT(f.id) as fixture_count,
          -- Count fixtures with results (completed fixtures)
          COUNT(CASE WHEN f.result IS NOT NULL THEN 1 END) as completed_fixtures
        FROM round r
        -- LEFT JOIN to include rounds even if they have no fixtures yet
        LEFT JOIN fixture f ON r.id = f.round_id
        WHERE r.competition_id = $1
        GROUP BY r.id, r.round_number, r.lock_time, r.created_at
      )
      SELECT 
        ca.competition_id,
        ca.competition_name,
        ca.user_access_level,
        -- Round details (will be null if no rounds exist)
        rd.round_id,
        rd.round_number,
        rd.lock_time,
        rd.created_at,
        rd.current_time,
        rd.fixture_count,
        rd.completed_fixtures
      FROM competition_access ca
      -- LEFT JOIN to include competition even if no rounds exist
      LEFT JOIN round_details rd ON ca.competition_id = $1
      ORDER BY rd.round_number DESC  -- Most recent rounds first for frontend display
      LIMIT 3                        -- Only show latest 3 rounds in dropdown
    `;

    const mainResult = await query(mainQuery, [competition_id, user_id]);

    // Check if competition exists
    if (mainResult.rows.length === 0) {
      return res.json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition not found or does not exist"
      });
    }

    // Check authorization - user must be organiser or participant
    const firstRow = mainResult.rows[0];
    if (firstRow.user_access_level === 'no_access') {
      return res.json({
        return_code: "ACCESS_DENIED",
        message: "You do not have access to this competition"
      });
    }

    // STEP 3: Process round data and calculate enhanced status information
    // Transform database results into frontend-friendly format with calculated fields
    const rounds = [];
    let totalRounds = 0;
    let completedRounds = 0;
    let activeRound = null;

    // Process each round and calculate status based on current time and fixture completion
    mainResult.rows.forEach(row => {
      // Skip rows where round data is null (competition exists but has no rounds)
      if (!row.round_id) {
        return;
      }

      totalRounds++;
      
      // Calculate if round is currently locked based on server time vs lock time
      const now = new Date(row.current_time);
      const lockTime = new Date(row.lock_time);
      const isLocked = row.lock_time && now >= lockTime;
      
      // Calculate round status based on timing and fixture completion
      // Business Logic: Round lifecycle = UPCOMING → ACTIVE → LOCKED → COMPLETE
      let status;
      const fixtureCount = parseInt(row.fixture_count) || 0;
      const completedFixtures = parseInt(row.completed_fixtures) || 0;
      
      if (completedFixtures === fixtureCount && fixtureCount > 0) {
        status = 'COMPLETE';  // All fixtures have results
        completedRounds++;
      } else if (isLocked) {
        status = 'LOCKED';    // Picks closed, waiting for results
      } else if (fixtureCount > 0) {
        status = 'ACTIVE';    // Has fixtures, picks still open
        if (!activeRound) activeRound = row.round_number; // Track current active round
      } else {
        status = 'UPCOMING';  // Round created but no fixtures added yet
      }

      // Build comprehensive round object with calculated fields
      rounds.push({
        id: row.round_id,
        round_number: row.round_number,
        lock_time: row.lock_time,
        is_locked: isLocked,
        fixture_count: fixtureCount,
        completed_fixtures: completedFixtures,
        created_at: row.created_at,
        status: status
      });
    });

    // STEP 4: Build comprehensive response with competition context and round summary
    // Enhanced response provides more context for frontend components
    return res.json({
      return_code: "SUCCESS",
      competition: {
        id: firstRow.competition_id,
        name: firstRow.competition_name,
        user_access_level: firstRow.user_access_level
      },
      rounds: rounds,
      summary: {
        total_rounds: totalRounds,
        active_round: activeRound,
        completed_rounds: completedRounds
      }
    });

  } catch (error) {
    // Log detailed error information for debugging while protecting sensitive data
    console.error('Get rounds error:', {
      error: error.message,
      stack: error.stack?.substring(0, 500), // Truncate stack trace
      competition_id: req.body?.competition_id,
      user_id: req.user?.id,
      timestamp: new Date().toISOString()
    });
    
    // Return standardized server error response with HTTP 200
    return res.json({
      return_code: "SERVER_ERROR", 
      message: "Failed to retrieve competition rounds"
    });
  }
});

module.exports = router;