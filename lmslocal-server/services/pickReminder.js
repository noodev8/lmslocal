/*
=======================================================================================================================================
Pick Reminder Service
=======================================================================================================================================
Purpose: The one definition of who should receive a pick reminder, and how their email is built.
         Since 2026-11-26 it covers both games: one email per PERSON, listing every competition
         where they still owe this round a choice - a pick in Last Man Standing, a prediction in
         Matchday. docs/matchday.md §9 is the contract.

Used by the admin screen's preview and send and by the cron (scripts/email-sweep.js), through
services/emailCatalog.js. routes/load-pick-reminder.js, the older queue-only batch route, reads
the LMS half only (findLmsCandidates). Kept in one place for the same reason evaluateCompetition
is in services/fixtureService.js: the preview and the send must agree, or the screen offers a
button that then refuses, or worse shows a count of five and mails eight.

The eligibility rules, one query per game (LMS_ITEMS_SQL, MATCHDAY_ITEMS_SQL):
  - competition is not COMPLETE (compared case-insensitively; the column holds upper case)
  - competition is not archived, and is the game the query is for
  - round has a lock time, in the future, and within REMINDER_WINDOW_HOURS (30)
  - round has fixtures
  - player is still active in the competition
  - player has a real email (guest accounts use @lms-guest.com and are excluded)
  - LMS: player has not picked this round. Matchday: player has made NO prediction this round
  - nothing is already queued for this player, competition and round
  - not opted out, per services/emailPreference.js

Then findCandidates groups the items by person. A person with one LMS competition gets the email
exactly as it was before Matchday.

Pick reminder belongs to the player.game group, so switching Game emails off stops it. That
costs the player a life when they then miss a pick, and it is deliberate - see the note in
emailPreference.js.

2026-11-27: a push notification goes with the email to anyone who has the app (pushFor, sent by
services/emailPush.js). Nothing above changes for it - no rule here is the push's own. Opting out
of Game emails stops the push too, since the push only follows a sent email.
=======================================================================================================================================
*/

const { query } = require('../database');
const { notOptedOutSql, groupFor, getOrCreateToken, unsubscribeLinks } = require('./emailPreference');
const { formatUkShort } = require('./dateFormat');
const { notArchivedSql } = require('./competitionEngagement');
const { isLmsSql, isMatchdaySql } = require('./gameType');
const { getMatchdayTable } = require('./matchdayTable');
const { groupByPerson, queueBundle, lmsFirst } = require('./emailBundle');

/**
 * The subject, in one place.
 *
 * It was written out longhand at three sites - here, the template in emailService.js and
 * routes/load-pick-reminder.js - so the tracking row, the admin preview and the email itself
 * each had their own copy of the same string to keep in step. Every other catalog email already
 * imports its subject from the service that queues it; this one predates that convention.
 *
 * TWO THINGS CAME OUT OF IT AND ONE WENT IN.
 *
 * Out: the organiser's name. This was the only subject in the catalog shaped "Organiser
 * (Competition): thing" - every other one leads with the competition, which is what the player
 * recognises. It also meant load-pick-reminder falling back to the literal "Competition
 * Organizer" when the name was null, so some players got a reminder from nobody. The organiser
 * is still named in the body, where there is room to say who they are.
 *
 * Out: the round number, which a player in one competition already knows.
 *
 * In: the deadline, first. This is the one email where the deadline IS the message, and a phone
 * shows about 40 characters of a subject - so anything after the competition name is cut on a
 * long name, which is exactly when it is needed most. Leading with it means it survives.
 *
 * Safe to state a time because findCandidates already requires lock_time to be non-null and in
 * the future, so there is no null case and no past case to render.
 */
const subjectFor = (competitionName, lockTime) =>
  `Pick by ${formatUkShort(lockTime)} — ${competitionName}`;

