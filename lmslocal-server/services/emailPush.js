/*
=======================================================================================================================================
Email Push Service
=======================================================================================================================================
Purpose: Send a push notification WITH an email, to people who have the app. An add-on to the email,
         never a channel of its own.

THE RULE (Andreas, 2026-11-27): the email decides everything. Who qualifies, when, and what they are
told all come from the email's own service - its findCandidates and the template data it built for
the send. A push goes to someone only when their email was actually sent in this run, and only if
they have a registered device. If the email is not sent - held by the 48-hour quiet period, failed,
opted out, never a candidate - neither is the push. So a push is never more frequent than its email,
and the email's once-per-round guards cover it without a second set.

It replaced a separate queue (mobile_notification_queue filled by the fixture routes and drained by
a 5-minute cron, /process-mobile-notifications) that had its own triggers, its own 24-hour window
and no opt-out or archived checks. That cron was never scheduled; 7 pushes went out in its life.
docs/mobile-notifications.md §1 has the before and after.

An email takes part by carrying `push` on its catalog entry (services/emailCatalog.js): a function
from the email's template data to the notification. Only pick_reminder does so far.

WHEN IS ALSO THE EMAIL'S. Nothing here looks at the clock. Today every send is pressed by hand on the
admin screen, and services/emailSweep.js only pushes when its caller asks - the admin route does,
scripts/email-sweep.js does not - so the cron cannot start sending pushes at 07:15 by accident.
Choosing a push-friendly time is a decision for when the cron is switched on.

mobile_notification_queue IS NOW THE RECORD of pushes sent: one row per person per push, 'sent' or
'failed'. Nothing is ever 'pending' in it any more. The name is historical; renaming the table is a
migration for a word.
=======================================================================================================================================
*/

const { query } = require('../database');
const { sendPushes } = require('./fcmService');
const { typeFor } = require('./emailCatalog');

/**
 * Each person's devices, as a Map of user_id -> [token].
 *
 * A TOKEN BELONGS TO WHOEVER REGISTERED IT LAST. One phone has one token, and signing out does not
 * remove it - so a phone handed from one account to another carries the same token under both
 * user_ids (two such tokens on 2026-11-27). Sending by user_id alone would deliver one player's
 * reminder to whoever is now signed in on that phone. Only the latest registration counts.
 *
 * @param {number[]} userIds
 * @returns {Promise<Map<number, string[]>>}
 */
async function tokensFor(userIds) {
  const byUser = new Map();
  if (userIds.length === 0) return byUser;

  const result = await query(`
    SELECT latest.user_id, latest.fcm_token
    FROM (
      SELECT DISTINCT ON (dt.fcm_token) dt.user_id, dt.fcm_token
      FROM device_tokens dt
      WHERE dt.fcm_token IN (SELECT fcm_token FROM device_tokens WHERE user_id = ANY($1::int[]))
      ORDER BY dt.fcm_token, dt.updated_at DESC NULLS LAST, dt.id DESC
    ) latest
    WHERE latest.user_id = ANY($1::int[])
  `, [userIds]);

  for (const row of result.rows) {
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
    byUser.get(row.user_id).push(row.fcm_token);
  }
  return byUser;
}

/**
 * Which of these people have the app - for the admin screen's counts. Same ownership rule as the
 * send, so "has the app" here means "would get a push".
 *
 * @param {number[]} userIds
 * @returns {Promise<Set<number>>}
 */
async function usersWithApp(userIds) {
  const unique = [...new Set(userIds)];
  return new Set((await tokensFor(unique)).keys());
}

/**
 * Push to everyone whose email was just sent. Called once, after the send loop.
 *
 * Never throws. The emails have already gone; a push failure is reported in the counts and the
 * server log, and must not turn a successful send into an error on the operator's screen.
 *
 * @param {object} entry - the catalog entry, carrying `push(templateData)`
 * @param {Array<{candidate: object, templateData: object}>} emailed - sent in this run
 * @returns {Promise<{pushed: number, failed: number, error?: string}>} counted in people, not devices
 */
