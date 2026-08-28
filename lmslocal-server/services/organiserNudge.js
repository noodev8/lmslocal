/*
=======================================================================================================================================
Organiser Nudge Service
=======================================================================================================================================
Purpose: The one definition of "this competition has too many players still to pick, and the
         deadline is close", and how that email to the ORGANISER is built.

Built 2026-08-28, from a live afternoon: 233 players had a round locking at 8pm, 48 had not picked,
and 21 of those 48 sat in ONE competition of 70. A per-player reminder treats all 233 alike; this
one lands where the concentration is. On that afternoon it would have gone to four organisers.

WHAT THIS EMAIL IS FOR, and why it is not another pick reminder. It asks the organiser to do two
things that the platform cannot do for them:

  1. Enter the picks only they can enter. A guest has no login (add-offline-player mints
     {id}@lms-guest.com), so a guest who has not picked is not somebody to chase - it is a job
     sitting in the organiser's own dashboard. They are also invisible to pick_reminder, which
     needs a real address, so this email is the ONLY thing that tells anyone about them.
  2. Chase the real players, off-platform. Most organisers have a WhatsApp group, and it reaches
     people who ignore email. We cannot send that message; we can tell them who it is for.

Guests go FIRST in the email. It is the action only they can perform, it is certain, and it is a
minute's work; chasing is slow and uncertain.

The eligibility rules, all in findCandidates below:
  - a round is DUE: locking within NUDGE_WINDOW_HOURS, or - for a lock before
    MORNING_LOCK_BEFORE_HOUR - within EVENING_LOOKAHEAD_HOURS, so a Saturday morning lock is
    reported the evening before. One definition, dueSql, shared by the gate and the query
  - the round has fixtures
  - competition is not COMPLETE (compared case-insensitively; the column holds upper case)
  - at least MIN_OUTSTANDING players have not picked, AND they are at least MIN_OUTSTANDING_PCT
    of the competition - two gates, see below
  - organiser has a real email
  - nothing already queued for this competition and round
  - not opted out, per services/emailPreference.js

Organiser nudge belongs to the Game group, so switching Game emails off stops it - the same
accepted cost as pick_reminder.

ONE EMAIL PER COMPETITION PER ROUND, not per organiser. Somebody running two competitions that
both stall gets two, because they are two different WhatsApp groups and two different lists of
names. Andreas's call, 2026-08-28.
=======================================================================================================================================
*/

const { query } = require('../database');
const { notOptedOutSql, groupFor, getOrCreateToken, unsubscribeLinks } = require('./emailPreference');
const { formatUk, formatUkShort } = require('./dateFormat');

const EMAIL_TYPE = 'organiser_nudge';

/*
How close to the lock the organiser is told. 3 hours, Andreas's call.

DELIBERATELY MUCH TIGHTER THAN pick_reminder's 24, and the gap between the two numbers is the
whole design. The player reminder goes out in the morning and it works: on 2026-08-28 it converted
14 picks in the ninety minutes after it landed, against a baseline of one or two an hour. An
organiser nudge sent at the same time would have quoted a number that was stale by lunchtime and
asked somebody to chase fourteen people who were about to pick anyway.

So this waits for the morning email to have had its run, and reports what is LEFT. That is the
number worth acting on, and the people in it are the ones genuinely stuck.

Three hours is also about the shortest notice that leaves the organiser able to do anything - long
enough to post in a group chat and have people see it, short enough that the list is nearly final.

IT IS THE WRONG NUMBER FOR A MORNING LOCK, which is what EVENING_LOOKAHEAD_HOURS below is for.
*/
const NUDGE_WINDOW_HOURS = 3;

