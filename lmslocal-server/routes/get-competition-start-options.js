/*
=======================================================================================================================================
API Route: get-competition-start-options
=======================================================================================================================================
Method: GET
Purpose: The start dates a new fixture-service competition can be created against - the choice the
         organiser makes in the create wizard, before the competition exists.

         Round 1 is built from whichever they pick, there and then, so the competition has real
         fixtures and a real deadline from the moment it is created. See docs/competition-start.md.
=======================================================================================================================================
Request Payload:
  None (GET). Query string:
    team_list_id=1                           // integer, required - the list the competition will use

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "options": [
    {
      "block_id": 7,                         // integer, pass back as create-competition's start_block_id
      "label": "Sat 29 Aug",                 // string, what to show
      "lock_time": "2026-08-29T14:00:00Z",   // string, when round 1 locks and joining closes
      "fixture_count": 10,                   // integer, how many matches are in round 1
      "staged": false                        // boolean, true = fixtures already confirmed and
                                             //   going out now, so this is the soonest start
    }
  ],
  "recommended_block_id": 12                 // integer or null - which to preselect
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"          - team_list_id missing or not an integer
"UNAUTHORIZED"              - Missing, invalid, or expired token
"SERVER_ERROR"              - Database error or unexpected server failure
=======================================================================================================================================
Data Notes:
- No fixtures are returned, deliberately. The organiser is choosing WHEN their competition starts,
  not which matches are in it - ten fixtures would invite them to shop between gameweeks, a choice
  they have no basis to make, and would quietly make them feel responsible for the matches. Their
  players see the fixtures, on the pick screen.

- The list includes the batch **already staged**, not just future calendar blocks - it is normally
  the soonest round anybody could join, and leaving it out offered dates a fortnight away while a
  round starting this week sat waiting. See services/fixtureBlock.js.

- recommended_block_id is the **soonest** option, unless that one locks within DEFAULT_MIN_HOURS
  (48) - then the next one out. Somebody who accepts the default always gets a couple of days to
  recruit; somebody who deliberately wants tonight's round can still pick it, because every option
  stays selectable.

- An empty options array is a legitimate answer, not an error: the calendar has nothing far enough
  ahead. The wizard should still let the competition be created - it falls back to the older Ready
  flow - but that is an operator backlog and should be rare.

- lock_time is when joining closes as well as when picks close (join-competition-by-code.js), which
  is the single most important thing to put in front of the organiser. Everyone must start together,
  so a late joiner would face opponents who had already burned teams.
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const { logApiCall } = require('../utils/apiLogger');
const { verifyToken } = require('../middleware/auth');
const { getStartOptions, recommendedFrom } = require('../services/fixtureBlock');
const router = express.Router();

router.get('/', verifyToken, async (req, res) => {
  logApiCall('get-competition-start-options');

  try {
    const teamListId = parseInt(req.query.team_list_id, 10);

    if (!Number.isInteger(teamListId)) {
      return res.json({
        return_code: 'VALIDATION_ERROR',
        message: 'team_list_id is required'
      });
    }

    // getStartOptions takes anything with .query, so the shared helper is wrapped rather than a
    // transaction being opened for a single read.
    const options = await getStartOptions({ query }, teamListId);

    return res.json({
      return_code: 'SUCCESS',
      options: options.map((option) => ({
        block_id: option.id,
        label: option.label,
        lock_time: option.lock_time,
        fixture_count: option.fixture_count,
        staged: option.staged
      })),
      // One definition, in the service, so the create wizard and the reset dialog cannot
      // preselect different dates from the same list.
      recommended_block_id: recommendedFrom(options)
    });

  } catch (error) {
    console.error('get-competition-start-options error:', error.message);
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not load the start dates'
    });
  }
});

module.exports = router;
