/*
=======================================================================================================================================
Get Competition Players Route - Get all players in a competition (organiser only)
=======================================================================================================================================
Purpose: Retrieve all players (active and eliminated) for competition management
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
API Route: /get-competition-players
=======================================================================================================================================
Method: POST
Purpose: Get all players in a competition (organiser only)
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123                   // number, required
}

Success Response:
{
  "return_code": "SUCCESS",
  "competition": {
    "id": 123,
    "name": "Premier League LMS",
    "player_count": 5,
    "invite_code": "1234"
  },
  "players": [
    {
      "id": 456,
      "display_name": "John Doe", 
      "email": "john@example.com",
      "status": "active",
      "lives_remaining": 2,
      "joined_at": "2025-01-01T10:00:00Z"
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

    // Verify user is the organiser
    const competitionCheck = await query(
      'SELECT id, name, invite_code, organiser_id FROM competition WHERE id = $1',
      [competition_id]
    );

    if (competitionCheck.rows.length === 0) {
      return res.status(404).json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition not found"
      });
    }

    const competition = competitionCheck.rows[0];
    if (competition.organiser_id !== user_id) {
      return res.status(403).json({
        return_code: "UNAUTHORIZED",
        message: "Only the competition organiser can view players"
      });
    }

    // Get all players in the competition including payment info
    const playersResult = await query(`
      SELECT 
        u.id,
        u.display_name,
        u.email,
        cu.status,
        cu.lives_remaining,
        cu.joined_at,
        cu.paid,
        cu.paid_date
      FROM competition_user cu
      INNER JOIN app_user u ON cu.user_id = u.id
      WHERE cu.competition_id = $1
      ORDER BY cu.joined_at ASC
    `, [competition_id]);

    const playerCount = playersResult.rows.length;

    res.json({
      return_code: "SUCCESS",
      competition: {
        id: competition.id,
        name: competition.name,
        player_count: playerCount,
        invite_code: competition.invite_code
      },
      players: playersResult.rows.map(row => ({
        id: row.id,
        display_name: row.display_name,
        email: row.email,
        status: row.status,
        lives_remaining: row.lives_remaining,
        joined_at: row.joined_at,
        paid: row.paid,
        paid_date: row.paid_date
      }))
    });

  } catch (error) {
    console.error('Get competition players error:', error);
    res.status(500).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;