/*
Matchday's subject for a reminder about one Matchday competition: the same shape, deadline first,
in Matchday's word (docs/matchday.md §2 - "predict", never "pick").
*/
const matchdaySubjectFor = (competitionName, lockTime) =>
  `Predict by ${formatUkShort(lockTime)} — ${competitionName}`;


/*
How close to the lock a round has to be before its players are chased. 3 days -> 48h (2026-08-14)
-> 12h (2026-08-18) -> 24h (2026-08-21, when this went on a daily cron) -> 30h (2026-08-28).

WHY 30, AND WHY IT IS NOT A RETURN TO THE OLD 48

24 was modelled on the rounds that existed in August, which were mostly evening locks. The season
proper is not shaped like that: Andreas expects the MAJORITY of fixtures to be Saturday 12:30
kickoffs, locking at 11:30.

A 24-hour window handles those badly, and the arithmetic is unforgiving. At the daily 09:00 BST
run, a Saturday 11:30 lock is 26.5 hours away on the Friday - outside 24, so nothing goes - and
2.5 hours away on the Saturday. So the season's most common round would have had its one and only
reminder land at half past nine on a Saturday morning, giving a player two and a half hours to
notice it while they are out. 30 hours moves that to the Friday morning, with a full day to act.

WHICH LOCKS THIS ACTUALLY CHANGES, since "wider window" sounds like everything moves. With one run
a day, a lock is chased on the first run at or after (lock - window), so only locks falling between
about 09:00 and 15:00 shift to the previous morning. Everything from mid-afternoon onwards is
unaffected:

  Sat 11:30 lock   was Sat 09:00 (2.5h)   now Fri 09:00 (26.5h)   <- the case this is for
  Sun 13:00 lock   was Sun 09:00 (4h)     now Sat 09:00 (28h)
  Sat 20:00 lock   Sat 09:00 (11h)        unchanged
  Sun 16:00 lock   Sun 09:00 (7h)         unchanged

The Sunday early-afternoon row is the cost, and it is real: that reminder now arrives a day ahead,
which is the failure mode 48 hours was rejected for - no urgency yet, the player thinks "later",
and the per-round queue guard means nothing follows. It is accepted because the Saturday case is
the common one and its old behaviour was worse: 2.5 hours on a weekend morning is not a reminder,
it is a formality.

WHAT IS DIFFERENT FROM THE 48-HOUR VERSION, and the reason this is not that mistake repeated: 48
sent EVERY round a day or more early, including the evening locks that make up the rest of the
calendar. 30 is tuned to sit just past a morning lock's overnight gap and no further - it moves
the mornings and leaves the evenings where they are.

THE SECOND REMINDER IS STILL FORECLOSED by the per-round queue guard, and the wider window makes
that more pointed, not less: a Friday-morning reminder for a Saturday-morning lock is the only one
that player gets. What partly covers it is services/organiserNudge.js, which reports the stragglers
to the ORGANISER on the Friday evening so their group chat can do what a second email cannot.
That sequencing is the whole reason the two windows are the sizes they are - see the note there
before changing either.

The email is ONCE PER PLAYER PER ROUND, so the window is not "when may we send" - it is "when does
the one reminder get spent". Three days out was the worst moment to spend it: no urgency yet, the
player thinks "later", and the queue guard means nothing follows.

WHY IT MUST BE WIDER THAN THE CRON INTERVAL - the argument that got it to 24, and still holds

The 12 was chosen while a person was pressing the button, and the reasoning depended on that: the
window only bounded who APPEARED on the admin card, and the operator decided when to actually
press. Under a daily cron the window decides both - a round is chased on the one run that falls
inside it, or it is never chased at all, silently, because nobody qualified.

12 hours against a 24-hour cron leaves a 12-hour band each day in which a lock gets no reminder at
all. Modelled against all 33 real rounds of the last 60 days plus the Saturday 12:30 kickoffs
expected this season: at a 07:00 run, 12 hours misses 24 of 37 - every evening lock, which sits 13
hours out and is therefore outside the window at the only run that could catch it. 24 hours misses
nothing at any run time between 07:00 and 11:00.

That reasoning was written when 24 was the answer and it is unchanged by the move to 30; the point
it makes is about the FLOOR, not the ceiling. Whatever this number is, it must exceed the gap
between runs or some band of lock times qualifies at no run at all, silently.

KEEP THIS ABOVE THE CRON INTERVAL. If the sweep ever runs less often than daily, this number has to
grow with it, roughly doubled - see docs/email/email-cron-priority-order.txt for the schedule.

The bigger version - two reminders per round, one early and one close to the deadline - is
foreclosed by the per-round queue guard, and would need a "which reminder is this" concept rather
than a wider window. Deliberately not built.
*/
const REMINDER_WINDOW_HOURS = 30;


