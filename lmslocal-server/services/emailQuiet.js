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

ALMOST NOTHING IS EXEMPT, and the exception proves the rule rather than weakening it.

The default stands: no per-email opt-out and no priority field, because there is already a
priority mechanism and it is the crontab - the email at the top runs first, takes the collisions,
and everything below it gets whoever is left. Adding a second way to express priority in code
would be a switch that could disagree with the real one, the same argument that keeps the cron
schedule out of services/emailCatalog.js. Priority is the operator's, per run.

WHAT IS EXEMPT, AND WHY THAT IS NOT A PRIORITY FIELD (2026-08-28)

One catalog entry carries `quietExempt: true` - organiser_nudge, and at the time of writing it is
the only one. It is not a promotion; it is an email the crontab's mechanism cannot rank at all.

Every other sweep runs once, in a single block between 08:00 and 10:00, and within that block
running order IS priority. organiser_nudge runs HOURLY THROUGH THE AFTERNOON, because it fires
three hours before a round locks and rounds lock at different times. An email that runs at 17:00
loses to everything that ran at 08:00 whatever line it occupies - so its position in the file
expresses nothing, and the mechanism this rule defers to is simply absent for it.

The collision is also near-certain rather than occasional. Eight of the thirteen crontab lines are
organiser-facing, several recurring weekly, so an active organiser will usually have had something
inside 48 hours. Without the exemption this email would be killed almost every time it qualified -
silently, permanently for that round, and on the one email in the catalog whose entire value is
that it arrives before a deadline the recipient can still act on.

The quiet period's own harmlessness argument fails here too, and that is the deciding point. It
rests on the person having had an email that "carries a link to the app, and the app is where the
actual state lives" - true for a player being reminded to pick. organiser_nudge asks for something
that happens OUTSIDE the app: post the names in the group chat. Nothing they received on Tuesday
prompted that, so a second email is not a repeat of a prompt they already have.

THE EXEMPTION IS ONE WAY. Applied in sendToAll: an exempt email is never suppressed by the quiet
period, but it writes an ordinary 'sent' row and so still suppresses whatever runs after it. It
does not increase how often an organiser hears from us in total; it changes which email wins.

BEFORE ADDING A SECOND ONE, check it against the actual test above - not "this email matters" (they
all do) but "the crontab's running order cannot express this email's priority". An email inside the
morning block always has that mechanism available, so the honest fix there is to move its line up.

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
