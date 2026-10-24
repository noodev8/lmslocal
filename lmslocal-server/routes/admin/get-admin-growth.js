/*
=======================================================================================================================================
API Route: get-admin-growth
=======================================================================================================================================
Method: GET
Purpose: The figures behind the platform rather than the ones on it - the organiser funnel, the
         signup funnel and paid places, for the lmslocal-admin Growth screen.

         SEPARATE FROM get-admin-stats ON PURPOSE, and the separation is a rule, not a filing
         decision. The admin Overview screen was deleted because its counts duplicated the
         Competitions screen and disagreed with it: two implementations of the same question,
         one of them wrong (16 active against 14). Nothing here restates a headline from that
         screen. The funnel deliberately STOPS at "ever took part" and does not carry the live
         player count, which is the Competitions screen's own card and stays there.

         Where the two screens do touch - places - this route calls the same
         services/placeUsage.js function get-admin-stats calls. One implementation, so they
         cannot drift even if a figure appears twice.
=======================================================================================================================================
Request Payload:
  None. Authentication is by admin token in the Authorization header.

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "signups": {
    "registered": 432,                      // integer, registered accounts (guests excluded)
    "took_part": 326,                       // integer, of those, who ever joined or ran a competition
    "never": 106,                           // integer, of those, who never did either
    "never_over_90_days": 65,               // integer, of "never", signed up over 90 days ago
    "new_last_30_days": 228,                // integer, registered in the last 30 days
    "new_last_7_days": 2                    // integer, registered in the last 7 days
  },
  "organisers": {
    "growing_at": 10,                       // integer, players that make an organiser "growing"
    "winner_above": 20,                     // integer, FREE_PLAYER_LIMIT - a winner ran a bigger competition
    "funnel": {
      "created": 59,                        // integer, ever created a competition (deleted ones included)
      "ran": 27,                            // integer, of those, one with picks and 2+ real players
      "growing": 12,                        // integer, of those, reached growing_at real players
      "winners": 5,                         // integer, of those, more than winner_above real players
      "paid": 5                             // integer, of those, ever paid (credit_purchases)
    },
    "by_month": [                           // array, every month from the first to now, by first competition
      { "month": "2026-08", "created": 19, "ran": 15, "growing": 7, "winners": 2, "paid": 2 }
    ],
    "winners": [                            // array, one per winner, most paid first
      {
        "organiser_id": 1003,               // integer
        "display_name": "Sam",              // string
        "best_players": 60,                 // integer, real players in their biggest competition
        "paid": 50,                         // number, pounds, lifetime
        "live": true,                       // boolean, has a SETUP or ACTIVE competition not archived
        "first_month": "2026-06"            // string, YYYY-MM of their first competition
      }
    ]
  },
  "places": {
    "limit": 20,                            // integer, FREE_PLAYER_LIMIT, free places per ORGANISER
    "total": 283,                           // integer, chargeable places held, archived competitions included
    "free": 213,                            // integer, of those, covered by a free allowance
    "billable": 70                          // integer, of those, past somebody's free limit
  },
  "revenue_12mo": 90,                       // number, pounds taken in the trailing 12 months
  "generated_at": "2026-09-03T14:00:00.000Z" // string, ISO datetime this snapshot was taken
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
- The exclusions match get-admin-stats - competition 117 ("App Store", ours), the accounts
  brookfieldcomfort@gmail.com and lmslocal8@gmail.com, and bots. They have to: the two screens
  would otherwise describe different platforms.
- "signups" counts REGISTERED accounts only. A guest account is created by joining and dies with
  its competition, so counting one as a signup would make the funnel move with competitions being
  created and dropped rather than with people gained. Guests therefore cannot appear in "never"
  either - by definition they joined something.
- "took_part" counts joining OR organising. An organiser who runs competitions without playing in
  them has plainly not failed to engage, and counting only memberships put one such account in
  "never".
- "never_over_90_days" is the part that matters. A new signup who has not joined anything is
  mid-flight; one from four months ago is gone, and the two must not be read as the same person.
- "organisers" is the funnel the screen leads with (2026-10-24): which organisers become winners,
  the ones running a competition bigger than the free allowance - every one of whom has paid. A
  signup funnel counts players, and players are not who decides whether this is worth running.
  Size and "ran" come only from competitions that still exist; a deleted competition dates its
  organiser through audit_log but its members are gone. A winner is judged on the biggest single
  competition, not the organiser's total, because that is the group they actually brought.
- "places" INCLUDES archived competitions (2026-10-24 - it used to cut them). Finished
  competitions are archived too, including the winners' biggest, so cutting them hid most of the
  paid places, and the join gate counts them anyway. Not restricted to live-only either - a
  finished competition still consumed the organiser's free 20.
- "revenue_12mo" is credit_purchases.paid_amount, trailing 12 months only - money actually taken,
  not app_user.paid_credit, which is a balance and can be granted. Older purchases are real
  revenue too but are left out of the headline so it reads as current, not lifetime.
- No credit-ledger breakdown (bought vs consumed, granted balances) is reported here. It was
  tried and cut: too much on one screen, and the granted balance in particular was two accounts
  Andreas uses for testing and gifting, not a customer figure worth explaining every time this
  loads.
- No organiser-level paywall figure ("X of Y organisers past the limit have paid") is reported
  either, for the same reason it is gone from services/placeUsage.js: an organiser cannot sit
  past the free limit without paying, since that is exactly what the join gate blocks on. The
  fraction can only ever read 100% and says nothing.
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const { getPlatformPlaceTotals, freePlayerLimit } = require('../../services/placeUsage');
const { chargeableMemberFilter } = require('../../services/botPool');
const router = express.Router();

/*
The rung below a winner. Not derived from the free limit on purpose: it marks the group nearest to
becoming a winner - a second season, or a bigger group - and should not move if pricing does.
*/
const GROWING_PLAYERS = 10;

