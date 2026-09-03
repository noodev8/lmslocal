/*
=======================================================================================================================================
Place Usage Service
=======================================================================================================================================
Purpose: The one definition of WHERE an organiser's free places have gone - the same number the
         join gate enforces, broken down by the competitions holding it.

Used by routes/get-user-dashboard.js (the blocked banner), routes/get-user-credits.js (the billing
screen) and services/joinBlocked.js (the email). Kept in one place for the reason given in
joinBlocked.js about its 7-day window: if the email and the screen disagree, the email describes
something the organiser cannot find when they follow it in.

WHY THIS EXISTS AT ALL

The limit reads as capacity - "free up to 20 players" - and behaves as occupancy. A place is held
by a player's entry for as long as that competition exists, so a COMPLETE competition from last
month still holds its eight. An organiser looking at a new competition with four people in it,
being told they are full, has no way to discover that. The total is not the useful number; the
breakdown is, and the status column is the part that does the explaining.

Nothing here decides anything. It reports what botPool.js has already decided, which is why it
composes chargeableMemberFilter rather than writing its own COUNT - a second count is exactly how
the banner came to include bots when the gate excludes them, and declare an organiser blocked who
could in fact still take players.
=======================================================================================================================================
*/

const { query } = require('../database');
const { chargeableMemberFilter } = require('./botPool');

/*
Human labels for competition.status.

The column holds upper case today but not consistently across its history - see the casing note in
db/README.md - so the comparison is normalised rather than trusted. An unrecognised status falls
back to no label at all: a blank cell is survivable, a wrong one is not, and this text is the whole
point of the breakdown.
*/
const STATUS_LABELS = {
  SETUP: 'Not started',
  ACTIVE: 'Running',
  COMPLETE: 'Finished'
};

const labelForStatus = (status) => STATUS_LABELS[String(status || '').toUpperCase()] || '';

/**
 * Where one organiser's places have gone.
 *
 * Competitions holding no chargeable places are left out entirely. A row reading "0 places" is
 * noise on a panel whose only job is to account for a number.
 *
 * @param {number} userId - the organiser
 * @returns {Promise<object>} { limit, used, remaining, credits, is_blocked, competitions[] }
 */
/*
The free allowance, read in one place. Both callers below need it and an organiser's gate must not
be able to sit at a different number from the platform figure reporting on that same gate.
*/
const freePlayerLimit = () => parseInt(process.env.FREE_PLAYER_LIMIT) || 20;

async function getPlaceUsage(userId) {
  const FREE_PLAYER_LIMIT = freePlayerLimit();

  /*
  One round trip for both halves. The breakdown and the total have to come from the same read, or
  a player joining between two queries makes the rows fail to sum to the total - on a panel whose
  entire purpose is showing that they do.

  Rooted at app_user and joined outwards, NOT at competition. An organiser with no competitions,
  or whose only competition holds nothing chargeable, still has a credit balance - and rooting
  this at competition returned no rows at all for them, which reported their balance as zero.
  Every join below is therefore LEFT, and the chargeable test sits in the JOIN rather than the
  WHERE, where it would silently turn the outer joins back into inner ones.

  COUNT(mem.id) rather than COUNT(cu.id): the membership row exists whether or not its owner is
  chargeable, so counting memberships would count bots straight back in.

  re_buys is the same hazard one step further along, and the CASE is not decoration. re_buys lives
  on competition_user, which survives the LEFT JOIN for a bot - only `mem` goes NULL. So a plain
  SUM(cu.re_buys) reads a bot's re-buys and adds them, putting back exactly what the line above
  takes out. Conditioning on mem.id IS NOT NULL is what keeps this count agreeing with
  botPool.js, which is this file's whole job (see the header).

  Kept as two separate figures rather than one total: the panel this feeds has to show its
  working, or a competition with 8 players reading 10 looks like a bug. docs/re-buys.md §4.
  */
  const result = await query(`
    SELECT
      COALESCE(u.paid_credit, 0) AS credits,
      c.id                       AS competition_id,
      c.name                     AS competition_name,
      UPPER(c.status)            AS status,
      COUNT(mem.id)              AS members,
      COALESCE(SUM(CASE WHEN mem.id IS NOT NULL THEN cu.re_buys ELSE 0 END), 0) AS re_buys
    FROM app_user u
    LEFT JOIN competition c        ON c.organiser_id = u.id
    LEFT JOIN competition_user cu  ON cu.competition_id = c.id
    LEFT JOIN app_user mem         ON mem.id = cu.user_id
                                  AND ${chargeableMemberFilter('mem')}
    WHERE u.id = $1
    GROUP BY u.paid_credit, c.id, c.name, c.status

    -- Biggest holder first: the competition most worth knowing about is the one holding the most,
    -- and on a blocked account that is usually the one they have forgotten they still have.
    -- Orders on the total, re-buys included, so the panel is not sorted by a different number
    -- from the one it prints.
    ORDER BY COUNT(mem.id) + COALESCE(SUM(CASE WHEN mem.id IS NOT NULL THEN cu.re_buys ELSE 0 END), 0) DESC, c.name
  `, [userId]);

  /*
  Competitions holding nothing are dropped here rather than in a HAVING, because a HAVING would
  also drop the no-competition row that carries the balance.
  */
  const competitions = result.rows
    .filter(row => row.competition_id !== null && Number(row.members) + Number(row.re_buys) > 0)
    .map(row => ({
      competition_id: row.competition_id,
      name: row.competition_name,
      status: row.status,
      status_label: labelForStatus(row.status),

      // `places` stays the total, because that is the number every existing caller sums and
      // compares against the limit. The two parts ride alongside it for the panel to explain
      // itself with - a caller that does not care about re-buys keeps working untouched.
      places: Number(row.members) + Number(row.re_buys),
      members: Number(row.members),
      re_buys: Number(row.re_buys)
    }));

  const used = competitions.reduce((sum, row) => sum + row.places, 0);
  const credits = Number(result.rows[0]?.credits) || 0;

  return {
    limit: FREE_PLAYER_LIMIT,
    used,
    // Never negative: an organiser past the limit has spent credits, not borrowed places.
    remaining: Math.max(0, FREE_PLAYER_LIMIT - used),
    credits,

    // Both halves of the join gate's test, so a caller never has to reassemble it.
    is_blocked: used >= FREE_PLAYER_LIMIT && credits < 1,
    competitions
  };
}

