/*
=======================================================================================================================================
Utility: Round Auto-Locking
=======================================================================================================================================
Purpose: Automatically locks rounds when all active players have submitted their picks (round 2+ only)
=======================================================================================================================================
Business Rules:
- Round 1: NEVER auto-locks (players still joining competition)
- Round 2+: Auto-locks when ALL active players have made picks
- Overrides organizer's lock_time if all picks come in early
- Only locks if round is not already locked
- Must be called within a transaction for atomicity
=======================================================================================================================================
*/

/**
 * Checks if all active players have made picks for a round and auto-locks if conditions are met
 *
 * @param {Object} client - PostgreSQL client within an active transaction
 * @param {number} round_id - ID of the round to check for auto-locking
 * @returns {Promise<Object>} Result object with lock status and metadata
 *
 * @example
 * await transaction(async (client) => {
 *   // ... save pick ...
 *   const lockResult = await checkAndLockRoundIfComplete(client, round_id);
 *   if (lockResult.locked) {
 *     console.log(`Round ${lockResult.round_number} auto-locked - all picks received`);
 *   }
 * });
 */
async function checkAndLockRoundIfComplete(client, round_id) {
  // AUTO-LOCK DISABLED: Waiting for first fixture is more exciting
  // To re-enable, remove this early return
  return {
    locked: false,
    reason: 'AUTO_LOCK_DISABLED'
  };

  try {
    // === COMPREHENSIVE VALIDATION QUERY ===
    // Single query to get all data needed for lock decision
    const result = await client.query(`
      SELECT
        -- Round information
        r.id as round_id,
        r.round_number,
        r.lock_time,
        r.competition_id,

        -- Current time for lock status check
        CURRENT_TIMESTAMP as current_time,

        -- Check if already locked
        CASE WHEN CURRENT_TIMESTAMP >= r.lock_time THEN true ELSE false END as is_locked,

        -- Count active players in competition
        (
          SELECT COUNT(*)
          FROM competition_user
          WHERE competition_id = r.competition_id
          AND status = 'active'
        ) as total_active_players,

        -- Count picks made for this round (ONLY from active players)
        -- FIX: Previously counted all picks including eliminated players
        -- This caused premature auto-lock when admin set picks for eliminated players
        (
          SELECT COUNT(*)
          FROM pick p
          INNER JOIN competition_user cu ON cu.user_id = p.user_id
            AND cu.competition_id = r.competition_id
          WHERE p.round_id = r.id
            AND cu.status = 'active'
        ) as picks_made

      FROM round r
      WHERE r.id = $1
    `, [round_id]);

    // If round not found, return early with no action
    if (result.rows.length === 0) {
      return {
        locked: false,
        reason: 'ROUND_NOT_FOUND',
        round_id: round_id
      };
    }

    const data = result.rows[0];

    // === BUSINESS RULE 1: Never auto-lock Round 1 ===
    // Round 1 must stay open for new players to join the competition
    if (data.round_number === 1) {
      return {
        locked: false,
        reason: 'ROUND_1_NO_AUTO_LOCK',
        round_id: round_id,
        round_number: data.round_number,
        picks_made: parseInt(data.picks_made),
        total_active_players: parseInt(data.total_active_players)
      };
    }

    // === BUSINESS RULE 2: Don't lock if already locked ===
    // Preserve existing lock_time if round is already locked
    if (data.is_locked) {
      return {
        locked: false,
        reason: 'ALREADY_LOCKED',
        round_id: round_id,
        round_number: data.round_number,
        lock_time: data.lock_time
      };
    }

    // === BUSINESS RULE 3: Check if all picks are in ===
    const totalActivePlayers = parseInt(data.total_active_players);
    const picksMade = parseInt(data.picks_made);

    // If not all players have picked yet, no action needed
    if (picksMade < totalActivePlayers) {
      return {
        locked: false,
        reason: 'PICKS_INCOMPLETE',
        round_id: round_id,
        round_number: data.round_number,
        picks_made: picksMade,
        total_active_players: totalActivePlayers,
        picks_remaining: totalActivePlayers - picksMade
      };
    }

    // === ALL CONDITIONS MET: AUTO-LOCK THE ROUND ===
    // Update lock_time to current timestamp to immediately lock the round
    await client.query(`
      UPDATE round
      SET lock_time = CURRENT_TIMESTAMP
      WHERE id = $1
      AND CURRENT_TIMESTAMP < lock_time
    `, [round_id]);

    // Return success with comprehensive metadata for logging
    return {
      locked: true,
      reason: 'ALL_PICKS_COMPLETE',
      round_id: round_id,
      round_number: data.round_number,
      competition_id: data.competition_id,
      picks_made: picksMade,
      total_active_players: totalActivePlayers,
      original_lock_time: data.lock_time,
      new_lock_time: data.current_time,
      time_saved_minutes: Math.round((new Date(data.lock_time) - new Date(data.current_time)) / 1000 / 60)
    };

  } catch (error) {
    // Log error but don't throw - auto-locking is a convenience feature, not critical
    console.error('Round auto-lock check error:', {
      error: error.message,
      round_id: round_id,
      timestamp: new Date().toISOString()
    });

    return {
      locked: false,
      reason: 'ERROR',
      error: error.message,
      round_id: round_id
    };
  }
}

module.exports = {
  checkAndLockRoundIfComplete
};