/*
THE SATURDAY RULE, and for this season it is the normal case rather than the exception: a 12:30
Saturday kickoff locks at 11:30, and Andreas expects most of the season's fixtures to be exactly
that.

Three hours before an 11:30 lock is 08:30 on a Saturday morning. Even with an hourly cron the
first run that can see it lands around 10:30, which is 57 minutes' notice - and the people being
chased are doing the shopping or standing on the touchline at a kids' match. The organiser can
still enter their guest picks, but the half of the email that asks them to rally real players is
dead on arrival. An email nobody can act on is worse than none: it teaches them to ignore the next.

So a lock in the MORNING is reported the evening before. The organiser posts in the group that
night, and the players have the whole evening plus Saturday morning to pick.

KEYED OFF THE LOCK'S TIME OF DAY, NOT THE CLOCK THE CRON RUNS ON. The condition is "this lock is
before 2pm UK time and it is within 18 hours", which on any hourly schedule first becomes true
about eighteen hours before - the previous evening - without this file knowing or caring what is
in the crontab. Encoding "fire on the 19:33 run" here would be a second copy of the schedule, able
to disagree with the real one, which is the thing services/emailCatalog.js already refuses to do.

2pm is the boundary because it is past every morning kickoff and short of the evening ones, which
the three-hour rule serves properly. 18 hours is chosen to land the send in the evening before a
late-morning lock rather than in the middle of the previous afternoon.

WHAT THIS TRADES, stated plainly because it inverts the reasoning above. pick_reminder's window is
24 hours, so for a Saturday 11:30 lock the players are not emailed until Saturday morning - which
means the Friday-evening nudge reports a number NOBODY HAS BEEN CHASED ABOUT YET. It will be a big
number, and some of those people would have picked on Saturday anyway.

That is accepted, and it is arguably the better order for a morning lock: the organiser's group
chat is a better channel than our email, so it goes first and our reminder mops up. But if these
nudges start reading as "everybody, every week", the fix is NOT to tighten the thresholds here -
it is that pick_reminder's 24 hours no longer suits a season of Saturday morning locks, and should
fire the day before. See docs/email/email-cron-priority-order.txt, section 1.
*/
const EVENING_LOOKAHEAD_HOURS = 18;
const MORNING_LOCK_BEFORE_HOUR = 14;

/*
TWO GATES, both of which have to pass, because either one alone fires on the wrong competitions.

Percentage alone fires on a competition of two with one outstanding - 50%, and not a problem.
Count alone fires on a big competition doing fine: 5 outstanding of 40 is 12.5%, which is a normal
afternoon, and an email about it teaches the organiser to ignore this one.

Checked against the 16 competitions locking on 2026-08-28: together these picked exactly four -
5 of 8, 6 of 10, 6 of 12, and 21 of 70 - and left the 12.5% one alone.
*/
const MIN_OUTSTANDING = 5;
const MIN_OUTSTANDING_PCT = 25;

/*
How many names the email lists per section before it says "and N others".

A cap rather than the lot, because the point of the list is that it can be pasted into a group
chat, and a wall of forty names is not pasted anywhere. The full list is a tap away in the app,
which is also the only place it is still correct by the time they read it.
*/
const NAME_CAP = 10;

/*
Bots carry bot_<name>@lms-guest.com and share the guest domain, so they have to be separated from
guests by prefix. Matches services/botPool.js isBotEmail() and the same test in
routes/get-unpicked-players.js, whose comment carries the reasoning:

  Bots ... are deliberately NOT guests here. They cannot pick either, but they are seeding
  furniture in a competition the organiser is trying out - asking him to make picks for them is
  asking him to do work for nobody.

Excluded from the NAMES and from the DENOMINATOR both. Left in the denominator, a competition
seeded with bots would be permanently short of the percentage gate and would never be nudged,
silently.
*/
const BOT_EMAIL_LIKE = 'bot_%@lms-guest.com';

/*
The subject, in one place - the tracking row is written before the template is built and the two
have to say the same thing. emailService.buildOrganiserNudgeEmail reads this same function.

Shaped like pickReminder's for the same reason: a phone shows about 40 characters, so the two
things that must survive truncation go first. Here that is the NUMBER and the DEADLINE - the
competition name is something the organiser already knows, and it is the part they can lose.

Safe to state a time because findCandidates requires lock_time to be in the future.
*/
const subjectFor = (outstandingCount, lockTime, competitionName) =>
  `${outstandingCount} still to pick by ${formatUkShort(lockTime)} — ${competitionName}`;

