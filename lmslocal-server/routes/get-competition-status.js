/*
=======================================================================================================================================
API Route: get-competition-status
=======================================================================================================================================
Method: POST
Purpose: Gets comprehensive competition status including rounds, fixtures, player counts and winner details for admin dashboard routing and display
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123                   // integer, required - ID of the competition to check
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "current_round": {
    "id": 17,                            // integer, current round ID
    "round_number": 2,                   // integer, round number
    "lock_time": "2025-08-30T18:00:00Z", // string, ISO datetime when round locks
    "calculated": true                   // boolean, true if round results processed
  },
  "fixture_count": 5,                    // integer, number of fixtures in current round
  "should_route_to_results": true,       // boolean, true if has fixtures (routing logic)
  "players_active": 8,                   // integer, number of active players
  "players_out": 4,                      // integer, number of eliminated players
  "total_players": 12,                   // integer, total players in competition
  "round_calculated": true,              // boolean, true if current round processed
  "winner": {                            // object, winner details (null if no winner)
    "display_name": "John Smith",        // string, winner's display name
    "email": "john@example.com",         // string, winner's email
    "joined_at": "2025-01-01T12:00:00Z"  // string, ISO datetime when winner joined
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
"VALIDATION_ERROR" 
"COMPETITION_NOT_FOUND"
"UNAUTHORIZED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  // Log API call if enabled
  logApiCall('get-competition-status');
  
  try {
    const { competition_id } = req.body;
    const user_id = req.user.id;

    // Validate required input parameters
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required and must be a number"
      });
    }

    // Get all competition status data in single comprehensive query to eliminate N+1 pattern
    // This replaces 5-6 separate queries with one efficient query using LEFT JOINs and subqueries
    const result = await query(`
      SELECT 
        -- Competition details and authorization
        c.organiser_id,
        c.name,
        c.invite_code,
        
        -- Current round info (latest round by round_number)
        r.round_id,
        r.round_number,
        r.lock_time,
        
        -- Fixture metrics for current round
        COALESCE(fc.fixture_count, 0) as fixture_count,
        COALESCE(fc.calculated_count, 0) as calculated_fixtures,
        
        -- Player status counts
        COALESCE(pc.players_active, 0) as players_active,
        COALESCE(pc.players_out, 0) as players_out,
        COALESCE(pc.total_players, 0) as total_players,
        
        -- Winner details (only when exactly 1 active player and competition started)
        w.winner_name,
        w.winner_email,
        w.winner_joined
        
      FROM competition c
      
      -- Get current round (latest by round_number) using window function to avoid LIMIT in JOIN
      LEFT JOIN (
        SELECT competition_id, id as round_id, round_number, lock_time,
               ROW_NUMBER() OVER (PARTITION BY competition_id ORDER BY round_number DESC) as rn
        FROM round
      ) r ON c.id = r.competition_id AND r.rn = 1
      
      -- Get fixture counts and calculation status for current round
      LEFT JOIN (
        SELECT round_id,
               COUNT(*) as fixture_count,
               COUNT(CASE WHEN processed IS NOT NULL THEN 1 END) as calculated_count
        FROM fixture
        GROUP BY round_id
      ) fc ON r.round_id = fc.round_id
      
      -- Get aggregated player status counts
      LEFT JOIN (
        SELECT competition_id,
               COUNT(CASE WHEN status = 'active' THEN 1 END) as players_active,
               COUNT(CASE WHEN status = 'OUT' THEN 1 END) as players_out,
               COUNT(*) as total_players
        FROM competition_user
        GROUP BY competition_id
      ) pc ON c.id = pc.competition_id
      
      -- Get winner details only when competition is complete (1 active player, no invite code)
      LEFT JOIN (
        SELECT cu.competition_id, 
               u.display_name as winner_name, 
               u.email as winner_email, 
               cu.joined_at as winner_joined
        FROM competition_user cu
        INNER JOIN app_user u ON cu.user_id = u.id
        WHERE cu.status = 'active'
      ) w ON c.id = w.competition_id 
         AND pc.players_active = 1 
         AND c.invite_code IS NULL
      
      WHERE c.id = $1
    `, [competition_id]);


    // Check if competition exists
    if (result.rows.length === 0) {
      return res.json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition not found"
      });
    }

    const data = result.rows[0];

    // Verify user is the organiser (authorization check)
    if (data.organiser_id !== user_id) {
      return res.json({
        return_code: "UNAUTHORIZED",
        message: "Only the competition organiser can access this information"
      });
    }

    // Parse numeric values to ensure correct types
    const fixtureCount = parseInt(data.fixture_count);
    const calculatedCount = parseInt(data.calculated_fixtures);
    const playersActive = parseInt(data.players_active);
    const playersOut = parseInt(data.players_out);
    const totalPlayers = parseInt(data.total_players);

    // Determine if round has been calculated
    const roundCalculated = calculatedCount > 0;

    // Build winner object if winner data exists
    let winner = null;
    if (data.winner_name) {
      winner = {
        display_name: data.winner_name,
        email: data.winner_email,
        joined_at: data.winner_joined
      };
    }

    // Build current round object (null if no rounds exist)
    let currentRound = null;
    if (data.round_id) {
      currentRound = {
        id: data.round_id,
        round_number: data.round_number,
        lock_time: data.lock_time,
        calculated: roundCalculated
      };
    }

    // Return comprehensive competition status for admin dashboard
    res.json({
      return_code: "SUCCESS",
      current_round: currentRound,
      fixture_count: fixtureCount,
      should_route_to_results: fixtureCount > 0, // Frontend uses this for routing logic
      players_active: playersActive,
      players_out: playersOut,
      total_players: totalPlayers,
      round_calculated: roundCalculated,
      winner: winner // null if no winner yet
    });

  } catch (error) {
    console.error('Get competition status error:', error);
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;