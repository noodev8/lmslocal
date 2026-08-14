/*
=======================================================================================================================================
Share Reminder Service
=======================================================================================================================================
Purpose: The one definition of which organiser is about to lose their joining window, and how that
         email is built. Outline row: Organiser | Game | Share reminder.

Round 1 locking is not only a pick deadline - it is when JOINING CLOSES
(routes/join-competition-by-code.js:134-151). Everyone in a competition has to start together, or
a late joiner would face opponents who had already burned teams, so the doors shut when the first
round does. That makes the days before round 1 the entire recruiting window a competition ever
gets, and until this email nothing told the organiser there was a clock on it.

Why it exists at all: docs/competition-start.md changed what a new competition looks like. Round 1
now exists from creation with a real date attached, so for the first time there IS a deadline to
warn about. Before, there was nothing to name.

NOT a replacement for gameStartReminder, and the two can never overlap: that one requires a
competition with no rounds at all, this one requires round 1 to exist and be about to lock.

Read docs/email/README.md before changing any of this, and change the doc first. Its rules were
written alongside the code rather than agreed first, which is the wrong way round - treat them as
a proposal to correct.
=======================================================================================================================================
*/

const { query } = require('../database');
const { notOptedOutSql, groupFor, getOrCreateToken, unsubscribeLinks } = require('./emailPreference');

const EMAIL_TYPE = 'share_reminder';

/*
How long before round 1 locks this goes out. Two days is enough for an organiser to get a message
into a group chat and short enough that "last chance" is honestly true - a week out it would just
be noise, and they would have forgotten by the time it mattered.
*/
const REMINDER_BEFORE_HOURS = 48;

/*
No CUTOFF, unlike the welcome emails. Eligibility is "round 1 locks inside the next 48 hours",
which nothing historical can satisfy however long this sits unsent - a competition that started
last month has a lock time in the past. There is no backfill to guard against.
*/

/*
The subject carries the competition name, so it is a function - the tracking row is written before
the template is built and the two have to say the same thing.
*/
const subjectFor = (competitionName) => `Last chance to get players into ${competitionName}`;

/**
 * Find every organiser whose round 1 is about to lock.
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
      r.id                   AS round_id,
      r.lock_time            AS starts_at,

      /*
      Active members only, and guests counted with everyone else - a guest the organiser added by
      hand is a player as far as "have you got enough people" goes. The organiser's own playing
      row counts too, which is why the copy branches at 2 rather than 1.
      */
      (SELECT COUNT(*) FROM competition_user cu
        WHERE cu.competition_id = c.id AND cu.status = 'active') AS player_count

    FROM competition c

    /*
    Round 1 specifically. This is about the join deadline, not about picks - pick_reminder chases
    those every round - and joining only ever closes once, when the first round locks.
    */
    INNER JOIN round r
      ON r.competition_id = c.id
      AND r.round_number = 1

    INNER JOIN app_user u
      ON u.id = c.organiser_id
      AND u.email IS NOT NULL
      AND u.email != ''
      AND u.email NOT LIKE '%@lms-guest.com'

    WHERE UPPER(c.status) != 'COMPLETE'
      -- Still open, and closing soon. Both halves matter: past the lock there is nothing to
      -- share, and further out than this it is not yet news.
      AND r.lock_time > NOW()
      AND r.lock_time <= NOW() + ($1 || ' hours')::interval
      -- Once per competition, ever. Round 1 locks once; a second send would be chasing a
      -- deadline that had already gone.
      AND NOT EXISTS (
        SELECT 1 FROM email_queue eq
        WHERE eq.competition_id = c.id
          AND eq.email_type = '${EMAIL_TYPE}'
      )
      -- Opt-outs, defined once in services/emailPreference.js
      AND ${notOptedOutSql({ userColumn: 'u.id', competitionColumn: 'c.id', groupParam: '$2' })}
      -- Optional competition filter. Passing NULL leaves every competition in.
      AND ($3::int IS NULL OR c.id = $3)

    ORDER BY r.lock_time, c.id
  `, [REMINDER_BEFORE_HOURS, groupFor(EMAIL_TYPE), competition_id]);

  return result.rows;
}

/**
 * Build the template data one Share reminder needs.
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
    starts_at,
    player_count
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
    starts_at,
    player_count: parseInt(player_count, 10) || 0,
    user_id
  };
}

/**
 * Queue one Share reminder, and open its tracking row.
 *
 * @param {object} candidate - a row from findCandidates
 * @returns {Promise<{success: boolean, queue_id?: number, template_data?: object, error?: string}>}
 */
async function queueCandidate(candidate) {
  try {
    const templateData = await buildTemplateData(candidate);

    /*
    round_id is carried even though the once-per-competition guard does not use it. Round 1 is the
    round this email is about, and a queue row that names it is what makes the send auditable
    against the deadline it was warning about.
    */
    const queueResult = await query(`
      INSERT INTO email_queue (
        user_id, competition_id, round_id, email_type,
        scheduled_send_at, template_data, status, attempts
      ) VALUES ($1, $2, $3, '${EMAIL_TYPE}', NOW(), $4, 'pending', 0)
      RETURNING id
    `, [
      candidate.user_id,
      candidate.competition_id,
      candidate.round_id,
      JSON.stringify(templateData)
    ]);

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
    console.error('shareReminder.queueCandidate failed:', { competition_id: candidate.competition_id, error: error.message });
    return { success: false, error: error.message };
  }
}

module.exports = {
  EMAIL_TYPE,
  REMINDER_BEFORE_HOURS,
  subjectFor,
  findCandidates,
  buildTemplateData,
  queueCandidate
};
