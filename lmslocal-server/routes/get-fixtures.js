/*
=======================================================================================================================================
API Route: get-fixtures
=======================================================================================================================================
Method: POST
Purpose: Retrieves all fixtures for a specific round including teams, kickoff times, and results
=======================================================================================================================================
Request Payload:
{
  "round_id": 123                              // integer, required - ID of the round to get fixtures for
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "fixtures": [                                // array, fixtures in chronological order
    {
      "id": 1,                                 // integer, unique fixture ID
      "home_team": "Arsenal",                  // string, full home team name
      "away_team": "Chelsea",                  // string, full away team name
      "home_team_short": "ARS",                // string, abbreviated home team name
      "away_team_short": "CHE",                // string, abbreviated away team name
      "kickoff_time": "2025-08-25T15:00:00Z", // string, ISO datetime for fixture kickoff
      "result": "ARS"                          // string, winning team short name, "DRAW", or null if pending
    }
  ]
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"       // string, user-friendly error description
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"UNAUTHORIZED"
"ROUND_NOT_FOUND"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  try {
    // Extract request parameters and authenticated user ID
    const { round_id } = req.body;
    const user_id = req.user.id;

    // === INPUT VALIDATION ===
    // Validate round_id is provided and is a valid integer
    if (!round_id || !Number.isInteger(round_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Round ID is required and must be a number"
      });
    }

    // === AUTHORIZATION CHECK ===
    // Verify user has access to this round (either as organiser or participant)
    // This prevents users from viewing fixtures from competitions they're not involved in
    const accessCheck = await query(`
      SELECT c.id as competition_id, c.organiser_id, r.round_number
      FROM competition c
      JOIN round r ON c.id = r.competition_id
      WHERE r.id = $1 AND (
        c.organiser_id = $2 OR  -- User is the organiser
        EXISTS (                -- OR user is a participant
          SELECT 1 FROM competition_user cu 
          WHERE cu.competition_id = c.id AND cu.user_id = $2
        )
      )
    `, [round_id, user_id]);

    // Check if round exists and user has access to it
    if (accessCheck.rows.length === 0) {
      return res.json({
        return_code: "ROUND_NOT_FOUND",
        message: "Round not found or access denied"
      });
    }

    // === FIXTURE RETRIEVAL ===
    // Get all fixtures for the specified round in chronological order
    // This is used by both admin (results management) and players (viewing fixtures/results)
    // Teams are stored as both full names and short names for different display needs
    const result = await query(`
      SELECT 
        f.id,                     -- Unique fixture identifier for database operations
        f.kickoff_time,           -- ISO datetime when fixture kicks off
        f.result,                 -- Winner: team short name (e.g., "ARS"), "DRAW", or null if pending
        f.home_team,              -- Full home team name for display (e.g., "Arsenal")
        f.away_team,              -- Full away team name for display (e.g., "Chelsea")
        f.home_team_short,        -- Abbreviated home team name for compact UI (e.g., "ARS")
        f.away_team_short         -- Abbreviated away team name for compact UI (e.g., "CHE")
      FROM fixture f
      WHERE f.round_id = $1       -- Filter to specific round only
      ORDER BY f.kickoff_time ASC -- Chronological order for logical display
    `, [round_id]);

    // === SUCCESS RESPONSE ===
    // Transform database results into clean API response format
    // Map each fixture row to frontend-friendly object structure
    res.json({
      return_code: "SUCCESS",
      fixtures: result.rows.map(row => ({
        id: row.id,                            // For fixture management operations
        home_team: row.home_team,              // Full team name for detailed displays
        away_team: row.away_team,              // Full team name for detailed displays
        home_team_short: row.home_team_short,  // Short name for space-constrained UI
        away_team_short: row.away_team_short,  // Short name for space-constrained UI
        kickoff_time: row.kickoff_time,        // ISO datetime for scheduling
        result: row.result                     // Winner short name, "DRAW", or null if pending
      }))
    });

  } catch (error) {
    // === ERROR HANDLING ===
    // Log detailed error for debugging but return generic message to client for security
    console.error('Get fixtures error:', error);
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;