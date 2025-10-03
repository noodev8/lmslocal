/*
=======================================================================================================================================
API Route: delete-competition
=======================================================================================================================================
Method: POST
Purpose: Permanently deletes a competition and all associated data including players, guest users, rounds, fixtures, picks, and progress records
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123                    // integer, required - ID of competition to delete
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Competition deleted successfully",     // string, success confirmation message
  "deletion_summary": {                              // object, summary of deletion operation
    "competition_id": 123,                          // integer, deleted competition ID
    "competition_name": "My Competition",           // string, name of deleted competition
    "players_removed": 15,                          // integer, number of players removed
    "guest_users_deleted": 3,                       // integer, number of guest users deleted (@lms-guest.com)
    "rounds_deleted": 8,                            // integer, number of rounds deleted
    "fixtures_deleted": 24,                         // integer, number of fixtures deleted
    "picks_deleted": 120,                           // integer, number of picks deleted
    "progress_records_deleted": 105,                // integer, number of progress records deleted
    "allowed_teams_deleted": 300,                   // integer, number of allowed team entries deleted
    "deleted_at": "2025-09-08T10:30:00.000Z"       // string, ISO datetime when deletion occurred
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
  // Log API call for monitoring and debugging purposes
  logApiCall('delete-competition');
  
  try {
    // Extract request parameters and authenticated user ID from JWT token
    const { competition_id } = req.body;
    const user_id = req.user.id;

    // === INPUT VALIDATION ===
    // Validate required competition_id parameter - must be present and a valid integer
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required and must be a valid integer"
      });
    }

    // === ATOMIC DELETION TRANSACTION ===
    // Execute the entire deletion operation within a single atomic transaction
    // This ensures data integrity - either everything deletes successfully or nothing changes
    // If any step fails, all changes are rolled back automatically
    const result = await transaction(async (client) => {

      // 1. Get current competition details and verify organiser access with row lock
      // FOR UPDATE ensures no other transaction can modify this competition during deletion
      const competitionResult = await client.query(`
        SELECT id, name, organiser_id, team_list_id, status, created_at
        FROM competition 
        WHERE id = $1
        FOR UPDATE
      `, [competition_id]);

      // Check if competition exists - return error if not found
      if (competitionResult.rows.length === 0) {
        throw new Error('COMPETITION_NOT_FOUND: Competition not found');
      }

      const competition = competitionResult.rows[0];

      // 2. Verify user is the organiser of this competition
      // Only competition organisers can delete competitions for security
      if (competition.organiser_id !== user_id) {
        throw new Error('UNAUTHORIZED: Only the competition organiser can delete this competition');
      }

      // 3. Count all data before deletion for comprehensive reporting
      // This provides detailed feedback to the user about what was deleted

      // Count players in this competition
      const playersCountResult = await client.query(`
        SELECT COUNT(DISTINCT user_id) as player_count
        FROM competition_user 
        WHERE competition_id = $1
      `, [competition_id]);
      const playersCount = parseInt(playersCountResult.rows[0].player_count) || 0;

      // Count rounds in this competition
      const roundsCountResult = await client.query(`
        SELECT COUNT(*) as round_count
        FROM round 
        WHERE competition_id = $1
      `, [competition_id]);
      const roundsCount = parseInt(roundsCountResult.rows[0].round_count) || 0;

      // Count fixtures across all rounds in this competition
      const fixturesCountResult = await client.query(`
        SELECT COUNT(*) as fixture_count
        FROM fixture 
        WHERE round_id IN (
          SELECT id FROM round WHERE competition_id = $1
        )
      `, [competition_id]);
      const fixturesCount = parseInt(fixturesCountResult.rows[0].fixture_count) || 0;

      // Count picks made by players across all rounds
      const picksCountResult = await client.query(`
        SELECT COUNT(*) as pick_count
        FROM pick 
        WHERE round_id IN (
          SELECT id FROM round WHERE competition_id = $1
        )
      `, [competition_id]);
      const picksCount = parseInt(picksCountResult.rows[0].pick_count) || 0;

      // Count player progress records
      const progressCountResult = await client.query(`
        SELECT COUNT(*) as progress_count
        FROM player_progress 
        WHERE competition_id = $1
      `, [competition_id]);
      const progressCount = parseInt(progressCountResult.rows[0].progress_count) || 0;

      // Count allowed team entries
      const allowedTeamsCountResult = await client.query(`
        SELECT COUNT(*) as allowed_teams_count
        FROM allowed_teams 
        WHERE competition_id = $1
      `, [competition_id]);
      const allowedTeamsCount = parseInt(allowedTeamsCountResult.rows[0].allowed_teams_count) || 0;

      // 4. Delete all competition data in proper order to respect foreign key constraints
      // Order is critical: child records must be deleted before parent records

      // Delete picks first (references round_id and user_id)
      const deletedPicksResult = await client.query(`
        DELETE FROM pick 
        WHERE round_id IN (
          SELECT id FROM round WHERE competition_id = $1
        )
        RETURNING id
      `, [competition_id]);

      // Delete player progress records (references competition_id, round_id, and player_id)
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

      // Delete email preferences for this competition
      const deletedEmailPrefsResult = await client.query(`
        DELETE FROM email_preference
        WHERE competition_id = $1
        RETURNING id
      `, [competition_id]);

      // Delete guest users for this competition first
      // Guest users have emails ending with @lms-guest.com and are unique per competition
      const deletedGuestUsersResult = await client.query(`
        DELETE FROM app_user
        WHERE id IN (
          SELECT DISTINCT au.id
          FROM app_user au
          INNER JOIN competition_user cu ON au.id = cu.user_id
          WHERE cu.competition_id = $1
          AND au.email LIKE '%@lms-guest.com'
        )
        RETURNING id, email
      `, [competition_id]);

      const guestUsersCount = deletedGuestUsersResult.rows.length;

      // Delete competition_user records (references competition_id and user_id)
      // This removes all players from the competition
      const deletedCompetitionUsersResult = await client.query(`
        DELETE FROM competition_user
        WHERE competition_id = $1
        RETURNING user_id
      `, [competition_id]);

      // 5. Create comprehensive audit log entry BEFORE deleting the competition
      // This preserves a record of the deletion operation for accountability
      const deletionDetails = [
        `Deleted competition "${competition.name}" (ID: ${competition.id})`,
        `Removed ${playersCount} players from competition`,
        `Deleted ${guestUsersCount} guest users (@lms-guest.com)`,
        `Deleted ${roundsCount} rounds`,
        `Deleted ${fixturesCount} fixtures`,
        `Deleted ${picksCount} picks`,
        `Deleted ${progressCount} player progress records`,
        `Deleted ${allowedTeamsCount} allowed team entries`,
        `Operation performed by user ID: ${user_id}`,
        `Competition was in status: ${competition.status}`
      ].join(', ');

      await client.query(`
        INSERT INTO audit_log (competition_id, user_id, action, details, created_at)
        VALUES ($1, $2, 'Competition Deleted', $3, CURRENT_TIMESTAMP)
      `, [
        competition_id,
        user_id,
        deletionDetails
      ]);

      // 6. Finally delete the competition record itself
      // This must be last since other tables reference competition_id
      const deletedCompetitionResult = await client.query(`
        DELETE FROM competition 
        WHERE id = $1
        RETURNING id, name
      `, [competition_id]);

      // Return comprehensive deletion summary for response
      return {
        competition: {
          id: competition.id,
          name: competition.name
        },
        deletionCounts: {
          players: playersCount,
          guestUsers: guestUsersCount,
          rounds: roundsCount,
          fixtures: fixturesCount,
          picks: picksCount,
          progress: progressCount,
          allowedTeams: allowedTeamsCount,
          competitionUsers: deletedCompetitionUsersResult.rows.length
        },
        deletedAt: new Date().toISOString()
      };
    });

    // === SUCCESS RESPONSE ===
    // Transaction completed successfully - return deletion confirmation with comprehensive summary
    res.json({
      return_code: "SUCCESS",
      message: "Competition deleted successfully",
      deletion_summary: {
        competition_id: result.competition.id,
        competition_name: result.competition.name,
        players_removed: result.deletionCounts.players,
        guest_users_deleted: result.deletionCounts.guestUsers,
        rounds_deleted: result.deletionCounts.rounds,
        fixtures_deleted: result.deletionCounts.fixtures,
        picks_deleted: result.deletionCounts.picks,
        progress_records_deleted: result.deletionCounts.progress,
        allowed_teams_deleted: result.deletionCounts.allowedTeams,
        deleted_at: result.deletedAt
      }
    });

  } catch (error) {
    // === ERROR HANDLING ===
    // Log detailed error for debugging but return appropriate user-facing messages
    // Never expose sensitive system information to the client
    console.error('Delete competition error:', error);
    
    // Handle specific business logic errors with appropriate return codes
    // This allows the frontend to provide targeted user feedback
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
    // Detailed error information is logged server-side for debugging
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error occurred while deleting competition"
    });
  }
});

module.exports = router;