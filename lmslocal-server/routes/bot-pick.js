/*
=======================================================================================================================================
API Route: bot-pick
=======================================================================================================================================
Method: POST
Purpose: Make random picks for bot players in current round with count control for testing pick scenarios
=======================================================================================================================================
Request Payload:
{
  "competition_id": 123,               // integer, required - competition database ID
  "count": 15,                         // integer, required - number of bots to make picks (if exceeds remaining, all remaining bots pick)
  "bot_manage": "BOT_MAGIC_2025"       // string, required - bot management identifier
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "15 of 20 bots made picks",   // string, confirmation message
  "picks_made": 15,                        // integer, count of successful picks
  "total_bots": 20,                        // integer, total eligible bots
  "round_number": 3                        // integer, round number picks were made for
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"   // string, user-friendly error description
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"      - Missing or invalid parameters
"UNAUTHORIZED"          - Invalid auth_code
"COMPETITION_NOT_FOUND" - Competition does not exist
"NO_ROUNDS"            - No rounds exist for this competition
"ROUND_LOCKED"         - Current round is locked
"NO_FIXTURES"          - No fixtures exist for current round
"SERVER_ERROR"         - Database error or unexpected server failure
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../database');
const { checkAndLockRoundIfComplete } = require('../utils/roundLocking');
const router = express.Router();

// Bot management identifier for testing endpoints
const BOT_MANAGE = "BOT_MAGIC_2025";

router.post('/', async (req, res) => {
  try {
    const { competition_id, count, bot_manage } = req.body;

    // STEP 1: Validate bot management identifier
    if (!bot_manage || bot_manage !== BOT_MANAGE) {
      return res.json({
        return_code: "UNAUTHORIZED",
        message: "Invalid bot management identifier"
      });
    }

    // STEP 2: Validate required input parameters
    if (!competition_id || !Number.isInteger(competition_id)) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Competition ID is required and must be an integer"
      });
    }

    if (!Number.isInteger(count) || count < 0) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Count must be a non-negative integer"
      });
    }

    // STEP 3: Get current round info (using same logic as get-player-current-round)
    const currentRoundQuery = `
      SELECT
        r.id as round_id,
        r.round_number,
        r.lock_time,
        r.competition_id,
        c.name as competition_name,
        c.no_team_twice,
        NOW() as current_time,
        CASE WHEN NOW() >= r.lock_time THEN true ELSE false END as is_locked
      FROM competition c
      INNER JOIN round r ON c.id = r.competition_id
      WHERE c.id = $1
      ORDER BY r.round_number DESC
      LIMIT 1
    `;

    const roundResult = await query(currentRoundQuery, [competition_id]);

    if (roundResult.rows.length === 0) {
      // Check if competition exists
      const compCheck = await query('SELECT id FROM competition WHERE id = $1', [competition_id]);

      if (compCheck.rows.length === 0) {
        return res.json({
          return_code: "COMPETITION_NOT_FOUND",
          message: "Competition not found"
        });
      } else {
        return res.json({
          return_code: "NO_ROUNDS",
          message: "No rounds exist for this competition"
        });
      }
    }

    const round = roundResult.rows[0];

    // Check if round is locked
    if (round.is_locked) {
      return res.json({
        return_code: "ROUND_LOCKED",
        message: `Round ${round.round_number} is locked`
      });
    }

    // STEP 4: Get fixtures for current round
    const fixturesQuery = `
      SELECT
        id as fixture_id,
        home_team_short,
        away_team_short
      FROM fixture
      WHERE round_id = $1
      ORDER BY kickoff_time ASC
    `;

    const fixturesResult = await query(fixturesQuery, [round.round_id]);

    if (fixturesResult.rows.length === 0) {
      return res.json({
        return_code: "NO_FIXTURES",
        message: `No fixtures loaded for round ${round.round_number}`
      });
    }

    const fixtures = fixturesResult.rows;

    // STEP 5: Get all bots who haven't picked yet for this round
    const botsQuery = `
      SELECT
        cu.user_id,
        u.display_name,
        u.email
      FROM competition_user cu
      INNER JOIN app_user u ON cu.user_id = u.id
      LEFT JOIN pick p ON p.round_id = $1 AND p.user_id = cu.user_id
      WHERE cu.competition_id = $2
        AND cu.status = 'active'
        AND u.email LIKE 'bot_%@lms-guest.com'
        AND p.id IS NULL
      ORDER BY u.id ASC
    `;

    const botsResult = await query(botsQuery, [round.round_id, competition_id]);
    const totalBots = botsResult.rows.length;

    if (totalBots === 0) {
      return res.json({
        return_code: "SUCCESS",
        message: "No eligible bots found (all have already picked or none exist)",
        picks_made: 0,
        total_bots: 0,
        round_number: round.round_number
      });
    }

    // STEP 6: Calculate how many bots should pick based on count (capped at total remaining)
    const botsToPickCount = Math.min(count, totalBots);
    const botsToPickList = botsResult.rows.slice(0, botsToPickCount);

    // STEP 7: Make picks for selected bots
    let picksMade = 0;

    await transaction(async (client) => {
      for (const bot of botsToPickList) {
        try {
          // Get bot's previous picks if no_team_twice is enabled
          let excludedTeams = [];

          if (round.no_team_twice) {
            const previousPicksQuery = `
              SELECT DISTINCT p.team
              FROM pick p
              INNER JOIN round r ON p.round_id = r.id
              WHERE r.competition_id = $1
                AND p.user_id = $2
            `;
            const prevPicksResult = await client.query(previousPicksQuery, [competition_id, bot.user_id]);
            excludedTeams = prevPicksResult.rows.map(row => row.team);
          }

          // Filter fixtures to find valid picks (exclude previously picked teams)
          const validFixtures = fixtures.filter(fixture => {
            const homeValid = !excludedTeams.includes(fixture.home_team_short);
            const awayValid = !excludedTeams.includes(fixture.away_team_short);
            return homeValid || awayValid;
          });

          if (validFixtures.length === 0) {
            // Bot has no valid picks left - skip silently
            console.log(`Bot ${bot.display_name} has no valid picks remaining`);
            continue;
          }

          // Randomly select a fixture
          const randomFixture = validFixtures[Math.floor(Math.random() * validFixtures.length)];

          // Determine which teams are valid for this fixture
          const validTeams = [];
          if (!excludedTeams.includes(randomFixture.home_team_short)) {
            validTeams.push({ team: randomFixture.home_team_short, side: 'home' });
          }
          if (!excludedTeams.includes(randomFixture.away_team_short)) {
            validTeams.push({ team: randomFixture.away_team_short, side: 'away' });
          }

          // Randomly pick home or away (from valid options)
          const randomTeamChoice = validTeams[Math.floor(Math.random() * validTeams.length)];

          // Get team_id for allowed_teams management
          const teamIdQuery = `
            SELECT id FROM team WHERE short_name = $1 AND is_active = true
          `;
          const teamIdResult = await client.query(teamIdQuery, [randomTeamChoice.team]);

          if (teamIdResult.rows.length === 0) {
            console.log(`Team ${randomTeamChoice.team} not found in database`);
            continue;
          }

          const teamId = teamIdResult.rows[0].id;

          // Insert pick (using same logic as set-pick)
          await client.query(`
            INSERT INTO pick (round_id, user_id, team, fixture_id, competition_id, round_number, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (round_id, user_id)
            DO UPDATE SET team = $3, fixture_id = $4, competition_id = $5, round_number = $6, created_at = NOW()
          `, [round.round_id, bot.user_id, randomTeamChoice.team, randomFixture.fixture_id, competition_id, round.round_number]);

          // Remove picked team from allowed_teams if no_team_twice is enabled
          if (round.no_team_twice) {
            await client.query(`
              DELETE FROM allowed_teams
              WHERE competition_id = $1 AND user_id = $2 AND team_id = $3
            `, [competition_id, bot.user_id, teamId]);
          }

          picksMade++;

        } catch (error) {
          console.error(`Failed to make pick for bot ${bot.display_name}:`, error.message);
          // Continue with next bot
        }
      }

      // Check if all picks are in and auto-lock round (round 2+ only)
      const lockResult = await checkAndLockRoundIfComplete(client, round.round_id);
      if (lockResult.locked) {
        console.log(`Round ${lockResult.round_number} auto-locked - all ${lockResult.total_active_players} picks received (saved ${lockResult.time_saved_minutes} minutes)`);
      }
    });

    // STEP 8: Return success response
    return res.json({
      return_code: "SUCCESS",
      message: `${picksMade} of ${totalBots} bot${totalBots !== 1 ? 's' : ''} made picks`,
      picks_made: picksMade,
      total_bots: totalBots,
      round_number: round.round_number
    });

  } catch (error) {
    // Handle custom business logic errors
    if (error.return_code) {
      return res.json({
        return_code: error.return_code,
        message: error.message
      });
    }

    // Log detailed error information
    console.error('Bot pick error:', {
      error: error.message,
      stack: error.stack?.substring(0, 500),
      competition_id: req.body?.competition_id,
      count: req.body?.count,
      timestamp: new Date().toISOString()
    });

    return res.json({
      return_code: "SERVER_ERROR",
      message: "Failed to make bot picks"
    });
  }
});

module.exports = router;
