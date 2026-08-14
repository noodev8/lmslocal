/*
=======================================================================================================================================
Join LMS Service
=======================================================================================================================================
Purpose: The one definition of who should receive the "welcome to LMS Local" email, and how their
         email is built. Outline row: All | Welcome | Join LMS.

This is the email for somebody who signed up and has NOT started anything - no competition joined,
none created. Anyone who did either is welcomed by that instead (`welcome` per membership,
`created_comp` per competition), and never gets this one. Decision 2026-08-14, see below.

Nothing in routes/register.js triggers this. Sending is operator-driven from the admin Emails
screen, like every other comms email - see docs/email/README.md, "Sending is manual". Registration
therefore never depends on Resend being up, and every send can be previewed and test-sent first.

The eligibility rules, all in findCandidates below:
  - signed up more than SETTLING_HOURS ago
  - not a member of any competition, and organiser of none
  - real email (guest and bot accounts both use @lms-guest.com and are excluded by the same test)
  - has never been queued a join_lms email, sent or otherwise
  - not opted out of platform.welcome, per services/emailPreference.js

There is no competition in any of this. Join LMS is platform-wide, which is why competition_id is
left NULL on both the queue and the tracking row.
=======================================================================================================================================
*/

const { query } = require('../database');
const { notOptedOutSql, groupFor, getOrCreateToken, unsubscribeLinks } = require('./emailPreference');

const EMAIL_TYPE = 'join_lms';

/*
ONE WELCOME, NOT TWO. Decision 2026-08-14.

Somebody who signs up and joins a competition in the same sitting would otherwise get this AND
`welcome` within seconds of each other. Two emails for one action. So this one stands down: if
they have joined or created anything, the competition email is their welcome.

SUPPRESS RATHER THAN COMBINE, for three reasons. A combined "welcome to LMS Local and to X" needs
a template that branches, needs TWO email_queue rows behind one message or the once-ever guards
break, and cuts against the rule already written for digests - that a single email never mixes
types, because merging them forces a decision about when the combined one goes. There is also
precedent: an organiser joining their own competition is excluded from `welcome` and gets
`created_comp`, rather than a merged email. Same problem, same answer.

THE CHECK IS ON COMPETITIONS, NOT ON EMAILS, and that is the load-bearing part. "Has a `welcome`
row been queued?" would depend on which email the operator or the cron happened to process first
- run this one first and no row exists yet, so both would send. "Is this person in a competition?"
is a fact about the world. Neither email writes to competition_user or competition, so nothing
either send does can change the other's answer, and ORDER NEVER MATTERS. That is the whole reason
it is written this way; do not "simplify" it into a check against email_queue.

Evaluated live, at send time, because send-emails calls findCandidates itself rather than trusting
the list on screen. No stored flag, and nothing marked in advance - the clause IS the mechanism.
*/

/*
How long after signing up before we conclude they are not going to start anything. Registration
cannot tell us: routes/register.js takes a name, an email and a password and nothing else, and the
join or the create is a separate call afterwards - sub-second on /join/[code], minutes on the
create flow. So the question can only be answered later, and this is how much later.

Measured across 219 accounts when this was set: 99 acted within the hour, 10 more within the day,
12 after it, 98 never. So 24 hours catches 90% of everyone who ever starts something. The dozen
stragglers get this email and then a competition email more than a day later, which reads as two
separate things happening rather than as a duplicate - stretching the window to chase them would
cost every idle signup a longer wait for no real gain.
*/
const SETTLING_HOURS = 24;

/*
No backfill - and it is now DATA rather than a date in code. Retired 2026-08-14.

The rule has not changed: nobody who already had an account when this email was built ever gets
it. A welcome to somebody who signed up in September 2025 is a bad email on its own terms.

What changed is how that is enforced. There was a CUTOFF constant here ('2026-08-11T13:00:00Z')
excluding anyone created before it. It did the same job as marking somebody as sent, by a
different means - by date, permanently, and invisibly: nothing on the admin screen said it was
there, so the count shown had a filter behind it that nobody could see. Two mechanisms for one
rule is exactly the duplication this codebase has had to unpick three times.

So the 216 accounts it was hiding were written off explicitly instead
(db/mark-join-lms-backlog-skipped.sql, run once), and the once-ever guard below - which already
excluded any user with a join_lms row whatever its status - now does the whole job on its own.
The number on the card is the truth with nothing behind it.

Deliberately not filtered by opt-out when those rows were written: an opt-out suppresses today
but can be reversed tomorrow, and "nobody who already existed" has to hold regardless.
*/

/*
The subject, a constant because the tracking row is written before the template is built and the
two must match - a tracking row whose subject is not what landed in the inbox is worse than no
tracking row. emailService.buildJoinLmsEmail reads this same constant.
*/
const SUBJECT = 'Welcome to LMS Local';

/**
 * Find every user who should get the Join LMS welcome.
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

      -- Long enough after signing up to know whether they were going to start anything. See
      -- SETTLING_HOURS: registration itself cannot tell us, so the question is asked later.
      AND u.created_at < NOW() - ($1 || ' hours')::interval

      -- One welcome, not two. Anyone who joined or created a competition is welcomed by THAT
      -- email instead. Read off the competition tables rather than off email_queue on purpose,
      -- so no processing order can produce a different answer - see the note by SETTLING_HOURS.
      -- Any membership counts, whatever its status: somebody knocked out of the only competition
      -- they were ever in has still started, and does not want welcoming to the platform now.
      AND NOT EXISTS (
        SELECT 1 FROM competition_user cu
        WHERE cu.user_id = u.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM competition c
        WHERE c.organiser_id = u.id
      )

      -- Once only, ever. Covers sent, failed AND skipped rows, so pressing send twice does not
      -- welcome the same person twice - and so the 216 pre-existing accounts marked as sent in
      -- Aug 2026 can never come back. This one clause is the whole no-backfill rule now.
      AND NOT EXISTS (
        SELECT 1 FROM email_queue eq
        WHERE eq.user_id = u.id
          AND eq.email_type = '${EMAIL_TYPE}'
      )
      -- Opt-outs, defined once in services/emailPreference.js. There is no competition to mute
      -- here, so the per-competition arm of that test is passed a NULL it can never match.
      AND ${notOptedOutSql({ userColumn: 'u.id', competitionColumn: 'NULL::int', groupParam: '$2' })}

    ORDER BY u.created_at, u.id
  `, [String(SETTLING_HOURS), groupFor(EMAIL_TYPE)]);

  return result.rows;
}

/**
 * Build the template data one Join LMS email needs.
 *
 * Nothing here is per-competition, so unlike the pick reminder there are no extra lookups - only
 * the recipient's unsubscribe token.
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
 * Queue one Join LMS email, and open its tracking row.
 *
 * competition_id is NULL on both rows. The column is nullable on each table, and a platform-wide
 * email has no competition to point at - 0 would collide with the sentinel email_preference uses
 * for a global preference.
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
    console.error('joinLms.queueCandidate failed:', { user_id: candidate.user_id, error: error.message });
    return { success: false, error: error.message };
  }
}

module.exports = {
  EMAIL_TYPE,
  SUBJECT,
  findCandidates,
  buildTemplateData,
  queueCandidate
};
