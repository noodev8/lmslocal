/*
=======================================================================================================================================
API Route: remove-player
=======================================================================================================================================
Method: POST
Purpose: Allow competition organiser to completely remove player and all associated data with atomic transaction safety and comprehensive audit logging. Automatically refunds 1 credit if competition is in SETUP mode and organiser is using paid credits.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,              // integer, required - Competition ID to remove player from
  "player_id": 456                    // integer, required - Player ID to remove
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Player removed successfully", // string, success confirmation message (includes credit refund info if applicable)
  "removed_player": {
    "id": 456,                        // integer, removed player ID
    "name": "John Smith",             // string, removed player display name
    "email": "john@example.com"       // string, removed player email
  },
  "removed_data": {
    "picks_deleted": 5,               // integer, number of picks deleted
    "allowed_teams_deleted": 20,      // integer, number of allowed team entries deleted
    "progress_deleted": 3,            // integer, number of progress records deleted
    "total_records_deleted": 29       // integer, total records removed
  },
  "competition": {
    "id": 123,                        // integer, competition ID
    "name": "Premier League LMS",     // string, competition name
    "remaining_players": 15           // integer, number of players remaining
  },
  "credit_refund": {
    "refunded": true,                 // boolean, whether a credit was refunded (SETUP mode only)
    "amount": 1                       // integer, number of credits refunded (0 or 1)
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
"VALIDATION_ERROR"      - Missing or invalid competition_id or player_id parameters
"UNAUTHORIZED"          - Invalid JWT token or user is not competition organiser
"COMPETITION_NOT_FOUND" - Competition does not exist in database
"PLAYER_NOT_FOUND"      - Player is not a member of this competition
"SERVER_ERROR"          - Database error or unexpected server failure
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../database'); // Use central database with transaction support
const { verifyToken } = require('../middleware/auth'); // Use standard verifyToken middleware
const router = express.Router();

// POST endpoint with comprehensive authentication, validation and atomic transaction safety for player removal
router.post('/', verifyToken, async (req, res) => {
  try {
    const { competition_id, player_id } = req.body;
    const admin_id = req.user.id; // Set by verifyToken middleware
    const admin_email = req.user.email; // For audit trail

    // STEP 1: Validate required input parameters with strict type checking
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required and must be an integer"
      });
    }

    if (!player_id || !Number.isInteger(player_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Player ID is required and must be an integer"
      });
    }

    // STEP 2: Use transaction wrapper to ensure atomic operations
    // This ensures that either ALL database operations succeed or ALL are rolled back
    // Critical for player removal where all associated data must be consistently removed
    const transactionResult = await transaction(async (client) => {
      
      // Single comprehensive query to get competition info, verify authorization, and get player data
      // This eliminates N+1 query problems by joining all necessary tables in one database call
      // High Performance: Replaces 3 separate validation queries with 1 optimized query
      const validationQuery = `
        WITH competition_data AS (
          -- Get competition info and verify organiser authorization
          SELECT
            c.id as competition_id,
            c.name as competition_name,
            c.organiser_id,
            c.status as competition_status,
            -- Count remaining players for response context
            COUNT(cu_all.user_id) as total_players
          FROM competition c
          LEFT JOIN competition_user cu_all ON c.id = cu_all.competition_id
          WHERE c.id = $1
          GROUP BY c.id, c.name, c.organiser_id, c.status
        ),
        player_data AS (
          -- Get player info if they exist in this competition
          SELECT 
            cu.user_id,
            u.display_name as player_name,
            u.email as player_email,
            cu.status as player_status,
            cu.lives_remaining,
            cu.joined_at
          FROM competition_user cu
          INNER JOIN app_user u ON cu.user_id = u.id
          WHERE cu.competition_id = $1 AND cu.user_id = $2
        )
        SELECT
          cd.competition_id,
          cd.competition_name,
          cd.organiser_id,
          cd.competition_status,
          cd.total_players,
          pd.user_id as player_user_id,
          pd.player_name,
          pd.player_email,
          pd.player_status,
          pd.lives_remaining,
          pd.joined_at
        FROM competition_data cd
        LEFT JOIN player_data pd ON true
      `;

      const validationResult = await client.query(validationQuery, [competition_id, player_id]);

      // Check if competition exists
      if (validationResult.rows.length === 0) {
        throw {
          return_code: "COMPETITION_NOT_FOUND",
          message: "Competition not found or does not exist"
        };
      }

      const data = validationResult.rows[0];

      // Verify user authorization - only competition organiser can remove players
      if (data.organiser_id !== admin_id) {
        throw {
          return_code: "UNAUTHORIZED",
          message: "Only the competition organiser can remove players"
        };
      }

      // Check if player exists in this competition
      if (!data.player_user_id) {
        throw {
          return_code: "PLAYER_NOT_FOUND",
          message: "Player not found in this competition"
        };
      }

      // STEP 2.5: Credit refund logic for SETUP competitions (PAYG System)
      // Only refund credits if competition is still in SETUP mode
      let creditRefunded = false;
      let refundedAmount = 0;

      if (data.competition_status === 'SETUP') {
        // Count organiser's current total players across ALL competitions
        const FREE_PLAYER_LIMIT = parseInt(process.env.FREE_PLAYER_LIMIT) || 20;

        const playerCountQuery = `
          SELECT COUNT(cu.id) as current_player_count
          FROM competition c
          LEFT JOIN competition_user cu ON cu.competition_id = c.id
          WHERE c.organiser_id = $1
        `;

        const countResult = await client.query(playerCountQuery, [admin_id]);
        const currentPlayerCount = parseInt(countResult.rows[0].current_player_count) || 0;

        // If organiser currently has more players than free limit, refund 1 credit
        // This is because removing a player reduces their paid player count
        if (currentPlayerCount > FREE_PLAYER_LIMIT) {
          // Refund 1 credit (atomic operation)
          const refundQuery = `
            UPDATE app_user
            SET paid_credit = paid_credit + 1
            WHERE id = $1
            RETURNING paid_credit as new_balance
          `;

          const refundResult = await client.query(refundQuery, [admin_id]);
          const newBalance = refundResult.rows[0].new_balance;

          // Log the credit refund to credit_transactions table
          await client.query(`
            INSERT INTO credit_transactions (user_id, competition_id, transaction_type, amount, description, created_at)
            VALUES ($1, $2, 'REFUND', 1, $3, NOW())
          `, [
            admin_id,
            competition_id,
            `Credit refunded for player ${player_id} removal from SETUP competition. Total players: ${currentPlayerCount - 1}`
          ]);

          creditRefunded = true;
          refundedAmount = 1;

          console.log(`✓ Credit refunded to organiser ${admin_id}. New balance: ${newBalance}`);
        } else {
          console.log(`✓ Player removal within free tier (${currentPlayerCount - 1}/${FREE_PLAYER_LIMIT} players) - no refund needed`);
        }
      }

      // STEP 3: Atomic removal of all player-related data with detailed tracking
      // Order is important: remove dependent records first, then parent records
      
      // 1. Delete all picks for this player in this competition (cascade through all rounds)
      const picksDeleteQuery = `
        DELETE FROM pick 
        WHERE user_id = $1 AND round_id IN (
          SELECT id FROM round WHERE competition_id = $2
        )
      `;
      const picksResult = await client.query(picksDeleteQuery, [player_id, competition_id]);

      // 2. Delete allowed teams for this player in this competition
      const allowedTeamsDeleteQuery = `
        DELETE FROM allowed_teams 
        WHERE user_id = $1 AND competition_id = $2
      `;
      const allowedTeamsResult = await client.query(allowedTeamsDeleteQuery, [player_id, competition_id]);

      // 3. Delete player progress records for this competition
      const progressDeleteQuery = `
        DELETE FROM player_progress 
        WHERE player_id = $1 AND competition_id = $2
      `;
      const progressResult = await client.query(progressDeleteQuery, [player_id, competition_id]);

      // 4. Finally, remove the player from competition membership
      const membershipDeleteQuery = `
        DELETE FROM competition_user 
        WHERE user_id = $1 AND competition_id = $2
      `;
      const membershipResult = await client.query(membershipDeleteQuery, [player_id, competition_id]);

      // Calculate total records removed for audit purposes
      const totalRecordsDeleted = 
        (picksResult.rowCount || 0) + 
        (allowedTeamsResult.rowCount || 0) + 
        (progressResult.rowCount || 0) + 
        (membershipResult.rowCount || 0);

      // STEP 4: Create comprehensive audit log entry within the same transaction
      // This ensures audit trail is consistent with the actual data changes
      const auditDetails = {
        action: 'PLAYER_REMOVED',
        removed_player: {
          id: data.player_user_id,
          name: data.player_name,
          email: data.player_email,
          status: data.player_status,
          joined_at: data.joined_at
        },
        competition: {
          id: data.competition_id,
          name: data.competition_name
        },
        records_deleted: {
          picks: picksResult.rowCount || 0,
          allowed_teams: allowedTeamsResult.rowCount || 0,
          progress: progressResult.rowCount || 0,
          membership: membershipResult.rowCount || 0,
          total: totalRecordsDeleted
        },
        admin_id: admin_id,
        admin_email: admin_email
      };

      const auditQuery = `
        INSERT INTO audit_log (competition_id, user_id, action, details, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `;
      
      await client.query(auditQuery, [
        competition_id,
        player_id,
        'PLAYER_REMOVED',
        JSON.stringify(auditDetails)
      ]);

      // Return comprehensive removal information for frontend display
      const successMessage = creditRefunded
        ? `Player "${data.player_name}" removed successfully. 1 credit has been refunded to your account.`
        : `Player "${data.player_name}" removed successfully`;

      return {
        return_code: "SUCCESS",
        message: successMessage,
        removed_player: {
          id: data.player_user_id,
          name: data.player_name,
          email: data.player_email
        },
        removed_data: {
          picks_deleted: picksResult.rowCount || 0,
          allowed_teams_deleted: allowedTeamsResult.rowCount || 0,
          progress_deleted: progressResult.rowCount || 0,
          total_records_deleted: totalRecordsDeleted
        },
        competition: {
          id: data.competition_id,
          name: data.competition_name,
          remaining_players: Math.max(0, (data.total_players || 1) - 1) // Subtract the removed player
        },
        credit_refund: {
          refunded: creditRefunded,
          amount: refundedAmount
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
    console.error('Remove player error:', {
      error: error.message,
      stack: error.stack?.substring(0, 500), // Truncate stack trace
      competition_id: req.body?.competition_id,
      player_id: req.body?.player_id,
      admin_id: req.user?.id,
      timestamp: new Date().toISOString()
    });
    
    // Return standardized server error response with HTTP 200
    return res.json({
      return_code: "SERVER_ERROR", 
      message: "Failed to remove player"
    });
  }
});

module.exports = router;