/*
=======================================================================================================================================
API Route: get-pick-statistics
=======================================================================================================================================
Method: POST
Purpose: Gets real-time pick statistics for competition dashboard showing player pick completion rates and round progress
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123                // integer, required - ID of the competition to analyze
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "current_round": {                   // object, current round information (null if no rounds)
    "round_id": 456,                   // integer, current round database ID
    "round_number": 5                  // integer, human-readable round number
  },
  "players_with_picks": 15,            // integer, number of players who made picks for current round
  "total_active_players": 20,          // integer, total number of active players in competition
  "pick_percentage": 75                // integer, percentage (0-100) of active players who have made picks (floored, not rounded)
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "VALIDATION_ERROR",
  "message": "Competition ID is required and must be a number"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR" - Missing or invalid competition_id parameter
"COMPETITION_NOT_FOUND" - Competition does not exist in database
"UNAUTHORIZED" - User is not the organiser or participant of this competition
"SERVER_ERROR" - Database error or unexpected server failure
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database'); // Use central database with destructured import
const { verifyToken } = require('../middleware/auth'); // Use correct auth middleware
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();

// POST endpoint with comprehensive authentication and data validation
router.post('/', verifyToken, async (req, res) => {
  logApiCall('get-pick-statistics');

  try {
    const { competition_id } = req.body;
    const user_id = req.user.id; // Set by verifyToken middleware

    // Validate required input parameters with strict type checking
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required and must be a number"
      });
    }

    // Single comprehensive query to get all pick statistics data
    // This eliminates N+1 query pattern by joining all required tables
    const result = await query(`
      SELECT 
        -- Competition authorization data
        c.id as competition_id,
        c.organiser_id,
        c.name as competition_name,
        
        -- Current round information (latest round by round_number)
        cr.round_id,
        cr.round_number,
        
        -- Pick statistics for current round
        COALESCE(ps.players_with_picks, 0) as players_with_picks,
        COALESCE(ap.total_active_players, 0) as total_active_players
        
      FROM competition c
      
      -- Get current round (latest by round_number) using subquery to avoid window function complexity
      LEFT JOIN (
        SELECT r1.id as round_id, r1.competition_id, r1.round_number
        FROM round r1
        WHERE r1.round_number = (
          SELECT MAX(r2.round_number) 
          FROM round r2 
          WHERE r2.competition_id = r1.competition_id
        )
      ) cr ON c.id = cr.competition_id
      
      -- Count picks for current round (only if current round exists)
      LEFT JOIN (
        SELECT round_id, COUNT(*) as players_with_picks
        FROM pick
        GROUP BY round_id
      ) ps ON cr.round_id = ps.round_id
      
      -- Count total active players in competition (from competition_user table)
      LEFT JOIN (
        SELECT competition_id, COUNT(*) as total_active_players
        FROM competition_user
        WHERE status = 'active'
        GROUP BY competition_id
      ) ap ON c.id = ap.competition_id
      
      WHERE c.id = $1
    `, [competition_id]);

    // Check if competition exists in database
    if (result.rows.length === 0) {
      return res.json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition not found"
      });
    }

    const data = result.rows[0];

    // Verify user authorization - check if user is organiser OR participant
    const isOrganiser = data.organiser_id === user_id;

    if (!isOrganiser) {
      // Check if user is a participant in this competition
      const participantCheck = await query(`
        SELECT 1 FROM competition_user
        WHERE competition_id = $1 AND user_id = $2
      `, [competition_id, user_id]);

      if (participantCheck.rows.length === 0) {
        return res.json({
          return_code: "UNAUTHORIZED",
          message: "Only competition organisers and participants can access pick statistics"
        });
      }
    }

    // Parse and validate numeric values to ensure correct data types
    const playersWithPicks = parseInt(data.players_with_picks) || 0;
    const totalActivePlayers = parseInt(data.total_active_players) || 0;

    // Calculate pick completion percentage with safe division
    // Use floor to only show 100% when ALL players have picked (not 99.x% rounded up)
    const pickPercentage = totalActivePlayers > 0
      ? Math.floor((playersWithPicks / totalActivePlayers) * 100)
      : 0;

    // Build current round object (null if no rounds exist yet)
    let currentRound = null;
    if (data.round_id) {
      currentRound = {
        round_id: data.round_id,
        round_number: data.round_number
      };
    }

    // Return comprehensive pick statistics for dashboard charts
    return res.json({
      return_code: "SUCCESS",
      current_round: currentRound,
      players_with_picks: playersWithPicks,
      total_active_players: totalActivePlayers,
      pick_percentage: pickPercentage
    });

  } catch (error) {
    // Log detailed error information for debugging while protecting sensitive data
    console.error('Pick statistics API error:', {
      error: error.message,
      stack: error.stack.substring(0, 200), // Truncate stack trace
      competition_id: req.body?.competition_id,
      user_id: req.user?.id,
      timestamp: new Date().toISOString()
    });
    
    // Return standardized server error response
    return res.json({
      return_code: "SERVER_ERROR", 
      message: "Failed to retrieve pick statistics"
    });
  }
});

module.exports = router;