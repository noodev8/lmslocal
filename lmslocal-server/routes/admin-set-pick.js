/*
=======================================================================================================================================
API Route: admin-set-pick
=======================================================================================================================================
Method: POST
Purpose: Allow competition organiser to set a pick for any player in their competition with optimized database operations and atomic transaction safety
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,               // integer, required - Competition ID where pick is being set
  "user_id": 456,                      // integer, required - Player ID to set pick for
  "team": "Arsenal"                    // string, optional - Full team name to pick (empty/null to remove pick)
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Pick set successfully for player", // string, success confirmation message
  "pick": {
    "id": 789,                         // integer, pick database ID
    "user_id": 456,                    // integer, player ID pick was set for
    "team": "Arsenal",                 // string, full team name picked
    "team_short": "ARS",               // string, team short code stored in database
    "player_name": "Old Bill",         // string, display name of player
    "round_number": 3,                 // integer, round this pick applies to
    "fixture_id": 123,                 // integer, fixture ID for this team (null if no fixture)
    "was_updated": false,              // boolean, true if existing pick was updated, false if new pick created
    "set_by_admin": true               // boolean, indicates this pick was set by admin override
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"  // string, user-friendly error description
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"      - Missing or invalid competition_id, user_id, or team parameters
"COMPETITION_NOT_FOUND" - Competition does not exist in database
"UNAUTHORIZED"          - Invalid JWT token or user is not competition organiser  
"PLAYER_NOT_IN_COMPETITION" - Specified player is not participating in this competition
"PLAYER_ELIMINATED"     - Cannot set pick for eliminated player
"NO_CURRENT_ROUND"      - Competition has no active round to set picks for
"ROUND_LOCKED"          - Cannot set picks after round lock time has passed
"TEAM_NOT_ALLOWED"      - Team is not available for this player (already used or not in competition)
"TEAM_NOT_FOUND"        - Team name does not exist in database
"NO_FIXTURE_FOUND"      - No fixture exists for this team in current round
"SERVER_ERROR"          - Database error or unexpected server failure
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../database'); // Use central database with transaction support
const { verifyToken } = require('../middleware/auth'); // Use standard verifyToken middleware
const router = express.Router();

// POST endpoint with comprehensive authentication, validation and atomic transaction safety
router.post('/', verifyToken, async (req, res) => {
  try {
    const { competition_id, user_id, team } = req.body;
    const admin_id = req.user.id; // Set by verifyToken middleware

    // STEP 1: Validate required input parameters with strict type checking
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required and must be an integer"
      });
    }

    if (!user_id || !Number.isInteger(user_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "User ID is required and must be an integer"
      });
    }

    // Allow null/empty team to indicate "No Pick" (remove pick)
    const isRemovingPick = !team || (typeof team === 'string' && team.trim().length === 0);

    // STEP 2: Use transaction wrapper to ensure atomic operations
    // This ensures that either ALL database operations succeed or ALL are rolled back
    const transactionResult = await transaction(async (client) => {

      // Handle "No Pick" (remove pick) scenario
      if (isRemovingPick) {
        // Get current round and existing pick data
        const removePickQuery = `
          WITH competition_data AS (
            SELECT
              c.id as competition_id,
              c.name as competition_name,
              c.organiser_id,
              r.id as current_round_id,
              r.round_number as current_round_number
            FROM competition c
            LEFT JOIN (
              SELECT
                competition_id,
                id,
                round_number,
                ROW_NUMBER() OVER (PARTITION BY competition_id ORDER BY round_number DESC) as rn
              FROM round
            ) r ON c.id = r.competition_id AND r.rn = 1
            WHERE c.id = $1
          ),
          existing_pick AS (
            SELECT
              p.id as pick_id,
              p.team as team_short,
              t.id as team_id,
              t.name as team_name,
              u.display_name as player_name
            FROM pick p
            INNER JOIN competition_data cd ON p.round_id = cd.current_round_id
            LEFT JOIN team t ON t.short_name = p.team AND t.is_active = true
            LEFT JOIN app_user u ON u.id = p.user_id
            WHERE p.user_id = $2
          )
          SELECT
            cd.*,
            ep.pick_id,
            ep.team_short,
            ep.team_id,
            ep.team_name,
            ep.player_name
          FROM competition_data cd
          LEFT JOIN existing_pick ep ON true
        `;

        const removeResult = await client.query(removePickQuery, [competition_id, user_id]);

        if (removeResult.rows.length === 0) {
          throw {
            return_code: "COMPETITION_NOT_FOUND",
            message: "Competition not found"
          };
        }

        const data = removeResult.rows[0];

        // Verify user authorization
        if (data.organiser_id !== admin_id) {
          throw {
            return_code: "UNAUTHORIZED",
            message: "Only the competition organiser can remove picks for players"
          };
        }

        // Check if there's actually a pick to remove
        if (!data.pick_id) {
          return {
            return_code: "SUCCESS",
            message: "No pick to remove - player has not made a pick for this round",
            pick: {
              user_id: user_id,
              team: null,
              team_short: null,
              player_name: data.player_name || 'Unknown Player',
              round_number: data.current_round_number,
              was_removed: false,
              set_by_admin: true
            }
          };
        }

        // Delete the pick
        await client.query(`
          DELETE FROM pick
          WHERE id = $1
        `, [data.pick_id]);

        // Restore the team to allowed_teams if it was previously picked
        if (data.team_id) {
          await client.query(`
            INSERT INTO allowed_teams (competition_id, user_id, team_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (competition_id, user_id, team_id) DO NOTHING
          `, [competition_id, user_id, data.team_id]);
        }

        // Log the administrative action
        const auditDetails = `Admin ${admin_id} removed pick "${data.team_name}" (${data.team_short}) for player "${data.player_name}" in Round ${data.current_round_number}`;

        await client.query(`
          INSERT INTO audit_log (competition_id, user_id, action, details, created_at)
          VALUES ($1, $2, $3, $4, NOW())
        `, [
          competition_id,
          user_id,
          'ADMIN_REMOVE_PICK',
          auditDetails
        ]);

        return {
          return_code: "SUCCESS",
          message: "Pick removed successfully for player",
          pick: {
            user_id: user_id,
            team: null,
            team_short: null,
            player_name: data.player_name,
            round_number: data.current_round_number,
            was_removed: true,
            set_by_admin: true
          }
        };
      }
      
      // Single comprehensive query to get all required data and perform validations
      // This eliminates N+1 query problems by joining all necessary tables in one database call
      const mainQuery = `
        WITH competition_data AS (
          -- Get competition info and verify organiser authorization
          SELECT
            c.id as competition_id,
            c.name as competition_name,
            c.organiser_id,
            c.no_team_twice,
            -- Get current round info (latest round by round_number)
            r.id as current_round_id,
            r.round_number as current_round_number,
            r.lock_time as current_round_lock_time,
            -- Get current time for lock calculation
            NOW() as current_time
          FROM competition c
          LEFT JOIN (
            SELECT 
              competition_id,
              id,
              round_number,
              lock_time,
              ROW_NUMBER() OVER (PARTITION BY competition_id ORDER BY round_number DESC) as rn
            FROM round
          ) r ON c.id = r.competition_id AND r.rn = 1
          WHERE c.id = $1
        ),
        player_data AS (
          -- Get player participation and status info
          SELECT 
            cu.user_id,
            cu.status as player_status,
            u.display_name as player_name
          FROM competition_user cu
          INNER JOIN app_user u ON cu.user_id = u.id
          WHERE cu.competition_id = $1 AND cu.user_id = $2
        ),
        team_data AS (
          -- Get team info and verify it's allowed for this player
          SELECT 
            t.id as team_id,
            t.name as team_name,
            t.short_name as team_short,
            at.id as allowed_team_id
          FROM team t
          LEFT JOIN allowed_teams at ON t.id = at.team_id 
            AND at.competition_id = $1 
            AND at.user_id = $2
          WHERE t.name = $3
        ),
        fixture_data AS (
          -- Get fixture for this team in current round
          SELECT f.id as fixture_id
          FROM fixture f
          INNER JOIN competition_data cd ON f.round_id = cd.current_round_id
          WHERE (f.home_team = $3 OR f.away_team = $3)
        ),
        existing_pick_data AS (
          -- Check if player already has a pick for current round and get current team info
          SELECT
            p.id as existing_pick_id,
            p.team as existing_team_short,
            t.id as existing_team_id,
            t.name as existing_team_name
          FROM pick p
          INNER JOIN competition_data cd ON p.round_id = cd.current_round_id
          LEFT JOIN team t ON t.short_name = p.team AND t.is_active = true
          WHERE p.user_id = $2
        )
        SELECT
          cd.*,
          pd.player_status,
          pd.player_name,
          td.team_id,
          td.team_name,
          td.team_short,
          td.allowed_team_id,
          fd.fixture_id,
          epd.existing_pick_id,
          epd.existing_team_short,
          epd.existing_team_id,
          epd.existing_team_name
        FROM competition_data cd
        CROSS JOIN player_data pd
        CROSS JOIN team_data td
        LEFT JOIN fixture_data fd ON true
        LEFT JOIN existing_pick_data epd ON true
      `;

      const mainResult = await client.query(mainQuery, [competition_id, user_id, team.trim()]);

      // Check if competition exists
      if (mainResult.rows.length === 0) {
        throw {
          return_code: "COMPETITION_NOT_FOUND",
          message: "Competition not found or player is not participating"
        };
      }

      const data = mainResult.rows[0];

      // Verify user authorization - only competition organiser can set picks for players
      if (data.organiser_id !== admin_id) {
        throw {
          return_code: "UNAUTHORIZED",
          message: "Only the competition organiser can set picks for players"
        };
      }

      // Check if player is participating in this competition
      if (!data.player_name) {
        throw {
          return_code: "PLAYER_NOT_IN_COMPETITION",
          message: "Specified player is not participating in this competition"
        };
      }

      // Check if player is eliminated
      if (data.player_status === 'OUT') {
        throw {
          return_code: "PLAYER_ELIMINATED",
          message: "Cannot set pick for eliminated player"
        };
      }

      // Check if competition has a current round
      if (!data.current_round_id) {
        throw {
          return_code: "NO_CURRENT_ROUND",
          message: "Competition has no active round to set picks for"
        };
      }

      // Business rule: Check if round is locked (picks close at lock time)
      const now = new Date(data.current_time);
      const lockTime = new Date(data.current_round_lock_time);
      const isLocked = data.current_round_lock_time && now >= lockTime;

      if (isLocked) {
        throw {
          return_code: "ROUND_LOCKED",
          message: `Cannot set picks after round lock time. Round locked at ${lockTime.toISOString()}`
        };
      }

      // Check if team exists in the system
      if (!data.team_id) {
        throw {
          return_code: "TEAM_NOT_FOUND",
          message: "Team name does not exist in the system"
        };
      }

      // Check if team is allowed for this player (hasn't been used before)
      if (!data.allowed_team_id) {
        throw {
          return_code: "TEAM_NOT_ALLOWED",
          message: "Team is not available for this player (may have been used in previous round)"
        };
      }

      // Check if fixture exists for this team in current round (optional - some competitions may not have fixtures yet)
      if (!data.fixture_id) {
        console.warn('No fixture found for team in current round:', {
          team: team.trim(),
          round_id: data.current_round_id,
          competition_id,
          timestamp: new Date().toISOString()
        });
      }

      // Determine if we're updating existing pick or creating new one
      const wasUpdated = !!data.existing_pick_id;
      let pickResult;

      // STEP 1: If updating an existing pick, restore the old team to allowed_teams first
      // This ensures the player regains access to their previous team choice
      if (wasUpdated && data.no_team_twice && data.existing_team_id) {
        await client.query(`
          INSERT INTO allowed_teams (competition_id, user_id, team_id)
          VALUES ($1, $2, $3)
          ON CONFLICT (competition_id, user_id, team_id) DO NOTHING
        `, [competition_id, user_id, data.existing_team_id]);
      }

      // STEP 2: Update or create the pick
      if (wasUpdated) {
        // Update existing pick with new team selection
        // Use team short code for consistency with normal pick storage format
        const updateQuery = `
          UPDATE pick
          SET
            team = $1,
            fixture_id = $2,
            set_by_admin = $3,
            created_at = NOW()
          WHERE round_id = $4 AND user_id = $5
          RETURNING id, team, user_id, fixture_id
        `;
        
        pickResult = await client.query(updateQuery, [
          data.team_short, // Store team short code (e.g., "ARS") for consistency
          data.fixture_id, // May be null if no fixture exists yet
          admin_id, // Track which admin set this pick
          data.current_round_id,
          user_id
        ]);
      } else {
        // Create new pick record for this player and round
        const insertQuery = `
          INSERT INTO pick (round_id, user_id, fixture_id, team, set_by_admin, created_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
          RETURNING id, team, user_id, fixture_id
        `;
        
        pickResult = await client.query(insertQuery, [
          data.current_round_id,
          user_id,
          data.fixture_id, // May be null if no fixture exists yet
          data.team_short, // Store team short code (e.g., "ARS") for consistency
          admin_id // Track which admin set this pick
        ]);
      }

      // STEP 3: Remove the newly picked team from allowed_teams (if no_team_twice is enabled)
      // This ensures consistent game rules - admin picks should have same consequences as player picks
      if (data.no_team_twice && data.team_id) {
        await client.query(`
          DELETE FROM allowed_teams
          WHERE competition_id = $1 AND user_id = $2 AND team_id = $3
        `, [competition_id, user_id, data.team_id]);
      }

      // Log the administrative action for audit trail and transparency
      // This provides accountability for admin overrides and pick changes
      const auditQuery = `
        INSERT INTO audit_log (competition_id, user_id, action, details, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `;
      
      const auditDetails = `Admin ${admin_id} ${wasUpdated ? 'updated' : 'set'} pick "${data.team_name}" (${data.team_short}) for player "${data.player_name}" in Round ${data.current_round_number}`;
      
      await client.query(auditQuery, [
        competition_id,
        user_id, // Player the action was performed FOR
        wasUpdated ? 'ADMIN_UPDATE_PICK' : 'ADMIN_SET_PICK',
        auditDetails
      ]);

      // Return comprehensive pick information for frontend display
      return {
        return_code: "SUCCESS",
        message: `Pick ${wasUpdated ? 'updated' : 'set'} successfully for player`,
        pick: {
          id: pickResult.rows[0].id,
          user_id: user_id,
          team: data.team_name, // Return full team name for display
          team_short: data.team_short, // Include short code for reference
          player_name: data.player_name,
          round_number: data.current_round_number,
          fixture_id: data.fixture_id,
          was_updated: wasUpdated,
          set_by_admin: true
        }
      };
    });

    // Return transaction result with HTTP 200 status as per API standards
    return res.json(transactionResult);

  } catch (error) {
    // Handle custom business logic errors (thrown from transaction)
    if (error.return_code) {
      return res.json({
        return_code: error.return_code,
        message: error.message
      });
    }

    // Log detailed error information for debugging while protecting sensitive data
    console.error('Admin set pick error:', {
      error: error.message,
      stack: error.stack?.substring(0, 500), // Truncate stack trace
      competition_id: req.body?.competition_id,
      user_id: req.body?.user_id,
      team: req.body?.team,
      admin_id: req.user?.id,
      timestamp: new Date().toISOString()
    });
    
    // Return standardized server error response with HTTP 200
    return res.json({
      return_code: "SERVER_ERROR", 
      message: "Failed to set player pick"
    });
  }
});

module.exports = router;