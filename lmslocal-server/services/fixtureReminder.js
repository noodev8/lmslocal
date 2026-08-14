/*
=======================================================================================================================================
Fixture Reminder Service
=======================================================================================================================================
Purpose: The one definition of which organiser owes their competition its next set of fixtures.
         Outline row: Organiser | Game | Fixture reminder.

The mirror of gameStartReminder, for the other half of the platform. An organiser-managed
competition gets nothing pushed to it: when a round is settled, the competition simply stops until
someone types the next round's fixtures in. Players see "no fixtures yet" and have nobody to ask
but the organiser, who may well think the next round appears on its own.

Platform-wide rather than competition-scoped, for the same reason as the game start reminder: the
question is "who is holding their players up?", and the operator wants the list.

The eligibility rules, all in findCandidates below:
  - fixture_service = false. This is the whole point of the email - an automated competition is
    sent its fixtures, so telling that organiser to add some would be asking them to do work we
    do ourselves. gameStartReminder takes fixture_service = true; the two never overlap.
  - the latest round is settled: it has fixtures, and every one of them has `processed` set. A
    round with an unprocessed fixture is waiting on results, which is a different email.
  - nothing newer exists - read off the highest round_number, so an organiser who has already
    added the next round is not chased for it
  - settled at least REMINDER_AFTER_DAYS ago, so this never lands the same evening they entered
    the results
  - competition is not COMPLETE, and at least two players are still active
  - nothing sent for this competition in the last COOLDOWN_DAYS
  - organiser has a real email and has not opted out of organiser.game

The two-active-players rule is belt and braces. organizer-process-results sets the competition
COMPLETE when a winner emerges, so a competition down to one player should never reach here - but
if the status column ever disagrees with the players table, a finished competition being chased
for fixtures is the worse failure of the two.

Unlike gameStartReminder there is no second evaluation stage. "Would pressing Ready produce a
round?" needed the staged batch and could not be expressed in SQL; "is the last round settled and
is there nothing after it?" is entirely in these tables.

Nothing guards a backfill here, as with the other reminders: eligibility is live state - fixtures
are owed today - so no history can accumulate for this to work through.
=======================================================================================================================================
*/

const { query } = require('../database');
const { notOptedOutSql, groupFor, getOrCreateToken, unsubscribeLinks } = require('./emailPreference');

const EMAIL_TYPE = 'fixture_reminder';

/*
How long after the last round settles before the organiser is chased. Deliberately short compared
with the game start reminder's fortnight: that one waits on an organiser gathering players, this
one waits on a competition that is already running and whose players are waiting on the next round.
Long enough not to arrive the same evening they entered the results.
*/
const REMINDER_AFTER_DAYS = 3;

/*
A nudge, not a lifecycle email, so the once-ever rule the welcome emails use would waste it: an
organiser who missed the first one is exactly the organiser worth reminding again.
*/
const COOLDOWN_DAYS = 7;

/**
 * The subject line. A function because it carries the competition name, and the tracking row is
 * written before the template is built - the two have to say the same thing.
 */
const subjectFor = (competitionName) => `${competitionName} is waiting on the next round`;

/**
 * Find every organiser whose competition is settled and waiting for fixtures.
 *
 * One query, unlike gameStartReminder's two stages - everything this needs is in these tables.
 *
 * @returns {Promise<Array>} candidate rows, each carrying everything buildTemplateData needs
 */
async function findCandidates() {
  const result = await query(`
    SELECT
      c.organiser_id         AS user_id,
      u.email                AS user_email,
      u.display_name         AS user_display_name,
      c.id                   AS competition_id,
      c.name                 AS competition_name,
      last_round.round_number AS last_round_number,
      last_round.settled_at,
      (
        SELECT COUNT(*) FROM competition_user cu
        WHERE cu.competition_id = c.id
          AND cu.status = 'active'
          AND cu.user_id != c.organiser_id
      ) AS active_player_count

    FROM competition c

    INNER JOIN app_user u
      ON u.id = c.organiser_id
      AND u.email IS NOT NULL
      AND u.email != ''
      AND u.email NOT LIKE '%@lms-guest.com'

    /*
    The competition's most recent round, and when it settled. LATERAL rather than a join on
    MAX(round_number) so the fixture aggregate is computed once, for that round only.
    */
    INNER JOIN LATERAL (
      SELECT
        r.id,
        r.round_number,
        MAX(f.processed)                             AS settled_at,
        COUNT(f.id)                                  AS fixture_count,
        COUNT(f.id) FILTER (WHERE f.processed IS NULL) AS unprocessed_count
      FROM round r
      LEFT JOIN fixture f ON f.round_id = r.id
      WHERE r.competition_id = c.id
      GROUP BY r.id, r.round_number
      ORDER BY r.round_number DESC
      LIMIT 1
    ) last_round ON true

    WHERE c.fixture_service = false
      AND UPPER(c.status) != 'COMPLETE'

      -- Settled: fixtures exist and every one has been processed. A round still carrying an
      -- unprocessed fixture is waiting on results, which is Result reminder's job.
      AND last_round.fixture_count > 0
      AND last_round.unprocessed_count = 0
      AND last_round.settled_at <= NOW() - ($1 || ' days')::interval

      -- A competition down to one player has a winner, whatever the status column says.
      AND (
        SELECT COUNT(*) FROM competition_user cu
        WHERE cu.competition_id = c.id
          AND cu.status = 'active'
          AND cu.user_id != c.organiser_id
      ) >= 2

      -- Cooldown, not once-ever. Re-eligible a week after the last attempt, sent or failed.
      AND NOT EXISTS (
        SELECT 1 FROM email_queue eq
        WHERE eq.competition_id = c.id
          AND eq.email_type = '${EMAIL_TYPE}'
          AND eq.created_at > NOW() - ($2 || ' days')::interval
      )

      -- Opt-outs, defined once in services/emailPreference.js
      AND ${notOptedOutSql({ userColumn: 'u.id', competitionColumn: 'c.id', groupParam: '$3' })}

    ORDER BY last_round.settled_at, c.id
  `, [String(REMINDER_AFTER_DAYS), String(COOLDOWN_DAYS), groupFor(EMAIL_TYPE)]);

  return result.rows;
}

/**
 * Build the template data one reminder needs.
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
    last_round_number,
    settled_at,
    active_player_count
  } = candidate;

  const token = await getOrCreateToken(user_id);
  const unsubscribe = token ? unsubscribeLinks(token, groupFor(EMAIL_TYPE)) : null;

  return {
    email_tracking_id: `${EMAIL_TYPE}_${competition_id}_${Date.now()}`,
    unsubscribe,
    user_email,
    user_display_name,
    competition_id,
    competition_name,
    last_round_number: Number(last_round_number),
    // The round they owe. Named in the copy so the email says what to do, not just that something
    // is outstanding.
    next_round_number: Number(last_round_number) + 1,
    settled_at,
    active_player_count: Number(active_player_count) || 0,
    user_id
  };
}

/**
 * Queue one reminder, and open its tracking row.
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
    console.error('fixtureReminder.queueCandidate failed:', { competition_id: candidate.competition_id, error: error.message });
    return { success: false, error: error.message };
  }
}

module.exports = {
  EMAIL_TYPE,
  REMINDER_AFTER_DAYS,
  COOLDOWN_DAYS,
  subjectFor,
  findCandidates,
  buildTemplateData,
  queueCandidate
};
