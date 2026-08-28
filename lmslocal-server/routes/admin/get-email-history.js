/*
=======================================================================================================================================
API Route: admin/get-email-history
=======================================================================================================================================
Method: POST
Purpose: What has actually happened for one email over the LAST THIRTY DAYS - who it went to, when,
         and what became of the rows that did not go. The other half of the Emails screen, which
         until now could only answer "who is still waiting".

WHY THIS EXISTS, AND WHY IT MATTERS MORE ONCE THE CRON IS IN

Today an operator presses send and reads the result line, so the record of what went out is a
sentence on a screen that is gone on the next refresh. A cron sends with nobody watching, and the
only question afterwards is this one: did it go, to whom, and when. `waiting` cannot answer it -
a candidate DROPS OUT of that count the moment it is dealt with, so a healthy zero and an email
that never ran look identical.

email_queue IS the record. Every path writes a row - sent, failed, suppressed by an unsubscribe,
skipped by the operator - so this route is a plain read of it rather than a second store that
could disagree.

WHAT THE STATUSES MEAN

  sent        Resend accepted it. sent_at is when.
  failed      We tried and it did not go. error_message says why, and the row is deliberately left
              rather than deleted so it is not silently retried.
  suppressed  deliver() refused it at send time - the recipient had unsubscribed.
  skipped     The operator's decision. Nothing was built and nothing was attempted; the reason is
              on template_data.
  expired     The email stopped being TRUE between queueing and draining - a pick reminder whose
              round has since locked. Nobody decided anything; see services/emailExpiry.js.
  pending     Still queued, not yet drained.

NOT email_tracking, deliberately. Its sent_at DEFAULTS to insert time, so it is stamped on mail
that never went - which is how nine stale rows once all carried a timestamp. email_queue.status is
the only column that means "this actually left".

Opens and clicks are NOT reported. email_tracking carries the columns, but nothing populates them:
there is no Resend webhook on this platform, so all 328 rows read zero. A column of permanent
zeros beside real numbers reads as "nobody opens our email" rather than "we do not measure it".

THIRTY DAYS, FIXED, WITH NO WAY TO ASK FOR MORE

This is the operational window - "is this email running, and did last night's send go" - and it
matches SENT_WINDOW_DAYS on the card, so the number on the card and the list behind it cannot
disagree. Anything older is a database question and the db/query.js scripts are the right tool for
it; a screen that can page back through a year needs paging, dates and archive semantics to be
honest about what it is showing, and none of that helps with the question this answers.

email_type is accepted as free text rather than checked against the catalog. History outlives
wiring - a retired email's rows are exactly the ones somebody wants to look at later - and reading
rows that do not exist is harmless.
=======================================================================================================================================
Request Payload:
{
  "email_type": "welcome",             // string, required - which outline email
  "competition_id": 210,               // integer, optional - narrows to one competition
  "status": "sent",                    // string, optional - one of
                                       //         sent|failed|suppressed|skipped|expired|pending
  "limit": 100                         // integer, optional - default 100, capped at MAX_LIMIT
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "totals": {                          // object, every status seen in the window, unfiltered by
    "sent": 3,                         //         `status` and uncapped by `limit`
    "skipped": 105
  },
  "total": 108,                        // integer, rows in the window for this email + competition
  "window_days": 30,                   // integer, how far back this looked
  "rows": [                            // array, newest first, capped at limit
    {
      "id": 354,                       // integer, email_queue.id
      "user_id": 1108,                 // integer
      "email": "player@example.com",   // string
      "display_name": "Pamela",        // string
      "competition_id": 172,           // integer or null
      "competition_name": "EKRR AFC",  // string or null - the live name; null once deleted
      "competition_name_at_send": "EKRR AFC", // string or null - the name the email itself carried
      "round_number": 1,               // integer or null, round-based emails only
      "status": "sent",                // string
      "at": "2026-08-14T16:36:25Z",    // string, when it happened - sent_at, or the attempt, or
                                       //         created_at, whichever fits the status
      "created_at": "2026-08-14T...",  // string, when the row was written
      "error_message": null,           // string or null, failures only
      "reason": null                   // string or null, skips only
    }
  ],
  "truncated": false                   // boolean, more rows exist than were returned
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "VALIDATION_ERROR",
  "message": "email_type is required"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"
"UNAUTHORIZED"
"TOKEN_EXPIRED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../../database');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const { logApiCall } = require('../../utils/apiLogger');

const router = express.Router();

/*
How far back this looks, fixed and not a parameter. Deliberately the same 30 days as
SENT_WINDOW_DAYS in get-email-targets, so the "sent" number on the card and the list behind it are
answering the same question over the same period. Older than this is a database question.
*/
const WINDOW_DAYS = 30;

