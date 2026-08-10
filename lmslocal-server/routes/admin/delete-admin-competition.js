/*
=======================================================================================================================================
API Route: delete-admin-competition
=======================================================================================================================================
Method: POST
Purpose: Permanently deletes any competition and all its associated data (players, guest
         users, rounds, fixtures, picks, progress) from the lmslocal-admin tool. Unlike
         /delete-competition, this is not restricted to the organiser - any live admin may
         delete any competition, which is why it lives under /admin/* with its own auth and
         its own copy of the deletion logic rather than reusing the organiser route.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123                    // integer, required - ID of competition to delete
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Competition deleted successfully",
  "deletion_summary": {
    "competition_id": 123,                          // integer, deleted competition ID
    "competition_name": "My Competition",           // string, name of deleted competition
    "players_removed": 15,                          // integer, number of players removed
    "guest_users_deleted": 3,                       // integer, number of guest users deleted (bots preserved)
    "rounds_deleted": 8,                            // integer, number of rounds deleted
    "fixtures_deleted": 24,                         // integer, number of fixtures deleted
    "picks_deleted": 120,                           // integer, number of picks deleted
    "progress_records_deleted": 105,                // integer, number of progress records deleted
    "deleted_at": "2026-08-02T10:30:00.000Z"       // string, ISO datetime when deletion occurred
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"COMPETITION_NOT_FOUND"
"UNAUTHORIZED"              - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"             - Admin session has expired
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { transaction } = require('../../database');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const { logApiCall } = require('../../utils/apiLogger');
const router = express.Router();

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('delete-admin-competition');

  try {
    const { competition_id } = req.body;

    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'Competition ID is required and must be a valid integer'
      });
    }

    const result = await transaction(async (client) => {

      // Row lock so nothing else can touch this competition mid-deletion
      const competitionResult = await client.query(`
        SELECT id, name, status, created_at
        FROM competition
        WHERE id = $1
        FOR UPDATE
      `, [competition_id]);

      if (competitionResult.rows.length === 0) {
        throw new Error('COMPETITION_NOT_FOUND: Competition not found');
      }

      const competition = competitionResult.rows[0];

      // Count everything before deletion for the response summary
      const playersCountResult = await client.query(`
        SELECT COUNT(DISTINCT user_id) as player_count
        FROM competition_user
        WHERE competition_id = $1
      `, [competition_id]);
      const playersCount = parseInt(playersCountResult.rows[0].player_count) || 0;

      const roundsCountResult = await client.query(`
        SELECT COUNT(*) as round_count
        FROM round
        WHERE competition_id = $1
      `, [competition_id]);
      const roundsCount = parseInt(roundsCountResult.rows[0].round_count) || 0;

      const fixturesCountResult = await client.query(`
        SELECT COUNT(*) as fixture_count
        FROM fixture
        WHERE round_id IN (
          SELECT id FROM round WHERE competition_id = $1
        )
      `, [competition_id]);
      const fixturesCount = parseInt(fixturesCountResult.rows[0].fixture_count) || 0;

      const picksCountResult = await client.query(`
        SELECT COUNT(*) as pick_count
        FROM pick
        WHERE round_id IN (
          SELECT id FROM round WHERE competition_id = $1
        )
      `, [competition_id]);
      const picksCount = parseInt(picksCountResult.rows[0].pick_count) || 0;

      const progressCountResult = await client.query(`
        SELECT COUNT(*) as progress_count
        FROM player_progress
        WHERE competition_id = $1
      `, [competition_id]);
      const progressCount = parseInt(progressCountResult.rows[0].progress_count) || 0;


      // Delete child records before parents, respecting foreign key order
      await client.query(`
        DELETE FROM pick
        WHERE round_id IN (
          SELECT id FROM round WHERE competition_id = $1
        )
      `, [competition_id]);

      await client.query(`
        DELETE FROM player_progress
        WHERE competition_id = $1
      `, [competition_id]);

      await client.query(`
        DELETE FROM fixture
        WHERE round_id IN (
          SELECT id FROM round WHERE competition_id = $1
        )
      `, [competition_id]);

      await client.query(`
        DELETE FROM round
        WHERE competition_id = $1
      `, [competition_id]);


      await client.query(`
        DELETE FROM email_preference
        WHERE competition_id = $1
      `, [competition_id]);

      // Delete guest users but preserve bots (bot_*@lms-guest.com)
      const deletedGuestUsersResult = await client.query(`
        DELETE FROM app_user
        WHERE id IN (
          SELECT DISTINCT au.id
          FROM app_user au
          INNER JOIN competition_user cu ON au.id = cu.user_id
          WHERE cu.competition_id = $1
          AND au.email LIKE '%@lms-guest.com'
          AND au.email NOT LIKE 'bot_%'
        )
        RETURNING id
      `, [competition_id]);
      const guestUsersCount = deletedGuestUsersResult.rows.length;

      await client.query(`
        DELETE FROM competition_user
        WHERE competition_id = $1
      `, [competition_id]);

      // Audit log before the competition row itself disappears
      const deletionDetails = [
        `Deleted competition "${competition.name}" (ID: ${competition.id})`,
        `Removed ${playersCount} players`,
        `Deleted ${guestUsersCount} guest users (bots preserved)`,
        `Deleted ${roundsCount} rounds`,
        `Deleted ${fixturesCount} fixtures`,
        `Deleted ${picksCount} picks`,
        `Deleted ${progressCount} player progress records`,
        `Operation performed by admin ID: ${req.admin.id}`,
        `Competition was in status: ${competition.status}`
      ].join(', ');

      await client.query(`
        INSERT INTO audit_log (competition_id, user_id, action, details, created_at)
        VALUES ($1, $2, 'Competition Deleted (Admin)', $3, CURRENT_TIMESTAMP)
      `, [competition_id, req.admin.id, deletionDetails]);

      await client.query(`
        DELETE FROM competition
        WHERE id = $1
      `, [competition_id]);

      return {
        competition,
        deletionCounts: {
          players: playersCount,
          guestUsers: guestUsersCount,
          rounds: roundsCount,
          fixtures: fixturesCount,
          picks: picksCount,
          progress: progressCount,
        }
      };
    });

    return res.json({
      return_code: 'SUCCESS',
      message: 'Competition deleted successfully',
      deletion_summary: {
        competition_id: result.competition.id,
        competition_name: result.competition.name,
        players_removed: result.deletionCounts.players,
        guest_users_deleted: result.deletionCounts.guestUsers,
        rounds_deleted: result.deletionCounts.rounds,
        fixtures_deleted: result.deletionCounts.fixtures,
        picks_deleted: result.deletionCounts.picks,
        progress_records_deleted: result.deletionCounts.progress,
        deleted_at: new Date().toISOString()
      }
    });

  } catch (error) {
    if (error.message.startsWith('COMPETITION_NOT_FOUND:')) {
      return res.json({
        return_code: 'COMPETITION_NOT_FOUND',
        message: error.message.split(': ')[1]
      });
    }

    console.error('delete-admin-competition error:', error.message);
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not delete competition'
    });
  }
});

module.exports = router;
