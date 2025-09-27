/*
=======================================================================================================================================
API Route: get-user-dashboard
=======================================================================================================================================
Method: POST
Purpose: Unified user dashboard API that returns ALL competitions and data for a user, combining organizer and participant perspectives
=======================================================================================================================================
Request Payload:
{}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "competitions": [
    {
      "id": 123,                                // integer, unique competition ID
      "name": "Premier League LMS",             // string, competition name
      "description": "Annual competition",       // string, competition description
      "status": "ACTIVE",                       // string, competition status
      "lives_per_player": 1,                    // integer, lives per player
      "no_team_twice": true,                    // boolean, team reuse restriction
      "invite_code": "1234",                    // string, 4-digit join code
      "slug": "premier-lms",                    // string, competition slug
      "team_list_id": 1,                        // integer, team list ID
      "team_list_name": "Premier League",      // string, team list name
      "created_at": "2025-01-01T12:00:00Z",    // string, ISO creation datetime
      "player_count": 15,                       // integer, active players in competition
      "current_round": 3,                       // integer, current round number
      "total_rounds": 10,                       // integer, total rounds created
      "is_complete": false,                     // boolean, competition finished
      "is_organiser": true,                     // boolean, user is organizer
      "is_participant": true,                   // boolean, user is participating
      "user_status": "active",                  // string, user's participation status (null if not participating)
      "lives_remaining": 2,                     // integer, user's remaining lives (null if not participating)
      "joined_at": "2025-01-01T12:00:00Z",     // string, when user joined (null if not participating)
      "needs_pick": true,                       // boolean, user needs to make pick (null if not participating)
      "current_pick": {                         // object, user's current pick (null if not participating or no pick)
        "team": "MAN",                          // string, picked team short name
        "team_full_name": "Manchester United", // string, full team name
        "fixture": "Manchester United v Liverpool" // string, fixture description
      },
      "history": [                              // array, user's pick history (empty if not participating)
        {
          "round_number": 1,                    // integer, round number
          "pick_team": "CHE",                   // string, team picked
          "pick_team_full_name": "Chelsea",    // string, full team name
          "fixture": "Chelsea vs Arsenal",     // string, fixture description
          "pick_result": "win",                 // string, result: 'win', 'loss', 'no_pick', 'pending'
          "lock_time": "2025-01-01T15:00:00Z"  // string, when round locked
        }
      ]
    }
  ]
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"        // string, user-friendly error description
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"UNAUTHORIZED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  // Log API call if enabled
  logApiCall('get-user-dashboard');
  
  try {
    // Extract authenticated user ID
    const user_id = req.user.id;


    // === MAIN QUERY: COMPREHENSIVE USER COMPETITION DATA ===
    // Get all competitions where user is organizer OR participant with full context
    const mainQuery = `
      SELECT DISTINCT
        -- === COMPETITION METADATA ===
        c.id,                                   -- Competition identifier
        c.name,                                 -- Competition name
        c.description,                          -- Competition description
        c.logo_url,                            -- Competition logo URL
        c.venue_name,                          -- Venue/organization name
        c.status,                              -- Competition status
        c.lives_per_player,                    -- Lives per player setting
        c.no_team_twice,                       -- Team reuse restriction
        c.invite_code,                         -- 4-digit join code
        c.slug,                                -- Competition slug
        c.team_list_id,                        -- Team list identifier
        c.created_at,                          -- Competition creation time
        c.organiser_id,                        -- Organizer user ID
        tl.name as team_list_name,             -- Team list name
        
        -- === USER RELATIONSHIP STATUS ===
        CASE WHEN c.organiser_id = $1 THEN true ELSE false END as is_organiser,   -- User is organizer
        CASE WHEN cu.user_id IS NOT NULL THEN true ELSE false END as is_participant, -- User is participant
        
        -- === PARTICIPATION DATA (null if not participating) ===
        cu.status as user_status,              -- User's competition status
        cu.lives_remaining,                    -- User's remaining lives
        cu.joined_at,                          -- When user joined as participant
        
        -- === COMPETITION STATISTICS ===
        COALESCE(player_counts.total_players, 0) as total_players,         -- Total players
        COALESCE(player_counts.active_players, 0) as active_players,       -- Active players remaining
        
        -- === ROUND INFORMATION ===
        round_info.current_round,              -- Current round number
        round_info.total_rounds,               -- Total rounds created
        round_info.current_round_lock_time,    -- When current round locks
        round_info.current_round_id,           -- Current round ID for pick stats
        
        -- === PICK STATISTICS FOR CURRENT ROUND ===
        COALESCE(pick_stats.picks_made, 0) as picks_made,         -- Picks made this round
        COALESCE(player_counts.active_players, 0) as picks_required, -- Picks required (active players)
        
        -- === CURRENT PICK INFORMATION ===
        current_pick.team as current_pick_team,                    -- User's current pick team
        current_pick.team_full_name as current_pick_team_full_name, -- Full team name
        current_pick.fixture_info as current_pick_fixture,         -- Fixture description
        
        -- === CALCULATED FIELDS ===
        CASE 
          WHEN current_pick.id IS NULL 
           AND round_info.current_round IS NOT NULL 
           AND cu.user_id IS NOT NULL 
          THEN true 
          ELSE false 
        END as needs_pick,                     -- User needs to make a pick
        
        CASE WHEN c.status = 'COMPLETE' THEN true ELSE false END as is_complete  -- Competition finished
        
      FROM competition c
      
      -- === JOIN TEAM LIST ===
      LEFT JOIN team_list tl ON c.team_list_id = tl.id
      
      -- === JOIN PARTICIPATION DATA ===
      -- Only includes data if user is participating, null otherwise
      LEFT JOIN competition_user cu ON c.id = cu.competition_id AND cu.user_id = $1
      
      -- === JOIN PLAYER STATISTICS ===
      LEFT JOIN (
        SELECT competition_id, 
               COUNT(*) as total_players,
               COUNT(CASE WHEN status = 'active' THEN 1 END) as active_players
        FROM competition_user 
        GROUP BY competition_id
      ) player_counts ON c.id = player_counts.competition_id
      
      -- === JOIN ROUND INFORMATION ===
      LEFT JOIN (
        SELECT competition_id,
               MAX(round_number) as current_round,
               COUNT(*) as total_rounds,
               MAX(lock_time) as current_round_lock_time,
               MAX(id) as current_round_id  -- Get current round ID for pick stats
        FROM round 
        GROUP BY competition_id
      ) round_info ON c.id = round_info.competition_id
      
      -- === JOIN PICK STATISTICS FOR CURRENT ROUND ===
      LEFT JOIN (
        SELECT r.competition_id,
               COUNT(p.id) as picks_made
        FROM round r
        INNER JOIN (
          SELECT competition_id, MAX(round_number) as max_round_number
          FROM round
          GROUP BY competition_id
        ) latest_rounds ON r.competition_id = latest_rounds.competition_id
                       AND r.round_number = latest_rounds.max_round_number
        LEFT JOIN pick p ON r.id = p.round_id
        GROUP BY r.competition_id
      ) pick_stats ON c.id = pick_stats.competition_id
      
      -- === JOIN CURRENT PICK (only if user is participating) ===
      LEFT JOIN (
        SELECT
          p.round_id,
          p.user_id,
          p.id,
          p.team,
          t.name as team_full_name,
          CONCAT(f.home_team, ' v ', f.away_team) as fixture_info,
          r.competition_id
        FROM pick p
        JOIN round r ON p.round_id = r.id
        INNER JOIN (
          SELECT competition_id, MAX(round_number) as max_round_number
          FROM round
          GROUP BY competition_id
        ) latest_rounds ON r.competition_id = latest_rounds.competition_id
                       AND r.round_number = latest_rounds.max_round_number
        LEFT JOIN team t ON t.short_name = p.team AND t.is_active = true
        LEFT JOIN fixture f ON p.fixture_id = f.id
        WHERE p.user_id = $1
      ) current_pick ON c.id = current_pick.competition_id
      
      WHERE (
        -- User has access as organizer OR participant
        c.organiser_id = $1 OR
        (cu.user_id IS NOT NULL AND (cu.hidden IS NULL OR cu.hidden = false))
      )
      
      ORDER BY c.created_at DESC
    `;

    const mainResult = await query(mainQuery, [user_id]);


    // === CHECK AND UPDATE INVITE CODES FOR COMPETITIONS ===
    // For each competition with invite_code, check if Round 1 lock time has passed
    for (const comp of mainResult.rows) {
      if (comp.invite_code) {
        // Get Round 1 lock time for this competition
        const round1Result = await query(`
          SELECT lock_time 
          FROM round 
          WHERE competition_id = $1 AND round_number = 1
        `, [comp.id]);
        
        if (round1Result.rows.length > 0) {
          const round1LockTime = new Date(round1Result.rows[0].lock_time);
          const currentTime = new Date();
          
          if (currentTime >= round1LockTime) {
            // Round 1 lock time has passed - set invite_code to NULL and status to active
            await query(`
              UPDATE competition 
              SET invite_code = NULL, status = 'active'
              WHERE id = $1 AND invite_code IS NOT NULL
            `, [comp.id]);
            
            // Update the data object for the response
            comp.invite_code = null;
            comp.status = 'active';
          }
        }
      }
    }

    // === BUILD COMPETITION ARRAY WITH HISTORY ===
    const competitions = [];
    
    for (const comp of mainResult.rows) {
      // === GET PICK HISTORY (only if user is participating) ===
      let history = [];
      if (comp.is_participant && comp.current_round && comp.current_round > 1) {
        const historyQuery = `
          SELECT 
            r.round_number,                     -- Round number
            r.lock_time,                        -- When round locked
            p.team as pick_team,                -- Team picked
            t.name as pick_team_full_name,      -- Full team name
            CONCAT(f.home_team, ' v ', f.away_team) as fixture, -- Fixture description
            COALESCE(p.outcome, 'pending') as pick_result       -- Pick result
          FROM round r
          LEFT JOIN pick p ON r.id = p.round_id AND p.user_id = $1
          LEFT JOIN team t ON t.short_name = p.team AND t.is_active = true
          LEFT JOIN fixture f ON p.fixture_id = f.id
          WHERE r.competition_id = $2
            AND r.round_number < $3
            AND r.round_number IS NOT NULL
          ORDER BY r.round_number DESC
        `;
        
        const historyResult = await query(historyQuery, [user_id, comp.id, comp.current_round]);
        history = historyResult.rows.map(row => ({
          round_number: row.round_number,
          pick_team: row.pick_team,
          pick_team_full_name: row.pick_team_full_name || row.pick_team,
          fixture: row.fixture,
          pick_result: row.pick_result === 'WIN' ? 'win' : 
                      row.pick_result === 'LOSE' ? 'loss' : 
                      row.pick_result === 'NO_PICK' ? 'no_pick' : 'pending',
          lock_time: row.lock_time
        }));
      }

      // === ASSEMBLE FINAL COMPETITION OBJECT ===
      competitions.push({
        // Competition metadata
        id: comp.id,
        name: comp.name,
        description: comp.description,
        logo_url: comp.logo_url,
        venue_name: comp.venue_name,
        status: comp.status,
        lives_per_player: comp.lives_per_player,
        no_team_twice: comp.no_team_twice,
        invite_code: comp.invite_code,
        slug: comp.slug,
        team_list_id: comp.team_list_id,
        team_list_name: comp.team_list_name,
        created_at: comp.created_at,
        
        // Competition statistics
        player_count: parseInt(comp.active_players || 0),
        total_players: parseInt(comp.total_players || 0),
        current_round: comp.current_round,
        current_round_lock_time: comp.current_round_lock_time,
        total_rounds: parseInt(comp.total_rounds || 0),
        is_complete: comp.is_complete,
        
        // Pick statistics for current round
        picks_made: parseInt(comp.picks_made || 0),
        picks_required: parseInt(comp.picks_required || 0),
        pick_completion_percentage: comp.picks_required > 0 ? Math.round((comp.picks_made / comp.picks_required) * 100) : 0,
        
        // User relationship
        is_organiser: comp.is_organiser,
        is_participant: comp.is_participant,
        
        // Participation data (null if not participating)
        user_status: comp.user_status || null,
        lives_remaining: comp.lives_remaining !== null ? parseInt(comp.lives_remaining) : null,
        joined_at: comp.joined_at || null,
        needs_pick: comp.is_participant ? comp.needs_pick : null,
        
        // Current pick data (null if not participating or no pick)
        current_pick: comp.current_pick_team ? {
          team: comp.current_pick_team,
          team_full_name: comp.current_pick_team_full_name || comp.current_pick_team,
          fixture: comp.current_pick_fixture || 'TBD'
        } : null,
        
        // Pick history (empty array if not participating)
        history: history
      });
    }

    // === LATEST ROUND STATISTICS ===
    // Get the latest round stats across all competitions user participates in
    let latestRoundStats = null;
    try {
      // Find the most recent round with processed results across all user's competitions
      const latestRoundResult = await query(`
        SELECT DISTINCT
          c.id as competition_id,
          c.name as competition_name,
          r.round_number,
          cu.status as user_status,
          pp.outcome as user_outcome,
          pp.chosen_team,
          r.id as round_id
        FROM competition c
        INNER JOIN competition_user cu ON c.id = cu.competition_id
        INNER JOIN round r ON c.id = r.competition_id
        LEFT JOIN player_progress pp ON r.id = pp.round_id AND pp.player_id = cu.user_id
        WHERE cu.user_id = $1
        AND cu.hidden IS NOT TRUE
        AND r.id IN (
          SELECT round_id
          FROM (
            SELECT round_id,
                   COUNT(*) as total_fixtures,
                   COUNT(CASE WHEN processed IS NOT NULL THEN 1 END) as processed_fixtures
            FROM fixture
            GROUP BY round_id
          ) fixture_stats
          WHERE total_fixtures > 0 AND total_fixtures = processed_fixtures
        )
        ORDER BY r.round_number DESC, c.id DESC
        LIMIT 1
      `, [user_id]);

      if (latestRoundResult.rows.length > 0) {
        const latestRound = latestRoundResult.rows[0];

        // Get statistics for this round
        const roundStatsResult = await query(`
          SELECT
            COUNT(CASE WHEN cu.status = 'out' THEN 1 END) as total_eliminated,
            COUNT(CASE WHEN cu.status = 'active' THEN 1 END) as survivors,
            COUNT(*) as total_players
          FROM competition_user cu
          WHERE cu.competition_id = $1
        `, [latestRound.competition_id]);

        // Get players eliminated in this specific round
        const thisRoundEliminatedResult = await query(`
          SELECT COUNT(DISTINCT pp.player_id) as eliminated_this_round
          FROM player_progress pp
          WHERE pp.round_id = $1
          AND pp.outcome = 'LOSE'
          AND EXISTS (
            SELECT 1 FROM competition_user cu
            WHERE cu.user_id = pp.player_id
            AND cu.competition_id = $2
            AND cu.status = 'out'
          )
        `, [latestRound.round_id, latestRound.competition_id]);

        const stats = roundStatsResult.rows[0];
        const eliminatedThisRound = parseInt(thisRoundEliminatedResult.rows[0].eliminated_this_round) || 0;

        // Always return stats, let frontend decide when to show announcements
        latestRoundStats = {
          competition_id: latestRound.competition_id,
          competition_name: latestRound.competition_name,
          round_number: latestRound.round_number,
          eliminated_this_round: eliminatedThisRound,
          survivors: parseInt(stats.survivors) || 0,
          total_eliminated: parseInt(stats.total_eliminated) || 0,
          total_players: parseInt(stats.total_players) || 0,
          user_outcome: latestRound.user_outcome, // 'WIN', 'LOSE', or null
          user_status: latestRound.user_status, // 'active' or 'out'
          user_picked_team: latestRound.chosen_team
        };
      }
    } catch (error) {
      console.error('Error fetching latest round stats:', error);
      // Don't fail the whole response if round stats fail
    }

    // === SUCCESS RESPONSE ===
    res.json({
      return_code: "SUCCESS",
      competitions: competitions,
      latest_round_stats: latestRoundStats
    });

  } catch (error) {
    console.error('Get user dashboard error:', error);
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;