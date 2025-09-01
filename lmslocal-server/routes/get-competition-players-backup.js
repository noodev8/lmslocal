/*
=======================================================================================================================================
API Route: get-competition-players
=======================================================================================================================================
Method: POST
Purpose: Retrieves comprehensive player data for competition management with organiser authorization
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123                   // integer, required - ID of the competition to get players for
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "competition": {
    "id": 123,                            // integer, unique competition ID
    "name": "Premier League LMS",         // string, competition name for display
    "player_count": 5,                    // integer, total number of players
    "active_count": 3,                    // integer, number of active players remaining
    "eliminated_count": 2,                // integer, number of eliminated players
    "invite_code": "1234",                // string, competition join code
    "current_round": 3,                   // integer, current round number
    "total_rounds": 10                    // integer, total rounds created
  },
  "players": [
    {
      "id": 456,                          // integer, unique player user ID
      "display_name": "John Doe",         // string, player's display name
      "email": "john@example.com",        // string, player's email address
      "is_managed": false,                // boolean, whether this is a managed account
      "status": "active",                 // string, player status: 'active', 'OUT', etc.
      "lives_remaining": 2,               // integer, player's remaining lives
      "joined_at": "2025-01-01T10:00:00Z", // string, ISO datetime when player joined
      "paid": true,                       // boolean, payment status
      "paid_date": "2025-01-01T10:00:00Z", // string, ISO datetime when payment was made
      "total_picks": 2,                   // integer, total picks made by player
      "successful_picks": 1,              // integer, number of winning picks
      "pick_success_rate": 50.0,          // number, percentage of successful picks
      "last_pick_date": "2025-01-15T14:00:00Z" // string, ISO datetime of most recent pick
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
"VALIDATION_ERROR"
"COMPETITION_NOT_FOUND" 
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
    // Extract request parameters and authenticated user ID
    const { competition_id } = req.body;
    const user_id = req.user.id;

    // === INPUT VALIDATION ===
    // Validate competition_id is provided and is a valid integer
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required and must be a number"
      });
    }

    // === SINGLE COMPREHENSIVE QUERY (ELIMINATES N+1 PROBLEM) ===
    // This optimized query replaces what used to be 2 separate queries:
    // 1. Competition existence and organiser check
    // 2. Players data retrieval
    // Now performs all operations in ONE efficient query with comprehensive player statistics
    const result = await query(`
      SELECT 
        -- === COMPETITION INFO ===
        c.id as competition_id,                   -- Competition identifier for validation
        c.name as competition_name,               -- Competition name for display
        c.invite_code,                            -- Join code for competition management
        c.organiser_id,                           -- Competition organiser (for authorization check)
        
        -- === COMPETITION STATISTICS ===
        comp_stats.total_players,                 -- Total number of players in competition
        comp_stats.active_players,                -- Number of active players remaining
        comp_stats.eliminated_players,            -- Number of eliminated players
        
        -- === ROUND INFORMATION ===
        latest_round.current_round,               -- Current round number
        round_stats.total_rounds,                 -- Total rounds created in competition
        
        -- === PLAYER DETAILS (NULL if no players yet) ===
        u.id as player_id,                        -- Player's user ID
        u.display_name,                           -- Player's display name
        u.email,                                  -- Player's email address
        u.is_managed,                             -- Whether this is a managed account
        cu.status as player_status,               -- Player's competition status
        cu.lives_remaining,                       -- Player's remaining lives
        cu.joined_at,                             -- When player joined competition
        cu.paid,                                  -- Payment status
        cu.paid_date,                             -- When payment was made
        
        -- === PLAYER PICK STATISTICS ===
        pick_stats.total_picks,                   -- Total picks made by this player
        pick_stats.successful_picks,              -- Number of winning picks
        pick_stats.last_pick_date,                -- Most recent pick date
        CASE 
          WHEN pick_stats.total_picks > 0 THEN 
            ROUND((pick_stats.successful_picks::decimal / pick_stats.total_picks::decimal) * 100, 1)
          ELSE 0 
        END as pick_success_rate                  -- Success percentage
        
      FROM competition c
      
      -- === COMPETITION STATISTICS SUBQUERY ===
      -- Get player counts for competition overview
      LEFT JOIN (
        SELECT competition_id,
               COUNT(*) as total_players,                                    -- Total players who joined
               COUNT(*) FILTER (WHERE status = 'active') as active_players, -- Active players remaining
               COUNT(*) FILTER (WHERE status != 'active') as eliminated_players -- Eliminated players
        FROM competition_user
        GROUP BY competition_id
      ) comp_stats ON c.id = comp_stats.competition_id
      
      -- === LATEST ROUND INFO ===
      -- Get current round number using window function for efficiency
      LEFT JOIN (
        SELECT r.competition_id,
               r.round_number as current_round,
               ROW_NUMBER() OVER (PARTITION BY r.competition_id ORDER BY r.round_number DESC) as rn
        FROM round r
      ) latest_round ON c.id = latest_round.competition_id AND latest_round.rn = 1
      
      -- === TOTAL ROUNDS COUNT ===
      -- Get total rounds created for this competition
      LEFT JOIN (
        SELECT competition_id, MAX(round_number) as total_rounds
        FROM round
        GROUP BY competition_id
      ) round_stats ON c.id = round_stats.competition_id
      
      -- === PLAYER DATA ===
      -- Get all players in competition with their details
      LEFT JOIN competition_user cu ON c.id = cu.competition_id
      LEFT JOIN app_user u ON cu.user_id = u.id
      
      -- === PLAYER PICK STATISTICS SUBQUERY ===
      -- Calculate comprehensive pick statistics for each player
      LEFT JOIN (
        SELECT p.user_id,
               r.competition_id,
               COUNT(*) as total_picks,                    -- Total picks made
               COUNT(*) FILTER (WHERE 
                 f.result IS NOT NULL AND                  -- Result is available
                 ((p.team = 'home' AND f.result = 'home_win') OR 
                  (p.team = 'away' AND f.result = 'away_win'))
               ) as successful_picks,                      -- Winning picks count
               MAX(p.created_at) as last_pick_date         -- Most recent pick timestamp
        FROM pick p
        INNER JOIN round r ON p.round_id = r.id
        LEFT JOIN fixture f ON p.fixture_id = f.id
        GROUP BY p.user_id, r.competition_id
      ) pick_stats ON cu.user_id = pick_stats.user_id AND c.id = pick_stats.competition_id
      
      WHERE c.id = $1  -- Filter to requested competition only
      ORDER BY cu.joined_at ASC NULLS LAST  -- Order by join date, nulls last for competition-only row
    `, [competition_id]);

    // === AUTHORIZATION VALIDATION ===
    // Check if competition exists and user has organiser permissions
    if (result.rows.length === 0) {
      return res.json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition not found"
      });
    }

    const competitionData = result.rows[0];
    
    // Verify authenticated user is the competition organiser
    if (competitionData.organiser_id !== user_id) {
      return res.json({
        return_code: "UNAUTHORIZED",
        message: "Only the competition organiser can view players"
      });
    }

    // === RESPONSE DATA PREPARATION ===
    // Build comprehensive competition overview with statistics
    const competition = {
      id: competitionData.competition_id,            // Competition identifier
      name: competitionData.competition_name,        // Competition name for display
      player_count: competitionData.total_players || 0,    // Total players joined
      active_count: competitionData.active_players || 0,   // Active players remaining
      eliminated_count: competitionData.eliminated_players || 0, // Eliminated players
      invite_code: competitionData.invite_code,      // Join code for sharing
      current_round: competitionData.current_round || 0,   // Current round number
      total_rounds: competitionData.total_rounds || 0      // Total rounds created
    };

    // === PLAYER DATA PROCESSING ===
    // Extract and format player data with comprehensive statistics
    const players = result.rows
      .filter(row => row.player_id !== null)  // Filter out competition-only rows
      .map(row => ({
        id: row.player_id,                           // Player's user ID for operations
        display_name: row.display_name,              // Player's display name
        email: row.email,                            // Player's email address
        is_managed: row.is_managed,                  // Whether this is a managed account
        status: row.player_status,                   // Competition status (active/OUT/etc)
        lives_remaining: row.lives_remaining,        // Remaining lives count
        joined_at: row.joined_at,                    // Join timestamp
        paid: row.paid,                              // Payment status for organiser tracking
        paid_date: row.paid_date,                    // Payment date for records
        total_picks: row.total_picks || 0,           // Total picks made by player
        successful_picks: row.successful_picks || 0, // Number of winning picks
        pick_success_rate: row.pick_success_rate || 0, // Success percentage for performance tracking
        last_pick_date: row.last_pick_date           // Most recent pick for activity tracking
      }));

    // === SUCCESS RESPONSE ===
    // Return comprehensive competition and player data for admin management
    res.json({
      return_code: "SUCCESS",
      competition: competition,      // Competition overview with statistics
      players: players              // Detailed player list with performance metrics
    });

  } catch (error) {
    // === ERROR HANDLING ===
    // Log detailed error for debugging but return generic message to client for security
    console.error('Get competition players error:', error);
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;