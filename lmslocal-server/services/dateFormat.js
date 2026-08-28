/*
=======================================================================================================================================
Date Format Service
=======================================================================================================================================
Purpose: The two ways a date is written to a player, in one place.

Everything on this platform is UK-facing and every stored timestamp is UTC, so every human-facing
date has to be rendered in Europe/London or it is an hour out for half the year. That conversion
is the whole reason this file exists.

It sits in its own module rather than in emailService.js, where formatUkDateTime used to live,
because services/pickReminder.js needs the short form for its subject and emailService.js already
requires pickReminder.js for that same subject. Importing back the other way would be a cycle.
=======================================================================================================================================
*/

const UK = 'Europe/London';

/**
 * Every other formatter here is built on this one, and any call site with a shape of its own
 * should use it rather than reaching for toLocaleString directly.
 *
 * The point is that the time zone is not something a caller can forget. Six email templates
 * formatted a date with no `timeZone` and so rendered in whatever clock the server happened to
 * keep; services/fixtureBlock.js got it right and carried a comment saying why, but a comment in
 * one file does not stop the next template being written the same wrong way.
 *
 * @param {string|Date} value - a UTC timestamp from the database
 * @param {object} options - Intl.DateTimeFormat options, minus timeZone and locale
 */
const formatUk = (value, options) =>
  new Date(value).toLocaleString('en-GB', { timeZone: UK, ...options });

/**
 * The long form, for email bodies: "Saturday 4 October at 2:00 pm".
 */
const formatUkDateTime = (value) =>
  formatUk(value, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

/**
 * Date with no time: "Saturday 3 October".
 */
const formatUkDate = (value) =>
  formatUk(value, { weekday: 'long', day: 'numeric', month: 'long' });

/**
 * The short form, for subject lines: "Sat 2pm", "Sat 2:30pm".
 *
 * Subjects are cut at roughly 40 characters on a phone, so this drops everything a player can
 * infer. No date: a pick reminder only ever goes out inside the window before the round locks,
 * so the weekday is unambiguous. No ":00" on the hour, because "Sat 2pm" is how somebody would
 * say it out loud and it buys back four characters of competition name.
 */
const formatUkShort = (value) => {
  const d = new Date(value);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: UK,
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).formatToParts(d);

  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  const weekday = get('weekday');
  const hour = get('hour');
  const minute = get('minute');
  // en-GB gives "am"/"pm" already lowercase in Node, but normalise so a locale-data change
  // cannot start shouting "2PM" from a subject line.
  const period = get('dayPeriod').toLowerCase().replace(/\s|\./g, '');

  return minute === '00' ? `${weekday} ${hour}${period}` : `${weekday} ${hour}:${minute}${period}`;
};

module.exports = { formatUk, formatUkDate, formatUkDateTime, formatUkShort };
