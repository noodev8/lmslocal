/*
=======================================================================================================================================
API Route: get-competition-by-code
=======================================================================================================================================
Method: POST
Purpose: Public lookup of a competition from an invite code or slug, so the /join/[code] page can
         show a player what they are joining BEFORE asking them to sign in or create an account.

         Deliberately unauthenticated. A player arriving from a poster, a WhatsApp message or the
         landing page join strip has a code and nothing else; making them register before we tell
         them whether the code is even real means they do all the work and then hit a dead end.

         Returns only what is already printed on the organiser's promotional material: the
         competition name, the venue, the organiser's display name and how many are playing. No
         player names, no contact details, no invite code echoed back.

         Joining eligibility mirrors join-competition-by-code exactly: players may join until
         round 1 locks. If those rules change, change them in both places.

         Rate limited in server.js by joinLookupLimit (30 a minute per IP) rather than the general
         DB-intensive limiter, which at 50 per 10 seconds would let the whole 4-digit code space be
         walked in under a minute. Note this raises the cost of enumeration, it does not prevent
         it — the mitigation that matters is that invite_code is set to NULL once round 1 locks, so
         only competitions still open to new players are visible at all.
=======================================================================================================================================
Request Payload:
{
  "competition_code": "RED-BARN"       // string, required - invite code or slug, case-insensitive
}

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "competition": {
    "id": 123,                         // integer, competition database ID
    "name": "Premier League LMS",      // string, competition name
    "venue_name": "The Crown & Anchor",// string|null, venue if the organiser set one
    "organiser_name": "Dave R.",       // string|null, organiser display name
    "player_count": 24,                // integer, players who have joined so far
    "status": "SETUP",                 // string, competition status as stored
    "can_join": true,                  // boolean, whether a new player may join right now
    "closed_reason": null              // string|null, "STARTED" when can_join is false
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"      - Missing or invalid competition_code parameter
"COMPETITION_NOT_FOUND" - No competition with that invite code or slug
"SERVER_ERROR"          - Database error or unexpected server failure
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { competition_code } = req.body;

    // STEP 1: Validate input
    if (!competition_code || typeof competition_code !== 'string' || competition_code.trim().length === 0) {
      return res.status(200).json({
        return_code: "VALIDATION_ERROR",
        message: "Competition code is required and must be a non-empty string"
      });
    }

    // Normalise for case-insensitive matching, same as join-competition-by-code
    const code = competition_code.trim().toUpperCase();

    // STEP 2: Single query for competition, round state and player count.
    // Round data is aggregated the same way join-competition-by-code does it, so the two routes
    // agree on whether joining is still open.
    const lookupQuery = `
      SELECT
        c.id                        AS competition_id,
        c.name                      AS competition_name,
        c.venue_name,
        c.status                    AS competition_status,
        u.display_name              AS organiser_name,
        MAX(r.round_number)         AS current_round_number,
        MAX(r.lock_time)            AS latest_lock_time,
        NOW()                       AS current_time,
        (SELECT COUNT(*) FROM competition_user cu WHERE cu.competition_id = c.id) AS player_count
      FROM competition c
      LEFT JOIN round r ON c.id = r.competition_id
      LEFT JOIN app_user u ON c.organiser_id = u.id
      WHERE UPPER(c.invite_code) = $1 OR UPPER(c.slug) = $1
      GROUP BY c.id, c.name, c.venue_name, c.status, u.display_name
      LIMIT 1
    `;

    const result = await query(lookupQuery, [code]);

    if (result.rows.length === 0) {
      return res.status(200).json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "No competition found with that code"
      });
    }

    const data = result.rows[0];

    // STEP 3: Work out whether a new player can still join.
    // Players may join before round 1 exists, and during round 1 until it locks.
    let can_join = true;
    let closed_reason = null;

    if (data.current_round_number && Number(data.current_round_number) > 1) {
      can_join = false;
      closed_reason = "STARTED";
    } else if (data.latest_lock_time && new Date(data.current_time) >= new Date(data.latest_lock_time)) {
      can_join = false;
      closed_reason = "STARTED";
    }

    return res.status(200).json({
      return_code: "SUCCESS",
      competition: {
        id: data.competition_id,
        name: data.competition_name,
        venue_name: data.venue_name || null,
        organiser_name: data.organiser_name || null,
        player_count: Number(data.player_count) || 0,
        status: data.competition_status,
        can_join,
        closed_reason
      }
    });

  } catch (error) {
    console.error('Error in get-competition-by-code:', error);
    return res.status(200).json({
      return_code: "SERVER_ERROR",
      message: "Unable to look up that competition right now. Please try again."
    });
  }
});

module.exports = router;
