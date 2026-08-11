/*
=======================================================================================================================================
Join LMS Service
=======================================================================================================================================
Purpose: The one definition of who should receive the "welcome to LMS Local" email, and how their
         email is built. Outline row: All | Welcome | Join LMS.

This is the email a person gets once, when they first create an LMS Local account - whether they
arrived by joining someone's competition or by setting one up themselves. It is deliberately NOT
the same thing as `welcome` (Player | Welcome | Join Comp), which fires per competition joined.

Nothing in routes/register.js triggers this. Sending is operator-driven from the admin Emails
screen, like every other comms email - see docs/email/README.md, "Sending is manual". Registration
therefore never depends on Resend being up, and every send can be previewed and test-sent first.

The eligibility rules, all in findCandidates below:
  - account created on or after CUTOFF (see the note on that constant)
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
No backfill. Decision, 2026-08-11.

244 accounts existed when this was built and none of them had ever had a welcome email. Without a
cutoff the first live press would have welcomed people who signed up months ago - a bad email on
its own terms, and two and a half days of the 100/day Resend limit spent saying it.

A fixed timestamp rather than a rolling window, because the rule is "only people who sign up from
now on", not "only recent signups". A rolling window would quietly start mailing anyone we missed
during a fortnight's outage; this cannot. It is set just after the newest account at the time of
writing (12:14 UTC), so nobody who already existed can qualify however long this sits unsent.

The Z matters. db/query.js prints timestamps in local time - British Summer Time, an hour ahead -
so a value copied straight off that output lands an hour in the FUTURE and silently excludes
everyone who signs up in between. That is what the first attempt did.
*/
const CUTOFF = '2026-08-11T13:00:00Z';

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
      AND u.created_at >= $1::timestamptz
      -- Once only, ever. Covers sent and failed rows too, so pressing send twice does not
      -- welcome the same person twice.
      AND NOT EXISTS (
        SELECT 1 FROM email_queue eq
        WHERE eq.user_id = u.id
          AND eq.email_type = '${EMAIL_TYPE}'
      )
      -- Opt-outs, defined once in services/emailPreference.js. There is no competition to mute
      -- here, so the per-competition arm of that test is passed a NULL it can never match.
      AND ${notOptedOutSql({ userColumn: 'u.id', competitionColumn: 'NULL::int', groupParam: '$2' })}

    ORDER BY u.created_at, u.id
  `, [CUTOFF, groupFor(EMAIL_TYPE)]);

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
  CUTOFF,
  SUBJECT,
  findCandidates,
  buildTemplateData,
  queueCandidate
};
