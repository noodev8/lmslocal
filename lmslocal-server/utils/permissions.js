/**
 * Permission Helper Utilities
 *
 * These functions check if a user has permission to perform specific actions
 * in a competition. Permissions are granted either by:
 * 1. Being the main organiser (competition.organiser_id)
 * 2. Having delegated permissions set in competition_user table
 */

const { query } = require('../database');

/**
 * Check if user can manage results for a competition
 * @param {number} user_id - User attempting the action
 * @param {number} competition_id - Competition ID
 * @returns {Promise<{authorized: boolean, is_organiser: boolean}>}
 */
async function canManageResults(user_id, competition_id) {
  const result = await query(`
    SELECT
      c.organiser_id,
      cu.manage_results
    FROM competition c
    LEFT JOIN competition_user cu ON cu.competition_id = c.id AND cu.user_id = $1
    WHERE c.id = $2
  `, [user_id, competition_id]);

  if (result.rows.length === 0) {
    return { authorized: false, is_organiser: false };
  }

  const row = result.rows[0];
  const is_organiser = row.organiser_id === user_id;
  const has_permission = row.manage_results === true;

  return {
    authorized: is_organiser || has_permission,
    is_organiser: is_organiser
  };
}

/**
 * Check if user can manage fixtures for a competition
 * @param {number} user_id - User attempting the action
 * @param {number} competition_id - Competition ID
 * @returns {Promise<{authorized: boolean, is_organiser: boolean}>}
 */
async function canManageFixtures(user_id, competition_id) {
  const result = await query(`
    SELECT
      c.organiser_id,
      cu.manage_fixtures
    FROM competition c
    LEFT JOIN competition_user cu ON cu.competition_id = c.id AND cu.user_id = $1
    WHERE c.id = $2
  `, [user_id, competition_id]);

  if (result.rows.length === 0) {
    return { authorized: false, is_organiser: false };
  }

  const row = result.rows[0];
  const is_organiser = row.organiser_id === user_id;
  const has_permission = row.manage_fixtures === true;

  return {
    authorized: is_organiser || has_permission,
    is_organiser: is_organiser
  };
}

/**
 * Check if user can manage players for a competition
 * @param {number} user_id - User attempting the action
 * @param {number} competition_id - Competition ID
 * @returns {Promise<{authorized: boolean, is_organiser: boolean}>}
 */
async function canManagePlayers(user_id, competition_id) {
  const result = await query(`
    SELECT
      c.organiser_id,
      cu.manage_players
    FROM competition c
    LEFT JOIN competition_user cu ON cu.competition_id = c.id AND cu.user_id = $1
    WHERE c.id = $2
  `, [user_id, competition_id]);

  if (result.rows.length === 0) {
    return { authorized: false, is_organiser: false };
  }

  const row = result.rows[0];
  const is_organiser = row.organiser_id === user_id;
  const has_permission = row.manage_players === true;

  return {
    authorized: is_organiser || has_permission,
    is_organiser: is_organiser
  };
}

/**
 * Check if user can manage promotion/marketing for a competition
 * @param {number} user_id - User attempting the action
 * @param {number} competition_id - Competition ID
 * @returns {Promise<{authorized: boolean, is_organiser: boolean}>}
 */
async function canManagePromote(user_id, competition_id) {
  const result = await query(`
    SELECT
      c.organiser_id,
      cu.manage_promote
    FROM competition c
    LEFT JOIN competition_user cu ON cu.competition_id = c.id AND cu.user_id = $1
    WHERE c.id = $2
  `, [user_id, competition_id]);

  if (result.rows.length === 0) {
    return { authorized: false, is_organiser: false };
  }

  const row = result.rows[0];
  const is_organiser = row.organiser_id === user_id;
  const has_permission = row.manage_promote === true;

  return {
    authorized: is_organiser || has_permission,
    is_organiser: is_organiser
  };
}

/**
 * Check if user is the main organiser (not just a delegate)
 * Used for actions only the main organiser can perform (e.g., granting permissions)
 * @param {number} user_id - User attempting the action
 * @param {number} competition_id - Competition ID
 * @returns {Promise<boolean>}
 */
async function isMainOrganiser(user_id, competition_id) {
  const result = await query(
    'SELECT organiser_id FROM competition WHERE id = $1',
    [competition_id]
  );

  if (result.rows.length === 0) {
    return false;
  }

  return result.rows[0].organiser_id === user_id;
}

module.exports = {
  canManageResults,
  canManageFixtures,
  canManagePlayers,
  canManagePromote,
  isMainOrganiser
};
