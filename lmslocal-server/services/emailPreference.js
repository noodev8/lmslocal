/*
=======================================================================================================================================
Email Preference Service
=======================================================================================================================================
Purpose: The one definition of what a person has opted out of, and the one place that decides
         whether a given email may be sent to them.

Preferences are grouped by CONSUMER x SECTION from docs/email/email-outline.xlsx, not by
individual email. What someone switches off is "organiser tips" or "game emails", never "Round
Over specifically" - so the group is the unit, and the group key is what email_preference.email_type
holds.

Section alone would have been simpler but wrong: Player/Game (pick reminders) and Organiser/Game
(fixture reminders) are unrelated things that happen to share a section, and anyone who both
organises and plays would have had one switch for both.

Storage, on the existing table, no schema change:
  email_type      the group key below, or 'all' for the global kill switch
  competition_id  0 for a global preference; a real id to mute one competition entirely
  enabled         false means opted out. A MISSING ROW MEANS SUBSCRIBED.

The missing-row rule is load-bearing. Nobody on the platform has a row today, so an opt-in
default would have silently stopped every email at once. Rows are only ever written when someone
opts out or deliberately opts back in.

TRANSACTIONAL EMAIL DOES NOT CONSULT THIS. A password reset, a payment confirmation or a contact
form reply is a direct answer to something the person just did; suppressing it because they
muted game updates would be a broken product, not a respected preference.
=======================================================================================================================================
*/

const { query } = require('../database');

// The global kill switch. Kept as 'all' because it predates the group model and already works.
const ALL = 'all';

/*
Group keys. The value stored in email_preference.email_type.

Deliberately dotted rather than underscored so a group key can never be confused with one of the
legacy per-email types ('pick_reminder', 'results') at a glance in the database.
*/
const GROUPS = {
  PLAYER_WELCOME: 'player.welcome',
  PLAYER_GAME: 'player.game',
  ORGANISER_WELCOME: 'organiser.welcome',
  ORGANISER_GAME: 'organiser.game',
  ORGANISER_TIPS: 'organiser.tips',
  PLATFORM_WELCOME: 'platform.welcome',
  PLATFORM_INFO: 'platform.info'
};

/*
Which group each email on the outline belongs to. Keys match email_queue.email_type.

Pick reminder sits in PLAYER_GAME with no exemption, which is a decision rather than an
oversight: switching Game off stops the reminder that keeps a player from missing a pick and
losing a life. The unsubscribe page says so in as many words; it does not override the choice.
*/
const EMAIL_GROUPS = {
  welcome: GROUPS.PLAYER_WELCOME,
  results: GROUPS.PLAYER_GAME,
  pick_reminder: GROUPS.PLAYER_GAME,
  game_complete: GROUPS.PLAYER_GAME,
  organiser_game_invite: GROUPS.PLAYER_GAME,
  created_comp: GROUPS.ORGANISER_WELCOME,
  game_start_reminder: GROUPS.ORGANISER_GAME,
  result_reminder: GROUPS.ORGANISER_GAME,
  fixture_reminder: GROUPS.ORGANISER_GAME,
  promote_competition: GROUPS.ORGANISER_TIPS,
  update_scores_mid_round_tip: GROUPS.ORGANISER_TIPS,
  join_lms: GROUPS.PLATFORM_WELCOME,
  official_game_invite: GROUPS.PLATFORM_INFO,
  news: GROUPS.PLATFORM_INFO
};

/*
How each group is described to a human, on the unsubscribe page and in profile settings.
Consumer is carried separately so the page can group the toggles the way the outline does.
*/
const GROUP_LABELS = {
  [GROUPS.PLAYER_WELCOME]: { consumer: 'Player', section: 'Welcome', label: 'Joining a competition', blurb: 'Confirmation when you join a competition.' },
  [GROUPS.PLAYER_GAME]: { consumer: 'Player', section: 'Game', label: 'Game updates', blurb: 'Pick reminders, round results and game progress.' },
  [GROUPS.ORGANISER_WELCOME]: { consumer: 'Organiser', section: 'Welcome', label: 'Setting up a competition', blurb: 'Confirmation when you create a competition.' },
  [GROUPS.ORGANISER_GAME]: { consumer: 'Organiser', section: 'Game', label: 'Running your competition', blurb: 'Reminders to add fixtures, set results and start rounds.' },
  [GROUPS.ORGANISER_TIPS]: { consumer: 'Organiser', section: 'Tips', label: 'Tips and suggestions', blurb: 'Occasional advice on getting the most from your competition.' },
  [GROUPS.PLATFORM_WELCOME]: { consumer: 'All', section: 'Welcome', label: 'Welcome to LMS Local', blurb: 'Getting started when you first sign up.' },
  [GROUPS.PLATFORM_INFO]: { consumer: 'All', section: 'Info', label: 'News and invites', blurb: 'New competitions to join, and occasional platform news.' }
};

/**
 * Which group an email belongs to.
 * @param {string} emailType - key from EMAIL_GROUPS, or a group key already
 * @returns {string|null} group key, or null if the email is unknown
 */
function groupFor(emailType) {
  if (!emailType) return null;
  if (Object.values(GROUPS).includes(emailType)) return emailType;
  return EMAIL_GROUPS[emailType] || null;
}

