/*
=======================================================================================================================================
Round Over Service
=======================================================================================================================================
Purpose: The one definition of who is told a round has been settled, and what they are told.
         Outline row: Player | Game | Round Over. email_type stays 'results'.

The email every player gets every week, and the one the rest of the system exists to support.

READINESS IS THE WHOLE DESIGN. It is not ready when a round ends; it is ready when a round ends AND
the next round's fixtures are in. A "round over" email with nothing to do next is a dead end - the
player reads who went out, has nowhere to go, and has to come back later anyway. Waiting turns two
half-emails into one that settles the last round and opens the next in the same breath.

Ready when the highest FULLY PROCESSED round is followed by a round N+1 that has fixtures.

Anything else is somebody else's email. Results outstanding -> resultReminder. Settled with no
next round staged -> fixtureReminder. Competition finished -> gameComplete.

THAT LAST ONE USED TO BE THIS EMAIL TOO, and it was a mistake (fixed 2026-08-14). A second arm
here read "or competition status COMPLETE", so the final round being processed fired BOTH this and
gameComplete - one event, two emails, both announcing the same winner to anyone who reached the
end. gameComplete now owns a competition ending outright, for everybody who took part rather than
just the finalists, and this email owns "a round ended and the next one is open".

The fix was to remove a rule rather than add one: the alternative considered was gameComplete
excluding final-round players, which would have meant one email reaching into player_progress to
work out who it was NOT for.

The cost, accepted: a final-round player is no longer told their own last pick and how it went.
They get gameComplete, which names the winner and says whether they survived, but not "your team
lost". They watched that match; the winner is the part they need.

RECIPIENTS COME FROM player_progress, one row per player per round, which is exactly "who was in
this round". A player eliminated in round 3 has no row for round 5 and is not told about a round
they had no part in - that falls out of the data rather than needing a rule. NO-PICK is a real row
there (chosen_team = 'NO-PICK', outcome LOSE), so somebody who forgot to pick is still told what
it cost.

MINUS ANYONE WHO HAS ALREADY PICKED IN THE NEXT ROUND (added 2026-08-25). The email's job is to
bring the player back to the app; if they are already there and have picked, it has nothing left
to do. The organiser is exempt - their copy is also the competition-wide report.

Two different questions, deliberately answered from two places:
  - "did your team win?"    -> player_progress.outcome for this round
  - "are you still in?"     -> competition_user.status
A player with a life left loses and stays in, so one cannot be derived from the other.

Counts are exact and names are sampled. A 100-player competition cannot send a 100-line email, and
the names are there to make it feel like a competition rather than a report - five a side is
plenty for that.
=======================================================================================================================================
*/

const { query } = require('../database');
const { notOptedOutSql, groupFor, getOrCreateToken, unsubscribeLinks } = require('./emailPreference');

const EMAIL_TYPE = 'results';

// How many names are listed each way. Counts are always exact; this caps only the sample.
const SAMPLE_SIZE = 5;

/**
 * The subject line. A function because it carries the competition name and round, and the tracking
 * row is written before the template is built - the two have to say the same thing.
 */
const subjectFor = (competitionName, roundNumber) => `${competitionName} — Round ${roundNumber} results`;

/**
 * Find every player who should be told a round is settled.
 *
 * @param {object} [opts]
 * @param {number} [opts.competition_id] - restrict to one competition. Omit to scan them all.
 * @returns {Promise<Array>} candidate rows, each carrying everything buildTemplateData needs
 */