/**
 * Roll the per-organiser rows into the funnel, the months and the winners list.
 *
 * Each step is a subset of "created" but NOT necessarily of the step before - an organiser can
 * buy credits before they are ever blocked - so the screen measures every step against the top.
 *
 * @param {Array<object>} rows - one per organiser, from the query in the route
 * @param {number} winnerAbove - FREE_PLAYER_LIMIT: a winner ran a competition bigger than this
 * @returns {object} { growing_at, winner_above, funnel, by_month[], winners[] }
 */
function summariseOrganisers(rows, winnerAbove) {
  const empty = () => ({ created: 0, ran: 0, growing: 0, winners: 0, paid: 0 });
  const funnel = empty();
  const months = new Map();
  const winners = [];

  for (const row of rows) {
    const best = parseInt(row.best_players, 10) || 0;
    const paid = Number(row.paid) || 0;
    const steps = {
      created: true,
      ran: row.ran,
      growing: best >= GROWING_PLAYERS,
      winners: best > winnerAbove,
      paid: paid > 0
    };

    if (!months.has(row.first_month)) months.set(row.first_month, empty());
    const month = months.get(row.first_month);
    for (const [key, hit] of Object.entries(steps)) {
      if (hit) {
        funnel[key] += 1;
        month[key] += 1;
      }
    }

    if (steps.winners) {
      winners.push({
        organiser_id: row.organiser_id,
        display_name: row.display_name,
        best_players: best,
        paid,
        live: row.live,
        first_month: row.first_month
      });
    }
  }

  /*
  Every month from the first to now, including empty ones. Winners arrive with the season, and a
  run of empty months is the finding - leaving the gaps out would hide it.
  */
  const by_month = [];
  const keys = [...months.keys()].sort();
  if (keys.length > 0) {
    const now = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' }).slice(0, 7);
    let [y, m] = keys[0].split('-').map(Number);
    for (let key = keys[0]; key <= now; ) {
      by_month.push({ month: key, ...(months.get(key) || empty()) });
      m += 1;
      if (m > 12) { m = 1; y += 1; }
      key = `${y}-${String(m).padStart(2, '0')}`;
    }
  }

  winners.sort((a, b) => b.paid - a.paid || b.best_players - a.best_players);

  return { growing_at: GROWING_PLAYERS, winner_above: winnerAbove, funnel, by_month, winners };
}

