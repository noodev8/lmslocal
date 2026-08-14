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

`scoped` is what the routes ask before insisting on a competition_id. Most outline emails are
about one competition; the Welcome and Info rows are platform-wide and have none. The admin
screen's competition picker does not apply to those, and passing one would be meaningless rather
than harmless - a preview scoped to a competition nobody in the list belongs to.
=======================================================================================================================================
*/

const pickReminder = require('./pickReminder');
const joinLms = require('./joinLms');
const createdComp = require('./createdComp');
const joinComp = require('./joinComp');
const gameStartReminder = require('./gameStartReminder');
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
  buildCreatedCompEmail,
  sendCreatedCompEmail,
  buildWelcomeCompetitionEmail,
  sendWelcomeCompetitionEmail,
  buildGameStartReminderEmail,
  sendGameStartReminderEmail,
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
  Platform-wide, unlike the other reminders. "Which organisers are stuck?" is not a question about
  one competition, and the operator wants the list rather than to hunt for it a competition at a
  time.
  */
  game_start_reminder: {
    scoped: false,
    service: gameStartReminder,
    build: buildGameStartReminderEmail,
    send: sendGameStartReminderEmail
  },
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

module.exports = { CATALOG, entryFor, wiredTypes };
