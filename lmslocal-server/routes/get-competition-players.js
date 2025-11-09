/*
=======================================================================================================================================
API Route: get-competition-players (FIXED VERSION)
=======================================================================================================================================
Method: POST
Purpose: Retrieves comprehensive player data for competition management with organiser authorization
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,                  // integer, required - ID of the competition to get players for
  "page": 1,                              // integer, optional - Page number (default: 1)
  "page_size": 50,                        // integer, optional - Players per page (default: 50, max: 200)
  "search": "john"                        // string, optional - Search term to filter by display_name or email (case-insensitive)
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
  "pagination": {
    "current_page": 1,                    // integer, current page number
    "page_size": 50,                      // integer, players per page
    "total_players": 250,                 // integer, total players in competition
    "total_pages": 5                      // integer, total number of pages
  },
  "players": [
    {
      "id": 456,                          // integer, unique player user ID
      "display_name": "John Doe",         // string, player's display name
      "email": "john@example.com",        // string, player's email address
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
const { query } = require('../database'); // Use central database with destructured import
const { verifyToken } = require('../middleware/auth'); // Use correct auth middleware
const { canManagePlayers } = require('../utils/permissions'); // Permission helper
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();

// POST endpoint with comprehensive authentication and data validation
router.post('/', verifyToken, async (req, res) => {
  logApiCall('get-competition-players');

  try {
    const { competition_id, page = 1, page_size = 50, search } = req.body;
    const user_id = req.user.id; // Set by verifyToken middleware

    // Validate required input parameters with strict type checking
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required and must be a number"
      });
    }

    // Validate pagination parameters
    const currentPage = Math.max(1, parseInt(page) || 1);
    const itemsPerPage = Math.min(200, Math.max(1, parseInt(page_size) || 50));
    const offset = (currentPage - 1) * itemsPerPage;

    // STEP 1: Get competition data and verify authorization
    // Simple query to get basic competition info and check organizer access
    const competitionResult = await query(`
      SELECT 
        c.id,
        c.name,
        c.organiser_id,
        c.invite_code,
        -- Get current round number from latest round
        (SELECT MAX(round_number) FROM round WHERE competition_id = c.id) as current_round,
        -- Get total rounds count
        (SELECT COUNT(*) FROM round WHERE competition_id = c.id) as total_rounds
      FROM competition c
      WHERE c.id = $1
    `, [competition_id]);

    // Check if competition exists
    if (competitionResult.rows.length === 0) {
      return res.json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition not found"
      });
    }

    const competitionData = competitionResult.rows[0];

    // Verify user authorization - organiser or delegated manage_players permission
    const permission = await canManagePlayers(user_id, competition_id);
    if (!permission.authorized) {
      return res.json({
        return_code: "UNAUTHORIZED",
        message: "You do not have permission to view players for this competition"
      });
    }

    // STEP 2: Get player statistics for the competition
    // Separate query to get player counts to avoid complex JOIN issues
    // If search is provided, count only matching players
    let playerStatsQuery;
    let playerStatsParams;

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      playerStatsQuery = `
        SELECT
          COUNT(*) as total_players,
          COUNT(CASE WHEN cu.status = 'active' THEN 1 END) as active_players,
          COUNT(CASE WHEN cu.status = 'out' THEN 1 END) as eliminated_players
        FROM competition_user cu
        INNER JOIN app_user u ON cu.user_id = u.id
        WHERE cu.competition_id = $1
          AND (LOWER(u.display_name) LIKE LOWER($2) OR LOWER(u.email) LIKE LOWER($2))
      `;
      playerStatsParams = [competition_id, searchTerm];
    } else {
      playerStatsQuery = `
        SELECT
          COUNT(*) as total_players,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_players,
          COUNT(CASE WHEN status = 'out' THEN 1 END) as eliminated_players
        FROM competition_user
        WHERE competition_id = $1
      `;
      playerStatsParams = [competition_id];
    }

    const playerStatsResult = await query(playerStatsQuery, playerStatsParams);
    const playerStats = playerStatsResult.rows[0] || { total_players: 0, active_players: 0, eliminated_players: 0 };

    // STEP 3: Get detailed player data
    // Separate query for actual player data to avoid LEFT JOIN complications
    // If search is provided, filter by display_name or email
    let playersQuery;
    let playersParams;

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      playersQuery = `
        SELECT
          u.id as player_id,
          u.display_name,
          u.email,
          cu.status,
          cu.lives_remaining,
          cu.joined_at,
          cu.paid,
          cu.paid_date,
          cu.hidden,
          -- Delegated permissions
          cu.manage_results,
          cu.manage_fixtures,
          cu.manage_players,
          cu.manage_promote,
          -- Get pick statistics for each player
          pick_stats.total_picks,
          pick_stats.successful_picks,
          pick_stats.last_pick_date,
          -- Calculate success rate
          CASE
            WHEN pick_stats.total_picks > 0 THEN
              ROUND((pick_stats.successful_picks::decimal / pick_stats.total_picks::decimal) * 100, 1)
            ELSE 0
          END as pick_success_rate
        FROM competition_user cu
        INNER JOIN app_user u ON cu.user_id = u.id
        -- Get pick statistics for each player
        LEFT JOIN (
          SELECT
            p.user_id,
            COUNT(*) as total_picks,
            COUNT(CASE WHEN f.result IS NOT NULL AND
                        ((p.team = 'home' AND f.result = 'home_win') OR
                         (p.team = 'away' AND f.result = 'away_win'))
                  THEN 1 END) as successful_picks,
            MAX(p.created_at) as last_pick_date
          FROM pick p
          INNER JOIN round r ON p.round_id = r.id
          LEFT JOIN fixture f ON p.fixture_id = f.id
          WHERE r.competition_id = $1
          GROUP BY p.user_id
        ) pick_stats ON u.id = pick_stats.user_id
        WHERE cu.competition_id = $1
          AND (LOWER(u.display_name) LIKE LOWER($2) OR LOWER(u.email) LIKE LOWER($2))
        ORDER BY u.display_name ASC
        LIMIT $3 OFFSET $4
      `;
      playersParams = [competition_id, searchTerm, itemsPerPage, offset];
    } else {
      playersQuery = `
        SELECT
          u.id as player_id,
          u.display_name,
          u.email,
          cu.status,
          cu.lives_remaining,
          cu.joined_at,
          cu.paid,
          cu.paid_date,
          cu.hidden,
          -- Delegated permissions
          cu.manage_results,
          cu.manage_fixtures,
          cu.manage_players,
          cu.manage_promote,
          -- Get pick statistics for each player
          pick_stats.total_picks,
          pick_stats.successful_picks,
          pick_stats.last_pick_date,
          -- Calculate success rate
          CASE
            WHEN pick_stats.total_picks > 0 THEN
              ROUND((pick_stats.successful_picks::decimal / pick_stats.total_picks::decimal) * 100, 1)
            ELSE 0
          END as pick_success_rate
        FROM competition_user cu
        INNER JOIN app_user u ON cu.user_id = u.id
        -- Get pick statistics for each player
        LEFT JOIN (
          SELECT
            p.user_id,
            COUNT(*) as total_picks,
            COUNT(CASE WHEN f.result IS NOT NULL AND
                        ((p.team = 'home' AND f.result = 'home_win') OR
                         (p.team = 'away' AND f.result = 'away_win'))
                  THEN 1 END) as successful_picks,
            MAX(p.created_at) as last_pick_date
          FROM pick p
          INNER JOIN round r ON p.round_id = r.id
          LEFT JOIN fixture f ON p.fixture_id = f.id
          WHERE r.competition_id = $1
          GROUP BY p.user_id
        ) pick_stats ON u.id = pick_stats.user_id
        WHERE cu.competition_id = $1
        ORDER BY u.display_name ASC
        LIMIT $2 OFFSET $3
      `;
      playersParams = [competition_id, itemsPerPage, offset];
    }

    const playersResult = await query(playersQuery, playersParams);

    // Build competition object with retrieved data
    const competition = {
      id: competitionData.id,
      name: competitionData.name,
      player_count: parseInt(playerStats.total_players) || 0,
      active_count: parseInt(playerStats.active_players) || 0,
      eliminated_count: parseInt(playerStats.eliminated_players) || 0,
      invite_code: competitionData.invite_code,
      current_round: competitionData.current_round || 0,
      total_rounds: parseInt(competitionData.total_rounds) || 0,
      is_organiser: competitionData.organiser_id === user_id
    };

    // Build pagination object
    const totalPlayers = parseInt(playerStats.total_players) || 0;
    const totalPages = Math.ceil(totalPlayers / itemsPerPage);
    const pagination = {
      current_page: currentPage,
      page_size: itemsPerPage,
      total_players: totalPlayers,
      total_pages: totalPages
    };

    // Build players array from query results
    const players = playersResult.rows.map(row => ({
      id: row.player_id,
      display_name: row.display_name,
      email: row.email,
      status: row.status || 'active', // Return database status as-is ('active' or 'out')
      lives_remaining: row.lives_remaining || 0,
      joined_at: row.joined_at,
      paid: row.paid || false,
      paid_date: row.paid_date,
      hidden: row.hidden || false, // Include hidden status for admin visibility
      // Delegated permissions
      manage_results: row.manage_results || false,
      manage_fixtures: row.manage_fixtures || false,
      manage_players: row.manage_players || false,
      manage_promote: row.manage_promote || false,
      total_picks: parseInt(row.total_picks) || 0,
      successful_picks: parseInt(row.successful_picks) || 0,
      pick_success_rate: parseFloat(row.pick_success_rate) || 0,
      last_pick_date: row.last_pick_date
    }));

    // Return success response with competition, pagination, and player data
    return res.json({
      return_code: "SUCCESS",
      competition: competition,
      pagination: pagination,
      players: players
    });

  } catch (error) {
    // Log detailed error information for debugging while protecting sensitive data
    console.error('Get competition players error:', {
      error: error.message,
      stack: error.stack.substring(0, 500), // Truncate stack trace
      competition_id: req.body?.competition_id,
      user_id: req.user?.id,
      timestamp: new Date().toISOString()
    });
    
    // Return standardized server error response
    return res.json({
      return_code: "SERVER_ERROR", 
      message: "Failed to retrieve competition players"
    });
  }
});

module.exports = router;