// Kept in step with get-admin-stats. See the note there - these are the reason the two screens
// describe the same platform.
const EXCLUDED_COMPETITION_IDS = [117];
const EXCLUDED_EMAILS = ['brookfieldcomfort@gmail.com', 'lmslocal8@gmail.com'];
const GUEST_EMAIL_LIKE = '%@lms-guest.com';

router.get('/', verifyAdminToken, async (req, res) => {
  logApiCall('get-admin-growth');

  try {
    /*
    The funnel. Both are small aggregates over small tables, so scalar subselects beat sequential
    queries.

    "took_part" tests membership OR ownership. EXISTS rather than a join, because a person in
    four competitions must count once - a join here would count them four times and put the
    funnel above its own denominator.

    Revenue is scoped to the trailing 12 months so the headline reads as current, not lifetime.
    */
    const statsQuery = `
      WITH registered AS (
        SELECT
          u.id,
          u.created_at,
          (EXISTS (SELECT 1 FROM competition_user cu
                    WHERE cu.user_id = u.id AND cu.competition_id <> ALL($2::int[]))
           OR EXISTS (SELECT 1 FROM competition c
                       WHERE c.organiser_id = u.id AND c.id <> ALL($2::int[]))) AS took_part
        FROM app_user u
        WHERE u.email NOT LIKE '${GUEST_EMAIL_LIKE}'
          AND u.email <> ALL($1::text[])
      )
      SELECT
        (SELECT COUNT(*) FROM registered)                                     AS registered,
        (SELECT COUNT(*) FROM registered WHERE took_part)                     AS took_part,
        (SELECT COUNT(*) FROM registered WHERE NOT took_part)                 AS never_took_part,
        (SELECT COUNT(*) FROM registered
          WHERE NOT took_part
            AND created_at <= NOW() - INTERVAL '90 days')                     AS never_over_90_days,
        (SELECT COUNT(*) FROM registered
          WHERE created_at > NOW() - INTERVAL '30 days')                      AS new_last_30_days,
        (SELECT COUNT(*) FROM registered
          WHERE created_at > NOW() - INTERVAL '7 days')                       AS new_last_7_days,
        (SELECT COALESCE(SUM(cp.paid_amount), 0)
           FROM credit_purchases cp JOIN app_user u ON u.id = cp.user_id
          WHERE u.email <> ALL($1::text[])
            AND cp.created_at > NOW() - INTERVAL '12 months')                 AS revenue_12mo
    `;

    const result = await query(statsQuery, [EXCLUDED_EMAILS, EXCLUDED_COMPETITION_IDS]);
    const row = result.rows[0];

    /*
    Places from the service, not from a query written here - the same call get-admin-stats makes.

    Archived competitions are COUNTED (2026-10-24). They used to be cut, to keep tyre kickers out,
    but finished competitions are archived too - including the biggest ones the winners ran - so
    cutting them took most of the paid places off the figure meant to show them. The join gate
    counts archived rows as well, so this now agrees with what organisers were actually charged
    against. A tyre kicker's handful of places sits inside their free 20 and adds nothing billable.
    */
    const places = await getPlatformPlaceTotals({
      excludedCompetitionIds: EXCLUDED_COMPETITION_IDS,
      excludedEmails: EXCLUDED_EMAILS
    });

    /*
    The organiser funnel: one row per organiser, rolled up in JS below into the totals, the
    months and the winners list, so the three cannot disagree with each other.

    The start date comes from audit_log as well as from competition, because deleting a finished
    competition to reuse the free places is an allowed route - competition alone would date that
    organiser from their latest competition, not their first. Size and "ran" can only come from
    competitions that still exist: a deleted one's members and picks are gone with it.

    Size counts people, not places - re-buys are billing, and the question here is how big a group
    the organiser brought. Bots are excluded the same way the join gate excludes them.
    */
    const organiserResult = await query(`
      WITH created AS (
        SELECT a.user_id AS organiser_id, a.created_at
          FROM audit_log a
         WHERE a.action = 'Competition Created'
           AND (a.competition_id IS NULL OR a.competition_id <> ALL($2::int[]))
        UNION ALL
        SELECT c.organiser_id, c.created_at
          FROM competition c
         WHERE c.id <> ALL($2::int[])
      ),
      comp AS (
        SELECT
          c.organiser_id,
          COUNT(mem.id) AS players,
          EXISTS (SELECT 1 FROM round r JOIN pick p ON p.round_id = r.id
                   WHERE r.competition_id = c.id) AS ran,
          (c.archived_at IS NULL AND UPPER(c.status) IN ('SETUP', 'ACTIVE')) AS live
        FROM competition c
        LEFT JOIN competition_user cu ON cu.competition_id = c.id
        LEFT JOIN app_user mem        ON mem.id = cu.user_id
                                     AND ${chargeableMemberFilter('mem')}
        WHERE c.id <> ALL($2::int[])
        GROUP BY c.id
      ),
      sized AS (
        SELECT organiser_id,
               -- Two players, not one: the organiser alone, picking against nobody, has not run anything
               bool_or(ran AND players >= 2) AS ran,
               MAX(players)                  AS best_players,
               bool_or(live)                 AS live
          FROM comp
         GROUP BY organiser_id
      ),
      paid AS (
        SELECT user_id, SUM(paid_amount) AS paid
          FROM credit_purchases
         WHERE paid_amount > 0
         GROUP BY user_id
      )
      SELECT
        o.organiser_id,
        u.display_name,
        to_char(MIN(o.created_at) AT TIME ZONE 'Europe/London', 'YYYY-MM') AS first_month,
        COALESCE(BOOL_OR(s.ran), false)        AS ran,
        COALESCE(MAX(s.best_players), 0)       AS best_players,
        COALESCE(BOOL_OR(s.live), false)       AS live,
        COALESCE(MAX(p.paid), 0)               AS paid
      FROM created o
      JOIN app_user u     ON u.id = o.organiser_id
      LEFT JOIN sized s   ON s.organiser_id = o.organiser_id
      LEFT JOIN paid p    ON p.user_id = o.organiser_id
      WHERE u.email <> ALL($1::text[])
      GROUP BY o.organiser_id, u.display_name
    `, [EXCLUDED_EMAILS, EXCLUDED_COMPETITION_IDS]);

    const winnerAbove = freePlayerLimit();
    const organisers = summariseOrganisers(organiserResult.rows, winnerAbove);

    // COUNT() and SUM() come back as strings from node-postgres (bigint/numeric), so coerce.
    const n = (value) => parseInt(value, 10) || 0;

    return res.json({
      return_code: 'SUCCESS',
      signups: {
        registered: n(row.registered),
        took_part: n(row.took_part),
        never: n(row.never_took_part),
        never_over_90_days: n(row.never_over_90_days),
        new_last_30_days: n(row.new_last_30_days),
        new_last_7_days: n(row.new_last_7_days)
      },
      organisers,
      places,
      // Money, so not an integer. Kept as a number of pounds for the client to format.
      revenue_12mo: Number(row.revenue_12mo) || 0,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('get-admin-growth error:', error.message);
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not load growth statistics'
    });
  }
});

module.exports = router;
