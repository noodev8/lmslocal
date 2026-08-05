/*
=======================================================================================================================================
API Route: add-bots-to-competition
=======================================================================================================================================
Method: POST
Purpose: Put bots into a competition so it is not empty when a real player joins.

         Replaces the old public /bot-join, which was reachable by anyone who knew the string
         BOT_MAGIC_2025 - committed in the repo - and took an invite code. This one is admin
         only and works from the competition id the screen already has.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 199,                   // integer, required
  "count": 10                              // integer, required - 1-50; assigns as many as are free
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "message": "10 bots added",              // string
  "bots_added": 10,                        // integer, how many actually joined
  "bots_requested": 10,                    // integer, what was asked for
  "bots_available": 5,                     // integer, pool members still not in this competition
  "bots": [                                // array, the ones added
    { "id": 882, "display_name": "Bot Alice" }
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
"VALIDATION_ERROR"          - competition_id or count missing or out of range
"COMPETITION_NOT_FOUND"     - No competition with that id
"COMPETITION_NOT_ELIGIBLE"  - That competition's organiser may not use bots
"COMPETITION_STARTED"       - Round 2 exists, or round 1 has locked
"NO_BOTS_AVAILABLE"         - Every bot in the pool is already in this competition
"SERVER_ERROR"              - Database error or unexpected server failure
"UNAUTHORIZED"              - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"             - Admin session has expired
=======================================================================================================================================
Data Notes:
- COMPETITION_STARTED is the same rule real players get in join-competition-by-code: you can
  join before round 1 exists and during round 1 until it locks. A bot arriving mid-competition
  with a full set of lives would be a different kind of entrant to everyone around it.
- Bots occupy paid player slots exactly like people. That is survivable only because
  services/botPool.js confines them to our own organiser accounts - see the comment there.
- Writes an audit_log row. From the organiser's side a competition that gains ten players
  overnight is otherwise unexplained.
=======================================================================================================================================
*/

const express = require('express');
const { query, transaction } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const { BOT_EMAIL_LIKE, loadBotCompetition } = require('../../services/botPool');
const router = express.Router();

const MAX_PER_CALL = 50;

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('add-bots-to-competition');

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

    // Throws COMPETITION_NOT_FOUND / COMPETITION_NOT_ELIGIBLE.
    const competition = await loadBotCompetition(competition_id);

    // Same joining window real players get - see the note in the header.
    const roundResult = await query(`
      SELECT
        MAX(round_number) AS latest_round,
        MAX(lock_time) AS latest_lock_time
      FROM round
      WHERE competition_id = $1
    `, [competition_id]);

    const latestRound = roundResult.rows[0].latest_round;
    const latestLockTime = roundResult.rows[0].latest_lock_time;

    if (latestRound !== null && Number(latestRound) > 1) {
      return res.json({
        return_code: 'COMPETITION_STARTED',
        message: 'Competition has progressed beyond round 1'
      });
    }

    if (latestLockTime && new Date() >= new Date(latestLockTime)) {
      return res.json({
        return_code: 'COMPETITION_STARTED',
        message: 'Round 1 has locked'
      });
    }

    // Bots not already in this competition, shuffled so repeated adds do not always draw the
    // same names in the same order.
    const availableResult = await query(`
      SELECT u.id, u.display_name
      FROM app_user u
      WHERE u.email LIKE $1
        AND NOT EXISTS (
          SELECT 1 FROM competition_user cu
          WHERE cu.competition_id = $2 AND cu.user_id = u.id
        )
      ORDER BY RANDOM()
    `, [BOT_EMAIL_LIKE, competition_id]);

    const available = availableResult.rows;

    if (available.length === 0) {
      return res.json({
        return_code: 'NO_BOTS_AVAILABLE',
        message: 'Every bot in the pool is already in this competition'
      });
    }

    const toAdd = available.slice(0, count);

    await transaction(async (client) => {
      for (const bot of toAdd) {
        await client.query(`
          INSERT INTO competition_user (competition_id, user_id, status, lives_remaining, joined_at, player_display_name)
          VALUES ($1, $2, 'active', $3, NOW(), $4)
        `, [competition_id, bot.id, competition.lives_per_player, bot.display_name]);

        // Every team is on the table for a new entrant. ON CONFLICT because a bot removed and
        // re-added may still have rows if a delete ever half-completed.
        await client.query(`
          INSERT INTO allowed_teams (competition_id, user_id, team_id)
          SELECT $1, $2, t.id
          FROM team t
          WHERE t.team_list_id = $3 AND t.is_active = true
          ON CONFLICT (competition_id, user_id, team_id) DO NOTHING
        `, [competition_id, bot.id, competition.team_list_id]);
      }

      await client.query(`
        INSERT INTO audit_log (competition_id, user_id, action, details, created_at)
        VALUES ($1, $2, 'Bots Added', $3, NOW())
      `, [
        competition_id,
        req.admin.id,
        `${toAdd.length} bot(s) added by admin: ${toAdd.map((b) => b.display_name).join(', ')}`
      ]);
    });

    return res.json({
      return_code: 'SUCCESS',
      message: `${toAdd.length} bot${toAdd.length === 1 ? '' : 's'} added`,
      bots_added: toAdd.length,
      bots_requested: count,
      bots_available: available.length - toAdd.length,
      bots: toAdd
    });

  } catch (error) {
    if (error.return_code) {
      return res.json({
        return_code: error.return_code,
        message: error.message
      });
    }

    console.error('add-bots-to-competition error:', {
      error: error.message,
      stack: error.stack?.substring(0, 500),
      competition_id: req.body?.competition_id,
      count: req.body?.count
    });

    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Failed to add bots to competition'
    });
  }
});

module.exports = router;
