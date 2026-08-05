/*
=======================================================================================================================================
API Route: set-bot-picks
=======================================================================================================================================
Method: POST
Purpose: Make random picks for bots that have not picked in the current round.

         Replaces the old public /bot-pick. Same behaviour - a bot picks a team at random from
         the round's fixtures, respecting no-team-twice - now behind the admin token.

         count controls how many bots pick, which is the point of the parameter: leaving some
         bots without a pick is how you produce a round where not everyone has answered.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 199,                   // integer, required
  "count": 10                              // integer, required - 1-100, capped at bots still to pick
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "8 of 10 bots picked",        // string
  "picks_made": 8,                         // integer
  "bots_without_pick": 10,                 // integer, how many were eligible before this ran
  "round_number": 3,                       // integer
  "skipped_no_teams": 2                    // integer, bots with no legal team left to pick
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"          - competition_id or count missing or out of range
"COMPETITION_NOT_FOUND"     - No competition with that id
"COMPETITION_NOT_ELIGIBLE"  - That competition's organiser may not use bots
"NO_ROUNDS"                 - Competition has no rounds yet
"ROUND_LOCKED"              - The current round has locked
"NO_FIXTURES"               - The current round has no fixtures
"SERVER_ERROR"              - Database error or unexpected server failure
"UNAUTHORIZED"              - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"             - Admin session has expired
=======================================================================================================================================
Data Notes:
- Picking never locks the round. The old bot-pick called checkAndLockRoundIfComplete, but that
  helper returns AUTO_LOCK_DISABLED before doing anything (utils/roundLocking.js) - waiting for
  the first kickoff was judged more interesting than locking the moment the last pick lands.
- A bot with no legal team left is counted in skipped_no_teams rather than failing the call.
  With no-team-twice on and a long-running competition this is normal, not an error.
- Eliminated bots are left alone - only status 'active' members are considered.
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
  loadUsedTeams,
  loadTeamIdsByShortName
} = require('../../services/botPool');
const router = express.Router();

const MAX_PER_CALL = 100;

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('set-bot-picks');

  try {
    const { competition_id, count } = req.body;

    if (!Number.isInteger(competition_id)) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'competition_id is required'
      });
    }

    if (!Number.isInteger(count) || count < 1 || count > MAX_PER_CALL) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: `count must be an integer between 1 and ${MAX_PER_CALL}`
      });
    }

    // Each of these throws a return_code on failure - see services/botPool.js.
    const competition = await loadBotCompetition(competition_id);
    const round = await loadCurrentRound(competition_id);
    const fixtures = await loadRoundFixtures(round.round_id);

    // Active bots with nothing down for this round.
    const botsResult = await query(`
      SELECT cu.user_id, u.display_name
      FROM competition_user cu
      INNER JOIN app_user u ON u.id = cu.user_id
      LEFT JOIN pick p ON p.round_id = $1 AND p.user_id = cu.user_id
      WHERE cu.competition_id = $2
        AND cu.status = 'active'
        AND u.email LIKE $3
        AND p.id IS NULL
      ORDER BY u.display_name
    `, [round.round_id, competition_id, BOT_EMAIL_LIKE]);

    const bots = botsResult.rows;

    if (bots.length === 0) {
      return res.json({
        return_code: 'SUCCESS',
        message: 'Every bot has already picked this round',
        picks_made: 0,
        bots_without_pick: 0,
        round_number: round.round_number,
        skipped_no_teams: 0
      });
    }

    const toPick = bots.slice(0, count);

    /*
    Everything the loop needs, fetched up front. The route this replaced ran two queries per
    bot inside the transaction - previous picks and a team id lookup - which is the N+1 shape
    that gets slow exactly when it matters, on a competition with a full pool of bots in it.

    Both of the checks set-pick.js makes on a human, in the same order: allowed_teams says what
    is on the table, previous picks say whether no-team-twice has been spent on it.
    */
    const userIds = toPick.map((b) => b.user_id);
    const allowedTeams = await loadAllowedTeams(competition_id, competition.team_list_id, userIds);
    const usedTeams = competition.no_team_twice
      ? await loadUsedTeams(competition_id, userIds)
      : new Map();

    const teamIds = await loadTeamIdsByShortName(competition.team_list_id);

    let picksMade = 0;
    let skippedNoTeams = 0;

    /*
    No per-bot try/catch. The version this replaces caught a failure and carried on to the next
    bot, but a failed statement has already aborted the Postgres transaction, so every bot after
    it failed too and the call reported a partial success that had actually rolled back. Letting
    it throw means a real failure rolls back visibly.
    */
    await transaction(async (client) => {
      for (const bot of toPick) {
        const allowed = allowedTeams.get(bot.user_id) || new Set();
        const used = usedTeams.get(bot.user_id) || new Set();

        // A team is a candidate only if it passes both checks a human's pick passes.
        const canPick = (team) => allowed.has(team) && !used.has(team);

        const candidates = [];
        for (const fixture of fixtures) {
          if (canPick(fixture.home_team_short)) {
            candidates.push({ team: fixture.home_team_short, fixture_id: fixture.fixture_id });
          }
          if (canPick(fixture.away_team_short)) {
            candidates.push({ team: fixture.away_team_short, fixture_id: fixture.fixture_id });
          }
        }

        if (candidates.length === 0) {
          skippedNoTeams++;
          continue;
        }

        const choice = candidates[Math.floor(Math.random() * candidates.length)];

        await client.query(`
          INSERT INTO pick (round_id, user_id, team, fixture_id, competition_id, round_number, set_by_admin, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (round_id, user_id)
          DO UPDATE SET team = $3, fixture_id = $4, set_by_admin = $7, created_at = NOW()
        `, [round.round_id, bot.user_id, choice.team, choice.fixture_id, competition_id, round.round_number, req.admin.id]);

        // Keep allowed_teams in step with the pick, the same way a real pick does.
        const teamId = teamIds.get(choice.team);
        if (competition.no_team_twice && teamId) {
          await client.query(
            'DELETE FROM allowed_teams WHERE competition_id = $1 AND user_id = $2 AND team_id = $3',
            [competition_id, bot.user_id, teamId]
          );
        }

        picksMade++;
      }
    });

    return res.json({
      return_code: 'SUCCESS',
      message: `${picksMade} of ${toPick.length} bot${toPick.length === 1 ? '' : 's'} picked`,
      picks_made: picksMade,
      bots_without_pick: bots.length,
      round_number: round.round_number,
      skipped_no_teams: skippedNoTeams
    });

  } catch (error) {
    if (error.return_code) {
      return res.json({
        return_code: error.return_code,
        message: error.message
      });
    }

    console.error('set-bot-picks error:', {
      error: error.message,
      stack: error.stack?.substring(0, 500),
      competition_id: req.body?.competition_id,
      count: req.body?.count
    });

    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Failed to make bot picks'
    });
  }
});

module.exports = router;
