/*
=======================================================================================================================================
API Route: admin/mark-emails-sent
=======================================================================================================================================
Method: POST
Purpose: Mark people who qualify for an email as dealt with, WITHOUT sending them anything. Drives
         the "Mark as sent" actions on the admin Emails screen.

The mechanism is services/emailSkip.js - a row on email_queue with status 'skipped', which every
once-ever guard already excludes because none of them condition on status. Nothing is emailed and
no email_tracking row is opened.

Two grains, and they are guarded differently:

  BULK       no `recipients` - everyone currently waiting at this scope. expected_count is
             REQUIRED and must match a fresh count, or the request is refused with COUNT_CHANGED.
             This is the one that can touch dozens of people, so it carries the same guard as a
             live send: the number the operator was looking at has to still be the number.

  SELECTED   `recipients` given - only those, matched on user_id AND competition_id. The explicit
             list is its own confirmation, so expected_count is not required.

A candidate is identified by the PAIR, not by user_id alone. Scan a scoped email across every
competition and the same person legitimately appears twice - once per competition they joined -
and marking on user_id would silently take out the row the operator did not tick.
=======================================================================================================================================
Request Payload:
{
  "email_type": "welcome",             // string, required - which outline email
  "competition_id": 172,               // integer, optional - narrows scoped emails; null = all
  "recipients": [                      // array, optional - omit for the bulk grain
    { "user_id": 41, "competition_id": 172 }
  ],
  "expected_count": 3,                 // integer, required for bulk - the count on screen
  "reason": "Joined before the email existed"   // string, optional - stored on the row
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "marked": 3,                         // integer, rows written
  "still_waiting": 0,                  // integer, fresh count after marking
  "message": "..."                     // string, plain summary for the screen
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "COUNT_CHANGED",
  "message": "3 were on screen but 4 qualify now. Refresh and look again.",
  "expected_count": 3,
  "actual_count": 4
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
const { markSkipped } = require('../../services/emailSkip');
const { logApiCall } = require('../../utils/apiLogger');

const router = express.Router();

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('admin/mark-emails-sent');

  try {
    const { email_type, competition_id, recipients, expected_count, reason } = req.body;

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

    const scopeId = entry.scoped ? competition_id ?? null : null;

    const candidates = await entry.service.findCandidates(scopeId ? { competition_id: scopeId } : {});

    if (candidates.length === 0) {
      return res.json({
        return_code: 'NO_RECIPIENTS',
        message: 'Nobody currently qualifies for this email, so there is nothing to mark.',
        marked: 0,
        still_waiting: 0
      });
    }

    // ===============================================================================
    // Narrow to the ticked recipients, or take everyone
    // ===============================================================================
    let toMark = candidates;

    if (Array.isArray(recipients)) {
      if (recipients.length === 0) {
        return res.json({
          return_code: 'VALIDATION_ERROR',
          message: 'No recipients were selected.'
        });
      }

      // Pair, not user_id - see the header for why.
      const wanted = new Set(
        recipients.map((r) => `${r.user_id}:${r.competition_id ?? 'null'}`)
      );
      toMark = candidates.filter((c) => wanted.has(`${c.user_id}:${c.competition_id ?? 'null'}`));

      if (toMark.length === 0) {
        return res.json({
          return_code: 'NO_RECIPIENTS',
          message: 'None of those recipients still qualify. Refresh and look again.',
          marked: 0,
          still_waiting: candidates.length
        });
      }
    } else {
      /*
      Bulk. The count is the guard: somebody joining between the preview and the press is normal,
      but an action bigger than the one reviewed is not. Same rule as a live send and as
      broadcast.js, and for the same reason - "I thought it was about thirty people" is only
      preventable in advance.
      */
      if (!Number.isInteger(expected_count)) {
        return res.json({
          return_code: 'VALIDATION_ERROR',
          message: 'expected_count is required when marking everyone.'
        });
      }

      if (expected_count !== candidates.length) {
        return res.json({
          return_code: 'COUNT_CHANGED',
          message: `${expected_count} ${expected_count === 1 ? 'was' : 'were'} on screen but ${candidates.length} qualify now. Refresh and look again.`,
          expected_count,
          actual_count: candidates.length
        });
      }
    }

    const { marked, still_waiting } = await markSkipped(entry, email_type, toMark, {
      competition_id: scopeId,
      reason
    });

    return res.json({
      return_code: 'SUCCESS',
      marked,
      still_waiting,
      message: `Marked ${marked} as sent. No email was delivered${still_waiting > 0 ? `, ${still_waiting} still waiting` : ''}.`
    });

  } catch (error) {
    console.error('admin/mark-emails-sent error:', { error: error.message, stack: error.stack });
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not mark those as sent. Check the server log.'
    });
  }
});

module.exports = router;