/*
The one definition of "close enough to nudge", shared by the cheap gate and the candidate query.

It has to be shared. The gate exists to answer "is there any point" before the expensive work, so
a gate that were even slightly wider or narrower than the real rule would either skip a send that
qualified or wave through a scan that could never produce one - and the first of those is silent.
Same argument as evaluateCompetition in services/fixtureService.js being used by both the admin
list and the push.

@param {string} lock - the lock_time column to test
@param {string} shortParam - $n holding NUDGE_WINDOW_HOURS
@param {string} longParam - $n holding EVENING_LOOKAHEAD_HOURS
@param {string} hourParam - $n holding MORNING_LOCK_BEFORE_HOUR
*/
const dueSql = (lock, shortParam, longParam, hourParam) => `
    (
      ${lock} <= NOW() + (${shortParam} || ' hours')::interval
      OR (
        EXTRACT(HOUR FROM ${lock} AT TIME ZONE 'Europe/London') < ${hourParam}
        AND ${lock} <= NOW() + (${longParam} || ' hours')::interval
      )
    )`;

/**
 * Is there any round locking inside the window at all?
 *
 * THE CHEAP GATE, and the reason this email can run hourly without being a burden. On the cron
 * this runs six times an afternoon and finds nothing on most of them - so the expensive question
 * (join every membership to every pick, aggregate, then check email_queue) must not be asked
 * until a deadline is actually near. This is one indexed range scan on round.lock_time that
 * answers "is there any point" and returns in a millisecond when there is not.
 *
 * Kept separate from findCandidates' own window clause rather than folded into it: the planner
 * cannot short-circuit the aggregate on an empty window, but an early return can.
 *
 * @returns {Promise<boolean>}
 */
async function hasRoundInWindow() {
  const result = await query(`
    SELECT 1
    FROM round
    WHERE lock_time > NOW()
      AND ${dueSql('lock_time', '$1', '$2', '$3')}
    LIMIT 1
  `, [
    String(NUDGE_WINDOW_HOURS),
    String(EVENING_LOOKAHEAD_HOURS),
    MORNING_LOCK_BEFORE_HOUR
  ]);

  return result.rows.length > 0;
}

/**
 * Find every competition whose organiser should be nudged.
 *
 * @param {object} [opts]
 * @param {number} [opts.competition_id] - restrict to one competition, which is what the admin
 *                                         screen does when one is picked. Omit to scan them all.
 * @returns {Promise<Array>} candidate rows, each carrying everything buildTemplateData needs
 */
