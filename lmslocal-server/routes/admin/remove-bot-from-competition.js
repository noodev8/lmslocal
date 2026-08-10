/*
=======================================================================================================================================
API Route: remove-bot-from-competition
=======================================================================================================================================
Method: POST
Purpose: Take one bot out of a competition and delete everything it did there.

         The bot account itself survives - it is shared with other competitions and stays in
         the pool. Only its membership and history in this competition go.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 199,                   // integer, required
  "user_id": 882                           // integer, required - must be a bot
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "Bot Alice removed",          // string
  "removed": {
    "user_id": 882,                        // integer
    "display_name": "Bot Alice",           // string
    "picks_deleted": 3,                    // integer
    "progress_deleted": 2                  // integer
  },
  "bots_remaining": 4                      // integer, bots left in this competition
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"          - competition_id or user_id missing
"COMPETITION_NOT_FOUND"     - No competition with that id
"COMPETITION_NOT_ELIGIBLE"  - That competition's organiser may not use bots
"COMPETITION_STARTED"       - Round 2 exists, or round 1 has locked
"NOT_A_BOT"                 - user_id is a real account, not a bot
"BOT_NOT_IN_COMPETITION"    - That bot is not in this competition
"SERVER_ERROR"              - Database error or unexpected server failure
"UNAUTHORIZED"              - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"             - Admin session has expired
=======================================================================================================================================
Data Notes:
- COMPETITION_STARTED holds this to the same window as add-bots-to-competition: before round 1
  exists, and during round 1 until it locks. Past that this route would be deleting picks that
  a locked round is about to be scored on, silently changing the field.
- Deliberately not remove-player.js. That route refunds a credit when the organiser is over the
  free player limit (remove-player.js:189) on the assumption a credit was spent getting the
  player in. Nothing charges on the way in here, so pointing it at a bot would mint credit out
  of nothing, once per removal.
- NOT_A_BOT exists because this route deletes a player's entire history with no confirmation
  step and no ownership check. The email pattern is the only thing standing between it and a
  real person's picks.
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const {
  BOT_EMAIL_LIKE,
  loadBotCompetition,
  assertCompetitionNotStarted
} = require('../../services/botPool');
const router = express.Router();

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('remove-bot-from-competition');

  try {
    const { competition_id, user_id } = req.body;

    if (!Number.isInteger(competition_id) || !Number.isInteger(user_id)) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'competition_id and user_id are required'
      });
    }

    // Throws COMPETITION_NOT_FOUND / COMPETITION_NOT_ELIGIBLE.
    await loadBotCompetition(competition_id);

    // Same window as adding - see the note in the header. Throws COMPETITION_STARTED.
    await assertCompetitionNotStarted(competition_id);

    const botResult = await query(`
      SELECT
        u.id,
        u.display_name,
        (u.email LIKE $2) AS is_bot,
        EXISTS (
          SELECT 1 FROM competition_user cu
          WHERE cu.competition_id = $3 AND cu.user_id = u.id
        ) AS in_competition
      FROM app_user u
      WHERE u.id = $1
    `, [user_id, BOT_EMAIL_LIKE, competition_id]);

    if (botResult.rows.length === 0 || botResult.rows[0].is_bot !== true) {
      return res.json({
        return_code: 'NOT_A_BOT',
        message: 'That account is not a bot'
      });
    }

    const bot = botResult.rows[0];

    if (bot.in_competition !== true) {
      return res.json({
        return_code: 'BOT_NOT_IN_COMPETITION',
        message: 'That bot is not in this competition'
      });
    }

    let picksDeleted = 0;
    let progressDeleted = 0;

    await transaction(async (client) => {
      // Dependants first, membership last.
      const picks = await client.query(`
        DELETE FROM pick
        WHERE user_id = $1
          AND round_id IN (SELECT id FROM round WHERE competition_id = $2)
      `, [user_id, competition_id]);
      picksDeleted = picks.rowCount;


      const progress = await client.query(
        'DELETE FROM player_progress WHERE competition_id = $1 AND player_id = $2',
        [competition_id, user_id]
      );
      progressDeleted = progress.rowCount;

      await client.query(
        'DELETE FROM competition_user WHERE competition_id = $1 AND user_id = $2',
        [competition_id, user_id]
      );

      await client.query(`
        INSERT INTO audit_log (competition_id, user_id, action, details, created_at)
        VALUES ($1, $2, 'Bot Removed', $3, NOW())
      `, [
        competition_id,
        req.admin.id,
        `${bot.display_name} removed by admin (${picksDeleted} pick(s), ${progressDeleted} progress row(s))`
      ]);
    });

    const remaining = await query(`
      SELECT COUNT(*)::int AS total
      FROM competition_user cu
      INNER JOIN app_user u ON u.id = cu.user_id
      WHERE cu.competition_id = $1 AND u.email LIKE $2
    `, [competition_id, BOT_EMAIL_LIKE]);

    return res.json({
      return_code: 'SUCCESS',
      message: `${bot.display_name} removed`,
      removed: {
        user_id: bot.id,
        display_name: bot.display_name,
        picks_deleted: picksDeleted,
        progress_deleted: progressDeleted
      },
      bots_remaining: remaining.rows[0].total
    });

  } catch (error) {
    if (error.return_code) {
      return res.json({
        return_code: error.return_code,
        message: error.message
      });
    }

    console.error('remove-bot-from-competition error:', {
      error: error.message,
      stack: error.stack?.substring(0, 500),
      competition_id: req.body?.competition_id,
      user_id: req.body?.user_id
    });

    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Failed to remove bot from competition'
    });
  }
});

module.exports = router;
