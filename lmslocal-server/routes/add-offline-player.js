/*
=======================================================================================================================================
Add Offline Player Route - Create managed player and add to competition
=======================================================================================================================================
Method: POST
Purpose: Allow admin to create an offline/managed player (like "Old Bill") and add them to a competition
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,                   // number, required
  "display_name": "Old Bill",             // string, required
  "email": "bill@pub.com"                 // string, optional
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Offline player added successfully",
  "player": {
    "id": 456,
    "display_name": "Old Bill",
    "email": "bill@pub.com",
    "is_managed": true,
    "joined_competition": true
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "User-friendly error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"UNAUTHORIZED"
"COMPETITION_NOT_FOUND"
"COMPETITION_CLOSED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../database');
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
    
    const userId = decoded.user_id || decoded.userId;
    const result = await db.query('SELECT id, email, display_name, email_verified FROM app_user WHERE id = $1', [userId]);
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

router.post('/', verifyToken, async (req, res) => {
  try {
    const { competition_id, display_name, email } = req.body;
    const admin_id = req.user.id;

    // Basic validation
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required and must be a number"
      });
    }

    if (!display_name || typeof display_name !== 'string' || display_name.trim().length === 0) {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "Display name is required"
      });
    }

    if (display_name.trim().length > 100) {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "Display name must be 100 characters or less"
      });
    }

    // Verify admin is organiser of this competition
    const competitionResult = await db.query(`
      SELECT c.id, c.name, c.organiser_id, c.team_list_id, c.invite_code
      FROM competition c
      WHERE c.id = $1
    `, [competition_id]);

    if (competitionResult.rows.length === 0) {
      return res.status(200).json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition not found"
      });
    }

    const competition = competitionResult.rows[0];

    if (competition.organiser_id !== admin_id) {
      return res.status(200).json({
        return_code: "UNAUTHORIZED",
        message: "Only the competition organiser can add offline players"
      });
    }

    // Check if competition is still accepting new players
    if (!competition.invite_code) {
      return res.status(200).json({
        return_code: "COMPETITION_CLOSED",
        message: "Cannot add new players - competition is no longer accepting new members"
      });
    }

    // Use proper transaction for atomicity
    const client = await db.pool.connect();
    let result;
    
    try {
      await client.query('BEGIN');

      // Create the managed user
      const userResult = await client.query(`
        INSERT INTO app_user (
          display_name, 
          email, 
          is_managed, 
          created_by_user_id,
          email_verified,
          created_at,
          updated_at
        )
        VALUES ($1, $2, true, $3, false, NOW(), NOW())
        RETURNING id, display_name, email, is_managed
      `, [display_name.trim(), email || null, admin_id]);

      const newUser = userResult.rows[0];

      // Add user to competition
      await client.query(`
        INSERT INTO competition_user (
          competition_id,
          user_id,
          status,
          lives_remaining,
          joined_at
        )
        VALUES ($1, $2, 'active', 1, NOW())
      `, [competition_id, newUser.id]);

      // Initialize allowed teams for this player
      await client.query(`
        INSERT INTO allowed_teams (competition_id, user_id, team_id, created_at)
        SELECT $1, $2, t.id, NOW()
        FROM team t
        WHERE t.team_list_id = $3 AND t.is_active = true
      `, [competition_id, newUser.id, competition.team_list_id]);

      // Log the action
      await client.query(`
        INSERT INTO audit_log (competition_id, user_id, action, details)
        VALUES ($1, $2, 'Offline Player Added', $3)
      `, [
        competition_id, 
        newUser.id, 
        `Offline player "${display_name.trim()}" added to "${competition.name}" by Admin ${admin_id}`
      ]);

      await client.query('COMMIT');
      result = newUser;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    res.status(200).json({
      return_code: "SUCCESS",
      message: "Offline player added successfully",
      player: {
        id: result.id,
        display_name: result.display_name,
        email: result.email,
        is_managed: result.is_managed,
        joined_competition: true
      }
    });

  } catch (error) {
    console.error('Add offline player error:', error);
    res.status(200).json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;