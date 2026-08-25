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
  "recipients": [                      // array, capped at MAX_LISTED, or MAX_LISTED_SCOPED on a
                                       //   scoped email type
    {
      "user_id": 862,                  // integer
      "email": "player@example.com",   // string
      "display_name": "Brookfield",    // string
      "round_number": 1,               // integer or null, only meaningful for round-based emails
      "missed_pick": false,            // boolean or null, null when the email has no pick behind it
      "is_organiser": false            // boolean or null, null when the email does not answer it
    }
  ],
  "truncated": false,                  // boolean, true if more recipients than listed
  "since_label": "Joined",             // string, heading for the `since` column on this email
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

/*
Which column a service used to say when a candidate became one. Services name it for their own
trigger, so take whichever is present, in this order.
*/
const SINCE_COLUMNS = [
  'settled_at',
  'last_kickoff',
  'last_block',
  'finished_at',
  'lock_time',
  'starts_at',
  'joined_at',
  'created_at'
];

/*
Where the chain above picks the wrong one for an email.

created_comp candidates carry BOTH starts_at and created_at, and the chain reached starts_at first
- so the column showed round 1's lock time and read "in 7 hours", the only forward-pointing date on
a screen where every other row answers "how long has this been waiting". This column exists for the
send-versus-mark judgement, and for a once-ever email that judgement is whether the competition is
fresh or from January, which only created_at answers.

Display only. `since` is built here and read by one table cell; nothing about sending, queueing or
the template sees it.
*/
const SINCE_OVERRIDES = {
  created_comp: 'created_at'
};

/** The trigger timestamp a candidate carries, or null. */
const sinceOf = (candidate, emailType) => {
  const override = SINCE_OVERRIDES[emailType];
  if (override && candidate[override] != null) return candidate[override];

  const column = SINCE_COLUMNS.find((c) => candidate[c] != null);
  return column ? candidate[column] : null;
};

/*
What to head that column with, per email. "When" said nothing: the same word sat over a deadline
that has not arrived, a competition that ended weeks ago and the moment somebody signed up, and
"in 7 hours" under it on Welcome Created Comp read as nonsense - it is round 1's lock time, when
joining closes.

Keyed by email type rather than by the column above, because the column cannot tell you the
wording. join_lms and empty_comp both hang off a created_at, but one is a person signing up and
the other a competition being made, and "Created" is only right for the second.

Named here rather than on the admin screen's OUTLINE so the heading sits beside the value it
heads. A label held on the screen would be a second place describing what this route chose.

Anything absent falls back to "When".
*/
const SINCE_LABELS = {
  pick_reminder: 'Locks',                     // round 1 lock time, ahead: "in 31 hours"
  results: 'Settled',                         // when the round was settled
  game_complete: 'Finished',                  // when the competition ended
  welcome: 'Joined',                          // when they joined the competition
  created_comp: 'Created',                    // when the competition was made - see SINCE_OVERRIDES
  join_lms: 'Signed up',                      // when the account was created
  result_reminder: 'Last kickoff',            // the round's last kickoff, now played
  fixture_reminder: 'Settled',                // when their last round was settled
  empty_comp: 'Created',                      // when the competition was created
  promote_competition: 'Created',             // hints all hang off the competition's creation
  update_scores_mid_round_tip: 'Created',
  personal_names_tip: 'Created',
  join_blocked: 'Last blocked'                // the most recent join we turned away
};

/*
How many addresses come back. Enough to sanity-check a list, short of dumping the user base.

Two caps, because the two kinds of email ask different questions. On a SCOPED email the list IS
the job - ticking reaches only what is listed, so a cap below the number waiting makes picking
recipients impossible, and these are bounded by a competition's membership even when previewed
across all of them. On a platform-wide email it is a sanity check, and the honest answer could be
the whole user base.

Keyed on entry.scoped, the email TYPE, not on whether a competition was passed: a round over
preview across every competition is still a list of players to tick, and capping that one at 50
was the same trap by another route.
*/
const MAX_LISTED = 50;
const MAX_LISTED_SCOPED = 1000;

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

    const listCap = entry.scoped ? MAX_LISTED_SCOPED : MAX_LISTED;

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
      recipients: candidates.slice(0, listCap).map((c) => ({
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
        When this candidate became one - a join for a welcome, a creation for created_comp, the
        moment a round settled for fixture_reminder, the last kickoff for result_reminder. It is
        how the operator tells a fresh candidate from one that has been waiting, which is the
        judgement behind send-versus-mark and behind whether a nudge is overdue.

        Each is the clock the organiser's players are actually watching: not when we noticed, but
        when the thing they are waiting on happened.

        lock_time (pick_reminder) and starts_at point FORWARD - a deadline that has not arrived.
        The screen renders those as "in 31 hours" rather than an elapsed time; see relativeTime()
        there, which reads both directions for this reason. On a pick reminder that countdown is
        the single most useful thing on the row: it is how long the player has left.

        Services name the column for their own trigger, so take whichever is present. They do not
        collide today - each candidate row carries exactly one of these - and a service adding a
        new trigger column just adds itself to this list.
        */
        since: sinceOf(c, email_type),
        // Present only on round-based emails; null on the platform-wide ones.
        round_number: c.round_number ?? null,
        /*
        Whether this player let the round go by without picking - the same 'NO-PICK' row the
        template reads for its own wording, surfaced so the operator can leave them out. NULL,
        not false, on every email that has no pick behind it, so the screen can tell "did not
        pick" from "this email does not know".
        */
        missed_pick: c.chosen_team === undefined || c.chosen_team === null
          ? null
          : c.chosen_team === 'NO-PICK',
        /*
        Whether this recipient runs the competition. NULL, not false, on emails whose service does
        not answer the question - the same convention as missed_pick above, so the screen can tell
        "not the organiser" from "this email does not know" and only offers the filter when there
        is a real answer.
        */
        is_organiser: c.is_organiser === undefined || c.is_organiser === null
          ? null
          : c.is_organiser === true
      })),
      truncated: candidates.length > listCap,
      // Heading for the `since` column - see SINCE_LABELS. One per response: a preview is
      // always one email type, so every row in it is measuring the same thing.

      since_label: SINCE_LABELS[email_type] || 'When',
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