// Enough to scroll a real send without pulling the whole queue into a browser.
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

// What may be asked for. Anything else is a typo, and a typo returning zero rows reads as "nothing
// happened" rather than "you asked for a status that does not exist".
const STATUSES = ['sent', 'failed', 'suppressed', 'skipped', 'expired', 'pending'];

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('admin/get-email-history');

  try {
    const { email_type, competition_id, status, limit } = req.body;

    if (!email_type || typeof email_type !== 'string') {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'email_type is required'
      });
    }

    if (competition_id !== undefined && competition_id !== null && !Number.isInteger(competition_id)) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'competition_id must be an integer when given'
      });
    }

    if (status !== undefined && status !== null && !STATUSES.includes(status)) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: `status must be one of ${STATUSES.join(', ')}`
      });
    }

    const scopeId = Number.isInteger(competition_id) ? competition_id : null;
    const statusFilter = status || null;
    const rowLimit = Math.min(Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_LIMIT, MAX_LIMIT);

    /*
    The totals ignore the status filter on purpose: they are what the filter is chosen FROM, so
    filtering them would empty every tab but the one already open. They respect the window, like
    everything else here - a chip counting rows the list cannot show would be a trap.

    The window is applied to the same COALESCE the rows are ordered and dated by, so a row is in
    the window on exactly the timestamp the screen displays for it.
    */
    const totalsResult = await query(`
      SELECT status, COUNT(*)::int AS count
      FROM email_queue
      WHERE email_type = $1
        AND ($2::int IS NULL OR competition_id = $2)
        AND COALESCE(sent_at, last_attempt_at, created_at) >= NOW() - ($3 || ' days')::interval
      GROUP BY status
    `, [email_type, scopeId, String(WINDOW_DAYS)]);

    const totals = Object.fromEntries(totalsResult.rows.map((r) => [r.status, r.count]));
    const total = totalsResult.rows.reduce((sum, r) => sum + r.count, 0);
    const matching = statusFilter ? (totals[statusFilter] || 0) : total;

    /*
    Ordered by when the thing HAPPENED, not when the row was written. A queued row can sit for days
    before it is drained, so created_at would interleave a send from this morning below one from
    last week. COALESCE picks whichever column the status actually fills - and it is the same
    expression the `at` field returns, so the order the operator sees is the order they are sorted
    by.
    */
    const rows = await query(`
      SELECT
        eq.id,
        eq.user_id,
        u.email,
        u.display_name,
        eq.competition_id,
        c.name AS competition_name,
        /*
        The name as it was when the email went out, already denormalised onto template_data by
        every service that has a competition. No new column: a second stored copy of the same fact
        is exactly what this codebase has had to undo three times.

        It is what makes a deleted competition legible - the join finds nothing, but the email
        genuinely named "LMS Comp" and somebody asking about it a month later needs that word.
        Also survives a rename, though the live name is preferred when there is one, since that is
        what an operator will be searching for today.
        */
        eq.template_data->>'competition_name' AS competition_name_at_send,
        r.round_number,
        eq.status,
        eq.created_at,
        COALESCE(eq.sent_at, eq.last_attempt_at, eq.created_at) AS at,
        eq.error_message,
        eq.template_data->>'reason' AS reason
      FROM email_queue eq
      JOIN app_user u ON u.id = eq.user_id
      LEFT JOIN competition c ON c.id = eq.competition_id
      LEFT JOIN round r ON r.id = eq.round_id
      WHERE eq.email_type = $1
        AND ($2::int IS NULL OR eq.competition_id = $2)
        AND ($3::text IS NULL OR eq.status = $3)
        AND COALESCE(eq.sent_at, eq.last_attempt_at, eq.created_at) >= NOW() - ($5 || ' days')::interval
      ORDER BY COALESCE(eq.sent_at, eq.last_attempt_at, eq.created_at) DESC, eq.id DESC
      LIMIT $4
    `, [email_type, scopeId, statusFilter, rowLimit, String(WINDOW_DAYS)]);

    return res.json({
      return_code: 'SUCCESS',
      totals,
      total,
      window_days: WINDOW_DAYS,
      rows: rows.rows,
      truncated: matching > rows.rows.length
    });

  } catch (error) {
    console.error('admin/get-email-history error:', { error: error.message, stack: error.stack });
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not read the email history.'
    });
  }
});

module.exports = router;
