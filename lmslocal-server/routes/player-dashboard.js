/*
=======================================================================================================================================
Player Dashboard Route - Get competitions where user is a participant
=======================================================================================================================================
Purpose: Return competitions where the authenticated user is participating (not organizing)
=======================================================================================================================================
*/

const express = require('express');
const jwt = require('jsonwebtoken');
const { query } = require('../database');
const router = express.Router();

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        return_code: "UNAUTHORIZED",
        message: "No token provided"
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const userId = decoded.user_id || decoded.userId; // Handle both formats
    const result = await query('SELECT id, email, display_name, email_verified FROM app_user WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(401).json({
        return_code: "UNAUTHORIZED",
        message: "Invalid token"
      });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    return res.status(401).json({
      return_code: "UNAUTHORIZED",
      message: "Invalid token"
    });
  }
};

/*
=======================================================================================================================================
API Route: /player-dashboard
=======================================================================================================================================
Method: POST
Purpose: Get all competitions where the user is a participant (not organizer)
=======================================================================================================================================
Request Payload:
{}

Success Response:
{
  "return_code": "SUCCESS",
  "competitions": [
    {
      "id": 123,
      "name": "Premier League Last Man Standing",
      "player_count": 15,
      "current_round": 3,
      "total_rounds": 10,
      "needs_pick": true,
      "my_pick": "MAN",
      "is_organiser": false,
      "lives_remaining": 2,
      "user_status": "active"
    }
  ]
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"UNAUTHORIZED"
"SERVER_ERROR"
=======================================================================================================================================
*/
router.post('/', verifyToken, async (req, res) => {
  try {
    const user_id = req.user.id;

    // Get competitions where user is a participant (not organizer)
    const competitionsResult = await query(`
      SELECT 
        c.id,
        c.name,
        c.organiser_id,
        c.created_at,
        c.invite_code,
        (SELECT COUNT(*) FROM competition_user cu WHERE cu.competition_id = c.id) as player_count,
        (SELECT MAX(round_number) FROM round WHERE competition_id = c.id) as total_rounds,
        (
          SELECT r.round_number 
          FROM round r 
          WHERE r.competition_id = c.id 
          ORDER BY r.round_number DESC 
          LIMIT 1
        ) as current_round,
        (
          SELECT r.lock_time 
          FROM round r 
          WHERE r.competition_id = c.id 
          ORDER BY r.round_number DESC 
          LIMIT 1
        ) as current_round_lock_time,
        cu.lives_remaining,
        cu.status as user_status,
        CASE WHEN c.organiser_id = $1 THEN true ELSE false END as is_organiser
      FROM competition c
      INNER JOIN competition_user cu ON c.id = cu.competition_id
      WHERE cu.user_id = $1 AND c.organiser_id != $1
      ORDER BY c.created_at DESC
    `, [user_id]);

    const competitions = competitionsResult.rows;

    // For each competition, check if user needs to make a pick and lock status
    for (let comp of competitions) {
      // Check if round is locked
      const now = new Date();
      const isLocked = comp.current_round_lock_time && now >= new Date(comp.current_round_lock_time);
      comp.is_locked = isLocked;
      
      // Check if competition is complete (exactly 1 active player)
      const activePlayersResult = await query(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'active') as active_count,
          COUNT(*) as total_count
        FROM competition_user 
        WHERE competition_id = $1
      `, [comp.id]);
      
      const activePlayers = parseInt(activePlayersResult.rows[0].active_count);
      const totalPlayers = parseInt(activePlayersResult.rows[0].total_count);
      
      comp.active_players = activePlayers;
      comp.total_players = totalPlayers;
      comp.is_complete = activePlayers === 1 && !comp.invite_code;
      
      // If competition is complete, get the winner
      if (comp.is_complete) {
        const winnerResult = await query(`
          SELECT u.display_name, u.email, cu.joined_at
          FROM competition_user cu
          INNER JOIN app_user u ON cu.user_id = u.id
          WHERE cu.competition_id = $1 AND cu.status = 'active'
          LIMIT 1
        `, [comp.id]);
        
        if (winnerResult.rows.length > 0) {
          comp.winner = {
            display_name: winnerResult.rows[0].display_name,
            email: winnerResult.rows[0].email,
            joined_at: winnerResult.rows[0].joined_at
          };
        }
      }
      
      if (comp.current_round && comp.user_status === 'active') {
        // Get the round ID for current round
        const roundResult = await query(
          'SELECT id FROM round WHERE competition_id = $1 AND round_number = $2',
          [comp.id, comp.current_round]
        );
        
        if (roundResult.rows.length > 0) {
          const roundId = roundResult.rows[0].id;
          
          // Check if fixtures exist for this round
          const fixtureCountResult = await query(
            'SELECT COUNT(*) as count FROM fixture WHERE round_id = $1',
            [roundId]
          );
          const fixturesExist = parseInt(fixtureCountResult.rows[0].count) > 0;
          
          // Check if user has made a pick for this round and get pick details
          const pickResult = await query(`
            SELECT p.team, f.home_team, f.away_team, f.home_team_short, f.away_team_short,
                   t.name as team_full_name
            FROM pick p
            JOIN fixture f ON p.fixture_id = f.id
            JOIN team t ON t.short_name = p.team
            WHERE p.user_id = $1 AND p.round_id = $2
          `, [user_id, roundId]);
          
          const userHasPick = pickResult.rows.length > 0;
          
          if (userHasPick) {
            const pick = pickResult.rows[0];
            comp.current_pick = {
              team: pick.team,
              team_full_name: pick.team_full_name,
              fixture: `${pick.home_team} v ${pick.away_team}`
            };
          }
          
          // Set the needs_pick status (false if locked)
          comp.needs_pick = fixturesExist && !userHasPick && !isLocked;
        } else {
          comp.needs_pick = false;
        }
      } else {
        comp.needs_pick = false;
      }
    }

    // For each competition, get round history with current lives status
    for (let comp of competitions) {
      const historyResult = await query(`
        SELECT 
          r.id as round_id,
          r.round_number,
          r.lock_time,
          r.created_at as round_created,
          p.team as pick_team,
          p.fixture_id as pick_fixture_id,
          p.created_at as pick_created,
          t.name as pick_team_full_name,
          f.home_team,
          f.away_team,
          f.result,
          cu.lives_remaining,
          cu.status as player_status,
          CASE 
            WHEN p.team IS NULL THEN 'no_pick'
            WHEN f.result IS NULL THEN 'pending'
            WHEN (p.team = 'home' AND f.result = 'home_win') OR 
                 (p.team = 'away' AND f.result = 'away_win') THEN 'win'
            WHEN f.result = 'draw' THEN 'draw'
            ELSE 'loss'
          END as pick_result
        FROM round r
        LEFT JOIN pick p ON p.round_id = r.id AND p.user_id = $1
        LEFT JOIN team t ON t.short_name = p.team
        LEFT JOIN fixture f ON f.id = p.fixture_id
        CROSS JOIN competition_user cu
        WHERE r.competition_id = $2 AND cu.competition_id = $2 AND cu.user_id = $1
        ORDER BY r.round_number ASC
      `, [user_id, comp.id]);
      
      comp.history = historyResult.rows;
    }

    res.json({
      return_code: "SUCCESS",
      competitions: competitions
    });

  } catch (error) {
    console.error('Player dashboard error:', error);
    res.status(500).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;