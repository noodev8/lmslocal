/*
=======================================================================================================================================
Organiser Round Report Service
=======================================================================================================================================
Purpose: The one definition of the ORGANISER's weekly round email - how the last round went, and
         who has still to pick in the one that is open. Outline row: Organiser | Game | Organiser
         round report. email_type 'organiser_round'.

Built 2026-09-01. It exists as the CHEAP OPTION. Round Over goes to every player every week and is
by some distance the biggest sender on the platform; this sends one email per competition to one
person, and asks them to carry the message the rest of the way - a group chat reaches people our
email never will. If sending volume ever has to be restrained, this is the email that keeps an
organiser informed for a fraction of the sends.

WHAT IT IS NOT. It does not replace Round Over, and Round Over is not unwired. Both stay in the
catalog and Andreas picks which one runs, per week, from the crontab and the admin screen. The
same is true of organiser_nudge, which overlaps this email's second half almost exactly (decision
2026-09-01: keep both, choose manually).

TWO HALVES, IN THIS ORDER:

  1. HOW THE LAST ROUND WENT - who went out, who is still in, counts exact and names sampled.
     Competition-wide, not personal: the organiser is being handed something to forward, not told
     their own result.
  2. WHO HAS STILL TO PICK in the open round - guests first, then real players, or the news that
     everybody is in.

The summary leads because that is the order Andreas described it in, and because it is the part
that reads as news rather than as a chore. Nothing time-critical is buried by that choice: the
subject line already carries the deadline and the outstanding count, so the inbox view says what
has to be done before the email is opened at all.

THE TRIGGER IS THE OPEN ROUND'S LOCK, NOT THE LAST ROUND BEING SETTLED (decision, 2026-09-01).
Round Over waits for results to be in before it says anything, because a player with nothing to do
next has been sent to a dead end. An organiser is not in that position - they always have a
deadline coming and players to chase - so keying this to the lock gives a predictable weekly
cadence and never withholds the time-critical half because the results half is not ready.

Round 1 therefore gets this email with no summary at all, which is correct: there is no previous
round to report.

THE SUMMARY REPORTS THE IMMEDIATELY PRECEDING ROUND, OR NOTHING. Not "the highest settled round",
which is the rule Round Over uses. The difference matters here and only here: this email is keyed
to the open round rather than to a settlement, so "highest settled" would report round 3 twice -
once when round 4 opened, and again when round 5 opened with round 4's results still not keyed.
Requiring round_number = open - 1 makes a repeat impossible without reading back what the last
email said.

The eligibility rules, all in findCandidates below:
  - competition is not COMPLETE (compared case-insensitively; the column holds upper case)
  - a round has a lock time, in the future, and within REPORT_WINDOW_HOURS
  - that round has fixtures
  - the competition has at least one non-bot player
  - organiser has a real email
  - nothing already queued for this competition and round
  - not opted out, per services/emailPreference.js

Group Game, for the same reason and at the same accepted cost as organiser_nudge: it is about one
round of one competition and it carries a deadline. An organiser who switches Game off stops it.

ONE EMAIL PER COMPETITION PER ROUND, not per organiser. Somebody running two competitions gets
two, because they are two group chats and two lists of names.
=======================================================================================================================================
*/

const { query } = require('../database');
const { notOptedOutSql, groupFor, getOrCreateToken, unsubscribeLinks } = require('./emailPreference');
const { formatUk, formatUkShort } = require('./dateFormat');
/*
Bots carry bot_<name>@lms-guest.com and share the guest domain, so prefix is the only thing that
separates them from a real guest. Imported rather than restated: services/botPool.js owns what a
bot is, and services/pickProgress.js takes it from there too. services/organiserNudge.js still
carries its own copy, which predates the export.

Excluded from every name list and from the denominator both. Left in, a seeded competition would
report a permanently inflated "still to pick" figure that the organiser can do nothing about.
*/
const { BOT_EMAIL_LIKE } = require('./botPool');
const { notArchivedSql } = require('./competitionEngagement');

