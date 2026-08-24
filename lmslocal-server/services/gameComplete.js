/*
=======================================================================================================================================
Game Complete Service
=======================================================================================================================================
Purpose: The one definition of who is told a competition has finished, and how it finished.
         Outline row: Player | Game | Game complete.

Goes to everyone who took part, winners and eliminated alike - somebody knocked out in round 2
still wants to know who won. Scoped to one competition, unlike the organiser reminders: this is
about a named competition and its players, so the operator picks it.

The eligibility rules, all in findCandidates below:
  - competition status is COMPLETE
  - every competition_user row with a real email, whatever their status
  - once ever, per player per competition. A lifecycle email, not a nudge, so no cooldown.
  - guests and bots fall out on the @lms-guest.com address check
  - has not opted out of player.game

THE OUTCOME IS DERIVED, NOT STORED. Survivors are the rows still 'active' once the competition is
COMPLETE, and the count is the whole story:

  1 survivor   - a winner, named
  0 survivors  - nobody left; everyone went out in the same round. This is real and not an edge
                 case invented here: competition 161 finished with all 21 of its players 'out'.
  2+ survivors - a draw as well, and the SAME message as 0, word for word. Nobody is named and
                 no win is awarded: the competition ended without settling one, and what that
                 means is the organiser's to decide, not ours to announce.

A winner-shaped template alone would have been wrong, which is why "either a winner or a draw" is
the right framing.

Organisers are ordinary players in this query. An organiser's competition_user row is a real
playing row - 168's organiser survived and won with six picks, 161's went out with two - so
'active' means survivor with no special-casing, and an organiser who wins is named like anyone
else. That is deliberately different from the player COUNTS in the organiser reminders, which
exclude the organiser because there "players" means "other people".
=======================================================================================================================================
*/

const { query } = require('../database');
const { notOptedOutSql, groupFor, getOrCreateToken, unsubscribeLinks } = require('./emailPreference');

const EMAIL_TYPE = 'game_complete';

/**
 * The subject line. A function because it carries the competition name, and the tracking row is
 * written before the template is built - the two have to say the same thing.
 *
 * The result is in the subject because it is the news. "X has finished" is what an inbox ignores;
 * there is nothing to spoil, since the email exists to tell them. It varies per recipient the
 * same way the headline does, and for the same reason - a winner should not read their own win
 * in the third person. Pass no outcome and it falls back to the plain form.
 *
 * @param {string} competitionName
 * @param {object} [outcome] - { survivor_count, winner_names, recipient_survived }
 */
const subjectFor = (competitionName, outcome = null) => {
  if (!outcome) return `${competitionName} has finished`;

  const { survivor_count, winner_names, recipient_survived } = outcome;

  if (survivor_count === 1) {
    return recipient_survived ? `You won ${competitionName}` : `${winner_names} won ${competitionName}`;
  }
  // Every other ending is a draw, and a draw names nobody.
  return `${competitionName} ends with no winner`;
};

/**
 * Find everyone who should be told their competition has finished.
 *
 * One query. The outcome columns are the same for every row of a given competition, which is
 * deliberate - working them out per recipient would be the N+1 the standards forbid, and they are
 * cheap aggregates over one competition's membership.
 *
 * @param {object} [opts]
 * @param {number} [opts.competition_id] - restrict to one competition. Omit to scan them all.
 * @returns {Promise<Array>} candidate rows, each carrying everything buildTemplateData needs
 */
