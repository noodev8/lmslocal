/*
=======================================================================================================================================
API Route: bot-join
=======================================================================================================================================
Method: POST
Purpose: Assign permanent bot players to a competition for testing purposes (20 bots available system-wide)
=======================================================================================================================================
Request Payload:
{
  "invite_code": "ABC123",             // string, required - competition invite code
  "count": 10,                         // integer, required - number of bots to assign (1-20, assigns available if fewer)
  "bot_manage": "BOT_MAGIC_2025"       // string, required - bot management identifier
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "10 bots assigned successfully",  // string, confirmation message
  "bots_assigned": 10,                         // integer, count of bots successfully assigned
  "bots_requested": 15,                        // integer, count of bots originally requested
  "bots_available": 5                          // integer, remaining bots available for other competitions
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
"UNAUTHORIZED"          - Invalid bot_manage code
"COMPETITION_NOT_FOUND" - Competition does not exist with provided code
"COMPETITION_STARTED"   - Cannot join after round 1 has started
"NO_BOTS_AVAILABLE"     - All 20 bots are already assigned to this competition
"SERVER_ERROR"          - Database error or unexpected server failure
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../database');
const router = express.Router();

// Bot management identifier for testing endpoints
const BOT_MANAGE = "BOT_MAGIC_2025";

// Maximum permanent bots in the system
const MAX_BOTS = 20;

router.post('/', async (req, res) => {
  try {
    const { invite_code, count, bot_manage } = req.body;

    // STEP 1: Validate bot management identifier
    if (!bot_manage || bot_manage !== BOT_MANAGE) {
      return res.json({
        return_code: "UNAUTHORIZED",
        message: "Invalid bot management identifier"
      });
    }

    // STEP 2: Validate required input parameters
    if (!invite_code || typeof invite_code !== 'string' || invite_code.trim().length === 0) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: "Invite code is required and must be a non-empty string"
      });
    }

    if (!count || !Number.isInteger(count) || count < 1 || count > MAX_BOTS) {
      return res.json({
        return_code: "VALIDATION_ERROR",
        message: `Count must be an integer between 1 and ${MAX_BOTS}`
      });
    }

    const code = invite_code.trim().toUpperCase();

    // STEP 3: Get competition info and validate joining eligibility
    const competitionQuery = `
      WITH competition_data AS (
        SELECT
          c.id as competition_id,
          c.name as competition_name,
          c.lives_per_player,
          c.organiser_id,
          c.team_list_id,
          MAX(r.round_number) as current_round_number,
          MAX(r.lock_time) as latest_lock_time,
          NOW() as current_time
        FROM competition c
        LEFT JOIN round r ON c.id = r.competition_id
        WHERE UPPER(c.invite_code) = $1 OR UPPER(c.slug) = $1
        GROUP BY c.id, c.name, c.lives_per_player, c.organiser_id, c.team_list_id
      )
      SELECT * FROM competition_data
    `;

    const competitionResult = await query(competitionQuery, [code]);

    if (competitionResult.rows.length === 0) {
      return res.json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "No competition found with that code or slug"
      });
    }

    const competition = competitionResult.rows[0];

    // Check if joining is still allowed (same logic as regular join)
    const currentRound = competition.current_round_number;
    if (currentRound && currentRound > 1) {
      return res.json({
        return_code: "COMPETITION_STARTED",
        message: "Cannot join - competition has progressed beyond round 1"
      });
    }

    if (competition.latest_lock_time) {
      const lockTime = new Date(competition.latest_lock_time);
      const currentTime = new Date();

      if (currentTime >= lockTime) {
        return res.json({
          return_code: "COMPETITION_STARTED",
          message: "Cannot join - Round 1 has locked and competition has started"
        });
      }
    }

    // STEP 4: Get available permanent bots (not already in this competition)
    const availableBotsQuery = `
      SELECT u.id, u.display_name, u.email
      FROM app_user u
      WHERE u.email LIKE 'bot_%@lms-guest.com'
        AND u.display_name LIKE 'Bot %'
        AND u.id NOT IN (
          SELECT cu.user_id
          FROM competition_user cu
          WHERE cu.competition_id = $1
        )
      ORDER BY RANDOM()
    `;

    const availableBotsResult = await query(availableBotsQuery, [competition.competition_id]);
    const availableBots = availableBotsResult.rows;

    if (availableBots.length === 0) {
      return res.json({
        return_code: "NO_BOTS_AVAILABLE",
        message: "All 20 bots are already assigned to this competition"
      });
    }

    // STEP 5: Assign bots (up to requested count or available, whichever is less)
    const botsToAssign = availableBots.slice(0, count);
    let botsAssigned = 0;

    await transaction(async (client) => {
      for (const bot of botsToAssign) {
        // Join competition
        await client.query(`
          INSERT INTO competition_user (competition_id, user_id, status, lives_remaining, joined_at, player_display_name)
          VALUES ($1, $2, 'active', $3, NOW(), $4)
        `, [competition.competition_id, bot.id, competition.lives_per_player, bot.display_name]);

        // Populate allowed teams
        await client.query(`
          INSERT INTO allowed_teams (competition_id, user_id, team_id)
          SELECT $1, $2, t.id
          FROM team t
          WHERE t.team_list_id = $3 AND t.is_active = true
          ON CONFLICT (competition_id, user_id, team_id) DO NOTHING
        `, [competition.competition_id, bot.id, competition.team_list_id]);

        botsAssigned++;
      }
    });

    // STEP 6: Return success response
    const remainingBots = availableBots.length - botsAssigned;

    return res.json({
      return_code: "SUCCESS",
      message: `${botsAssigned} bot${botsAssigned !== 1 ? 's' : ''} assigned successfully`,
      bots_assigned: botsAssigned,
      bots_requested: count,
      bots_available: remainingBots
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
    console.error('Bot join error:', {
      error: error.message,
      stack: error.stack?.substring(0, 500),
      invite_code: req.body?.invite_code,
      count: req.body?.count,
      timestamp: new Date().toISOString()
    });

    return res.json({
      return_code: "SERVER_ERROR",
      message: "Failed to assign bots to competition"
    });
  }
});

module.exports = router;
