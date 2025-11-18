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
const { canManagePlayers } = require('../utils/permissions');
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

    // Ignore email parameter if provided - guests always get generated email
    // No validation needed - just don't use it

    // === AUTHORIZATION AND COMPETITION VALIDATION ===
    // Verify admin is organiser and competition allows new players
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

    // Verify user has permission to manage players (organiser or delegated permission)
    const permission = await canManagePlayers(admin_id, competition_id);
    if (!permission.authorized) {
      return res.json({
        return_code: "UNAUTHORIZED",
        message: "You do not have permission to add players to this competition"
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

    // === ATOMIC TRANSACTION EXECUTION ===
    // Create user, add to competition, initialize teams, deduct credits, and log action atomically
    let newPlayer = null;

    await transaction(async (client) => {
      // Step 0: CREDIT DEDUCTION LOGIC (PAYG System)
      // Count organiser's current total players across ALL competitions
      // Free tier limit from environment variable (defaults to 20 if not set)
      const FREE_PLAYER_LIMIT = parseInt(process.env.FREE_PLAYER_LIMIT) || 20;

      const playerCountQuery = `
        SELECT COUNT(cu.id) as current_player_count
        FROM competition c
        LEFT JOIN competition_user cu ON cu.competition_id = c.id
        WHERE c.organiser_id = $1
      `;

      const countResult = await client.query(playerCountQuery, [admin_id]);
      const currentPlayerCount = parseInt(countResult.rows[0].current_player_count) || 0;

      // If organiser has reached free tier limit, need to deduct 1 credit
      if (currentPlayerCount >= FREE_PLAYER_LIMIT) {
        // Attempt to deduct 1 credit (atomic operation)
        const deductQuery = `
          UPDATE app_user
          SET paid_credit = paid_credit - 1
          WHERE id = $1 AND paid_credit >= 1
          RETURNING paid_credit as new_balance
        `;

        const deductResult = await client.query(deductQuery, [admin_id]);

        // If no rows updated, organiser has insufficient credits - BLOCK player creation
        if (deductResult.rows.length === 0) {
          throw {
            return_code: "ORGANISER_INSUFFICIENT_CREDITS",
            message: "You have reached your player limit. Please purchase more credits to add additional players."
          };
        }

        const newBalance = deductResult.rows[0].new_balance;

        // Log the credit deduction (will log player_id after user creation)
        // This will be inserted after Step 2 below
        var creditDeducted = true;

        console.log(`✓ Credit deducted from organiser ${admin_id}. New balance: ${newBalance}`);
      } else {
        var creditDeducted = false;
        console.log(`✓ Adding offline player within free tier (${currentPlayerCount + 1}/${FREE_PLAYER_LIMIT} players)`);
      }

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
          created_at,             -- Account creation timestamp
          updated_at              -- Last update timestamp
        )
        VALUES ($1, $2, $3, $4, true, NOW(), NOW())
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
          joined_at,              -- Timestamp of joining
          player_display_name     -- Competition-specific display name
        )
        VALUES ($1, $2, 'active', $3, NOW(), $4)
      `, [competition_id, newPlayer.id, competition.lives_per_player, newPlayer.display_name]);

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
    // Log detailed error for debugging
    console.error('Add offline player error:', error);

    // Handle custom business logic errors (thrown from transaction)
    if (error.return_code && error.message) {
      return res.json({
        return_code: error.return_code,
        message: error.message
      });
    }

    // Generic error for unexpected failures
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;