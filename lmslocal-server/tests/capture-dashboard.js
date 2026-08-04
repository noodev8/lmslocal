/*
=======================================================================================================================================
Equivalence harness: get-user-dashboard
=======================================================================================================================================
Purpose: Capture the full JSON response of /get-user-dashboard for a set of users
         chosen to cover the route's branches, so a refactor can be proved to
         change nothing. Run once before a change and once after, then diff.

Usage:
  # terminal 1 - a server on a port that is not your dev server
  PORT=3016 node server.js

  # terminal 2
  node tests/capture-dashboard.js baseline     # before the change
  node tests/capture-dashboard.js after        # after the change
  node tests/compare.js baseline after         # byte-for-byte diff

Output goes to tests/captures/<label>/user-<id>.json (git-ignored).

SAFETY: get-user-dashboard writes as well as reads - it clears a competition's
invite_code once Round 1 has locked. Before capturing, check that no competition
is eligible, or the first run will mutate data and the second will not:

  node db/query.js "SELECT c.id, r1.lock_time <= NOW() AS would_be_cleared
                    FROM competition c
                    JOIN round r1 ON r1.competition_id = c.id AND r1.round_number = 1
                    WHERE c.invite_code IS NOT NULL"

Every row must read false.
=======================================================================================================================================
*/

const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const LABEL = process.argv[2];
if (!LABEL) {
  console.error('usage: node tests/capture-dashboard.js <label>');
  process.exit(1);
}

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3016';
const OUT = path.join(__dirname, 'captures', LABEL);
fs.mkdirSync(OUT, { recursive: true });

/*
 * Each user exercises a different branch. Re-check these ids if the data moves
 * on - the harness is only as good as its coverage, and a diff of two empty
 * responses proves nothing. The run prints history row counts so a trivial
 * sample is obvious.
 */
const USERS = [
  { id: 1003, why: 'organiser(2) + participant(2), 7 rounds, one COMPLETE - richest case' },
  { id: 1015, why: 'pure participant, 7 rounds, COMPLETE competition' },
  { id: 915,  why: 'organiser of an ACTIVE competition, also a participant' },
  { id: 918,  why: 'participant in an ACTIVE competition' },
  { id: 1041, why: 'organiser with 2 competitions' },
  { id: 42,   why: 'no competitions at all - empty arrays' },
  { id: 50,   why: 'designated test organiser' }
];

// Sort keys so a diff reflects real changes rather than property ordering
const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, k) => {
      acc[k] = stable(value[k]);
      return acc;
    }, {});
  }
  return value;
};

(async () => {
  for (const user of USERS) {
    const token = jwt.sign(
      { user_id: user.id, email: `harness-${user.id}@local`, display_name: 'harness' },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    let body;
    try {
      const res = await fetch(`${BASE}/get-user-dashboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({})
      });
      body = await res.json();
    } catch (err) {
      body = { harness_error: String(err) };
    }

    fs.writeFileSync(path.join(OUT, `user-${user.id}.json`), JSON.stringify(stable(body), null, 2));

    // Report how much data each response actually carried, so a sample that
    // proves nothing is visible rather than silently passing
    const comps = Array.isArray(body.competitions) ? body.competitions : [];
    const historyRows = comps.reduce((n, c) => n + (c.history || []).length, 0);

    console.log(
      `user ${String(user.id).padEnd(5)} ${String(body.return_code).padEnd(8)} ` +
      `competitions=${String(comps.length).padEnd(3)} historyRows=${String(historyRows).padEnd(3)} ${user.why}`
    );
  }

  console.log(`\nwritten to tests/captures/${LABEL}/`);
})();
