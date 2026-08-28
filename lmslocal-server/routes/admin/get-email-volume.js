/*
=======================================================================================================================================
API Route: admin/get-email-volume
=======================================================================================================================================
Method: POST
Purpose: How many emails have actually gone out today, and yesterday to compare it against - so an
         operator with a backlog on the screen can see whether today's sending budget will take it.

WHY THIS EXISTS

The Emails screen answers "who is waiting" and "who did it go to", per email. It could not answer
the question you ask before pressing send on a backlog of forty-four: how much of today's allowance
is already spent. That number lived only in the Resend dashboard, which means leaving the screen
that is about to do the sending.

WHAT IT COUNTS

email_send_log rows - one per provider call, written inside deliver(). See services/emailService.js
for why the row is written after the call rather than before it.

This USED to count email_queue rows with status = 'sent', which meant it counted only what had been
QUEUED, and two kinds of send were invisible:

  - TEST SENDS. send-emails.js deliberately queues nothing in test mode, so a [TEST] copy left no
    row. It spends a provider send like any other.
  - TRANSACTIONAL MAIL. Password reset, email verification, the contact form, onboarding and the
    Stripe payment confirmation are sent directly and never queued. Low volume, but not zero.

Both are now counted, which is why `remaining_estimate` is closer to a real figure than it was.
It is still called an estimate for one honest reason: the provider's own quota day need not be the
Europe/London day, so for the hour after UK midnight in summer the two can disagree by whatever
went out in it.

THE HANDOVER, WHICH IS WHY THIS QUERY HAS TWO SOURCES

email_send_log starts empty and only knows about sends made after it existed. Counting from it
alone would report zero for yesterday on the first day and read as an outage. So the query takes
log rows for the period the log covers, and email_queue rows for the period before it - split at
the log's own earliest row, so nothing is counted twice and nothing is dropped. `logging_since` is
returned so the operator can see where the complete count starts; once it is more than two days
old the email_queue half stops mattering and can go.

DAYS ARE EUROPE/LONDON

Matching how every other date on this platform is shown to a human - formatUkDateTime and the rest.
Resend's own quota window is not necessarily the same, so for the hour after UK midnight in summer
the two can disagree by whatever went out in it. One more reason the remaining figure is an
estimate rather than a promise, and a smaller one than the two above.

THE LIMIT IS CONFIGURATION, NOT A CONSTANT

RESEND_DAILY_LIMIT in .env, defaulting to 100 - the free tier's allowance today. It moves on a plan
change, and a hardcoded 100 would then quietly under-report the headroom rather than fail visibly.
=======================================================================================================================================
Request Payload:
{}                                     // none - always the whole platform, always today

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "daily_limit": 100,                  // integer, sends allowed per day on the current plan
  "today": {
    "date": "2026-08-21",              // string, the Europe/London day counted
    "sent": 11                         // integer, email_queue rows that actually left
  },
  "yesterday": {
    "date": "2026-08-20",
    "sent": 47
  },
  "remaining_estimate": 89,            // integer, never below zero
  "logging_since": "2026-08-28T14:02:11.000Z",  // string|null, when complete per-send logging began.
                                       //         Null until the first send is logged. Counts for
                                       //         days before this come from email_queue and so
                                       //         miss test and transactional sends.
  "logging_covers_today": true         // boolean, whether the log covers the whole of today - i.e.
                                       //         whether today's figure is complete or still part
                                       //         counted from email_queue
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "SERVER_ERROR",
  "message": "Could not read today's email volume."
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
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

// The free tier's allowance. Overridden by .env on a plan change; a bad value falls back rather
// than reporting a headroom of NaN.
const DEFAULT_DAILY_LIMIT = 100;

const dailyLimit = () => {
  const configured = Number(process.env.RESEND_DAILY_LIMIT);
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : DEFAULT_DAILY_LIMIT;
};

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('admin/get-email-volume');

  try {
    /*
    Both days in one pass, bucketed in SQL rather than by two round trips with two different
    "now" values - at midnight those would land on different days and the comparison would be
    between yesterday and the day before.

    The date is returned as text from the same expression that does the bucketing, so the label
    on the screen is provably the day that was counted rather than one the browser worked out
    from its own clock.
    */
    const result = await query(`
      WITH days AS (
        SELECT
          (NOW() AT TIME ZONE 'Europe/London')::date AS today,
          /*
          The window start as an ABSOLUTE INSTANT, computed once and used to bound both sources.
          Every predicate below compares sent_at to this directly rather than to a function of
          sent_at, so both can use their index on sent_at.
          */
          (((NOW() AT TIME ZONE 'Europe/London')::date - 1)::timestamp AT TIME ZONE 'Europe/London') AS from_instant
      ),
      /*
      Where the log's coverage starts, and therefore where email_queue's stops.

      Bounded to accepted rows so it reads the same partial index the counting does - MIN over the
      whole table cannot use idx_email_send_log_accepted_recent and degrades to a sequential scan
      of every row ever logged, which is the one thing on this screen that would get slower with
      volume. It is also the more accurate boundary: the log only ever CONTRIBUTES accepted rows,
      so its coverage genuinely begins at the first of them.
      */
      since AS (
        SELECT MIN(sent_at) AS from_ts FROM email_send_log WHERE accepted
      ),
      /*
      The two sources, joined end to end at the log's earliest row. A queued send made after
      logging began appears in BOTH tables, so the email_queue half is bounded strictly below
      from_ts - that boundary is what stops it being counted twice.

      BOTH HALVES ARE ALSO BOUNDED BELOW BY from_instant. Without that this reads every row either
      table has ever held in order to answer a question about two days, and merely hopes the
      planner pushes the outer filter down through the CTE. At a few hundred rows a day that is
      invisible; at the volumes this is being built for it is the difference between an index
      range scan of one day and a sequential scan of the year.

      Rejected rows are excluded: the provider refused them, so they spent no allowance. Test
      sends are NOT excluded, because they do.
      */
      sends AS (
        SELECT l.sent_at
        FROM email_send_log l, days d
        WHERE l.accepted
          AND l.sent_at >= d.from_instant
        UNION ALL
        SELECT eq.sent_at
        FROM email_queue eq, since s, days d
        WHERE eq.status = 'sent'
          AND eq.sent_at IS NOT NULL
          AND eq.sent_at >= d.from_instant
          AND (s.from_ts IS NULL OR eq.sent_at < s.from_ts)
      )
      SELECT
        to_char(d.today, 'YYYY-MM-DD') AS today_date,
        to_char(d.today - 1, 'YYYY-MM-DD') AS yesterday_date,
        (SELECT from_ts FROM since) AS logging_since,
        /*
        Whether the log covers the WHOLE of today, which is what decides if today's figure is
        complete or still part-counted from email_queue. False on the day logging is switched on -
        that day began before the log existed, so its earlier hours are counted the old way and
        under-report by whatever test and transactional mail went out in them. The screen uses
        this to decide whether to keep hedging the number.
        */
        (SELECT from_ts FROM since) < (d.today::timestamp AT TIME ZONE 'Europe/London') AS logging_covers_today,
        COUNT(*) FILTER (
          WHERE (x.sent_at AT TIME ZONE 'Europe/London')::date = d.today
        )::int AS today_sent,
        COUNT(*) FILTER (
          WHERE (x.sent_at AT TIME ZONE 'Europe/London')::date = d.today - 1
        )::int AS yesterday_sent
      FROM days d
      LEFT JOIN sends x ON TRUE
      GROUP BY d.today
    `);

    const row = result.rows[0];
    const limit = dailyLimit();

    return res.json({
      return_code: 'SUCCESS',
      daily_limit: limit,
      today: { date: row.today_date, sent: row.today_sent },
      yesterday: { date: row.yesterday_date, sent: row.yesterday_sent },
      // Clamped: an over-run reads as "none left", not as a negative number nobody can act on.
      remaining_estimate: Math.max(0, limit - row.today_sent),
      logging_since: row.logging_since,
      // Null-safe: an empty log yields NULL from the comparison, which is 'no' rather than unknown.
      logging_covers_today: row.logging_covers_today === true
    });

  } catch (error) {
    console.error('admin/get-email-volume error:', { error: error.message, stack: error.stack });
    return res.json({
      return_code: 'SERVER_ERROR',
      message: "Could not read today's email volume."
    });
  }
});

module.exports = router;