const EMAIL_TYPE = 'organiser_round';

/*
How far ahead of the lock the organiser is told. 30 hours, DELIBERATELY THE SAME NUMBER AS
services/pickReminder.js, so both fire on the same daily morning run for the same round.

Andreas's reasoning, 2026-09-01: the whole point of this email is that the organiser chases people
off-platform, and chasing takes time. Three hours - organiser_nudge's window - is enough to post in
a group chat and no more. A Saturday 11:30 lock reported at Friday's morning run gives a full day.

READ services/pickReminder.js BEFORE CHANGING THIS. The 30 was not chosen for roundness: it is the
smallest window that catches a Saturday 11:30 lock on the Friday run rather than at half past nine
on the Saturday morning, which is the shape most of this season's fixtures are expected to take.
The floor argument applies here identically - the window must exceed the gap between cron runs, or
some band of lock times qualifies at no run at all, silently.

WHAT THIS TRADES AGAINST organiser_nudge, stated plainly because it is the reverse of that email's
design. organiser_nudge waits until after pick_reminder has had its run so it can report what is
LEFT; this fires alongside pick_reminder, so its number is who has not picked YET and it will be a
big one, most of the week's stragglers included. That is accepted: this email's job is a weekly
report the organiser can act on at leisure, not a final call. If a short, near-final list is what
is wanted on a given week, organiser_nudge is the email to run instead.
*/
const REPORT_WINDOW_HOURS = 30;

/*
How many names are listed per outstanding section before it says "and N others". Same number and
same reasoning as organiserNudge: the list exists to be pasted into a group chat, and forty names
are pasted nowhere. The full list is a tap away in the app, which is also the only place it is
still correct by the time they read it.
*/
const NAME_CAP = 10;

/*
How many names the last-round summary shows each way. Counts are always exact; this caps only the
sample. Matches services/roundOver.js, which shows the same two lists to players - five a side is
enough to make it read like a competition rather than a report.
*/
const SAMPLE_SIZE = 5;

/*
The subject, in one place - the tracking row is written before the template is built and the two
have to say the same thing. emailService.buildOrganiserRoundEmail reads this same function.

Two branches, because "everybody is in" is genuinely good news and a subject reading "0 still to
pick" makes an organiser open an email to find there is nothing to do.

SHAPED LIKE organiserNudge's, AND THE FIRST BRANCH IS WORD FOR WORD THE SAME. Not an oversight:
the two facts that must survive a phone's ~40 characters are the NUMBER and the DEADLINE, and
there is only one good way to order them. The two emails are alternatives rather than a pair -
Andreas runs one or the other on a given week - so an inbox holding both is not the case being
designed for.

Safe to state a time because findCandidates requires lock_time to be in the future.
*/
const subjectFor = (outstandingCount, lockTime, competitionName) =>
  outstandingCount > 0
    ? `${outstandingCount} still to pick by ${formatUkShort(lockTime)} — ${competitionName}`
    : `All picked for ${formatUkShort(lockTime)} — ${competitionName}`;

/**
 * Find every competition whose organiser should get this week's report.
 *
 * No cheap pre-gate, unlike organiserNudge.hasRoundInWindow(). That exists because that email runs
 * hourly through the afternoon and finds nothing on most runs, so the expensive aggregate must not
 * be reached until a deadline is near. This runs once a day and its window is 30 hours wide, so a
 * run that finds nothing is the exception rather than the rule and a gate would buy nothing.
 *
 * @param {object} [opts]
 * @param {number} [opts.competition_id] - restrict to one competition, which is what the admin
 *                                         screen does when one is picked. Omit to scan them all.
 * @returns {Promise<Array>} candidate rows, each carrying everything buildTemplateData needs
 */
