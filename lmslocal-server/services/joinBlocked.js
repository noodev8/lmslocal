/*
=======================================================================================================================================
Join Blocked Service
=======================================================================================================================================
Purpose: The one definition of which organiser had a real player turned away because they are at
         the free player limit with no credits, and how that email is built.

Outline row: Organiser | Info | Join Blocked.

NOT A HINT, though it was asked for as one. services/hints.js teaches a feature once per organiser
ever, on a day offset from when they created a competition, and holds every organiser to one hint
a week. All three of those are wrong here:

  - This is an EVENT, not a lesson. It is caused by something that happened, and the day the
    competition was created has nothing to do with it.
  - It RECURS. An organiser who fills up again next month needs telling again; a hint fires once
    and never again by design.
  - It is the one email with money on the other end of it, for them and for us, so it must not
    queue behind a tip about renaming competitions - which the weekly hint spacing would do.

Everything else about it is ordinary: a catalog entry, one builder, one service, the same admin
screen and the same sweep. Only the eligibility rules below are its own.

WHY EMAIL, when the dashboard already says this

The two dropped emails (share_reminder, game_start_reminder - see services/emailCatalog.js) went
on the argument that a dashboard notice beats email for a DISENGAGED organiser. That argument does
not reach this one, and the difference is who receives it. An organiser whose competition is full
of real players is the most engaged person on the platform, and what they need to know is
time-critical in a way a banner cannot be: every day they do not look, somebody who wanted in has
been turned away and has probably gone. The banner still serves whoever opens the dashboard. This
is for whoever does not.

Info group, beside empty_comp: both are about a competition of theirs that has stopped growing.

THE REPETITION RULES, and why each exists

The state is ongoing rather than momentary - an organiser can sit blocked for weeks - so the naive
version sends every time the sweep runs. Four guards, because each stops a different flavour of
nagging:

  STILL BLOCKED AT SEND TIME. Recomputed from the same SQL the join gate uses
  (organiserChargeableCountSql in services/botPool.js), so an organiser who has already bought
  credits is never asked to fix what they have fixed. This is the reasoning the dashboard banner
  already carries, and it kills most repeats on its own.

  NEW EVIDENCE SINCE THE LAST ONE. There must be a block that happened AFTER the last email we
  queued them. Without it, one player turned away on Monday generates an email every day that
  week - the same news re-sent, which is the most annoying thing this email could do.

  A COOLDOWN. Even with new blocks arriving daily, no more than one email per COOLDOWN_DAYS. A
  competition being hammered by a WhatsApp group is exactly when new evidence arrives every day,
  and exactly when a daily email would be worst.

  A LIFETIME CAP. MAX_EMAILS ever, per organiser. After three tellings they know, and a fourth is
  not information but pestering. Somebody who has decided not to spend is entitled to have that
  decision respected without unsubscribing from everything else.

The window is deliberately the same 7 days the dashboard banner uses (get-user-dashboard.js). If
the two disagree, the email describes something the organiser cannot find when they follow it in.
=======================================================================================================================================
*/

const { query } = require('../database');
const { notOptedOutSql, groupFor, getOrCreateToken, unsubscribeLinks } = require('./emailPreference');
const { organiserChargeableCountSql } = require('./botPool');
const { getPlaceUsage, usageLines } = require('./placeUsage');

const EMAIL_TYPE = 'join_blocked';

/*
How far back a turned-away player still counts as news. Matches the dashboard banner's window
exactly - see the header.
*/
const BLOCK_WINDOW_DAYS = 7;

// No organiser gets two of these closer together than this, however many players they lose.
const COOLDOWN_DAYS = 7;

// And no organiser ever gets more than this many in total. See the header.
const MAX_EMAILS = 3;

/*
The subject says what happened, not what to buy.

"You have run out of credits" is about our billing; "someone tried to join and couldn't" is about
their competition, which is the thing they care about and the reason they would open it. The same
email either way - but the first reads as an invoice and the second as news.

Mirrors the dashboard headline (lmslocal-web dashboard/page.tsx) so the banner and the email do
not describe one event in two different voices - including its second branch, which stops the
subject naming one competition when several are shut.

@param {number} total - people turned away across all their competitions
@param {string} competitionName - the one that lost the most
@param {number} [competitionCount] - how many of their competitions lost somebody
*/
const subjectFor = (total, competitionName, competitionCount = 1) => {
  const who = Number(total) === 1 ? 'Someone' : `${total} people`;
  const where = Number(competitionCount) > 1 ? 'your competitions' : competitionName;
  return `${who} tried to join ${where} and couldn't`;
};

/**
 * Find every organiser who is still shut and has lost somebody since we last said so.
 *
 * One row per ORGANISER, not per competition: the free limit is counted across everything they
 * run and one purchase reopens all of it, so two emails would be two requests to do the same
 * single thing. The competition named is the one that lost the most people.
 *
 * @returns {Promise<Array>} candidate rows, each carrying everything buildTemplateData needs
 */
