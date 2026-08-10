/*
=======================================================================================================================================
Service: Reset Cost
=======================================================================================================================================
Purpose: What it costs to reset a competition. One implementation, used by both get-reset-quote
         and reset-competition, so the price an organiser is shown is the price they are charged.

Full reasoning in docs/reset-billing.md - §2 for why a reset costs anything at all, §3 for the
arithmetic below.
=======================================================================================================================================
*/

const { countOrganiserChargeableMembers, countCompetitionChargeableMembers } = require('./botPool');

/**
 * The cost of resetting one competition.
 *
 * A reset is charged as though every remaining member joined again, one at a time, through the
 * normal join path. One pricing rule in the product, not two - which means the organiser's free
 * allowance is counted live and globally here exactly as it is everywhere else:
 *
 *   others = chargeable memberships in the organiser's OTHER competitions
 *   here   = chargeable members of THIS competition
 *   cost   = max(0, others + here - LIMIT) - max(0, others - LIMIT)
 *
 * The subtraction is what stops the organiser being billed twice for free places another
 * competition has already used up. Worth reading the awkward case rather than treating it as a
 * bug: resetting a 200-player competition while a 30-player one runs elsewhere costs 200, not
 * 180, because the free places are already spoken for. That falls out of the formula instead of
 * needing a special case, which is the reason to use a formula.
 *
 * Bots are excluded from both counts - services/botPool.js owns that definition.
 *
 * @param {Object} client - anything with .query(text, params): a pg client inside a transaction,
 *                          or the shared database helper
 * @param {number} competitionId
 * @param {number} organiserId
 * @returns {Promise<{cost: number, here: number, others: number, balance: number, freeLimit: number}>}
 */
async function calculateResetCost(client, competitionId, organiserId) {
  const freeLimit = parseInt(process.env.FREE_PLAYER_LIMIT) || 20;

  const total = await countOrganiserChargeableMembers(client, organiserId);
  const here = await countCompetitionChargeableMembers(client, competitionId);

  /*
  `total` already includes this competition, so `others` is the remainder. Counting the two
  separately and subtracting keeps a single definition of "chargeable" in play - a second query
  with a NOT EQUAL on competition_id would be a second place for that definition to drift.
  */
  const others = Math.max(0, total - here);

  const cost = Math.max(0, others + here - freeLimit) - Math.max(0, others - freeLimit);

  const balanceResult = await client.query(
    'SELECT paid_credit FROM app_user WHERE id = $1',
    [organiserId]
  );
  const balance = parseInt(balanceResult.rows[0]?.paid_credit, 10) || 0;

  return { cost, here, others, balance, freeLimit };
}

module.exports = { calculateResetCost };
