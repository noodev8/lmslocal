/*
=======================================================================================================================================
Created Competition Service
=======================================================================================================================================
Purpose: The one definition of which organiser should be told their competition is set up, and how
         that email is built. Outline row: Organiser | Welcome | Created Comp.

Sent once per competition, to the person who created it. Competition-scoped, so the admin screen's
picker chooses which one - there is exactly one recipient per press.

Nothing in routes/create-competition.js triggers this. Sending is operator-driven from the admin
Emails screen like every other comms email; see docs/email/README.md.

The eligibility rules, all in findCandidates below:
  - competition created on or after CUTOFF (see the note on that constant)
  - organiser has a real email (guest and bot accounts both use @lms-guest.com)
  - no created_comp already queued for this competition, whatever its status
  - not opted out of organiser.welcome, per services/emailPreference.js

What the email is FOR (decision, 2026-08-11): it arrives seconds after the organiser has seen the
same confirmation on screen, so repeating that screen would waste it. Its job is to be findable in
an inbox a week later, when they are standing in the pub trying to get people in - so the invite
code and join link are the content, framed as the thing to forward.
=======================================================================================================================================
*/

const { query } = require('../database');
const { notOptedOutSql, groupFor, getOrCreateToken, unsubscribeLinks } = require('./emailPreference');

const EMAIL_TYPE = 'created_comp';

/*
No backfill. Same decision as Join LMS, and for the same reason: 18 competitions existed when this
was built and none had ever had this email. "You have created a competition" about one set up in
June is a bad email whoever receives it.

Set just after the newest competition at the time of writing (2026-08-10 21:55 UTC), so nothing
that already existed can qualify however long this sits unsent.

The Z matters - db/query.js prints local time, BST, an hour ahead. A value copied straight off
that output lands an hour in the future and silently excludes real signups. That has already
happened once, on services/joinLms.js.
*/
const CUTOFF = '2026-08-11T16:45:00Z';

/*
The subject is a constant because the tracking row is written before the template is built and the
two have to say the same thing. It carries the competition name, so unlike Join LMS's it is a
function rather than a string.
*/
const subjectFor = (competitionName) => `${competitionName} is ready to share`;

/**
 * Find every organiser who should be told their competition is set up.
 *
 * @param {object} [opts]
 * @param {number} [opts.competition_id] - restrict to one competition, which is what the admin
 *                                         screen always does. Omit to scan them all.
 * @returns {Promise<Array>} candidate rows, each carrying everything buildTemplateData needs
 */
async function findCandidates(opts = {}) {
  const { competition_id = null } = opts;

  const result = await query(`
    SELECT
      c.organiser_id         AS user_id,
      u.email                AS user_email,
      u.display_name         AS user_display_name,
      c.id                   AS competition_id,
      c.name                 AS competition_name,
      c.invite_code,
      c.fixture_service,
      c.created_at

    FROM competition c

    INNER JOIN app_user u
      ON u.id = c.organiser_id
      AND u.email IS NOT NULL
      AND u.email != ''
      AND u.email NOT LIKE '%@lms-guest.com'

    WHERE c.created_at >= $1::timestamptz
      -- Once per competition, ever. Covers sent and failed rows too, so pressing send twice does
      -- not congratulate the same organiser twice.
      AND NOT EXISTS (
        SELECT 1 FROM email_queue eq
        WHERE eq.competition_id = c.id
          AND eq.email_type = '${EMAIL_TYPE}'
      )
      -- Opt-outs, defined once in services/emailPreference.js
      AND ${notOptedOutSql({ userColumn: 'u.id', competitionColumn: 'c.id', groupParam: '$2' })}
      -- Optional competition filter. Passing NULL leaves every competition in.
      AND ($3::int IS NULL OR c.id = $3)

    ORDER BY c.created_at, c.id
  `, [CUTOFF, groupFor(EMAIL_TYPE), competition_id]);

  return result.rows;
}

/**
 * Build the template data one Created Comp email needs.
 *
 * @param {object} candidate - a row from findCandidates
 * @returns {Promise<object>} template data, stored on email_queue.template_data
 */
async function buildTemplateData(candidate) {
  const {
    user_id,
    user_email,
    user_display_name,
    competition_id,
    competition_name,
    invite_code,
    fixture_service
  } = candidate;

  /*
  Resolved at queue time so the stored template_data is self-contained - a queued email must still
  render correctly if it is sent later.
  */
  const token = await getOrCreateToken(user_id);
  const unsubscribe = token ? unsubscribeLinks(token, groupFor(EMAIL_TYPE)) : null;

  return {
    email_tracking_id: `${EMAIL_TYPE}_${competition_id}_${Date.now()}`,
    unsubscribe,
    user_email,
    user_display_name,
    competition_id,
    competition_name,
    invite_code,
    /*
    Whether to include the "press Ready" step. Only fixture-service competitions have that button,
    and the column is fixed at creation (update-competition ignores it - see CLAUDE.md), so this
    cannot go stale between queueing and sending.
    */
    fixture_service: !!fixture_service,
    user_id
  };
}

/**
 * Queue one Created Comp email, and open its tracking row.
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
      ) VALUES ($1, $2, NULL, '${EMAIL_TYPE}', NOW(), $3, 'pending', 0)
      RETURNING id
    `, [candidate.user_id, candidate.competition_id, JSON.stringify(templateData)]);

    await query(`
      INSERT INTO email_tracking (email_id, user_id, competition_id, email_type, subject)
      VALUES ($1, $2, $3, '${EMAIL_TYPE}', $4)
    `, [
      templateData.email_tracking_id,
      candidate.user_id,
      candidate.competition_id,
      subjectFor(templateData.competition_name)
    ]);

    return { success: true, queue_id: queueResult.rows[0].id, template_data: templateData };
  } catch (error) {
    console.error('createdComp.queueCandidate failed:', { competition_id: candidate.competition_id, error: error.message });
    return { success: false, error: error.message };
  }
}

module.exports = {
  EMAIL_TYPE,
  CUTOFF,
  subjectFor,
  findCandidates,
  buildTemplateData,
  queueCandidate
};
