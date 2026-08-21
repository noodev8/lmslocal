/*
=======================================================================================================================================
Email Skip Service
=======================================================================================================================================
Purpose: Mark candidates as dealt with WITHOUT emailing them. One helper for every email on the
         outline - no service is edited and no fourth function is added per email, so a newly
         wired email inherits skipping from its catalog entry alone.

The operator needs this whenever a count is real but the emails should not go: a backlog that
built up before an email was wired, test accounts sitting in a customer's competition, a batch
someone has already been told about by other means.

WHY A NEW STATUS RATHER THAN REUSING ONE

  sent        Resend accepted it. Writing this would be a lie, and would leave a null message id
              against an email somebody is recorded as having received.
  suppressed  deliver() refused it - the RECIPIENT's decision, an unsubscribe.
  skipped     the OPERATOR's decision. Nothing was built and nothing was attempted.

Keeping the last two apart is what lets "did we skip these, or did they unsubscribe?" have an
answer. There is no check constraint on email_queue.status, so the value costs nothing.

WHY THIS NEEDS NO CHANGE TO ANY ELIGIBILITY QUERY

Every once-ever guard on the platform is already `NOT EXISTS (... AND eq.email_type = X)` with no
condition on status, and every cooldown reads the latest row whatever its status. A skipped row is
therefore excluded from candidacy the moment it is written, by rules that already exist. That is
the whole reason this is a status and not a table.

Note the asymmetry, which is correct rather than an oversight: for a once-ever email a skip is
permanent, while for the three COOLDOWN_DAYS reminders it counts as an attempt and defers them one
cooldown - the same as a failed send. "We decided not to chase this organiser today" is exactly
what that means.

NO email_tracking ROW IS WRITTEN. Tracking is a record of a message, and there was no message.
=======================================================================================================================================
*/

const { query } = require('../database');

/**
 * Write a skip row for each candidate.
 *
 * The row must carry the IDENTICAL (user_id, competition_id, round_id) triple that the service's
 * own queueCandidate would have written, or the guard that reads it will not match and the
 * candidate will still be waiting afterwards. Every queueCandidate on the platform takes those
 * three straight off the candidate, which is what makes one shared helper safe here - see the
 * recount in markSkipped for the check that this stays true.
 *
 * WRITTEN IN CHUNKS. A single INSERT carries five parameters per row and Postgres caps a statement
 * at 65535 of them, so one statement dies above 13,107 rows. The operator ticking boxes was never
 * going to reach that; magic send hands this function every candidate a sweep declined to email,
 * which at the volumes this platform is heading for is exactly the list that will. The chunk size
 * is well under the cap rather than at it, because the cap is on parameters and the parameters per
 * row would change if a column were ever added here.
 *
 * @param {string} emailType - the catalog key
 * @param {Array<object>} candidates - rows from the service's findCandidates
 * @param {string} [reason] - free text stored on the row, for whoever reads the queue later
 * @param {object} [extra] - merged into template_data, for a caller that must find its rows again
 * @returns {Promise<number>} rows written
 */
const CHUNK_ROWS = 500;

async function insertSkipRows(emailType, candidates, reason, extra = {}) {
  if (candidates.length === 0) return 0;

  let written = 0;

  for (let start = 0; start < candidates.length; start += CHUNK_ROWS) {
    written += await insertChunk(emailType, candidates.slice(start, start + CHUNK_ROWS), reason, extra);
  }

  return written;
}

/** One INSERT. Never called with more than CHUNK_ROWS candidates - see insertSkipRows. */
async function insertChunk(emailType, candidates, reason, extra) {
  const values = [];
  const params = [];

  candidates.forEach((candidate, i) => {
    const base = i * 5;
    values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, NOW(), $${base + 5}, 'skipped', 0)`);
    params.push(
      candidate.user_id,
      candidate.competition_id ?? null,
      candidate.round_id ?? null,
      /*
      hints.js takes its email_type from candidate.hint_key rather than the catalog key. The two
      are equal today - serviceFor('promote_competition') yields candidates whose hint_key is
      'promote_competition' - but reading the candidate first means a skip cannot silently land
      under the wrong type if that ever stops being true.
      */
      candidate.hint_key || emailType,
      JSON.stringify({
        skipped: true,
        skipped_at: new Date().toISOString(),
        reason: reason || 'Marked as sent from the admin Emails screen',
        ...extra
      })
    );
  });

  const result = await query(`
    INSERT INTO email_queue (
      user_id, competition_id, round_id, email_type,
      scheduled_send_at, template_data, status, attempts
    ) VALUES ${values.join(', ')}
  `, params);

  return result.rowCount;
}

/**
 * Mark candidates as sent without sending, then re-check that they actually dropped out.
 *
 * The recount is the point of doing this here rather than inline in the route. If a service ever
 * queues against a different triple than it derives, the skip would write rows that its own guard
 * does not see - the count would not move and nothing would say why. still_waiting surfaces that
 * in the response instead of a week later.
 *
 * @param {object} entry - the services/emailCatalog.js entry
 * @param {string} emailType - the catalog key
 * @param {Array<object>} candidates - the exact candidates to mark
 * @param {object} [opts]
 * @param {number|null} [opts.competition_id] - scope the recount the same way the count was made
 * @param {string} [opts.reason]
 * @returns {Promise<{marked: number, still_waiting: number}>}
 */
async function markSkipped(entry, emailType, candidates, opts = {}) {
  const { competition_id = null, reason } = opts;

  const marked = await insertSkipRows(emailType, candidates, reason);

  const remaining = await entry.service.findCandidates(
    entry.scoped && competition_id ? { competition_id } : {}
  );

  return { marked, still_waiting: remaining.length };
}

module.exports = { markSkipped, insertSkipRows };