/*
WHAT THE ITEMS ARE. A candidate is a PERSON, carrying `items`: one per competition where that
person still owes the round something. The two games find their items separately, each in its
own query with its own game guard, and the person is assembled afterwards (findCandidates).

The lead item is the one with the earliest deadline. Its competition_id, round_id and lock_time
are spread onto the candidate itself, which is what every shared caller reads - the admin screen's
recipient list and its user:competition selection, the sweep script's log, the skip rows. Those
callers did not change; a person in one competition is exactly the candidate they always were.
*/

const LMS_ITEMS_SQL = `
    SELECT
      'lms'                  AS game_type,
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
      -- Archived competitions get no email at all. See notArchivedSql.
      AND ${notArchivedSql('c')}
      -- Last Man Standing's half. Matchday's is MATCHDAY_ITEMS_SQL. See isLmsSql.
      AND ${isLmsSql('c')}

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
`;

/*
Matchday's half (docs/matchday.md §9). The same window, the same guards and the same
once-per-round queue check as LMS - only "has not picked" changes, to "has made NO prediction this
round". A player who has predicted some of the matches and left the rest has made a choice, and
skipping is never penalised (§1), so they are not chased. Nobody is eliminated in Matchday;
competition_user.status stays 'active' for every player and is checked anyway, so a future
removal mechanism cannot leak through.
*/
const MATCHDAY_ITEMS_SQL = `
    SELECT
      'matchday'             AS game_type,
      cu.user_id,
      u.email                AS user_email,
      u.display_name         AS user_display_name,
      c.id                   AS competition_id,
      c.name                 AS competition_name,
      c.end_value            AS rounds_total,
      r.id                   AS round_id,
      r.round_number,
      r.lock_time,
      org.display_name       AS organizer_name

    FROM competition c

    INNER JOIN round r
      ON r.competition_id = c.id
      AND UPPER(c.status) != 'COMPLETE'
      AND ${notArchivedSql('c')}
      AND ${isMatchdaySql('c')}

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

    WHERE r.lock_time IS NOT NULL
      AND r.lock_time > NOW()
      AND r.lock_time <= NOW() + ($3 || ' hours')::interval
      AND EXISTS (
        SELECT 1 FROM fixture f WHERE f.round_id = r.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM prediction pr
        WHERE pr.user_id = u.id
          AND pr.round_id = r.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM email_queue eq
        WHERE eq.user_id = u.id
          AND eq.competition_id = c.id
          AND eq.round_id = r.id
          AND eq.email_type = 'pick_reminder'
      )
      AND ${notOptedOutSql({ userColumn: 'u.id', competitionColumn: 'c.id', groupParam: '$2' })}
      AND ($1::int IS NULL OR c.id = $1)

    ORDER BY c.id, r.round_number, u.id
`;

const itemParams = (competitionId) =>
  [competitionId, groupFor('pick_reminder'), String(REMINDER_WINDOW_HOURS)];

