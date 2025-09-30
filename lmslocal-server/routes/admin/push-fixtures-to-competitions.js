/*
=======================================================================================================================================
API Route: push-fixtures-to-competitions
=======================================================================================================================================
Method: POST
Purpose: Admin-only route that pushes active fixtures from fixture_load table to all subscribed competitions.
         Creates new rounds and inserts fixtures for competitions that have completed their latest round.
=======================================================================================================================================
Request Payload:
{
  // No parameters required - processes all active fixtures
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "competitions_updated": 3,              // integer, number of competitions that received fixtures
  "competitions_skipped": 1,              // integer, number of competitions skipped (incomplete rounds)
  "fixtures_pushed": 10,                  // integer, total number of fixtures inserted
  "details": [                            // array, per-competition status
    {
      "competition_id": 1,
      "competition_name": "Premier League 2025",
      "status": "updated",                // string, "updated" or "skipped"
      "reason": null                      // string, skip reason if applicable
    },
    {
      "competition_id": 2,
      "competition_name": "Workplace League",
      "status": "skipped",
      "reason": "Round incomplete - awaiting results"
    }
  ]
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"NO_ACTIVE_FIXTURES"
"NO_SUBSCRIBED_COMPETITIONS"
"UNAUTHORIZED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { transaction } = require('../../database');
const { verifyToken, requireAdmin } = require('../../middleware/auth');
const { logApiCall } = require('../../utils/apiLogger');
const router = express.Router();

router.post('/', verifyToken, requireAdmin, async (req, res) => {
  logApiCall('push-fixtures-to-competitions');

  try {
    const user_id = req.user.id;

    // Execute all operations in a single atomic transaction
    const result = await transaction(async (client) => {

      // Step 1: Get all active fixtures from fixture_load table, grouped by team_list_id
      const fixturesResult = await client.query(`
        SELECT fixture_id, team_list_id, league, home_team_short, away_team_short, kickoff_time, home_score, away_score
        FROM fixture_load
        WHERE is_active = true
        ORDER BY team_list_id, kickoff_time
      `);

      if (fixturesResult.rows.length === 0) {
        throw new Error('NO_ACTIVE_FIXTURES');
      }

      const allFixtures = fixturesResult.rows;

      // Group fixtures by team_list_id for easier processing
      const fixturesByTeamList = {};
      allFixtures.forEach(fixture => {
        if (!fixturesByTeamList[fixture.team_list_id]) {
          fixturesByTeamList[fixture.team_list_id] = [];
        }
        fixturesByTeamList[fixture.team_list_id].push(fixture);
      });

      // Step 2: For each team_list_id, find subscribed competitions
      const allCompetitions = [];
      for (const teamListId of Object.keys(fixturesByTeamList)) {
        const competitionsResult = await client.query(`
          SELECT id, name, team_list_id, status
          FROM competition
          WHERE team_list_id = $1 AND fixture_service = true
        `, [parseInt(teamListId)]);

        allCompetitions.push(...competitionsResult.rows);
      }

      if (allCompetitions.length === 0) {
        throw new Error('NO_SUBSCRIBED_COMPETITIONS');
      }

      // Step 3: Process each competition
      const competitionDetails = [];
      let totalCompetitionsUpdated = 0;
      let totalCompetitionsSkipped = 0;
      let totalFixturesPushed = 0;

      for (const competition of allCompetitions) {
        const competitionId = competition.id;
        const competitionName = competition.name;
        const teamListId = competition.team_list_id;
        const competitionStatus = competition.status;

        // Skip if competition is already complete
        if (competitionStatus === 'COMPLETE') {
          competitionDetails.push({
            competition_id: competitionId,
            competition_name: competitionName,
            status: 'skipped',
            reason: 'Competition already complete'
          });
          totalCompetitionsSkipped++;
          continue;
        }

        // Get latest round for this competition
        const latestRoundResult = await client.query(`
          SELECT MAX(round_number) as latest_round
          FROM round
          WHERE competition_id = $1
        `, [competitionId]);

        const latestRound = latestRoundResult.rows[0].latest_round;

        // If no rounds exist at all, skip (organizer hasn't set up competition yet)
        if (!latestRound) {
          competitionDetails.push({
            competition_id: competitionId,
            competition_name: competitionName,
            status: 'skipped',
            reason: 'No rounds created yet'
          });
          totalCompetitionsSkipped++;
          continue;
        }

        // Check if latest round has fixtures and if all fixtures have results
        const fixtureCheckResult = await client.query(`
          SELECT
            COUNT(*) as total,
            COUNT(result) as with_results
          FROM fixture f
          JOIN round r ON f.round_id = r.id
          WHERE r.competition_id = $1 AND r.round_number = $2
        `, [competitionId, latestRound]);

        const fixtureCheck = fixtureCheckResult.rows[0];
        const totalFixtures = parseInt(fixtureCheck.total);
        const fixturesWithResults = parseInt(fixtureCheck.with_results);

        // Get fixtures for this competition's team_list_id (needed for all paths)
        const fixturesToPush = fixturesByTeamList[teamListId];

        if (!fixturesToPush || fixturesToPush.length === 0) {
          competitionDetails.push({
            competition_id: competitionId,
            competition_name: competitionName,
            status: 'skipped',
            reason: 'No fixtures available for this team list'
          });
          totalCompetitionsSkipped++;
          continue;
        }

        // Calculate lock_time: use earliest kickoff time from fixtures
        const earliestKickoff = fixturesToPush.reduce((earliest, fixture) => {
          if (!earliest || new Date(fixture.kickoff_time) < new Date(earliest)) {
            return fixture.kickoff_time;
          }
          return earliest;
        }, null);

        // Decision logic - determine if we need to create a new round or use existing
        let targetRoundId;
        let targetRoundNumber;
        let roundAction; // 'created' or 'populated'

        if (totalFixtures === 0) {
          // Blank round exists - populate it with fixtures
          // Get the round ID for the existing blank round
          const existingRoundResult = await client.query(`
            SELECT id, round_number
            FROM round
            WHERE competition_id = $1 AND round_number = $2
          `, [competitionId, latestRound]);

          targetRoundId = existingRoundResult.rows[0].id;
          targetRoundNumber = existingRoundResult.rows[0].round_number;
          roundAction = 'populated';

          // Update lock_time for the existing round
          await client.query(`
            UPDATE round
            SET lock_time = $1
            WHERE id = $2
          `, [earliestKickoff, targetRoundId]);

        } else if (fixturesWithResults < totalFixtures) {
          // Some fixtures don't have results yet - round incomplete, skip
          competitionDetails.push({
            competition_id: competitionId,
            competition_name: competitionName,
            status: 'skipped',
            reason: `Round incomplete - awaiting ${totalFixtures - fixturesWithResults} result(s)`
          });
          totalCompetitionsSkipped++;
          continue;

        } else {
          // All fixtures have results - create new round and push fixtures
          // Step 4a: Create new round (atomic round number generation)
          const newRoundResult = await client.query(`
            INSERT INTO round (
              competition_id,
              round_number,
              lock_time,
              created_at
            )
            SELECT
              $1,
              COALESCE(MAX(r.round_number), 0) + 1,
              $2,
              CURRENT_TIMESTAMP
            FROM competition c
            LEFT JOIN round r ON r.competition_id = c.id
            WHERE c.id = $1
            GROUP BY c.id
            RETURNING id, round_number
          `, [competitionId, earliestKickoff]);

          const newRound = newRoundResult.rows[0];
          targetRoundId = newRound.id;
          targetRoundNumber = newRound.round_number;
          roundAction = 'created';
        }

        // Step 4b: Lookup full team names from team table based on short names
        // Build a map of short_name -> full_name for this team_list
        const teamLookupResult = await client.query(`
          SELECT short_name, name
          FROM team
          WHERE team_list_id = $1 AND is_active = true
        `, [teamListId]);

        const teamMap = {};
        teamLookupResult.rows.forEach(team => {
          teamMap[team.short_name] = team.name;
        });

        // Step 4c: Insert all fixtures into the target round (either new or existing blank)
        for (const fixture of fixturesToPush) {
          // Build result string if scores are available
          let resultString = null;
          if (fixture.home_score !== null && fixture.away_score !== null) {
            resultString = `${fixture.home_score}-${fixture.away_score}`;
          }

          // Lookup full team names from map (fallback to short name if not found)
          const homeTeamFull = teamMap[fixture.home_team_short] || fixture.home_team_short;
          const awayTeamFull = teamMap[fixture.away_team_short] || fixture.away_team_short;

          await client.query(`
            INSERT INTO fixture (
              round_id,
              home_team,
              away_team,
              home_team_short,
              away_team_short,
              kickoff_time,
              result,
              created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
          `, [
            targetRoundId,
            homeTeamFull,                // Full name from lookup
            awayTeamFull,                // Full name from lookup
            fixture.home_team_short,     // Short name from fixture_load
            fixture.away_team_short,     // Short name from fixture_load
            fixture.kickoff_time,
            resultString
          ]);

          totalFixturesPushed++;
        }

        // Step 4d: Auto-reset teams for players with no remaining teams
        // This matches the logic from create-round.js
        const teamResetResult = await client.query(`
          INSERT INTO allowed_teams (competition_id, user_id, team_id, created_at)
          SELECT $1, cu.user_id, t.id, NOW()
          FROM competition_user cu
          CROSS JOIN team t
          WHERE cu.competition_id = $1
          AND cu.status = 'active'
          AND t.team_list_id = $2
          AND t.is_active = true
          AND NOT EXISTS (
            SELECT 1 FROM allowed_teams at
            WHERE at.competition_id = $1 AND at.user_id = cu.user_id
          )
          RETURNING user_id
        `, [competitionId, teamListId]);

        // Log team resets for affected players
        if (teamResetResult.rows.length > 0) {
          const uniqueUserIds = [...new Set(teamResetResult.rows.map(row => row.user_id))];

          for (const userId of uniqueUserIds) {
            // Get user display name for audit log
            const userResult = await client.query(
              'SELECT display_name FROM app_user WHERE id = $1',
              [userId]
            );

            const displayName = userResult.rows[0]?.display_name || `User ${userId}`;

            await client.query(`
              INSERT INTO audit_log (competition_id, user_id, action, details)
              VALUES ($1, $2, 'Teams Auto-Reset', $3)
            `, [
              competitionId,
              userId,
              `Teams automatically reset for ${displayName} at start of Round ${targetRoundNumber}`
            ]);
          }
        }

        // Step 4e: Create audit log entry for fixture push
        await client.query(`
          INSERT INTO audit_log (competition_id, user_id, action, details)
          VALUES ($1, $2, 'Fixtures Pushed', $3)
        `, [
          competitionId,
          user_id,
          `Fixture service ${roundAction} Round ${targetRoundNumber} with ${fixturesToPush.length} fixtures`
        ]);

        // Mark this competition as updated
        competitionDetails.push({
          competition_id: competitionId,
          competition_name: competitionName,
          status: 'updated',
          reason: null
        });
        totalCompetitionsUpdated++;
      }

      // Step 5: Mark all fixtures as inactive (pushed)
      await client.query(`
        UPDATE fixture_load
        SET is_active = false, pushed_at = NOW()
        WHERE is_active = true
      `);

      // Return all data needed for response
      return {
        competitions_updated: totalCompetitionsUpdated,
        competitions_skipped: totalCompetitionsSkipped,
        fixtures_pushed: totalFixturesPushed,
        details: competitionDetails
      };
    });

    // Transaction completed successfully - send response
    res.json({
      return_code: "SUCCESS",
      competitions_updated: result.competitions_updated,
      competitions_skipped: result.competitions_skipped,
      fixtures_pushed: result.fixtures_pushed,
      details: result.details
    });

  } catch (error) {
    console.error('Push fixtures error:', error);

    // Handle specific business logic errors with appropriate return codes
    if (error.message === 'NO_ACTIVE_FIXTURES') {
      return res.json({
        return_code: "NO_ACTIVE_FIXTURES",
        message: "No active fixtures found in fixture_load table"
      });
    }

    if (error.message === 'NO_SUBSCRIBED_COMPETITIONS') {
      return res.json({
        return_code: "NO_SUBSCRIBED_COMPETITIONS",
        message: "No competitions are subscribed to the fixture service"
      });
    }

    // Database or unexpected errors
    res.json({
      return_code: "SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

module.exports = router;