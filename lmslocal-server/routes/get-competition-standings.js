/*
=======================================================================================================================================
Get Competition Standings Route
=======================================================================================================================================
Method: POST
Purpose: Get all players' status and history for a competition (for standings view)
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123
}

Success Response:
{
  "return_code": "SUCCESS",
  "competition": {
    "id": 123,
    "name": "Premier League LMS",
    "current_round": 3,
    "is_locked": true
  },
  "players": [
    {
      "id": 456,
      "display_name": "John Doe",
      "lives_remaining": 2,
      "status": "active",
      "history": [...]
    }
  ]
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
    const userId = decoded.user_id || decoded.userId;
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

router.post('/', verifyToken, async (req, res) => {
  try {
    const { competition_id } = req.body;
    const user_id = req.user.id;

    // Basic validation
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.status(400).json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required and must be a number"
      });
    }

    // Verify user is participating in this competition
    const participantCheck = await query(
      'SELECT id FROM competition_user WHERE competition_id = $1 AND user_id = $2',
      [competition_id, user_id]
    );

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({
        return_code: "UNAUTHORIZED",
        message: "You are not participating in this competition"
      });
    }

    // Get competition details
    const competitionResult = await query(`
      SELECT c.id, c.name, c.invite_code,
             (SELECT MAX(round_number) FROM round WHERE competition_id = c.id) as current_round,
             (SELECT lock_time FROM round WHERE competition_id = c.id ORDER BY round_number DESC LIMIT 1) as current_round_lock_time
      FROM competition c
      WHERE c.id = $1
    `, [competition_id]);

    if (competitionResult.rows.length === 0) {
      return res.status(404).json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition not found"
      });
    }

    const competition = competitionResult.rows[0];
    
    // Check if current round is locked
    const now = new Date();
    const isLocked = competition.current_round_lock_time && now >= new Date(competition.current_round_lock_time);
    competition.is_locked = isLocked;

    // Get all players in this competition with their status
    const playersResult = await query(`
      SELECT u.id, u.display_name, cu.lives_remaining, cu.status
      FROM competition_user cu
      JOIN app_user u ON cu.user_id = u.id
      WHERE cu.competition_id = $1
      ORDER BY 
        CASE WHEN cu.status = 'OUT' THEN 1 ELSE 0 END, -- Active players first
        cu.lives_remaining DESC, -- More lives first
        u.display_name ASC -- Then alphabetically
    `, [competition_id]);

    const players = playersResult.rows;

    // For each player, get their round history
    for (let player of players) {
      const historyResult = await query(`
        SELECT 
          r.id as round_id,
          r.round_number,
          r.lock_time,
          p.team as pick_team,
          t.name as pick_team_full_name,
          f.home_team,
          f.away_team,
          f.result,
          CASE 
            WHEN p.team IS NULL THEN 'no_pick'
            WHEN f.result IS NULL THEN 'pending'
            WHEN (p.team = 'home' AND f.result = 'home_win') OR 
                 (p.team = 'away' AND f.result = 'away_win') THEN 'win'
            WHEN f.result = 'draw' THEN 'draw'
            ELSE 'loss'
          END as pick_result,
          -- Only show current pick if round is locked
          CASE 
            WHEN r.round_number = $2 AND $3 = false THEN NULL
            ELSE p.team
          END as visible_pick_team,
          CASE 
            WHEN r.round_number = $2 AND $3 = false THEN NULL
            ELSE t.name
          END as visible_pick_team_full_name
        FROM round r
        LEFT JOIN pick p ON p.round_id = r.id AND p.user_id = $1
        LEFT JOIN team t ON t.short_name = p.team
        LEFT JOIN fixture f ON f.id = p.fixture_id
        WHERE r.competition_id = $4
        ORDER BY r.round_number ASC
      `, [player.id, competition.current_round, isLocked, competition_id]);
      
      player.history = historyResult.rows;
    }

    res.json({
      return_code: "SUCCESS",
      competition: competition,
      players: players
    });

  } catch (error) {
    console.error('Get competition standings error:', error);
    res.status(500).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;