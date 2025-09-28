/*
=======================================================================================================================================
API Route: join-competition-by-code
=======================================================================================================================================
Method: POST
Purpose: Allow authenticated players to join competitions using invite codes with atomic transaction safety and comprehensive validation
=======================================================================================================================================
Request Payload:
{
  "competition_code": "ABC123"      // string, required - competition invite code or slug
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Successfully joined competition", // string, success confirmation message
  "competition": {
    "id": 123,                      // integer, competition database ID
    "name": "Premier League LMS"    // string, competition name
  },
  "player_status": {
    "status": "active",             // string, player status in competition
    "lives_remaining": 3,           // integer, number of lives remaining
    "joined_at": "2025-01-15T10:30:00Z" // string, ISO datetime when joined
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
"VALIDATION_ERROR"      - Missing or invalid competition_code parameter
"UNAUTHORIZED"          - Invalid JWT token
"COMPETITION_NOT_FOUND" - Competition does not exist with provided code
"COMPETITION_STARTED"   - Cannot join after round 1 has started
"COMPETITION_FULL"      - Competition has reached maximum player limit
"ALREADY_JOINED"        - User is already a member of this competition
"SERVER_ERROR"          - Database error or unexpected server failure
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../database'); // Use central database with transaction support
const { verifyToken } = require('../middleware/auth'); // Use standard verifyToken middleware
const router = express.Router();

// POST endpoint with comprehensive authentication, validation and atomic transaction safety for competition joining
router.post('/', verifyToken, async (req, res) => {
  try {
    const { competition_code } = req.body;
    const user_id = req.user.id; // Set by verifyToken middleware

    // STEP 1: Validate required input parameters with strict type checking
    if (!competition_code || typeof competition_code !== 'string' || competition_code.trim().length === 0) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Competition code is required and must be a non-empty string"
      });
    }

    const code = competition_code.trim().toUpperCase(); // Normalize code for case-insensitive matching

    // STEP 2: Use transaction wrapper to ensure atomic operations
    // This ensures that either ALL database operations succeed or ALL are rolled back
    // Critical for competition joining where allowed teams population must be consistent with membership
    const transactionResult = await transaction(async (client) => {
      
      // Single comprehensive query to get competition info, round status, and existing membership
      // This eliminates N+1 query problems by combining all validation checks in one database call
      // High Performance: Replaces 3 separate queries with 1 optimized query for better user experience
      const mainQuery = `
        WITH competition_data AS (
          -- Get competition info with current round status
          SELECT
            c.id as competition_id,
            c.name as competition_name,
            c.slug,
            c.status as competition_status,
            c.invite_code,
            c.lives_per_player,
            c.organiser_id,
            -- Get current round information for joining eligibility check
            MAX(r.round_number) as current_round_number,
            MAX(r.lock_time) as latest_lock_time,
            -- Check current server time for lock status validation
            NOW() as current_time
          FROM competition c
          LEFT JOIN round r ON c.id = r.competition_id
          WHERE UPPER(c.invite_code) = $1 OR UPPER(c.slug) = $1
          GROUP BY c.id, c.name, c.slug, c.status, c.invite_code, c.lives_per_player
        ),
        membership_check AS (
          -- Check if user is already a member of this competition
          SELECT 
            cu.id as membership_id,
            cu.status as membership_status,
            cu.lives_remaining,
            cu.joined_at
          FROM competition_user cu
          INNER JOIN competition_data cd ON cu.competition_id = cd.competition_id
          WHERE cu.user_id = $2
        )
        SELECT 
          cd.*,
          mc.membership_id,
          mc.membership_status,
          mc.lives_remaining as current_lives,
          mc.joined_at as member_since
        FROM competition_data cd
        LEFT JOIN membership_check mc ON true
      `;

      const mainResult = await client.query(mainQuery, [code, user_id]);

      // Check if competition exists with the provided code
      if (mainResult.rows.length === 0) {
        throw {
          return_code: "COMPETITION_NOT_FOUND",
          message: "No competition found with that code or slug"
        };
      }

      const data = mainResult.rows[0];

      // Business Logic: Check if joining is still allowed based on competition progress
      // Players can only join before round 1 starts or during round 1 before it locks
      const currentRound = data.current_round_number;
      if (currentRound && currentRound > 1) {
        throw {
          return_code: "COMPETITION_STARTED",
          message: "Cannot join - competition has progressed beyond round 1"
        };
      }

      // Check if Round 1 lock time has passed - prevent joining after lock time
      if (data.latest_lock_time) {
        const lockTime = new Date(data.latest_lock_time);
        const currentTime = new Date();
        
        if (currentTime >= lockTime) {
          throw {
            return_code: "COMPETITION_STARTED",
            message: "Cannot join - Round 1 has locked and competition has started"
          };
        }
      }

      // Check if user is already a member of this competition
      if (data.membership_id) {
        // User is already a member - return success with existing membership info
        return {
          return_code: "SUCCESS",
          message: "You are already a member of this competition",
          competition: {
            id: data.competition_id,
            name: data.competition_name
          },
          player_status: {
            status: data.membership_status,
            lives_remaining: data.current_lives,
            joined_at: data.member_since
          },
          already_member: true // Flag to skip team population
        };
      }

      // Check organiser's player limit before allowing join
      const limitsQuery = `
        SELECT
          ua.max_players,
          COUNT(cu.id) as current_players
        FROM user_allowance ua
        LEFT JOIN competition c ON c.organiser_id = ua.user_id
        LEFT JOIN competition_user cu ON cu.competition_id = c.id
        WHERE ua.user_id = $1
        GROUP BY ua.max_players
      `;

      const limitsResult = await client.query(limitsQuery, [data.organiser_id]);

      if (limitsResult.rows.length === 0) {
        throw {
          return_code: "SERVER_ERROR",
          message: "Competition organiser settings not found"
        };
      }

      const limits = limitsResult.rows[0];

      if (limits.current_players >= limits.max_players) {
        throw {
          return_code: "COMPETITION_FULL",
          message: "This competition is currently full. Please contact the organiser if you'd like to join."
        };
      }

      // Join user to competition with atomic operation
      const joinQuery = `
        INSERT INTO competition_user (competition_id, user_id, status, lives_remaining, joined_at)
        VALUES ($1, $2, 'active', $3, NOW())
        RETURNING id, status, lives_remaining, joined_at
      `;
      
      const joinResult = await client.query(joinQuery, [
        data.competition_id,
        user_id,
        data.lives_per_player
      ]);

      const newMembership = joinResult.rows[0];

      // Populate allowed teams for new member within the same transaction
      // This ensures the player has access to team selection functionality
      // and maintains transaction atomicity
      const allowedTeamsQuery = `
        INSERT INTO allowed_teams (competition_id, user_id, team_id)
        SELECT $1, $2, t.id
        FROM team t
        JOIN competition c ON t.team_list_id = c.team_list_id
        WHERE c.id = $1 AND t.is_active = true
        ON CONFLICT (competition_id, user_id, team_id) DO NOTHING
        RETURNING team_id
      `;

      const allowedTeamsResult = await client.query(allowedTeamsQuery, [data.competition_id, user_id]);

      if (allowedTeamsResult.rows.length > 0) {
      } else {
        console.log(`⚠️ No teams found to populate for user ${user_id} in competition ${data.competition_id} - check if competition has teams`);
      }

      // Return comprehensive success response with both competition and membership details
      return {
        return_code: "SUCCESS",
        message: "Successfully joined competition",
        competition: {
          id: data.competition_id,
          name: data.competition_name
        },
        player_status: {
          status: newMembership.status,
          lives_remaining: newMembership.lives_remaining,
          joined_at: newMembership.joined_at
        },
        already_member: false // Flag indicating new membership
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
    console.error('Join competition by code error:', {
      error: error.message,
      stack: error.stack?.substring(0, 500), // Truncate stack trace
      competition_code: req.body?.competition_code,
      user_id: req.user?.id,
      timestamp: new Date().toISOString()
    });
    
    // Return standardized server error response with HTTP 200
    return res.json({
      return_code: "SERVER_ERROR", 
      message: "Failed to join competition"
    });
  }
});

module.exports = router;