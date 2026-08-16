/*
=======================================================================================================================================
Reading dates back out
=======================================================================================================================================
Purpose: How the admin screens render a stored timestamp. The counterpart to uk-time.ts, which
         handles the other direction - a wall clock being typed in, on its way to the database.

Everything here formats in the READER'S timezone, deliberately. Timestamps arrive as UTC ISO
strings, and letting the browser convert is what makes 16:34Z read as 17:34 in August. Format one
of these server-side, or slice the ISO string to get at the time, and it is an hour early all
summer.
=======================================================================================================================================
*/

/*
CALENDAR days, not elapsed 24-hour blocks, because "Today" and "Yesterday" are calendar words and
were being answered with arithmetic.

Dividing the elapsed milliseconds by 86,400,000 made a pick at 21:37 last night read as "Today"
at 09:41 this morning - twelve hours, so zero blocks - while the same organiser's login three days
earlier correctly read "3 days ago". Two lines of the same cell disagreeing about what day it is
looks like the data is wrong when only the arithmetic was.

Rounding rather than flooring the day difference: a clock change makes a local day 23 or 25 hours,
and both must still count as one day.
*/
const startOfDay = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Whole calendar days between then and now. 0 is today, 1 yesterday. Null in, null out. */
export const daysSince = (iso: string | null): number | null =>
  iso === null ? null : Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / 86_400_000);

/** True for anything on today's date, however many hours ago. */
export const isToday = (iso: string | null): boolean => daysSince(iso) === 0;

/** '16 Aug 2026' */
export const formatDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/** '17:34' */
export const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/*
"3 days ago" reads faster than a date when the question is "is this still alive".

Today carries the time, because at 5pm "Today" could mean nine hours ago, and two rows a few
hours apart otherwise read identically. Yesterday and older do not - the hour changes nothing you
would do about them. Pair this with a title attribute holding the absolute date, so the exact day
is still one hover away.
*/
export const formatAge = (iso: string | null): string => {
  if (iso === null) return 'Never';
  const days = daysSince(iso) as number;
  if (days <= 0) return `Today, ${formatTime(iso)}`;
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months < 12 ? `${months} month${months === 1 ? '' : 's'} ago` : formatDate(iso);
};
