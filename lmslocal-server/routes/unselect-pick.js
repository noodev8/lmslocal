/*
=======================================================================================================================================
API Route: unselect-pick
=======================================================================================================================================
Method: POST
Purpose: Removes a player's pick for a round with atomic transaction safety and team restoration
=======================================================================================================================================
Request Payload:
{
  "round_id": 5,                               // integer, required - ID of the round to remove pick from
  "user_id": 123                               // integer, optional - ID of user to remove pick for (admin feature)
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Pick removed successfully",      // string, confirmation message
  "removed_pick": {                            // object, details of the removed pick
    "team": "CHE",                             // string, short team name that was removed
    "team_full_name": "Chelsea",               // string, full team name for display
    "fixture": "Chelsea v Arsenal",            // string, fixture description for context
    "removed_at": "2025-08-31T10:00:00Z"       // string, ISO datetime when pick was removed
  },
  "warning": "You only have 1 life remaining - choose wisely!" // string, optional warning based on lives remaining
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"       // string, user-friendly error description
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"UNAUTHORIZED"
"ROUND_NOT_FOUND"
"NO_PICK_FOUND"
"ROUND_LOCKED"
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
    const { round_id, user_id: requested_user_id } = req.body;
    const authenticated_user_id = req.user.id;
    const target_user_id = requested_user_id || authenticated_user_id; // Default to own pick if no user_id provided

    // === INPUT VALIDATION ===
    // Validate round_id is provided and is a valid integer
    if (!round_id || !Number.isInteger(round_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Round ID is required and must be a number"
      });
    }

    // === SINGLE COMPREHENSIVE VALIDATION QUERY (ELIMINATES 5+ QUERIES) ===
    // This optimized query replaces what used to be 5-6 separate queries:
    // 1. Round and competition info check
    // 2. Current pick lookup
    // 3. Team ID lookup from short code
    // 4. User's lives remaining lookup
    // 5. User authorization check
    // Now performs all validation and data gathering in ONE efficient query
    const validationResult = await query(`
      SELECT 
        -- === ROUND AND COMPETITION INFO ===
        r.id as round_id,                             -- Round identifier for validation
        r.competition_id,                             -- Competition ID for operations
        r.lock_time,                                  -- Round lock time for timing validation
        r.round_number,                               -- Round number for audit logging
        c.organiser_id,                               -- Competition organiser (for admin permission check)
        c.name as competition_name,                   -- Competition name for audit purposes
        
        -- === PICK DETAILS (IF EXISTS) ===
        p.id as pick_id,                              -- Pick database ID for deletion
        p.team as pick_team_short,                    -- Short team name of current pick
        p.fixture_id as pick_fixture_id,              -- Fixture ID for context
        
        -- === TEAM AND FIXTURE INFO ===
        t.id as team_id,                              -- Team database ID for allowed_teams restoration
        t.name as team_full_name,                     -- Full team name for display
        f.home_team,                                  -- Home team in fixture (for display)
        f.away_team,                                  -- Away team in fixture (for display)
        
        -- === USER STATUS AND AUTHORIZATION ===
        cu.lives_remaining,                           -- User's remaining lives for warning calculation
        cu.status as user_status,                     -- User's status in competition
        cu.user_id as is_member,                      -- Non-null if user is competition member
        
        -- === AUTHORIZATION FLAGS ===
        CASE WHEN c.organiser_id = $2 THEN true ELSE false END as is_admin,                      -- Authenticated user is organiser
        CASE WHEN $3 = $2 THEN true ELSE false END as is_own_pick,                               -- User is removing own pick
        CASE WHEN CURRENT_TIMESTAMP >= r.lock_time THEN true ELSE false END as is_round_locked   -- Round is locked for picks
        
      FROM round r
      INNER JOIN competition c ON r.competition_id = c.id
      
      -- === CURRENT PICK CHECK ===
      -- Get user's current pick for this round (required to exist for removal)
      LEFT JOIN pick p ON r.id = p.round_id AND p.user_id = $3
      
      -- === TEAM DETAILS ===
      -- Get full team information for the picked team
      LEFT JOIN team t ON t.short_name = p.team AND t.is_active = true
      
      -- === FIXTURE CONTEXT ===
      -- Get fixture details for display context
      LEFT JOIN fixture f ON f.id = p.fixture_id
      
      -- === USER COMPETITION MEMBERSHIP ===
      -- Verify user is member of this competition and get status info
      LEFT JOIN competition_user cu ON c.id = cu.competition_id AND cu.user_id = $3
      
      WHERE r.id = $1  -- Filter to requested round only
    `, [round_id, authenticated_user_id, target_user_id]);

    // === COMPREHENSIVE VALIDATION CHECKS ===
    // Check if round exists and all validation data is available
    if (validationResult.rows.length === 0) {
      return res.json({
        return_code: "ROUND_NOT_FOUND",
        message: "Round not found or access denied"
      });
    }

    const validation = validationResult.rows[0];

    // Extract key validation data for business logic
    const competition_id = validation.competition_id;
    const is_admin = validation.is_admin;
    const is_own_pick = validation.is_own_pick;

    // Authorization: Players can only remove own picks, admins can remove any pick
    if (!is_admin && !is_own_pick) {
      return res.json({
        return_code: "UNAUTHORIZED",
        message: "You can only remove your own pick unless you are the competition organiser"
      });
    }

    // Verify target user is member of this competition
    if (!validation.is_member) {
      return res.json({
        return_code: "UNAUTHORIZED",
        message: "Target user is not part of this competition"
      });
    }

    // Check if user has a pick to remove
    if (!validation.pick_id) {
      return res.json({
        return_code: "NO_PICK_FOUND",
        message: "No pick found for this round"
      });
    }

    // Check round lock status (admins can override)
    if (!is_admin && validation.is_round_locked) {
      return res.json({
        return_code: "ROUND_LOCKED",
        message: "This round is locked and picks cannot be changed"
      });
    }

    // === ATOMIC TRANSACTION EXECUTION ===
    // Execute all database operations in single transaction to ensure data consistency
    // If any operation fails, all changes are rolled back automatically
    await transaction(async (client) => {
      // Step 1: Delete the pick from database
      await client.query(`
        DELETE FROM pick
        WHERE round_id = $1 AND user_id = $2
      `, [round_id, target_user_id]);

      // Step 2: Restore team to allowed_teams (unless admin - they can override rules)
      if (!is_admin && validation.team_id) {
        await client.query(`
          INSERT INTO allowed_teams (competition_id, user_id, team_id)
          VALUES ($1, $2, $3)
          ON CONFLICT (competition_id, user_id, team_id) DO NOTHING
        `, [competition_id, target_user_id, validation.team_id]);
      }

      // Step 3: Add comprehensive audit log for administrative tracking
      const logDetails = is_admin && !is_own_pick 
        ? `Admin removed pick: ${validation.pick_team_short} for User ${target_user_id} in Round ${validation.round_number}`
        : `Player removed pick ${validation.pick_team_short} for Round ${validation.round_number}`;
        
      await client.query(`
        INSERT INTO audit_log (competition_id, user_id, action, details)
        VALUES ($1, $2, 'Pick Removed', $3)
      `, [competition_id, authenticated_user_id, logDetails]);
    });

    // === RESPONSE PREPARATION ===
    // Build response with complete pick context and user-friendly warnings
    const response = {
      return_code: "SUCCESS",
      message: "Pick removed successfully",
      removed_pick: {
        team: validation.pick_team_short,                                           // Short team name for API consistency
        team_full_name: validation.team_full_name,                                 // Full team name for rich display
        fixture: `${validation.home_team} v ${validation.away_team}`,              // Human-readable fixture description
        removed_at: new Date().toISOString()                                       // ISO datetime when pick was removed
      }
    };

    // === LIVES WARNING CALCULATION ===
    // Add contextual warnings based on user's remaining lives to help with strategy
    const livesRemaining = validation.lives_remaining || 0;
    if (livesRemaining <= 0) {
      response.warning = "You have 0 lives remaining - be very careful with your next pick!";
    } else if (livesRemaining === 1) {
      response.warning = "You only have 1 life remaining - choose your next pick wisely!";
    } else if (livesRemaining === 2) {
      response.warning = "You have 2 lives remaining - pick carefully!";
    }

    // === SUCCESS RESPONSE ===
    // Return complete response with pick details and strategic guidance
    res.json(response);

  } catch (error) {
    // === ERROR HANDLING ===
    // Log detailed error for debugging but return generic message to client for security
    console.error('Unselect pick error:', error);
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;