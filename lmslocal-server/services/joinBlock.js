/*
=======================================================================================================================================
Service: joinBlock
=======================================================================================================================================
Purpose: Record that a player was turned away from a competition because the organiser is at
         their free player limit with no credits, so the organiser can be told on their dashboard.

Used by:
  - routes/get-competition-by-code.js   (the public lookup - where almost all blocks happen)
  - routes/join-competition-by-code.js  (the race where a competition fills between the two)
=======================================================================================================================================
Why this exists

A blocked join is the most valuable event in the funnel and the least visible one. A real player
wants in, the competition is real and open, and the only thing in the way is a credit purchase the
organiser does not know they need to make. Before this, the player got a message and walked, and
the organiser never found out their competition had stopped growing.

Deliberately minimal
  - No IP, no user agent, nothing identifying the player. This is written from a PUBLIC,
    UNAUTHENTICATED endpoint. A salted IP hash would still be personal data under GDPR, would drag
    in a retention obligation, and would buy precision the dashboard message does not need - it
    says "people tried", never a number anyone should treat as exact.
  - Never throws. A failed metric write must not break a player's lookup or join. Callers should
    not await this for correctness, only to keep the connection tidy.

Not a measure, a floor. Players who hear "it's full" from a mate and never open the link never
appear here, so zero blocks does not mean nothing was lost.
=======================================================================================================================================
*/

const { query } = require('../database');

// One person refreshing the page is one person, not five. Anything from the same competition
// inside this window collapses into the row already there. Two genuinely different players
// arriving within a few minutes of each other also collapse - accepted, because the message is
// deliberately vague and an undercount is the safer error here.
const COLLAPSE_WINDOW_MINUTES = 10;

/**
 * Record a blocked join. Safe to call on a public endpoint: swallows its own errors and
 * collapses repeats.
 *
 * @param {number} competitionId
 * @param {number} organiserId
 * @returns {Promise<void>}
 */
async function recordJoinBlock(competitionId, organiserId) {
  try {
    // Guarded insert rather than a read followed by a write: one statement, and two concurrent
    // requests cannot both pass the check and both insert.
    await query(`
      INSERT INTO join_block (competition_id, organiser_id)
      SELECT $1, $2
      WHERE NOT EXISTS (
        SELECT 1 FROM join_block
        WHERE competition_id = $1
          AND occurred_at > NOW() - ($3 || ' minutes')::interval
      )
    `, [competitionId, organiserId, COLLAPSE_WINDOW_MINUTES]);
  } catch (error) {
    // Deliberately swallowed - see the header. Logged so it is not silent to us.
    console.error('recordJoinBlock failed (non-fatal):', error.message);
  }
}

module.exports = { recordJoinBlock, COLLAPSE_WINDOW_MINUTES };
