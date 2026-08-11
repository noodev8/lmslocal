/*
=======================================================================================================================================
Join Competition Service
=======================================================================================================================================
Purpose: The one definition of who should be welcomed to a competition they have joined, and how
         that email is built. Outline row: Player | Welcome | Join Comp, email_type `welcome`.

Wired fresh in Aug 2026, replacing two implementations that between them never sent anything:

  - join-competition-by-code.js queued a row inline at join time, fire-and-forget inside a
    setImmediate, scheduled for +1 day.
  - load-welcome-competition.js did the same job again with its own hand-written opt-out check,
    using the legacy per-email 'welcome' preference key rather than the player.welcome group.
    Nothing had ever called it.

Nothing drained either. Nine rows sat pending, the oldest six days old, and were deleted rather
than sent - a welcome to a competition someone joined last week is worse than no welcome.

Eligibility is now derived here, live, and the queue row is written at send time like every other
comms email. The rules, all in findCandidates below:
  - member joined on or after CUTOFF
  - membership is active
  - not the organiser of the competition they joined (they get created_comp instead)
  - real email (guest and bot accounts both use @lms-guest.com)
  - no welcome already queued for this member and competition, whatever its status
  - not opted out of player.welcome, per services/emailPreference.js
=======================================================================================================================================
*/

const { query } = require('../database');
const { notOptedOutSql, groupFor, getOrCreateToken, unsubscribeLinks } = require('./emailPreference');

/*
The email_type stays 'welcome'. It is what email_preference and EMAIL_GROUPS already map to
player.welcome, and what 253 historical email_tracking rows are recorded under; renaming it would
orphan all of that to no benefit.
*/
const EMAIL_TYPE = 'welcome';

/*
No backfill, the same decision as Join LMS and Created Comp. Every existing member of every
competition would otherwise become a candidate the moment this was wired - dozens per competition,
all of them welcomed to something they joined weeks ago.

Set to the moment of wiring. The Z matters: db/query.js prints local time, BST, an hour ahead, and
a value copied off that output lands an hour in the future. That has already happened once.
*/
const CUTOFF = '2026-08-11T17:03:00Z';

/**
 * The subject line. A function because it carries the competition name, and the tracking row is
 * written before the template is built - the two have to say the same thing.
 */
const subjectFor = (competitionName) => `Welcome to ${competitionName}`;

/**
 * Find every member who should be welcomed to a competition.
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
      cu.user_id,
      u.email                AS user_email,
      u.display_name         AS user_display_name,
      c.id                   AS competition_id,
      c.name                 AS competition_name,
      c.lives_per_player,
      c.no_team_twice,
      org.display_name       AS organizer_name,
      cu.joined_at,
      (
        SELECT r.round_number
        FROM round r
        WHERE r.competition_id = c.id AND r.lock_time > NOW()
        ORDER BY r.round_number ASC
        LIMIT 1
      ) AS next_round_number,
      (
        SELECT MIN(r.lock_time)
        FROM round r
        WHERE r.competition_id = c.id AND r.lock_time > NOW()
      ) AS next_round_lock_time

    FROM competition_user cu

    INNER JOIN competition c
      ON c.id = cu.competition_id
      -- The organiser joining their own competition as a player is not a new member to welcome.
      -- They created it, and created_comp is their email.
      AND c.organiser_id != cu.user_id

    INNER JOIN app_user u
      ON u.id = cu.user_id
      AND u.email IS NOT NULL
      AND u.email != ''
      AND u.email NOT LIKE '%@lms-guest.com'

    LEFT JOIN app_user org
      ON org.id = c.organiser_id

    WHERE cu.status = 'active'
      AND cu.joined_at >= $1::timestamptz
      -- Once per membership, ever. Covers sent and failed rows too, so pressing send twice does
      -- not welcome the same player twice.
      AND NOT EXISTS (
        SELECT 1 FROM email_queue eq
        WHERE eq.user_id = cu.user_id
          AND eq.competition_id = c.id
          AND eq.email_type = '${EMAIL_TYPE}'
      )
      -- Opt-outs, defined once in services/emailPreference.js
      AND ${notOptedOutSql({ userColumn: 'u.id', competitionColumn: 'c.id', groupParam: '$2' })}
      -- Optional competition filter. Passing NULL leaves every competition in.
      AND ($3::int IS NULL OR c.id = $3)

    ORDER BY cu.joined_at, cu.user_id
  `, [CUTOFF, groupFor(EMAIL_TYPE), competition_id]);

  return result.rows;
}

/**
 * Build the template data one welcome needs.
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
    organizer_name,
    lives_per_player,
    no_team_twice,
    next_round_number,
    next_round_lock_time
  } = candidate;

  /*
  Resolved at queue time so the stored template_data is self-contained - a queued email must still
  render correctly if it is sent later.
  */
  const token = await getOrCreateToken(user_id);
  const unsubscribe = token ? unsubscribeLinks(token, groupFor(EMAIL_TYPE)) : null;

  return {
    email_tracking_id: `${EMAIL_TYPE}_${user_id}_${competition_id}_${Date.now()}`,
    unsubscribe,
    user_email,
    user_display_name,
    competition_name,
    organizer_name: organizer_name || 'Competition Organizer',
    lives_per_player,
    no_team_twice,
    /*
    The next round's deadline, if one is open. Read at queue time like everything else here: a
    round that locks between queueing and sending would otherwise be advertised as still open.
    */
    next_round_number,
    next_round_lock_time,
    competition_id,
    user_id
  };
}

/**
 * Queue one welcome, and open its tracking row.
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
    console.error('joinComp.queueCandidate failed:', { user_id: candidate.user_id, competition_id: candidate.competition_id, error: error.message });
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
