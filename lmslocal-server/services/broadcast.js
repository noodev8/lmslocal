/*
=======================================================================================================================================
Broadcast Service
=======================================================================================================================================
Purpose: The one definition of who receives an admin broadcast, and the guards around sending one.
         Outline row: All | Info | Broadcast from Admin.

UNLIKE EVERY OTHER EMAIL HERE, THE CONTENT IS TYPED BY A PERSON. The other eleven derive both
recipients and words from the data, which is what makes them safe to fire from a button. This one
takes a subject and a message and sends them to as many as 200-odd people, so it is deliberately
NOT in services/emailCatalog.js: the catalog's shape is findCandidates() with no arguments, and
bending it to carry operator text would have put a free-text blast behind the same one-click
button as a pick reminder.

Two audiences:
  ALL          - every account with a real email, minus opt-outs
  COMPETITION  - the members of one competition, minus opt-outs

Opt-outs are applied HERE and again at deliver(). Belt and braces on purpose: this is the email
where ignoring an unsubscribe would be least forgivable, since nothing about it is transactional
and nobody asked for it.

THE DAILY LIMIT IS PART OF THE DESIGN, not an operational detail. Resend allows 100 sends a day on
the current plan and the platform has well over 200 accounts, so a single "send to all" cannot
physically complete. Rather than firing 100 and failing 116 - leaving no record of who missed out -
every recipient is QUEUED first, the first SEND_CAP are sent now, and the rest stay pending for
/send-email to drain on a later day. Queue rows are the record of who is still owed it.
=======================================================================================================================================
*/

const { query } = require('../database');
const { notOptedOutSql, groupFor, getOrCreateToken, unsubscribeLinks } = require('./emailPreference');

const EMAIL_TYPE = 'broadcast_admin';

/*
How many go out in one press. Below Resend's 100/day so a broadcast cannot consume the entire
allowance and starve the reminders that actually matter that day.
*/
const SEND_CAP = Number(process.env.BROADCAST_SEND_CAP || 80);

const AUDIENCES = { ALL: 'all', COMPETITION: 'competition' };

/**
 * Who would receive this broadcast.
 *
 * @param {object} params
 * @param {string} params.audience - 'all' or 'competition'
 * @param {number|null} [params.competition_id] - required for the competition audience
 * @returns {Promise<Array>} recipient rows
 */
async function findRecipients({ audience, competition_id = null }) {
  const group = groupFor(EMAIL_TYPE);

  if (audience === AUDIENCES.COMPETITION) {
    const result = await query(`
      SELECT DISTINCT
        u.id           AS user_id,
        u.email        AS user_email,
        u.display_name AS user_display_name
      FROM competition_user cu
      INNER JOIN app_user u
        ON u.id = cu.user_id
        AND u.email IS NOT NULL
        AND u.email != ''
        AND u.email NOT LIKE '%@lms-guest.com'
      INNER JOIN competition c ON c.id = cu.competition_id
      WHERE cu.competition_id = $1
        AND ${notOptedOutSql({ userColumn: 'u.id', competitionColumn: 'c.id', groupParam: '$2' })}
      ORDER BY u.id
    `, [competition_id, group]);

    return result.rows;
  }

  /*
  Everyone. competition_id is passed as 0 to the per-competition mute clause, which no real
  competition has - a platform-wide broadcast is not about any one of them, so muting a single
  competition should not silence it.
  */
  const result = await query(`
    SELECT
      u.id           AS user_id,
      u.email        AS user_email,
      u.display_name AS user_display_name
    FROM app_user u
    WHERE u.email IS NOT NULL
      AND u.email != ''
      AND u.email NOT LIKE '%@lms-guest.com'
      AND ${notOptedOutSql({ userColumn: 'u.id', competitionColumn: '0', groupParam: '$1' })}
    ORDER BY u.id
  `, [group]);

  return result.rows;
}

/**
 * Build the template data for one recipient of a broadcast.
 *
 * @param {object} recipient - a row from findRecipients
 * @param {object} content - { subject, message }
 * @param {number|null} [competitionId] - named on the queue row when the audience is one competition
 * @returns {Promise<object>}
 */
async function buildTemplateData(recipient, content, competitionId = null) {
  const { user_id, user_email, user_display_name } = recipient;

  const token = await getOrCreateToken(user_id);
  const unsubscribe = token ? unsubscribeLinks(token, groupFor(EMAIL_TYPE)) : null;

  return {
    email_tracking_id: `${EMAIL_TYPE}_${user_id}_${Date.now()}`,
    unsubscribe,
    user_email,
    user_display_name,
    competition_id: competitionId,
    subject: content.subject,
    message: content.message,
    user_id
  };
}

/**
 * Queue one broadcast email, and open its tracking row.
 *
 * Everyone is queued whether or not they are sent in this press - see the note on SEND_CAP. A
 * pending row is the only record that somebody is still owed the message.
 *
 * @param {object} recipient
 * @param {object} content - { subject, message }
 * @param {number|null} [competitionId]
 * @returns {Promise<{success: boolean, queue_id?: number, template_data?: object, error?: string}>}
 */
async function queueRecipient(recipient, content, competitionId = null) {
  try {
    const templateData = await buildTemplateData(recipient, content, competitionId);

    const queueResult = await query(`
      INSERT INTO email_queue (
        user_id, competition_id, round_id, email_type,
        scheduled_send_at, template_data, status, attempts
      ) VALUES ($1, $2, NULL, '${EMAIL_TYPE}', NOW(), $3, 'pending', 0)
      RETURNING id
    `, [recipient.user_id, competitionId, JSON.stringify(templateData)]);

    await query(`
      INSERT INTO email_tracking (email_id, user_id, competition_id, email_type, subject)
      VALUES ($1, $2, $3, '${EMAIL_TYPE}', $4)
    `, [templateData.email_tracking_id, recipient.user_id, competitionId, content.subject]);

    return { success: true, queue_id: queueResult.rows[0].id, template_data: templateData };
  } catch (error) {
    console.error('broadcast.queueRecipient failed:', { user_id: recipient.user_id, error: error.message });
    return { success: false, error: error.message };
  }
}

module.exports = {
  EMAIL_TYPE,
  SEND_CAP,
  AUDIENCES,
  findRecipients,
  buildTemplateData,
  queueRecipient
};
