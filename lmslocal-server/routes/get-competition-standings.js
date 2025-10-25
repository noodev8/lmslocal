/*
=======================================================================================================================================
API Route: get-competition-standings
=======================================================================================================================================
Method: POST
Purpose: Retrieves comprehensive competition standings with player status, picks, and history with server-side pagination
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,                  // integer, required - ID of the competition to get standings for
  "show_full_user_history": false,       // boolean, optional - if true, show ALL rounds for authenticated user
  "page": 1,                              // integer, optional - Page number (default: 1)
  "page_size": 50,                        // integer, optional - Players per page (default: 50, max: 200)
  "filter_by_lives": "all",               // string, optional - Filter by lives: "all", "2", "1", "0", "out" (default: "all")
  "search": ""                            // string, optional - Search players by name within filter
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
  "pagination": {
    "current_page": 1,                    // integer, current page number
    "page_size": 50,                      // integer, players per page
    "total_players": 200,                 // integer, total players matching current filter
    "total_pages": 4                      // integer, total number of pages for current filter
  },
  "filter_counts": {
    "all": 200,                           // integer, total players in competition
    "lives_2": 15,                        // integer, players with 2 lives (active)
    "lives_1": 42,                        // integer, players with 1 life (active)
    "lives_0": 28,                        // integer, players with 0 lives (active, sudden death)
    "out": 115                            // integer, eliminated players
  },
  "players": [
    {
      "id": 456,                          // integer, unique player user ID
      "display_name": "John Doe",         // string, player's display name
      "lives_remaining": 2,               // integer, player's remaining lives
      "status": "active",                 // string, player status: 'active', 'out'
      "current_pick": {                   // object, current round pick (null if no pick)
        "team": "CHE",                    // string, picked team short name
        "team_full_name": "Chelsea",      // string, full team name for display
        "fixture": "Chelsea vs Arsenal",  // string, fixture description
        "outcome": "pending"              // string, pick outcome: 'pending', 'WIN', 'LOSE', 'NO_PICK'
      },
      "elimination_pick": {               // object, ONLY for status='out' players (null otherwise)
        "round_number": 3,                // integer, round when eliminated
        "team": "Newcastle",              // string, full team name that knocked them out
        "fixture": "Brighton vs Newcastle", // string, fixture description
        "result": "2-1"                   // string, match result (null if not played)
      }
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
    const {
      competition_id,
      show_full_user_history = false,
      page = 1,
      page_size = 50,
      filter_by_lives = 'all',
      search = ''
    } = req.body;
    const user_id = req.user.id;

    // === INPUT VALIDATION ===
    // Validate competition_id is provided and is a valid integer
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required and must be a number"
      });
    }

    // Validate filter parameter
    const validFilters = ['all', '2', '1', '0', 'out'];
    const filterValue = validFilters.includes(filter_by_lives) ? filter_by_lives : 'all';

    // Validate pagination parameters
    const currentPage = Math.max(1, parseInt(page) || 1);
    const itemsPerPage = Math.min(200, Math.max(1, parseInt(page_size) || 50));
    const offset = (currentPage - 1) * itemsPerPage;

    // Sanitize search term for SQL LIKE
    const searchTerm = search ? `%${search.trim().toLowerCase()}%` : null;

    // === QUERY 0: GET FILTER COUNTS ===
    // Calculate counts for all filter options for UI display
    const filterCountsResult = await query(`
      SELECT
        COUNT(*) as all_count,
        COUNT(*) FILTER (WHERE status = 'active' AND lives_remaining = 2) as lives_2_count,
        COUNT(*) FILTER (WHERE status = 'active' AND lives_remaining = 1) as lives_1_count,
        COUNT(*) FILTER (WHERE status = 'active' AND lives_remaining = 0) as lives_0_count,
        COUNT(*) FILTER (WHERE status = 'out') as out_count
      FROM competition_user
      WHERE competition_id = $1
    `, [competition_id]);

    const filterCounts = filterCountsResult.rows[0] || {};

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
      -- Get all players in competition with their status (filtered by lives and search)
      LEFT JOIN competition_user cu ON c.id = cu.competition_id
        AND (
          -- Apply filter by lives
          $5 = 'all' OR
          ($5 = '2' AND cu.status = 'active' AND cu.lives_remaining = 2) OR
          ($5 = '1' AND cu.status = 'active' AND cu.lives_remaining = 1) OR
          ($5 = '0' AND cu.status = 'active' AND cu.lives_remaining = 0) OR
          ($5 = 'out' AND cu.status = 'out')
        )
      LEFT JOIN app_user u ON cu.user_id = u.id
        AND (
          -- Apply search filter (case-insensitive)
          $6::text IS NULL OR LOWER(u.display_name) LIKE $6::text
        )

      WHERE c.id = $1  -- Filter to requested competition only
      ORDER BY u.display_name ASC  -- Pure alphabetical order for easy friend finding
      LIMIT $3 OFFSET $4
    `, [competition_id, user_id, itemsPerPage, offset, filterValue, searchTerm]);

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
      current_round_lock_time: firstRow.current_round_lock_time, // When current round locks
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

    // === QUERY 3: ELIMINATION PICKS FOR OUT PLAYERS ONLY (OPTIMIZED) ===
    // Get ONLY the most recent losing pick for eliminated players to show what knocked them out
    // This replaces fetching 5 rounds of history for everyone - massive performance improvement
    let eliminationData = [];
    const eliminatedPlayers = players.filter(p => p.status === 'out');

    if (eliminatedPlayers.length > 0) {
      const eliminationResult = await query(`
        SELECT DISTINCT ON (p.user_id)
          -- === PLAYER INFO ===
          p.user_id,                              -- Player ID for matching

          -- === ROUND INFO ===
          r.round_number,                         -- Round number when eliminated

          -- === PICK INFO ===
          p.team as pick_team,                    -- Team picked that lost
          t.name as pick_team_full_name,          -- Full team name for display

          -- === FIXTURE INFO ===
          f.home_team,                            -- Home team in fixture
          f.away_team,                            -- Away team in fixture
          f.result as fixture_result              -- Fixture result

        FROM pick p
        JOIN round r ON p.round_id = r.id
        LEFT JOIN team t ON t.short_name = p.team AND t.is_active = true
        LEFT JOIN fixture f ON p.fixture_id = f.id
        WHERE r.competition_id = $1
          AND p.user_id = ANY($2)                 -- Only eliminated players
          AND p.outcome IN ('LOSE', 'NO_PICK')    -- Only losing picks
          AND r.round_number IS NOT NULL
        ORDER BY p.user_id, r.round_number DESC   -- Most recent loss first
      `, [competition_id, eliminatedPlayers.map(p => p.id)]);

      eliminationData = eliminationResult.rows;
    }

    // === DATA ASSEMBLY (CLIENT-SIDE PROCESSING) ===
    // Efficiently attach picks and elimination data to each player using lookup maps
    const currentPicksMap = {};
    currentPicksData.forEach(pick => {
      currentPicksMap[pick.user_id] = pick;
    });

    const eliminationMap = {};
    eliminationData.forEach(elimination => {
      eliminationMap[elimination.user_id] = elimination;
    });

    // === FINAL PLAYER DATA ASSEMBLY ===
    // Attach current picks and elimination info to each player
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

      // === ELIMINATION INFO ATTACHMENT (OUT PLAYERS ONLY) ===
      // For eliminated players, attach details about the pick that knocked them out
      if (player.status === 'out') {
        const elimination = eliminationMap[player.id];
        if (elimination) {
          player.elimination_pick = {
            round_number: elimination.round_number,  // Round when eliminated
            team: elimination.pick_team_full_name || elimination.pick_team, // Team that knocked them out
            fixture: elimination.home_team && elimination.away_team
              ? `${elimination.home_team} vs ${elimination.away_team}`
              : null,                              // Fixture details
            result: elimination.fixture_result     // Match result
          };
        } else {
          player.elimination_pick = null;          // No elimination data found
        }
      }
    });

    // === BUILD PAGINATION METADATA ===
    // Calculate total players based on current filter
    let filteredTotal = 0;
    switch (filterValue) {
      case '2':
        filteredTotal = parseInt(filterCounts.lives_2_count) || 0;
        break;
      case '1':
        filteredTotal = parseInt(filterCounts.lives_1_count) || 0;
        break;
      case '0':
        filteredTotal = parseInt(filterCounts.lives_0_count) || 0;
        break;
      case 'out':
        filteredTotal = parseInt(filterCounts.out_count) || 0;
        break;
      default: // 'all'
        filteredTotal = parseInt(filterCounts.all_count) || 0;
    }

    const totalPages = Math.ceil(filteredTotal / itemsPerPage);
    const pagination = {
      current_page: currentPage,
      page_size: itemsPerPage,
      total_players: filteredTotal,
      total_pages: totalPages
    };

    // === BUILD FILTER COUNTS METADATA ===
    const filter_counts = {
      all: parseInt(filterCounts.all_count) || 0,
      lives_2: parseInt(filterCounts.lives_2_count) || 0,
      lives_1: parseInt(filterCounts.lives_1_count) || 0,
      lives_0: parseInt(filterCounts.lives_0_count) || 0,
      out: parseInt(filterCounts.out_count) || 0
    };

    // === SUCCESS RESPONSE ===
    // Return comprehensive standings data with optimal performance and pagination
    res.json({
      return_code: "SUCCESS",
      competition: competition,      // Competition overview with statistics
      pagination: pagination,        // Pagination metadata for current filter
      filter_counts: filter_counts,  // Counts for all filter options
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