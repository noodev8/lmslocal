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
    "archived": 7                           // integer, archived by an admin - see set-competition-archived
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
  "places": {
    "limit": 20,                            // integer, FREE_PLAYER_LIMIT - free places per ORGANISER
    "total": 384,                           // integer, chargeable places held (memberships + re-buys)
    "free": 233,                            // integer, of those, covered by a free allowance
    "billable": 151                         // integer, of those, past somebody's free limit
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
- An ARCHIVED competition is counted once, as archived, and never also as active or setup - which
  is what makes these agree with the Competitions screen. They previously did not: 16 active here
  against 14 there. total = active + setup + complete + archived.
  Archived is competition.archived_at, an admin's decision. Until 2026-09-04 it was a derived
  "stalled" rule that had to be evaluated in JS, which forced this route to fetch and classify
  every competition before it could ask its real question; that round trip is gone.
- "organisers.live" counts organisers holding a competition that is ACTIVE or PENDING and not
  archived - the same set of competitions "users.active" counts people in, so the organisers card
  and the players card on the Competitions screen describe the same live platform. It is what the
  Organisers screen lists (see get-admin-organisers), so the card and that screen agree.

  "total" is cumulative and can only rise; "live" can fall, which is the point of it.
- "places" is the paid share the Competitions screen shows, as billable/total. The PLACE is the
  unit we sell, which is what makes it a fair headline: players never pay us, and an organiser
  under the free limit is not a failed sale but a free user behaving as designed. Counting either
  of those as a conversion rate flatters or damns the platform for something nobody was asked to
  do. It also falls as well as rises - a large free competition lowers it, correctly, being real
  load earning nothing.

  It counts places CONSUMED past a free allowance, NOT credits bought. The two are far apart
  (370 bought against 151 consumed at the time of writing) because organisers buy in packs and
  sit on the balance. Billable is the demand figure; credit_purchases is the revenue figure.
  Do not present one as the other.

  Registered accounts in no competition hold no place and are in neither half - correctly, since
  no allowance is consumed and nobody is charged for them. The gap between users.total and
  users.active is where they show up.
- "inactive" (running, no picks for 30 days) was removed. "archived" answers the same question
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
  that is neither complete nor archived. Eliminated players count - they are real people in a
  competition that is still running.
- "active" and "players_in_live_competition" are close but not the same and will not match. The
  older figure counts SETUP or ACTIVE by status alone, so it includes archived competitions;
  "active" excludes them. Prefer "active" - the dashboard reads it, and the difference between
  the two is exactly the players in archived competitions.
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
const { getPlatformPlaceTotals } = require('../../services/placeUsage');
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
archived. Being eliminated still counts. Somebody knocked out in round 3 of a competition that is
still running is a real player who turned up, and the moment they stop counting is the moment the
competition ends, not the moment they lose.

This replaced a "genuine registered person" rule that asked what someone had EVER done - joined,
organised, or been seen in 30 days. Two problems with that: it counted people who did something
once and vanished (70 of 346 had not been seen in a month), and being cumulative it could only
ever rise, so it could not tell growth from churn. Active can fall, which is the point of it.

Which competitions are live is settled in the first query above, from competition.archived_at and
status, and this query counts memberships against the ids that survive. It used to need a whole
extra round trip to work that out - see the note on liveQuery.

Guests are excluded, so "active" and "total" describe the same population - registered accounts -
and one is a true subset of the other. Guests in a live competition are real people and are
reported separately as active_guests rather than dropped.
*/

router.get('/', verifyAdminToken, async (req, res) => {
  logApiCall('get-admin-stats');

  try {
    /*
    Which competitions are live, and the counts by status.

    ONE QUERY, and it can be one query because "archived" is a column. Until 2026-09-04 this was a
    first round trip: the rule was derived - no real players or no picks, quiet 7 days - and could
    only be evaluated in JS, so this route pulled every competition with three correlated
    subselects attached, classified the rows in Node, and only then asked what it wanted to know.
    Two other admin routes did the same dance for the same reason. Archiving by hand removes it.

    Two lists come out and they are not the same thing: "live" (ACTIVE or PENDING, not archived)
    is what the people cards count members of, while the status breakdown covers everything not
    archived, finished competitions included.
    */
    const liveQuery = `
      SELECT
        c.id,
        c.organiser_id,
        LOWER(c.status)                          AS status,
        (c.archived_at IS NOT NULL)              AS is_archived,
        -- Whether this competition's owner counts as an organiser at all. Resolved here so the
        -- live count can be taken from these rows rather than counted a second time in SQL.
        (ou.id IS NOT NULL AND ou.email <> ALL($1::text[]))
                                                 AS organiser_countable
      FROM competition c
      LEFT JOIN app_user ou ON ou.id = c.organiser_id
      WHERE c.id <> ALL($2::int[])
    `;
    const liveResult = await query(liveQuery, [
      EXCLUDED_EMAILS,
      EXCLUDED_COMPETITION_IDS
    ]);

    const classified = liveResult.rows;

    // Complete competitions are excluded outright: their players finished, they did not drift.
    const liveCompetitions = classified.filter((c) => c.status !== 'complete' && !c.is_archived);
    const liveCompetitionIds = liveCompetitions.map((c) => c.id);

    /*
    Organisers with something live. Taken from the rows above rather than counted again in SQL, so
    the number on the Competitions screen's organisers card is the number of rows the Organisers
    screen lists.
    */
    const liveOrganiserIds = new Set(
      liveCompetitions
        .filter((c) => c.organiser_countable && c.organiser_id !== null)
        .map((c) => c.organiser_id)
    );

    /*
    The same breakdown the Competitions screen shows - an archived competition is counted once, as
    archived, and never also as active or setup. Counting by status alone is what made this screen
    say 16 active where that one said 14.

    "setup" keeps its stored name here; the screens label it "Pending".
    */
    const competitionCounts = {
      total: classified.length,
      active: classified.filter((c) => !c.is_archived && c.status === 'active').length,
      setup: classified.filter((c) => !c.is_archived && c.status === 'setup').length,
      complete: classified.filter((c) => !c.is_archived && c.status === 'complete').length,
      archived: classified.filter((c) => c.is_archived).length
    };

    // One round trip. These are small aggregates over small tables, so a single query with
    // scalar subselects beats four sequential ones.
    const statsQuery = `
      SELECT
        -- Competition counts are NOT here - see competitionCounts above, taken from the same
        -- rows as the live list so that "active" means the same thing on this screen as it does
        -- on the Competitions screen.

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
        -- of those competitions, settled by the first query above.
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

    /*
    Places, from services/placeUsage.js - the same arithmetic the join gate runs for one
    organiser, summed. Deliberately not written here: see the header of getPlatformPlaceTotals.
    */
    const places = await getPlatformPlaceTotals({
      excludedCompetitionIds: EXCLUDED_COMPETITION_IDS,
      excludedEmails: EXCLUDED_EMAILS
    });
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
      places,
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
