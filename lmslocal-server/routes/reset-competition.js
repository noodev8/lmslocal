/*
=======================================================================================================================================
API Route: reset-competition
=======================================================================================================================================
Method: POST
Purpose: Completely resets a competition to its initial state, clearing all game data and generating a new invite code
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123                    // integer, required - ID of competition to reset
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Competition reset successfully",     // string, success confirmation message
  "competition": {                                 // object, updated competition details
    "id": 123,                                    // integer, competition ID
    "name": "My Competition",                     // string, competition name
    "status": "LOCKED",                           // string, reset to LOCKED status
    "invite_code": "7392",                        // string, newly generated invite code
    "reset_at": "2025-09-06T10:30:00.000Z",     // string, ISO datetime when reset occurred
    "players_affected": 15                        // integer, number of players who had their data reset
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"           // string, user-friendly error description
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"COMPETITION_NOT_FOUND"
"UNAUTHORIZED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  // Log API call if enabled
  logApiCall('reset-competition');
  
  try {
    // Extract request parameters and authenticated user ID
    const { competition_id } = req.body;
    const user_id = req.user.id;

    // === INPUT VALIDATION ===
    // Validate required competition_id parameter
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required and must be a valid integer"
      });
    }

    // === ATOMIC RESET TRANSACTION ===
    // Execute the entire reset operation within a single atomic transaction
    // This ensures data integrity - either everything resets successfully or nothing changes
    const result = await transaction(async (client) => {

      // 1. Get current competition details and verify organiser access with row lock
      const competitionResult = await client.query(`
        SELECT id, name, organiser_id, team_list_id, status, created_at
        FROM competition 
        WHERE id = $1
        FOR UPDATE
      `, [competition_id]);

      if (competitionResult.rows.length === 0) {
        throw new Error('COMPETITION_NOT_FOUND: Competition not found');
      }

      const competition = competitionResult.rows[0];

      // 2. Verify user is the organiser of this competition
      if (competition.organiser_id !== user_id) {
        throw new Error('UNAUTHORIZED: Only the competition organiser can reset this competition');
      }

      // 3. Generate unique invite code atomically (prevents race conditions)
      let newInviteCode = '';
      let attempts = 0;
      const maxAttempts = 100;

      while (attempts < maxAttempts) {
        // Generate 4-digit random number
        newInviteCode = Math.floor(1000 + Math.random() * 9000).toString();

        // Check if this code already exists within the same transaction
        const existingCodeResult = await client.query(
          'SELECT id FROM competition WHERE invite_code = $1 AND id != $2',
          [newInviteCode, competition_id]
        );

        if (existingCodeResult.rows.length === 0) {
          break; // Found unique code
        }
        
        attempts++;
      }

      if (attempts >= maxAttempts) {
        throw new Error('SERVER_ERROR: Unable to generate unique invite code after multiple attempts');
      }

      // 4. Count players before deletion for reporting purposes
      const playersCountResult = await client.query(`
        SELECT COUNT(DISTINCT user_id) as player_count
        FROM competition_user 
        WHERE competition_id = $1
      `, [competition_id]);

      const playersAffected = parseInt(playersCountResult.rows[0].player_count) || 0;

      // 5. Delete all competition game data in proper order (respecting foreign key constraints)
      
      // Delete picks (references round_id and user_id)
      const deletedPicksResult = await client.query(`
        DELETE FROM pick 
        WHERE round_id IN (
          SELECT id FROM round WHERE competition_id = $1
        )
        RETURNING id
      `, [competition_id]);

      // Delete player progress records (references competition_id and round_id)
      const deletedProgressResult = await client.query(`
        DELETE FROM player_progress 
        WHERE competition_id = $1
        RETURNING id
      `, [competition_id]);

      // Delete fixtures (references round_id)
      const deletedFixturesResult = await client.query(`
        DELETE FROM fixture 
        WHERE round_id IN (
          SELECT id FROM round WHERE competition_id = $1
        )
        RETURNING id
      `, [competition_id]);

      // Delete rounds (references competition_id)
      const deletedRoundsResult = await client.query(`
        DELETE FROM round 
        WHERE competition_id = $1
        RETURNING id
      `, [competition_id]);

      // Delete allowed teams (references competition_id and user_id)
      const deletedAllowedTeamsResult = await client.query(`
        DELETE FROM allowed_teams 
        WHERE competition_id = $1
        RETURNING id
      `, [competition_id]);

      // 6. Update competition status and generate new invite code
      const updatedCompetitionResult = await client.query(`
        UPDATE competition 
        SET status = 'LOCKED', 
            created_at = CURRENT_TIMESTAMP,
            invite_code = $1
        WHERE id = $2
        RETURNING id, name, status, invite_code, created_at
      `, [newInviteCode, competition_id]);

      const updatedCompetition = updatedCompetitionResult.rows[0];

      // 7. Reset all player states for the fresh competition (payment, status, lives, join date)
      const resetPlayerResult = await client.query(`
        UPDATE competition_user 
        SET paid = false, 
            paid_date = NULL,
            paid_amount = NULL,
            status = 'active',
            lives_remaining = $2,
            joined_at = CURRENT_TIMESTAMP
        WHERE competition_id = $1
        RETURNING user_id
      `, [competition_id, competition.lives_per_player]);

      // 8. Repopulate allowed_teams for all existing players
      // Get all current players in this competition
      const playersResult = await client.query(`
        SELECT user_id 
        FROM competition_user 
        WHERE competition_id = $1
      `, [competition_id]);

      // Repopulate allowed teams for each player using the competition's team list
      if (playersResult.rows.length > 0) {
        await client.query(`
          INSERT INTO allowed_teams (competition_id, user_id, team_id, created_at)
          SELECT $1, cu.user_id, t.id, NOW()
          FROM competition_user cu
          CROSS JOIN team t
          WHERE cu.competition_id = $1 
            AND t.team_list_id = $2 
            AND t.is_active = true
        `, [competition_id, competition.team_list_id]);
      }

      // 9. Create comprehensive audit log entry
      const resetDetails = [
        `Reset competition "${competition.name}"`,
        `Deleted ${deletedRoundsResult.rows.length} rounds`,
        `Deleted ${deletedFixturesResult.rows.length} fixtures`, 
        `Deleted ${deletedPicksResult.rows.length} picks`,
        `Deleted ${deletedProgressResult.rows.length} player progress records`,
        `Deleted ${deletedAllowedTeamsResult.rows.length} allowed team entries`,
        `Reset player states (payment, status, lives, join date) for ${resetPlayerResult.rows.length} players`,
        `Generated new invite code: ${newInviteCode}`,
        `Affected ${playersAffected} players`,
        `Repopulated allowed teams for all players`
      ].join(', ');

      await client.query(`
        INSERT INTO audit_log (competition_id, user_id, action, details, created_at)
        VALUES ($1, $2, 'Competition Reset', $3, CURRENT_TIMESTAMP)
      `, [
        competition_id,
        user_id,
        resetDetails
      ]);

      // Return reset operation results for response
      return {
        competition: updatedCompetition,
        playersAffected: playersAffected,
        deletionCounts: {
          rounds: deletedRoundsResult.rows.length,
          fixtures: deletedFixturesResult.rows.length,
          picks: deletedPicksResult.rows.length,
          progress: deletedProgressResult.rows.length,
          allowedTeams: deletedAllowedTeamsResult.rows.length
        }
      };
    });

    // === SUCCESS RESPONSE ===
    // Transaction completed successfully - return reset confirmation
    res.json({
      return_code: "SUCCESS",
      message: "Competition reset successfully",
      competition: {
        id: result.competition.id,                                    // Competition ID for reference
        name: result.competition.name,                               // Competition name
        status: result.competition.status,                           // Reset status (LOCKED)
        invite_code: result.competition.invite_code,                // New invite code generated
        reset_at: result.competition.created_at,                    // When the reset occurred
        players_affected: result.playersAffected                   // Number of players affected
      }
    });

  } catch (error) {
    // === ERROR HANDLING ===
    // Log detailed error for debugging but return appropriate user-facing messages
    console.error('Reset competition error:', error);
    
    // Handle specific business logic errors with appropriate return codes
    if (error.message.startsWith('VALIDATION_ERROR:')) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: error.message.split(': ')[1]
      });
    }

    if (error.message.startsWith('COMPETITION_NOT_FOUND:')) {
      return res.json({
        return_code: "COMPETITION_NOT_FOUND",
        message: error.message.split(': ')[1]
      });
    }

    if (error.message.startsWith('UNAUTHORIZED:')) {
      return res.json({
        return_code: "UNAUTHORIZED",
        message: error.message.split(': ')[1]
      });
    }

    if (error.message.startsWith('SERVER_ERROR:')) {
      return res.json({
        return_code: "SERVER_ERROR",
        message: error.message.split(': ')[1]
      });
    }

    // Database or unexpected errors - return generic message for security
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;