/*
=======================================================================================================================================
Platform totals
=======================================================================================================================================
The same arithmetic as getPlaceUsage, summed across everyone, for the admin Competitions screen.

WHY IT LIVES HERE and not in the admin route: the place is the unit we sell, and "how many places
are billable" has to be the same question the join gate answers for one organiser. A second copy
in the route would be free to drift from the gate - and the figure would then be reporting on a
rule the product does not actually enforce.

GROUPED BY ORGANISER, and that is load-bearing. The allowance is 20 per ORGANISER across
everything they run, not 20 per competition, so the split cannot be taken competition by
competition or from a platform-wide total. Summing LEAST/GREATEST per organiser is the only shape
that gives each of them exactly one allowance.

Bots are excluded by chargeableMemberFilter, as everywhere. Guests are NOT: a guest occupies a
place and is charged for like anyone else, which is the whole reason the gate counts them.
*/

/**
 * Free against billable places across the whole platform.
 *
 * @param {object} [options]
 * @param {number[]} [options.excludedCompetitionIds] - competitions to leave out (ours)
 * @param {string[]} [options.excludedEmails] - organiser accounts to leave out (ours)
 * @returns {Promise<object>} { limit, total, free, billable }
 */
async function getPlatformPlaceTotals({ excludedCompetitionIds = [], excludedEmails = [] } = {}) {
  const FREE_PLAYER_LIMIT = freePlayerLimit();

  const result = await query(`
    WITH per_organiser AS (
      SELECT
        c.organiser_id,
        COUNT(mem.id) + COALESCE(SUM(CASE WHEN mem.id IS NOT NULL THEN cu.re_buys ELSE 0 END), 0)
          AS places
      FROM competition c
      JOIN app_user o                ON o.id = c.organiser_id
      LEFT JOIN competition_user cu  ON cu.competition_id = c.id
      LEFT JOIN app_user mem         ON mem.id = cu.user_id
                                    AND ${chargeableMemberFilter('mem')}
      WHERE c.id <> ALL($1::int[])
        AND o.email <> ALL($2::text[])
      GROUP BY c.organiser_id
    )
    SELECT
      COALESCE(SUM(places), 0)                          AS total,
      COALESCE(SUM(LEAST(places, $3::int)), 0)          AS free,
      COALESCE(SUM(GREATEST(places - $3::int, 0)), 0)   AS billable
    FROM per_organiser
  `, [excludedCompetitionIds, excludedEmails, FREE_PLAYER_LIMIT]);

  const row = result.rows[0] || {};
  return {
    limit: FREE_PLAYER_LIMIT,
    total: Number(row.total) || 0,
    free: Number(row.free) || 0,
    billable: Number(row.billable) || 0
  };
}

/**
 * The breakdown as plain lines, for the email.
 *
 * The email cannot link to the panel and be useful - join_blocked exists for the organiser who
 * does NOT open the dashboard (see the header of services/joinBlocked.js) - so it carries the
 * same rows inline.
 *
 * @param {object} usage - as returned by getPlaceUsage
 * @returns {Array<object>} [{ name, places, members, re_buys, status_label }]
 */
function usageLines(usage) {
  return usage.competitions.map(row => ({
    name: row.name,
    places: row.places,

    // Carried so the email can break the figure down exactly as the panel does. Whether it
    // prints them is a copy decision; having them here is what stops the two from being able
    // to disagree, which is the failure this service exists to prevent.
    members: row.members,
    re_buys: row.re_buys,
    status_label: row.status_label
  }));
}

module.exports = {
  getPlaceUsage,
  getPlatformPlaceTotals,
  usageLines,
  labelForStatus,
  STATUS_LABELS
};
