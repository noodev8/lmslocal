/*
=======================================================================================================================================
Email Quiet Period Service - "magic send"
=======================================================================================================================================
Purpose: One rule, applied at the moment of sending: if we have emailed this person in the last 48
         hours, do not email them again. Mark them as dealt with instead.

Decided 2026-08-21, at the start of the football season, with several emails about to go on the
cron at once. The risk it removes is not a theoretical one - twelve people had already received two
emails inside 48 hours while daily volume went from 3 to 61 in nine days, and every email added to
the crontab multiplies the collisions rather than adding to them.

WHY IT KILLS RATHER THAN HOLDS, which is the whole design and the thing to re-read before changing
it. A held candidate has no answer to "how long for" - they come back tomorrow, lose again to
whatever is higher up the crontab, and the queue never drains. Killing has an answer. The argument
for it being harmless: the person has had an email from us inside two days, that email carries a
link to the app, and the app is where the actual state lives. A second email would be a prompt to
do something they have already been prompted to do.

The cost, stated plainly because it is real and permanent: every once-ever guard on the platform is
`NOT EXISTS (... AND eq.email_type = X)` with no condition on status, so a row written here means
that person NEVER gets that email. Somebody who happens to receive a Round Over email on the
Saturday morning does not get their Welcome email at all. That is accepted. It is also why the row
carries a `magic_send` flag - see below.

NOTHING IS EXEMPT, deliberately. There is no per-email opt-out and no priority field, because
there is already a priority mechanism and it is the crontab: the email at the top runs first,
takes the collisions, and everything below it gets whoever is left. Adding a second way to express
priority in code would be a switch that could disagree with the real one - the same argument that
keeps the cron schedule out of services/emailCatalog.js. Priority is the operator's, per run.

WHERE IT IS APPLIED: inside sendToAll in services/emailSweep.js, which is the single path both live
senders take - the admin Send button and the cron. Not in deliver(). deliver() knows nothing about
the queue row, cannot defer, and its `suppressed` return would land in the failure branch and mark
the row 'failed', which would then be retried forever.

NOT APPLIED IN TEST MODE. sendTest writes nothing and sends one copy to the test address; a quiet
period that hid the sample would make it impossible to preview an email during a busy week.
=======================================================================================================================================
*/

const { query } = require('../database');

/*
48 hours. One number, here, not in the crontab and not per email - the crontab expresses WHICH
email wins a collision, this expresses how long a collision lasts.
*/
const QUIET_PERIOD_HOURS = 48;

/*
Stamped into template_data on every row this writes, alongside the reason emailSkip records.

The point of a flag rather than only a sentence: these rows are permanent and irreversible by
design, so the one thing that must stay possible is finding them again. A wording change to the
reason string would orphan every earlier row from an exact-match query; a boolean will not.

  Count them:  SELECT COUNT(*) FROM email_queue WHERE template_data->>'magic_send' = 'true'
  Undo a run:  DELETE FROM email_queue WHERE template_data->>'magic_send' = 'true'
                 AND created_at >= '...'
*/
const MAGIC_SEND_MARK = { magic_send: true, quiet_period_hours: QUIET_PERIOD_HOURS };

const MAGIC_SEND_REASON = `Not sent - already emailed within ${QUIET_PERIOD_HOURS} hours (magic send)`;

/**
 * Everyone who has had an email from us inside the quiet period.
 *
 * DELIBERATELY NOT NARROWED TO THE CANDIDATE LIST. The obvious shape is
 * `WHERE user_id = ANY($candidates)`, and it is the wrong one at the size this platform is heading
 * for: that array grows with the player count, so the query gets heavier every month and ships a
 * five-figure parameter payload with it. Unfiltered, the result set is bounded by SEND VOLUME IN
 * 48 HOURS instead, which is a number we control and which stays small however many players there
 * are. One query, one small set, reused for every candidate.
 *
 * status = 'sent' AND sent_at, not email_tracking: email_tracking.sent_at defaults to insert time
 * and is therefore set on rows that were never delivered. email_queue.status is the only column
 * that means "Resend took it". Verified against live data - every 'sent' row carries sent_at and
 * no 'skipped' row does, so a row written by this service can never suppress a later email itself.
 *
 * Needs idx_email_queue_sent_recent - a partial index on (sent_at) WHERE status = 'sent'. Without
 * it this is a scan of the whole table.
 *
 * @returns {Promise<Set<number>>} user_ids emailed inside the quiet period
 */
async function findRecentlyEmailed() {
  const result = await query(`
    SELECT DISTINCT user_id
    FROM email_queue
    WHERE status = 'sent'
      AND sent_at >= NOW() - ($1 || ' hours')::interval
  `, [String(QUIET_PERIOD_HOURS)]);

  return new Set(result.rows.map((r) => r.user_id));
}

module.exports = {
  QUIET_PERIOD_HOURS,
  MAGIC_SEND_MARK,
  MAGIC_SEND_REASON,
  findRecentlyEmailed
};