/**
 * Last Man Standing items only, one row per player per competition - the shape this service
 * returned before Matchday. Kept for routes/load-pick-reminder.js, the older queue-only batch
 * route, which queues one LMS email per row and must not be handed a Matchday item it would
 * render in LMS words.
 *
 * @param {object} [opts]
 * @param {number} [opts.competition_id]
 * @returns {Promise<Array>}
 */
async function findLmsCandidates(opts = {}) {
  const result = await query(LMS_ITEMS_SQL, itemParams(opts.competition_id ?? null));
  return result.rows;
}

/**
 * Find every PERSON who should get a pick reminder, with every competition they owe a choice in.
 *
 * WHY THE PERSON AND NOT THE COMPETITION (2026-11-26). Both games run on the same gameweek, so a
 * player in two competitions has two deadlines in the same few hours. Sent separately, the second
 * email is killed by the quiet period every week (services/emailQuiet.js) - and it was already
 * happening to a player in two LMS competitions, whose second reminder died in the same run. One
 * email per person listing every competition is the only shape where nothing is lost. See
 * docs/matchday.md §9.
 *
 * SCOPE PICKS WHO, NOT WHAT. With a competition_id, the result is the people who owe a choice in
 * THAT competition - but each still carries all their items, because the email they would get is
 * the whole of what they owe. A scoped send that left out their other competition would leave
 * that item to be killed by the quiet period on the next run, which is the loss this exists to
 * prevent.
 *
 * Items are found platform-wide and filtered afterwards, for the same reason: the other
 * competitions are needed. Two queries whatever the scope, each bounded by "rounds locking in the
 * next 30 hours", which is small.
 *
 * @param {object} [opts]
 * @param {number} [opts.competition_id] - only people with an item in this competition
 * @returns {Promise<Array>} one candidate per person: the lead item's fields, plus `items`
 */
async function findCandidates(opts = {}) {
  const [lms, matchday] = await Promise.all([
    query(LMS_ITEMS_SQL, itemParams(null)),
    query(MATCHDAY_ITEMS_SQL, itemParams(null))
  ]);

  return groupByPerson([...lms.rows, ...matchday.rows], {
    competitionId: opts.competition_id || null,
    // Earliest deadline first; LMS before Matchday on a tie, since a missed pick costs a life.
    order: (a, b) =>
      new Date(a.lock_time) - new Date(b.lock_time)
      || lmsFirst(a) - lmsFirst(b)
      || a.competition_id - b.competition_id
  });
}

/*
True when the candidate is a person with exactly one LMS competition - the reminder as it was
before Matchday, which is rendered exactly as it was. A row from findLmsCandidates (no `items`)
counts too.
*/
const isLegacyLms = (candidate) =>
  !candidate.items || (candidate.items.length === 1 && candidate.items[0].game_type === 'lms');

/** The round's fixtures, in kickoff order. */
async function fixturesFor(roundId) {
  const result = await query(`
    SELECT id, home_team, away_team, home_team_short, away_team_short, kickoff_time
    FROM fixture
    WHERE round_id = $1
    ORDER BY kickoff_time ASC
  `, [roundId]);
  return result.rows;
}

/*
Teams already used, derived from this player's own picks in earlier rounds. Never read from a
stored list - see docs/allowed-teams.md, the allowed_teams table was dropped precisely because
it was a second copy of this.
*/
async function teamsUsedFor(userId, competitionId, roundNumber) {
  const result = await query(`
    SELECT DISTINCT p.team
    FROM pick p
    INNER JOIN round prev_r ON prev_r.id = p.round_id
    WHERE p.user_id = $1
      AND prev_r.competition_id = $2
      AND prev_r.round_number < $3
    ORDER BY p.team
  `, [userId, competitionId, roundNumber]);
  return result.rows.map((row) => row.team);
}

/** One LMS competition's part of the email. */
async function lmsItemData(userId, item) {
  return {
    game_type: 'lms',
    competition_id: item.competition_id,
    competition_name: item.competition_name,
    organizer_name: item.organizer_name || 'Competition Organizer',
    round_id: item.round_id,
    round_number: item.round_number,
    lock_time: item.lock_time,
    fixtures: await fixturesFor(item.round_id),
    teams_used: await teamsUsedFor(userId, item.competition_id, item.round_number)
  };
}

