/*
=======================================================================================================================================
API Route: get-bots
=======================================================================================================================================
Method: GET
Purpose: Everything the admin Bots screen needs - the bot pool, the competitions bots are
         allowed in, and (when one is named) that competition's round, its bots and their picks.

         One call rather than four, because every part of the screen changes together: adding a
         bot changes the pool's usage counts, the competition's bot count and the member list.
=======================================================================================================================================
Query Parameters:
  competition_id    // integer, optional - include the detail block for this competition

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "bots": [                                  // array, the whole pool, name order
    {
      "id": 882,                             // integer, app_user id
      "display_name": "Bot Alice",           // string
      "email": "bot_alice@lms-guest.com",    // string
      "competitions": 1                      // integer, how many competitions it is currently in
    }
  ],
  "competitions": [                          // array, competitions bots may be used in
    {
      "id": 199,                             // integer
      "name": "Sign Test",                   // string
      "status": "ACTIVE",                    // string, as stored - casing is inconsistent platform-wide
      "player_count": 4,                     // integer, everyone including bots
      "bot_count": 2,                        // integer, of which bots
      "round_number": 3,                     // integer|null, latest round, null if none yet
      "lock_time": "2026-08-08T14:00:00Z",   // string|null, ISO
      "is_locked": false,                    // boolean, lock_time has passed
      "can_add_bots": true,                  // boolean, false once the competition has started
      "closed_reason": null                  // string|null, "STARTED" when can_add_bots is false
    }
  ],
  "detail": {                                // object|null, only when competition_id was given
    "competition_id": 199,                   // integer
    "no_team_twice": true,                   // boolean, whether a used team is off limits
    "round_id": 412,                         // integer|null, null when the competition has no round
    "round_number": 3,                       // integer|null
    "lock_time": "2026-08-08T14:00:00Z",     // string|null, ISO
    "is_locked": false,                      // boolean
    "fixtures": [                            // array, the round's fixtures, kickoff order
      {
        "fixture_id": 900,                   // integer
        "home_team_short": "ARS",            // string, what a pick stores
        "away_team_short": "CHE",            // string
        "home_team_name": "Arsenal",         // string
        "away_team_name": "Chelsea",         // string
        "kickoff_time": "2026-08-08T14:00:00Z" // string, ISO
      }
    ],
    "members": [                             // array, the bots in this competition
      {
        "user_id": 882,                      // integer
        "display_name": "Bot Alice",         // string
        "status": "active",                  // string, competition_user.status
        "lives_remaining": 2,                // integer|null
        "pick_team": "ARS",                  // string|null, this round's pick, null if none
        "pick_fixture_id": 900,              // integer|null
        "available_teams": ["ARS", "CHE"],   // array of string, what this bot may still pick
        "used_teams": ["LIV", "MCI"]         // array of string, teams picked in earlier rounds
      }
    ]
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
"VALIDATION_ERROR"          - competition_id given but not a number
"COMPETITION_NOT_FOUND"     - No competition with that id
"COMPETITION_NOT_ELIGIBLE"  - That competition's organiser may not use bots
"UNAUTHORIZED"              - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"             - Admin session has expired
"SERVER_ERROR"              - Database error or unexpected server failure
=======================================================================================================================================
Data Notes:
- available_teams is read from allowed_teams, the same table get-allowed-teams.js serves the
  player pick screen from. A bot whose set is empty is rebuilt on the way past, which is what
  get-allowed-teams.js does for a real player - see services/allowedTeams.js.
- used_teams is the second half of the same picture, counted from pick. set-pick.js checks both
  on a human (TEAM_NOT_ALLOWED and TEAM_ALREADY_PICKED), so the screen shows both.
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const {
  BOT_ORGANISER_IDS,
  BOT_EMAIL_LIKE,
  loadBotCompetition,
  loadAllowedTeams
} = require('../../services/botPool');
const router = express.Router();

router.get('/', verifyAdminToken, async (req, res) => {
  logApiCall('get-bots');

  try {
    const rawCompetitionId = req.query.competition_id;
    let competitionId = null;

    if (rawCompetitionId !== undefined && rawCompetitionId !== '') {
      competitionId = parseInt(rawCompetitionId, 10);
      if (!Number.isInteger(competitionId)) {
        return res.json({
          return_code: 'VALIDATION_ERROR',
          message: 'competition_id must be a number'
        });
      }
    }

    // The pool, with a usage count so it is obvious which bots are already busy.
    const botsResult = await query(`
      SELECT
        u.id,
        u.display_name,
        u.email,
        COUNT(cu.id)::int AS competitions
      FROM app_user u
      LEFT JOIN competition_user cu ON cu.user_id = u.id
      WHERE u.email LIKE $1
      GROUP BY u.id, u.display_name, u.email
      ORDER BY u.display_name
    `, [BOT_EMAIL_LIKE]);

    /*
    Eligible competitions, each with its latest round. can_add_bots mirrors the join rule in
    add-bots-to-competition so the screen can disable the button with a reason rather than
    letting the admin discover the refusal after clicking.
    */
    const competitionsResult = await query(`
      SELECT
        c.id,
        c.name,
        c.status,
        COUNT(DISTINCT cu.id)::int AS player_count,
        COUNT(DISTINCT CASE WHEN u.email LIKE $2 THEN cu.id END)::int AS bot_count,
        r.round_number,
        r.lock_time,
        CASE WHEN r.lock_time IS NOT NULL AND NOW() >= r.lock_time THEN true ELSE false END AS is_locked
      FROM competition c
      LEFT JOIN competition_user cu ON cu.competition_id = c.id
      LEFT JOIN app_user u ON u.id = cu.user_id
      LEFT JOIN LATERAL (
        SELECT round_number, lock_time
        FROM round
        WHERE competition_id = c.id
        ORDER BY round_number DESC
        LIMIT 1
      ) r ON true
      WHERE c.organiser_id = ANY($1)
      GROUP BY c.id, c.name, c.status, r.round_number, r.lock_time
      ORDER BY c.name
    `, [BOT_ORGANISER_IDS, BOT_EMAIL_LIKE]);

    const competitions = competitionsResult.rows.map((row) => {
      const started = (row.round_number !== null && row.round_number > 1) || row.is_locked;
      return {
        ...row,
        can_add_bots: !started,
        closed_reason: started ? 'STARTED' : null
      };
    });

    let detail = null;

    if (competitionId !== null) {
      // Throws COMPETITION_NOT_FOUND / COMPETITION_NOT_ELIGIBLE, caught below.
      const competition = await loadBotCompetition(competitionId);

      const roundResult = await query(`
        SELECT
          id AS round_id,
          round_number,
          lock_time,
          CASE WHEN lock_time IS NOT NULL AND NOW() >= lock_time THEN true ELSE false END AS is_locked
        FROM round
        WHERE competition_id = $1
        ORDER BY round_number DESC
        LIMIT 1
      `, [competitionId]);

      const round = roundResult.rows[0] || null;

      let fixtures = [];
      if (round) {
        const fixturesResult = await query(`
          SELECT
            id AS fixture_id,
            home_team_short,
            away_team_short,
            home_team,
            away_team,
            kickoff_time
          FROM fixture
          WHERE round_id = $1
          ORDER BY kickoff_time ASC, id ASC
        `, [round.round_id]);

        fixtures = fixturesResult.rows.map((f) => ({
          fixture_id: f.fixture_id,
          home_team_short: f.home_team_short,
          away_team_short: f.away_team_short,
          home_team_name: f.home_team,
          away_team_name: f.away_team,
          kickoff_time: f.kickoff_time
        }));
      }

      /*
      One query for the members: their membership, this round's pick, and every team they have
      picked before. The array_agg is filtered to earlier rounds so the current pick does not
      appear as something the bot has already used - it can still be changed to anything else.
      */
      const membersResult = await query(`
        SELECT
          cu.user_id,
          u.display_name,
          cu.status,
          cu.lives_remaining,
          current_pick.team AS pick_team,
          current_pick.fixture_id AS pick_fixture_id,
          COALESCE(
            ARRAY(
              SELECT DISTINCT p.team
              FROM pick p
              INNER JOIN round r ON r.id = p.round_id
              WHERE r.competition_id = cu.competition_id
                AND p.user_id = cu.user_id
                AND p.team IS NOT NULL
                AND ($2::int IS NULL OR p.round_id <> $2)
            ),
            ARRAY[]::varchar[]
          ) AS used_teams
        FROM competition_user cu
        INNER JOIN app_user u ON u.id = cu.user_id
        LEFT JOIN pick current_pick
          ON current_pick.user_id = cu.user_id
          AND current_pick.round_id = $2
        WHERE cu.competition_id = $1
          AND u.email LIKE $3
        ORDER BY u.display_name
      `, [competitionId, round ? round.round_id : null, BOT_EMAIL_LIKE]);

      /*
      What each bot may still pick, from allowed_teams - the table the player pick screen reads
      and the table set-pick.js validates against. Bots sitting on an empty set are rebuilt
      here, which is the healing a real player gets by opening that screen.
      */
      const allowed = await loadAllowedTeams(
        competitionId,
        competition.team_list_id,
        membersResult.rows.map((m) => m.user_id)
      );

      detail = {
        competition_id: competitionId,
        no_team_twice: competition.no_team_twice === true,
        round_id: round ? round.round_id : null,
        round_number: round ? round.round_number : null,
        lock_time: round ? round.lock_time : null,
        is_locked: round ? round.is_locked : false,
        fixtures,
        members: membersResult.rows.map((m) => ({
          ...m,
          available_teams: [...(allowed.get(m.user_id) || new Set())]
        }))
      };
    }

    return res.json({
      return_code: 'SUCCESS',
      bots: botsResult.rows,
      competitions,
      detail
    });

  } catch (error) {
    if (error.return_code) {
      return res.json({
        return_code: error.return_code,
        message: error.message
      });
    }

    console.error('get-bots error:', {
      error: error.message,
      stack: error.stack?.substring(0, 500),
      competition_id: req.query?.competition_id
    });

    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Failed to load bots'
    });
  }
});

module.exports = router;
