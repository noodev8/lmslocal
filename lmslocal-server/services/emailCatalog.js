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

WHICH EMAILS THE CRON SENDS IS NOT RECORDED HERE, deliberately (2026-08-18). An email is on the
cron when it has a line in the VPS crontab and off when that line is commented out - see
scripts/email-sweep.js, which takes the email's key as its argument. A flag here would be a second
switch that could disagree with the real one, and something claiming an email is scheduled when it
is not is worse than nothing claiming anything. `crontab -l` is the answer.

`scoped` is what the routes ask before insisting on a competition_id. Most outline emails are
about one competition; the Welcome and Info rows are platform-wide and have none. The admin
screen's competition picker does not apply to those, and passing one would be meaningless rather
than harmless - a preview scoped to a competition nobody in the list belongs to.
=======================================================================================================================================
*/

const pickReminder = require('./pickReminder');
const joinLms = require('./joinLms');
const emptyComp = require('./emptyComp');
const organiserNudge = require('./organiserNudge');
const organiserRound = require('./organiserRound');
const createdComp = require('./createdComp');
const joinComp = require('./joinComp');
// gameStartReminder is not imported: unwired on purpose - see the note where its entry was.
// shareReminder is not imported: it is unwired on purpose - see the note where its entry was.
const fixtureReminder = require('./fixtureReminder');
const resultReminder = require('./resultReminder');
const gameComplete = require('./gameComplete');
const roundOver = require('./roundOver');
const hints = require('./hints');
const joinBlocked = require('./joinBlocked');
const {
  buildPickReminderEmail,
  sendPickReminderEmail,
  buildJoinLmsEmail,
  sendJoinLmsEmail,
  buildEmptyCompEmail,
  buildOrganiserNudgeEmail,
  sendOrganiserNudgeEmail,
  buildOrganiserRoundEmail,
  sendOrganiserRoundEmail,
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
  sendHintEmail,
  buildJoinBlockedEmail,
  sendJoinBlockedEmail
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
  /*
  The organiser's half of pick_reminder: a round locking within three hours with too many players
  still to pick. Scoped, and the grain is the COMPETITION AND ROUND, not the organiser - somebody
  running two competitions that both stall has two group chats to post in.

  quietExempt, and it is the ONLY entry that carries it. See services/emailQuiet.js for the
  argument; the short version is that magic send's priority mechanism is the crontab's running
  order, and this email runs hourly in the afternoon rather than in the morning block, so no line
  position can express its priority at all.
  */
  organiser_nudge: {
    scoped: true,
    quietExempt: true,
    service: organiserNudge,
    build: buildOrganiserNudgeEmail,
    send: sendOrganiserNudgeEmail
  },
  /*
  The organiser's weekly round report: how the last round went, then who has still to pick in the
  open one. Scoped, and the grain is the COMPETITION AND ROUND, same as organiser_nudge.

  IT OVERLAPS BOTH results AND organiser_nudge, AND ALL THREE STAY WIRED (Andreas, 2026-09-01).
  That is unlike every other overlap in this file, which was resolved by unwiring one side, so the
  reasoning is worth stating:

    - Against results (Round Over): this is the CHEAP alternative. Round Over mails every player
      every week; this mails one person per competition and asks them to carry it the rest of the
      way. Whether a given week can afford the volume is an operator's judgement on the day, not a
      property of the code, so both stay available and the crontab decides.
    - Against organiser_nudge: same audience and an almost identical second half, but different
      moments. This fires 30 hours out, alongside pick_reminder, so the organiser has a day to
      chase; organiser_nudge fires three hours out and reports what is LEFT after the player
      reminder has worked. One or the other on a given week, not both - and nothing here enforces
      that, because it is a choice rather than a rule.

  NOT quietExempt, and organiser_nudge's exemption is not a precedent for it. That exemption was
  granted because organiser_nudge runs hourly through the afternoon, where crontab order cannot
  express priority at all. This one runs inside the morning block like everything else, so the
  mechanism it would be exempted from is present and working: if it should beat Round Over, move
  its line up. See services/emailQuiet.js for the test.
  */
  organiser_round: {
    scoped: true,
    service: organiserRound,
    build: buildOrganiserRoundEmail,
    send: sendOrganiserRoundEmail
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
  in their words, which live in services/hints.js. Another hint is an entry there plus two lines
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
  },
  personal_names_tip: {
    scoped: false,
    service: hints.serviceFor('personal_names_tip'),
    build: buildHintEmail,
    send: sendHintEmail
  },

  /*
  A player turned away because the organiser is at the free limit with no credits.

  Asked for as a hint and deliberately not built as one - it is an event rather than a lesson, it
  recurs, and it must not queue behind the weekly hint spacing. services/joinBlocked.js opens with
  the full argument, along with the four rules that stop it being sent repeatedly.

  Unscoped: the grain is the ORGANISER, because the free limit counts across everything they run
  and one purchase reopens all of it. The candidate row still names the competition that lost the
  most people, which is what the copy leads with.
  */
  join_blocked: {
    scoped: false,
    service: joinBlocked,
    build: buildJoinBlockedEmail,
    send: sendJoinBlockedEmail
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
 * The key an entry is filed under - entryFor backwards.
 *
 * services/emailSweep.js needs the email type to write a magic-send row, and is handed only the
 * entry. Both its callers know the type and could pass it, and that is exactly the arrangement to
 * avoid: an optional argument the cron could omit would file skips under the wrong email type,
 * silently, for the one caller nobody is watching. Looking it up here cannot be forgotten.
 *
 * Matched on object identity, which is safe for the three hints: they share a builder and a
 * sender but each has its own entry object here.
 *
 * @param {object} entry - a CATALOG entry
 * @returns {string|null}
 */
function typeFor(entry) {
  const found = Object.entries(CATALOG).find(([, value]) => value === entry);
  return found ? found[0] : null;
}

module.exports = { CATALOG, entryFor, wiredTypes, typeFor };
