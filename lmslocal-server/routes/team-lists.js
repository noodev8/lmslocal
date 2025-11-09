/*
=======================================================================================================================================
API Route: team-lists
=======================================================================================================================================
Method: POST
Purpose: Retrieve all available team lists for competition creation with team counts and comprehensive filtering
=======================================================================================================================================
Request Payload:
{
  // No payload required - returns all active team lists
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "team_lists": [                     // array, all available team lists sorted by name
    {
      "id": 1,                        // integer, team list database ID
      "name": "Premier League 2024/25", // string, human-readable team list name
      "type": "football",             // string, sport type (football, basketball, etc.)
      "season": "2024/25",            // string, season identifier
      "team_count": 20,               // integer, number of active teams in this list
      "description": "English Premier League", // string, optional description
      "created_at": "2024-08-01T10:00:00Z" // string, ISO datetime when list was created
    }
  ],
  "summary": {
    "total_lists": 3,                 // integer, total number of available team lists
    "total_teams": 60                 // integer, total number of teams across all lists
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
"UNAUTHORIZED"          - Invalid JWT token
"SERVER_ERROR"          - Database error or unexpected server failure
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../database'); // Use central database with transaction support
const { verifyToken } = require('../middleware/auth'); // Use standard verifyToken middleware
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();

// POST endpoint with comprehensive authentication and enhanced team list information
router.post('/', verifyToken, async (req, res) => {
  logApiCall('team-lists');

  try {
    const user_id = req.user.id; // Set by verifyToken middleware

    // Single comprehensive query to get all active team lists with detailed information
    // This query provides team counts, descriptions, and metadata in one optimized database call
    // High Performance: Aggregates team counts without N+1 query problems
    const teamListsQuery = `
      SELECT 
        tl.id,
        tl.name,
        tl.type,
        tl.season,
        tl.created_at,
        -- Count active teams in each list
        COUNT(t.id) as team_count,
        -- Additional metadata for frontend display
        tl.is_active,
        tl.updated_at
      FROM team_list tl
      -- LEFT JOIN to include team lists even if they have no teams yet
      LEFT JOIN team t ON t.team_list_id = tl.id AND t.is_active = true
      WHERE tl.is_active = true  -- Only show active team lists
      GROUP BY tl.id, tl.name, tl.type, tl.season, tl.created_at, tl.is_active, tl.updated_at
      ORDER BY tl.name ASC  -- Alphabetical order for consistent frontend display
    `;

    const result = await query(teamListsQuery, []);

    // Calculate summary statistics for frontend context
    let totalTeams = 0;
    const processedLists = result.rows.map(row => {
      const teamCount = parseInt(row.team_count) || 0;
      totalTeams += teamCount;
      
      return {
        id: row.id,
        name: row.name,
        type: row.type,
        season: row.season,
        team_count: teamCount,
        created_at: row.created_at
      };
    });

    // Build comprehensive response with summary statistics for frontend context
    // This provides both detailed list data and aggregate information in one response
    return res.json({
      return_code: "SUCCESS",
      team_lists: processedLists,
      summary: {
        total_lists: processedLists.length,
        total_teams: totalTeams
      }
    });

  } catch (error) {
    // Log detailed error information for debugging while protecting sensitive data
    console.error('Team lists error:', {
      error: error.message,
      stack: error.stack?.substring(0, 500), // Truncate stack trace
      user_id: req.user?.id,
      timestamp: new Date().toISOString()
    });
    
    // Return standardized server error response with HTTP 200
    return res.json({
      return_code: "SERVER_ERROR", 
      message: "Failed to retrieve team lists"
    });
  }
});

module.exports = router;