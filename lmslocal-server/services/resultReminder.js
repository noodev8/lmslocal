/*
=======================================================================================================================================
Result Reminder Service
=======================================================================================================================================
Purpose: The one definition of which organiser has a played round they have not settled.
         Outline row: Organiser | Game | Result reminder.

The third of the organiser-managed reminders, and the other half of fixtureReminder. That one
waits for a round to be settled and chases the next set of fixtures; this one waits for a round to
be played and NOT settled. A competition in that state is frozen: nobody is eliminated, the next
round cannot open, and every player is waiting on one person.

The two cannot both fire for the same round - one requires no unprocessed fixtures, the other at
least one - so an organiser is never chased twice for the same thing.

The eligibility rules, all in findCandidates below:
  - fixture_service = false. Results for an automated competition arrive with the next push; its
    organiser has nothing to enter.
  - the latest round has at least one unprocessed fixture
  - every kickoff in that round is at least REMINDER_AFTER_HOURS in the past. Kickoff rather than
    the round's lock time: a result cannot exist until the match has actually been played.
  - competition is not COMPLETE, and at least two players are still active
  - nothing sent for this competition in the last COOLDOWN_DAYS
  - organiser has a real email and has not opted out of organiser.game

Entered-but-not-processed is deliberately still a candidate. RESULTS_READY is a real phase in the
round state machine - the organiser has typed every result and not pressed Process - and the
competition is just as frozen as if they had entered nothing. The template says which of the two
it is; see buildResultReminderEmail.
=======================================================================================================================================
*/

const { query } = require('../database');
const { notOptedOutSql, groupFor, getOrCreateToken, unsubscribeLinks } = require('./emailPreference');

const EMAIL_TYPE = 'result_reminder';

/*
How long after the last kickoff in the round before the organiser is chased.

Hours rather than days because this is the most time-critical of the three: the competition is
frozen while it waits. 36 clears a Saturday afternoon round by Sunday evening, which is late
enough not to arrive while matches are still being played and early enough that the next round is
not already in doubt.
*/
const REMINDER_AFTER_HOURS = 36;

/*
A nudge, not a lifecycle email. An organiser who ignored the first one is exactly the one worth
reminding again - and a frozen competition stays frozen until somebody acts.
*/
const COOLDOWN_DAYS = 7;

/**
 * The subject line. A function because it carries the competition name, and the tracking row is
 * written before the template is built - the two have to say the same thing.
 */
const subjectFor = (competitionName) => `${competitionName} is waiting on results`;

/**
 * Find every organiser sitting on a played round they have not settled.
 *
 * @returns {Promise<Array>} candidate rows, each carrying everything buildTemplateData needs
 */
async function findCandidates() {
  const result = await query(`
    SELECT
      c.organiser_id          AS user_id,
      u.email                 AS user_email,
      u.display_name          AS user_display_name,
      c.id                    AS competition_id,
      c.name                  AS competition_name,
      last_round.round_number,
      last_round.fixture_count,
      last_round.unprocessed_count,
      last_round.results_entered,
      last_round.last_kickoff,
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
    The competition's most recent round. LATERAL rather than a join on MAX(round_number) so the
    fixture aggregates are computed once, for that round only.

    results_entered counts fixtures carrying a result whether or not it has been processed - that
    is what separates "nothing typed in yet" from "typed in, never processed", which the template
    says differently.
    */
    INNER JOIN LATERAL (
      SELECT
        r.id,
        r.round_number,
        COUNT(f.id)                                      AS fixture_count,
        COUNT(f.id) FILTER (WHERE f.processed IS NULL)   AS unprocessed_count,
        COUNT(f.id) FILTER (WHERE f.result IS NOT NULL)  AS results_entered,
        MAX(f.kickoff_time)                              AS last_kickoff
      FROM round r
      LEFT JOIN fixture f ON f.round_id = r.id
      WHERE r.competition_id = c.id
      GROUP BY r.id, r.round_number
      ORDER BY r.round_number DESC
      LIMIT 1
    ) last_round ON true

    WHERE c.fixture_service = false
      AND UPPER(c.status) != 'COMPLETE'

      -- Something is outstanding on this round.
      AND last_round.fixture_count > 0
      AND last_round.unprocessed_count > 0

      -- And the matches have actually been played. Every kickoff, not the earliest: a round
      -- spread over a weekend is not outstanding until the last of it has finished.
      AND last_round.last_kickoff IS NOT NULL
      AND last_round.last_kickoff <= NOW() - ($1 || ' hours')::interval

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

    ORDER BY last_round.last_kickoff, c.id
  `, [String(REMINDER_AFTER_HOURS), String(COOLDOWN_DAYS), groupFor(EMAIL_TYPE)]);

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
    round_number,
    fixture_count,
    results_entered,
    last_kickoff,
    active_player_count
  } = candidate;

  const token = await getOrCreateToken(user_id);
  const unsubscribe = token ? unsubscribeLinks(token, groupFor(EMAIL_TYPE)) : null;

  const fixtures = Number(fixture_count) || 0;
  const entered = Number(results_entered) || 0;

  return {
    email_tracking_id: `${EMAIL_TYPE}_${competition_id}_${Date.now()}`,
    unsubscribe,
    user_email,
    user_display_name,
    competition_id,
    competition_name,
    round_number: Number(round_number),
    fixture_count: fixtures,
    results_entered: entered,
    results_outstanding: fixtures - entered,
    /*
    Every result typed in and none of it processed. The organiser has done the work and stopped one
    button short, so the email asks for something different - and telling them to "add your
    results" would read as if we had not looked.
    */
    awaiting_processing: fixtures > 0 && entered === fixtures,
    last_kickoff,
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
    console.error('resultReminder.queueCandidate failed:', { competition_id: candidate.competition_id, error: error.message });
    return { success: false, error: error.message };
  }
}

module.exports = {
  EMAIL_TYPE,
  REMINDER_AFTER_HOURS,
  COOLDOWN_DAYS,
  subjectFor,
  findCandidates,
  buildTemplateData,
  queueCandidate
};
