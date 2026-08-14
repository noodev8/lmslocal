/*
=======================================================================================================================================
Hints Service
=======================================================================================================================================
Purpose: Occasional training for organisers - one feature, one email, a few days apart.
         Outline rows: Organiser | Info | Hint - *.

HINTS ARE A LIST, NOT AN EMAIL EACH. The list is expected to grow and shrink as the outline is
edited, so everything that would otherwise be copied per hint - the candidate query, the template,
the queueing, the guards - is shared, and a hint is an entry in HINTS with a day offset, an
applicability rule and its copy. Adding one is an entry. Removing one is a deletion.

Each hint keeps its own catalog entry and outline row so the admin screen can send them
independently and email_queue.email_type stays meaningful per hint. serviceFor(key) returns the
catalog-shaped service for one of them.

The guards, and why each exists:

  ONCE PER ORGANISER PER HINT, EVER - not per competition. Somebody running four competitions
  would otherwise be taught the same lesson four times. A hint teaches the person, not the
  competition; when several of their competitions qualify, the oldest is the one named.

  ONE HINT PER ORGANISER PER WEEK. With two hints at offsets 3 and 7 this rarely bites. With six
  it would, and retrofitting it after somebody receives three in a morning is much harder than
  having it from the start.

  APPLICABILITY, per hint. The mid-round hint is meaningless - actively wrong - for an automated
  competition, whose organiser never enters a result at all.

There is no backfill guard and no cooldown beyond the above: a hint is sent once and never again.
=======================================================================================================================================
*/

const { query } = require('../database');
const { notOptedOutSql, groupFor, getOrCreateToken, unsubscribeLinks } = require('./emailPreference');

// No organiser gets two hints closer together than this, whatever their offsets say.
const HINT_SPACING_DAYS = 7;

/*
The hints themselves.

`extraSql` is ANDed into the candidate query and may only reference `c` (competition). Keep it to
things that decide whether the advice is POSSIBLE for that organiser - not whether it is useful,
which is a judgement the email itself can make in a sentence.
*/
const HINTS = {
  promote_competition: {
    afterDays: 3,
    extraSql: null,
    subject: 'Getting players into your competition',
    heading: 'There is a page that writes your invites for you',
    /*
    Everything named here exists on /game/[id]/promote today. Deliberately does NOT mention
    broadcasting a message to members: Broadcast from Organiser was dropped rather than deferred
    (docs/email/README.md), so there is nothing to teach, and a hint teaching a feature that does
    not exist is worse than no hint at all.
    */
    body: [
      'Getting people to join is the hardest part of running a competition, and it is the part we can actually help with.',
      'Your competition has a Promote page with ready-made WhatsApp messages you can edit and copy, an image for Facebook or Instagram, a QR code for a poster behind the bar, and your join link ready to paste anywhere.',
      'Most organisers find one good WhatsApp message to the right group does more than anything else.'
    ],
    ctaLabel: 'Open your Promote page',
    ctaPath: (competitionId) => `/game/${competitionId}/promote`
  },

  update_scores_mid_round_tip: {
    afterDays: 7,
    /*
    Manual competitions only, and only once they have fixtures to enter results against. An
    automated competition refuses organiser result entry outright (AUTOMATED_COMPETITION), and at
    day 7 plenty of competitions are still in SETUP with nothing to practise on.
    */
    extraSql: `
      c.fixture_service = false
      AND EXISTS (
        SELECT 1 FROM round r
        INNER JOIN fixture f ON f.round_id = r.id
        WHERE r.competition_id = c.id
      )
    `,
    subject: 'You do not have to wait for the whole round',
    heading: 'Enter results as the matches finish',
    body: [
      'You can put results in as they come in, rather than waiting for the last match of the round to kick off.',
      'Enter a result and process it, and anyone whose team has lost is out there and then - they find out on Saturday evening instead of Sunday night, and the players still in can see where they stand.',
      'The rest of the round carries on as normal. You can keep adding results as the matches finish.'
    ],
    ctaLabel: 'Open your current round',
    ctaPath: (competitionId) => `/game/${competitionId}/round`
  }
};

/** Every hint key. Used for the shared weekly-spacing guard. */
const HINT_TYPES = Object.keys(HINTS);

/**
 * The subject line for a hint.
 * @param {string} hintKey
 * @returns {string}
 */
const subjectFor = (hintKey) => HINTS[hintKey]?.subject || 'A tip for your competition';

/**
 * Find every organiser due one particular hint.
 *
 * DISTINCT ON collapses to one row per organiser: the guard is once per PERSON, so a query
 * returning three of their competitions would queue three copies of the same lesson.
 *
 * @param {string} hintKey
 * @returns {Promise<Array>} candidate rows
 */
