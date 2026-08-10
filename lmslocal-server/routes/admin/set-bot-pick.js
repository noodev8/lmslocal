/*
=======================================================================================================================================
API Route: set-bot-pick
=======================================================================================================================================
Method: POST
Purpose: Set one bot's pick to a chosen team, or clear it.

         The bulk route (set-bot-picks) picks at random, which is right for filling a round but
         wrong when you want a particular outcome - a specific team carrying most of the
         competition into a round, or a bot lined up to go out. This is the manual override.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 199,                   // integer, required
  "user_id": 882,                          // integer, required - must be a bot in this competition
  "team": "ARS"                            // string|null, required - team short name, or null to clear
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Bot Alice picked ARS",       // string
  "user_id": 882,                          // integer
  "display_name": "Bot Alice",             // string
  "team": "ARS",                           // string|null, null when the pick was cleared
  "fixture_id": 900,                       // integer|null
  "round_number": 3                        // integer
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"          - competition_id or user_id missing, or team not a string/null
"COMPETITION_NOT_FOUND"     - No competition with that id
"COMPETITION_NOT_ELIGIBLE"  - That competition's organiser may not use bots
"NOT_A_BOT"                 - user_id is a real account, not a bot
"BOT_NOT_IN_COMPETITION"    - That bot is not an active member of this competition
"NO_ROUNDS"                 - Competition has no rounds yet
"ROUND_LOCKED"              - The current round has locked
"NO_FIXTURES"               - The current round has no fixtures
"TEAM_NOT_IN_ROUND"         - That team is not playing in the current round
"TEAM_NOT_ALLOWED"          - That team is not available to this bot
"TEAM_ALREADY_USED"         - no_team_twice is on and this bot has already used that team
"SERVER_ERROR"              - Database error or unexpected server failure
"UNAUTHORIZED"              - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"             - Admin session has expired
=======================================================================================================================================
Data Notes:
- Validation matches set-pick.js: TEAM_NOT_ALLOWED against the derived list, then
  TEAM_ALREADY_USED against previous picks. A bot is not a special case of a player.
- team is the short name a pick actually stores ("ARS"), taken straight from the fixture. The
  organiser-facing admin-set-pick.js takes a full team name and converts; the Bots screen is
  building its dropdown from fixtures, which carry the short name, so there is nothing to
  convert here.
- Clearing a pick frees the team automatically - the pick row was the only record of its use.
  Without that, a cleared pick would quietly cost the bot a team for the rest of the
  competition.
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const {
  BOT_EMAIL_LIKE,
  loadBotCompetition,
  loadCurrentRound,
  loadRoundFixtures,
  loadAllowedTeams,
  loadUsedTeams
} = require('../../services/botPool');
const router = express.Router();

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('set-bot-pick');

  try {
    const { competition_id, user_id, team } = req.body;

    if (!Number.isInteger(competition_id) || !Number.isInteger(user_id)) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'competition_id and user_id are required'
      });
    }

    if (team !== null && typeof team !== 'string') {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'team must be a team short name, or null to clear the pick'
      });
    }

    const competition = await loadBotCompetition(competition_id);
    const round = await loadCurrentRound(competition_id);
    const fixtures = await loadRoundFixtures(round.round_id);

    const botResult = await query(`
      SELECT
        u.id,
        u.display_name,
        (u.email LIKE $2) AS is_bot,
        cu.status
      FROM app_user u
      LEFT JOIN competition_user cu ON cu.user_id = u.id AND cu.competition_id = $3
      WHERE u.id = $1
    `, [user_id, BOT_EMAIL_LIKE, competition_id]);

    if (botResult.rows.length === 0 || botResult.rows[0].is_bot !== true) {
      return res.json({
        return_code: 'NOT_A_BOT',
        message: 'That account is not a bot'
      });
    }

    const bot = botResult.rows[0];

    if (bot.status !== 'active') {
      return res.json({
        return_code: 'BOT_NOT_IN_COMPETITION',
        message: bot.status
          ? 'That bot is no longer active in this competition'
          : 'That bot is not in this competition'
      });
    }

    // --- Clearing the pick ---------------------------------------------------------------
    if (team === null) {
      await transaction(async (client) => {
        const existing = await client.query(
          'SELECT team FROM pick WHERE round_id = $1 AND user_id = $2',
          [round.round_id, user_id]
        );

        await client.query(
          'DELETE FROM pick WHERE round_id = $1 AND user_id = $2',
          [round.round_id, user_id]
        );

        // The team comes back on its own now: deleting the pick above removes the only record
        // that it was ever used.
      });

      return res.json({
        return_code: 'SUCCESS',
        message: `${bot.display_name}'s pick cleared`,
        user_id: bot.id,
        display_name: bot.display_name,
        team: null,
        fixture_id: null,
        round_number: round.round_number
      });
    }

    // --- Setting a pick ------------------------------------------------------------------
    const teamShort = team.trim().toUpperCase();

    const fixture = fixtures.find(
      (f) => f.home_team_short === teamShort || f.away_team_short === teamShort
    );

    if (!fixture) {
      return res.json({
        return_code: 'TEAM_NOT_IN_ROUND',
        message: `${teamShort} is not playing in round ${round.round_number}`
      });
    }

    /*
    The same two checks set-pick.js runs on a human, in the same order.

    TEAM_NOT_ALLOWED tests the derived list. There is no rebuild step any more - an empty set
    means the bot has used every team, exactly as it does for a real player.
    */
    const allowed = await loadAllowedTeams(competition_id, competition.team_list_id, [user_id]);
    const allowedForBot = allowed.get(user_id) || new Set();

    // The team the bot is currently on is excluded by the derivation - re-picking it is
    // a no-op, not a rule break.
    const currentPick = await query(
      'SELECT team FROM pick WHERE round_id = $1 AND user_id = $2',
      [round.round_id, user_id]
    );
    const currentTeam = currentPick.rows[0]?.team || null;

    if (!allowedForBot.has(teamShort) && teamShort !== currentTeam) {
      return res.json({
        return_code: 'TEAM_NOT_ALLOWED',
        message: `${bot.display_name} is not allowed to pick ${teamShort}`
      });
    }

    // TEAM_ALREADY_PICKED in set-pick.js:248. The current round is excluded so that replacing a
    // pick does not trip over the team the bot is already on.
    if (competition.no_team_twice) {
      const used = await loadUsedTeams(competition_id, [user_id], round.round_id);
      if ((used.get(user_id) || new Set()).has(teamShort)) {
        return res.json({
          return_code: 'TEAM_ALREADY_USED',
          message: `${bot.display_name} has already used ${teamShort}`
        });
      }
    }

    await transaction(async (client) => {
      // Overwriting the pick is the whole operation: it frees whatever the bot was on before and
      // records the new team, with no second table to keep in step.
      await client.query(`
        INSERT INTO pick (round_id, user_id, team, fixture_id, competition_id, round_number, set_by_admin, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (round_id, user_id)
        DO UPDATE SET team = $3, fixture_id = $4, set_by_admin = $7, created_at = NOW()
      `, [round.round_id, user_id, teamShort, fixture.fixture_id, competition_id, round.round_number, req.admin.id]);
    });

    return res.json({
      return_code: 'SUCCESS',
      message: `${bot.display_name} picked ${teamShort}`,
      user_id: bot.id,
      display_name: bot.display_name,
      team: teamShort,
      fixture_id: fixture.fixture_id,
      round_number: round.round_number
    });

  } catch (error) {
    if (error.return_code) {
      return res.json({
        return_code: error.return_code,
        message: error.message
      });
    }

    console.error('set-bot-pick error:', {
      error: error.message,
      stack: error.stack?.substring(0, 500),
      competition_id: req.body?.competition_id,
      user_id: req.body?.user_id,
      team: req.body?.team
    });

    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Failed to set bot pick'
    });
  }
});

module.exports = router;
