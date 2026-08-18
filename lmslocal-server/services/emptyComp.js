/*
=======================================================================================================================================
Empty Competition Service
=======================================================================================================================================
Purpose: The one definition of which organiser set a competition up and never got anybody into it,
         and how that email is built.

REPLACED services/signupNudge.js, 2026-08-18, before either was ever sent. That one chased people
who registered and did nothing at all - 98 of them, a bigger number than this by a factor of
twenty. It was dropped on a judgement about warmth, not volume: registering is free and takes a
minute, so a dormant signup may only ever have been looking. Naming a competition, choosing a
prize structure and picking a start date is somebody who had a go and stalled. Fewer people,
much further down the funnel, and only one nudge email is wanted.

The state this is about has nothing else pointing at it. share_reminder (built, unwired) needs
round 1 to exist and lock within 48 hours; three of the four competitions in this state when it
was written had no rounds at all, so it would never have fired for them. There is no deadline
attached to "created it and never told anyone" - which is exactly why it goes unnoticed.

The eligibility rules, all in findCandidates below:
  - competition created more than NUDGE_AFTER_DAYS ago
  - nobody has joined it but the organiser themselves
  - competition not COMPLETE
  - organiser has a real email (guest and bot accounts both use @lms-guest.com)
  - no empty_comp already queued for this competition, whatever its status
  - not opted out of the Info group, per services/emailPreference.js

Scoped, like created_comp: it names one competition and carries that competition's code, so the
grain is one email per competition rather than one per organiser. Somebody who set up two empty
competitions has two of them to fill.
=======================================================================================================================================
*/

const { query } = require('../database');
const { notOptedOutSql, groupFor, getOrCreateToken, unsubscribeLinks } = require('./emailPreference');

const EMAIL_TYPE = 'empty_comp';

/*
How long a competition sits empty before its organiser is asked about it. Andreas's call,
2026-08-18, carried over from the email this replaced.

Long enough that it is not chasing somebody who set one up this morning and is getting to the
sharing tonight, short enough to land while they still mean to do it. The four competitions in
this state when it was written were 9, 15, 29 and 33 days old, so a week is comfortably inside the
window where this is still news to them.
*/
const NUDGE_AFTER_DAYS = 7;

/*
What counts as empty: NOBODY BUT THE ORGANISER HAS JOINED - the organiser's own row excluded by
id rather than counted and allowed for with a threshold.

The obvious version is "one member or fewer", because most organisers play in their own
competition and hold a row of their own. It is wrong in a way that only shows up in the copy: at a
count of one, the member MIGHT be the organiser, or it might be one real person who joined and is
sitting there on their own. Those are opposite situations, and an email opening "nobody has joined
yet" is a lie in the second - to the one organiser who did get somebody in.

Excluding the organiser by id collapses that. The count is of people who ANSWERED, so zero means
zero, whether or not the organiser plays too. Competition 208 read nought and 176, 177 and 198 read
one apiece under the old test; all four are the same situation and all four read zero under this
one.
*/

/*
BOTS ARE EXCLUDED FROM THE COUNT BUT GUESTS ARE NOT, and the two look almost identical in the
data - every bot address and every guest address ends @lms-guest.com (services/botPool.js). Only
the bot_ prefix separates them.

It matters in both directions. A guest is somebody the organiser added by hand because they have
no phone or no email; they are a player, they are on the sheet, they can win the thing, and a
competition holding three of them is not empty. A bot is an account we drive, and a competition
seeded with bots and nobody else IS empty however full it looks - which is the case this email
would otherwise miss entirely and silently.
*/
const BOT_EMAIL_LIKE = 'bot_%@lms-guest.com';

/*
The subject carries the competition name, so it is a function rather than a constant - the
tracking row is written before the template is built and the two have to say the same thing.
emailService.buildEmptyCompEmail reads this same function.

A QUESTION, NOT A VERDICT. The first version read "Nobody has joined X yet", which is the query's
finding stated back at the organiser as a fact about their failure. Same information, and it lands
as a scolding before the email is even open. What we actually want to know is whether they still
intend to run it - so the subject asks that, and the answer is allowed to be no.
*/
const subjectFor = (competitionName) => `Still planning to run ${competitionName}?`;

