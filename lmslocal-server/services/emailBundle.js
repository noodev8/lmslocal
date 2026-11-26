/*
=======================================================================================================================================
Email Bundle Service - one email per person, covering several competitions
=======================================================================================================================================
Purpose: The shared mechanics of a player email that is sent per PERSON rather than per
         competition: grouping each game's items into one candidate per person, and queueing that
         one email as one email_queue row per competition it covers.

Used by services/pickReminder.js and services/roundOver.js. docs/matchday.md §9.1 has the why: both
games run on the same gameweek, so a player in two competitions has two reminders and two results
in the same few hours, and the 48-hour quiet period (services/emailQuiet.js) would kill the second
every week. Grouping by person is the only shape where nothing is lost.

WHAT A CANDIDATE LOOKS LIKE. The lead item's fields spread onto the candidate - user_id,
user_email, competition_id, round_id and the rest - plus `items`, every item for that person. The
lead is what the shared code reads: the admin screen's recipient list and its user:competition
selection, the sweep script's log, and services/emailSkip.js (which also writes a row per item).
A person with one competition is therefore exactly the candidate a per-competition email always
produced.
=======================================================================================================================================
*/

const { query } = require('../database');

/**
 * Group items into one candidate per person.
 *
 * SCOPE PICKS WHO, NOT WHAT. With a competitionId, only people with an item in that competition
 * are returned - but each with all their items, because the email they get is the whole of it. A
 * scoped send that dropped their other competition would leave it to be killed by the quiet
 * period on the next run.
 *
 * @param {Array<object>} items - every game's items, each carrying user_id and competition_id
 * @param {object} opts
 * @param {number|null} [opts.competitionId] - only people with an item in this competition
 * @param {function} opts.order - comparator for one person's items; the first is the lead
 * @returns {Array<object>} candidates, ordered by lead competition then user
 */
function groupByPerson(items, { competitionId = null, order }) {
  const scope = competitionId ? parseInt(competitionId) : null;

  const byUser = new Map();
  for (const item of items) {
    if (!byUser.has(item.user_id)) byUser.set(item.user_id, []);
    byUser.get(item.user_id).push(item);
  }

  const candidates = [];
  for (const own of byUser.values()) {
    if (scope !== null && !own.some((i) => i.competition_id === scope)) continue;
    own.sort(order);
    candidates.push({ ...own[0], items: own });
  }

  candidates.sort((a, b) => a.competition_id - b.competition_id || a.user_id - b.user_id);
  return candidates;
}

/**
 * Queue one bundled email and open its tracking row.
 *
 * ONE QUEUE ROW PER COMPETITION, so each email's once-per-round guard, the skip rows and each
 * competition's email history stay per competition. The lead row carries the template data and
 * is the one the email is sent from. The others are written 'bundled', pointing at it - never
 * 'pending', because routes/send-email.js sends any pending row it finds and these must not go out
 * a second time on their own. services/emailSweep.js then gives every row the one send's outcome.
 *
 * @param {object} args
 * @param {string} args.emailType - email_queue.email_type
 * @param {object} args.candidate - from groupByPerson (or a plain single-competition row)
 * @param {object} args.templateData - carries email_tracking_id
 * @param {string} args.subject - for the tracking row
 * @returns {Promise<{queue_id: number, queue_ids: number[]}>}
 */
async function queueBundle({ emailType, candidate, templateData, subject }) {
  const lead = await query(`
    INSERT INTO email_queue (
      user_id, competition_id, round_id, email_type,
      scheduled_send_at, template_data, status, attempts
    ) VALUES ($1, $2, $3, $4, NOW(), $5, 'pending', 0)
    RETURNING id
  `, [candidate.user_id, candidate.competition_id, candidate.round_id, emailType, JSON.stringify(templateData)]);

  const leadId = lead.rows[0].id;
  const queueIds = [leadId];

  const others = (candidate.items || []).slice(1);
  if (others.length > 0) {
    const bundled = await query(`
      INSERT INTO email_queue (
        user_id, competition_id, round_id, email_type,
        scheduled_send_at, template_data, status, attempts
      )
      SELECT $1, o.competition_id, o.round_id, $2, NOW(),
             jsonb_build_object('bundled_into', $3::int), 'bundled', 0
      FROM UNNEST($4::int[], $5::int[]) AS o(competition_id, round_id)
      RETURNING id
    `, [
      candidate.user_id,
      emailType,
      leadId,
      others.map((o) => o.competition_id),
      others.map((o) => o.round_id)
    ]);
    queueIds.push(...bundled.rows.map((row) => row.id));
  }

  await query(`
    INSERT INTO email_tracking (email_id, user_id, competition_id, email_type, subject)
    VALUES ($1, $2, $3, $4, $5)
  `, [templateData.email_tracking_id, candidate.user_id, candidate.competition_id, emailType, subject]);

  return { queue_id: leadId, queue_ids: queueIds };
}

/*
LMS before any other game when two items tie, since a missed LMS pick costs a life. Shared so both
emails break ties the same way.
*/
const lmsFirst = (item) => (item.game_type === 'lms' ? 0 : 1);

module.exports = { groupByPerson, queueBundle, lmsFirst };
