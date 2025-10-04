/*
=======================================================================================================================================
API Route: add-offline-player
=======================================================================================================================================
Method: POST
Purpose: Create player with standard password and add them to competition with full team initialization and email generation
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,                   // integer, required - ID of competition to add player to
  "display_name": "John Smith",           // string, required - Player's display name (2-100 characters)
  "email": "john@example.com"             // string, optional - Player's email address (if not provided, generates {ID}@lms-guest.com)
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Player added successfully", // string, confirmation message
  "player": {                             // object, created player information
    "id": 456,                            // integer, unique user ID for the player
    "display_name": "John Smith",         // string, player's display name
    "email": "456@lms-guest.com",          // string, player's email (generated if not provided)
    "joined_competition": true            // boolean, confirmation player was added to competition
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "User-friendly error message"  // string, descriptive error explanation
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"UNAUTHORIZED"
"COMPETITION_NOT_FOUND"
"COMPETITION_CLOSED"
"PLAYER_LIMIT_EXCEEDED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../database');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  try {
    // Extract request parameters and authenticated user ID
    const { competition_id, display_name, email } = req.body;
    const admin_id = req.user.id;

    // === COMPREHENSIVE INPUT VALIDATION ===
    // Validate all required fields are provided and meet business rules
    
    // Competition ID validation - must be valid integer
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required and must be a number"
      });
    }

    // Display name validation - required field with length constraints
    if (!display_name || typeof display_name !== 'string' || display_name.trim().length === 0) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Display name is required"
      });
    }

    // Display name length validation - prevent database overflow and UI issues
    if (display_name.trim().length < 2) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Display name must be at least 2 characters long"
      });
    }

    if (display_name.trim().length > 100) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Display name must be 100 characters or less"
      });
    }

    // Email should not be provided - guests always get generated email
    if (email) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Email should not be provided for offline players"
      });
    }

    // === AUTHORIZATION AND COMPETITION VALIDATION ===
    // Verify admin is organizer and competition allows new players
    const competitionResult = await query(`
      SELECT 
        c.id,                    -- Competition identifier for validation
        c.name,                  -- Competition name for audit logging
        c.organiser_id,          -- Competition owner for authorization check
        c.team_list_id,          -- Team list for initializing player's allowed teams
        c.invite_code,           -- Join status indicator (null = closed to new players)
        c.lives_per_player       -- Lives setting for new players
      FROM competition c
      WHERE c.id = $1
    `, [competition_id]);

    // Check if competition exists
    if (competitionResult.rows.length === 0) {
      return res.json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition not found"
      });
    }

    const competition = competitionResult.rows[0];

    // Verify requesting user is the competition organizer
    if (competition.organiser_id !== admin_id) {
      return res.json({
        return_code: "UNAUTHORIZED",
        message: "Only the competition organiser can add players"
      });
    }

    // Check if competition is still accepting new players
    // invite_code being null indicates competition is closed to new members
    if (!competition.invite_code) {
      return res.json({
        return_code: "COMPETITION_CLOSED",
        message: "Cannot add new players - competition is no longer accepting new members"
      });
    }

    // === PLAYER LIMIT CHECK ===
    // Check organiser's current player count against their plan limits
    const limitsResult = await query(`
      SELECT
        ua.max_players,
        COUNT(cu.id) as current_players
      FROM user_allowance ua
      LEFT JOIN competition c ON c.organiser_id = ua.user_id
      LEFT JOIN competition_user cu ON cu.competition_id = c.id
      WHERE ua.user_id = $1
      GROUP BY ua.max_players
    `, [admin_id]);

    if (limitsResult.rows.length === 0) {
      return res.json({
        return_code: "SERVER_ERROR",
        message: "User allowance settings not found"
      });
    }

    const limits = limitsResult.rows[0];

    if (limits.current_players >= limits.max_players) {
      return res.json({
        return_code: "PLAYER_LIMIT_EXCEEDED",
        message: "You've reached your plan limit. Please upgrade your plan for more players."
      });
    }

    // === ATOMIC TRANSACTION EXECUTION ===
    // Create user, add to competition, initialize teams, and log action atomically
    let newPlayer = null;

    await transaction(async (client) => {
      // Step 1: Create the user account
      // Admin can set picks for ANY player - no special management fields needed
      // created_by_user_id tracks which admin created this player
      const userResult = await client.query(`
        INSERT INTO app_user (
          display_name,           -- Player's chosen display name
          email,                  -- Email (will be updated if not provided)
          password_hash,          -- Standard password hash for admin-added players
          created_by_user_id,     -- Admin who created this player
          email_verified,         -- Mark as verified for admin-added players
          user_type,              -- Standard player type for competition participation
          created_at,             -- Account creation timestamp
          updated_at              -- Last update timestamp
        )
        VALUES ($1, $2, $3, $4, true, 'player', NOW(), NOW())
        RETURNING id, display_name, email
      `, [display_name.trim(), email || null, '$2b$12$PwWL.rUjgbzUAhPEAAGlUOwVdr9oqHpFyBITEr9NCLR7BKOZSoWn2', admin_id]);

      newPlayer = userResult.rows[0];

      // Step 1.5: Generate unique email if not provided
      if (!email) {
        // Generate unique email using the user ID
        const generatedEmail = `${newPlayer.id}@lms-guest.com`;
        
        // Update the user record with generated email
        const updateResult = await client.query(`
          UPDATE app_user 
          SET email = $1, updated_at = NOW()
          WHERE id = $2
          RETURNING email
        `, [generatedEmail, newPlayer.id]);
        
        // Update the newPlayer object with generated email
        newPlayer.email = updateResult.rows[0].email;
      }

      // Step 2: Add user to competition with active status
      // Set lives_remaining to competition's configured value
      await client.query(`
        INSERT INTO competition_user (
          competition_id,         -- Competition they're joining
          user_id,                -- Newly created user ID
          status,                 -- Active status for participation
          lives_remaining,        -- Competition's configured lives per player
          joined_at               -- Timestamp of joining
        )
        VALUES ($1, $2, 'active', $3, NOW())
      `, [competition_id, newPlayer.id, competition.lives_per_player]);

      // Step 3: Initialize allowed teams for this player
      // All active teams from competition's team list are initially available
      // This prevents the player from having to manually reset teams on first pick
      await client.query(`
        INSERT INTO allowed_teams (competition_id, user_id, team_id, created_at)
        SELECT $1, $2, t.id, NOW()
        FROM team t
        WHERE t.team_list_id = $3 AND t.is_active = true
      `, [competition_id, newPlayer.id, competition.team_list_id]);

      // Step 4: Add comprehensive audit log for admin action tracking
      // Records who added what player to which competition for compliance
      await client.query(`
        INSERT INTO audit_log (competition_id, user_id, action, details, created_at)
        VALUES ($1, $2, 'Player Added', $3, NOW())
      `, [
        competition_id, 
        newPlayer.id, 
        `Player "${display_name.trim()}" added to "${competition.name}" by Admin ${admin_id} (${req.user.display_name || req.user.email}). Email: ${newPlayer.email}`
      ]);
    });

    // === SUCCESS RESPONSE ===
    // Return comprehensive player data for frontend display and state updates
    res.json({
      return_code: "SUCCESS",
      message: "Player added successfully",
      player: {
        id: newPlayer.id,                           // Unique user ID for future operations
        display_name: newPlayer.display_name,       // Confirmed display name
        email: newPlayer.email,                     // Email (generated if not provided)
        joined_competition: true                    // Confirmation of successful competition join
      }
    });

  } catch (error) {
    // === ERROR HANDLING ===
    // Log detailed error for debugging but return generic message to client for security
    console.error('Add offline player error:', error);
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;