async function findCandidates(opts = {}) {
  const { competition_id = null } = opts;

  const result = await query(`
    SELECT
      pp.player_id           AS user_id,
      u.email                AS user_email,
      u.display_name         AS user_display_name,
      c.id                   AS competition_id,
      c.name                 AS competition_name,
      UPPER(c.status)         AS competition_status,

      last_round.id          AS round_id,
      last_round.round_number,
      last_round.settled_at,

      -- This player's own round: what they picked and how it went.
      pp.chosen_team,

      /*
      The pick spelled out - "Arsenal", not the "ARS" that player_progress stores. Correlated on
      the competition's own team_list, since short names are only unique within one. NULL for
      'NO-PICK' and for a team since removed from the list, and the template falls back to the
      stored code rather than printing nothing.
      */
      (
        SELECT t.name
        FROM team t
        WHERE t.team_list_id = c.team_list_id
          AND t.short_name = pp.chosen_team
        LIMIT 1
      ) AS chosen_team_name,
      pp.outcome,
      cu.status              AS player_status,
      cu.lives_remaining,

      /*
      Whether this recipient runs the competition. Every organiser plays in their own competition
      - 29 of 30 - so they were already getting this email as a player; this flag adds an
      organiser block to their copy rather than sending them a second email. That is deliberate:
      a separate organiser email would collide with this one under magic send, and which of the
      two survived would be decided by whichever the operator pressed first.
      */
      (pp.player_id = c.organiser_id) AS is_organiser,

      -- The shape of the competition after this round. Constant per competition, so these are
      -- subqueries rather than a per-recipient lookup - see the N+1 rule in CLAUDE.md.
      (
        SELECT COUNT(*) FROM competition_user s
        WHERE s.competition_id = c.id AND s.status = 'active'
      ) AS survivors_count,
      (
        SELECT COUNT(*) FROM player_progress pp2
        INNER JOIN competition_user cu2
          ON cu2.competition_id = c.id AND cu2.user_id = pp2.player_id
        WHERE pp2.round_id = last_round.id
          AND pp2.outcome = 'LOSE'
          AND cu2.status = 'out'
      ) AS out_this_round_count,
      (
        SELECT string_agg(x.display_name, ', ')
        FROM (
          SELECT su.display_name
          FROM competition_user s
          INNER JOIN app_user su ON su.id = s.user_id
          WHERE s.competition_id = c.id AND s.status = 'active'
          ORDER BY su.display_name
          LIMIT ${SAMPLE_SIZE}
        ) x
      ) AS survivors_sample,
      (
        SELECT string_agg(x.display_name, ', ')
        FROM (
          SELECT ou.display_name
          FROM player_progress pp3
          INNER JOIN competition_user cu3
            ON cu3.competition_id = c.id AND cu3.user_id = pp3.player_id
          INNER JOIN app_user ou ON ou.id = pp3.player_id
          WHERE pp3.round_id = last_round.id
            AND pp3.outcome = 'LOSE'
            AND cu3.status = 'out'
          ORDER BY ou.display_name
          LIMIT ${SAMPLE_SIZE}
        ) x
      ) AS out_this_round_sample,

      -- What happens next. Null throughout when the competition has finished.
      next_round.round_number AS next_round_number,
      next_round.lock_time    AS next_deadline,
      (
        SELECT json_agg(json_build_object(
                 'home', f.home_team,
                 'away', f.away_team,
                 'kickoff', f.kickoff_time
               ) ORDER BY f.kickoff_time, f.id)
        FROM fixture f WHERE f.round_id = next_round.id
      ) AS next_fixtures

    FROM competition c

    /*
    The highest round that is genuinely settled: it has fixtures and every one of them has been
    processed. LATERAL so the fixture aggregate is computed for that round alone.
    */
    INNER JOIN LATERAL (
      SELECT
        r.id,
        r.round_number,
        /*
        When this round was settled. Not used by the template: it drives the "waiting since"
        column on the admin screen, which is how the operator tells a round that finished last
        night from one that finished in the spring.
        */
        (SELECT MAX(f2.processed) FROM fixture f2 WHERE f2.round_id = r.id) AS settled_at
      FROM round r
      WHERE r.competition_id = c.id
        AND EXISTS (SELECT 1 FROM fixture f WHERE f.round_id = r.id)
        AND NOT EXISTS (SELECT 1 FROM fixture f WHERE f.round_id = r.id AND f.processed IS NULL)
      ORDER BY r.round_number DESC
      LIMIT 1
    ) last_round ON true

    /*
    The next round, and only if it carries fixtures. LEFT JOIN because a finished competition has
    no next round and still qualifies - the readiness test below is what enforces the rule.
    */
    LEFT JOIN LATERAL (
      SELECT r.id, r.round_number, r.lock_time
      FROM round r
      WHERE r.competition_id = c.id
        AND r.round_number = last_round.round_number + 1
        AND EXISTS (SELECT 1 FROM fixture f WHERE f.round_id = r.id)
      LIMIT 1
    ) next_round ON true

    -- Who was in that round. This is the recipient list.
    INNER JOIN player_progress pp
      ON pp.round_id = last_round.id

    INNER JOIN competition_user cu
      ON cu.competition_id = c.id
      AND cu.user_id = pp.player_id

    INNER JOIN app_user u
      ON u.id = pp.player_id
      AND u.email IS NOT NULL
      AND u.email != ''
      AND u.email NOT LIKE '%@lms-guest.com'

    WHERE
      /*
      The readiness rule, and now the ONLY arm of it: the next round is staged.

      There used to be a second arm - "or the competition is COMPLETE" - and it was the entire
      overlap with game_complete. Both emails fired on the same event, the final round being
      processed, so a player who reached the end got two messages announcing the same winner.
      Removed 2026-08-14; game_complete is the email for a competition ending, for everybody who
      took part.

      Dropping it also makes this service's founding rule true by construction rather than by a
      branch: "never a dead end" now holds because a next round is the only thing that qualifies.
      */
      next_round.id IS NOT NULL

      /*
      Already picked in the next round -> not sent. The email exists to get the player back into
      the app to pick; somebody who has picked is already there, and telling them again buys
      nothing. At a few thousand players that is most of a send saved on an active competition.

      The organiser is exempt. Their copy carries the organiser block (see is_organiser above),
      which is not about picking at all, and they are usually the first person in - so keying
      their own pick would silently cost them the one email that tells them how the round went
      across the competition.

      Note this cannot suppress an eliminated player: they have no next round to pick in, so the
      NOT EXISTS holds and they are still told how their last round ended.
      */
      AND (
        pp.player_id = c.organiser_id
        OR NOT EXISTS (
          SELECT 1 FROM pick pk
          WHERE pk.round_id = next_round.id
            AND pk.user_id = pp.player_id
        )
      )

      -- Once per player per round.
      AND NOT EXISTS (
        SELECT 1 FROM email_queue eq
        WHERE eq.user_id = u.id
          AND eq.competition_id = c.id
          AND eq.round_id = last_round.id
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
    competition_id,
    competition_name,
    competition_status,
    round_id,
    round_number,
    chosen_team,
    chosen_team_name,
    outcome,
    player_status,
    lives_remaining,
    survivors_count,
    out_this_round_count,
    survivors_sample,
    out_this_round_sample,
    next_round_number,
    next_deadline,
    next_fixtures,
    is_organiser
  } = candidate;

  const token = await getOrCreateToken(user_id);
  const unsubscribe = token ? unsubscribeLinks(token, groupFor(EMAIL_TYPE)) : null;

  const survivors = Number(survivors_count) || 0;

  /*
  Always false now, and kept only so the template's shape does not change under it. A candidate
  must have a next round staged to get here (see findCandidates), and a COMPLETE competition has
  none - so the "who won" branch below is unreachable. gameComplete owns a competition ending.

  Left in rather than ripped out because the template reads these three keys and a missing key
  renders differently from a false one. Remove them together when that template is next touched.
  */
  const isComplete = competition_status === 'COMPLETE';

  return {
    email_tracking_id: `${EMAIL_TYPE}_${competition_id}_${round_id}_${user_id}_${Date.now()}`,
    unsubscribe,
    user_email,
    user_display_name,
    competition_id,
    competition_name,
    round_id,
    round_number: Number(round_number),

    /*
    The recipient's own round. chosen_team carries the full name the reader would say out loud;
    missed_pick is taken from the raw code below, because 'NO-PICK' is a real value here, not a
    missing one, and it has no row in team to resolve against.
    */
    chosen_team: chosen_team_name || chosen_team,
    outcome,
    missed_pick: chosen_team === 'NO-PICK',
    survived: player_status === 'active',
    lives_remaining: Number(lives_remaining) || 0,

    survivors_count: survivors,
    out_this_round_count: Number(out_this_round_count) || 0,
    survivors_sample: survivors_sample || null,
    out_this_round_sample: out_this_round_sample || null,

    /*
    Adds an organiser block to this recipient's copy. Coerced rather than passed through: this is
    stored on email_queue.template_data as JSON and read back by the template, so it must be a
    real boolean and not whatever the driver hands back for a SQL comparison.
    */
    is_organiser: is_organiser === true,

    /*
    The ending, when there is one. A COMPLETE competition with one survivor has a winner; with
    none, everybody left went out together and there is no winner to name. Same three-way split as
    services/gameComplete.js, and for the same reason - it is what the data can actually say.
    */
    competition_complete: isComplete,
    winner_names: isComplete ? survivors_sample : null,
    is_draw: isComplete && survivors !== 1,

    // What happens next. All null when the competition has finished.
    next_round_number: next_round_number ? Number(next_round_number) : null,
    next_deadline: next_deadline || null,
    next_fixtures: next_fixtures || [],

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
      ) VALUES ($1, $2, $3, '${EMAIL_TYPE}', NOW(), $4, 'pending', 0)
      RETURNING id
    `, [candidate.user_id, candidate.competition_id, candidate.round_id, JSON.stringify(templateData)]);

    await query(`
      INSERT INTO email_tracking (email_id, user_id, competition_id, email_type, subject)
      VALUES ($1, $2, $3, '${EMAIL_TYPE}', $4)
    `, [
      templateData.email_tracking_id,
      candidate.user_id,
      candidate.competition_id,
      subjectFor(templateData.competition_name, templateData.round_number)
    ]);

    return { success: true, queue_id: queueResult.rows[0].id, template_data: templateData };
  } catch (error) {
    console.error('roundOver.queueCandidate failed:', { competition_id: candidate.competition_id, user_id: candidate.user_id, error: error.message });
    return { success: false, error: error.message };
  }
}

module.exports = {
  EMAIL_TYPE,
  SAMPLE_SIZE,
  subjectFor,
  findCandidates,
  buildTemplateData,
  queueCandidate
};
