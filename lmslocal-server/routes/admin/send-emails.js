/*
=======================================================================================================================================
API Route: admin/send-emails
=======================================================================================================================================
Method: POST
Purpose: Send one outline email to everyone who qualifies for it, from the admin Emails screen.
         Operator-driven - there is no schedule behind this.

Which emails can be sent, and the service and template behind each, come from
services/emailCatalog.js.

competition_id is OPTIONAL, including on scoped emails: omit it and the send covers everyone who
qualifies anywhere. `scoped` means the picker APPLIES to this email, not that a value is required.
That is deliberate - the destination is a cron, which cannot pick a competition either.

`recipients` narrows a send to named people, intersected with the live candidates rather than
replacing them. It exists so a ticked row means the same thing to this route as it does to
mark-emails-sent; the cron passes none and behaves exactly as before.

Two modes, and they are deliberately not the same code path:

  test_mode true  - builds ONE email for the first candidate and sends it to the test address.
                    Nothing is queued and nothing is recorded against a player.
  test_mode false - queues every candidate, then sends each one, updating email_queue and
                    email_tracking as it goes.

Test mode must not queue. Candidacy excludes anyone with a row already in email_queue for that
round, so a test run that queued would make every one of those players permanently ineligible
for the real send that follows - the operator would test, see it work, press send for real and
reach nobody.

test_mode defaults to TRUE when the field is absent. A caller that forgets it gets the harmless
outcome rather than a live send to the whole competition.
=======================================================================================================================================
Request Payload:
{
  "email_type": "pick_reminder",       // string, required - which outline email
  "competition_id": 210,               // integer, optional - narrows scoped emails; null = all
  "test_mode": true,                   // boolean, optional - defaults to true
  "expected_count": 3,                 // integer, optional - refuses a live send if it has moved
  "recipients": [                      // array, optional - send to only these, omit for everyone
    { "user_id": 41, "competition_id": 172 }
  ]
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "test_mode": true,                   // boolean, what actually happened
  "sent_count": 1,                     // integer, emails accepted by Resend
  "failed_count": 0,                   // integer, sends that came back with an error
  "candidate_count": 3,                // integer, who qualified
  "sent_to": "aandreou25@gmail.com",   // string or null, set in test mode only
  "message": "..."                     // string, plain summary for the screen
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "NO_RECIPIENTS",
  "message": "Nobody currently qualifies for this email."
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"NO_RECIPIENTS"
"COUNT_CHANGED"
"VALIDATION_ERROR"
"UNSUPPORTED_EMAIL_TYPE"
"UNAUTHORIZED"
"TOKEN_EXPIRED"
"SERVER_ERROR"
=======================================================================================================================================
*/

const express = require('express');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const { entryFor } = require('../../services/emailCatalog');
const { sendTest, sendToAll } = require('../../services/emailSweep');
const { logApiCall } = require('../../utils/apiLogger');