/**
 * SQL fragment excluding anyone who has opted out, for use inside a candidate query.
 *
 * Returned rather than hardcoded in each caller so that "who may be emailed" has exactly one
 * definition. Every load-* route and every admin preview must produce the same answer, or a
 * screen shows a count of five and the send reaches eight.
 *
 * Three ways to be excluded: the global kill switch, the group, or muting one competition.
 *
 * @param {object} params
 * @param {string} params.userColumn - SQL expression for the user id, e.g. 'u.id'
 * @param {string} params.competitionColumn - SQL expression for the competition id, e.g. 'c.id'
 * @param {string} params.groupParam - the bind placeholder holding the group key, e.g. '$2'
 * @returns {string} a SQL condition, safe to AND into a WHERE clause
 */
function notOptedOutSql({ userColumn, competitionColumn, groupParam }) {
  return `
    NOT EXISTS (
      SELECT 1 FROM email_preference ep
      WHERE ep.user_id = ${userColumn}
        AND ep.competition_id = 0
        AND ep.email_type = '${ALL}'
        AND ep.enabled = false
    )
    AND NOT EXISTS (
      SELECT 1 FROM email_preference ep
      WHERE ep.user_id = ${userColumn}
        AND ep.competition_id = 0
        AND ep.email_type = ${groupParam}
        AND ep.enabled = false
    )
    AND NOT EXISTS (
      SELECT 1 FROM email_preference ep
      WHERE ep.user_id = ${userColumn}
        AND ep.competition_id = ${competitionColumn}
        AND ep.email_type IS NULL
        AND ep.enabled = false
    )
  `;
}

/**
 * Read every preference for one user, filled in with the defaults.
 *
 * Absent rows come back as enabled, so a caller never has to know the missing-row rule.
 *
 * @param {number} userId
 * @returns {Promise<{all: boolean, groups: Object<string, boolean>}>}
 */
async function getPreferences(userId) {
  const result = await query(
    `SELECT email_type, enabled FROM email_preference WHERE user_id = $1 AND competition_id = 0`,
    [userId]
  );

  const stored = new Map(result.rows.map((r) => [r.email_type, r.enabled]));

  const groups = {};
  for (const key of Object.values(GROUPS)) {
    groups[key] = stored.has(key) ? stored.get(key) : true;
  }

  return {
    all: stored.has(ALL) ? stored.get(ALL) : true,
    groups
  };
}

/**
 * Turn one group (or 'all') on or off for a user.
 *
 * Upsert by hand rather than ON CONFLICT: the table has no unique constraint across
 * (user_id, competition_id, email_type), so ON CONFLICT has nothing to target.
 *
 * @param {number} userId
 * @param {string} key - a group key, or 'all'
 * @param {boolean} enabled
 */
async function setPreference(userId, key, enabled) {
  const existing = await query(
    `SELECT id FROM email_preference WHERE user_id = $1 AND competition_id = 0 AND email_type = $2`,
    [userId, key]
  );

  if (existing.rows.length > 0) {
    await query(
      `UPDATE email_preference SET enabled = $1, updated_at = NOW() WHERE id = $2`,
      [enabled, existing.rows[0].id]
    );
  } else {
    await query(
      `INSERT INTO email_preference (user_id, competition_id, email_type, enabled, updated_at)
       VALUES ($1, 0, $2, $3, NOW())`,
      [userId, key, enabled]
    );
  }
}

/**
 * Find a user from an unsubscribe token.
 *
 * Opaque random token rather than a JWT. The link must work forever, so a JWT's expiry is dead
 * weight, and the old implementation signed with JWT_SECRET - the player login secret - meaning
 * the only way to invalidate a leaked unsubscribe link was to log out every user on the
 * platform. A stored token is revocable on its own.
 *
 * @param {string} token
 * @returns {Promise<{id: number, email: string, display_name: string}|null>}
 */
async function findUserByToken(token) {
  if (!token || typeof token !== 'string' || !/^[a-f0-9]{32}$/.test(token)) return null;

  const result = await query(
    `SELECT id, email, display_name FROM app_user WHERE unsubscribe_token = $1`,
    [token]
  );

  return result.rows[0] || null;
}

/**
 * The unsubscribe token for a user, generating one if the account predates the column.
 * @param {number} userId
 * @returns {Promise<string|null>}
 */
async function getOrCreateToken(userId) {
  const existing = await query(`SELECT unsubscribe_token FROM app_user WHERE id = $1`, [userId]);
  if (existing.rows.length === 0) return null;
  if (existing.rows[0].unsubscribe_token) return existing.rows[0].unsubscribe_token;

  const generated = await query(
    `UPDATE app_user
     SET unsubscribe_token = replace(gen_random_uuid()::text, '-', '')
     WHERE id = $1
     RETURNING unsubscribe_token`,
    [userId]
  );

  return generated.rows[0]?.unsubscribe_token || null;
}

/**
 * The links an email footer and its List-Unsubscribe headers need.
 *
 * `group` is carried in the URL so one click can act on the right group immediately, which is
 * what RFC 8058 one-click requires - a page that only offers toggles and waits for a submit
 * does not satisfy it, and Gmail and Yahoo have required it of bulk senders since Feb 2024.
 *
 * @param {string} token
 * @param {string} group
 * @returns {{url: string, headers: object}}
 */
function unsubscribeLinks(token, group) {
  const base = process.env.EMAIL_VERIFICATION_URL || '';
  const url = `${base}/unsubscribe?token=${token}&group=${encodeURIComponent(group)}`;

  return {
    url,
    headers: {
      'List-Unsubscribe': `<${url}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    }
  };
}

module.exports = {
  ALL,
  GROUPS,
  GROUP_LABELS,
  EMAIL_GROUPS,
  groupFor,
  notOptedOutSql,
  getPreferences,
  setPreference,
  findUserByToken,
  getOrCreateToken,
  unsubscribeLinks
};
