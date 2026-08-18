/*
=======================================================================================================================================
API Route: admin/get-email-targets
=======================================================================================================================================
Method: POST
Purpose: Recipient counts for each wired email on the outline. Drives the counts column and the
         focus card on the admin Emails screen.

Which emails are wired comes from services/emailCatalog.js, so this route never needs editing
when one is added. Unwired rows are simply absent from `counts` rather than reported as zero:
"we cannot work this out yet" and "nobody qualifies" mean very different things to whoever is
about to press send, and 0 would be a lie about the second.

THREE NUMBERS, NOT ONE

  waiting        candidates from findCandidates - people who qualify and have no queue row
  sent_recently  actually delivered in the last SENT_WINDOW_DAYS days
  competitions   how many distinct competitions the waiting recipients span

They are different questions and a single number hides the other two. `competitions` is there
because "14 waiting across 5 competitions" is the answer the operator actually wants, and a bare
14 only invites the question. `sent_recently` answers the other half - whether an email with a
count of zero is finished or has simply never gone out.

competition_id is now OPTIONAL. Omitting it counts scoped emails across the whole platform, which
is the only way to answer "how many people are waiting for this email" rather than "how many in
the competition I happen to have picked". Passing one narrows scoped emails to it. Platform-wide
emails ignore it either way.

email_types narrows which emails are worked out at all. The focus card asks for one email
platform-wide; the table asks for all of them against the picked competition. Without this the
card would trigger a full pass over the catalog to read a single number.
=======================================================================================================================================
Request Payload:
{
  "competition_id": 210,               // integer, optional - null/absent counts every competition
  "email_types": ["welcome"]           // array of strings, optional - defaults to every wired email
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "counts": {
    "welcome": {
      "waiting": 3,                    // integer, qualify now
      "sent_recently": 1,              // integer, delivered in the last 30 days
      "competitions": 2,               // integer, competitions the waiting span; 0 when unscoped
      "cron": "daily"                  // string or null, the cron bucket that sends this unattended
    }
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "VALIDATION_ERROR",
  "message": "competition_id must be an integer when given"
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
const { CATALOG } = require('../../services/emailCatalog');
const { logApiCall } = require('../../utils/apiLogger');

const router = express.Router();

/*
How far back "sent" looks. Thirty days is enough to answer "is this email actually going out" -
which is the question - without turning the card into a history page.
*/
const SENT_WINDOW_DAYS = 30;

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('admin/get-email-targets');

  try {
    const { competition_id, email_types } = req.body;

    if (competition_id !== undefined && competition_id !== null && !Number.isInteger(competition_id)) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'competition_id must be an integer when given'
      });
    }

    if (email_types !== undefined && !Array.isArray(email_types)) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'email_types must be an array when given'
      });
    }

    const scopeId = Number.isInteger(competition_id) ? competition_id : null;

    const wanted = Object.entries(CATALOG).filter(
      ([emailType]) => !email_types || email_types.includes(emailType)
    );

    /*
    What actually went out, in one query rather than one per email - it is a plain count off
    email_queue, so there is no reason to pay a round trip per catalog entry.

    status = 'sent' AND sent_at, not email_tracking. email_tracking.sent_at DEFAULTS to insert
    time, so it is set on rows that were never delivered - which is how nine stale pending rows
    all carried a timestamp. email_queue.status is the only column that means "Resend took it".

    'skipped' rows are excluded by the status check, which is the point of them being a separate
    status: marking somebody as sent must not show up here as an email they received.
    */
    const sentRows = await query(`
      SELECT email_type, COUNT(*)::int AS sent
      FROM email_queue
      WHERE status = 'sent'
        AND sent_at >= NOW() - ($2 || ' days')::interval
        AND ($1::int IS NULL OR competition_id = $1)
      GROUP BY email_type
    `, [scopeId, String(SENT_WINDOW_DAYS)]);

    const sentByType = Object.fromEntries(sentRows.rows.map((r) => [r.email_type, r.sent]));

    /*
    Sequential rather than Promise.all. These are the heavier queries on the platform - the pick
    reminder candidate query joins four tables across every round - and dropping the competition
    filter makes each one wider than it used to be. One at a time keeps a page load off the
    connection pool's limit.
    */
    const counts = {};
    for (const [emailType, entry] of wanted) {
      const candidates = await entry.service.findCandidates(
        entry.scoped && scopeId ? { competition_id: scopeId } : {}
      );

      counts[emailType] = {
        waiting: candidates.length,
        sent_recently: sentByType[emailType] || 0,
        // Meaningless on platform-wide emails, which carry no competition at all.
        competitions: entry.scoped
          ? new Set(candidates.map((c) => c.competition_id)).size
          : 0,
        /*
        Which cron bucket sends this unattended, or null for one that only ever goes by hand.
        Returned rather than re-declared on the screen because the screen already keeps its own
        copy of `scoped`, and a second copy of this one could say an email is scheduled while
        scripts/email-sweep.js disagrees - which is the exact confusion the symbol exists to end.
        The catalog is the one source; this just carries it.
        */
        cron: entry.cron || null
      };
    }

    return res.json({
      return_code: 'SUCCESS',
      counts
    });

  } catch (error) {
    console.error('admin/get-email-targets error:', { error: error.message, stack: error.stack });
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not work out email recipients.'
    });
  }
});

module.exports = router;
