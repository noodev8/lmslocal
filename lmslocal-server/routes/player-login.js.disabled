/*
=======================================================================================================================================
Player Login Route - Simple username/password authentication
=======================================================================================================================================
*/

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { query } = require('../database');
const router = express.Router();

/*
=======================================================================================================================================
API Route: /player-login
=======================================================================================================================================
Method: POST
Purpose: Simple player login with username/email and password
=======================================================================================================================================
Request Payload:
{
  "email": "player@email.com",
  "password": "password123",
  "slug": "10001"
}

Success Response:
{
  "return_code": "SUCCESS",
  "message": "Login successful",
  "user": {
    "id": 12,
    "display_name": "John Smith",
    "email": "player@email.com"
  },
  "competition": {
    "id": 22,
    "name": "Premier League Survivor",
    "slug": "10001"
  },
  "player_status": {
    "lives_remaining": 2,
    "status": "active",
    "joined_at": "2025-08-25T10:00:00Z"
  },
  "jwt_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
=======================================================================================================================================
*/
router.post('/', async (req, res) => {
  try {
    const { email, password, slug } = req.body;

    // Basic validation
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        return_code: "VALIDATION_ERROR",
        message: "Email is required"
      });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        return_code: "VALIDATION_ERROR",
        message: "Password is required"
      });
    }

    if (!slug || typeof slug !== 'string') {
      return res.status(400).json({
        return_code: "VALIDATION_ERROR",
        message: "Competition slug is required"
      });
    }

    // Find user by email and check password
    const userResult = await query(`
      SELECT id, email, display_name, password_hash
      FROM app_user 
      WHERE email = $1
    `, [email.toLowerCase().trim()]);

    if (userResult.rows.length === 0) {
      return res.status(400).json({
        return_code: "INVALID_CREDENTIALS",
        message: "Invalid email or password"
      });
    }

    const user = userResult.rows[0];

    // Check password using bcrypt
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(400).json({
        return_code: "INVALID_CREDENTIALS",
        message: "Invalid email or password"
      });
    }

    // Get competition by slug
    const competitionResult = await query(`
      SELECT id, name, slug, status
      FROM competition
      WHERE slug = $1
    `, [slug]);

    if (competitionResult.rows.length === 0) {
      return res.status(404).json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition not found"
      });
    }

    const competition = competitionResult.rows[0];

    // Get player status in this competition
    const playerStatusResult = await query(`
      SELECT status, lives_remaining, joined_at
      FROM competition_user
      WHERE competition_id = $1 AND user_id = $2
    `, [competition.id, user.id]);

    if (playerStatusResult.rows.length === 0) {
      return res.status(400).json({
        return_code: "NOT_JOINED",
        message: "You have not joined this competition"
      });
    }

    const playerStatus = playerStatusResult.rows[0];

    // Generate JWT token for session
    const jwtPayload = { 
      user_id: user.id,
      email: user.email,
      display_name: user.display_name
    };
    
    const jwtToken = jwt.sign(
      jwtPayload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Update last active time
    await query(`
      UPDATE app_user 
      SET last_active_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [user.id]);

    // Log successful authentication
    await query(`
      INSERT INTO audit_log (competition_id, user_id, action, details)
      VALUES ($1, $2, 'Player Login', $3)
    `, [
      competition.id,
      user.id,
      `Player "${user.display_name}" logged in to "${competition.name}"`
    ]);

    res.json({
      return_code: "SUCCESS",
      message: "Login successful",
      user: {
        id: user.id,
        display_name: user.display_name,
        email: user.email
      },
      competition: {
        id: competition.id,
        name: competition.name,
        slug: competition.slug,
        status: competition.status
      },
      player_status: {
        lives_remaining: playerStatus.lives_remaining,
        status: playerStatus.status,
        joined_at: playerStatus.joined_at
      },
      jwt_token: jwtToken
    });

  } catch (error) {
    console.error('Player login error:', error);
    res.status(500).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;