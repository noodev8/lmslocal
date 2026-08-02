/*
=======================================================================================================================================
UK wall-clock to UTC
=======================================================================================================================================
Purpose: Kickoff times are entered the way they are advertised - "Saturday 3pm" - which is UK
         local time, GMT in winter and BST in summer. The database stores timestamptz, so that
         has to become a real instant before it is sent.

Doing this with the machine's own timezone would work on a laptop in London and silently shift
every kickoff by an hour on a machine set to anything else, which is exactly the kind of bug
that only shows up in October. So the offset is measured against Europe/London explicitly.
=======================================================================================================================================
*/

const LONDON = 'Europe/London';

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: LONDON,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/**
 * How far ahead of UTC London is at a given instant, in milliseconds.
 * +3600000 during BST, 0 during GMT.
 */
function londonOffsetMs(instantMs: number): number {
  const parts = partsFormatter.formatToParts(new Date(instantMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);

  // The London wall clock at this instant, reinterpreted as though it were UTC. The gap
  // between that and the real instant is the offset.
  const asIfUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') === 24 ? 0 : get('hour'), // en-GB renders midnight as 24 in some engines
    get('minute'),
    get('second')
  );

  return asIfUtc - instantMs;
}

/**
 * Convert a UK wall-clock date and time to an ISO 8601 UTC string.
 *
 * @param dateString - 'YYYY-MM-DD'
 * @param timeString - 'HH:MM' (24 hour)
 * @returns ISO 8601 string, e.g. '2026-08-21T14:00:00.000Z' for 3pm BST
 */
export function ukTimeToUtcIso(dateString: string, timeString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const [hours, minutes] = timeString.split(':').map(Number);

  // Treat the entered wall clock as if it were UTC, then step back by London's offset.
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hours, minutes, 0);

  // Applied twice because the first guess can land on the wrong side of a DST change, in which
  // case the offset it measured was the wrong one. The second pass is measured at the corrected
  // instant and settles everywhere except inside the one hour that does not exist in spring.
  let instant = wallClockAsUtc - londonOffsetMs(wallClockAsUtc);
  instant = wallClockAsUtc - londonOffsetMs(instant);

  return new Date(instant).toISOString();
}

/** 'Saturday 21 August 2026 at 3pm' - the confirmation line under the date and time pickers. */
export function describeUkDateTime(dateString: string, timeString: string): string {
  const date = new Date(`${dateString}T00:00:00`);
  const dayName = date.toLocaleDateString('en-GB', { weekday: 'long' });
  const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const [hourStr, minuteStr] = timeString.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  const suffix = hour < 12 ? 'am' : 'pm';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const time = minute === 0 ? `${displayHour}${suffix}` : `${displayHour}:${minuteStr}${suffix}`;

  return `${dayName} ${dateStr} at ${time}`;
}