const router = express.Router();

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('admin/send-emails');

  try {
    const { email_type, competition_id, test_mode, expected_count, recipients } = req.body;

    const entry = entryFor(email_type);

    if (!entry) {
      return res.json({
        return_code: 'UNSUPPORTED_EMAIL_TYPE',
        message: `${email_type || 'That email'} is not wired up yet.`
      });
    }

    if (competition_id !== undefined && competition_id !== null && !Number.isInteger(competition_id)) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'competition_id must be an integer when given'
      });
    }

    /*
    Optional now, for scoped emails too: omitting it sends to everyone who qualifies anywhere.
    `scoped` says whether the picker applies, not that a value is required. This is the shape a
    cron needs - it cannot pick a competition either.
    */
    const scopeId = entry.scoped && Number.isInteger(competition_id) ? competition_id : null;

    // Absent means test. Only an explicit false goes live.
    const testMode = test_mode !== false;

    const candidates = await entry.service.findCandidates(scopeId ? { competition_id: scopeId } : {});

    /*
    Optional narrowing to specific people, matched on user_id AND competition_id - the same pair
    mark-emails-sent uses, because the same person legitimately appears once per competition when
    a scoped email is scanned across all of them.

    This exists so that ticking a row means the SAME thing for both buttons on the screen. Before
    it, Send ignored the ticks while Mark honoured them, silently, under one shared column of
    checkboxes - so marking one person and sending to the rest worked in one order and emailed
    everybody in the other.

    Filtering AFTER findCandidates rather than instead of it is what keeps that safe: eligibility
    is still derived here, so a stale tick for somebody who has since been sent to, unsubscribed
    or been marked cannot put them back in. The list can only ever narrow the qualifying set.

    The cron passes nothing and is unaffected - its contract stays "send this email to whoever
    qualifies".
    */
    let targets = candidates;

    if (Array.isArray(recipients) && recipients.length > 0) {
      const wanted = new Set(recipients.map((r) => `${r.user_id}:${r.competition_id ?? 'null'}`));
      targets = candidates.filter((c) => wanted.has(`${c.user_id}:${c.competition_id ?? 'null'}`));
    }

    /*
    The count is the guard on a live send to EVERYONE: the number the operator was looking at has
    to still be the number. Somebody joining between the preview and the press is normal; a send
    bigger than the one reviewed is not. Same rule as broadcast.js and as mark-emails-sent.

    Skipped when an explicit list was given - that list is its own statement of who, and it has
    already been intersected with the live candidates above. Test mode is exempt too: it sends one
    email to the test address whatever the count is.
    */
    if (!testMode && !Array.isArray(recipients) && Number.isInteger(expected_count) && expected_count !== candidates.length) {
      return res.json({
        return_code: 'COUNT_CHANGED',
        message: `${expected_count} ${expected_count === 1 ? 'was' : 'were'} on screen but ${candidates.length} qualify now. Refresh and look again.`,
        expected_count,
        actual_count: candidates.length
      });
    }

    if (targets.length === 0) {
      return res.json({
        return_code: 'NO_RECIPIENTS',
        message: candidates.length === 0
          ? 'Nobody currently qualifies for this email.'
          : 'None of those recipients still qualify. Refresh and look again.',
        candidate_count: 0,
        sent_count: 0,
        failed_count: 0,
        test_mode: testMode
      });
    }

    // ===============================================================================
    // TEST MODE - one email, to the test address, nothing written
    // ===============================================================================
    if (testMode) {
      const first = targets[0];

      const result = await sendTest(entry, first);

      if (!result.success) {
        console.error('admin/send-emails test send failed:', result.error);
        return res.json({
          return_code: 'SUCCESS',
          test_mode: true,
          candidate_count: targets.length,
          sent_count: 0,
          failed_count: 1,
          sent_to: null,
          message: `Test send failed: ${result.error}`
        });
      }

      return res.json({
        return_code: 'SUCCESS',
        test_mode: true,
        candidate_count: targets.length,
        sent_count: 1,
        failed_count: 0,
        sent_to: process.env.EMAIL_TEST_RECIPIENT || 'aandreou25@gmail.com',
        message: `Test copy of ${first.user_display_name}'s email sent. ${targets.length} real recipient${targets.length === 1 ? '' : 's'} untouched.`
      });
    }

    // ===============================================================================
    // LIVE MODE - queue everyone, then send
    // ===============================================================================
    /*
    No cap from this caller. The operator has seen the count and confirmed it through
    expected_count above, so truncating the send they just approved would be the surprise, not the
    safeguard. The cron passes one because nobody is watching it.
    */
    const { sent: sentCount, failed: failedCount } = await sendToAll(entry, targets);

    return res.json({
      return_code: 'SUCCESS',
      test_mode: false,
      candidate_count: targets.length,
      sent_count: sentCount,
      failed_count: failedCount,
      sent_to: null,
      message: `Sent ${sentCount} of ${targets.length}${failedCount > 0 ? `, ${failedCount} failed` : ''}.`
    });

  } catch (error) {
    console.error('admin/send-emails error:', { error: error.message, stack: error.stack });
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Send failed. Check the server log.'
    });
  }
});

module.exports = router;
