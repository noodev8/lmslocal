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

WHAT IT COUNTS, AND WHAT IT CANNOT

email_queue rows with status = 'sent' - the same definition as the card's "sent recently" and the
history list, so the three cannot disagree. sent_at, never email_tracking.sent_at, which DEFAULTS
to insert time and is therefore stamped on mail that never went.

Two kinds of send are genuinely invisible here, which is why `remaining` is reported as an estimate
and the screen says so rather than printing a bare number:

  - TEST SENDS. send-emails.js deliberately queues nothing in test mode, so a [TEST] copy leaves no
    row. It still spends a Resend send.
  - TRANSACTIONAL MAIL. Password reset, email verification, the contact form, onboarding and the
    Stripe payment confirmation call emailService directly and were never queued. Low volume, but
    not zero.

Closing those gaps means logging every send inside deliver() itself, which is the right fix and a
larger change; until then this is an upper bound on what is left, and it is labelled as one.

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
  "remaining_estimate": 89             // integer, never below zero - an UPPER bound, see above
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
        SELECT (NOW() AT TIME ZONE 'Europe/London')::date AS today
      )
      SELECT
        to_char(d.today, 'YYYY-MM-DD') AS today_date,
        to_char(d.today - 1, 'YYYY-MM-DD') AS yesterday_date,
        COUNT(*) FILTER (
          WHERE (eq.sent_at AT TIME ZONE 'Europe/London')::date = d.today
        )::int AS today_sent,
        COUNT(*) FILTER (
          WHERE (eq.sent_at AT TIME ZONE 'Europe/London')::date = d.today - 1
        )::int AS yesterday_sent
      FROM days d
      LEFT JOIN email_queue eq
        ON eq.status = 'sent'
       AND eq.sent_at IS NOT NULL
       AND (eq.sent_at AT TIME ZONE 'Europe/London')::date >= d.today - 1
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
      remaining_estimate: Math.max(0, limit - row.today_sent)
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
