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

module.exports = { checkExpiry, EXPIRES_AT };
