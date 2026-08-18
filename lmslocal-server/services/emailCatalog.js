/*
=======================================================================================================================================
Email Catalog
=======================================================================================================================================
Purpose: The one place that says which outline emails are wired up, and what each one is made of.

Before this file, the three admin routes each carried `if (email_type !== 'pick_reminder')` and
each imported that service directly. Wiring a second email meant editing the same condition in
three places, and any one of them left behind would have been a screen offering a send the server
refused - or worse, a count from one email and a send from another.

Adding an email is now one entry here plus its service and template. Nothing in the routes
changes.

`cron` is what scripts/email-sweep.js asks before sending anything unattended. It holds a BUCKET
NAME - the argument the script is run with, e.g. 'daily' - and an entry without the field is not
scheduled at all. That is the switch: hardcoded here on purpose rather than in a table, because
turning an email loose on a schedule is a decision worth seeing in a diff and reviewing, not a
checkbox somebody can flip at 2am with no record.

A name rather than a boolean so a second cadence costs a crontab line and one edited value instead
of a code change. It is also what the admin Emails screen renders its clock against, read back
through /admin/get-email-targets - so the symbol on the screen and the behaviour of the script are
the same constant, and a screen claiming an email is scheduled cannot be wrong.

Emails join the cron ONE AT A TIME, each watched running before the next - the machinery shipped
with nothing scheduled at all. On the cron today:

  empty_comp   daily   (first one, 2026-08-18) - chosen to go first because its blast radius is
                       the smallest on the platform: once per competition ever, no deadline in the
                       copy, and a candidate list that has never been larger than four.

`scoped` is what the routes ask before insisting on a competition_id. Most outline emails are
about one competition; the Welcome and Info rows are platform-wide and have none. The admin
screen's competition picker does not apply to those, and passing one would be meaningless rather
than harmless - a preview scoped to a competition nobody in the list belongs to.
=======================================================================================================================================
*/

const pickReminder = require('./pickReminder');
const joinLms = require('./joinLms');
const emptyComp = require('./emptyComp');
const createdComp = require('./createdComp');
const joinComp = require('./joinComp');
// gameStartReminder is not imported: unwired on purpose - see the note where its entry was.
// shareReminder is not imported: it is unwired on purpose - see the note where its entry was.
const fixtureReminder = require('./fixtureReminder');
const resultReminder = require('./resultReminder');
const gameComplete = require('./gameComplete');
const roundOver = require('./roundOver');
const hints = require('./hints');
const {
  buildPickReminderEmail,
  sendPickReminderEmail,
  buildJoinLmsEmail,
  sendJoinLmsEmail,
  buildEmptyCompEmail,
  sendEmptyCompEmail,
  buildCreatedCompEmail,
  sendCreatedCompEmail,
  buildWelcomeCompetitionEmail,
  sendWelcomeCompetitionEmail,
  buildFixtureReminderEmail,
  sendFixtureReminderEmail,
  buildResultReminderEmail,
  sendResultReminderEmail,
  buildGameCompleteEmail,
  sendGameCompleteEmail,
  buildRoundOverEmail,
  sendRoundOverEmail,
  buildHintEmail,
  sendHintEmail
} = require('./emailService');