async function findCandidatesFor(hintKey) {
  const hint = HINTS[hintKey];
  if (!hint) return [];

  const result = await query(`
    SELECT DISTINCT ON (c.organiser_id)
      c.organiser_id   AS user_id,
      u.email          AS user_email,
      u.display_name   AS user_display_name,
      c.id             AS competition_id,
      c.name           AS competition_name,
      c.created_at

    FROM competition c

    INNER JOIN app_user u
      ON u.id = c.organiser_id
      AND u.email IS NOT NULL
      AND u.email != ''
      AND u.email NOT LIKE '%@lms-guest.com'

    WHERE UPPER(c.status) != 'COMPLETE'
      AND c.created_at <= NOW() - ($1 || ' days')::interval
      ${hint.extraSql ? `AND (${hint.extraSql})` : ''}

      -- Once per organiser per hint, ever. Not scoped to the competition: the same person does
      -- not need the same lesson again because they made another competition.
      AND NOT EXISTS (
        SELECT 1 FROM email_queue eq
        WHERE eq.user_id = c.organiser_id
          AND eq.email_type = '${hintKey}'
      )

      -- And not within a week of any other hint.
      AND NOT EXISTS (
        SELECT 1 FROM email_queue eq
        WHERE eq.user_id = c.organiser_id
          AND eq.email_type = ANY($2::text[])
          AND eq.created_at > NOW() - ($3 || ' days')::interval
      )

      -- Opt-outs, defined once in services/emailPreference.js
      AND ${notOptedOutSql({ userColumn: 'u.id', competitionColumn: 'c.id', groupParam: '$4' })}

    -- Oldest competition per organiser: the one they are most likely to think of as theirs.
    ORDER BY c.organiser_id, c.created_at, c.id
  `, [String(hint.afterDays), HINT_TYPES, String(HINT_SPACING_DAYS), groupFor(hintKey)]);

  return result.rows.map((row) => ({ ...row, hint_key: hintKey }));
}

/**
 * Build the template data one hint email needs.
 *
 * @param {object} candidate - a row from findCandidatesFor, carrying hint_key
 * @returns {Promise<object>} template data, stored on email_queue.template_data
 */
async function buildTemplateData(candidate) {
  const { user_id, user_email, user_display_name, competition_id, competition_name, hint_key } = candidate;

  const hint = HINTS[hint_key];
  const token = await getOrCreateToken(user_id);
  const unsubscribe = token ? unsubscribeLinks(token, groupFor(hint_key)) : null;

  return {
    email_tracking_id: `${hint_key}_${competition_id}_${Date.now()}`,
    unsubscribe,
    user_email,
    user_display_name,
    competition_id,
    competition_name,
    /*
    The copy is resolved here, at queue time, rather than looked up when the email is built. A
    queued hint then renders as it was written even if the list is edited in between - the same
    reason the unsubscribe link is stored rather than rebuilt.
    */
    hint_key,
    heading: hint.heading,
    body: hint.body,
    cta_label: hint.ctaLabel,
    cta_path: hint.ctaPath(competition_id),
    user_id
  };
}

/**
 * Queue one hint, and open its tracking row.
 *
 * @param {object} candidate - a row from findCandidatesFor
 * @returns {Promise<{success: boolean, queue_id?: number, template_data?: object, error?: string}>}
 */
async function queueCandidate(candidate) {
  try {
    const templateData = await buildTemplateData(candidate);

    const queueResult = await query(`
      INSERT INTO email_queue (
        user_id, competition_id, round_id, email_type,
        scheduled_send_at, template_data, status, attempts
      ) VALUES ($1, $2, NULL, $3, NOW(), $4, 'pending', 0)
      RETURNING id
    `, [candidate.user_id, candidate.competition_id, candidate.hint_key, JSON.stringify(templateData)]);

    await query(`
      INSERT INTO email_tracking (email_id, user_id, competition_id, email_type, subject)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      templateData.email_tracking_id,
      candidate.user_id,
      candidate.competition_id,
      candidate.hint_key,
      subjectFor(candidate.hint_key)
    ]);

    return { success: true, queue_id: queueResult.rows[0].id, template_data: templateData };
  } catch (error) {
    console.error('hints.queueCandidate failed:', { hint: candidate.hint_key, competition_id: candidate.competition_id, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * The catalog-shaped service for one hint.
 *
 * The catalog wants an object with findCandidates/buildTemplateData/queueCandidate per email type;
 * hints share all three, so this binds the key and hands back that shape.
 *
 * @param {string} hintKey
 * @returns {{findCandidates: Function, buildTemplateData: Function, queueCandidate: Function, EMAIL_TYPE: string}}
 */
function serviceFor(hintKey) {
  return {
    EMAIL_TYPE: hintKey,
    findCandidates: () => findCandidatesFor(hintKey),
    buildTemplateData,
    queueCandidate
  };
}

module.exports = {
  HINTS,
  HINT_TYPES,
  HINT_SPACING_DAYS,
  subjectFor,
  findCandidatesFor,
  buildTemplateData,
  queueCandidate,
  serviceFor
};