async function findCandidates(opts = {}) {
  const { competition_id = null } = opts;

  const result = await query(`
    WITH open_round AS (
      SELECT
        c.id         AS competition_id,
        r.id         AS round_id,
        r.round_number,
        r.lock_time
      FROM competition c
      INNER JOIN round r
        ON r.competition_id = c.id
      WHERE UPPER(c.status) != 'COMPLETE'
        -- Archived competitions get no email at all. See notArchivedSql.
        AND ${notArchivedSql('c')}
        AND r.lock_time IS NOT NULL
        AND r.lock_time > NOW()
        AND r.lock_time <= NOW() + ($2 || ' hours')::interval
        -- A round with no fixtures cannot be picked in, so nobody is outstanding for it.
        AND EXISTS (SELECT 1 FROM fixture f WHERE f.round_id = r.id)
        AND ($3::int IS NULL OR c.id = $3::int)
    ),

    member AS (
      SELECT
        o.competition_id,
        o.round_id,
        /*
        The organiser's own name for this player, not app_user.display_name. This is an
        organiser-facing list meant for a group chat, and the personal name is the one they set
        and the one their players answer to - the whole point of the Personal names feature.
        */
        cu.player_display_name     AS display_name,
        (au.email LIKE $4)         AS is_bot,
        /*
        A guest is anybody on the guest domain who is not a bot, plus the null-address case that
        routes/get-unpicked-players.js also allows for. They have no login, so they can never pick
        for themselves and pick_reminder can never reach them - which is what makes them the
        organiser's own job rather than someone to chase.
        */
        (
          au.email IS NULL
          OR (au.email LIKE '%@lms-guest.com' AND au.email NOT LIKE $4)
        )                          AS is_guest,
        (p.id IS NULL)             AS no_pick

      FROM open_round o
      INNER JOIN competition_user cu
        ON cu.competition_id = o.competition_id
        AND cu.status = 'active'
      INNER JOIN app_user au
        ON au.id = cu.user_id
      LEFT JOIN pick p
        ON p.user_id = cu.user_id
        AND p.round_id = o.round_id
    ),

    tally AS (
      SELECT
        competition_id,
        round_id,
        COUNT(*) FILTER (WHERE NOT is_bot)                              AS player_count,
        COUNT(*) FILTER (WHERE NOT is_bot AND no_pick)                  AS outstanding_count,
        COUNT(*) FILTER (WHERE is_guest AND no_pick)                    AS guest_outstanding_count,
        COUNT(*) FILTER (WHERE NOT is_bot AND NOT is_guest AND no_pick) AS player_outstanding_count,

        /*
        Names alphabetical, and the whole list rather than the first NAME_CAP: the cap is applied
        in buildTemplateData so the count and the shown names cannot disagree, and so the stored
        template_data records who was actually outstanding at send time.
        */
        ARRAY_AGG(display_name ORDER BY display_name)
          FILTER (WHERE is_guest AND no_pick)                           AS guest_names,
        ARRAY_AGG(display_name ORDER BY display_name)
          FILTER (WHERE NOT is_bot AND NOT is_guest AND no_pick)        AS player_names

      FROM member
      GROUP BY competition_id, round_id
    )

    SELECT
      c.organiser_id           AS user_id,
      u.email                  AS user_email,
      u.display_name           AS user_display_name,
      c.id                     AS competition_id,
      c.name                   AS competition_name,
      o.round_id,
      o.round_number,
      o.lock_time,
      t.player_count,
      t.outstanding_count,
      t.guest_outstanding_count,
      t.player_outstanding_count,
      t.guest_names,
      t.player_names,

      -- Null throughout when the preceding round is missing or not fully settled: no summary.
      last_round.round_number  AS last_round_number,

      /*
      Who is left, and who went out in that round. Same two questions services/roundOver.js
      answers for a player, from the same two places and for the same reason: "did they survive?"
      is competition_user.status, "how did that round go for them?" is player_progress.outcome,
      and a player with a life left loses and stays in.

      Bots are excluded here as they are from the tally above - a seeded competition would
      otherwise report survivors nobody recognises. Guests are kept: they are real people in the
      room, they just cannot log in.

      THERE IS NO survivors_count, AND THAT IS DELIBERATE. "Still in after the last round" and
      "in the open round" are the same set: the only thing that eliminates anybody is a round
      being processed, and the open round has not locked. So the summary's count is player_count
      from the tally above - one number with one definition, rather than a second COUNT(*) with
      the same WHERE clause that a later change could leave disagreeing with itself. Only the
      NAMES are fetched here, because the tally aggregates the wrong thing for a sample.

      Subqueries rather than joins because they aggregate over different grains; there is one row
      per competition here, so this is not the N+1 the rule in CLAUDE.md is about.
      */
      (
        SELECT string_agg(x.display_name, ', ')
        FROM (
          SELECT s.player_display_name AS display_name
          FROM competition_user s
          INNER JOIN app_user su ON su.id = s.user_id
          WHERE s.competition_id = c.id
            AND s.status = 'active'
            AND (su.email IS NULL OR su.email NOT LIKE $4)
          ORDER BY s.player_display_name
          LIMIT ${SAMPLE_SIZE}
        ) x
      ) AS survivors_sample,
      (
        SELECT COUNT(*)
        FROM player_progress pp
        INNER JOIN competition_user cu2
          ON cu2.competition_id = c.id AND cu2.user_id = pp.player_id
        INNER JOIN app_user ou ON ou.id = pp.player_id
        WHERE pp.round_id = last_round.id
          AND pp.outcome = 'LOSE'
          AND cu2.status = 'out'
          AND (ou.email IS NULL OR ou.email NOT LIKE $4)
      ) AS out_count,
      (
        SELECT string_agg(x.display_name, ', ')
        FROM (
          SELECT cu3.player_display_name AS display_name
          FROM player_progress pp
          INNER JOIN competition_user cu3
            ON cu3.competition_id = c.id AND cu3.user_id = pp.player_id
          INNER JOIN app_user ou ON ou.id = pp.player_id
          WHERE pp.round_id = last_round.id
            AND pp.outcome = 'LOSE'
            AND cu3.status = 'out'
            AND (ou.email IS NULL OR ou.email NOT LIKE $4)
          ORDER BY cu3.player_display_name
          LIMIT ${SAMPLE_SIZE}
        ) x
      ) AS out_sample

    FROM tally t
    INNER JOIN open_round o  ON o.competition_id = t.competition_id AND o.round_id = t.round_id
    INNER JOIN competition c ON c.id = t.competition_id
    INNER JOIN app_user u    ON u.id = c.organiser_id

    /*
    The round IMMEDIATELY BEFORE the open one, and only if every fixture in it has been processed.
    LEFT JOIN because a competition on round 1, or one whose last round's results are not in yet,
    still gets the email - it simply carries no summary.

    round_number = open - 1 rather than "the highest settled round" is what stops the same round
    being reported twice; see the header.
    */
    LEFT JOIN LATERAL (
      SELECT r.id, r.round_number
      FROM round r
      WHERE r.competition_id = c.id
        AND r.round_number = o.round_number - 1
        AND EXISTS (SELECT 1 FROM fixture f WHERE f.round_id = r.id)
        AND NOT EXISTS (SELECT 1 FROM fixture f WHERE f.round_id = r.id AND f.processed IS NULL)
      LIMIT 1
    ) last_round ON true

    WHERE t.player_count > 0

      -- The ORGANISER's own address. Excludes guests and bots on purpose: neither can receive
      -- email, and neither can create a competition anyway.
      AND u.email IS NOT NULL
      AND u.email != ''
      AND u.email NOT LIKE '%@lms-guest.com'

      /*
      Once per competition per round, whatever the row's status. This is what makes the sweep safe
      to run twice, by cron or by hand - the queue row written by the first run is what stops the
      second.
      */
      AND NOT EXISTS (
        SELECT 1
        FROM email_queue eq
        WHERE eq.competition_id = c.id
          AND eq.round_id = o.round_id
          AND eq.email_type = '${EMAIL_TYPE}'
      )

      -- Opt-outs, defined once in services/emailPreference.js
      AND ${notOptedOutSql({ userColumn: 'u.id', competitionColumn: 'c.id', groupParam: '$1' })}

    ORDER BY t.outstanding_count DESC, c.id
  `, [
    groupFor(EMAIL_TYPE),        // $1
    String(REPORT_WINDOW_HOURS), // $2
    competition_id,              // $3
    BOT_EMAIL_LIKE               // $4
  ]);

  return result.rows;
}

