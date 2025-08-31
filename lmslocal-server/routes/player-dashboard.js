/*
=======================================================================================================================================
API Route: player-dashboard
=======================================================================================================================================
Method: POST
Purpose: Retrieves comprehensive dashboard data for competitions where user participates (not organizes)
=======================================================================================================================================
Request Payload:
{}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "competitions": [                            // array, competitions where user participates
    {
      "id": 123,                               // integer, unique competition ID
      "name": "Premier League Last Man Standing", // string, competition name
      "player_count": 15,                      // integer, total players in competition
      "current_round": 3,                      // integer, current round number
      "total_rounds": 10,                      // integer, total rounds created
      "needs_pick": true,                      // boolean, user needs to make a pick
      "current_pick": {                        // object, user's current pick (if made)
        "team": "MAN",                         // string, team short name
        "team_full_name": "Manchester United", // string, full team name
        "fixture": "Manchester United v Chelsea" // string, fixture description
      },
      "is_organiser": false,                   // boolean, always false for this endpoint
      "lives_remaining": 2,                    // integer, user's remaining lives
      "user_status": "active",                 // string, user's status in competition
      "is_complete": false,                    // boolean, competition finished
      "winner": {                              // object, winner info (if complete)
        "display_name": "John Smith",          // string, winner's name
        "email": "john@example.com",           // string, winner's email
        "joined_at": "2025-01-01T12:00:00Z"   // string, when winner joined
      },
      "history": [                             // array, round-by-round user history
        {
          "round_number": 1,                   // integer, round number
          "pick_team": "ARS",                  // string, user's pick
          "pick_result": "win"                 // string, pick outcome
        }
      ]
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
    // Extract authenticated user ID for dashboard data filtering
    const user_id = req.user.id;

    // === SINGLE COMPREHENSIVE QUERY (ELIMINATES N+1 PROBLEM) ===
    // This massive query replaces what used to be 70-90+ individual queries
    // Gets all competition data, player stats, current round info, and pick status in ONE efficient query
    // Uses multiple LEFT JOINs with subqueries to aggregate all related data without N+1 patterns
    const result = await query(`
      SELECT 
        -- === COMPETITION BASIC INFO ===
        c.id as competition_id,         -- Unique competition identifier
        c.name,                         -- Competition name for display
        c.organiser_id,                 -- Competition organiser (excluded from results)
        c.created_at,                   -- Creation timestamp for ordering
        c.invite_code,                  -- Join code (null if competition closed)
        cu.lives_remaining,             -- User's remaining lives in this competition
        cu.status as user_status,       -- User's status: 'active', 'OUT', etc.
        CASE WHEN c.organiser_id = $1 THEN true ELSE false END as is_organiser, -- Always false (filter excludes organised competitions)
        
        -- === PLAYER STATISTICS (AGGREGATED TO AVOID N+1) ===
        player_stats.active_count,     -- Number of active players remaining
        player_stats.total_count,      -- Total players who joined competition
        
        -- === CURRENT ROUND INFO (LATEST ROUND DATA) ===
        latest_round.round_id as current_round_id,       -- Current round database ID
        latest_round.round_number as current_round,      -- Current round number for display
        latest_round.lock_time as current_round_lock_time, -- When picks lock for current round
        latest_round.fixture_count,                      -- Number of fixtures in current round
        
        -- === ROUND TOTALS ===
        round_stats.total_rounds,       -- Total rounds created in competition
        
        -- === CURRENT PICK INFO (IF USER HAS MADE A PICK) ===
        current_pick.team as pick_team,               -- User's picked team short name
        current_pick.team_full_name as pick_team_full_name, -- User's picked team full name
        current_pick.home_team as pick_home_team,     -- Home team in picked fixture
        current_pick.away_team as pick_away_team,     -- Away team in picked fixture
        
        -- === WINNER INFO (IF COMPETITION COMPLETE) ===
        winner_info.winner_display_name,  -- Winner's display name
        winner_info.winner_email,          -- Winner's email
        winner_info.winner_joined_at       -- When winner joined competition
        
      FROM competition c
      INNER JOIN competition_user cu ON c.id = cu.competition_id
      
      -- === PLAYER STATISTICS SUBQUERY (PREVENTS N+1) ===
      -- Gets active/total player counts for all competitions in one go
      LEFT JOIN (
        SELECT competition_id,
               COUNT(*) FILTER (WHERE status = 'active') as active_count, -- Active players remaining
               COUNT(*) as total_count                                    -- Total players who joined
        FROM competition_user
        GROUP BY competition_id
      ) player_stats ON c.id = player_stats.competition_id
      
      -- === LATEST ROUND SUBQUERY WITH FIXTURE COUNTS (PREVENTS N+1) ===
      -- Gets current round info and fixture count using window functions for efficiency
      LEFT JOIN (
        SELECT r.competition_id,
               r.id as round_id,                                          -- Round database ID
               r.round_number,                                            -- Round number for display
               r.lock_time,                                               -- When picks lock
               COALESCE(f_count.fixture_count, 0) as fixture_count,       -- Fixtures in this round
               ROW_NUMBER() OVER (PARTITION BY r.competition_id ORDER BY r.round_number DESC) as rn -- Latest round selector
        FROM round r
        LEFT JOIN (
          SELECT round_id, COUNT(*) as fixture_count                     -- Fixture count per round
          FROM fixture
          GROUP BY round_id
        ) f_count ON r.id = f_count.round_id
      ) latest_round ON c.id = latest_round.competition_id AND latest_round.rn = 1 -- Only latest round
      
      -- === ROUND STATISTICS SUBQUERY (PREVENTS N+1) ===
      -- Gets total rounds created per competition
      LEFT JOIN (
        SELECT competition_id, MAX(round_number) as total_rounds          -- Highest round number
        FROM round
        GROUP BY competition_id
      ) round_stats ON c.id = round_stats.competition_id
      
      -- === CURRENT PICK SUBQUERY (PREVENTS N+1) ===
      -- Gets user's pick for current round if it exists
      LEFT JOIN (
        SELECT p.round_id, p.user_id, p.team, t.name as team_full_name,  -- Pick details
               f.home_team, f.away_team                                   -- Fixture details
        FROM pick p
        JOIN fixture f ON p.fixture_id = f.id                            -- Get fixture info
        JOIN team t ON t.short_name = p.team                             -- Get full team name
        WHERE p.user_id = $1                                              -- Only this user's picks
      ) current_pick ON latest_round.round_id = current_pick.round_id AND current_pick.user_id = $1
      
      -- === WINNER INFO SUBQUERY (PREVENTS N+1) ===
      -- Gets winner details for completed competitions (1 active player, no invite code)
      LEFT JOIN (
        SELECT cu.competition_id, u.display_name as winner_display_name,  -- Winner's name
               u.email as winner_email, cu.joined_at as winner_joined_at  -- Winner's details
        FROM competition_user cu
        INNER JOIN app_user u ON cu.user_id = u.id                       -- Get user details
        WHERE cu.status = 'active'                                        -- Only active players
      ) winner_info ON c.id = winner_info.competition_id                  -- Match competition
                    AND player_stats.active_count = 1                     -- Exactly 1 active player
                    AND c.invite_code IS NULL                              -- Competition closed to new players
      
      WHERE cu.user_id = $1 AND c.organiser_id != $1                      -- User participates but doesn't organise
      ORDER BY c.created_at DESC                                          -- Most recent competitions first
    `, [user_id]);

    // === DATA PROCESSING (CLIENT-SIDE LOGIC) ===
    // Transform raw database results into clean competition objects with calculated fields
    // All business logic is processed here to avoid additional database queries
    const competitions = result.rows.map(row => {
      // Calculate time-based status
      const now = new Date();
      const isLocked = row.current_round_lock_time && now >= new Date(row.current_round_lock_time);
      
      // Determine pick requirements and status
      const fixturesExist = parseInt(row.fixture_count) > 0;     // Are there fixtures to pick from?
      const userHasPick = !!row.pick_team;                       // Has user made a pick?
      const activePlayers = parseInt(row.active_count || 0);     // Active players remaining
      const totalPlayers = parseInt(row.total_count || 0);       // Total players who joined
      
      // Build competition object with all calculated fields
      const competition = {
        id: row.competition_id,                    // For API calls and routing
        name: row.name,                            // Competition display name
        organiser_id: row.organiser_id,            // Organiser reference (not displayed)
        created_at: row.created_at,                // Creation timestamp
        invite_code: row.invite_code,              // Join code (null if closed)
        player_count: totalPlayers,                // Total players for display
        total_rounds: row.total_rounds || 0,       // Rounds created so far
        current_round: row.current_round,          // Current round number
        current_round_lock_time: row.current_round_lock_time, // Pick deadline
        lives_remaining: row.lives_remaining,       // User's remaining lives
        user_status: row.user_status,              // User's competition status
        is_organiser: row.is_organiser,            // Always false (filtered out)
        is_locked: isLocked,                       // Can user still make picks?
        active_players: activePlayers,             // Players still in competition
        total_players: totalPlayers,               // Total participants
        is_complete: activePlayers === 1 && !row.invite_code, // Competition finished?
        needs_pick: fixturesExist && !userHasPick && !isLocked && row.user_status === 'active' // Urgent pick needed?
      };
      
      // === ADD CURRENT PICK INFO (IF USER HAS MADE A PICK) ===
      if (userHasPick) {
        competition.current_pick = {
          team: row.pick_team,                     // Short team name (e.g., "MAN")
          team_full_name: row.pick_team_full_name, // Full team name (e.g., "Manchester United")
          fixture: `${row.pick_home_team} v ${row.pick_away_team}` // Fixture description for display
        };
      }
      
      // === ADD WINNER INFO (IF COMPETITION COMPLETE) ===
      if (competition.is_complete && row.winner_display_name) {
        competition.winner = {
          display_name: row.winner_display_name,   // Winner's display name
          email: row.winner_email,                 // Winner's email
          joined_at: row.winner_joined_at          // When winner joined
        };
      }
      
      return competition;
    });

    // === GET ROUND HISTORY (BULK QUERY FOR ALL COMPETITIONS) ===
    // Second and final query: get complete round history for ALL competitions in single query
    // This replaces what used to be N additional queries (one per competition)
    if (competitions.length > 0) {
      const competitionIds = competitions.map(c => c.id);
      const historyResult = await query(`
        SELECT 
          r.competition_id,                    -- Links history to competition
          r.id as round_id,                    -- Round identifier
          r.round_number,                      -- Round number for display
          r.lock_time,                         -- When picks locked
          r.created_at as round_created,       -- When round was created
          p.team as pick_team,                 -- User's team pick (short name)
          p.fixture_id as pick_fixture_id,     -- Which fixture user picked
          p.created_at as pick_created,        -- When user made pick
          t.name as pick_team_full_name,       -- Full name of picked team
          f.home_team,                         -- Home team in fixture
          f.away_team,                         -- Away team in fixture
          f.result,                            -- Fixture result
          cu.lives_remaining,                  -- User's lives at this point
          cu.status as player_status,          -- User's status in competition
          CASE                                 -- Calculate pick outcome
            WHEN p.team IS NULL THEN 'no_pick'                      -- User didn't pick
            WHEN f.result IS NULL THEN 'pending'                    -- Result not available
            WHEN (p.team = 'home' AND f.result = 'home_win') OR     -- User picked winner
                 (p.team = 'away' AND f.result = 'away_win') THEN 'win'
            WHEN f.result = 'draw' THEN 'draw'                      -- Draw result
            ELSE 'loss'                                             -- User's pick lost
          END as pick_result
        FROM round r
        LEFT JOIN pick p ON p.round_id = r.id AND p.user_id = $1   -- User's pick for this round
        LEFT JOIN team t ON t.short_name = p.team                  -- Full team name
        LEFT JOIN fixture f ON f.id = p.fixture_id                 -- Fixture details
        CROSS JOIN competition_user cu                              -- User's competition status
        WHERE r.competition_id = ANY($2)                           -- Only user's competitions
          AND cu.competition_id = r.competition_id                 -- Match competition
          AND cu.user_id = $1                                      -- Only this user
        ORDER BY r.competition_id, r.round_number ASC             -- Chronological order
      `, [user_id, competitionIds]);
      
      // === GROUP HISTORY BY COMPETITION (CLIENT-SIDE PROCESSING) ===
      // Organize history data by competition for efficient attachment
      const historyByCompetition = {};
      historyResult.rows.forEach(row => {
        if (!historyByCompetition[row.competition_id]) {
          historyByCompetition[row.competition_id] = [];
        }
        historyByCompetition[row.competition_id].push(row);
      });
      
      // === ATTACH HISTORY TO COMPETITIONS ===
      // Add round-by-round history to each competition object
      competitions.forEach(comp => {
        comp.history = historyByCompetition[comp.id] || []; // Empty array if no history
      });
    }

    // === SUCCESS RESPONSE ===
    // Return complete dashboard data with all competition details and history
    // This single response contains everything the player dashboard needs to render
    res.json({
      return_code: "SUCCESS",
      competitions: competitions      // Array of competition objects with complete data
    });

  } catch (error) {
    // === ERROR HANDLING ===
    // Log detailed error for debugging but return generic message to client for security
    console.error('Player dashboard error:', error);
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;