/*
One Matchday competition's part of the email. Where the player stands comes from
services/matchdayTable.js, the one place totals are derived (docs/matchday.md §4.2). Before any
round has settled there is no table to speak of, so position is left null and the email says the
table starts this round.
*/
async function matchdayItemData(userId, item) {
  const table = await getMatchdayTable(item.competition_id);
  const row = table ? table.rows.find((r) => r.user_id === userId) : null;
  const started = Boolean(table && table.rounds_settled > 0 && row);

  return {
    game_type: 'matchday',
    competition_id: item.competition_id,
    competition_name: item.competition_name,
    organizer_name: item.organizer_name || 'Competition Organizer',
    round_id: item.round_id,
    round_number: item.round_number,
    rounds_total: item.rounds_total,
    lock_time: item.lock_time,
    fixtures: await fixturesFor(item.round_id),
    position: started ? row.position : null,
    total: started ? row.total : null,
    player_count: table ? table.rows.length : null
  };
}

/**
 * Build the template data for one candidate.
 *
 * A person with one LMS competition gets EXACTLY the data this built before Matchday, with no
 * `items` key, so services/emailService.js renders them the email it always has. Anyone else -
 * one Matchday competition, or more than one of either - gets `items`, one per competition in
 * deadline order, and the email is assembled from a section per game.
 *
 * Per-candidate queries (fixtures, teams used, the Matchday table) are per-player by nature.
 *
 * @param {object} candidate - a row from findCandidates (or findLmsCandidates)
 * @returns {Promise<object>} template data, stored on email_queue.template_data
 */
async function buildTemplateData(candidate) {
  const { user_id, user_email, user_display_name, competition_id, round_id } = candidate;

  /*
  The recipient's own unsubscribe link, resolved at queue time so the stored template_data is
  self-contained - a queued email must still render correctly if it is sent later.
  */
  const token = await getOrCreateToken(user_id);
  const unsubscribe = token ? unsubscribeLinks(token, groupFor('pick_reminder')) : null;
  const email_tracking_id = `pick_reminder_${user_id}_${competition_id}_${round_id}_${Date.now()}`;

  if (isLegacyLms(candidate)) {
    const lms = await lmsItemData(user_id, candidate);
    return {
      email_tracking_id,
      unsubscribe,
      user_email,
      user_display_name,
      competition_name: lms.competition_name,
      organizer_name: lms.organizer_name,
      round_number: lms.round_number,
      lock_time: lms.lock_time,
      fixtures: lms.fixtures,
      teams_used: lms.teams_used,
      competition_id,
      round_id,
      user_id
    };
  }

  const items = [];
  for (const item of candidate.items) {
    items.push(item.game_type === 'matchday'
      ? await matchdayItemData(user_id, item)
      : await lmsItemData(user_id, item));
  }

  return {
    email_tracking_id,
    unsubscribe,
    user_email,
    user_display_name,
    competition_id,
    round_id,
    lock_time: items[0].lock_time,
    user_id,
    items
  };
}

/**
 * The subject for any reminder, from its template data. One competition keeps that game's own
 * subject; more than one is game-neutral and leads with the earliest deadline - docs/matchday.md
 * §2 allows a neutral subject on an email covering more than one competition, and only there.
 *
 * @param {object} templateData - as built by buildTemplateData
 * @returns {string}
 */
function subjectForData(templateData) {
  const { items } = templateData;
  if (!items) return subjectFor(templateData.competition_name, templateData.lock_time);
  if (items.length === 1) {
    const only = items[0];
    return only.game_type === 'matchday'
      ? matchdaySubjectFor(only.competition_name, only.lock_time)
      : subjectFor(only.competition_name, only.lock_time);
  }
  return `Before ${formatUkShort(items[0].lock_time)} — ${items.length} competitions need you`;
}

