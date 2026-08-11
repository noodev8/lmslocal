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
const {
  buildPickReminderEmail,
  sendPickReminderEmail,
  buildJoinLmsEmail,
  sendJoinLmsEmail
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