async function findCandidates(opts = {}) {
  const { competition_id = null } = opts;

  const result = await query(`
    SELECT
      cu.user_id,
      u.email                AS user_email,
      u.display_name         AS user_display_name,
      cu.status              AS user_status,
      c.id                   AS competition_id,
      c.name                 AS competition_name,

      -- How the competition ended. Same for every recipient; see the note above.
      (
        SELECT COUNT(*) FROM competition_user s
        WHERE s.competition_id = c.id AND s.status = 'active'
      ) AS survivor_count,

      /*
      When it actually finished - the moment the last result was processed, not the last round's
      lock time, because a round locks when picking closes and can sit unsettled for days after.
      Not used by the template: it drives the "waiting since" column on the admin screen, which is
      how the operator tells a competition that ended yesterday from one that ended in the spring.
      */
      (
        SELECT MAX(f.processed)
        FROM fixture f
        INNER JOIN round r ON r.id = f.round_id
        WHERE r.competition_id = c.id
      ) AS finished_at,
      (
        SELECT string_agg(su.display_name, ', ' ORDER BY su.display_name)
        FROM competition_user s
        INNER JOIN app_user su ON su.id = s.user_id
        WHERE s.competition_id = c.id AND s.status = 'active'
      ) AS winner_names,
      (
        SELECT COUNT(*) FROM competition_user p WHERE p.competition_id = c.id
      ) AS player_count,
      (
        SELECT MAX(r.round_number) FROM round r WHERE r.competition_id = c.id
      ) AS rounds_played,

      /*
      How far this recipient got - the one per-recipient column, correlated on cu.user_id rather
      than aggregated over the competition. player_progress records a missed pick as a LOSE row
      with chosen_team 'NO-PICK', so both ways out are covered, and MAX takes the last one for
      competitions played with more than one life. NULL for a survivor.
      */
      (
        SELECT MAX(pp.round_number)
        FROM player_progress pp
        WHERE pp.player_id = cu.user_id
          AND pp.competition_id = c.id
          AND pp.outcome = 'LOSE'
      ) AS eliminated_round

    FROM competition c

    INNER JOIN competition_user cu
      ON cu.competition_id = c.id

    INNER JOIN app_user u
      ON u.id = cu.user_id
      AND u.email IS NOT NULL
      AND u.email != ''
      AND u.email NOT LIKE '%@lms-guest.com'

    WHERE UPPER(c.status) = 'COMPLETE'

      -- Once ever, per player per competition. No cooldown: a competition finishes once.
      AND NOT EXISTS (
        SELECT 1 FROM email_queue eq
        WHERE eq.user_id = u.id
          AND eq.competition_id = c.id
          AND eq.email_type = '${EMAIL_TYPE}'
      )

      -- Opt-outs, defined once in services/emailPreference.js
      AND ${notOptedOutSql({ userColumn: 'u.id', competitionColumn: 'c.id', groupParam: '$2' })}

      -- Optional competition filter. Passing NULL leaves every competition in.
      AND ($1::int IS NULL OR c.id = $1)

    ORDER BY c.id, u.id
  `, [competition_id, groupFor(EMAIL_TYPE)]);

  return result.rows;
}

/**
 * Build the template data one email needs.
 *
 * @param {object} candidate - a row from findCandidates
 * @returns {Promise<object>} template data, stored on email_queue.template_data
 */
async function buildTemplateData(candidate) {
  const {
    user_id,
    user_email,
    user_display_name,
    user_status,
    competition_id,
    competition_name,
    survivor_count,
    winner_names,
    player_count,
    rounds_played,
    eliminated_round
  } = candidate;

  const token = await getOrCreateToken(user_id);
  const unsubscribe = token ? unsubscribeLinks(token, groupFor(EMAIL_TYPE)) : null;

  const survivors = Number(survivor_count) || 0;

  return {
    email_tracking_id: `${EMAIL_TYPE}_${competition_id}_${user_id}_${Date.now()}`,
    unsubscribe,
    user_email,
    user_display_name,
    competition_id,
    competition_name,
    survivor_count: survivors,
    // Null when nobody survived, which the template reads as the no-winner ending.
    winner_names: winner_names || null,
    /*
    Whether this recipient is one of the survivors. Decides between "you won" and "{name} won it",
    and it is read off their own membership row rather than matched on name - two players can
    share a display name, and congratulating the wrong one is the worst thing this email could do.
    */
    recipient_survived: user_status === 'active',
    player_count: Number(player_count) || 0,
    rounds_played: Number(rounds_played) || 0,
    /*
    The round this recipient went out in, null if they are still standing. Gated on their own
    membership row for the same reason recipient_survived is: a survivor must never be told they
    went out, whatever stray progress rows exist.
    */
    eliminated_round: user_status === 'active' ? null : (Number(eliminated_round) || null),
    user_id
  };
}

/**
 * Queue one email, and open its tracking row.
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
      subjectFor(templateData.competition_name, templateData)
    ]);

    return { success: true, queue_id: queueResult.rows[0].id, template_data: templateData };
  } catch (error) {
    console.error('gameComplete.queueCandidate failed:', { competition_id: candidate.competition_id, user_id: candidate.user_id, error: error.message });
    return { success: false, error: error.message };
  }
}

module.exports = {
  EMAIL_TYPE,
  subjectFor,
  findCandidates,
  buildTemplateData,
  queueCandidate
};
