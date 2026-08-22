/*
=======================================================================================================================================
API Route: get-push-targets
=======================================================================================================================================
Method: GET
Purpose: Lists the competitions a staged batch is waiting to be pushed to, with the counts the
         admin needs before pressing anything.

         Results are pushed one competition at a time (/admin/push-results-to-competition), so
         the fixtures screen needs to know which competitions are involved, how big each one is,
         and how far each has got. This is that list.

         A competition appears here when it is on the fixture service AND holds at least one
         fixture matching the staged batch on home team + away team + kickoff time - the same
         three-column match the push itself uses, so what is listed is exactly what the push
         will touch.
=======================================================================================================================================
Request Payload:
  None (GET). Query string:
    team_list_id=1                          // integer, required - which staged batch to report on
  Authentication is by admin token in the Authorization header.

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "staged_total": 10,                       // integer, fixtures in the staged batch
  "staged_resulted": 10,                    // integer, of those, how many have both scores in
  "cutoff": "2026-08-08T14:00:00.000Z",     // string or null, earliest kickoff in the batch
  "competitions": [
    {
      "competition_id": 149,                // integer
      "name": "Lakers LMS",                 // string
      "organiser_email": "jo@example.com",  // string
      "organiser_name": "Jo",               // string
      "players": 55,                        // integer, total members
      "active_players": 43,                 // integer, members still in
      "results_to_push": 2,                 // integer, entered results this competition has not
                                            //   received yet - zero means pressing Push would
                                            //   return ALREADY_PUSHED
      "fixtures_pending": 10,               // integer, matched fixtures with no result yet
      "fixtures_unprocessed": 0,            // integer, resulted but eliminations not applied
      "fixtures_done": 0                    // integer, resulted and processed
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
"MISSING_FIELDS"            - team_list_id absent or not an integer
"UNAUTHORIZED"              - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"             - Admin session has expired
"SERVER_ERROR"              - Database or unexpected error
=======================================================================================================================================
Data Notes:
- "results_to_push" is what the screen disables the Push button on. It counts staged rows that
  have a result entered AND whose matching fixture here is still unresulted, so it answers "would
  pressing this do anything" rather than "is this competition finished". Without it the button
  stayed live on every row all weekend and a second press returned ALREADY_PUSHED.
- The three fixture counts are what the screen turns into a row state: fixtures_pending > 0 is
  "waiting to be pushed", pending 0 with unprocessed > 0 is "pushed but eliminations not applied"
  (a part-finished attempt worth pressing again), and both 0 is "done".
- Player counts come from a separate query rather than a FILTER on the same join, because
  joining competition_user here would multiply every fixture row by every member and inflate the
  fixture counts.
- Every subscribed competition is listed. There is no organiser filter: pushes name their
  competition, so nothing needs fencing off by environment variable.
  rather than showing competitions it would silently skip.
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const router = express.Router();

router.get('/', verifyAdminToken, async (req, res) => {
  logApiCall('get-push-targets');

  try {
    const teamListId = parseInt(req.query.team_list_id);

    if (!req.query.team_list_id || !Number.isInteger(teamListId)) {
      return res.json({
        return_code: 'MISSING_FIELDS',
        message: 'team_list_id is required and must be an integer'
      });
    }

    // The batch itself: how much is staged, how much of it is resulted, and the deadline.
    const batchResult = await query(`
      SELECT
        COUNT(*) AS staged_total,
        COUNT(*) FILTER (WHERE home_score IS NOT NULL AND away_score IS NOT NULL) AS staged_resulted,
        MIN(kickoff_time) AS cutoff
      FROM fixture_load
      WHERE team_list_id = $1
    `, [teamListId]);

    const batch = batchResult.rows[0];

    // Competitions holding a fixture from this batch, matched on the same three columns the push
    // uses. Counted by how far each fixture has got, which is what the screen shows per row.
    const competitionsResult = await query(`
      SELECT
        c.id AS competition_id,
        c.name,
        u.email AS organiser_email,
        u.display_name AS organiser_name,
        -- Staged results this competition has NOT received yet. The one number that says
        -- whether a row still needs pressing: fixtures_pending counts every unresulted fixture,
        -- which on a Friday night is the same 9 for everybody and so distinguishes nothing.
        COUNT(*) FILTER (
          WHERE fl.home_score IS NOT NULL AND fl.away_score IS NOT NULL AND f.result IS NULL
        ) AS results_to_push,
        COUNT(*) FILTER (WHERE f.result IS NULL) AS fixtures_pending,
        COUNT(*) FILTER (WHERE f.result IS NOT NULL AND f.processed IS NULL) AS fixtures_unprocessed,
        COUNT(*) FILTER (WHERE f.processed IS NOT NULL) AS fixtures_done
      FROM fixture_load fl
      JOIN fixture f
        ON f.home_team_short = fl.home_team_short
       AND f.away_team_short = fl.away_team_short
       AND f.kickoff_time = fl.kickoff_time
      JOIN competition c ON c.id = f.competition_id AND c.fixture_service = true
      JOIN app_user u ON u.id = c.organiser_id
      WHERE fl.team_list_id = $1
      GROUP BY c.id, c.name, u.email, u.display_name
      ORDER BY c.name
    `, [teamListId]);

    // Player counts separately - see Data Notes on why this cannot be one query.
    const competitionIds = competitionsResult.rows.map((row) => row.competition_id);
    const playerCounts = new Map();

    if (competitionIds.length > 0) {
      const playersResult = await query(`
        SELECT
          competition_id,
          COUNT(*) AS players,
          COUNT(*) FILTER (WHERE status = 'active') AS active_players
        FROM competition_user
        WHERE competition_id = ANY($1::int[])
        GROUP BY competition_id
      `, [competitionIds]);

      for (const row of playersResult.rows) {
        playerCounts.set(row.competition_id, {
          players: parseInt(row.players, 10),
          active_players: parseInt(row.active_players, 10)
        });
      }
    }

    return res.json({
      return_code: 'SUCCESS',
      staged_total: parseInt(batch.staged_total, 10),
      staged_resulted: parseInt(batch.staged_resulted, 10),
      cutoff: batch.cutoff,
      competitions: competitionsResult.rows.map((row) => ({
        competition_id: row.competition_id,
        name: row.name,
        organiser_email: row.organiser_email,
        organiser_name: row.organiser_name,
        players: playerCounts.get(row.competition_id)?.players ?? 0,
        active_players: playerCounts.get(row.competition_id)?.active_players ?? 0,
        results_to_push: parseInt(row.results_to_push, 10),
        fixtures_pending: parseInt(row.fixtures_pending, 10),
        fixtures_unprocessed: parseInt(row.fixtures_unprocessed, 10),
        fixtures_done: parseInt(row.fixtures_done, 10)
      }))
    });

  } catch (error) {
    console.error('get-push-targets error:', error.message);
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not load push targets'
    });
  }
});

module.exports = router;
