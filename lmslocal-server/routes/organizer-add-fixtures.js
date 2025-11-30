/*
=======================================================================================================================================
API Route: organizer-add-fixtures
=======================================================================================================================================
Method: POST
Purpose: Allows competition organizers to add fixtures for a new round. Only works for manual competitions
         (fixture_service = false). Fixtures must be added in one transaction per round.
         Requires previous round to be fully processed before adding new round.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,                      // integer, required - Competition ID
  "kickoff_time": "2025-10-25T15:00:00Z",     // string, required - ISO datetime for all fixtures
  "fixtures": [                               // array, required - List of fixtures to add
    {
      "home_team_short": "ARS",               // string, required - Home team short code
      "away_team_short": "CHE"                // string, required - Away team short code
    }
  ]
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "round_id": 5,                              // integer, ID of round where fixtures were added
  "round_number": 5,                          // integer, Round number
  "fixtures_added": 10,                       // integer, Count of fixtures added
  "message": "10 fixtures added to Round 5"   // string, Confirmation message
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "UNAUTHORIZED",
  "message": "Only the competition organiser can manage fixtures"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"           - Required fields are missing
"UNAUTHORIZED"             - User is not the organiser of this competition
"COMPETITION_NOT_FOUND"    - Competition doesn't exist
"AUTOMATED_COMPETITION"    - Competition uses fixture_service (automated mode)
"COMPETITION_COMPLETE"     - Competition has already ended
"PREVIOUS_ROUND_INCOMPLETE" - Current round has unprocessed fixtures
"ROUND_HAS_FIXTURES"       - Current round already has fixtures (must add all in one transaction)
"SERVER_ERROR"             - Database or unexpected error
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../database');
const { verifyToken } = require('../middleware/auth');
const { logApiCall } = require('../utils/apiLogger');
const { canManageFixtures } = require('../utils/permissions'); // Permission helper
const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
  logApiCall('organizer-add-fixtures');

  try {
    const { competition_id, kickoff_time, fixtures } = req.body;
    const user_id = req.user.id;

    // ========================================
    // STEP 1: VALIDATE REQUEST PAYLOAD
    // ========================================

    // Validate competition_id
    if (!competition_id || !Number.isInteger(parseInt(competition_id))) {
      return res.status(200).json({
        return_code: "MISSING_FIELDS",
        message: "competition_id is required and must be an integer"
      });
    }

    // Validate kickoff_time
    if (!kickoff_time || typeof kickoff_time !== 'string') {
      return res.status(200).json({
        return_code: "MISSING_FIELDS",
        message: "kickoff_time is required and must be a valid ISO datetime string"
      });
    }

    // Validate fixtures array
    if (!fixtures || !Array.isArray(fixtures) || fixtures.length === 0) {
      return res.status(200).json({
        return_code: "MISSING_FIELDS",
        message: "fixtures array is required and must contain at least one fixture"
      });
    }

    // Validate each fixture has required fields
    for (let i = 0; i < fixtures.length; i++) {
      const fixture = fixtures[i];
      if (!fixture.home_team_short || !fixture.away_team_short) {
        return res.status(200).json({
          return_code: "MISSING_FIELDS",
          message: `Fixture ${i + 1}: Both home_team_short and away_team_short are required`
        });
      }
    }

    const competitionIdInt = parseInt(competition_id);

    // ========================================
    // CONVERT UK TIME TO UTC
    // ========================================
    // Organizers enter times in UK local time (GMT/BST), but database stores UTC
    // Parse the input time and convert from UK timezone to UTC

    // Extract date/time components from input (e.g., "2025-10-25T15:00:00")
    const match = kickoff_time.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) {
      return res.status(200).json({
        return_code: "MISSING_FIELDS",
        message: "kickoff_time must be in format YYYY-MM-DDTHH:MM"
      });
    }

    const inputYear = parseInt(match[1]);
    const inputMonth = parseInt(match[2]);
    const inputDay = parseInt(match[3]);
    const inputHour = parseInt(match[4]);
    const inputMinute = parseInt(match[5]);

    // Start with UTC date using the input components
    let utcGuess = new Date(Date.UTC(inputYear, inputMonth - 1, inputDay, inputHour, inputMinute));

    // Check what this UTC time would be in UK timezone
    const ukFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const ukParts = ukFormatter.formatToParts(utcGuess);
    const ukHour = parseInt(ukParts.find(p => p.type === 'hour').value);
    const ukMinute = parseInt(ukParts.find(p => p.type === 'minute').value);

    // Calculate the offset (how much UK time differs from our input)
    const targetMinutes = inputHour * 60 + inputMinute;
    const actualMinutes = ukHour * 60 + ukMinute;
    const offsetMinutes = actualMinutes - targetMinutes;

    // Adjust to get the correct UTC time
    const kickoff_time_utc = new Date(utcGuess.getTime() - (offsetMinutes * 60 * 1000)).toISOString();

    // ========================================
    // STEP 2: VERIFY COMPETITION AND AUTHORIZATION
    // ========================================

    // Get competition details and verify user is organiser
    const competitionResult = await query(`
      SELECT
        id,
        name,
        organiser_id,
        status,
        fixture_service,
        team_list_id
      FROM competition
      WHERE id = $1
    `, [competitionIdInt]);

    // Check if competition exists
    if (competitionResult.rows.length === 0) {
      return res.status(200).json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "Competition not found"
      });
    }

    const competition = competitionResult.rows[0];

    // Verify user is the organiser or has delegated manage_fixtures permission
    const permission = await canManageFixtures(user_id, competitionIdInt);
    if (!permission.authorized) {
      return res.status(200).json({
        return_code: "UNAUTHORIZED",
        message: "You do not have permission to manage fixtures for this competition"
      });
    }

    // Check if competition uses automated fixture service
    if (competition.fixture_service === true) {
      return res.status(200).json({
        return_code: "AUTOMATED_COMPETITION",
        message: "This competition uses automated fixture service. Contact admin to manage fixtures."
      });
    }

    // Check if competition is already complete
    if (competition.status === 'COMPLETE') {
      return res.status(200).json({
        return_code: "COMPETITION_COMPLETE",
        message: "Cannot add fixtures - competition has ended"
      });
    }

    // ========================================
    // STEP 3: GET TEAM NAMES
    // ========================================

    // Extract all unique team short names from fixtures
    const allShortNames = [...new Set(fixtures.flatMap(f => [f.home_team_short, f.away_team_short]))];

    // Get full team names from database
    const teamLookupResult = await query(`
      SELECT name, short_name
      FROM team
      WHERE short_name = ANY($1) AND is_active = true
    `, [allShortNames]);

    // Create lookup map: short_name -> full_name
    const teamMap = {};
    teamLookupResult.rows.forEach(team => {
      teamMap[team.short_name] = team.name;
    });

    // ========================================
    // STEP 4: EXECUTE DATABASE TRANSACTION
    // ========================================

    const result = await transaction(async (client) => {
      // ========================================
      // CHECK PREVIOUS ROUND COMPLETION
      // ========================================

      // Get the latest round
      const roundResult = await client.query(`
        SELECT id, round_number, lock_time
        FROM round
        WHERE competition_id = $1
        ORDER BY round_number DESC
        LIMIT 1
      `, [competitionIdInt]);

      // Double-check competition status (already checked outside transaction, but verify again for safety)
      if (competition.status === 'COMPLETE') {
        throw {
          return_code: 'COMPETITION_COMPLETE',
          message: 'Cannot add fixtures - competition has ended'
        };
      }

      // If rounds exist, check if the latest round is fully processed
      if (roundResult.rows.length > 0) {
        const latestRound = roundResult.rows[0];

        // Check if latest round has any unprocessed fixtures
        const unprocessedCheck = await client.query(`
          SELECT COUNT(*) as unprocessed_count
          FROM fixture
          WHERE round_id = $1
          AND (processed IS NULL OR result IS NULL)
        `, [latestRound.id]);

        const unprocessedCount = parseInt(unprocessedCheck.rows[0].unprocessed_count);

        if (unprocessedCount > 0) {
          throw {
            return_code: 'PREVIOUS_ROUND_INCOMPLETE',
            message: `Cannot add new fixtures. Round ${latestRound.round_number} has ${unprocessedCount} unprocessed fixture(s). Complete current round first.`
          };
        }

        // Latest round is complete - we'll create a NEW round below
        // (No need to check if it has fixtures - it should! They're all processed)
      }

      // ========================================
      // CREATE NEW ROUND
      // ========================================

      let roundId;
      let roundNumber;

      if (roundResult.rows.length === 0) {
        // No rounds exist - create Round 1
        roundNumber = 1;
      } else {
        // Previous round is complete - create next round
        roundNumber = roundResult.rows[0].round_number + 1;
      }

      // Create new round
      const newRoundResult = await client.query(`
        INSERT INTO round (
          competition_id,
          round_number,
          lock_time,
          created_at
        )
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        RETURNING id, round_number
      `, [competitionIdInt, roundNumber, kickoff_time_utc]);

      roundId = newRoundResult.rows[0].id;
      roundNumber = newRoundResult.rows[0].round_number;

      // Insert new fixtures
      for (const fixture of fixtures) {
        const homeTeamFull = teamMap[fixture.home_team_short] || fixture.home_team_short;
        const awayTeamFull = teamMap[fixture.away_team_short] || fixture.away_team_short;

        await client.query(`
          INSERT INTO fixture (
            round_id,
            competition_id,
            round_number,
            home_team,
            away_team,
            home_team_short,
            away_team_short,
            kickoff_time,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
        `, [
          roundId,
          competitionIdInt,
          roundNumber,
          homeTeamFull,
          awayTeamFull,
          fixture.home_team_short,
          fixture.away_team_short,
          kickoff_time_utc
        ]);
      }

      // === QUEUE MOBILE NOTIFICATIONS ===
      // Queue 'new_round' and 'pick_reminder' notifications for all active players
      // new_round: sends immediately on next cron run - message is "Results are in - see how you did!"
      //   - Round 1: excludes the creator (they just set up the competition)
      //   - Round 2+: includes everyone (organizer may have delegated fixture creation)
      // pick_reminder: sends when within 24hrs of lock_time (includes everyone)
      // Excludes guest users (email starts with 'lms-guest')

      // NEW_ROUND: Only insert if user has no pending new_round notification (any competition)
      // This avoids spamming users in multiple competitions with separate notifications
      // Also requires user has a device token registered (no point queueing if they can't receive)
      await client.query(`
        INSERT INTO mobile_notification_queue (user_id, type, competition_id, round_id, round_number, status, created_at)
        SELECT cu.user_id, 'new_round', $1, $2, $3, 'pending', NOW()
        FROM competition_user cu
        JOIN app_user au ON au.id = cu.user_id
        WHERE cu.competition_id = $1
          AND cu.status = 'active'
          AND cu.hidden IS NOT TRUE
          AND au.email NOT LIKE '%@lms-guest.%'
          AND ($3 > 1 OR cu.user_id != $4)
          AND EXISTS (SELECT 1 FROM device_tokens dt WHERE dt.user_id = cu.user_id)
          AND NOT EXISTS (
            SELECT 1 FROM mobile_notification_queue mnq
            WHERE mnq.user_id = cu.user_id
              AND mnq.type = 'new_round'
              AND mnq.status = 'pending'
          )
      `, [competitionIdInt, roundId, roundNumber, user_id]);

      /* FUTURE: Per-competition new_round notifications (commented out for now)
      await client.query(`
        INSERT INTO mobile_notification_queue (user_id, type, competition_id, round_id, round_number, status, created_at)
        SELECT cu.user_id, 'new_round', $1, $2, $3, 'pending', NOW()
        FROM competition_user cu
        JOIN app_user au ON au.id = cu.user_id
        WHERE cu.competition_id = $1
          AND cu.status = 'active'
          AND cu.hidden IS NOT TRUE
          AND au.email NOT LIKE '%@lms-guest.%'
          AND ($3 > 1 OR cu.user_id != $4)
          AND NOT EXISTS (
            SELECT 1 FROM mobile_notification_queue mnq
            WHERE mnq.user_id = cu.user_id
              AND mnq.type = 'new_round'
              AND mnq.competition_id = $1
              AND mnq.round_id = $2
          )
      `, [competitionIdInt, roundId, roundNumber, user_id]);
      */

      // PICK_REMINDER: Per-competition, requires device token
      await client.query(`
        INSERT INTO mobile_notification_queue (user_id, type, competition_id, round_id, round_number, status, created_at)
        SELECT cu.user_id, 'pick_reminder', $1, $2, $3, 'pending', NOW()
        FROM competition_user cu
        JOIN app_user au ON au.id = cu.user_id
        WHERE cu.competition_id = $1
          AND cu.status = 'active'
          AND cu.hidden IS NOT TRUE
          AND au.email NOT LIKE '%@lms-guest.%'
          AND EXISTS (SELECT 1 FROM device_tokens dt WHERE dt.user_id = cu.user_id)
          AND NOT EXISTS (
            SELECT 1 FROM mobile_notification_queue mnq
            WHERE mnq.user_id = cu.user_id
              AND mnq.type = 'pick_reminder'
              AND mnq.competition_id = $1
              AND mnq.round_id = $2
          )
      `, [competitionIdInt, roundId, roundNumber]);

      // Add audit log entry
      await client.query(`
        INSERT INTO audit_log (competition_id, user_id, action, details)
        VALUES ($1, $2, 'Organiser Added Fixtures', $3)
      `, [
        competitionIdInt,
        user_id,
        `Added ${fixtures.length} fixtures to Round ${roundNumber}`
      ]);

      return {
        round_id: roundId,
        round_number: roundNumber,
        fixtures_added: fixtures.length
      };
    });

    // ========================================
    // STEP 5: RETURN SUCCESS RESPONSE
    // ========================================

    return res.status(200).json({
      return_code: "SUCCESS",
      round_id: result.round_id,
      round_number: result.round_number,
      fixtures_added: result.fixtures_added,
      message: `${result.fixtures_added} fixtures added to Round ${result.round_number}`
    });

  } catch (error) {
    // ========================================
    // ERROR HANDLING
    // ========================================
    console.error('Error in organizer-add-fixtures:', error);
    return res.status(200).json({
      return_code: "SERVER_ERROR",
      message: "An error occurred while adding fixtures"
    });
  }
});

module.exports = router;
