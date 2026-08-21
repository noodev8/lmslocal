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

/**
 * The same promotion, scoped to one competition and run inside a caller's transaction.
 *
 * Used by the results push, which is the earliest honest moment to correct the column: it has
 * just refused to do anything unless the round had locked, so a competition it processes has by
 * definition started. Waiting for the nightly run left a competition reading SETUP on the admin
 * screen while its first results were already in.
 *
 * The predicate is deliberately identical to syncCompetitionStatus above rather than a cheaper
 * "we know it started" shortcut, so there is one definition of what ACTIVE means. In particular
 * `c.status = 'SETUP'` is what makes this safe to call after the completion check: a competition
 * just written to COMPLETE in the same transaction no longer matches, so it cannot be demoted
 * back to ACTIVE by this call.
 *
 * @param {object} client  An open pg client - the caller's transaction, not the pool.
 * @param {number} competitionId
 * @returns {Promise<boolean>} true if this call promoted it.
 */
async function promoteCompetitionIfStarted(client, competitionId) {
  const result = await client.query(`
    UPDATE competition c
    SET    status = 'ACTIVE'
    FROM   round r
    WHERE  r.competition_id = c.id
      AND  r.round_number = 1
      AND  r.lock_time <= CURRENT_TIMESTAMP
      AND  c.status = 'SETUP'
      AND  c.id = $1
    RETURNING c.id
  `, [competitionId]);

  return result.rowCount > 0;
}

module.exports = { syncCompetitionStatus, promoteCompetitionIfStarted };
