/*
=======================================================================================================================================
API Route: get-admin-stats
=======================================================================================================================================
Method: GET
Purpose: Platform-wide counts for the lmslocal-admin dashboard. Aggregates across every
         competition regardless of who organises it.

         This is deliberately a separate route rather than a privileged mode of
         /get-user-dashboard. That route is scoped to "competitions this user belongs to",
         and adding an admin bypass to it would put a hole in the security model the player
         app depends on. Admin reads get their own queries.
=======================================================================================================================================
Request Payload:
  None. Authentication is by admin token in the Authorization header.

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "competitions": {
    "total": 29,                            // integer, all competitions ever created
    "setup": 4,                             // integer, created but not started (labelled "Pending")
    "active": 14,                           // integer, currently running
    "complete": 4,                          // integer, finished
    "stalled": 7                            // integer, tyre kickers - see services/competitionEngagement.js
  },
  "organisers": {
    "total": 10,                            // integer, accounts owning at least one competition
    "live": 6,                              // integer, of those, owning one that is active or pending
    "paying": 2,                            // integer, of those, who have ever paid (credit_purchases)
    "with_active_competition": 4            // integer, of those, running something right now
  },
  "players": {
    "total_memberships": 180,               // integer, rows in competition_user (a person in 2 comps counts twice)
    "unique_players": 140,                  // integer, distinct people who have ever joined a competition
    "players_in_live_competition": 115,     // integer, of those, in a SETUP or ACTIVE competition
    "still_in": 95,                         // integer, memberships not yet eliminated
    "eliminated": 85                        // integer, memberships knocked out
  },
  "users": {
    "total": 242,                           // integer, REGISTERED accounts (guests not included)
    "new_last_30_days": 66,                 // integer, registered accounts created in last 30 days
    "guests": 5,                            // integer, joined without registering
    "active": 242,                          // integer, of "total", in a competition that is live right now
    "active_guests": 15                     // integer, guests in a live competition (NOT part of "total")
  },
  "generated_at": "2026-08-02T14:00:00.000Z" // string, ISO datetime this snapshot was taken
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"UNAUTHORIZED"              - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"             - Admin session has expired
"SERVER_ERROR"              - Database error or unexpected server failure
=======================================================================================================================================
Data Notes:
- competition.status is uppercase ('SETUP', 'ACTIVE', 'COMPLETE'). It used to be mixed; the data
  was normalised on 2026-08-04. Every comparison here still lowercases the column first, which is
  now belt-and-braces rather than load-bearing.
- The competition counts come from classifyCompetition, NOT from counting statuses in SQL. A
  stalled competition is counted once, as stalled, and never also as active or setup - which is
  what makes these agree with the Competitions screen. They previously did not: 16 active here
  against 14 there. total = active + setup + complete + stalled.
- "organisers.live" counts organisers holding a competition that is ACTIVE or PENDING and not
  stalled - the same set of competitions "users.active" counts people in, so the organisers card
  and the players card on the Competitions screen describe the same live platform. It is what the
  Organisers screen lists (see get-admin-organisers), so the card and that screen agree.

  "total" is cumulative and can only rise; "live" can fall, which is the point of it.
- "inactive" (running, no picks for 30 days) was removed. "stalled" answers the same question
  better and having both invited the two to be compared.
- Every figure here counts the REAL platform, not us. Excluded: competition 117 ("App Store",
  ours), the accounts brookfieldcomfort@gmail.com and lmslocal8@gmail.com, and bots (email
  'bot_%@lms-guest.com'). The exclusions are the reason "competitions" agrees with the
  /competitions screen, which hides the same competition client-side.
- "unique_players" is every person who has ever joined anything, so it only ever grows;
  "players_in_live_competition" is the subset with a competition still to play. The gap is people
  whose competitions have all finished. The two are reported separately because the first was
  being read as an audience figure when most of it was the back catalogue - one completed
  competition of 52 sat inside it for months.
- "active" is a strict subset of "total": registered people holding a membership in a competition
  that is neither complete nor stalled. Eliminated players count - they are real people in a
  competition that is still running. Which competitions those are comes from
  services/competitionEngagement.js via a first round trip, NOT from a second copy of the stalled
  rule written in SQL.
- "active" and "players_in_live_competition" are close but not the same and will not match. The
  older figure counts SETUP or ACTIVE by status alone, so it includes stalled competitions;
  "active" excludes them. Prefer "active" - the dashboard reads it, and the difference between
  the two is exactly the stalled players.
- Guests (non-bot '%@lms-guest.com') are counted as PLAYERS but not as ACCOUNTS, and are
  reported on their own as users.guests. A guest is a real person, so they belong in
  participation; but the account is created by joining and is tied to that one competition, so
  counting it as a signup would make "new in 30 days" move with competitions being created and
  dropped rather than with users actually gained.
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const {
  realPlayerCountSql,
  pickCountSql,
  classifyCompetition
} = require('../../services/competitionEngagement');
const router = express.Router();

// Competition 117 ("App Store") is ours, created for the store listing screenshots. The
// competitions screen hides it (HIDDEN_COMPETITION_IDS there), so the dashboard has to hide it
// too or the two screens disagree on how many competitions exist.
const EXCLUDED_COMPETITION_IDS = [117];

// Our own accounts. They join competitions to test them, which inflates every player figure.
// Keyed by email rather than id so a recreated account stays excluded.
const EXCLUDED_EMAILS = ['brookfieldcomfort@gmail.com', 'lmslocal8@gmail.com'];

// Bots have no is_bot column - the email pattern is the definition. Kept in step with
// BOT_EMAIL_LIKE in services/botPool.js.
const BOT_EMAIL_LIKE = 'bot_%@lms-guest.com';

// A guest joined a competition without registering. Same domain as bots, so this only means
// "guest" once the bot pattern has already been ruled out.
const GUEST_EMAIL_LIKE = '%@lms-guest.com';

// Reusable predicates. REAL_USER keeps guests in - for PARTICIPATION figures a guest is a real
// person and belongs in the count. The account figures below then split them back out, because
// there "accounts" reads as signups and a guest never signed up.
const REAL_USER = `(u.email NOT LIKE '${BOT_EMAIL_LIKE}' AND u.email <> ALL($1::text[]))`;
const IS_GUEST = `u.email LIKE '${GUEST_EMAIL_LIKE}'`;
const REAL_COMP = `cu.competition_id <> ALL($2::int[])`;

/*
ACTIVE PEOPLE - the count this screen exists for.

Active = holds a membership in a competition that is LIVE right now: not complete, and not
stalled. Being eliminated still counts. Somebody knocked out in round 3 of a competition that is
still running is a real player who turned up, and the moment they stop counting is the moment the
competition ends, not the moment they lose.

This replaced a "genuine registered person" rule that asked what someone had EVER done - joined,
organised, or been seen in 30 days. Two problems with that: it counted people who did something
once and vanished (70 of 346 had not been seen in a month), and being cumulative it could only
ever rise, so it could not tell growth from churn. Active can fall, which is the point of it.

Which competitions are live is NOT decided here. The stalled rule lives in
services/competitionEngagement.js and this route runs classifyCompetition over the same facts the
admin Competitions screen uses, in a first round trip, then counts memberships against the ids
that survive. A second implementation in SQL would drift from the screen within a month - the
whole table is a few dozen rows, so the extra query is the cheap way to stay honest.

Guests are excluded, so "active" and "total" describe the same population - registered accounts -
and one is a true subset of the other. Guests in a live competition are real people and are
reported separately as active_guests rather than dropped.
*/

