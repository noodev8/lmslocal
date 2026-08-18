/*
=======================================================================================================================================
Signup Nudge Service
=======================================================================================================================================
Purpose: The one definition of who has signed up, done nothing for a week, and is worth one
         reminder before we leave them alone.

This is the SAME population as services/joinLms.js - somebody with an account who has neither
joined a competition nor created one - asked a week later instead of a day later. Join LMS says
"here is what this is"; this one says "you never started". Two different questions about the same
person, which is why the candidate query below is deliberately the join_lms query with a longer
interval and its own once-ever guard, rather than a new idea about who counts as idle.

Why it was built (2026-08-18): 101 of 265 real accounts had done neither, and 98 of those were
addressable. Every one of them had VERIFIED their email address, so they clicked the link in the
welcome and then stopped - these are not accidental signups. It is the largest single leak on the
platform and nothing existed to touch it.

The eligibility rules, all in findCandidates below:
  - signed up more than NUDGE_AFTER_DAYS ago
  - not a member of any competition, and organiser of none
  - real email (guest and bot accounts both use @lms-guest.com and are excluded by the same test)
  - has never been queued a signup_nudge email, sent, failed or skipped
  - not opted out of the Info group, per services/emailPreference.js

Platform-wide, like Join LMS: there is no competition in any of this, so competition_id is left
NULL on both the queue and the tracking row.

NOT the instrument for the backlog that existed when this was written - 94 accounts qualified on
the day it was wired, the oldest from September 2025. Those are cleared with "Mark as sent" on the
admin Emails screen before the first real send, which writes the same 'skipped' rows the once-ever
guard below already excludes. Re-engaging them is a separate job with a reason attached ("the
season starts on Friday"), and admin Broadcast already does exactly that with an opt-out check and
a send cap. A timer-driven nudge is the wrong instrument for somebody who signed up in June.
=======================================================================================================================================
*/

const { query } = require('../database');
const { notOptedOutSql, groupFor, getOrCreateToken, unsubscribeLinks } = require('./emailPreference');

const EMAIL_TYPE = 'signup_nudge';

/*
How long after signing up before somebody counts as having stalled. Andreas's call, 2026-08-18.

It has to sit clear of joinLms.SETTLING_HOURS (24) by enough that the two never read as one
mailing. A day is when we stop expecting them to act; a week is when we accept they have not, and
it is still recent enough that they remember signing up. Shorter and it is nagging somebody who
was simply busy over a weekend; longer and it is a re-engagement email, which is Broadcast's job
and wants a reason attached rather than a timer.

Measured when this was set: of 98 addressable idle accounts, 5 were under 7 days old, 11 were 7-30
days, and 82 were over 30. So the steady state this serves is roughly five people a week - the
right size for a nudge, and nothing like the backlog, which is why the backlog is handled
elsewhere.
*/
const NUDGE_AFTER_DAYS = 7;

/*
NO CUTOFF CONSTANT, and this is a deliberate repeat of joinLms's correction rather than an
oversight.

joinLms carried a CUTOFF date in code, and it was retired on 2026-08-14 because it did the same
job as a sent marker by a second, invisible means: nothing on the admin screen said it was there,
so the count on the card had a filter behind it nobody could see. Two mechanisms for one rule.

So the same rule is expressed the same way here - as data, through the mechanism that already
exists for it. "Mark as sent" on the admin Emails screen (routes/admin/mark-emails-sent.js, via
services/emailSkip.js) writes a 'skipped' row per person, and the once-ever guard below excludes
them permanently on its own. It is generic over the catalog, so this email needed no code to get
it. The number on the card is the truth with nothing behind it, and the operator can see what they
are writing off before they do it - which a date in a file could never offer.

DO THAT BEFORE THE FIRST REAL SEND. 94 accounts qualified the day this was wired, the oldest from
September 2025. Press Send instead of Mark as sent and three months of accumulated dormancy goes
out in one go, from the domain the live competitions depend on.
*/

/*
DELIBERATELY NOT GATED ON THE WELCOME HAVING BEEN SENT.

The obvious-looking guard - "only nudge somebody who got join_lms" - would make this email's
recipient list depend on whether an operator happened to press a different button first, and
sending here is manual with no scheduler. Eligibility has to be a fact about the world, not about
our own outbox; joinLms's own header note makes the same argument at length and for the same
reason. Somebody who never got the welcome and gets this instead still receives an email that
stands on its own, because it explains both doors rather than assuming they saw the first one.
*/

/*
The subject, a constant because the tracking row is written before the template is built and the
two must match. emailService.buildSignupNudgeEmail reads this same constant.
*/
const SUBJECT = 'Still time to get started on LMS Local';

