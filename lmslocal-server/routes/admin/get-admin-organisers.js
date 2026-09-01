/*
=======================================================================================================================================
API Route: get-admin-organisers
=======================================================================================================================================
Method: GET
Purpose: List every organiser on the platform for the lmslocal-admin Organisers screen - who
         they are, how to email them, and enough commercial and engagement context to decide
         who is worth contacting.

         An organiser is anyone who owns at least one competition that is LIVE - ACTIVE or
         PENDING, and not archived. People who only help run someone else's competition
         (competition_user permission flags) are deliberately not included - they did not create
         anything, and this screen is about the people whose accounts the business relationship
         sits with.
=======================================================================================================================================
Request Payload:
  None (GET). Authentication is by admin token in the Authorization header.

Success Response (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "organisers": [
    {
      "id": 1003,                                   // integer, app_user.id
      "name": "Paul Lavelle",                       // string, may be null
      "email": "landlord@pub.com",                  // string, may be null on very old accounts
      "email_verified": true,                       // boolean
      "competitions_total": 2,                      // integer, competitions they own
      "competitions_active": 1,                     // integer, of those, currently running
      "competitions_setup": 1,                      // integer, of those, created but not started
      "competitions_complete": 0,                   // integer, of those, finished
      "competitions_on_fixture_service": 1,         // integer, of those, opted into the fixture service
      "players_total": 21,                          // integer, people recruited (no bots, not themselves)
      "players_unique": 21,                         // integer, of those, distinct people
      "chargeable_players": 22,                     // integer, memberships that count for billing (no bots/guests)
      "free_places_left": 0,                        // integer, unused part of FREE_PLAYER_LIMIT
      "credits_available": 19,                      // integer, free places left + credit bought
      "spend_12m": 40,                              // number, real money paid in the last 12 months
      "credit": 19,                                 // integer, current credit balance
      "signed_up_at": "2026-01-04T12:00:00.000Z",   // string, ISO datetime, account created
      "last_active_at": "2026-08-01T09:00:00.000Z", // string or null, ISO datetime, last seen by the player app
      "first_competition_at": "2026-01-05T...",     // string, ISO datetime, oldest competition they created
      "last_player_activity": "2026-08-01T..."      // string or null, most recent pick across their competitions
    }
  ],
  "generated_at": "2026-08-03T14:00:00.000Z"
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"UNAUTHORIZED"              - Missing, invalid, expired, or non-admin token
"TOKEN_EXPIRED"             - Admin session has expired
"SERVER_ERROR"              - Database error or unexpected server failure
=======================================================================================================================================
Data Notes:
- ARCHIVED COMPETITIONS ARE NOT ON THIS SCREEN, in either direction:

  An organiser appears at all only if they own something ACTIVE or PENDING that is not archived.
  Somebody whose every competition is archived or finished is not a person to act on, and eleven
  of them were padding the list and every tile on it.

  Every competition and player figure on the row then counts only their NON-ARCHIVED
  competitions, so "3 competitions" here cannot mean a 1 on the Competitions screen. Archived is
  the one rule in services/competitionEngagement.js, evaluated in a first round trip exactly as
  get-admin-stats does it - never a second copy written in SQL.

  BILLING IS THE EXCEPTION. "chargeable_players", "credit", "credits_available",
  "free_places_left" and "spend_12m" cover the whole account, archived competitions included,
  because a place that was charged for was charged for whatever became of the competition. These
  are the only figures here that will not reconcile with the competition columns beside them.
- competition.status is uppercase ('SETUP', 'ACTIVE', 'COMPLETE'). It used to be mixed; the data
  was normalised on 2026-08-04. Every comparison here still lowercases the column first, which is
  now belt-and-braces rather than load-bearing.
- "players_total" is PEOPLE THEY RECRUITED: competition_user rows excluding bots and excluding the
  organiser's own membership. This screen is read to answer "how is recruitment going", and both
  exclusions were flattering that answer - one competition reported 24 against 2 real players, and
  four organisers sitting alone in an empty competition reported 1 each rather than 0.

  It therefore no longer matches "player_count" in get-admin-competitions, which still counts
  every membership. Those two screens used to reconcile exactly and now do not. If they need to
  again, the fix is to apply the same two exclusions there, not to put them back here.

  It also no longer matches "chargeable_players" on this same row, and that gap IS the organiser:
  they consume a chargeable place while not being somebody they recruited.

  "players_unique" is the same set deduplicated, which is lower whenever someone plays in two of
  the same organiser's competitions. Reported separately rather than instead: the totals are what
  reconcile with the competitions screen, the distinct count is the honest reach figure.
- "spend_12m" is SUM over credit_purchases, NOT app_user.paid_credit. Credit can be granted
  without money changing hands, so only a purchase proves a paying customer. The current balance
  is returned separately as "credit" - a paying organiser sitting at zero is worth spotting.

  Twelve months rather than lifetime, and cs_test_ sessions excluded. See the query.
- "credits_available" is the headroom question: how many more players could this organiser take on
  right now. Free places left plus credit bought, because from their side a place is a place. It
  is deliberately NOT the same as "credit", which is only the bought half and reads as zero for
  every organiser who has never needed to buy anything.

  It says who can act NOW, where spend says who once handed over money, and the two do not agree -
  one account has 190 credits bought and 2 chargeable players, because bots are excluded from
  charging and nearly all of its members are bots.
- "last_active_at" is the organiser's own last session; "last_player_activity" is the newest pick
  by anyone in their competitions. An organiser who has gone quiet while their players have not
  reads very differently from one whose whole competition has stalled.
- No pagination. This is a per-account roll-up over a table in the low hundreds; the admin screen
  sorts and filters the full list client-side.
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../../database');
const { logApiCall } = require('../../utils/apiLogger');
const { verifyAdminToken } = require('../../middleware/admin-auth');
const { organiserChargeableCountSql, chargeableMemberFilter } = require('../../services/botPool');
const {
  BOT_EMAIL_LIKE,
  realPlayerCountSql,
  pickCountSql,
  lastActivitySql,
  classifyCompetition
} = require('../../services/competitionEngagement');
const router = express.Router();

// The same env var every billing path reads. Defaulted identically, so this screen cannot report
// an allowance the charging code does not honour.
const FREE_PLAYER_LIMIT = parseInt(process.env.FREE_PLAYER_LIMIT) || 20;

router.get('/', verifyAdminToken, async (req, res) => {
  logApiCall('get-admin-organisers');

  try {
    /*
    FIRST ROUND TRIP: which competitions are archived, and which are live.

    Classified in JS by the shared rule rather than re-expressed in SQL, so this screen, the
    Competitions screen and the organisers card on it can never disagree about what archived
    means. A few dozen rows, so the extra query costs nothing.

    Two lists come out of it and they are not the same thing: "live" (ACTIVE or PENDING, not
    archived) decides who is ON this screen at all, while "not archived" - which still includes
    finished competitions - is what the row's figures count. An organiser running one competition
    who finished two last season should show all three, and be here because of the one.
    */
    const classifyQuery = `
      SELECT
        c.id,
        LOWER(c.status)                          AS status,
        c.stalled_override,
        ${realPlayerCountSql('c', '$1')}         AS real_player_count,
        ${pickCountSql('c')}                     AS pick_count,
        ${lastActivitySql('c')}                  AS last_activity
      FROM competition c
    `;
    const classifyResult = await query(classifyQuery, [BOT_EMAIL_LIKE]);

    const classified = classifyResult.rows.map((c) => ({
      ...c,
      is_stalled: classifyCompetition(c).is_stalled
    }));

    const countedIds = classified.filter((c) => !c.is_stalled).map((c) => c.id);
    const liveIds = classified
      .filter((c) => !c.is_stalled && c.status !== 'complete')
      .map((c) => c.id);

    /*
    An organiser with nothing live has no rows at all after this, so the query returns nobody
    rather than everybody - which is what an empty ANY() would do if it were spelled the other
    way round. $1 is the counted list, $2 the live one, throughout.
    */

    // One query. Scalar subselects per organiser rather than a pile of GROUP BY joins, which
    // would multiply rows against each other - there are a few dozen organisers, so the repeated
    // subselects cost nothing and the shape stays readable.
    const organisersQuery = `
      SELECT
        u.id,
        u.display_name                                                       AS name,
        u.email,
        COALESCE(u.email_verified, false)                                    AS email_verified,
        u.paid_credit                                                        AS credit,
        u.created_at                                                         AS signed_up_at,
        u.last_active_at,

        -- Every competition figure is scoped to $1, the non-archived competitions. An archived
        -- one is not something to act on, and counting it here would put a number on this screen
        -- that the Competitions screen does not show anywhere.
        (SELECT COUNT(*) FROM competition c
          WHERE c.organiser_id = u.id AND c.id = ANY($1::int[]))             AS competitions_total,
        (SELECT COUNT(*) FROM competition c
          WHERE c.organiser_id = u.id AND c.id = ANY($1::int[])
            AND LOWER(c.status) = 'active')                                  AS competitions_active,
        (SELECT COUNT(*) FROM competition c
          WHERE c.organiser_id = u.id AND c.id = ANY($1::int[])
            AND LOWER(c.status) = 'setup')                                   AS competitions_setup,
        (SELECT COUNT(*) FROM competition c
          WHERE c.organiser_id = u.id AND c.id = ANY($1::int[])
            AND LOWER(c.status) = 'complete')                                AS competitions_complete,
        (SELECT COUNT(*) FROM competition c
          WHERE c.organiser_id = u.id AND c.id = ANY($1::int[])
            AND COALESCE(c.fixture_service, false) = true)                   AS competitions_on_fixture_service,

        /*
        PEOPLE THEY RECRUITED. Not "memberships" - two exclusions, both of which were making the
        number say something the screen is not read for:

        BOTS are seeding, accounts we drive to make a new competition look alive. Counting them
        reported 24 players for an organiser who had recruited one.

        THE ORGANISER THEMSELVES is inserted into competition_user when they create a competition,
        so every organiser started at 1 and four accounts sitting alone in an empty competition
        were indistinguishable from four who had found a player. Nobody recruits themselves.

        Excluded by comparing the row to c.organiser_id rather than by subtracting one per
        competition: one organiser today is NOT a member of their own competition, so the
        arithmetic version would take them to -1.

        This is deliberately NOT the same as the billing count below, and the difference is the
        organiser: they occupy a chargeable place like anybody else, so they cost a credit while
        never counting as recruited. Two questions, two numbers - see Data Notes.
        */
        (SELECT COUNT(*)
           FROM competition_user cu
           JOIN competition c ON c.id = cu.competition_id
           JOIN app_user pu ON pu.id = cu.user_id
          WHERE c.organiser_id = u.id
            AND c.id = ANY($1::int[])
            AND cu.user_id <> c.organiser_id
            AND ${chargeableMemberFilter('pu')})                              AS players_total,
        (SELECT COUNT(DISTINCT cu.user_id)
           FROM competition_user cu
           JOIN competition c ON c.id = cu.competition_id
           JOIN app_user pu ON pu.id = cu.user_id
          WHERE c.organiser_id = u.id
            AND c.id = ANY($1::int[])
            AND cu.user_id <> c.organiser_id
            AND ${chargeableMemberFilter('pu')})                              AS players_unique,

        /*
        TWELVE MONTHS, AND REAL MONEY ONLY.

        Lifetime was the wrong window for a screen about who to contact: a purchase from two years
        ago says nothing about whether somebody is a customer now, and it never decays, so the
        column could only ever grow.

        cs_test_ sessions are Stripe's test mode - checkouts that took no money. Three of the six
        purchases on the platform are test ones, all on the same account, and including them
        reported 70 of a 140 total that never existed. COALESCE because a purchase inserted by
        hand would have no session id at all, and NULL NOT LIKE is NULL, which would drop the row.
        */
        (SELECT COALESCE(SUM(cp.paid_amount), 0)
           FROM credit_purchases cp
          WHERE cp.user_id = u.id
            AND cp.created_at >= NOW() - INTERVAL '12 months'
            AND COALESCE(cp.stripe_subscription_id, '') NOT LIKE 'cs_test%')  AS spend_12m,

        /*
        Chargeable memberships across all their competitions, from the one shared definition in
        services/botPool.js - the same fragment the player-facing credit screen uses, so what the
        admin sees and what the organiser is billed for cannot drift apart. Bots and guests are
        excluded there, which is the point: a competition seeded with bots must not read as usage.

        The free allowance is subtracted in JS below rather than here, so FREE_PLAYER_LIMIT is
        read from one place.
        */
        ${organiserChargeableCountSql('u.id')}                                AS chargeable_players,

        (SELECT MIN(c.created_at) FROM competition c
          WHERE c.organiser_id = u.id AND c.id = ANY($1::int[]))              AS first_competition_at,

        (SELECT MAX(p.created_at)
           FROM pick p
           JOIN round r ON r.id = p.round_id
           JOIN competition c ON c.id = r.competition_id
          WHERE c.organiser_id = u.id
            AND c.id = ANY($1::int[]))                                       AS last_player_activity

      FROM app_user u
      -- $2 is the LIVE list, not the counted one: owning something ACTIVE or PENDING is what
      -- puts somebody on this screen. A finished back catalogue still shows in their columns
      -- above, but on its own it is not a reason to contact anyone.
      WHERE EXISTS (SELECT 1 FROM competition c
                     WHERE c.organiser_id = u.id AND c.id = ANY($2::int[]))
      ORDER BY u.display_name NULLS LAST
    `;

    const result = await query(organisersQuery, [countedIds, liveIds]);

    // COUNT() arrives as a string from node-postgres (bigint), NUMERIC likewise
    const n = (value) => parseInt(value, 10) || 0;

    const organisers = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      email_verified: row.email_verified === true,
      competitions_total: n(row.competitions_total),
      competitions_active: n(row.competitions_active),
      competitions_setup: n(row.competitions_setup),
      competitions_complete: n(row.competitions_complete),
      competitions_on_fixture_service: n(row.competitions_on_fixture_service),
      players_total: n(row.players_total),
      players_unique: n(row.players_unique),
      chargeable_players: n(row.chargeable_players),
      /*
      HOW MANY MORE PLAYERS THIS ORGANISER CAN TAKE BEFORE THEY HAVE TO BUY.

      Free places left PLUS credit bought, because those are the same thing from the organiser's
      side - a place is a place, and which pocket it comes out of is our accounting, not theirs.
      A brand new organiser reads 20 rather than 0, which is the honest answer to "can they run a
      competition today".

      Note it is free places LEFT, not a flat 20 added to everyone: somebody already past the
      allowance has spent theirs, and adding 20 back would credit them twice.

      Derived here so FREE_PLAYER_LIMIT is read in one place and the screen subtracts nothing of
      its own.
      */
      free_places_left: Math.max(0, FREE_PLAYER_LIMIT - n(row.chargeable_players)),
      credits_available: Math.max(0, FREE_PLAYER_LIMIT - n(row.chargeable_players)) + n(row.credit),
      spend_12m: parseFloat(row.spend_12m) || 0,
      credit: n(row.credit),
      signed_up_at: row.signed_up_at,
      last_active_at: row.last_active_at,
      first_competition_at: row.first_competition_at,
      last_player_activity: row.last_player_activity
    }));

    return res.json({
      return_code: 'SUCCESS',
      organisers,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('get-admin-organisers error:', error.message);
    return res.json({
      return_code: 'SERVER_ERROR',
      message: 'Could not load organisers'
    });
  }
});

module.exports = router;
