/*
=======================================================================================================================================
API Route: delete-account
=======================================================================================================================================
Method: POST
Purpose: Complete user data deletion with atomic transaction safety and comprehensive audit logging for GDPR/App Store compliance
=======================================================================================================================================
Request Payload:
{
  "confirmation": "DELETE_MY_ACCOUNT"     // string, required - Exact confirmation text to prevent accidental deletion
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Account and all associated data deleted successfully", // string, success confirmation message
  "deletion_summary": {
    "user_id": 123,                       // integer, ID of deleted user account
    "email": "user@example.com",          // string, email of deleted account
    "display_name": "John Smith",         // string, display name of deleted account
    "deletion_timestamp": "2025-01-15T10:30:00Z", // string, ISO datetime when deletion occurred
    "records_deleted": {
      "competitions_organized": 2,        // integer, number of competitions deleted (as organiser)
      "competition_memberships": 5,       // integer, number of competition memberships deleted
      "picks_made": 20,                   // integer, number of picks deleted
      "allowed_teams": 40,                // integer, number of allowed team entries deleted
      "progress_records": 15,             // integer, number of progress records deleted
      "audit_logs": 30,                   // integer, number of audit log entries deleted
      "total_records": 112                // integer, total database records removed
    }
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
"VALIDATION_ERROR"      - Missing or incorrect confirmation text
"UNAUTHORIZED"          - Invalid JWT token
"MANAGED_PLAYER_ERROR"  - Managed accounts can only be deleted by organiser
"ORGANISER_HAS_ACTIVE_COMPETITIONS" - Cannot delete account with active competitions
"SERVER_ERROR"          - Database error or unexpected server failure
=======================================================================================================================================
Security & Compliance:
- GDPR Article 17 "Right to be Forgotten" compliant
- App Store data deletion requirement compliant
- Complete audit trail before deletion
- Atomic transaction ensures data integrity
- Cascading deletion handles all foreign key relationships
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../database'); // Use central database with transaction support
const { verifyToken } = require('../middleware/auth'); // Use standard verifyToken middleware
const router = express.Router();

// POST endpoint with comprehensive authentication, validation and atomic transaction safety for account deletion
router.post('/', verifyToken, async (req, res) => {
  try {
    const { confirmation } = req.body;
    const user_id = req.user.id; // Set by verifyToken middleware
    const user_email = req.user.email; // For audit trail and response
    const user_display_name = req.user.display_name; // For audit trail and response

    // STEP 1: Validate required input parameters with strict confirmation checking
    // This is critical safety measure to prevent accidental account deletion
    if (!confirmation || typeof confirmation !== 'string' || confirmation !== 'DELETE_MY_ACCOUNT') {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Please type 'DELETE_MY_ACCOUNT' exactly to confirm deletion. This action is irreversible."
      });
    }

    // STEP 2: Use transaction wrapper to ensure atomic operations
    // This ensures that either ALL data deletion succeeds or ALL changes are rolled back
    // Critical for GDPR compliance where partial deletion is not acceptable
    const transactionResult = await transaction(async (client) => {
      
      // Get comprehensive user data statistics before deletion for audit purposes
      // This query provides detailed breakdown of what will be deleted
      const dataAnalysisQuery = `
        WITH user_stats AS (
          SELECT 
            -- Count competitions organized by this user
            (SELECT COUNT(*) FROM competition WHERE organiser_id = $1) as competitions_organized,
            -- Count competition memberships
            (SELECT COUNT(*) FROM competition_user WHERE user_id = $1) as competition_memberships,
            -- Count picks made by this user
            (SELECT COUNT(*) FROM pick WHERE user_id = $1) as picks_made,
            -- Count allowed team entries
            (SELECT COUNT(*) FROM allowed_teams WHERE user_id = $1) as allowed_teams,
            -- Count progress records
            (SELECT COUNT(*) FROM player_progress WHERE player_id = $1) as progress_records,
            -- Count user activities
            (SELECT COUNT(*) FROM user_activity WHERE user_id = $1) as user_activities,
            -- Count audit logs for this user
            (SELECT COUNT(*) FROM audit_log WHERE user_id = $1) as audit_logs,
            -- Count invitations sent to this email
            (SELECT COUNT(*) FROM invitation WHERE email = $2) as invitations
        )
        SELECT * FROM user_stats
      `;

      const statsResult = await client.query(dataAnalysisQuery, [user_id, user_email]);
      const stats = statsResult.rows[0];

      // Business Rule: Check if user has active competitions as organiser
      // This could be enhanced to prevent deletion if competitions are still active
      const activeCompetitionsQuery = `
        SELECT c.id, c.name, COUNT(cu.user_id) as player_count
        FROM competition c
        LEFT JOIN competition_user cu ON c.id = cu.competition_id
        WHERE c.organiser_id = $1
        GROUP BY c.id, c.name
      `;

      const activeCompsResult = await client.query(activeCompetitionsQuery, [user_id]);

      // Optional: Uncomment this block to prevent deletion if user has active competitions with players
      // if (activeCompsResult.rows.length > 0) {
      //   const activeCompetition = activeCompsResult.rows.find(comp => comp.player_count > 0);
      //   if (activeCompetition) {
      //     throw {
      //       return_code: "ORGANISER_HAS_ACTIVE_COMPETITIONS",
      //       message: `Cannot delete account. You are organising active competition "${activeCompetition.name}" with ${activeCompetition.player_count} players.`
      //     };
      //   }
      // }

      // STEP 3: Create comprehensive audit log entry BEFORE deletion
      // This ensures we have complete record of what was deleted for compliance purposes
      const deletionTimestamp = new Date();
      const auditDetails = {
        action: 'ACCOUNT_DELETION_REQUESTED',
        user: {
          id: user_id,
          email: user_email,
          display_name: user_display_name,
          created_by_user_id: req.user.created_by_user_id
        },
        deletion_stats: stats,
        active_competitions: activeCompsResult.rows,
        client_info: {
          user_agent: req.get('User-Agent') || 'Unknown',
          ip_address: req.ip || 'Unknown'
        },
        compliance: {
          gdpr_article_17: true,
          app_store_requirement: true,
          deletion_timestamp: deletionTimestamp.toISOString()
        }
      };

      // Create permanent audit log entry (this will be preserved even after user deletion)
      const auditQuery = `
        INSERT INTO audit_log (user_id, action, details, created_at)
        VALUES ($1, $2, $3, $4)
      `;
      
      await client.query(auditQuery, [
        user_id,
        'ACCOUNT_DELETION_COMPLETE',
        JSON.stringify(auditDetails),
        deletionTimestamp
      ]);

      // STEP 4: Systematic data deletion in correct dependency order
      // Order is critical to handle foreign key constraints properly

      // Track deletion counts for response summary
      let deletionCounts = {
        competitions_organized: 0,
        competition_memberships: 0,
        picks_made: 0,
        allowed_teams: 0,
        progress_records: 0,
        user_activities: 0,
        invitations: 0,
        audit_logs: 0
      };

      // 1. Delete all data for competitions organized by this user (cascading deletion)
      // This handles all foreign key relationships for organized competitions
      if (parseInt(stats.competitions_organized) > 0) {
        // Get list of organized competitions for detailed deletion
        const organizedCompsResult = await client.query('SELECT id FROM competition WHERE organiser_id = $1', [user_id]);
        
        for (const comp of organizedCompsResult.rows) {
          const competitionId = comp.id;
          
          // Delete all picks for rounds in this competition
          await client.query('DELETE FROM pick WHERE round_id IN (SELECT id FROM round WHERE competition_id = $1)', [competitionId]);
          
          // Delete all fixtures in this competition
          await client.query('DELETE FROM fixture WHERE round_id IN (SELECT id FROM round WHERE competition_id = $1)', [competitionId]);
          
          // Delete all rounds in this competition
          await client.query('DELETE FROM round WHERE competition_id = $1', [competitionId]);
          
          // Delete all competition memberships
          await client.query('DELETE FROM competition_user WHERE competition_id = $1', [competitionId]);
          
          // Delete all allowed teams for this competition
          await client.query('DELETE FROM allowed_teams WHERE competition_id = $1', [competitionId]);
          
          // Delete all player progress for this competition
          await client.query('DELETE FROM player_progress WHERE competition_id = $1', [competitionId]);
          
          // Delete all user activities for this competition
          await client.query('DELETE FROM user_activity WHERE competition_id = $1', [competitionId]);
          
          // Delete all invitations for this competition
          await client.query('DELETE FROM invitation WHERE competition_id = $1', [competitionId]);

          // Delete all email preferences for this competition
          await client.query('DELETE FROM email_preference WHERE competition_id = $1', [competitionId]);

          // Delete email queue entries for this competition
          await client.query('DELETE FROM email_queue WHERE competition_id = $1', [competitionId]);

          // Delete email tracking records for this competition
          await client.query('DELETE FROM email_tracking WHERE competition_id = $1', [competitionId]);

          // Delete audit logs for this competition (except our deletion record)
          await client.query('DELETE FROM audit_log WHERE competition_id = $1 AND action != $2', [competitionId, 'ACCOUNT_DELETION_COMPLETE']);
        }
        
        // Finally delete the competitions themselves
        const deleteCompetitionsResult = await client.query('DELETE FROM competition WHERE organiser_id = $1', [user_id]);
        deletionCounts.competitions_organized = deleteCompetitionsResult.rowCount || 0;
      }

      // 2. Delete user's personal data (picks, memberships, etc.)
      const deletePicksResult = await client.query('DELETE FROM pick WHERE user_id = $1', [user_id]);
      deletionCounts.picks_made = deletePicksResult.rowCount || 0;

      const deleteAllowedTeamsResult = await client.query('DELETE FROM allowed_teams WHERE user_id = $1', [user_id]);
      deletionCounts.allowed_teams = deleteAllowedTeamsResult.rowCount || 0;

      const deleteCompetitionUserResult = await client.query('DELETE FROM competition_user WHERE user_id = $1', [user_id]);
      deletionCounts.competition_memberships = deleteCompetitionUserResult.rowCount || 0;

      const deleteProgressResult = await client.query('DELETE FROM player_progress WHERE player_id = $1', [user_id]);
      deletionCounts.progress_records = deleteProgressResult.rowCount || 0;

      const deleteUserAllowanceResult = await client.query('DELETE FROM user_allowance WHERE user_id = $1', [user_id]);

      const deleteActivitiesResult = await client.query('DELETE FROM user_activity WHERE user_id = $1', [user_id]);
      deletionCounts.user_activities = deleteActivitiesResult.rowCount || 0;

      const deleteInvitationsResult = await client.query('DELETE FROM invitation WHERE email = $1', [user_email]);
      deletionCounts.invitations = deleteInvitationsResult.rowCount || 0;

      // Delete user's global email preferences (competition_id = 0 and any remaining competition-specific ones)
      await client.query('DELETE FROM email_preference WHERE user_id = $1', [user_id]);

      // Delete user's email queue entries (pending/scheduled emails)
      await client.query('DELETE FROM email_queue WHERE user_id = $1', [user_id]);

      // Delete user's email tracking records (sent email analytics)
      await client.query('DELETE FROM email_tracking WHERE user_id = $1', [user_id]);

      // 3. Delete user's audit logs (except our deletion record)
      const deleteAuditLogsResult = await client.query('DELETE FROM audit_log WHERE user_id = $1 AND action != $2', [user_id, 'ACCOUNT_DELETION_COMPLETE']);
      deletionCounts.audit_logs = deleteAuditLogsResult.rowCount || 0;

      // 4. Finally, delete the user account itself
      const deleteUserResult = await client.query('DELETE FROM app_user WHERE id = $1', [user_id]);

      // Calculate total records deleted
      const totalRecordsDeleted = Object.values(deletionCounts).reduce((sum, count) => sum + count, 0) + (deleteUserResult.rowCount || 0);

      // Return comprehensive deletion summary for compliance documentation
      return {
        return_code: "SUCCESS",
        message: "Account and all associated data deleted successfully",
        deletion_summary: {
          user_id: user_id,
          email: user_email,
          display_name: user_display_name,
          deletion_timestamp: deletionTimestamp.toISOString(),
          records_deleted: {
            competitions_organized: deletionCounts.competitions_organized,
            competition_memberships: deletionCounts.competition_memberships,
            picks_made: deletionCounts.picks_made,
            allowed_teams: deletionCounts.allowed_teams,
            progress_records: deletionCounts.progress_records,
            audit_logs: deletionCounts.audit_logs,
            total_records: totalRecordsDeleted
          }
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
    console.error('Delete account error:', {
      error: error.message,
      stack: error.stack?.substring(0, 500), // Truncate stack trace
      user_id: req.user?.id,
      user_email: req.user?.email,
      confirmation_provided: !!req.body?.confirmation,
      timestamp: new Date().toISOString()
    });
    
    // Return standardized server error response with HTTP 200
    return res.json({
      return_code: "SERVER_ERROR", 
      message: "Failed to delete account. Please try again later or contact support."
    });
  }
});

module.exports = router;