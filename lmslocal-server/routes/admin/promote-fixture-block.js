/*
=======================================================================================================================================
API Route: promote-fixture-block
=======================================================================================================================================
Method: POST
Purpose: Copy a calendar block into fixture_load, making it the batch going out, then push it to
         every competition that may take it. This is the handover point between the two halves
         of the fixture system.

           fixture_block  --promote-->  fixture_load  --push-->  round + fixture
           (calendar, weeks ahead)      (batch, one at a time)   (per competition)

         Results and Clear staged batch are unchanged. See docs/competition-start.md §7.
=======================================================================================================================================
Request Payload:
{
  "block_id": 7                              // integer, required
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "block_id": 7,                             // integer
  "fixtures_staged": 10,                     // integer, rows written to fixture_load
  "team_list_id": 1,                         // integer, which list's batch this now is
  "lock_time": "2026-08-29T14:00:00Z",       // string, earliest kickoff - the round's lock time
  "pushed_count": 13,                        // integer, competitions that now have the round
  "competitions": [                          // array, every competition subscribed to the list -
                                             //   null if the push could not run at all
    {
      "competition_id": 172,                 // integer
      "name": "EKRR AFC",                    // string
      "outcome": "pushed",                   // string, pushed|skipped|failed
      "round_number": 4,                     // integer or null, the round it got (pushed only)
      "round_action": "created",             // string or null, created|populated|reconciled
      "reason": null                         // string or null, why not, in words for a person
    }
  ]
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"          - block_id missing, or the block has no fixtures
"BLOCK_NOT_FOUND"           - block_id does not exist
"ALREADY_PROMOTED"          - This block is already staged
"PENDING_BATCH"             - fixture_load already holds a batch for this team list
"KICKOFF_PASSED"            - The earliest kickoff is in the past
"UNAUTHORIZED"              - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"             - Admin session has expired
"SERVER_ERROR"              - Database error or unexpected server failure
=======================================================================================================================================
Data Notes:
- PENDING_BATCH is the SAME rule add-staged-fixtures enforces, checked in the same place against
  the same table. The calendar deliberately does not relax it: fixture_load may still hold only
  one batch at a time, because a round is one batch and the results screen has no way to tell two
  apart. The calendar removes the need to work around that rule, not the rule.

- KICKOFF_PASSED stops a batch that would create a round locked the moment it arrived, which no
  player could pick in. fixtureService.js enforces the same floor at push time; failing here is
  the earlier and more legible of the two.

- Kickoffs are copied PER FIXTURE. add-staged-fixtures writes one time across a whole batch
  because its form asks for one; a block holds a real 12:30 and a real 15:00 and there is no
  reason to flatten them - players would be shown the wrong time for half the round. The lock
  time is still MIN(kickoff), so the round closes before anything kicks off.

  One knock-on: the results screen unlocks result entry once the earliest kickoff has passed,
  so on a mixed block it opens while later games are still to play. Entry is per fixture and the
  push tolerates a partly-resulted batch, so this is a slightly earlier door rather than a wrong
  one.

- staged_at is stamped in the same transaction as the copy. A block that reached fixture_load but
  was still marked provisional could be promoted twice, which would double every fixture in the
  round.

- THE PUSH (2026-10-19). Pushing each competition by hand from the Fixtures screen was a
  formality - staging follows closing the last gameweek, which is refused until every competition
  has its results, so every live competition can take the batch - and it was forgotten once. The
  candidate list is the same one that screen shows and evaluateCompetition is re-run inside each
  push, so this sends to exactly the rows that screen would have offered.

  Each competition is its own transaction, after the stage has committed - the same shape as
  set-competition-ready. The stage stands whatever the pushes do, and one failure stays with the
  competition it happened to. A failed or skipped competition is reported, not retried; the
  Fixtures screen's per-row button is the fallback.

  SUCCESS therefore means "staged", not "every competition has it". Read `competitions`.
  Archived competitions are pushed like any other - archiving only hides them from the admin.
=======================================================================================================================================
*/

const express = require('express');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const { stageBlock } = require('../../services/stageBlock');
const router = express.Router();

// The work is in services/stageBlock.js, shared with clear-staged-batch, which stages the next
// block itself when a gameweek closes.
router.post('/', verifyAdminToken, async (req, res) => {
  logApiCall('promote-fixture-block');

  try {
    const { block_id } = req.body;

    if (!Number.isInteger(block_id)) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'block_id is required'
      });
    }

    return res.json(await stageBlock(block_id));

  } catch (error) {
    console.error('promote-fixture-block error:', error.message);
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not stage that block'
    });
  }
});

module.exports = router;
