/*
=======================================================================================================================================
Pick Reminder Service
=======================================================================================================================================
Purpose: The one definition of who should receive a pick reminder, and how their email is built.

Used by routes/load-pick-reminder.js (the batch path) and by the admin screen's preview and send.
Kept in one place for the same reason evaluateCompetition is in services/fixtureService.js: the
preview and the send must agree, or the screen offers a button that then refuses, or worse shows
a count of five and mails eight.

The eligibility rules, all in findCandidates below:
  - competition is not COMPLETE (compared case-insensitively; the column holds upper case)
  - round has a lock time, in the future, and within REMINDER_WINDOW_HOURS (24)
  - round has fixtures
  - player is still active in the competition
  - player has a real email (guest accounts use @lms-guest.com and are excluded)
  - player has not already picked this round
  - nothing is already queued for this player, competition and round
  - not opted out, per services/emailPreference.js

Pick reminder belongs to the player.game group, so switching Game emails off stops it. That
costs the player a life when they then miss a pick, and it is deliberate - see the note in
emailPreference.js.
=======================================================================================================================================
*/

const { query } = require('../database');
const { notOptedOutSql, groupFor, getOrCreateToken, unsubscribeLinks } = require('./emailPreference');

/*
How close to the lock a round has to be before its players are chased. 3 days -> 48h (2026-08-14)
-> 12h (2026-08-18) -> 24h (2026-08-21, when this went on a daily cron).

The email is ONCE PER PLAYER PER ROUND, so the window is not "when may we send" - it is "when does
the one reminder get spent". Three days out was the worst moment to spend it: no urgency yet, the
player thinks "later", and the queue guard means nothing follows.

WHY 24, AND WHY IT MUST BE WIDER THAN THE CRON INTERVAL

The 12 was chosen while a person was pressing the button, and the reasoning depended on that: the
window only bounded who APPEARED on the admin card, and the operator decided when to actually
press. Under a daily cron the window decides both - a round is chased on the one run that falls
inside it, or it is never chased at all, silently, because nobody qualified.

12 hours against a 24-hour cron leaves a 12-hour band each day in which a lock gets no reminder at
all. Modelled against all 33 real rounds of the last 60 days plus the Saturday 12:30 kickoffs
expected this season: at a 07:00 run, 12 hours misses 24 of 37 - every evening lock, which sits 13
hours out and is therefore outside the window at the only run that could catch it. 24 hours misses
nothing at any run time between 07:00 and 11:00.

THIS DOES NOT SEND ANYTHING A DAY EARLY, which is the thing 12 was protecting and the reason 48
was rejected. At 07:00 the day BEFORE, an evening lock is 37 hours away and a Saturday 11:30 lock
28.5 hours - both outside 24. So a round still becomes eligible on the morning of, exactly as
before; what changes is that an early kickoff is no longer dropped on the floor. A 12:30 Saturday
kickoff locks at 11:30 and now gets 3.5 hours' notice instead of nothing.

KEEP THIS ABOVE THE CRON INTERVAL. If the sweep ever runs less often than daily, this number has to
grow with it, roughly doubled - see docs/email/email-cron-priority-order.txt for the schedule.

The bigger version - two reminders per round, one early and one close to the deadline - is
foreclosed by the per-round queue guard, and would need a "which reminder is this" concept rather
than a wider window. Deliberately not built.
*/
const REMINDER_WINDOW_HOURS = 24;

/**
 * Find every player who should get a pick reminder.
 *
 * @param {object} [opts]
 * @param {number} [opts.competition_id] - restrict to one competition. Omit to scan them all,
 *                                         which is what the batch path does.
 * @returns {Promise<Array>} candidate rows, each carrying everything buildTemplateData needs
 */
