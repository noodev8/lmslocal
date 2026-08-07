/*
=======================================================================================================================================
Service: competitionStatus
=======================================================================================================================================
Purpose: Keep competition.status honest about which competitions have started.

Used by two callers that must not drift apart:
  - scripts/sync-competition-status.js  (the nightly cron on the VPS)
  - routes/sync-competition-status.js   (manual trigger, service token)
=======================================================================================================================================
Why this exists

competition.status is a stored value that lags reality. It was only ever written when an
organiser loaded their own dashboard (get-user-dashboard.js), so a competition that had started
still read SETUP until its organiser next signed in - indefinitely, if they never did. Admin
reporting counts by status and undercounted started competitions as a result.

This does NOT make status safe to gate on. The join gate computes the same condition live from
Round 1's lock time and must keep doing so: between a round locking and this next running, the
column is still wrong. See docs/player-onboarding.md §4.2.

The invite code is deliberately left alone. It is the competition's identity for its whole life
and must never be recycled while the competition exists - a reissued code would send someone
holding an old poster into a different organiser's competition. See §3.1.
=======================================================================================================================================
*/

const { query } = require('../database');

/**
 * Promote every SETUP competition whose Round 1 lock time has passed.
 *
 * Restricting the UPDATE to status = 'SETUP' makes this idempotent, so a cron that fires twice
 * does no extra work and reports nothing the second time.
 *
 * @returns {Promise<Array<{competition_id: number, name: string, lock_time: Date}>>}
 *          The competitions promoted by this call. Empty when there was nothing to do.
 */
async function syncCompetitionStatus() {
  const result = await query(`
    UPDATE competition c
    SET    status = 'ACTIVE'
    FROM   round r
    WHERE  r.competition_id = c.id
      AND  r.round_number = 1
      AND  r.lock_time <= CURRENT_TIMESTAMP
      AND  c.status = 'SETUP'
    RETURNING c.id AS competition_id, c.name, r.lock_time
  `);

  return result.rows.map(row => ({
    competition_id: row.competition_id,
    name: row.name,
    lock_time: row.lock_time
  }));
}

module.exports = { syncCompetitionStatus };