/**
 * Find every competition that was set up and never filled.
 *
 * @param {object} [opts]
 * @param {number} [opts.competition_id] - restrict to one competition, which is what the admin
 *                                         screen does when a competition is picked. Omit to scan
 *                                         them all, which is how the focus card counts.
 * @returns {Promise<Array>} candidate rows, each carrying everything buildTemplateData needs
 */
async function findCandidates(opts = {}) {
  const { competition_id = null } = opts;

  const result = await query(`
    SELECT
      c.organiser_id AS user_id,
      u.email        AS user_email,
      u.display_name AS user_display_name,
      c.id           AS competition_id,
      c.name         AS competition_name,
      c.invite_code,
      c.created_at,

      /*
      Returned as well as tested. It is always nought by definition of the WHERE clause below, and
      it is selected anyway so the row the operator reads on screen carries the number rather than
      asking them to trust the filter.
      */
      (SELECT COUNT(*) FROM competition_user cu
         JOIN app_user au ON au.id = cu.user_id
        WHERE cu.competition_id = c.id
          AND cu.user_id != c.organiser_id
          AND au.email NOT LIKE $3) AS joiner_count

    FROM competition c
    JOIN app_user u ON u.id = c.organiser_id

    WHERE UPPER(c.status) != 'COMPLETE'

      -- Old enough to have been shared by now. See NUDGE_AFTER_DAYS.
      AND c.created_at < NOW() - ($1 || ' days')::interval

      -- Nobody answered. The organiser's own row is excluded by id, not allowed for by a
      -- threshold, so "nobody has joined" in the copy is exactly true rather than nearly true.
      -- Bots excluded, guests counted - see BOT_EMAIL_LIKE, where getting this backwards silently
      -- costs the email either its whole purpose or its honesty.
      AND NOT EXISTS (
        SELECT 1 FROM competition_user cu
          JOIN app_user au ON au.id = cu.user_id
         WHERE cu.competition_id = c.id
           AND cu.user_id != c.organiser_id
           AND au.email NOT LIKE $3
      )

      AND u.email IS NOT NULL
      AND u.email != ''
      -- The ORGANISER's own address, so this excludes guests as well as bots on purpose: neither
      -- can receive email, and a guest account cannot create a competition anyway.
      AND u.email NOT LIKE '%@lms-guest.com'

      -- Once per competition, ever. Covers sent, failed AND skipped rows, so the backlog cleared
      -- with "Mark as sent" before the first send can never come back, and so an organiser who
      -- ignores this is not asked twice. One nudge is the whole promise; a second is nagging
      -- somebody about a competition they have evidently thought better of.
      AND NOT EXISTS (
        SELECT 1 FROM email_queue eq
        WHERE eq.competition_id = c.id
          AND eq.email_type = '${EMAIL_TYPE}'
      )

      -- Opt-outs, defined once in services/emailPreference.js.
      AND ${notOptedOutSql({ userColumn: 'u.id', competitionColumn: 'c.id', groupParam: '$2' })}

      -- Scope, when the admin screen has a competition picked.
      AND ($4::int IS NULL OR c.id = $4::int)

    ORDER BY c.created_at, c.id
  `, [String(NUDGE_AFTER_DAYS), groupFor(EMAIL_TYPE), BOT_EMAIL_LIKE, competition_id]);

  return result.rows;
}

/**
 * Build the template data one empty-competition email needs.
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
    joiner_count
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
    user_id,
    competition_id,
    competition_name,
    invite_code,
    joiner_count: Number(joiner_count)
  };
}

/**
 * Queue one empty-competition email, and open its tracking row.
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
    console.error('emptyComp.queueCandidate failed:', { competition_id: candidate.competition_id, error: error.message });
    return { success: false, error: error.message };
  }
}

module.exports = {
  EMAIL_TYPE,
  subjectFor,
  NUDGE_AFTER_DAYS,
  findCandidates,
  buildTemplateData,
  queueCandidate
};