router.get('/', verifyAdminToken, async (req, res) => {
  logApiCall('get-admin-stats');

  try {
    /*
    First round trip: which competitions are live. Classified in JS by the shared rule rather
    than re-expressed in SQL, so this screen and the Competitions screen can never disagree
    about what "stalled" means.
    */
    const liveQuery = `
      SELECT
        c.id,
        c.organiser_id,
        LOWER(c.status)                          AS status,
        c.stalled_override,
        -- Whether this competition's owner counts as an organiser at all. Same email exclusion
        -- the organiser figures below use, resolved here so the live count can be taken from the
        -- classified rows rather than from a second copy of the stalled rule in SQL.
        (ou.id IS NOT NULL AND ou.email <> ALL($3::text[]))
                                                 AS organiser_countable,
        ${realPlayerCountSql('c', '$1')}         AS real_player_count,
        ${pickCountSql('c')}                     AS pick_count,
        GREATEST(
          (SELECT MAX(p.created_at) FROM pick p
             JOIN round r ON r.id = p.round_id WHERE r.competition_id = c.id),
          (SELECT MAX(cu.joined_at) FROM competition_user cu WHERE cu.competition_id = c.id),
          (SELECT MAX(r.created_at) FROM round r WHERE r.competition_id = c.id),
          c.created_at
        )                                        AS last_activity
      FROM competition c
      LEFT JOIN app_user ou ON ou.id = c.organiser_id
      WHERE c.id <> ALL($2::int[])
    `;
    const liveResult = await query(liveQuery, [
      BOT_EMAIL_LIKE,
      EXCLUDED_COMPETITION_IDS,
      EXCLUDED_EMAILS
    ]);

    const classified = liveResult.rows.map((c) => ({
      ...c,
      is_stalled: classifyCompetition(c).is_stalled
    }));

    // Complete competitions are excluded outright: their players finished, they did not drift.
    const liveCompetitions = classified.filter((c) => c.status !== 'complete' && !c.is_stalled);
    const liveCompetitionIds = liveCompetitions.map((c) => c.id);

    /*
    Organisers with something live. Taken from the rows already classified above rather than
    counted in SQL, for the same reason the competition counts are: one stalled rule, so the
    number on the Competitions screen's organisers card is the number of rows the Organisers
    screen lists.
    */
    const liveOrganiserIds = new Set(
      liveCompetitions
        .filter((c) => c.organiser_countable && c.organiser_id !== null)
        .map((c) => c.organiser_id)
    );

    /*
    The same breakdown the Competitions screen shows, from the same classification - a stalled
    competition is counted once, as stalled, and never also as active or setup. Counting by
    status alone is what made this screen say 16 active where that one said 14.

    "setup" keeps its stored name here; the screens label it "Pending".
    */
    const competitionCounts = {
      total: classified.length,
      active: classified.filter((c) => !c.is_stalled && c.status === 'active').length,
      setup: classified.filter((c) => !c.is_stalled && c.status === 'setup').length,
      complete: classified.filter((c) => !c.is_stalled && c.status === 'complete').length,
      stalled: classified.filter((c) => c.is_stalled).length
    };

    // One round trip. These are small aggregates over small tables, so a single query with
    // scalar subselects beats four sequential ones.
    const statsQuery = `
      SELECT
        -- Competition counts are NOT here - see competitionCounts above. They come from the
        -- classified rows so that "active" means the same thing on this screen as it does on
        -- the Competitions screen.

        -- Organisers. "Organiser" means owning a competition, matching get-admin-organisers -
        -- helping run someone else's does not count. "Paying" is a real purchase, never
        -- paid_credit, which can be granted without money changing hands.
        (SELECT COUNT(DISTINCT c.organiser_id)
           FROM competition c
           JOIN app_user u ON u.id = c.organiser_id
          WHERE c.id <> ALL($2::int[])
            AND u.email <> ALL($1::text[]))                                   AS organisers_total,
        (SELECT COUNT(DISTINCT c.organiser_id)
           FROM competition c
           JOIN app_user u ON u.id = c.organiser_id
          WHERE c.id <> ALL($2::int[])
            AND u.email <> ALL($1::text[])
            AND EXISTS (SELECT 1 FROM credit_purchases cp
                         WHERE cp.user_id = c.organiser_id
                           AND cp.paid_amount > 0))                           AS organisers_paying,
        (SELECT COUNT(DISTINCT c.organiser_id)
           FROM competition c
           JOIN app_user u ON u.id = c.organiser_id
          WHERE c.id <> ALL($2::int[])
            AND u.email <> ALL($1::text[])
            AND LOWER(c.status) = 'active')                                   AS organisers_with_active,

        -- Player participation. Bots and our own accounts are excluded everywhere; guests are
        -- not, because a guest is a real person who joined without registering.
        (SELECT COUNT(*)
           FROM competition_user cu JOIN app_user u ON u.id = cu.user_id
          WHERE ${REAL_USER} AND ${REAL_COMP})                                    AS memberships_total,
        (SELECT COUNT(DISTINCT cu.user_id)
           FROM competition_user cu JOIN app_user u ON u.id = cu.user_id
          WHERE ${REAL_USER} AND ${REAL_COMP})                                    AS players_unique,
        -- The same people, minus anyone whose every competition has finished. A person in a
        -- finished competition AND a running one counts here, because they still have
        -- something to come back to.
        (SELECT COUNT(DISTINCT cu.user_id)
           FROM competition_user cu
           JOIN app_user u ON u.id = cu.user_id
           JOIN competition c ON c.id = cu.competition_id
          WHERE ${REAL_USER} AND ${REAL_COMP}
            AND LOWER(c.status) IN ('setup', 'active'))                           AS players_live,
        (SELECT COUNT(*)
           FROM competition_user cu JOIN app_user u ON u.id = cu.user_id
          WHERE ${REAL_USER} AND ${REAL_COMP} AND LOWER(cu.status) = 'active')    AS memberships_active,
        (SELECT COUNT(*)
           FROM competition_user cu JOIN app_user u ON u.id = cu.user_id
          WHERE ${REAL_USER} AND ${REAL_COMP} AND LOWER(cu.status) = 'out')       AS memberships_out,

        -- Account totals: REGISTERED accounts only. Guests are counted separately below rather
        -- than folded in here, because a guest account lives and dies with the competition it
        -- was created for - counting them as signups would make growth rise and fall with
        -- competitions being dropped, which is not a fair reading of users gained.
        (SELECT COUNT(*) FROM app_user u
          WHERE ${REAL_USER} AND NOT ${IS_GUEST})                                 AS users_total,
        (SELECT COUNT(*) FROM app_user u
          WHERE ${REAL_USER} AND NOT ${IS_GUEST}
            AND u.created_at > NOW() - INTERVAL '30 days')                        AS users_new,
        (SELECT COUNT(*) FROM app_user u
          WHERE ${REAL_USER} AND ${IS_GUEST})                                     AS users_guests,

        -- People holding a membership in a competition that is live right now. $3 is the list
        -- of those competitions, settled in JS above by the one stalled rule.
        (SELECT COUNT(DISTINCT cu.user_id)
           FROM competition_user cu
           JOIN app_user u ON u.id = cu.user_id
          WHERE cu.competition_id = ANY($3::int[])
            AND ${REAL_USER} AND NOT ${IS_GUEST})                                 AS users_active,
        (SELECT COUNT(DISTINCT cu.user_id)
           FROM competition_user cu
           JOIN app_user u ON u.id = cu.user_id
          WHERE cu.competition_id = ANY($3::int[])
            AND ${REAL_USER} AND ${IS_GUEST})                                     AS users_active_guests
    `;

    const result = await query(statsQuery, [
      EXCLUDED_EMAILS,
      EXCLUDED_COMPETITION_IDS,
      liveCompetitionIds
    ]);
    const row = result.rows[0];

    // COUNT() comes back as a string from node-postgres (bigint), so coerce for the client
    const n = (value) => parseInt(value, 10) || 0;

    return res.json({
      return_code: 'SUCCESS',
      competitions: competitionCounts,
      organisers: {
        total: n(row.organisers_total),
        live: liveOrganiserIds.size,
        paying: n(row.organisers_paying),
        with_active_competition: n(row.organisers_with_active)
      },
      players: {
        total_memberships: n(row.memberships_total),
        unique_players: n(row.players_unique),
        players_in_live_competition: n(row.players_live),
        still_in: n(row.memberships_active),
        eliminated: n(row.memberships_out)
      },
      users: {
        total: n(row.users_total),
        new_last_30_days: n(row.users_new),
        guests: n(row.users_guests),
        active: n(row.users_active),
        active_guests: n(row.users_active_guests)
      },
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('get-admin-stats error:', error.message);
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not load dashboard statistics'
    });
  }
});

module.exports = router;
