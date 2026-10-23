/*
=======================================================================================================================================
Email Expiry Service
=======================================================================================================================================
Purpose: Decide whether a queued email has become FALSE since it was queued, so the drain can
         refuse it instead of sending it.

WHY THIS EXISTS

Queueing and sending are two separate operator presses. routes/load-pick-reminder.js writes the
rows; routes/send-email.js drains them, whenever somebody presses the button. The only guard
between the two was MAX_AGE_DAYS = 10, which asks "is this row old?" and never "is this row still
true?".

That was survivable while subjects were vague. It stopped being survivable when the pick reminder
subject started naming the deadline - "Pick by Sat 2pm" arriving on Sunday is worse than no
reminder at all, because it tells the player they still have time and they do not. A vague email
ages gracefully; a specific one does not.

Note the sweep (services/emailSweep.js) queues and sends inside one loop, so it cannot go stale
and does not need this. The gap is the two-press path only.

WHY 'expired' AND NOT 'sent'

The tempting fix is to mark the row sent so it stops being picked up. Every status in this system
answers "why did this not go?", and each one has to stay answerable later:

  sent        Resend accepted it. A lie here leaves a null message id against an email somebody
              is recorded as having received - see services/emailSkip.js, which refuses the same
              shortcut for the same reason.
  suppressed  the RECIPIENT's decision - they unsubscribed after it was queued.
  skipped     the OPERATOR's decision - they chose not to send this batch.
  failed      it was attempted and the provider refused it.
  expired     nobody decided anything. The email was true when queued and is not true now.

Keeping them apart is what lets "why did these 40 players not get a reminder?" have an answer six
months later. There is no check constraint on email_queue.status, so a new value costs nothing.

ADDING AN EMAIL TO THIS

One entry in EXPIRES_AT. Only add an email whose content becomes actively WRONG once the moment
passes - not merely late. A welcome email a day late is still a welcome; a deadline reminder past
its deadline is misinformation.
=======================================================================================================================================
*/

/**
 * When each email type stops being true, read off the template_data the queue already carries.
 *
 * Returning null means "this type never expires", which is the right answer for most of the
 * outline and the default for anything absent.
 */
const EXPIRES_AT = {
  /*
  The round lock. After it the player cannot pick at all, so every sentence in the email - the
  subject's deadline, the fixture list, the teams still available - describes a decision that is
  no longer theirs to make.

  services/pickReminder.js guarantees lock_time is non-null and in the future at queue time, so a
  missing value here means a row queued under some older shape. Those are left alone rather than
  guessed at: an email with no known deadline cannot be proven stale.
  */
  pick_reminder: (templateData) => templateData?.lock_time || null
};

/**
 * Has this queued email gone off?
 *
 * @param {string} emailType - the catalog key on the queue row
 * @param {object} templateData - the row's template_data
 * @param {Date} [now] - injectable for testing
 * @returns {{expired: boolean, deadline: Date|null}}
 */
function checkExpiry(emailType, templateData, now = new Date()) {
  const read = EXPIRES_AT[emailType];
  if (!read) return { expired: false, deadline: null };

  const raw = read(templateData);
  if (!raw) return { expired: false, deadline: null };

  const deadline = new Date(raw);
  // An unparseable timestamp is not evidence of staleness - treat it the way a missing one is
  // treated, and let the send proceed rather than silently binning somebody's reminder.
  if (Number.isNaN(deadline.getTime())) return { expired: false, deadline: null };

  return { expired: deadline <= now, deadline };
}

/*
How old the moment behind a welcome can be before it is no longer sent - a join for Welcome Join
Comp, a signup for Welcome Join LMS, a creation for Welcome Created Comp. Added 2026-10-23.

A BACKSTOP, NOT THE RULE. "Once ever" is enforced by email_queue rows alone, so a cleared or
damaged email_queue would make every active member, account and competition a candidate again -
hundreds of welcomes to people who joined months ago. This caps that at four days' worth. A
welcome later than four days is stale anyway, and losing one is preferred to sending too many.
*/
const WELCOME_MAX_AGE_DAYS = 4;

/*
The same backstop for the other once-ever emails - the hints and Empty Competition - measured from the moment each becomes due rather than from its trigger's age.
Each is only sent inside this window after becoming eligible, so missing the window (nobody
pressed send that week) means it never goes. Accepted: too few beats too many.

Together with WELCOME_MAX_AGE_DAYS this is what makes pruning email_queue safe: rows older than
the longest window can be deleted without bringing anybody back as a candidate.
*/
const ONE_OFF_WINDOW_DAYS = 7;

/*
Game complete gets the shorter window: a result announced more than four days after the final
round is old news, the same judgement as the welcomes.
*/
const GAME_COMPLETE_WINDOW_DAYS = 4;

/*
Round Over, the same four days, counted from when it became READY - the later of the round
settling and the next round being created - not from the settle alone. It waits for the next
round's fixtures, which can land more than four days after the settle (an international break, a
slow organiser), and a window counted from the settle would kill it before it was ever due.
Without this, a stalled competition whose next round never locks would get its old Round Over
again after a prune of email_queue.
*/
const ROUND_OVER_WINDOW_DAYS = 4;

module.exports = {
  checkExpiry,
  EXPIRES_AT,
  WELCOME_MAX_AGE_DAYS,
  ONE_OFF_WINDOW_DAYS,
  GAME_COMPLETE_WINDOW_DAYS,
  ROUND_OVER_WINDOW_DAYS
};