async function pushWithEmails(entry, emailed) {
  if (!entry.push || emailed.length === 0) return { pushed: 0, failed: 0 };

  try {
    const tokens = await tokensFor(emailed.map((e) => e.candidate.user_id));

    const people = [];
    const messages = [];

    for (const { candidate, templateData } of emailed) {
      const userTokens = tokens.get(candidate.user_id);
      if (!userTokens) continue;

      const push = entry.push(templateData);
      const person = { user_id: candidate.user_id, push, from: messages.length, count: userTokens.length };
      people.push(person);

      for (const token of userTokens) {
        messages.push({ token, type: push.type, title: push.title, body: push.body, data: push.data });
      }
    }

    if (people.length === 0) return { pushed: 0, failed: 0 };

    const { results } = await sendPushes(messages);

    // Delivered to a person if ANY of their devices took it.
    const sentFlags = people.map((p) =>
      results.slice(p.from, p.from + p.count).some((r) => r.success)
    );

    const deadTokens = messages.filter((m, i) => results[i]?.dead).map((m) => m.token);

    /*
    One row per person, not per device: the record answers "did this player get the push", which is
    the question the email history answers for the email. One insert for the lot.
    */
    await query(`
      INSERT INTO mobile_notification_queue
        (user_id, type, competition_id, round_id, round_number, status, created_at, sent_at)
      SELECT u, t, c, r, n, s, NOW(), NOW()
      FROM unnest($1::int[], $2::text[], $3::int[], $4::int[], $5::int[], $6::text[]) AS x(u, t, c, r, n, s)
    `, [
      people.map((p) => p.user_id),
      people.map(() => typeFor(entry)),
      people.map((p) => p.push.record.competition_id),
      people.map((p) => p.push.record.round_id),
      people.map((p) => p.push.record.round_number),
      sentFlags.map((ok) => (ok ? 'sent' : 'failed'))
    ]);

    /*
    Firebase has told us these will never be accepted again - the app was uninstalled or its data
    cleared. Left in place they would count as "has the app" on the admin screen forever.
    */
    if (deadTokens.length > 0) {
      await query(`DELETE FROM device_tokens WHERE fcm_token = ANY($1::text[])`, [deadTokens]);
    }

    const pushed = sentFlags.filter(Boolean).length;
    return { pushed, failed: people.length - pushed };
  } catch (error) {
    console.error('emailPush.pushWithEmails failed:', error.message);
    return { pushed: 0, failed: emailed.length, error: error.message };
  }
}

/**
 * Test mode: the push the first candidate would get, sent to the operator's own phone instead.
 *
 * Writes nothing - no record row, no token cleanup - for the same reason a test email queues
 * nothing (services/emailSweep.js sendTest): test mode must leave no trace on anyone's eligibility.
 *
 * @param {object} entry - the catalog entry
 * @param {object} templateData - built for the sample candidate
 * @param {number} userId - the operator's own app_user id
 * @returns {Promise<{devices: number, sent: number, error?: string}>}
 */
async function sendTestPush(entry, templateData, userId) {
  if (!entry.push) return { devices: 0, sent: 0 };

  try {
    const userTokens = (await tokensFor([userId])).get(userId) || [];
    if (userTokens.length === 0) return { devices: 0, sent: 0 };

    const push = entry.push(templateData);
    const { results } = await sendPushes(userTokens.map((token) => ({
      token, type: push.type, title: push.title, body: push.body, data: push.data
    })));

    return { devices: userTokens.length, sent: results.filter((r) => r.success).length };
  } catch (error) {
    console.error('emailPush.sendTestPush failed:', error.message);
    return { devices: 0, sent: 0, error: error.message };
  }
}

module.exports = { tokensFor, usersWithApp, pushWithEmails, sendTestPush };
