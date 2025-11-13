/*
=======================================================================================================================================
API Route: set-pick
=======================================================================================================================================
Method: POST
Purpose: Creates or updates a player's pick for a round with comprehensive validation and atomic transaction safety
=======================================================================================================================================
Request Payload:
{
  "fixture_id": 24,                            // integer, required - ID of the fixture to pick from
  "team": "home",                              // string, required - "home" or "away" team selection
  "user_id": 12                                // integer, optional - ID of user to set pick for (admin feature)
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Pick saved successfully",        // string, confirmation message
  "pick": {
    "id": 1,                                   // integer, unique pick ID
    "team": "CHE",                             // string, short team name that was picked
    "team_full_name": "Chelsea",               // string, full team name for display
    "fixture_id": 24,                          // integer, fixture ID containing the pick
    "fixture": "Chelsea v Arsenal",            // string, fixture description for display
    "created_at": "2025-08-25T21:00:00Z"       // string, ISO datetime when pick was made
  }
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
"PLAYER_ELIMINATED"  // Player status is not 'active' (eliminated from competition)
"FIXTURE_NOT_FOUND"
"INVALID_TEAM"
"TEAM_NOT_ALLOWED"
"ROUND_LOCKED"
"TEAM_ALREADY_PICKED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const { checkAndLockRoundIfComplete } = require('../utils/roundLocking');
const router = express.Router();
router.post('/', verifyToken, async (req, res) => {
  logApiCall('set-pick');
  
  try {
    // Extract request parameters and authenticated user ID
    const { fixture_id, team, user_id } = req.body;
    const authenticated_user_id = req.user.id;
    const target_user_id = user_id || authenticated_user_id; // Default to own pick if no user_id provided

    // === INPUT VALIDATION ===
    // Validate fixture_id is provided and is a valid integer
    if (!fixture_id || !Number.isInteger(fixture_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Fixture ID is required and must be a number"
      });
    }

    // Validate team selection is either 'home' or 'away'
    if (!team || !['home', 'away'].includes(team)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Team must be 'home' or 'away'"
      });
    }

    // === SINGLE COMPREHENSIVE VALIDATION QUERY (ELIMINATES 8+ QUERIES) ===
    // This massive optimized query replaces what used to be 8-10 separate queries:
    // 1. Fixture existence and details check
    // 2. Team ID lookup from short code  
    // 3. Allowed teams validation
    // 4. Competition membership check
    // 5. Previous pick check (no team twice rule)
    // 6. Existing pick check for changes
    // 7. Old team ID lookup for restoration
    // Now performs all validation in ONE efficient query with comprehensive business logic
    const validationResult = await query(`
      SELECT 
        -- === FIXTURE AND COMPETITION INFO ===
        f.id as fixture_id,                           -- Fixture identifier for validation
        f.home_team,                                  -- Full home team name for display
        f.away_team,                                  -- Full away team name for display  
        f.home_team_short,                            -- Home team short code for pick storage
        f.away_team_short,                            -- Away team short code for pick storage
        f.round_id,                                   -- Round ID for pick insertion
        r.competition_id,                             -- Competition ID for validation
        r.lock_time,                                  -- Round lock time for timing validation
        r.round_number,                               -- Round number for audit logging
        c.organiser_id,                               -- Competition organiser (for admin permission check)
        c.name as competition_name,                   -- Competition name for audit purposes
        c.no_team_twice,                              -- Competition "no team twice" rule setting
        
        -- === TEAM VALIDATION INFO ===
        CASE WHEN $2 = 'home' THEN f.home_team_short ELSE f.away_team_short END as selected_team_short, -- Team user is trying to pick
        CASE WHEN $2 = 'home' THEN f.home_team ELSE f.away_team END as selected_team_full,              -- Full team name for display
        home_team.id as home_team_id,                 -- Home team database ID
        away_team.id as away_team_id,                 -- Away team database ID
        CASE WHEN $2 = 'home' THEN home_team.id ELSE away_team.id END as selected_team_id,              -- Selected team database ID
        
        -- === USER AUTHORIZATION AND STATUS ===
        cu.status as user_status,                     -- User's status in competition ('active', 'OUT', etc.)
        cu.user_id as is_member,                      -- Non-null if user is competition member
        at.team_id as is_team_allowed,                -- Non-null if team is in user's allowed teams
        
        -- === EXISTING PICK INFO (FOR CHANGE HANDLING) ===
        existing_pick.team as existing_pick_team,     -- Current pick team short code (if exists)
        existing_pick.id as existing_pick_id,         -- Current pick ID (if exists) 
        existing_team.id as existing_team_id,         -- Current pick team database ID (for restoration)
        existing_team.name as existing_team_full,     -- Current pick full team name (for display)
        
        -- === PREVIOUS PICK VALIDATION (NO TEAM TWICE RULE) ===
        prev_picks.pick_count,                        -- Count of times this team was picked before (should be 0)
        
        -- === AUTHORIZATION FLAGS ===
        CASE WHEN c.organiser_id = $3 THEN true ELSE false END as is_admin,                      -- User is competition organiser
        CASE WHEN $4 = $3 THEN true ELSE false END as is_own_pick,                               -- User is setting own pick
        CASE WHEN CURRENT_TIMESTAMP >= r.lock_time THEN true ELSE false END as is_round_locked   -- Round is locked for picks
        
      FROM fixture f
      INNER JOIN round r ON f.round_id = r.id
      INNER JOIN competition c ON r.competition_id = c.id
      
      -- === TEAM DETAILS FOR BOTH HOME AND AWAY ===
      -- Get full team information for validation and display
      LEFT JOIN team home_team ON home_team.short_name = f.home_team_short AND home_team.is_active = true
      LEFT JOIN team away_team ON away_team.short_name = f.away_team_short AND away_team.is_active = true
      
      -- === USER COMPETITION MEMBERSHIP ===
      -- Verify user is member of this competition
      LEFT JOIN competition_user cu ON c.id = cu.competition_id AND cu.user_id = $4
      
      -- === ALLOWED TEAMS CHECK ===
      -- Check if selected team is in user's allowed teams (admins can override)
      LEFT JOIN allowed_teams at ON c.id = at.competition_id 
                                 AND at.user_id = $4 
                                 AND at.team_id = CASE WHEN $2 = 'home' THEN home_team.id ELSE away_team.id END
      
      -- === EXISTING PICK CHECK (FOR CHANGES) ===
      -- Get user's current pick for this round if it exists
      LEFT JOIN pick existing_pick ON r.id = existing_pick.round_id AND existing_pick.user_id = $4
      LEFT JOIN team existing_team ON existing_team.short_name = existing_pick.team AND existing_team.is_active = true
      
      -- === PREVIOUS PICKS VALIDATION (NO TEAM TWICE RULE) ===
      -- Count how many times user has picked this team before in this competition
      LEFT JOIN (
        SELECT p.user_id, p.team, COUNT(*) as pick_count
        FROM pick p
        INNER JOIN round prev_r ON p.round_id = prev_r.id
        WHERE prev_r.competition_id = (SELECT competition_id FROM round WHERE id = (SELECT round_id FROM fixture WHERE id = $1))
              AND p.user_id = $4
              AND p.team = CASE WHEN $2 = 'home' 
                               THEN (SELECT home_team_short FROM fixture WHERE id = $1) 
                               ELSE (SELECT away_team_short FROM fixture WHERE id = $1) 
                          END
        GROUP BY p.user_id, p.team
      ) prev_picks ON prev_picks.user_id = $4
      
      WHERE f.id = $1  -- Filter to requested fixture only
    `, [fixture_id, team, authenticated_user_id, target_user_id]);

    // === COMPREHENSIVE VALIDATION CHECKS ===
    // Check if fixture exists and all validation data is available
    if (validationResult.rows.length === 0) {
      return res.json({
        return_code: "FIXTURE_NOT_FOUND",
        message: "Fixture not found"
      });
    }

    const validation = validationResult.rows[0];

    // Extract key validation data for business logic
    const competition_id = validation.competition_id;
    const round_id = validation.round_id;
    const round_number = validation.round_number;
    const selected_team_short = validation.selected_team_short;
    const selected_team_full = validation.selected_team_full;
    const selected_team_id = validation.selected_team_id;
    const is_admin = validation.is_admin;
    const is_own_pick = validation.is_own_pick;

    // Verify selected team exists in database
    if (!selected_team_id) {
      return res.json({
        return_code: "INVALID_TEAM",
        message: "Selected team not found in database"
      });
    }

    // Authorization: Players can only set own picks, admins can set any pick
    if (!is_admin && !is_own_pick) {
      return res.json({
        return_code: "UNAUTHORIZED",
        message: "You can only set your own pick unless you are the competition organiser"
      });
    }

    // Verify target user is member of this competition
    if (!validation.is_member) {
      return res.json({
        return_code: "UNAUTHORIZED",
        message: "Target user is not part of this competition"
      });
    }

    // Check if player is eliminated (only admins can override this)
    if (!is_admin && validation.user_status !== 'active') {
      return res.json({
        return_code: "PLAYER_ELIMINATED",
        message: "You are OUT of this competition and cannot make picks"
      });
    }

    // Check if team is allowed (admin override only applies when setting picks for OTHER users)
    const isAdminOverride = is_admin && !is_own_pick;
    if (!isAdminOverride && !validation.is_team_allowed) {
      return res.json({
        return_code: "TEAM_NOT_ALLOWED",
        message: "You are not allowed to pick this team"
      });
    }

    // Check round lock status (applies to everyone including admins)
    if (validation.is_round_locked) {
      return res.json({
        return_code: "ROUND_LOCKED",
        message: "This round is locked and picks cannot be changed"
      });
    }

    // Check no team twice rule (only if enabled for this competition)
    if (validation.no_team_twice && validation.pick_count > 0) {
      return res.json({
        return_code: "TEAM_ALREADY_PICKED",
        message: "You have already picked this team in a previous round"
      });
    }

    // === ATOMIC TRANSACTION EXECUTION ===
    // Execute all database operations in single transaction to ensure data consistency
    // If any operation fails, all changes are rolled back automatically
    let savedPick = null;
    await transaction(async (client) => {
      // Step 1: Insert or update the pick with complete fixture context
      const pickResult = await client.query(`
        INSERT INTO pick (round_id, user_id, team, fixture_id, competition_id, round_number, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        ON CONFLICT (round_id, user_id)
        DO UPDATE SET team = $3, fixture_id = $4, competition_id = $5, round_number = $6, created_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [round_id, target_user_id, selected_team_short, fixture_id, competition_id, round_number]);

      savedPick = pickResult.rows[0]; // Store pick data outside transaction scope

      // Step 2: Handle allowed_teams changes
      // Use same admin override logic as validation above
      if (!isAdminOverride) {
        // If this was a pick change, restore the old team to allowed_teams (only if no_team_twice is enabled)
        if (validation.existing_team_id && validation.no_team_twice) {
          await client.query(`
            INSERT INTO allowed_teams (competition_id, user_id, team_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (competition_id, user_id, team_id) DO NOTHING
          `, [competition_id, target_user_id, validation.existing_team_id]);
        }

        // Remove the newly picked team from allowed_teams (only if no_team_twice is enabled)
        if (validation.no_team_twice) {
          await client.query(`
            DELETE FROM allowed_teams
            WHERE competition_id = $1 AND user_id = $2 AND team_id = $3
          `, [competition_id, target_user_id, selected_team_id]);
        }
      }

      // Step 3: Add comprehensive audit log for administrative tracking
      const actionType = validation.existing_pick_id ? 'Pick Changed' : 'Pick Made';
      const logDetails = is_admin && !is_own_pick 
        ? `Admin set pick: ${selected_team_short} for User ${target_user_id} in Round ${validation.round_number}${validation.existing_pick_id ? ' (changed from ' + validation.existing_pick_team + ')' : ''}`
        : validation.existing_pick_id 
          ? `Player changed pick from ${validation.existing_pick_team} to ${selected_team_short} for Round ${validation.round_number}`
          : `Player picked ${selected_team_short} for Round ${validation.round_number}`;
        
      await client.query(`
        INSERT INTO audit_log (competition_id, user_id, action, details)
        VALUES ($1, $2, $3, $4)
      `, [competition_id, authenticated_user_id, actionType, logDetails]);

      // Step 4: Check if all picks are in and auto-lock round (round 2+ only)
      const lockResult = await checkAndLockRoundIfComplete(client, round_id);

      // Store lock result to include in response
      savedPick.round_locked = lockResult.locked || false;
    });

    // === SUCCESS RESPONSE ===
    // Return complete pick data with rich context for immediate frontend use
    res.json({
      return_code: "SUCCESS",
      message: "Pick saved successfully",
      round_locked: savedPick.round_locked,           // Boolean: true if this pick triggered auto-lock
      pick: {
        id: savedPick.id,                             // Pick database ID for future operations
        team: selected_team_short,                    // Short team name for API consistency
        team_full_name: selected_team_full,           // Full team name for rich display
        fixture_id: fixture_id,                       // Fixture ID for context
        fixture: `${validation.home_team} v ${validation.away_team}`, // Human-readable fixture description
        created_at: savedPick.created_at              // ISO datetime when pick was created/updated
      }
    });

  } catch (error) {
    // === ERROR HANDLING ===
    // Log detailed error for debugging but return generic message to client for security
    console.error('Set pick error:', error);
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;