/*
Keys match email_queue.email_type and the OUTLINE rows on lmslocal-admin's Emails screen. An
email absent from here is not wired: the routes refuse it with UNSUPPORTED_EMAIL_TYPE, so the
greyed row on the screen is not the only thing stopping a send.
*/
const CATALOG = {
  pick_reminder: {
    scoped: true,
    service: pickReminder,
    build: buildPickReminderEmail,
    send: sendPickReminderEmail
  },
  join_lms: {
    scoped: false,
    service: joinLms,
    build: buildJoinLmsEmail,
    send: sendJoinLmsEmail
  },
  /*
  The follow-up to created_comp: a competition set up a week ago that nobody has joined. Replaced
  signup_nudge, which chased dormant registrations - twenty times as many people, but far colder,
  and only one nudge email is wanted (2026-08-18).

  Scoped, and the grain is the COMPETITION not the organiser: it carries that competition's join
  code, and somebody with two empty ones has two to fill.

  Clear its backlog with "Mark as sent" before the first real send.
  */
  empty_comp: {
    scoped: true,
    cron: 'daily',
    service: emptyComp,
    build: buildEmptyCompEmail,
    send: sendEmptyCompEmail
  },
  created_comp: {
    scoped: true,
    service: createdComp,
    build: buildCreatedCompEmail,
    send: sendCreatedCompEmail
  },
  welcome: {
    scoped: true,
    service: joinComp,
    build: buildWelcomeCompetitionEmail,
    send: sendWelcomeCompetitionEmail
  },
  /*
  game_start_reminder is UNWIRED, decided 2026-08-14 - the second email dropped that day, and for
  the same reason as share_reminder.

  It chased an organiser whose fixture-service competition could start today but who had never
  pressed Ready. The state still exists: competition 207 was created on 8 Aug with no start block,
  so it has no rounds and no ready_at, and it would have qualified on 22 Aug once past the 14-day
  threshold. This is not being dropped because the case vanished.

  It is being dropped because email is the wrong instrument for it. An organiser who has not
  pressed a button in a fortnight is disengaged, and email is what disengaged people ignore - the
  same argument that retired share_reminder. A notice on their own dashboard reaches them where
  they would actually see it, with no send window and no operator.

  services/gameStartReminder.js and its template stay on disk. Note what is worth keeping if it is
  ever revived: it ran candidates through getCompetitionStartOutlook, the same function behind the
  organiser's own start card, so nobody was ever chased toward a button that would then refuse
  them. That guard took a bug to discover; do not rebuild without it.
  */
  /*
  share_reminder is UNWIRED, decided 2026-08-14. Not a gap - it was built, measured and dropped.

  It would have told an organiser that round 1 locks in 48 hours and joining closes with it. The
  numbers killed it: every organiser plays in their own competition, so a player_count of 1 means
  nobody joined - and of the four competitions in that state, two had been created days earlier by
  organisers who knew exactly when they started, while the two who might plausibly have forgotten
  had already had seven weeks. Late joining happens without prompting anyway - 46% of all joins
  landed inside the final 48 hours across four competitions that ran before this email existed.

  It also pointed at the wrong remedy: with two days left, "share your link" is the action least
  likely to work, where moving the start date would. And it was the only email with an EXPIRING
  window, so it required an operator at the screen on one particular evening or it was pointless.

  The moment is real - a competition about to start with nobody in it - but email is the wrong
  channel, because the organiser who needs it is the disengaged one. A notice on their own
  dashboard reaches them with no send window. See docs/email/README.md.

  services/shareReminder.js and its template stay on disk with their rules intact. Re-wiring is
  this entry back; do not rebuild it from scratch.
  */

  /*
  Platform-wide for the same reason as game_start_reminder, and the exact mirror of it: that one
  takes fixture_service = true, this one false, so no competition can ever be a candidate for both.
  */
  fixture_reminder: {
    scoped: false,
    service: fixtureReminder,
    build: buildFixtureReminderEmail,
    send: sendFixtureReminderEmail
  },
  /*
  The other half of fixture_reminder: that one needs the latest round settled, this one needs it
  played and unsettled, so the same round can never qualify for both.
  */
  result_reminder: {
    scoped: false,
    service: resultReminder,
    build: buildResultReminderEmail,
    send: sendResultReminderEmail
  },
  /*
  Scoped, unlike the three reminders above it: this is about one named competition and everybody
  in it, so the operator picks the competition rather than being handed a platform-wide list.
  */
  game_complete: {
    scoped: true,
    service: gameComplete,
    build: buildGameCompleteEmail,
    send: sendGameCompleteEmail
  },
  /*
  Round Over. The key stays 'results' - it is what email_queue rows, the tracking table and the
  admin OUTLINE already use, and renaming it would orphan the history for a tidier word.
  */
  results: {
    scoped: true,
    service: roundOver,
    build: buildRoundOverEmail,
    send: sendRoundOverEmail
  },

  /*
  Hints. One entry each so the admin screen can send them independently and email_type stays
  meaningful per hint, but all of them share one builder and one service - the hints differ only
  in their words, which live in services/hints.js. A third hint is an entry there plus two lines
  here, not a new service and a new template.

  Unscoped: a hint is about an organiser rather than a competition, and the service picks which of
  their competitions to name.
  */
  promote_competition: {
    scoped: false,
    service: hints.serviceFor('promote_competition'),
    build: buildHintEmail,
    send: sendHintEmail
  },
  update_scores_mid_round_tip: {
    scoped: false,
    service: hints.serviceFor('update_scores_mid_round_tip'),
    build: buildHintEmail,
    send: sendHintEmail
  }
};

/**
 * The catalog entry for an email type, or null if it is not wired up.
 * @param {string} emailType
 * @returns {object|null}
 */
function entryFor(emailType) {
  if (!emailType) return null;
  return CATALOG[emailType] || null;
}

/**
 * Every wired email type.
 * @returns {string[]}
 */
function wiredTypes() {
  return Object.keys(CATALOG);
}

/**
 * The email types scheduled in one cron bucket, in catalog order.
 *
 * Returns an empty array for a bucket nothing is assigned to, which is the correct answer and not
 * an error - it is what every bucket returns today. The script reports it and exits 0, because a
 * cron that fails loudly when there is simply no work would train whoever reads the log to ignore
 * it.
 *
 * @param {string} bucket - the cron bucket name, e.g. 'daily'
 * @returns {string[]}
 */
function scheduledTypes(bucket) {
  if (!bucket) return [];
  return Object.keys(CATALOG).filter((type) => CATALOG[type].cron === bucket);
}

/**
 * Every bucket name any entry is assigned to. Lets the script reject a typo'd argument by saying
 * what the real buckets are, rather than silently sweeping nothing.
 * @returns {string[]}
 */
function cronBuckets() {
  return [...new Set(Object.values(CATALOG).map((e) => e.cron).filter(Boolean))];
}

module.exports = { CATALOG, entryFor, wiredTypes, scheduledTypes, cronBuckets };
