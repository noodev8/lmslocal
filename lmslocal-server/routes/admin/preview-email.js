/*
=======================================================================================================================================
API Route: admin/preview-email
=======================================================================================================================================
Method: POST
Purpose: Show the operator exactly who an email would go to and what it would look like, without
         sending or queuing anything.

The recipient list and the HTML both come from services/emailCatalog.js - the same findCandidates
and the same build function the send uses. Nothing here re-implements either, so a preview showing
three recipients cannot be followed by a send that mails five.

The rendered sample is built for the FIRST candidate. Every recipient gets a different name, and
a pick reminder has different fixtures struck through, so there is no single "the" email - the
preview is a representative one, and the response says whose it is.

competition_id is OPTIONAL everywhere. On a scoped email it narrows the preview to one competition;
omitted, the preview spans all of them, which is how the focus card answers "who is waiting for
this email" rather than "who is waiting in the competition I happened to pick". Platform-wide
emails (Join LMS, News) have no competition and ignore it either way.
=======================================================================================================================================
Request Payload:
{
  "email_type": "pick_reminder",       // string, required - which outline email
  "competition_id": 210                // integer, optional - narrows scoped emails; null = all
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "recipient_count": 3,                // integer, how many would be sent
  "recipients": [                      // array, capped at MAX_LISTED
    {
      "user_id": 862,                  // integer
      "email": "player@example.com",   // string
      "display_name": "Brookfield",    // string
      "round_number": 1                // integer or null, only meaningful for round-based emails
    }
  ],
  "truncated": false,                  // boolean, true if more recipients than listed
  "sample": {                          // object or null, null when nobody qualifies
    "for_email": "player@example.com", // string, whose copy this is
    "subject": "...",                  // string
    "html": "<!DOCTYPE html>..."       // string, the real template output
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "VALIDATION_ERROR",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
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
const { logApiCall } = require('../../utils/apiLogger');

const router = express.Router();

// How many addresses come back. Enough to sanity-check a list, short of dumping the user base.
const MAX_LISTED = 50;

router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('admin/preview-email');

  try {
    const { email_type, competition_id, include_sample } = req.body;

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
    competition_id is optional now, for scoped emails too: omitting it previews across every
    competition. `scoped` says whether the picker applies at all, not that a value is required -
    every scoped service already carries `AND ($n::int IS NULL OR c.id = $n)` for exactly this.
    */
    const scopeId = entry.scoped && Number.isInteger(competition_id) ? competition_id : null;

    const candidates = await entry.service.findCandidates(scopeId ? { competition_id: scopeId } : {});

    // Nobody qualifies. Still a success - the screen shows a count of zero and disables send.
    if (candidates.length === 0) {
      return res.json({
        return_code: 'SUCCESS',
        recipient_count: 0,
        recipients: [],
        truncated: false,
        sample: null
      });
    }

    /*
    Build the sample from real data rather than a fixture. buildTemplateData writes nothing -
    it only reads the round's fixtures and the player's own past picks - so this is safe to run
    on a preview.

    Skipped when include_sample is false, which is what the admin screen asks for: once a
    template has been signed off, re-rendering it on every preview is work nobody looks at, and
    a test send is the way to see it again. The recipient list is the thing being checked.
    */
    let sample = null;
    if (include_sample !== false) {
      const first = candidates[0];
      const templateData = await entry.service.buildTemplateData(first);
      const built = entry.build(first.user_email, templateData);
      sample = {
        for_email: first.user_email,
        subject: built.subject,
        html: built.html
      };
    }

    return res.json({
      return_code: 'SUCCESS',
      recipient_count: candidates.length,
      recipients: candidates.slice(0, MAX_LISTED).map((c) => ({
        user_id: c.user_id,
        email: c.user_email,
        display_name: c.user_display_name,
        /*
        The competition is what makes a recipient identifiable when the preview spans all of them:
        the same person legitimately appears once per competition they joined, and mark-as-sent
        matches on the PAIR for that reason.
        */
        competition_id: c.competition_id ?? null,
        competition_name: c.competition_name ?? null,
        /*
        When this candidate became one - a join for a welcome, a creation for created_comp. It is
        how the operator tells a fresh candidate from a backlog left over from before the email
        existed, which is the whole judgement behind send-versus-mark. Services name the column
        for their own trigger, so take whichever is present.
        */
        since: c.joined_at ?? c.created_at ?? null,
        // Present only on round-based emails; null on the platform-wide ones.
        round_number: c.round_number ?? null
      })),
      truncated: candidates.length > MAX_LISTED,
      sample
    });

  } catch (error) {
    console.error('admin/preview-email error:', { error: error.message, stack: error.stack });
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not build the preview.'
    });
  }
});

module.exports = router;
