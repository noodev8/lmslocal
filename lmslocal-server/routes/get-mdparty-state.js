/*
=======================================================================================================================================
API Route: get-mdparty-state
=======================================================================================================================================
Method: POST
Purpose: Everything a Matchday Party screen shows, for one room. Polled every second or two by the TV
         and every phone (docs/matchday-party.md §7). The TV sends the code alone; a phone adds its
         player token and gets its own predictions back too.
=======================================================================================================================================
Request Payload:
{
  "code": "KXBRT",                     // string, required
  "player_token": "Zq3...",            // string, optional - a phone's token; omit on the TV
  "known_version": 17                  // integer, optional - the version this screen already has
}

Success Response when nothing has changed (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "unchanged": true,
  "version": 17
}

Success Response otherwise (ALWAYS HTTP 200):
{
  "return_code": "SUCCESS",
  "unchanged": false,
  "token_valid": true,                 // boolean, false if a token was sent but holds no place (removed, or wrong room)
  "room": { "code": "KXBRT", "state": "open", "rounds_total": 6, "current_round": 2, "version": 18, "ended_early": false },
  "me": { "player_id": 42, "name": "Nan", "is_host": false },     // null on the TV or without a valid token
  "players": [ { "id": 41, "name": "Dad", "is_host": true, "submitted": true } ],
  "server_now": "2026-11-24T20:31:07.412Z",   // the database clock now, for working out the reveal's minute
  "round": {                           // null in the lobby
    "number": 2,
    "locked": false,
    "locked_at": null,                 // ISO datetime the round locked and its reveal began; null while open
    "fixtures": [
      {
        "id": 901,
        "home": { "id": 20, "name": "Hull", "short_name": "HUL", "form": ["W"] },
        "away": { "id": 1, "name": "Man City", "short_name": "MCI", "form": ["L"] },
        "result": null                 // { home_goals, away_goals, goals: [{ side, minute }] } once played
      }
    ],
    "my_predictions": { "901": 20 },   // fixture id -> predicted team id; {} on the TV
    "crowd": [                         // null until the round locks; then who predicted each side
      { "fixture_id": 901, "home": [41, 42], "away": [43] }   // player ids, removed players left out
    ]
  },
  "players_table": [ { "player_id": 41, "name": "Dad", "points": 13, "wins": 4, "predictions_made": 10, "round_points": 13, "position": 1 } ],
  "teams_table":   [ { "team_id": 20, "name": "Hull", "short_name": "HUL", "position": 1, "played": 1, "won": 1, "drawn": 0, "lost": 0, "gf": 2, "ga": 0, "gd": 2, "points": 3 } ]
}

Error Response (ALWAYS HTTP 200):
{
  "return_code": "ERROR_TYPE",
  "message": "Descriptive error message"
}
=======================================================================================================================================
Return Codes:
"SUCCESS"
"MISSING_FIELDS"        - code not given
"PARTY_NOT_FOUND"       - no live room with that code (never existed, or expired)
"RATE_LIMIT_EXCEEDED"   - more polling than any living room needs (server.js partyStateLimit)
"SERVER_ERROR"          - unexpected server error
=======================================================================================================================================
Business Logic:
- Results are only in the response for a round that has been played; before the lock they do not
  exist (§4.5). Effective ratings are never sent (§2).
- Other players' predictions (round.crowd) are sent only once the round has locked, for the
  one-match-at-a-time reveal; before the lock nobody sees anyone else's.
- known_version matching the room's version is answered from one indexed read, which is what makes
  polling from a whole living room cheap.
- Outside the general rate limiter (server.js): ten devices polling every two seconds would use up
  its 15-minute allowance in a few minutes. It has its own, sized for a room.
=======================================================================================================================================
*/

const express = require('express');
const { query } = require('../database');
const { logApiCall } = require('../utils/apiLogger');
const party = require('../services/mdParty');
const router = express.Router();

router.post('/', async (req, res) => {
  logApiCall('get-mdparty-state');
  try {
    const { code, player_token: token, known_version: knownVersion } = req.body;
    if (!code) return res.json({ return_code: 'MISSING_FIELDS', message: 'code is required' });

    const db = { query };
    const room = await party.findRoom(db, code);
    if (!room) return res.json({ return_code: 'PARTY_NOT_FOUND', message: 'No game with that code' });

    if (knownVersion !== undefined && Number(knownVersion) === room.version) {
      return res.json({ return_code: 'SUCCESS', unchanged: true, version: room.version });
    }

    const player = token ? await party.findPlayer(db, room.id, token) : null;
    const state = await party.buildState(db, room, player);

    return res.json({
      return_code: 'SUCCESS',
      unchanged: false,
      token_valid: token ? player !== null : true,
      ...state
    });
  } catch (error) {
    console.error('get-mdparty-state error:', error);
    return res.json({ return_code: 'SERVER_ERROR', message: 'Failed to load the game' });
  }
});

module.exports = router;
