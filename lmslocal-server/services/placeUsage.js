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
async function getPlaceUsage(userId) {
  const FREE_PLAYER_LIMIT = parseInt(process.env.FREE_PLAYER_LIMIT) || 20;

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
  */
  const result = await query(`
    SELECT
      COALESCE(u.paid_credit, 0) AS credits,
      c.id                       AS competition_id,
      c.name                     AS competition_name,
      UPPER(c.status)            AS status,
      COUNT(mem.id)              AS places
    FROM app_user u
    LEFT JOIN competition c        ON c.organiser_id = u.id
    LEFT JOIN competition_user cu  ON cu.competition_id = c.id
    LEFT JOIN app_user mem         ON mem.id = cu.user_id
                                  AND ${chargeableMemberFilter('mem')}
    WHERE u.id = $1
    GROUP BY u.paid_credit, c.id, c.name, c.status

    -- Biggest holder first: the competition most worth knowing about is the one holding the most,
    -- and on a blocked account that is usually the one they have forgotten they still have.
    ORDER BY COUNT(mem.id) DESC, c.name
  `, [userId]);

  /*
  Competitions holding nothing are dropped here rather than in a HAVING, because a HAVING would
  also drop the no-competition row that carries the balance.
  */
  const competitions = result.rows
    .filter(row => row.competition_id !== null && Number(row.places) > 0)
    .map(row => ({
      competition_id: row.competition_id,
      name: row.competition_name,
      status: row.status,
      status_label: labelForStatus(row.status),
      places: Number(row.places)
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

/**
 * The breakdown as plain lines, for the email.
 *
 * The email cannot link to the panel and be useful - join_blocked exists for the organiser who
 * does NOT open the dashboard (see the header of services/joinBlocked.js) - so it carries the
 * same rows inline.
 *
 * @param {object} usage - as returned by getPlaceUsage
 * @returns {Array<object>} [{ name, places, status_label }]
 */
function usageLines(usage) {
  return usage.competitions.map(row => ({
    name: row.name,
    places: row.places,
    status_label: row.status_label
  }));
}

module.exports = {
  getPlaceUsage,
  usageLines,
  labelForStatus,
  STATUS_LABELS
};
