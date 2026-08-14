/*
=======================================================================================================================================
Game Start Reminder Service
=======================================================================================================================================
Purpose: The one definition of which organiser is sitting on a competition they could start but
         have not. Outline row: Organiser | Game | Game Start reminder.

A fixture-service competition publishes no rounds until the organiser presses Ready. Nothing
chases them: the competition can sit there indefinitely while batches come and go, and the
organiser is not necessarily aware that a round is available right now.

Platform-wide rather than competition-scoped, unlike the other reminders. The question this
answers is "who is stuck?", which is not a question about one competition - the operator wants the
list, not to go hunting for it a competition at a time.

The eligibility rules, all in findCandidates below:
  - fixture_service competition (only those have a Ready button; an organiser-managed competition
    would be told to press something that does not exist)
  - competition is not COMPLETE
  - no rounds yet - this is about a first round, never a later one
  - ready_at IS NULL, so Ready genuinely has not been pressed
  - created at least REMINDER_AFTER_DAYS ago, so a competition made yesterday is left alone to
    gather players
  - nothing sent for this competition in the last COOLDOWN_DAYS
  - organiser has a real email and has not opted out of organiser.game
  - AND, last and most important, pressing Ready right now would actually produce a round

That last rule is why there is no hardcoded copy of the start conditions here. It comes from
getCompetitionStartOutlook, which is what the organiser's own start card reads and which evaluates
the competition as if Ready had been pressed. Reason: the first-round path in evaluateCompetition
returns NOT_READY before it checks the gameweek, kickoff and 48-hour lead-time rules, so
"ready_at IS NULL" alone would happily chase an organiser toward a button that would refuse them.

Nothing guards a backfill here, and nothing needs to. Eligibility is live state - a round is
available and unclaimed today - so no history can accumulate for this to work through. The three
welcome emails were the opposite case and had theirs written off as 'skipped' rows in Aug 2026.
=======================================================================================================================================
*/

const { query } = require('../database');
const { notOptedOutSql, groupFor, getOrCreateToken, unsubscribeLinks } = require('./emailPreference');
const { getCompetitionStartOutlook } = require('./fixtureService');

const EMAIL_TYPE = 'game_start_reminder';

/*
How long a competition is left alone before it is chased. Long enough that this reads as "you seem
to have forgotten" rather than "hurry up" - the organiser may be waiting on players, and that is
their business.
*/
const REMINDER_AFTER_DAYS = 14;

/*
This is a nudge, not a lifecycle email, so the once-ever rule the other four use would waste it:
an organiser who misses the first one is exactly the organiser worth reminding again. A week is
long enough that two in a row cannot read as a drip.
*/
const COOLDOWN_DAYS = 7;

/**
 * The subject line. A function because it carries the competition name, and the tracking row is
 * written before the template is built - the two have to say the same thing.
 */
const subjectFor = (competitionName) => `${competitionName} is ready to start`;

/**
 * Find every organiser who could start a competition today and has not.
 *
 * Two stages, deliberately. The SQL narrows to competitions that are plausibly stuck, then each
 * survivor is put through the real start evaluation. That evaluation needs the staged batch and
 * the competition's round state, so it cannot be expressed as a join - but it runs over a handful
 * of rows, not the whole table.
 *
 * @returns {Promise<Array>} candidate rows, each carrying everything buildTemplateData needs
 */
async function findCandidates() {
  const shortlist = await query(`
    SELECT
      c.organiser_id         AS user_id,
      u.email                AS user_email,
      u.display_name         AS user_display_name,
      c.id                   AS competition_id,
      c.name                 AS competition_name,
      c.invite_code,
      c.created_at,
      (
        SELECT COUNT(*) FROM competition_user cu
        WHERE cu.competition_id = c.id
          AND cu.status = 'active'
          AND cu.user_id != c.organiser_id
      ) AS player_count

    FROM competition c

    INNER JOIN app_user u
      ON u.id = c.organiser_id
      AND u.email IS NOT NULL
      AND u.email != ''
      AND u.email NOT LIKE '%@lms-guest.com'

    WHERE c.fixture_service = true
      AND UPPER(c.status) != 'COMPLETE'
      AND c.ready_at IS NULL
      AND c.created_at <= NOW() - ($1 || ' days')::interval
      -- First round only. A competition with rounds is already running, whatever ready_at says.
      AND NOT EXISTS (
        SELECT 1 FROM round r WHERE r.competition_id = c.id
      )
      -- Cooldown, not once-ever. Re-eligible a week after the last attempt, sent or failed.
      AND NOT EXISTS (
        SELECT 1 FROM email_queue eq
        WHERE eq.competition_id = c.id
          AND eq.email_type = '${EMAIL_TYPE}'
          AND eq.created_at > NOW() - ($2 || ' days')::interval
      )
      -- Opt-outs, defined once in services/emailPreference.js
      AND ${notOptedOutSql({ userColumn: 'u.id', competitionColumn: 'c.id', groupParam: '$3' })}

    ORDER BY c.created_at, c.id
  `, [String(REMINDER_AFTER_DAYS), String(COOLDOWN_DAYS), groupFor(EMAIL_TYPE)]);

  const candidates = [];

  for (const row of shortlist.rows) {
    /*
    The real test, and the one definition of it. getCompetitionStartOutlook evaluates the
    competition as if Ready had been pressed, so can_start answers exactly "would pressing Ready
    give this organiser a round right now". If it would not, there is nothing to remind them
    about - the batch is mid-gameweek, too close to kickoff, or there is no batch at all.

    The pool answers query() the way a client does, and these are reads with no transaction to
    hold open - the same shim routes/get-competition-start-outlook.js uses.
    */
    const outlook = await getCompetitionStartOutlook({ query }, row.competition_id);
    if (!outlook || !outlook.can_start) continue;

    candidates.push({
      ...row,
      // The kickoff they would be starting on, so the email can name a date rather than nag.
      starts_at: outlook.starts_at,
      fixture_count: outlook.fixtures.length
    });
  }

  return candidates;
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
    invite_code,
    starts_at,
    fixture_count,
    player_count
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
    invite_code,
    starts_at,
    fixture_count,
    // Drives one line of copy: chasing an organiser with nobody signed up yet is a different
    // message from chasing one with a full competition waiting on them.
    player_count: Number(player_count) || 0,
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
    console.error('gameStartReminder.queueCandidate failed:', { competition_id: candidate.competition_id, error: error.message });
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
