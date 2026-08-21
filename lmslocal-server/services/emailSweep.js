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
const { typeFor } = require('./emailCatalog');
const { insertSkipRows } = require('./emailSkip');
const { findRecentlyEmailed, MAGIC_SEND_MARK, MAGIC_SEND_REASON } = require('./emailQuiet');

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
 * MAGIC SEND is applied here and only here, because this function is the single path both live
 * senders take - the admin Send button and the cron. Anyone emailed inside the quiet period is
 * marked as sent instead of being emailed; services/emailQuiet.js carries the argument for why
 * that is a kill rather than a hold, and what it permanently costs.
 *
 * @param {object} entry - a catalog entry from services/emailCatalog.js
 * @param {Array} candidates - the final list, already narrowed by the caller
 * @param {object} [options]
 * @param {number} [options.cap] - stop after this many, leaving the rest for the next run
 * @param {function} [options.onProgress] - called per person, for a script that wants to log
 * @returns {Promise<{sent: number, failed: number, skipped: number, attempted: number, capped: boolean}>}
 */
async function sendToAll(entry, candidates, options = {}) {
  const { cap = null, onProgress = null } = options;

  const targets = Number.isInteger(cap) && cap > 0 ? candidates.slice(0, cap) : candidates;
  const capped = targets.length < candidates.length;

  let sent = 0;
  let failed = 0;

  /*
  One query for the whole run, not one per candidate. See findRecentlyEmailed for why it is not
  narrowed to this candidate list.

  The set is then kept up to date AS WE SEND, which is the part that is easy to miss: a scoped
  email swept platform-wide yields one row per competition, so an organiser with two empty
  competitions appears twice in a single list. Without the running update they would receive both
  emails in the same second - the most flagrant possible breach of the rule this is here to
  enforce. They get the first and the second is marked as sent.
  */
  const quiet = await findRecentlyEmailed();
  const skipped = [];

  for (const candidate of targets) {
    if (quiet.has(candidate.user_id)) {
      skipped.push(candidate);
      if (onProgress) onProgress({ candidate, ok: false, skipped: true });
      continue;
    }

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
      quiet.add(candidate.user_id);
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

  /*
  Written after the loop rather than one at a time. These rows are bookkeeping - nothing reads them
  until the next run - so there is no reason to pay a round trip per person, and a single bulk
  insert is what keeps a sweep that declines thousands of people cheap. insertSkipRows chunks it.

  Deliberately NOT inside a transaction with the sends. A send cannot be rolled back, so a failure
  here must not be able to undo one; the worst case is that the skip rows are missing and those
  people are simply candidates again on the next run, which is the safe direction.
  */
  if (skipped.length > 0) {
    const emailType = typeFor(entry);

    /*
    Refuse rather than write. A skip row's email_type is what the once-ever guard reads, so a null
    would write rows that no guard matches - the people would still be waiting and nothing would
    say why, permanently and silently. The only way to get here is an entry that is not the catalog
    object itself, which is a programming error in a caller, so it should be loud.

    Thrown AFTER the sends, which is deliberate: whatever went out stays out, and the skips are
    simply not recorded, leaving those people as candidates again next run.
    */
    if (!emailType) {
      throw new Error('emailSweep: entry is not a catalog entry, refusing to write skip rows for it');
    }

    await insertSkipRows(emailType, skipped, MAGIC_SEND_REASON, MAGIC_SEND_MARK);
  }

  return { sent, failed, skipped: skipped.length, attempted: targets.length, capped };
}

module.exports = { sendTest, sendToAll };
