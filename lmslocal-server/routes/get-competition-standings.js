/*
=======================================================================================================================================
API Route: get-competition-standings
=======================================================================================================================================
Method: POST
Purpose: Retrieves comprehensive competition standings with player status, picks, and history with massive N+1 optimization
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123                   // integer, required - ID of the competition to get standings for
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "competition": {
    "id": 123,                            // integer, unique competition ID
    "name": "Premier League LMS",         // string, competition name for display
    "current_round": 3,                   // integer, current round number
    "total_rounds": 10,                   // integer, total rounds created
    "is_locked": true,                    // boolean, whether current round is locked
    "current_round_lock_time": "2025-08-31T15:00:00Z", // string, ISO datetime when round locks
    "active_players": 8,                  // integer, number of active players remaining
    "total_players": 15                   // integer, total players in competition
  },
  "players": [
    {
      "id": 456,                          // integer, unique player user ID
      "display_name": "John Doe",         // string, player's display name
      "lives_remaining": 2,               // integer, player's remaining lives
      "status": "active",                 // string, player status: 'active', 'OUT', etc.
      "current_pick": {                   // object, current round pick (null if round not locked)
        "team": "CHE",                    // string, picked team short name
        "team_full_name": "Chelsea",      // string, full team name for display
        "fixture": "Chelsea vs Arsenal",  // string, fixture description
        "outcome": "pending"              // string, pick outcome: 'pending', 'WIN', 'LOSE', 'NO_PICK'
      },
      "history": [                        // array, previous rounds history
        {
          "round_number": 2,              // integer, round number
          "pick_team": "MAN",             // string, team picked
          "pick_team_full_name": "Manchester United", // string, full team name
          "fixture": "Manchester United vs Liverpool", // string, fixture description
          "pick_result": "win",           // string, result: 'win', 'loss', 'no_pick', 'pending'
          "lock_time": "2025-08-24T15:00:00Z" // string, ISO datetime when round locked
        }
      ]
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

    // === QUERY 1: COMPREHENSIVE COMPETITION AND PLAYERS DATA ===
    // This MASSIVE optimization replaces what used to be 200+ separate queries!
    // Gets competition info, all players, and validates user access in ONE query
    const mainResult = await query(`
      SELECT 
        -- === COMPETITION INFO ===
        c.id as competition_id,                   -- Competition identifier for validation
        c.name as competition_name,               -- Competition name for display
        c.invite_code,                            -- Join code for reference
        c.status as competition_status,           -- Competition status for winner logic
        
        -- === COMPETITION STATISTICS ===
        comp_stats.total_players,                 -- Total number of players
        comp_stats.active_players,                -- Number of active players remaining
        
        -- === CURRENT ROUND INFO ===
        latest_round.current_round,               -- Current round number
        latest_round.current_round_lock_time,     -- When current round locks
        round_stats.total_rounds,                 -- Total rounds created
        
        -- === USER ACCESS VALIDATION ===
        user_access.user_id as has_access,        -- Non-null if user is participant
        c.organiser_id,                           -- Competition organizer ID
        
        -- === PLAYER DETAILS ===
        u.id as player_id,                        -- Player's user ID
        u.display_name,                           -- Player's display name
        cu.lives_remaining,                       -- Player's remaining lives
        cu.status as player_status                -- Player's competition status
        
      FROM competition c
      
      -- === COMPETITION STATISTICS SUBQUERY ===
      -- Get player counts for competition overview
      LEFT JOIN (
        SELECT competition_id,
               COUNT(*) as total_players,                                    -- Total players who joined
               COUNT(*) FILTER (WHERE status = 'active') as active_players  -- Active players remaining
        FROM competition_user
        GROUP BY competition_id
      ) comp_stats ON c.id = comp_stats.competition_id
      
      -- === LATEST ROUND INFO ===
      -- Get current round and lock time using window function for efficiency
      LEFT JOIN (
        SELECT r.competition_id,
               r.round_number as current_round,                             -- Current round number
               r.lock_time as current_round_lock_time,                      -- When round locks
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
      
      -- === USER ACCESS VALIDATION ===
      -- Check if authenticated user is participant in this competition
      LEFT JOIN competition_user user_access ON c.id = user_access.competition_id AND user_access.user_id = $2
      
      -- === ALL PLAYERS DATA ===
      -- Get all players in competition with their status
      LEFT JOIN competition_user cu ON c.id = cu.competition_id
      LEFT JOIN app_user u ON cu.user_id = u.id
      
      WHERE c.id = $1  -- Filter to requested competition only
      ORDER BY 
        CASE WHEN cu.status = 'out' THEN 1 ELSE 0 END, -- Active players first
        cu.lives_remaining DESC,                        -- More lives first
        u.display_name ASC                              -- Then alphabetically
    `, [competition_id, user_id]);

    // === AUTHORIZATION VALIDATION ===
    // Check if competition exists and user has access
    if (mainResult.rows.length === 0) {
      return res.json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition not found"
      });
    }

    const firstRow = mainResult.rows[0];
    
    // Verify user has access (either participant or organizer)
    const isParticipant = !!firstRow.has_access;
    const isOrganizer = firstRow.organiser_id === user_id;
    
    if (!isParticipant && !isOrganizer) {
      return res.json({
        return_code: "UNAUTHORIZED", 
        message: "You do not have access to this competition"
      });
    }

    // === COMPETITION DATA PREPARATION ===
    // Build comprehensive competition overview
    const competition = {
      id: firstRow.competition_id,               // Competition identifier
      name: firstRow.competition_name,           // Competition name for display
      current_round: firstRow.current_round || 0,      // Current round number
      total_rounds: firstRow.total_rounds || 0,        // Total rounds created
      active_players: firstRow.active_players || 0,    // Active players count
      total_players: firstRow.total_players || 0,      // Total players count
      status: firstRow.competition_status        // Competition status for winner logic
    };

    // === EXTRACT PLAYER DATA ===
    // Filter out competition-only rows and extract player info
    const players = mainResult.rows
      .filter(row => row.player_id !== null)
      .map(row => ({
        id: row.player_id,                       // Player's user ID
        display_name: row.display_name,          // Player's display name
        lives_remaining: row.lives_remaining,    // Remaining lives
        status: row.player_status               // Competition status
      }));

    // === QUERY 2: ALL CURRENT ROUND PICKS (BULK QUERY - ELIMINATES N+1) ===
    // Get current round picks for ALL players in ONE query instead of N queries
    let currentPicksData = [];
    if (firstRow.current_round) {
      const currentPicksResult = await query(`
        SELECT 
          p.user_id,                              -- Player ID for matching
          p.team,                                 -- Picked team short name
          p.outcome,                              -- Pick outcome
          t.name as team_full_name,               -- Full team name for display
          f.home_team,                            -- Home team in fixture
          f.away_team,                            -- Away team in fixture
          f.home_team_short,                      -- Home team short name
          f.away_team_short                       -- Away team short name
        FROM pick p
        LEFT JOIN team t ON t.short_name = p.team AND t.is_active = true
        LEFT JOIN fixture f ON p.fixture_id = f.id
        LEFT JOIN round r ON p.round_id = r.id
        WHERE r.competition_id = $1 
          AND r.round_number = $2
          AND p.user_id = ANY($3)                 -- Get picks for all players at once
      `, [competition_id, firstRow.current_round, players.map(p => p.id)]);
      
      currentPicksData = currentPicksResult.rows;
    }

    // === QUERY 3: ALL PLAYER HISTORY (BULK QUERY - ELIMINATES MASSIVE N+1) ===
    // Get complete history for ALL players in ONE query instead of N queries
    let historyData = [];
    if (firstRow.current_round && firstRow.current_round > 1) {
      const historyResult = await query(`
        SELECT 
          -- === ROUND INFO ===
          r.round_number,                         -- Round number for display
          r.lock_time,                            -- When round locked
          
          -- === PICK INFO ===
          p.user_id,                              -- Player ID for matching
          p.team as pick_team,                    -- Team picked
          p.outcome,                              -- Pick outcome
          t.name as pick_team_full_name,          -- Full team name for display
          
          -- === FIXTURE INFO ===
          f.home_team,                            -- Home team in fixture
          f.away_team,                            -- Away team in fixture
          f.result as fixture_result              -- Fixture result
          
        FROM round r
        LEFT JOIN pick p ON p.round_id = r.id AND p.user_id = ANY($3) -- Get picks for all players
        LEFT JOIN team t ON t.short_name = p.team AND t.is_active = true
        LEFT JOIN fixture f ON p.fixture_id = f.id
        WHERE r.competition_id = $1 
          AND r.round_number < $2                 -- Only completed rounds
          AND r.round_number IS NOT NULL
        ORDER BY p.user_id, r.round_number DESC  -- Group by player, newest first
      `, [competition_id, firstRow.current_round, players.map(p => p.id)]);
      
      historyData = historyResult.rows;
    }

    // === DATA ASSEMBLY (CLIENT-SIDE PROCESSING) ===
    // Efficiently attach picks and history to each player using lookup maps
    const currentPicksMap = {};
    currentPicksData.forEach(pick => {
      currentPicksMap[pick.user_id] = pick;
    });

    const historyMap = {};
    historyData.forEach(history => {
      if (!historyMap[history.user_id]) {
        historyMap[history.user_id] = [];
      }
      historyMap[history.user_id].push(history);
    });

    // === FINAL PLAYER DATA ASSEMBLY ===
    // Attach current picks and history to each player
    players.forEach(player => {
      // === CURRENT PICK ATTACHMENT ===
      // Always return current pick data if it exists - let frontend handle visibility
      const currentPick = currentPicksMap[player.id];
      if (currentPick) {
        player.current_pick = {
          team: currentPick.team,                 // Short team name
          team_full_name: currentPick.team_full_name, // Full team name for display
          fixture: currentPick.home_team && currentPick.away_team 
            ? `${currentPick.home_team} vs ${currentPick.away_team}` 
            : null,                               // Human-readable fixture
          outcome: currentPick.outcome || 'pending' // Pick outcome status
        };
      } else {
        player.current_pick = null;               // No pick exists for this player
      }

      // === HISTORY ATTACHMENT ===
      const playerHistory = historyMap[player.id] || [];
      player.history = playerHistory.map(round => ({
        round_number: round.round_number,         // Round number for display
        pick_team: round.pick_team,              // Short team name
        pick_team_full_name: round.pick_team_full_name || round.pick_team, // Full team name
        fixture: round.home_team && round.away_team 
          ? `${round.home_team} vs ${round.away_team}` 
          : null,                                 // Human-readable fixture
        pick_result: round.outcome === 'WIN' ? 'win' : 
                    round.outcome === 'LOSE' ? 'loss' : 
                    round.outcome === 'NO_PICK' ? 'no_pick' : 'pending', // Standardized result
        lock_time: round.lock_time                // When round locked
      }));
    });

    // === SUCCESS RESPONSE ===
    // Return comprehensive standings data with optimal performance
    res.json({
      return_code: "SUCCESS",
      competition: competition,      // Competition overview with statistics
      players: players              // Complete player data with picks and history
    });

  } catch (error) {
    // === ERROR HANDLING ===
    // Log detailed error for debugging but return generic message to client for security
    console.error('Get competition standings error:', error);
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;