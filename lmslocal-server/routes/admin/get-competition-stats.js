/*
=======================================================================================================================================
API Route: get-competition-stats
=======================================================================================================================================
Method: GET
Purpose: Everything the lmslocal-admin per-competition stats screen shows, in one round trip -
         who still owes a pick in the round that is open now, and how every round before it went.

         Read-only. Nothing here writes, and nothing here is a shortcut into a player route: the
         admin screens get their own routes (see CLAUDE.md), so this assembles what it needs from
         the same tables rather than borrowing an organiser endpoint.

         Loaded only when an admin opens the screen. The Competitions list carries the headline
         fraction for every row; this is the working behind one of them.
=======================================================================================================================================
Request Payload:
  None (GET). Query string:
    ?competition_id=221   - required, integer

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "competition": {
    "id": 221,                                     // integer
    "name": "Inglenook 20",                        // string
    "status": "active",                            // string, lowercased
    "organiser_id": 852,                           // integer, may be null if the account was removed
    "organiser_name": "Corey Eadson",              // string, may be null
    "organiser_email": "corey@example.com",        // string, may be null
    "created_at": "2026-08-14T09:09:17.000Z",      // string, ISO datetime
    "fixture_service": true,                       // boolean
    "team_list_name": "English Premier League 2026-27", // string, may be null
    "player_count": 6,                             // integer, every membership
    "still_in_count": 4                            // integer, of which not yet eliminated
  },
  "current_round": {                               // null when the competition has no round yet
    "round_id": 554,                               // integer
    "round_number": 3,                             // integer
    "lock_time": "2026-09-04T19:00:00.000Z",       // string, ISO datetime
    "is_locked": false,                            // boolean, lock_time has passed
    "players_due": 4,                              // integer, members still in, who each owe a pick
    "picks_made": 3,                               // integer, of those, who have picked
    "picks_outstanding": 1,                        // integer, players_due - picks_made
    "bots_outstanding": 0,                         // integer, of those outstanding, how many are bots
    "real_outstanding": 1                          // integer, outstanding that are actual people
  },
  "players": [                                     // every member, with their CURRENT round pick
    {
      "user_id": 874,                              // integer
      "name": "Leeroy",                            // string, competition display name where set
      "email": "leeroy@example.com",               // string, may be null
      "is_bot": false,                             // boolean, see services/botPool.js
      "is_organiser": true,                        // boolean, owns this competition
      "status": "active",                          // string, 'active' or 'out'
      "lives_remaining": 0,                        // integer
      "has_picked": true,                          // boolean, for the current round
      "picked_team": "Liverpool",                  // string or null, resolved from the short code
      "picked_at": "2026-09-01T08:14:00.000Z"      // string or null, ISO datetime
    }
  ],
  "rounds": [                                      // newest first
    {
      "round_id": 554,                             // integer
      "round_number": 3,                           // integer
      "lock_time": "2026-09-04T19:00:00.000Z",     // string, ISO datetime
      "is_locked": false,                          // boolean
      "fixture_count": 10,                         // integer
      "picks_made": 1,                             // integer, every pick row for the round
      "players_in_at_round": 0,                    // integer, player_progress rows, 0 until resulted
      "wins": 0,                                   // integer, outcome WIN
      "losses": 0,                                 // integer, outcome LOSE
      "missed": 0                                  // integer, resulted with no pick - the no-shows
    }
  ],
  "generated_at": "2026-09-01T14:00:00.000Z"
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"            - competition_id was not supplied
"INVALID_COMPETITION_ID"    - competition_id was not a positive integer
"COMPETITION_NOT_FOUND"     - No competition with that id
"UNAUTHORIZED"              - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"             - Admin session has expired
"SERVER_ERROR"              - Database error or unexpected server failure
=======================================================================================================================================
Data Notes:
- The current round is the highest round_number, open or not - see services/pickProgress.js for
  why that is not the same as "the open round", and for the population rule that makes
  picks_made/players_due a fraction of the same thing.
- "missed" comes from player_progress, NOT from the absence of a pick row. A player who never
  picked gets a player_progress row with outcome LOSE and no pick row at all, so counting
  no-shows from pick alone finds none of them (lmslocal-server/db/README.md).
- "players_in_at_round" is player_progress rows, which only exist once the round has been
  resulted. It is 0 for the round in progress, which is correct and is why the screen shows the
  current round from the live figures above rather than from this table.
- "picked_team" is a NAME, not the short code pick.team actually stores. Codes are unique only
  within a team list, so it is resolved against the competition's own list.
- The player list carries each member's pick for the CURRENT round only. Per-round pick history
  for one person is a bigger screen and a different question; this one answers "who am I
  waiting on".
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const { isBotEmail } = require('../../services/botPool');
const {
  BOT_EMAIL_LIKE,
  currentRoundProgressLateral,
  describePickProgress
} = require('../../services/pickProgress');
const router = express.Router();

router.get('/', verifyAdminToken, async (req, res) => {
  logApiCall('get-competition-stats');

  try {
    const raw = req.query.competition_id;

    if (raw === undefined || raw === null || raw === '') {
      return res.json({
        return_code: 'MISSING_FIELDS',
        message: 'competition_id is required'
      });
    }

    const competitionId = Number(raw);
    if (!Number.isInteger(competitionId) || competitionId <= 0) {
      return res.json({
        return_code: 'INVALID_COMPETITION_ID',
        message: 'competition_id must be a positive integer'
      });
    }

    /*
    The competition, its headline counts, and the current round's progress - the last of these
    from the same LATERAL the Competitions list uses, so the fraction on the row you clicked and
    the fraction at the top of this screen are produced by one piece of SQL.
    */
    const summaryResult = await query(`
      SELECT
        c.id,
        c.name,
        LOWER(c.status)                                                           AS status,
        c.created_at,
        COALESCE(c.fixture_service, false)                                        AS fixture_service,
        u.id                                                                      AS organiser_id,
        u.display_name                                                            AS organiser_name,
        u.email                                                                   AS organiser_email,
        tl.name                                                                   AS team_list_name,
        (SELECT COUNT(*) FROM competition_user cu WHERE cu.competition_id = c.id) AS player_count,
        (SELECT COUNT(*)
           FROM competition_user cu
          WHERE cu.competition_id = c.id
            AND cu.status = 'active')                                             AS still_in_count,
        pick_progress.*
      FROM competition c
      LEFT JOIN app_user u ON u.id = c.organiser_id
      LEFT JOIN team_list tl ON tl.id = c.team_list_id
      ${currentRoundProgressLateral('c', '$2')}
      WHERE c.id = $1
    `, [competitionId, BOT_EMAIL_LIKE]);

    if (summaryResult.rows.length === 0) {
      return res.json({
        return_code: 'COMPETITION_NOT_FOUND',
        message: 'No competition with that id'
      });
    }

    const row = summaryResult.rows[0];
    const { current_round: currentRound } = describePickProgress(row);

    /*
    Every member, with their pick for the current round if they made one. Eliminated members are
    included: the screen lists them under the players still in, because "who has gone out" is
    part of reading a competition even though they owe nothing.

    The pick LEFT JOIN is on the current round id, which is NULL when there is no round - the
    join then matches nothing and every player comes back unpicked, which is the truth.
    */
    const playersResult = await query(`
      SELECT
        cu.user_id,
        COALESCE(NULLIF(cu.player_display_name, ''), u.display_name)  AS name,
        u.email,
        cu.status,
        cu.lives_remaining,
        (cu.user_id IS NOT DISTINCT FROM c.organiser_id)              AS is_organiser,
        -- pick.team holds the SHORT CODE ('LIV'), not a name. Resolved against this
        -- competition's own team list, because short codes are only unique within one - and
        -- COALESCEd back to the raw code so a team since removed from the list still shows
        -- something rather than an empty cell.
        COALESCE(t.name, p.team)                                      AS picked_team,
        p.created_at                                                  AS picked_at
      FROM competition_user cu
      JOIN competition c ON c.id = cu.competition_id
      LEFT JOIN app_user u ON u.id = cu.user_id
      LEFT JOIN pick p ON p.user_id = cu.user_id AND p.round_id = $2
      LEFT JOIN team t ON t.short_name = p.team AND t.team_list_id = c.team_list_id
      WHERE cu.competition_id = $1
      ORDER BY cu.status, name
    `, [competitionId, currentRound ? currentRound.round_id : null]);

    /*
    Round history. The outcome counts come from player_progress, and "missed" is the no-pick
    eliminations that the pick table cannot see at all.
    */
    const roundsResult = await query(`
      SELECT
        r.id                                                          AS round_id,
        r.round_number,
        r.lock_time,
        (SELECT COUNT(*) FROM fixture f WHERE f.round_id = r.id)      AS fixture_count,
        (SELECT COUNT(*) FROM pick p WHERE p.round_id = r.id)         AS picks_made,
        (SELECT COUNT(*)
           FROM player_progress pp WHERE pp.round_id = r.id)          AS players_in_at_round,
        (SELECT COUNT(*)
           FROM player_progress pp
          WHERE pp.round_id = r.id AND pp.outcome = 'WIN')            AS wins,
        (SELECT COUNT(*)
           FROM player_progress pp
          WHERE pp.round_id = r.id AND pp.outcome = 'LOSE')           AS losses,
        (SELECT COUNT(*)
           FROM player_progress pp
          WHERE pp.round_id = r.id
            AND NOT EXISTS (SELECT 1 FROM pick p
                             WHERE p.round_id = r.id
                               AND p.user_id = pp.player_id))         AS missed
      FROM round r
      WHERE r.competition_id = $1
      ORDER BY r.round_number DESC
    `, [competitionId]);

    const n = (v) => parseInt(v, 10) || 0;
    const now = Date.now();

    return res.json({
      return_code: 'SUCCESS',
      competition: {
        id: row.id,
        name: row.name,
        status: row.status,
        organiser_id: row.organiser_id,
        organiser_name: row.organiser_name,
        organiser_email: row.organiser_email,
        created_at: row.created_at,
        fixture_service: row.fixture_service === true,
        team_list_name: row.team_list_name,
        player_count: n(row.player_count),
        still_in_count: n(row.still_in_count)
      },
      current_round: currentRound,
      players: playersResult.rows.map((pr) => ({
        user_id: pr.user_id,
        name: pr.name,
        email: pr.email,
        is_bot: isBotEmail(pr.email),
        is_organiser: pr.is_organiser === true,
        status: pr.status,
        lives_remaining: n(pr.lives_remaining),
        // The existence of the pick row is the whole test - a pick is inserted with its team, so
        // there is no "picked but blank". picked_team is returned as well because it is shown.
        has_picked: pr.picked_at !== null,
        picked_team: pr.picked_team,
        picked_at: pr.picked_at
      })),
      rounds: roundsResult.rows.map((rr) => ({
        round_id: rr.round_id,
        round_number: rr.round_number,
        lock_time: rr.lock_time,
        is_locked: rr.lock_time !== null && new Date(rr.lock_time).getTime() <= now,
        fixture_count: n(rr.fixture_count),
        picks_made: n(rr.picks_made),
        players_in_at_round: n(rr.players_in_at_round),
        wins: n(rr.wins),
        losses: n(rr.losses),
        missed: n(rr.missed)
      })),
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('get-competition-stats error:', error.message);
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not load competition stats'
    });
  }
});

module.exports = router;