/**
 * Build the template data one report needs.
 *
 * No extra queries: findCandidates aggregated the names and the summary in the same scan that
 * produced the counts, and fetching them again per candidate would be an N+1 for data already
 * read.
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
    round_id,
    round_number,
    lock_time,
    player_count,
    outstanding_count,
    guest_outstanding_count,
    player_outstanding_count,
    guest_names,
    player_names,
    last_round_number,
    survivors_sample,
    out_count,
    out_sample
  } = candidate;

  /*
  Resolved at queue time so the stored template_data is self-contained - a queued email must still
  render correctly if it is sent later.
  */
  const token = await getOrCreateToken(user_id);
  const unsubscribe = token ? unsubscribeLinks(token, groupFor(EMAIL_TYPE)) : null;

  /*
  The cap applied once, here, so the shown names and the "and N others" count are derived from the
  same array and cannot contradict each other.
  */
  const capNames = (names) => {
    const all = names || [];
    return { shown: all.slice(0, NAME_CAP), others: Math.max(0, all.length - NAME_CAP) };
  };

  /*
  Stamped at queue time and stated in the email, for the same reason as organiserNudge: the
  outstanding count is a photograph of a moving thing. An organiser reading it an hour later must
  not be given a bare figure and then find two of the names have already picked - saying when it
  was true is what keeps the email trustworthy the second and third time they get it.
  */
  const correct_at = formatUk(new Date(), { hour: 'numeric', minute: '2-digit', hour12: true });

  return {
    email_tracking_id: `${EMAIL_TYPE}_${competition_id}_${round_id}_${Date.now()}`,
    unsubscribe,
    user_email,
    user_display_name,
    competition_id,
    competition_name,
    round_number: Number(round_number),
    lock_time,
    correct_at,
    player_count: Number(player_count),
    outstanding_count: Number(outstanding_count),
    guests: {
      count: Number(guest_outstanding_count),
      ...capNames(guest_names)
    },
    players: {
      count: Number(player_outstanding_count),
      ...capNames(player_names)
    },

    /*
    Null when there is no settled preceding round - round 1, or results not keyed yet. The template
    drops the whole summary block on null rather than rendering an empty one, so a missing object
    and a zero count must not be confused: build it or do not.
    */
    last_round: last_round_number == null ? null : {
      round_number: Number(last_round_number),
      out_count: Number(out_count) || 0,
      out_sample: out_sample || null,
      /*
      Names only. The count of survivors is player_count above - see the note in findCandidates
      for why there is not a second one.
      */
      survivors_sample: survivors_sample || null
    }
  };
}

/**
 * Queue one report, and open its tracking row.
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
      subjectFor(templateData.outstanding_count, templateData.lock_time, templateData.competition_name)
    ]);

    return { success: true, queue_id: queueResult.rows[0].id, template_data: templateData };
  } catch (error) {
    console.error('organiserRound.queueCandidate failed:', {
      competition_id: candidate.competition_id,
      round_id: candidate.round_id,
      error: error.message
    });
    return { success: false, error: error.message };
  }
}

module.exports = {
  EMAIL_TYPE,
  subjectFor,
  REPORT_WINDOW_HOURS,
  NAME_CAP,
  SAMPLE_SIZE,
  findCandidates,
  buildTemplateData,
  queueCandidate
};
