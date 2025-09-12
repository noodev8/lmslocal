/*
=======================================================================================================================================
API Route: get-allowed-teams
=======================================================================================================================================
Method: POST
Purpose: Retrieves teams that user is allowed to pick in current round with fixture availability validation and automatic reset
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,                       // integer, required - ID of the competition
  "user_id": 456                               // integer, optional - ID of user to check (admin feature)
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "allowed_teams": [                           // array, teams user can pick that have fixtures
    {
      "team_id": 1,                            // integer, unique team identifier
      "name": "Arsenal",                       // string, full team name for display
      "short_name": "ARS"                      // string, abbreviated team name for compact UI
    }
  ],
  "teams_reset": false,                        // boolean, true if teams were automatically reset
  "reset_message": null                        // string, message about reset action (null if no reset)
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
"COMPETITION_NOT_FOUND"
"USER_NOT_IN_COMPETITION"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();
router.post('/', verifyToken, async (req, res) => {
  logApiCall('get-allowed-teams');
  
  try {
    // Extract request parameters and authenticated user ID
    const { competition_id, user_id: requested_user_id } = req.body;
    const authenticated_user_id = req.user.id;

    // === INPUT VALIDATION ===
    // Validate competition_id is provided and is a valid integer
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required and must be a number"
      });
    }

    // Determine target user: use requested user_id if provided (admin feature), otherwise authenticated user
    const target_user_id = requested_user_id || authenticated_user_id;

    // === SINGLE COMPREHENSIVE QUERY (ELIMINATES N+1 PROBLEM) ===
    // This optimized query replaces what used to be 3 separate queries:
    // 1. Competition organiser check (for admin permissions)
    // 2. Current round lookup
    // 3. Allowed teams with fixture availability
    // Now performs all operations in one efficient query with conditional logic
    const result = await query(`
      SELECT 
        -- === COMPETITION INFO FOR AUTHORIZATION ===
        c.id as competition_id,           -- Competition identifier for validation
        c.organiser_id,                   -- Competition organiser (for admin permission check)
        c.name as competition_name,       -- Competition name for audit purposes
        
        -- === CURRENT ROUND INFO ===
        latest_round.round_id,            -- Current round ID for fixture matching
        latest_round.round_number,        -- Current round number for display
        
        -- === ALLOWED TEAMS WITH FIXTURE AVAILABILITY ===
        at.team_id,                       -- Team database ID
        t.name,                           -- Full team name for display
        t.short_name,                     -- Abbreviated team name for compact UI
        
        -- === FIXTURE AVAILABILITY CHECK ===
        CASE 
          WHEN f.id IS NOT NULL THEN true -- Team has fixture in current round
          ELSE false                       -- Team has no fixture (shouldn't be pickable)
        END as has_fixture
        
      FROM competition c
      
      -- === LATEST ROUND SUBQUERY (PREVENTS N+1) ===
      -- Gets the most recent round for this competition using window function
      LEFT JOIN (
        SELECT r.competition_id,
               r.id as round_id,                                          -- Round database ID
               r.round_number,                                            -- Round number for display
               ROW_NUMBER() OVER (PARTITION BY r.competition_id ORDER BY r.round_number DESC) as rn -- Latest round selector
        FROM round r
      ) latest_round ON c.id = latest_round.competition_id AND latest_round.rn = 1 -- Only latest round
      
      -- === ALLOWED TEAMS JOIN (TARGET USER SPECIFIC) ===
      -- Get teams this specific user is allowed to pick
      LEFT JOIN allowed_teams at ON c.id = at.competition_id AND at.user_id = $2
      
      -- === TEAM DETAILS JOIN ===
      -- Get full team information for display purposes
      LEFT JOIN team t ON at.team_id = t.id AND t.is_active = true
      
      -- === FIXTURE AVAILABILITY JOIN ===
      -- Check if team has a fixture in the current round (required for picking)
      LEFT JOIN fixture f ON latest_round.round_id = f.round_id 
                          AND (f.home_team = t.name OR f.away_team = t.name)
      
      WHERE c.id = $1                     -- Filter to requested competition only
        AND (
          $3 = $2 OR                      -- User requesting own teams
          c.organiser_id = $2             -- OR authenticated user is organiser (admin feature)
        )
        AND at.team_id IS NOT NULL        -- Only include teams user is allowed to pick
        AND t.id IS NOT NULL              -- Only include valid active teams
        AND f.id IS NOT NULL              -- Only include teams with fixtures in current round
      
      ORDER BY t.name ASC                 -- Alphabetical order for consistent UI
    `, [competition_id, authenticated_user_id, target_user_id]);

    // === AUTHORIZATION AND AUTO-RESET VALIDATION ===
    // Check if competition exists and user has permission to access it
    if (result.rows.length === 0) {
      // Determine specific error cause with comprehensive validation query
      const validationResult = await query(`
        SELECT 
          c.id as competition_id,
          c.organiser_id,
          c.team_list_id,
          c.name as competition_name,
          cu.user_id as is_participant,
          latest_round.round_id,
          latest_round.round_number
        FROM competition c
        LEFT JOIN competition_user cu ON c.id = cu.competition_id AND cu.user_id = $2
        LEFT JOIN (
          SELECT r.competition_id,
                 r.id as round_id,
                 r.round_number,
                 ROW_NUMBER() OVER (PARTITION BY r.competition_id ORDER BY r.round_number DESC) as rn
          FROM round r
        ) latest_round ON c.id = latest_round.competition_id AND latest_round.rn = 1
        WHERE c.id = $1
      `, [competition_id, target_user_id]);

      if (validationResult.rows.length === 0) {
        return res.json({
          return_code: "COMPETITION_NOT_FOUND",
          message: "Competition not found"
        });
      }

      const validation = validationResult.rows[0];

      // Competition exists but user lacks permission (admin requesting other user's teams)
      if (requested_user_id && requested_user_id !== authenticated_user_id && 
          validation.organiser_id !== authenticated_user_id) {
        return res.json({
          return_code: "UNAUTHORIZED",
          message: "Only competition organiser can view other players' allowed teams"
        });
      }

      // Check if target user is actually in this competition
      if (!validation.is_participant) {
        return res.json({
          return_code: "USER_NOT_IN_COMPETITION",
          message: "User is not participating in this competition"
        });
      }

      // === AUTO-RESET LOGIC ===
      // User has permission but no allowed teams - trigger automatic reset
      let teamsReset = false;
      let resetMessage = null;

      if (validation.team_list_id && validation.round_id) {
        await transaction(async (client) => {
          // Step 1: Delete current allowed_teams for this user and competition (cleanup)
          await client.query(`
            DELETE FROM allowed_teams 
            WHERE competition_id = $1 AND user_id = $2
          `, [competition_id, target_user_id]);

          // Step 2: Insert all active teams from the competition's team list (full reset)
          await client.query(`
            INSERT INTO allowed_teams (competition_id, user_id, team_id, created_at)
            SELECT $1, $2, t.id, NOW()
            FROM team t
            WHERE t.team_list_id = $3 AND t.is_active = true
            ON CONFLICT (competition_id, user_id, team_id) DO NOTHING
          `, [competition_id, target_user_id, validation.team_list_id]);

          // Step 3: Add audit log for auto-reset event (compliance and debugging)
          await client.query(`
            INSERT INTO audit_log (competition_id, user_id, action, details, created_at)
            VALUES ($1, $2, 'Teams Auto-Reset', $3, NOW())
          `, [
            competition_id, 
            target_user_id, 
            `Player ran out of available teams - automatically reset to all teams in round ${validation.round_number}`
          ]);
        });

        teamsReset = true;
        resetMessage = "You ran out of teams! All teams have been reset and are now available again.";

        // === RE-FETCH ALLOWED TEAMS AFTER RESET ===
        // Run the main query again to get the freshly reset teams with fixture availability
        const resetResult = await query(`
          SELECT 
            -- === ALLOWED TEAMS WITH FIXTURE AVAILABILITY (POST-RESET) ===
            at.team_id,                       -- Team database ID
            t.name,                           -- Full team name for display
            t.short_name,                     -- Abbreviated team name for compact UI
            
            -- === FIXTURE AVAILABILITY CHECK ===
            CASE 
              WHEN f.id IS NOT NULL THEN true -- Team has fixture in current round
              ELSE false                       -- Team has no fixture (shouldn't be pickable)
            END as has_fixture
            
          FROM competition c
          
          -- === LATEST ROUND SUBQUERY (CONSISTENT WITH MAIN QUERY) ===
          LEFT JOIN (
            SELECT r.competition_id,
                   r.id as round_id,
                   r.round_number,
                   ROW_NUMBER() OVER (PARTITION BY r.competition_id ORDER BY r.round_number DESC) as rn
            FROM round r
          ) latest_round ON c.id = latest_round.competition_id AND latest_round.rn = 1
          
          -- === ALLOWED TEAMS JOIN (POST-RESET) ===
          LEFT JOIN allowed_teams at ON c.id = at.competition_id AND at.user_id = $2
          
          -- === TEAM DETAILS JOIN ===
          LEFT JOIN team t ON at.team_id = t.id AND t.is_active = true
          
          -- === FIXTURE AVAILABILITY JOIN ===
          LEFT JOIN fixture f ON latest_round.round_id = f.round_id 
                              AND (f.home_team = t.name OR f.away_team = t.name)
          
          WHERE c.id = $1
            AND at.team_id IS NOT NULL        -- Only include teams user is allowed to pick
            AND t.id IS NOT NULL              -- Only include valid active teams
            AND f.id IS NOT NULL              -- Only include teams with fixtures in current round
          
          ORDER BY t.name ASC                 -- Alphabetical order for consistent UI
        `, [competition_id, target_user_id]);

        // Transform reset results into API response format
        const allowedTeams = resetResult.rows.map(row => ({
          team_id: row.team_id,               // For database operations and pick submission
          name: row.name,                     // Full team name for detailed displays
          short_name: row.short_name          // Abbreviated name for space-constrained UI
        }));

        return res.json({
          return_code: "SUCCESS",
          allowed_teams: allowedTeams,        // Freshly reset teams with fixtures
          teams_reset: teamsReset,            // Indicate reset occurred
          reset_message: resetMessage         // User-friendly reset notification
        });
      }

      // No auto-reset possible (no team list or round) - return empty result
      return res.json({
        return_code: "SUCCESS",
        allowed_teams: [],
        teams_reset: false,
        reset_message: null
      });
    }

    // === SUCCESS RESPONSE (NORMAL FLOW - NO RESET NEEDED) ===
    // Transform database results into clean API response format
    // Only return teams that have fixtures in current round (already filtered in query)
    const allowedTeams = result.rows.map(row => ({
      team_id: row.team_id,               // For database operations and pick submission
      name: row.name,                     // Full team name for detailed displays
      short_name: row.short_name          // Abbreviated name for space-constrained UI
    }));

    res.json({
      return_code: "SUCCESS",
      allowed_teams: allowedTeams,        // Array of pickable teams with current round fixtures
      teams_reset: false,                 // No reset occurred in normal flow
      reset_message: null                 // No reset message needed
    });

  } catch (error) {
    // === ERROR HANDLING ===
    // Log detailed error for debugging but return generic message to client for security
    console.error('Get allowed teams error:', error);
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;