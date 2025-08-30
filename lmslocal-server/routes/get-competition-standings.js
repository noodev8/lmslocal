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

    // Get current round history for each player - only show picks if round is locked
    for (let player of players) {
      if (isLocked) {
        // Get current round pick for this player
        const currentRoundPick = await query(`
          SELECT p.team, p.outcome, f.home_team, f.away_team, f.home_team_short, f.away_team_short
          FROM pick p
          LEFT JOIN fixture f ON p.fixture_id = f.id
          WHERE p.user_id = $1 AND p.round_id IN (
            SELECT id FROM round WHERE competition_id = $2 AND round_number = $3
          )
        `, [player.id, competition_id, competition.current_round]);

        if (currentRoundPick.rows.length > 0) {
          const pick = currentRoundPick.rows[0];
          player.current_pick = {
            team: pick.team,
            outcome: pick.outcome,
            fixture: pick.home_team && pick.away_team ? `${pick.home_team} vs ${pick.away_team}` : null
          };
        } else {
          // Check for NO_PICK entry
          const noPickCheck = await query(`
            SELECT outcome FROM pick 
            WHERE user_id = $1 AND outcome = 'NO_PICK' AND round_id IN (
              SELECT id FROM round WHERE competition_id = $2 AND round_number = $3
            )
          `, [player.id, competition_id, competition.current_round]);

          if (noPickCheck.rows.length > 0) {
            player.current_pick = {
              team: null,
              outcome: 'NO_PICK',
              fixture: null
            };
          } else {
            player.current_pick = null;
          }
        }
      } else {
        // Round not locked - don't show picks
        player.current_pick = null;
      }

      // Get history for all completed rounds (not current round)
      const historyResult = await query(`
        SELECT 
          r.id as round_id,
          r.round_number,
          r.lock_time,
          p.team as pick_team,
          p.outcome,
          f.home_team,
          f.away_team,
          f.home_team_short,
          f.away_team_short,
          f.result as fixture_result
        FROM round r
        LEFT JOIN pick p ON p.user_id = $1 AND p.round_id = r.id
        LEFT JOIN fixture f ON p.fixture_id = f.id
        WHERE r.competition_id = $2 
          AND r.round_number < $3
          AND r.round_number IS NOT NULL
        ORDER BY r.round_number DESC
      `, [player.id, competition_id, competition.current_round]);

      player.history = historyResult.rows.map(round => ({
        round_id: round.round_id,
        round_number: round.round_number,
        lock_time: round.lock_time,
        pick_team: round.pick_team,
        pick_team_full_name: round.pick_team, // Using team name directly
        visible_pick_team: round.pick_team,
        visible_pick_team_full_name: round.pick_team,
        home_team: round.home_team,
        away_team: round.away_team,
        result: round.fixture_result,
        pick_result: round.outcome === 'WIN' ? 'win' : 
                    round.outcome === 'LOSE' ? 'loss' : 
                    round.outcome === 'NO_PICK' ? 'no_pick' : 'pending'
      }));
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