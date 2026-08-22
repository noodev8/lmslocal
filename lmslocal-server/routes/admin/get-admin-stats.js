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
    "total": 33,                            // integer, all competitions ever created
    "setup": 25,                            // integer, created but not started
    "active": 4,                            // integer, currently running
    "complete": 4,                          // integer, finished
    "inactive": 12                          // integer, no player activity in the last 30 days
  },
  "organisers": {
    "total": 10,                            // integer, accounts owning at least one competition
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
    "genuine": 343,                         // integer, of "total", who joined, organise, or were seen in 30 days
    "wasters": 78,                          // integer, of "total", the remainder - signups that went nowhere
    "returned": 8,                          // integer, never joined anything but came back after signing up
    "signup_only": 19                       // integer, never joined anything and not seen since signing up
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
- "inactive" means no pick has been made in any of the competition's rounds for 30 days. It
  counts only competitions that are supposed to be running, so a SETUP or COMPLETE competition
  is never reported as inactive.
- Every figure here counts the REAL platform, not us. Excluded: competition 117 ("App Store",
  ours), the accounts brookfieldcomfort@gmail.com and lmslocal8@gmail.com, and bots (email
  'bot_%@lms-guest.com'). The exclusions are the reason "competitions" agrees with the
  /competitions screen, which hides the same competition client-side.
- "unique_players" is every person who has ever joined anything, so it only ever grows;
  "players_in_live_competition" is the subset with a competition still to play. The gap is people
  whose competitions have all finished. The two are reported separately because the first was
  being read as an audience figure when most of it was the back catalogue - one completed
  competition of 52 sat inside it for months.
- "genuine" and "wasters" split users.total in two and always sum back to it. The rule is defined
  once, above the query - joined, organises, or seen in the last 30 days. It exists because a
  quarter of "Registered" had never touched anything, which made the headline useless for the one
  question it is asked.
- "returned" and "signup_only" split the accounts that are genuine on the seen-recently clause
  ALONE - they joined nothing and organise nothing. They are reported apart because they are not
  the same people: 19 of those 27 had never come back at all, their last_active_at being the
  registration itself, so calling the group "coming back" would have been untrue of most of it.
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
const router = express.Router();

// A competition running with no picks for this long is considered to have gone quiet
const INACTIVE_AFTER_DAYS = 30;

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
const REAL_USER = `(u.email NOT LIKE '${BOT_EMAIL_LIKE}' AND u.email <> ALL($2::text[]))`;
const IS_GUEST = `u.email LIKE '${GUEST_EMAIL_LIKE}'`;
const REAL_COMP = `cu.competition_id <> ALL($3::int[])`;

/*
Who counts as a GENUINE registered person, as opposed to a signup that went nowhere.

A quarter of "Registered" had never touched anything - 105 of 421 - which made the number useless
for the only question it gets asked: how many real people are on this platform. The rule is the
same shape as the stalled-competition one in services/competitionEngagement.js: did they do the
thing the product is for?

Genuine = joined a competition, OR organises one, OR has been seen in the last
SEEN_RECENTLY_DAYS. The third clause is deliberate and it is the loosest of the three: an account
that keeps coming back without joining anything is a real person still deciding, not a waster.

It also means no "too new to judge" exemption is needed, unlike the competitions rule - somebody
who registered on Tuesday is recently active by definition, so they land in genuine on their own
and drop out later if they never come back.

Joining is enough on its own; making a pick is not required. Somebody who joined a competition
that then stalled answered a real invitation, and never getting a round to pick in was not their
doing.
*/
const SEEN_RECENTLY_DAYS = 30;
const DID_SOMETHING = `(
  u.id IN (SELECT cu2.user_id FROM competition_user cu2 WHERE cu2.competition_id <> ALL($3::int[]))
  OR u.id IN (SELECT c2.organiser_id FROM competition c2
               WHERE c2.organiser_id IS NOT NULL AND c2.id <> ALL($3::int[]))
)`;
const SEEN_RECENTLY = `u.last_active_at > NOW() - INTERVAL '${SEEN_RECENTLY_DAYS} days'`;
const IS_GENUINE = `(${DID_SOMETHING} OR ${SEEN_RECENTLY})`;

/*
Did they ever come back, or is the "activity" just the session they signed up in?

This matters because SEEN_RECENTLY on its own does not mean what it sounds like. Of the 27
accounts that qualified as genuine on that clause alone, 19 had never returned - their
last_active_at was their registration. Reporting all 27 as people who keep coming back would have
been flatly untrue.

The one-hour boundary is middleware/auth.js's, not a guess: it refreshes last_active_at at most
once an hour, so a signup session leaves the two timestamps within an hour of each other and
anything beyond that is a genuinely later visit. Moving the line to five minutes shifts exactly
one account, which is what a clean split looks like.
*/
const CAME_BACK = `u.last_active_at > u.created_at + INTERVAL '1 hour'`;

router.get('/', verifyAdminToken, async (req, res) => {
  logApiCall('get-admin-stats');

  try {
    // One round trip. These are small aggregates over small tables, so a single query with
    // scalar subselects beats four sequential ones.
    const statsQuery = `
      SELECT
        -- Competition counts. LOWER() guards the known status casing inconsistency.
        (SELECT COUNT(*) FROM competition WHERE id <> ALL($3::int[]))             AS comp_total,
        (SELECT COUNT(*) FROM competition
          WHERE id <> ALL($3::int[]) AND LOWER(status) = 'setup')                 AS comp_setup,
        (SELECT COUNT(*) FROM competition
          WHERE id <> ALL($3::int[]) AND LOWER(status) = 'active')                AS comp_active,
        (SELECT COUNT(*) FROM competition
          WHERE id <> ALL($3::int[]) AND LOWER(status) = 'complete')              AS comp_complete,

        -- Running competitions whose most recent pick is older than the cutoff, plus those
        -- that are running but have never had a pick at all.
        (SELECT COUNT(*)
           FROM competition c
          WHERE LOWER(c.status) = 'active'
            AND c.id <> ALL($3::int[])
            AND COALESCE(
                  (SELECT MAX(p.created_at)
                     FROM pick p
                     JOIN round r ON r.id = p.round_id
                    WHERE r.competition_id = c.id),
                  c.created_at
                ) < NOW() - ($1 || ' days')::interval
        )                                                                         AS comp_inactive,

        -- Organisers. "Organiser" means owning a competition, matching get-admin-organisers -
        -- helping run someone else's does not count. "Paying" is a real purchase, never
        -- paid_credit, which can be granted without money changing hands.
        (SELECT COUNT(DISTINCT c.organiser_id)
           FROM competition c
           JOIN app_user u ON u.id = c.organiser_id
          WHERE c.id <> ALL($3::int[])
            AND u.email <> ALL($2::text[]))                                   AS organisers_total,
        (SELECT COUNT(DISTINCT c.organiser_id)
           FROM competition c
           JOIN app_user u ON u.id = c.organiser_id
          WHERE c.id <> ALL($3::int[])
            AND u.email <> ALL($2::text[])
            AND EXISTS (SELECT 1 FROM credit_purchases cp
                         WHERE cp.user_id = c.organiser_id
                           AND cp.paid_amount > 0))                           AS organisers_paying,
        (SELECT COUNT(DISTINCT c.organiser_id)
           FROM competition c
           JOIN app_user u ON u.id = c.organiser_id
          WHERE c.id <> ALL($3::int[])
            AND u.email <> ALL($2::text[])
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

        -- Registered accounts split by whether anything ever came of them. The two add up to
        -- users_total, so the screen can show either half without them disagreeing.
        (SELECT COUNT(*) FROM app_user u
          WHERE ${REAL_USER} AND NOT ${IS_GUEST}
            AND ${IS_GENUINE})                                                    AS users_genuine,
        (SELECT COUNT(*) FROM app_user u
          WHERE ${REAL_USER} AND NOT ${IS_GUEST}
            AND NOT ${IS_GENUINE})                                                AS users_wasters,
        -- The two halves of "genuine on the strength of being seen alone" - registered, never
        -- joined or organised anything. Split because they are different people: one came back
        -- of their own accord and is worth a nudge, the other has not been seen since the form
        -- they filled in. Together they are the whole of that clause.
        (SELECT COUNT(*) FROM app_user u
          WHERE ${REAL_USER} AND NOT ${IS_GUEST}
            AND NOT ${DID_SOMETHING} AND ${SEEN_RECENTLY}
            AND ${CAME_BACK})                                                     AS users_returned,
        (SELECT COUNT(*) FROM app_user u
          WHERE ${REAL_USER} AND NOT ${IS_GUEST}
            AND NOT ${DID_SOMETHING} AND ${SEEN_RECENTLY}
            AND NOT ${CAME_BACK})                                                 AS users_signup_only
    `;

    const result = await query(statsQuery, [
      INACTIVE_AFTER_DAYS,
      EXCLUDED_EMAILS,
      EXCLUDED_COMPETITION_IDS
    ]);
    const row = result.rows[0];

    // COUNT() comes back as a string from node-postgres (bigint), so coerce for the client
    const n = (value) => parseInt(value, 10) || 0;

    return res.json({
      return_code: 'SUCCESS',
      competitions: {
        total: n(row.comp_total),
        setup: n(row.comp_setup),
        active: n(row.comp_active),
        complete: n(row.comp_complete),
        inactive: n(row.comp_inactive)
      },
      organisers: {
        total: n(row.organisers_total),
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
        genuine: n(row.users_genuine),
        wasters: n(row.users_wasters),
        returned: n(row.users_returned),
        signup_only: n(row.users_signup_only)
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