async function findCandidates(opts = {}) {
  const { competition_id = null } = opts;

  /*
  Nothing is close to locking, so nobody qualifies however the rest of the query would have gone.
  This also means the ADMIN PREVIEW SHOWS NOTHING outside the window, which is correct rather than
  unhelpful: there is no such thing as sending this email at ten in the morning - the number would
  be wrong by the afternoon and the copy says "correct at" a time three hours from the deadline.
  To see it, run inside the window.
  */
  if (!await hasRoundInWindow()) return [];

  const result = await query(`
    WITH member AS (
      SELECT
        c.id                       AS competition_id,
        r.id                       AS round_id,
        cu.player_display_name     AS display_name,
        (au.email LIKE $2)         AS is_bot,
        /*
        A guest is anybody on the guest domain who is not a bot, plus the null-address case that
        routes/get-unpicked-players.js also allows for. They can never pick for themselves, which
        is what makes them the organiser's job rather than someone to chase.
        */
        (
          au.email IS NULL
          OR (au.email LIKE '%@lms-guest.com' AND au.email NOT LIKE $2)
        )                          AS is_guest,
        (p.id IS NULL)             AS no_pick

      FROM competition c
      INNER JOIN round r
        ON r.competition_id = c.id
      INNER JOIN competition_user cu
        ON cu.competition_id = c.id
        AND cu.status = 'active'
      INNER JOIN app_user au
        ON au.id = cu.user_id
      LEFT JOIN pick p
        ON p.user_id = cu.user_id
        AND p.round_id = r.id

      WHERE UPPER(c.status) != 'COMPLETE'
        AND r.lock_time IS NOT NULL
        AND r.lock_time > NOW()
        AND ${dueSql('r.lock_time', '$3', '$7', '$8')}
        -- A round with no fixtures cannot be picked in, so nobody is late for it.
        AND EXISTS (SELECT 1 FROM fixture f WHERE f.round_id = r.id)
        AND ($4::int IS NULL OR c.id = $4::int)
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
      r.id                     AS round_id,
      r.round_number,
      r.lock_time,
      t.player_count,
      t.outstanding_count,
      t.guest_outstanding_count,
      t.player_outstanding_count,
      t.guest_names,
      t.player_names

    FROM tally t
    INNER JOIN competition c ON c.id = t.competition_id
    INNER JOIN round r       ON r.id = t.round_id
    INNER JOIN app_user u    ON u.id = c.organiser_id

    WHERE t.player_count > 0
      AND t.outstanding_count >= $5
      AND (100.0 * t.outstanding_count / t.player_count) >= $6

      -- The ORGANISER's own address. Excludes guests and bots on purpose: neither can receive
      -- email, and neither can create a competition anyway.
      AND u.email IS NOT NULL
      AND u.email != ''
      AND u.email NOT LIKE '%@lms-guest.com'

      /*
      Once per competition per round, whatever the row's status. This is what makes the hourly
      cron safe: a 8pm lock qualifies on the 5pm, 6pm and 7pm runs alike, and the queue row
      written by the first is what stops the second and third. Same property that lets
      scripts/email-sweep.js be run by hand as often as you like.
      */
      AND NOT EXISTS (
        SELECT 1
        FROM email_queue eq
        WHERE eq.competition_id = c.id
          AND eq.round_id = r.id
          AND eq.email_type = '${EMAIL_TYPE}'
      )

      -- Opt-outs, defined once in services/emailPreference.js
      AND ${notOptedOutSql({ userColumn: 'u.id', competitionColumn: 'c.id', groupParam: '$1' })}

    ORDER BY t.outstanding_count DESC, c.id
  `, [
    groupFor(EMAIL_TYPE),       // $1
    BOT_EMAIL_LIKE,             // $2
    String(NUDGE_WINDOW_HOURS), // $3
    competition_id,             // $4
    MIN_OUTSTANDING,            // $5
    MIN_OUTSTANDING_PCT,        // $6
    String(EVENING_LOOKAHEAD_HOURS), // $7
    MORNING_LOCK_BEFORE_HOUR         // $8
  ]);

  return result.rows;
}

/**
 * Build the template data one organiser nudge needs.
 *
 * No extra queries: findCandidates already aggregated the names, because they come from the same
 * scan that produced the counts and fetching them again per candidate would be an N+1 for data
 * we have already read.
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
    player_names
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
  Stamped at queue time, and stated in the email. The number is a photograph of a moving thing -
  on the afternoon this was designed, fourteen people picked in the ninety minutes after an email
  went out - so an organiser reading it twenty minutes later must not be told a figure with no
  time attached and then find two of the names have already picked. Saying so is what keeps the
  email trustworthy on the second and third time they get it.
  */
  const correct_at = formatUk(new Date(), { hour: 'numeric', minute: '2-digit', hour12: true });

  return {
    email_tracking_id: `${EMAIL_TYPE}_${competition_id}_${round_id}_${Date.now()}`,
    unsubscribe,
    user_email,
    user_display_name,
    competition_id,
    competition_name,
    round_number,
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
    }
  };
}

/**
 * Queue one organiser nudge, and open its tracking row.
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
    console.error('organiserNudge.queueCandidate failed:', {
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
  NUDGE_WINDOW_HOURS,
  EVENING_LOOKAHEAD_HOURS,
  MORNING_LOCK_BEFORE_HOUR,
  MIN_OUTSTANDING,
  MIN_OUTSTANDING_PCT,
  NAME_CAP,
  hasRoundInWindow,
  findCandidates,
  buildTemplateData,
  queueCandidate
};