/**
 * Find every user who signed up, did nothing, and has not been nudged.
 *
 * Takes no arguments beyond the ones the shared catalog passes every service. Any competition_id
 * is ignored: this email has no competition, and the admin screen's picker does not apply to it.
 *
 * @returns {Promise<Array>} candidate rows, each carrying everything buildTemplateData needs
 */
async function findCandidates() {
  const result = await query(`
    SELECT
      u.id           AS user_id,
      u.email        AS user_email,
      u.display_name AS user_display_name,
      u.created_at

    FROM app_user u

    WHERE u.email IS NOT NULL
      AND u.email != ''
      -- Covers guests and bots in one test; every bot address ends this way by construction
      -- (see services/botPool.js), which is what already keeps player email away from them.
      AND u.email NOT LIKE '%@lms-guest.com'

      -- A week since signing up. See NUDGE_AFTER_DAYS.
      AND u.created_at < NOW() - ($1 || ' days')::interval

      -- Still nothing started. Read off the competition tables rather than off email_queue, so
      -- no processing order can produce a different answer - the same reasoning joinLms uses.
      -- Any membership counts, whatever its status: somebody knocked out of the only competition
      -- they were ever in has started, and does not need chasing to begin.
      AND NOT EXISTS (
        SELECT 1 FROM competition_user cu
        WHERE cu.user_id = u.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM competition c
        WHERE c.organiser_id = u.id
      )

      -- Once only, ever. Covers sent, failed AND skipped rows, so pressing send twice does not
      -- nudge the same person twice - and so the backlog marked skipped when this was wired can
      -- never come back. One nudge is the whole promise: somebody who ignores it is telling us
      -- something, and a second would be the point at which this became nagging.
      AND NOT EXISTS (
        SELECT 1 FROM email_queue eq
        WHERE eq.user_id = u.id
          AND eq.email_type = '${EMAIL_TYPE}'
      )
      -- Opt-outs, defined once in services/emailPreference.js. There is no competition to mute
      -- here, so the per-competition arm of that test is passed a NULL it can never match.
      AND ${notOptedOutSql({ userColumn: 'u.id', competitionColumn: 'NULL::int', groupParam: '$2' })}

    ORDER BY u.created_at, u.id
  `, [String(NUDGE_AFTER_DAYS), groupFor(EMAIL_TYPE)]);

  return result.rows;
}

/**
 * Build the template data one signup nudge needs.
 *
 * Nothing here is per-competition, so as with Join LMS there are no extra lookups - only the
 * recipient's unsubscribe token.
 *
 * @param {object} candidate - a row from findCandidates
 * @returns {Promise<object>} template data, stored on email_queue.template_data
 */
async function buildTemplateData(candidate) {
  const { user_id, user_email, user_display_name } = candidate;

  /*
  Resolved at queue time so the stored template_data is self-contained - a queued email must
  still render correctly if it is sent later.
  */
  const token = await getOrCreateToken(user_id);
  const unsubscribe = token ? unsubscribeLinks(token, groupFor(EMAIL_TYPE)) : null;

  return {
    email_tracking_id: `${EMAIL_TYPE}_${user_id}_${Date.now()}`,
    unsubscribe,
    user_email,
    user_display_name,
    user_id
  };
}

/**
 * Queue one signup nudge, and open its tracking row.
 *
 * competition_id is NULL on both rows, as for Join LMS: the column is nullable on each table, and
 * a platform-wide email has no competition to point at - 0 would collide with the sentinel
 * email_preference uses for a global preference.
 *
 * @param {object} candidate - a row from findCandidates
 * @returns {Promise<{success: boolean, queue_id?: number, template_data?: object, error?: string}>}
 */
async function queueCandidate(candidate) {
  try {
    const templateData = await buildTemplateData(candidate);

    const queueResult = await query(`
      INSERT INTO email_queue (
        user_id, competition_id, round_id, email_type,
        scheduled_send_at, template_data, status, attempts
      ) VALUES ($1, NULL, NULL, '${EMAIL_TYPE}', NOW(), $2, 'pending', 0)
      RETURNING id
    `, [candidate.user_id, JSON.stringify(templateData)]);

    await query(`
      INSERT INTO email_tracking (email_id, user_id, competition_id, email_type, subject)
      VALUES ($1, $2, NULL, '${EMAIL_TYPE}', $3)
    `, [templateData.email_tracking_id, candidate.user_id, SUBJECT]);

    return { success: true, queue_id: queueResult.rows[0].id, template_data: templateData };
  } catch (error) {
    console.error('signupNudge.queueCandidate failed:', { user_id: candidate.user_id, error: error.message });
    return { success: false, error: error.message };
  }
}

module.exports = {
  EMAIL_TYPE,
  SUBJECT,
  NUDGE_AFTER_DAYS,
  findCandidates,
  buildTemplateData,
  queueCandidate
};