async function findCandidates(opts = {}) {
  const { competition_id = null } = opts;

  const result = await query(`
    SELECT
      cu.user_id,
      u.email                AS user_email,
      u.display_name         AS user_display_name,
      c.id                   AS competition_id,
      c.name                 AS competition_name,
      r.id                   AS round_id,
      r.round_number,
      r.lock_time,
      org.display_name       AS organizer_name

    FROM competition c

    INNER JOIN round r
      ON r.competition_id = c.id
      AND UPPER(c.status) != 'COMPLETE'

    INNER JOIN competition_user cu
      ON cu.competition_id = c.id
      AND cu.status = 'active'

    INNER JOIN app_user u
      ON u.id = cu.user_id
      AND u.email IS NOT NULL
      AND u.email != ''
      AND u.email NOT LIKE '%@lms-guest.com'

    LEFT JOIN app_user org
      ON org.id = c.organiser_id

    LEFT JOIN pick p
      ON p.user_id = u.id
      AND p.round_id = r.id

    WHERE p.id IS NULL
      AND r.lock_time IS NOT NULL
      AND r.lock_time > NOW()
      AND r.lock_time <= NOW() + ($3 || ' hours')::interval
      AND EXISTS (
        SELECT 1 FROM fixture f WHERE f.round_id = r.id
      )
      -- Already queued for this exact round. Covers sent rows too, so a reminder is not
      -- repeated by pressing the button twice.
      AND NOT EXISTS (
        SELECT 1
        FROM email_queue eq
        WHERE eq.user_id = u.id
          AND eq.competition_id = c.id
          AND eq.round_id = r.id
          AND eq.email_type = 'pick_reminder'
      )
      -- Opt-outs, defined once in services/emailPreference.js
      AND ${notOptedOutSql({ userColumn: 'u.id', competitionColumn: 'c.id', groupParam: '$2' })}
      -- Optional competition filter. Passing NULL leaves every competition in.
      AND ($1::int IS NULL OR c.id = $1)

    ORDER BY c.id, r.round_number, u.id
  `, [competition_id, groupFor('pick_reminder'), String(REMINDER_WINDOW_HOURS)]);

  return result.rows;
}

/**
 * Build the template data a pick reminder needs, for one candidate.
 *
 * Two extra queries per candidate: the round's fixtures, and the teams this player has already
 * used (so the template can strike them through). Both are per-player by nature.
 *
 * @param {object} candidate - a row from findCandidates
 * @returns {Promise<object>} template data, stored on email_queue.template_data
 */
async function buildTemplateData(candidate) {
  const {
    user_id,
    round_id,
    competition_id,
    user_email,
    user_display_name,
    competition_name,
    organizer_name,
    round_number,
    lock_time
  } = candidate;

  const fixturesResult = await query(`
    SELECT id, home_team, away_team, home_team_short, away_team_short, kickoff_time
    FROM fixture
    WHERE round_id = $1
    ORDER BY kickoff_time ASC
  `, [round_id]);

  /*
  Teams already used, derived from this player's own picks in earlier rounds. Never read from a
  stored list - see docs/allowed-teams.md, the allowed_teams table was dropped precisely because
  it was a second copy of this.
  */
  const teamsUsedResult = await query(`
    SELECT DISTINCT p.team
    FROM pick p
    INNER JOIN round prev_r ON prev_r.id = p.round_id
    WHERE p.user_id = $1
      AND prev_r.competition_id = $2
      AND prev_r.round_number < $3
    ORDER BY p.team
  `, [user_id, competition_id, round_number]);

  /*
  The recipient's own unsubscribe link, resolved at queue time so the stored template_data is
  self-contained - a queued email must still render correctly if it is sent later.
  */
  const token = await getOrCreateToken(user_id);
  const unsubscribe = token ? unsubscribeLinks(token, groupFor('pick_reminder')) : null;

  return {
    email_tracking_id: `pick_reminder_${user_id}_${competition_id}_${round_id}_${Date.now()}`,
    unsubscribe,
    user_email,
    user_display_name,
    competition_name,
    organizer_name: organizer_name || 'Competition Organizer',
    round_number,
    lock_time,
    fixtures: fixturesResult.rows,
    teams_used: teamsUsedResult.rows.map((row) => row.team),
    competition_id,
    round_id,
    user_id
  };
}

/**
 * Queue one pick reminder, and open its tracking row.
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
      ) VALUES ($1, $2, $3, 'pick_reminder', NOW(), $4, 'pending', 0)
      RETURNING id
    `, [
      candidate.user_id,
      candidate.competition_id,
      candidate.round_id,
      JSON.stringify(templateData)
    ]);

    await query(`
      INSERT INTO email_tracking (email_id, user_id, competition_id, email_type, subject)
      VALUES ($1, $2, $3, 'pick_reminder', $4)
    `, [
      templateData.email_tracking_id,
      candidate.user_id,
      candidate.competition_id,
      `${templateData.organizer_name} (${templateData.competition_name}): Pick reminder for Round ${templateData.round_number}`
    ]);

    return { success: true, queue_id: queueResult.rows[0].id, template_data: templateData };
  } catch (error) {
    console.error('pickReminder.queueCandidate failed:', { user_id: candidate.user_id, error: error.message });
    return { success: false, error: error.message };
  }
}

module.exports = {
  findCandidates,
  buildTemplateData,
  queueCandidate
};
