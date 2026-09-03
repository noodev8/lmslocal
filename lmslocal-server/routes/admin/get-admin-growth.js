/*
=======================================================================================================================================
API Route: get-admin-growth
=======================================================================================================================================
Method: GET
Purpose: The figures behind the platform rather than the ones on it - the signup funnel and paid
         places, for the lmslocal-admin Growth screen.

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
  "places": {
    "limit": 20,                            // integer, FREE_PLAYER_LIMIT, free places per ORGANISER
    "total": 283,                           // integer, chargeable places held in non-archived competitions
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
- "places" EXCLUDES archived competitions (the admin Competitions screen's label for "stalled" -
  services/competitionEngagement.js). Classified the same way that screen classifies them, in a
  first round trip, so this cannot disagree with what a click on the Archived tile shows. Unlike
  get-admin-stats's "active" figure, this is NOT restricted to live-only (SETUP/ACTIVE) - a
  finished competition still holds its places and still consumed the organiser's free 20 while it
  ran, and dropping COMPLETE would understate that. Only the tyre-kicker rows are cut.
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
const { getPlatformPlaceTotals } = require('../../services/placeUsage');
const {
  realPlayerCountSql,
  pickCountSql,
  lastActivitySql,
  classifyCompetition
} = require('../../services/competitionEngagement');
const router = express.Router();

// Kept in step with get-admin-stats. See the note there - these are the reason the two screens
// describe the same platform.
const EXCLUDED_COMPETITION_IDS = [117];
const EXCLUDED_EMAILS = ['brookfieldcomfort@gmail.com', 'lmslocal8@gmail.com'];
const GUEST_EMAIL_LIKE = '%@lms-guest.com';
const BOT_EMAIL_LIKE = 'bot_%@lms-guest.com';

router.get('/', verifyAdminToken, async (req, res) => {
  logApiCall('get-admin-growth');

  try {
    /*
    First round trip: which competitions are archived. Read from competitionEngagement's own
    inputs and classified in JS by the shared rule, exactly as get-admin-stats does for "stalled" -
    see that route's header for why a second copy in SQL is the thing that made screens disagree.
    */
    const archivedQuery = `
      SELECT
        c.id,
        LOWER(c.status)                     AS status,
        c.stalled_override,
        ${realPlayerCountSql('c', '$1')}     AS real_player_count,
        ${pickCountSql('c')}                 AS pick_count,
        ${lastActivitySql('c')}              AS last_activity
      FROM competition c
      WHERE c.id <> ALL($2::int[])
    `;
    const archivedResult = await query(archivedQuery, [BOT_EMAIL_LIKE, EXCLUDED_COMPETITION_IDS]);
    const archivedIds = archivedResult.rows
      .filter((c) => classifyCompetition(c).is_stalled)
      .map((c) => c.id);

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
    Places from the service, not from a query written here - the same call get-admin-stats makes,
    with the archived ids added to its exclusion list so this figure answers "how are we doing
    with the competitions that are actually alive or finished cleanly", not inflated by tyre
    kickers who never paid for anything they held.
    */
    const places = await getPlatformPlaceTotals({
      excludedCompetitionIds: EXCLUDED_COMPETITION_IDS.concat(archivedIds),
      excludedEmails: EXCLUDED_EMAILS
    });

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
