/*
=======================================================================================================================================
API Route: get-teams
=======================================================================================================================================
Method: POST
Purpose: Retrieves all active teams for a specific team list or all active teams if no team list specified
=======================================================================================================================================
Request Payload:
{
  "team_list_id": 1                        // integer, optional - ID of specific team list to filter by
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "teams": [
    {
      "id": 1,                             // integer, unique team ID
      "name": "Arsenal",                   // string, full team name
      "short_name": "ARS"                  // string, abbreviated team name for UI display
    }
  ]
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"   // string, user-friendly error description
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"UNAUTHORIZED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  try {
    // Extract optional team list filter from request payload
    const { team_list_id } = req.body;

    // === TEAM RETRIEVAL LOGIC ===
    // Support two modes: filtered by team list OR all teams (backwards compatibility)
    let result;
    
    if (team_list_id && Number.isInteger(team_list_id)) {
      // === FILTERED MODE: Get teams for specific team list ===
      // Used when admin is setting up competition fixtures for a specific league/competition
      // Only returns teams from the specified team list (e.g., Premier League teams only)
      result = await query(`
        SELECT 
          id,                    -- Unique team identifier for database operations
          name,                  -- Full team name for display (e.g., "Arsenal Football Club")
          short_name             -- Abbreviated name for UI space constraints (e.g., "ARS")
        FROM team
        WHERE team_list_id = $1 AND is_active = true
        ORDER BY name ASC      -- Alphabetical ordering for consistent user experience
      `, [team_list_id]);
    } else {
      // === UNFILTERED MODE: Get all active teams ===
      // Backwards compatibility mode for existing API consumers
      // Returns all teams regardless of team list (useful for general team selection)
      result = await query(`
        SELECT 
          id,                    -- Unique team identifier for database operations
          name,                  -- Full team name for display purposes
          short_name             -- Abbreviated name for compact UI display
        FROM team
        WHERE is_active = true   -- Only return teams that are currently active (not archived)
        ORDER BY name ASC      -- Consistent alphabetical sorting
      `);
    }

    // === SUCCESS RESPONSE ===
    // Return teams array ready for frontend consumption (fixture creation, team selection, etc.)
    res.json({
      return_code: "SUCCESS",
      teams: result.rows        // Array of team objects with id, name, and short_name
    });

  } catch (error) {
    // === ERROR HANDLING ===
    // Log detailed error for debugging but return generic message to client for security
    console.error('Get teams error:', error);
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;