/**
 * The push notification that goes WITH this email, for someone who has the app.
 *
 * THE EMAIL IS THE MASTER (Andreas, 2026-11-27). The push is not a second message with its own
 * rules or words: services/emailPush.js sends it only when this email was sent, and it says what
 * the email says, cut to fit a lock screen. Title is the email's subject - it already leads with the
 * deadline because that is what survives truncation, which is just as true on a phone's lock screen
 * - and the body is the email's opening line, copied from buildPickReminderEmail and
 * buildBundledReminderEmail in services/emailService.js. Change the wording there, change it here.
 *
 * THE TAP GOES WHERE THE EMAIL'S BUTTON GOES. One competition: its Play tab - for LMS the pick, for
 * Matchday the predictions, which is what `pick_reminder` routes to in the app's
 * notification_routes.dart for either game. More than one: the email sends them to the dashboard, so
 * the push carries no competition_id and the app simply opens; it lands on the dashboard from cold,
 * and a running app stays where it is (docs/mobile-notifications.md §3).
 *
 * Matchday included from the start: the app that knows Matchday is 2.1.1, app_version's minimum on
 * both platforms since before this was written, and opening an older one forces the update first
 * (routes/check-app-version.js), notification taps included.
 *
 * @param {object} templateData - as built by buildTemplateData
 * @returns {{type: string, title: string, body: string, data: object, record: object}}
 *          `record` is the competition and round the record row is filed under - the lead item,
 *          the earliest deadline, even when the tap itself names no competition.
 */
function pushFor(templateData) {
  const { items } = templateData;
  const title = subjectForData(templateData);

  // One LMS competition, the pre-Matchday shape: no `items`.
  if (!items) {
    const record = {
      competition_id: templateData.competition_id,
      round_id: templateData.round_id,
      round_number: templateData.round_number
    };
    return {
      type: 'pick_reminder',
      title,
      body: `Time to make your pick for Round ${templateData.round_number}.`,
      data: record,
      record
    };
  }

  const lead = items[0];
  const record = {
    competition_id: lead.competition_id,
    round_id: lead.round_id,
    round_number: lead.round_number
  };

  if (items.length === 1) {
    const body = lead.game_type === 'matchday'
      ? `Make your predictions for ${lead.rounds_total
          ? `Round ${lead.round_number} of ${lead.rounds_total}`
          : `Round ${lead.round_number}`}.`
      : `Time to make your pick for Round ${lead.round_number}.`;
    return { type: 'pick_reminder', title, body, data: record, record };
  }

  return {
    type: 'pick_reminder',
    title,
    body: `${items.length} of your competitions are waiting on you this round.`,
    data: {},
    record
  };
}

/**
 * Queue one reminder, and open its tracking row. One queue row per competition in the email - see
 * queueBundle in services/emailBundle.js.
 *
 * @param {object} candidate - a row from findCandidates
 * @returns {Promise<{success: boolean, queue_id?: number, queue_ids?: number[], template_data?: object, error?: string}>}
 */
async function queueCandidate(candidate) {
  try {
    const templateData = await buildTemplateData(candidate);
    const { queue_id, queue_ids } = await queueBundle({
      emailType: 'pick_reminder',
      candidate,
      templateData,
      subject: subjectForData(templateData)
    });
    return { success: true, queue_id, queue_ids, template_data: templateData };
  } catch (error) {
    console.error('pickReminder.queueCandidate failed:', { user_id: candidate.user_id, error: error.message });
    return { success: false, error: error.message };
  }
}

module.exports = {
  REMINDER_WINDOW_HOURS,
  subjectFor,
  matchdaySubjectFor,
  subjectForData,
  pushFor,
  findCandidates,
  findLmsCandidates,
  buildTemplateData,
  queueCandidate
};
