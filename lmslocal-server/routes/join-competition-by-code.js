/*
=======================================================================================================================================
Join Competition by Code Route - Simple join for existing authenticated users
=======================================================================================================================================
Purpose: Allow authenticated players to join competitions using invite codes
=======================================================================================================================================
*/

const express = require('express');
const jwt = require('jsonwebtoken');
const { query, populateAllowedTeams } = require('../database');
const router = express.Router();

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(200).json({
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
      return res.status(200).json({
        return_code: "UNAUTHORIZED",
        message: "Invalid token"
      });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    return res.status(200).json({
      return_code: "UNAUTHORIZED",
      message: "Invalid token"
    });
  }
};

/*
=======================================================================================================================================
API Route: /join-competition-by-code
=======================================================================================================================================
Method: POST
Purpose: Join competition using invite code for already authenticated users
=======================================================================================================================================
Request Payload:
{
  "competition_code": "ABC123"      // string, required - competition invite code or slug
}

Success Response:
{
  "return_code": "SUCCESS",
  "message": "Successfully joined competition",
  "competition": {
    "id": 123,
    "name": "Premier League LMS 2025"
  }
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"UNAUTHORIZED"
"COMPETITION_NOT_FOUND"
"INVALID_ACCESS_CODE"
"COMPETITION_STARTED"
"ALREADY_JOINED"
"SERVER_ERROR"
=======================================================================================================================================
*/
router.post('/', verifyToken, async (req, res) => {
  try {
    const { competition_code } = req.body;
    const user_id = req.user.id;

    // Validation
    if (!competition_code || typeof competition_code !== 'string' || competition_code.trim().length === 0) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Competition code is required"
      });
    }

    const code = competition_code.trim().toUpperCase();

    // Get competition by access code with round info
    const competitionResult = await query(`
      SELECT c.id, c.name, c.slug, c.status, c.invite_code, c.lives_per_player,
             MAX(r.round_number) as current_round,
             MAX(r.lock_time) as latest_lock_time
      FROM competition c
      LEFT JOIN round r ON c.id = r.competition_id
      WHERE UPPER(c.invite_code) = $1 OR UPPER(c.slug) = $1
      GROUP BY c.id, c.name, c.slug, c.status, c.invite_code, c.lives_per_player
    `, [code]);

    if (competitionResult.rows.length === 0) {
      return res.json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition not found with that code"
      });
    }

    const competition = competitionResult.rows[0];

    // Check if joining is still allowed
    const currentRound = competition.current_round;
    const latestLockTime = competition.latest_lock_time;
    
    // Allow joining if:
    // 1. No rounds exist yet, OR
    // 2. We're still in round 1 and it hasn't locked yet
    if (currentRound && currentRound > 1) {
      return res.json({
        return_code: "COMPETITION_STARTED",
        message: "Cannot join - competition has already started"
      });
    }

    // Check if user already joined this competition
    const existingMemberResult = await query(`
      SELECT id, status, lives_remaining FROM competition_user
      WHERE competition_id = $1 AND user_id = $2
    `, [competition.id, user_id]);

    if (existingMemberResult.rows.length > 0) {
      return res.json({
        return_code: "SUCCESS",
        message: "You're already in this competition",
        competition: {
          id: competition.id,
          name: competition.name
        }
      });
    }

    // Join user to competition
    const joinResult = await query(`
      INSERT INTO competition_user (competition_id, user_id, status, lives_remaining, joined_at)
      VALUES ($1, $2, 'active', $3, CURRENT_TIMESTAMP)
      RETURNING status, lives_remaining, joined_at
    `, [competition.id, user_id, competition.lives_per_player]);

    // Populate allowed teams for this player
    await populateAllowedTeams(competition.id, user_id);

    res.json({
      return_code: "SUCCESS",
      message: "Successfully joined competition",
      competition: {
        id: competition.id,
        name: competition.name
      }
    });

  } catch (error) {
    console.error('Join competition by code error:', error);
    res.status(200).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;