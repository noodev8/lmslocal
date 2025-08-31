/*
=======================================================================================================================================
API Route: mycompetitions
=======================================================================================================================================
Method: POST
Purpose: Retrieves all competitions where user is organiser or participant with comprehensive competition details
=======================================================================================================================================
Request Payload:
{}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "competitions": [
    {
      "id": 123,                                // integer, unique competition ID
      "name": "Premier League LMS 2025",       // string, competition name
      "description": "Annual football comp",   // string, competition description
      "status": "LOCKED",                      // string, competition status
      "lives_per_player": 1,                   // integer, lives per player
      "no_team_twice": true,                   // boolean, team reuse prevention
      "invite_code": "4567",                   // string, 4-digit invite code
      "slug": "10001",                         // string, competition slug
      "team_list_id": 1,                       // integer, associated team list ID
      "team_list_name": "Premier League",     // string, team list name
      "player_count": 15,                      // integer, number of players
      "created_at": "2025-01-01T12:00:00Z",    // string, ISO datetime when created
      "current_round": 3,                      // integer, current round number (null if none)
      "is_organiser": true                     // boolean, true if user is organiser
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
const { query } = require('../database');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();


router.post('/', verifyToken, async (req, res) => {
  try {
    const user_id = req.user.id;

    // Get all competitions where user is either organiser or participant
    // Uses single query with LEFT JOINs to eliminate N+1 query problems
    // This approach uses only 1 database connection instead of 1 + (2 * competition_count)
    const result = await query(`
      SELECT DISTINCT
        c.id,
        c.name,
        c.description,
        c.status,
        c.lives_per_player,
        c.no_team_twice,
        c.invite_code,
        c.slug,
        c.created_at,
        c.team_list_id,
        c.organiser_id,
        tl.name as team_list_name,
        -- Use LEFT JOIN with GROUP BY to get player count in single query (not N+1 subquery)
        COALESCE(pc.player_count, 0) as player_count,
        -- Use LEFT JOIN with GROUP BY to get current round in single query (not N+1 subquery)
        ri.current_round
      FROM competition c
      -- Join team list for team list name
      JOIN team_list tl ON c.team_list_id = tl.id
      -- LEFT JOIN aggregated active player counts to avoid N+1 queries
      LEFT JOIN (
        SELECT competition_id, COUNT(*) as player_count
        FROM competition_user 
        WHERE status != 'OUT'
        GROUP BY competition_id
      ) pc ON c.id = pc.competition_id
      -- LEFT JOIN aggregated round info to avoid N+1 queries
      LEFT JOIN (
        SELECT competition_id, MAX(round_number) as current_round
        FROM round 
        GROUP BY competition_id  
      ) ri ON c.id = ri.competition_id
      WHERE (
        -- Include competitions where user is the organiser
        c.organiser_id = $1 OR 
        -- Include competitions where user is a participant (uses EXISTS for performance)
        EXISTS (SELECT 1 FROM competition_user cu WHERE cu.competition_id = c.id AND cu.user_id = $1)
      )
      ORDER BY c.created_at DESC
    `, [user_id]);

    // Transform database results into clean API response format
    res.json({
      return_code: "SUCCESS",
      competitions: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        lives_per_player: row.lives_per_player,
        no_team_twice: row.no_team_twice,
        invite_code: row.invite_code,
        slug: row.slug,
        team_list_id: row.team_list_id,
        team_list_name: row.team_list_name,
        player_count: parseInt(row.player_count), // Ensure integer type
        created_at: row.created_at,
        current_round: row.current_round, // null if no rounds created yet
        is_organiser: row.organiser_id === user_id // Boolean flag for frontend filtering
      }))
    });

  } catch (error) {
    console.error('Get my competitions error:', error);
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;