async function findCandidates() {
  const FREE_PLAYER_LIMIT = parseInt(process.env.FREE_PLAYER_LIMIT) || 20;

  const result = await query(`
    WITH recent_blocks AS (
      SELECT
        jb.organiser_id,
        jb.competition_id,
        COUNT(*)            AS block_count,
        MAX(jb.occurred_at) AS last_block
      FROM join_block jb
      WHERE jb.occurred_at > NOW() - ($1 || ' days')::interval
      GROUP BY jb.organiser_id, jb.competition_id
    )
    SELECT DISTINCT ON (rb.organiser_id)
      rb.organiser_id  AS user_id,
      u.email          AS user_email,
      u.display_name   AS user_display_name,
      c.id             AS competition_id,
      c.name           AS competition_name,
      rb.block_count,
      rb.last_block,

      -- Everyone they lost in the window, across every competition. The subject counts people,
      -- not people-in-one-competition, so it needs the organiser-wide figure.
      (SELECT COALESCE(SUM(rb2.block_count), 0)
         FROM recent_blocks rb2
        WHERE rb2.organiser_id = rb.organiser_id) AS total_blocks,

      (SELECT COUNT(*)
         FROM recent_blocks rb3
        WHERE rb3.organiser_id = rb.organiser_id) AS blocked_competition_count

    FROM recent_blocks rb
    JOIN competition c ON c.id = rb.competition_id
    JOIN app_user   u ON u.id = rb.organiser_id

    -- A finished competition cannot take the player anyway, so its blocks are no reason to buy.
    WHERE UPPER(c.status) != 'COMPLETE'

      AND u.email IS NOT NULL
      AND u.email != ''
      AND u.email NOT LIKE '%@lms-guest.com'

      /*
      STILL BLOCKED. Both halves of the join gate's test, in its own SQL: at or over the free
      limit, and no credit to spend. An organiser who has bought since is simply not a candidate -
      there is no separate "resolved" state to keep, because the state IS their balance.
      */
      AND COALESCE(u.paid_credit, 0) < 1
      AND ${organiserChargeableCountSql('c.organiser_id')} >= $2

      -- NEW EVIDENCE: something must have happened since the last one we queued them.
      AND NOT EXISTS (
        SELECT 1 FROM email_queue eq
        WHERE eq.user_id = rb.organiser_id
          AND eq.email_type = '${EMAIL_TYPE}'
          AND eq.created_at >= rb.last_block
      )

      -- COOLDOWN.
      AND NOT EXISTS (
        SELECT 1 FROM email_queue eq
        WHERE eq.user_id = rb.organiser_id
          AND eq.email_type = '${EMAIL_TYPE}'
          AND eq.created_at > NOW() - ($3 || ' days')::interval
      )

      -- LIFETIME CAP. Counts every row whatever its status, so a backlog cleared with "Mark as
      -- sent" spends the allowance rather than hiding from it.
      AND (
        SELECT COUNT(*) FROM email_queue eq
        WHERE eq.user_id = rb.organiser_id
          AND eq.email_type = '${EMAIL_TYPE}'
      ) < $4

      -- Opt-outs, defined once in services/emailPreference.js.
      AND ${notOptedOutSql({ userColumn: 'u.id', competitionColumn: 'c.id', groupParam: '$5' })}

    -- One row per organiser: the competition that lost the most people, most recently.
    ORDER BY rb.organiser_id, rb.block_count DESC, rb.last_block DESC, c.id
  `, [
    String(BLOCK_WINDOW_DAYS),
    FREE_PLAYER_LIMIT,
    String(COOLDOWN_DAYS),
    MAX_EMAILS,
    groupFor(EMAIL_TYPE)
  ]);

  return result.rows;
}

/**
 * Build the template data one join-blocked email needs.
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
    total_blocks,
    blocked_competition_count
  } = candidate;

  // Resolved at queue time so the stored row renders correctly whenever it is drained.
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
    total_blocks: Number(total_blocks),
    /*
    Carried so the copy can say "your competitions" rather than naming one when several are
    affected - the same branch the dashboard headline makes.
    */
    blocked_competition_count: Number(blocked_competition_count),

    /*
    Where their places actually went, INLINE rather than as a link. This email exists for the
    organiser who does not open the dashboard (see the header), so a breakdown they have to click
    through to reach is a breakdown they do not read.

    Resolved at queue time with everything else, so the stored row renders the figures as they
    stood when we decided to send. Same service as the banner and the billing panel - if the
    email and the screen disagree, the email describes something they cannot find when they
    follow it in.

    NOT carried: the line about deletion freeing places. That sits beside the buy button on
    /billing, at the moment of the decision - not in an unbidden email suggesting somebody
    delete the record of a competition their players actually finished.
    */
    place_usage: usageLines(await getPlaceUsage(user_id))
  };
}

/**
 * Queue one join-blocked email, and open its tracking row.
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
      subjectFor(
        templateData.total_blocks,
        templateData.competition_name,
        templateData.blocked_competition_count
      )
    ]);

    return { success: true, queue_id: queueResult.rows[0].id, template_data: templateData };
  } catch (error) {
    console.error('joinBlocked.queueCandidate failed:', { user_id: candidate.user_id, error: error.message });
    return { success: false, error: error.message };
  }
}

module.exports = {
  EMAIL_TYPE,
  BLOCK_WINDOW_DAYS,
  COOLDOWN_DAYS,
  MAX_EMAILS,
  subjectFor,
  findCandidates,
  buildTemplateData,
  queueCandidate
};
