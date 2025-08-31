/*
=======================================================================================================================================
API Route: join-competition
=======================================================================================================================================
Method: POST
Purpose: Allows a user to join a competition using an invite code with validation and team setup
=======================================================================================================================================
Request Payload:
{
  "invite_code": "1.4567"                      // string, required - format: organiser_id.4digit_pin
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Successfully joined competition",  // string, confirmation message
  "competition": {
    "id": 123,                                 // integer, unique competition ID
    "name": "Premier League LMS 2025",         // string, competition name
    "description": "Annual competition",        // string, competition description
    "status": "UNLOCKED",                      // string, competition status
    "lives_per_player": 1,                     // integer, lives allocated per player
    "no_team_twice": true,                     // boolean, team reuse prevention rule
    "team_list_name": "Premier League"         // string, name of team list used in competition
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"         // string, user-friendly error description
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"COMPETITION_NOT_FOUND"
"ALREADY_JOINED"
"COMPETITION_STARTED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query, populateAllowedTeams, transaction } = require('../database');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  try {
    // Extract request parameters and authenticated user ID
    const { invite_code } = req.body;
    const user_id = req.user.id;

    // === INPUT VALIDATION ===
    // Validate invite code is provided and not empty
    if (!invite_code || !invite_code.trim()) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Invite code is required"
      });
    }

    // === INVITE CODE FORMAT VALIDATION ===
    // Validate invite code follows expected format: organiser_id.4digit_pin (e.g., "123.4567")
    // This format ensures each competition has a unique, trackable invite code
    const codePattern = /^\d+\.\d{4}$/;
    if (!codePattern.test(invite_code.trim())) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Invalid invite code format"
      });
    }

    // === COMPETITION LOOKUP ===
    // Find competition by invite code and get essential details including team list info
    // JOIN with team_list to get the team list name for frontend display
    const competitionResult = await query(`
      SELECT 
        c.id,                    -- Competition ID for subsequent operations
        c.name,                  -- Competition name for display
        c.description,           -- Competition description for display
        c.status,                -- Competition status (LOCKED/UNLOCKED)
        c.lives_per_player,      -- Lives allocated to each player
        c.no_team_twice,         -- Rule: can't pick same team twice
        c.organiser_id,          -- For audit purposes and organiser identification
        tl.name as team_list_name -- Team list name (e.g., "Premier League")
      FROM competition c
      JOIN team_list tl ON c.team_list_id = tl.id
      WHERE c.invite_code = $1   -- Find by the provided invite code
    `, [invite_code.trim()]);

    // Check if competition exists with this invite code
    if (competitionResult.rows.length === 0) {
      return res.json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition not found with this invite code"
      });
    }

    const competition = competitionResult.rows[0];

    // === COMPETITION STATUS VALIDATION ===
    // Check if competition has started by examining fixture kickoff times
    // Once a fixture has kicked off, new players cannot join (fairness rule)
    const competitionStartedCheck = await query(`
      SELECT f.kickoff_time
      FROM round r
      JOIN fixture f ON r.id = f.round_id
      WHERE r.competition_id = $1 
        AND f.kickoff_time < CURRENT_TIMESTAMP  -- Any fixture that has already kicked off
      LIMIT 1                                  -- Only need to find one to confirm start
    `, [competition.id]);

    if (competitionStartedCheck.rows.length > 0) {
      return res.json({
        return_code: "COMPETITION_STARTED",
        message: "Cannot join - competition has already started"
      });
    }

    // === DUPLICATE PARTICIPATION CHECK ===
    // Verify user is not already participating in this competition
    // Check both active and inactive status to prevent re-joining
    const existingParticipation = await query(`
      SELECT id, status FROM competition_user 
      WHERE competition_id = $1 AND user_id = $2
    `, [competition.id, user_id]);

    if (existingParticipation.rows.length > 0) {
      return res.json({
        return_code: "ALREADY_JOINED",
        message: "You are already a member of this competition"
      });
    }

    // === ATOMIC DATABASE OPERATIONS ===
    // Execute all join operations in transaction to ensure data consistency
    await transaction(async (client) => {
      // Step 1: Add user to competition with initial status and lives
      // Set status to 'active' and assign full lives from competition settings
      await client.query(`
        INSERT INTO competition_user (
          competition_id,          -- Link to competition
          user_id,                 -- Link to joining user
          status,                  -- Start as 'active' player
          lives_remaining,         -- Initialize with competition's lives_per_player setting
          joined_at                -- Timestamp for join tracking
        )
        VALUES ($1, $2, 'active', $3, CURRENT_TIMESTAMP)
      `, [
        competition.id,
        user_id,
        competition.lives_per_player
      ]);

      // Step 2: Populate allowed teams for this player
      // This function creates records in competition_team_allowed for team picking
      // Ensures player can only pick from the competition's designated team list
      await populateAllowedTeams(competition.id, user_id);

      // Step 3: Add audit log for administrative tracking
      // Record the join action with invite code used for audit trail
      await client.query(`
        INSERT INTO audit_log (competition_id, user_id, action, details)
        VALUES ($1, $2, 'Player Joined', $3)
      `, [
        competition.id,
        user_id,
        `Joined competition "${competition.name}" using invite code ${invite_code}`
      ]);
    });

    // === SUCCESS RESPONSE ===
    // Return competition details for immediate frontend use
    // Provides essential competition info for player dashboard and navigation
    res.json({
      return_code: "SUCCESS",
      message: "Successfully joined competition",
      competition: {
        id: competition.id,                       // For subsequent API calls
        name: competition.name,                   // For display in UI
        description: competition.description,     // For detailed competition info
        status: competition.status,               // Current competition status
        lives_per_player: competition.lives_per_player, // Lives allocated to player
        no_team_twice: competition.no_team_twice, // Team reuse rule for picks
        team_list_name: competition.team_list_name // Team list used in competition
      }
    });

  } catch (error) {
    // === ERROR HANDLING ===
    // Log detailed error for debugging but return generic message to client for security
    console.error('Join competition error:', error);
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;