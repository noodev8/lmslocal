/*
=======================================================================================================================================
API Route: join-competition-by-code
=======================================================================================================================================
Method: POST
Purpose: Allow authenticated players to join competitions using invite codes with atomic transaction safety and comprehensive validation
=======================================================================================================================================
Request Payload:
{
  "competition_code": "1252"        // string, required - competition invite code
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
const { recordJoinBlock } = require('../services/joinBlock');
const { countOrganiserChargeableMembers } = require('../services/botPool');
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
          -- UPPER() is kept, not folded away: today's codes are all digits so it is a no-op,
          -- but the field is free to hold REDBARN25 later and matching must stay
          -- case-insensitive. idx_competition_invite_code indexes this exact expression.
          WHERE UPPER(c.invite_code) = $1
          GROUP BY c.id, c.name, c.status, c.invite_code, c.lives_per_player
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
          message: "No competition found with that code"
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

      // === CREDIT DEDUCTION LOGIC (PAYG System) ===
      // Count organiser's chargeable players across ALL competitions. Bots are not chargeable
      // anywhere - services/botPool.js owns that definition.
      // Free tier limit from environment variable (defaults to 20 if not set)
      const FREE_PLAYER_LIMIT = parseInt(process.env.FREE_PLAYER_LIMIT) || 20;

      const currentPlayerCount = await countOrganiserChargeableMembers(client, data.organiser_id);

      // If organiser has reached free tier limit, need to deduct 1 credit
      if (currentPlayerCount >= FREE_PLAYER_LIMIT) {
        // Attempt to deduct 1 credit (atomic operation)
        const deductQuery = `
          UPDATE app_user
          SET paid_credit = paid_credit - 1
          WHERE id = $1 AND paid_credit >= 1
          RETURNING paid_credit as new_balance
        `;

        const deductResult = await client.query(deductQuery, [data.organiser_id]);

        // If no rows updated, organiser has insufficient credits - BLOCK join
        if (deductResult.rows.length === 0) {
          throw {
            return_code: "ORGANISER_INSUFFICIENT_CREDITS",
            message: "The competition organiser has reached their player limit. They need to purchase more credits to accept new players.",
            // Carried out of the transaction so the block can be recorded after it rolls back.
            // Recording it here would be undone by this very throw.
            blocked_competition_id: data.competition_id,
            blocked_organiser_id: data.organiser_id
          };
        }

        const newBalance = deductResult.rows[0].new_balance;

        // Log the credit deduction to credit_transactions table
        await client.query(`
          INSERT INTO credit_transactions (
            user_id,
            transaction_type,
            amount,
            competition_id,
            description,
            created_at
          )
          VALUES ($1, 'deduction', -1, $2, $3, CURRENT_TIMESTAMP)
        `, [
          data.organiser_id,
          data.competition_id,
          `Credit deducted for player ${user_id} joining competition. Total players: ${currentPlayerCount + 1}`
        ]);

        console.log(`✓ Credit deducted from organiser ${data.organiser_id}. New balance: ${newBalance}`);
      } else {
        console.log(`✓ Player ${user_id} joining within free tier (${currentPlayerCount + 1}/${FREE_PLAYER_LIMIT} players)`);
      }

      // Join user to competition with atomic operation
      const joinQuery = `
        INSERT INTO competition_user (competition_id, user_id, status, lives_remaining, joined_at, player_display_name)
        SELECT $1, $2, 'active', $3, NOW(), u.display_name
        FROM app_user u
        WHERE u.id = $2
        RETURNING id, status, lives_remaining, joined_at, player_display_name
      `;

      const joinResult = await client.query(joinQuery, [
        data.competition_id,
        user_id,
        data.lives_per_player
      ]);

      const newMembership = joinResult.rows[0];

      // Joining used to insert one allowed_teams row per team here - the whole list, inside this
      // transaction, on the signup path. A new player starts with every team available because
      // they have no picks yet, so there is nothing to write. See docs/allowed-teams.md.

      // === QUEUE PICK REMINDER NOTIFICATION ===
      // If there's an active round, queue a pick_reminder for this new player
      // They know about the round (just joined) but might forget to pick
      // Excludes guest users
      const activeRoundResult = await client.query(`
        SELECT r.id as round_id, r.round_number
        FROM round r
        WHERE r.competition_id = $1
          AND r.lock_time > NOW()
        ORDER BY r.round_number ASC
        LIMIT 1
      `, [data.competition_id]);

      if (activeRoundResult.rows.length > 0) {
        const activeRound = activeRoundResult.rows[0];

        // Check user is not a guest before queueing notification
        const userCheckResult = await client.query(`
          SELECT email FROM app_user WHERE id = $1
        `, [user_id]);

        const userEmail = userCheckResult.rows[0]?.email || '';
        if (!userEmail.includes('@lms-guest.')) {
          // Use INSERT ... SELECT with NOT EXISTS to avoid duplicate notifications
          // Also requires user has a device token registered (no point queueing if they can't receive)
          await client.query(`
            INSERT INTO mobile_notification_queue (user_id, type, competition_id, round_id, round_number, status, created_at)
            SELECT $1, 'pick_reminder', $2, $3, $4, 'pending', NOW()
            WHERE EXISTS (SELECT 1 FROM device_tokens WHERE user_id = $1)
              AND NOT EXISTS (
                SELECT 1 FROM mobile_notification_queue
                WHERE user_id = $1
                  AND type = 'pick_reminder'
                  AND competition_id = $2
                  AND round_id = $3
              )
          `, [user_id, data.competition_id, activeRound.round_id, activeRound.round_number]);
        }
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

    /*
    The welcome email is NOT queued here. Joining used to write an email_queue row inline in a
    setImmediate, a second copy of the eligibility rules that already lived in
    load-welcome-competition.js - and nothing ever drained either, so nine rows sat pending for
    up to six days before being deleted. Who gets welcomed is now derived live in
    services/joinComp.js and sent from the admin Emails screen, like every other comms email.
    */

    // Return transaction result with HTTP 200 status as per API standards
    return res.json(transactionResult);

  } catch (error) {
    // Handle custom business logic errors (thrown from transaction)
    if (error.return_code) {
      // A join blocked by the organiser's credit limit is recorded here, outside the transaction
      // that just rolled back, so the organiser is told on their dashboard. This path is only the
      // race where a competition fills between the lookup and the join - the lookup catches
      // almost all of them.
      if (error.return_code === "ORGANISER_INSUFFICIENT_CREDITS" && error.blocked_competition_id) {
        await recordJoinBlock(error.blocked_competition_id, error.blocked_organiser_id);
      }

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