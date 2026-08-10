/*
=======================================================================================================================================
API Route: get-competition-by-code
=======================================================================================================================================
Method: POST
Purpose: Public lookup of a competition from its invite code, so the /join/[code] page can
         show a player what they are joining BEFORE asking them to sign in or create an account.

         Deliberately unauthenticated. A player arriving from a poster, a WhatsApp message or the
         landing page join strip has a code and nothing else; making them register before we tell
         them whether the code is even real means they do all the work and then hit a dead end.

         Returns only what is already printed on the organiser's promotional material: the
         competition name, the venue, the organiser's display name and how many are playing. No
         player names, no contact details, no invite code echoed back.

         AND ONLY WHEN THE COMPETITION IS OPEN TO NEW PLAYERS. A competition that has started, and
         one that does not exist, produce the same COMPETITION_NOT_FOUND with no detail whatsoever
         - not a name, not a reason, not an acknowledgement that anything is there. Resist adding a
         helpful discriminator between those two: the moment a started competition answers
         differently from a missing one, the code space becomes a directory of every venue on the
         platform. See §4.3 of docs/player-onboarding.md.

         COMPETITION_FULL is the one deliberate exception, and it returns the organiser's name.
         The split is recoverable vs not: a started competition will never take this player, so
         saying so achieves nothing, while a full one is one credit purchase away from letting them
         in. Silence there loses a player, a sale, and an organiser who never learns why their
         competition stopped growing.

         That matters more than it used to. Codes were previously set to NULL when round 1 locked,
         which dropped started competitions out of this lookup as a side effect. Codes now live for
         the whole life of a competition (§3.1), so the set of rows this route can match only ever
         grows, and returning nothing when closed is the only thing keeping them private.

         Joining eligibility mirrors join-competition-by-code exactly: players may join until
         round 1 locks. If those rules change, change them in both places.

         Rate limited in server.js by joinLookupLimit (30 a minute per IP) rather than the general
         DB-intensive limiter, which at 50 per 10 seconds would let the whole code space be walked
         in well under an hour. That raises the cost of enumeration; returning nothing for a
         closed competition is what makes enumeration pointless.
=======================================================================================================================================
Request Payload:
{
  "competition_code": "1252"           // string, required - invite code, case-insensitive
}

Success Response (ALWAYS HTTP 200):
Returned only when the competition is open to new players. There is no "closed" success shape.
{
  "return_code": "SUCCESS",
  "competition": {
    "id": 123,                         // integer, competition database ID
    "name": "Premier League LMS",      // string, competition name
    "venue_name": "The Crown & Anchor",// string|null, venue if the organiser set one
    "organiser_name": "Dave R.",       // string|null, organiser display name
    "player_count": 24                 // integer, players who have joined so far
  }
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Full Response (ALWAYS HTTP 200):
{
  "return_code": "COMPETITION_FULL",
  "message": "That competition has no room for another player at the moment",
  "organiser_name": "Dave R."          // string|null, the one identifying detail any closed
}                                      // response gives up - deliberate, see §4.3

=======================================================================================================================================
Return Codes:
"SUCCESS"
"VALIDATION_ERROR"      - Missing or invalid competition_code parameter
"COMPETITION_NOT_FOUND" - No competition with that code, OR it has started. Deliberately
                          indistinguishable from each other - see the Purpose note above.
"COMPETITION_FULL"      - Real, open, but the organiser is at their player limit with no credits
"SERVER_ERROR"          - Database error or unexpected server failure
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const { recordJoinBlock } = require('../services/joinBlock');
const { organiserChargeableCountSql } = require('../services/botPool');
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
        c.organiser_id              AS competition_organiser_id,
        u.display_name              AS organiser_name,
        u.paid_credit               AS organiser_credits,
        MAX(r.round_number)         AS current_round_number,
        MAX(r.lock_time)            AS latest_lock_time,
        NOW()                       AS current_time,
        (SELECT COUNT(*) FROM competition_user cu WHERE cu.competition_id = c.id) AS player_count,
        -- Organiser capacity is counted across ALL their competitions, exactly as
        -- join-competition-by-code does it, so the two routes agree on whether there is room.
        -- Bots are excluded, which is what stops a seeded competition answering FULL to the
        -- real players the seeding existed to attract.
        ${organiserChargeableCountSql('c.organiser_id')} AS organiser_player_count
      FROM competition c
      LEFT JOIN round r ON c.id = r.competition_id
      LEFT JOIN app_user u ON c.organiser_id = u.id
      -- UPPER() is kept, not folded away: today's codes are all digits so it is a no-op,
      -- but the field is free to hold REDBARN25 later and matching must stay
      -- case-insensitive. idx_competition_invite_code indexes this exact expression.
      WHERE UPPER(c.invite_code) = $1
      GROUP BY c.id, c.name, c.venue_name, c.organiser_id, u.display_name, u.paid_credit
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
    let closed_reason = null;

    if (data.current_round_number && Number(data.current_round_number) > 1) {
      closed_reason = "STARTED";
    } else if (data.latest_lock_time && new Date(data.current_time) >= new Date(data.latest_lock_time)) {
      closed_reason = "STARTED";
    } else {
      // The organiser pays for player places past the free allowance. If they are at the limit
      // with no credits left, the join would be refused with ORGANISER_INSUFFICIENT_CREDITS.
      const FREE_PLAYER_LIMIT = parseInt(process.env.FREE_PLAYER_LIMIT) || 20;
      const organiserPlayers = Number(data.organiser_player_count) || 0;
      const organiserCredits = Number(data.organiser_credits) || 0;

      if (organiserPlayers >= FREE_PLAYER_LIMIT && organiserCredits < 1) {
        closed_reason = "FULL";
      }
    }

    // STEP 4: A full competition says so. Every other closed case says nothing.
    //
    // The split is recoverable vs not. A started competition will never accept this player, so
    // silence costs nothing - there is no action to prompt. A full one is one credit purchase
    // away from letting them in, and staying quiet destroys that recovery: the player walks, the
    // organiser never finds out, and a competition that was working stops growing.
    if (closed_reason === "FULL") {
      // Recorded so the organiser is told on their dashboard - they are the only person who can
      // fix this, and without it they never learn their competition stopped growing.
      // Never throws; see services/joinBlock.js.
      await recordJoinBlock(data.competition_id, data.competition_organiser_id);

      // The organiser's display name is returned deliberately, and it is the one identifying
      // detail any closed response gives up. Naming them makes the message something the player
      // can act on rather than a dead end. Weighed and chosen; see §4.3.
      return res.status(200).json({
        return_code: "COMPETITION_FULL",
        message: "That competition has no room for another player at the moment",
        organiser_name: data.organiser_name || null
      });
    }

    if (closed_reason !== null) {
      // Started, or no such code - deliberately indistinguishable. See the header.
      return res.status(200).json({
        return_code: "COMPETITION_NOT_FOUND",
        message: "No competition found with that code"
      });
    }

    return res.status(200).json({
      return_code: "SUCCESS",
      competition: {
        id: data.competition_id,
        name: data.competition_name,
        venue_name: data.venue_name || null,
        organiser_name: data.organiser_name || null,
        player_count: Number(data.player_count) || 0
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
