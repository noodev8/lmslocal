/*
=======================================================================================================================================
Email Sweep Service
=======================================================================================================================================
Purpose: The one implementation of "send this outline email to these people", shared by the admin
         Send button and by the cron.

Lifted out of routes/admin/send-emails.js on 2026-08-18, when scripts/email-sweep.js arrived. The
route's behaviour is unchanged - this is the same loop in a place two callers can reach.

WHY IT HAD TO MOVE. The route was already written for a cron: its own comments say "the
destination is a cron, which cannot pick a competition either", and it treats competition_id as
optional and `recipients` as absent for exactly that caller. Had the script grown its own copy of
the loop, the two would have drifted the way the three admin routes drifted before
services/emailCatalog.js collected them - and the failure mode here is worse than a wrong count on
a screen, because a fix to retry handling or queue bookkeeping applied to one copy would silently
miss the other, and the one that misses out is the unattended one nobody is watching.

WHAT IS NOT HERE, deliberately: candidate selection, narrowing to named recipients, and the
expected_count guard. Those are decisions about WHO, they differ between the two callers - the
operator ticks boxes and confirms a number, the cron does neither - and they belong to the caller.
This service is handed a final list and does what it is told with it.
=======================================================================================================================================
*/

const { query } = require('../database');

/**
 * Send one test copy of an email to the test address, writing nothing.
 *
 * TEST MODE MUST NOT QUEUE, and it is a separate function rather than a flag inside sendToAll for
 * that reason. Candidacy excludes anyone who already holds an email_queue row, so a test run that
 * queued would make every one of those people permanently ineligible for the real send that
 * followed - the operator would test, watch it work, press Send for real and reach nobody.
 *
 * @param {object} entry - a catalog entry from services/emailCatalog.js
 * @param {object} candidate - the candidate to build the sample from, normally the first
 * @param {object} [options]
 * @param {string} [options.testRecipient] - override the address, else EMAIL_TEST_RECIPIENT
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendTest(entry, candidate, options = {}) {
  const templateData = await entry.service.buildTemplateData(candidate);
  return entry.send(candidate.user_email, templateData, { testMode: true, ...options });
}

/**
 * Queue and send one email to every candidate given.
 *
 * Queue-then-send per person rather than queueing the batch first: the queue row is what the
 * once-ever and once-per-round guards read, so writing it immediately before the send is what
 * stops a crash midway through leaving people who were queued but never sent looking ineligible
 * forever.
 *
 * @param {object} entry - a catalog entry from services/emailCatalog.js
 * @param {Array} candidates - the final list, already narrowed by the caller
 * @param {object} [options]
 * @param {number} [options.cap] - stop after this many, leaving the rest for the next run
 * @param {function} [options.onProgress] - called per person, for a script that wants to log
 * @returns {Promise<{sent: number, failed: number, attempted: number, capped: boolean}>}
 */
async function sendToAll(entry, candidates, options = {}) {
  const { cap = null, onProgress = null } = options;

  const targets = Number.isInteger(cap) && cap > 0 ? candidates.slice(0, cap) : candidates;
  const capped = targets.length < candidates.length;

  let sent = 0;
  let failed = 0;

  for (const candidate of targets) {
    const queued = await entry.service.queueCandidate(candidate);

    if (!queued.success) {
      failed++;
      if (onProgress) onProgress({ candidate, ok: false, error: queued.error });
      continue;
    }

    const result = await entry.send(candidate.user_email, queued.template_data, { testMode: false });

    if (result.success) {
      await query(
        `UPDATE email_queue SET status = 'sent', sent_at = NOW() WHERE id = $1`,
        [queued.queue_id]
      );
      await query(
        `UPDATE email_tracking SET resend_message_id = $1, sent_at = NOW() WHERE email_id = $2`,
        [result.resend_message_id, queued.template_data.email_tracking_id]
      );
      sent++;
      if (onProgress) onProgress({ candidate, ok: true });
    } else {
      /*
      Left as 'failed' rather than deleted. The queue row is the only record that we tried, and the
      once-ever guards read it - so a failed address is not silently retried on the next run
      without someone looking at why it failed. That matters more under cron than under a button:
      a retry loop nobody is watching would hammer a bad address every day forever.
      */
      await query(
        `UPDATE email_queue SET status = 'failed', error_message = $1, attempts = attempts + 1, last_attempt_at = NOW() WHERE id = $2`,
        [result.error, queued.queue_id]
      );
      failed++;
      console.error(`emailSweep: send failed for user ${candidate.user_id}:`, result.error);
      if (onProgress) onProgress({ candidate, ok: false, error: result.error });
    }
  }

  return { sent, failed, attempted: targets.length, capped };
}

module.exports = { sendTest, sendToAll };
