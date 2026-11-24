/*
=======================================================================================================================================
Script: prune-party-rooms.js
=======================================================================================================================================
Purpose: Delete Matchday Party rooms past their expiry (docs/matchday-party.md §7). A party is one
         evening; keeping it after that only fills the production database with finished games.

         One DELETE: every party table below party_room cascades from it (see the migration,
         db/migrations/2026-11-24-matchday-party.sql), so a room takes its players, rounds,
         fixtures, coupons and predictions with it. party_team is never touched.

Usage:
  node scripts/prune-party-rooms.js              # delete and report
  node scripts/prune-party-rooms.js --dry-run    # report what would go, delete nothing

Crontab (server clock is GMT; comment the BST equivalent as elsewhere in the file):
  50 3 * * * cd /apps/production/lmslocal-server && /root/.nvm/versions/node/v22.17.0/bin/node scripts/prune-party-rooms.js   # 04:50 BST

Expired rooms are already invisible to every route (services/party.js findRoom), so a missed run
costs disk space and nothing else.
=======================================================================================================================================
*/

require('dotenv').config();
const { query, closePool } = require('../database');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const due = await query('SELECT COUNT(*)::int AS n FROM party_room WHERE expires_at <= NOW()');
  const count = due.rows[0].n;

  if (dryRun) {
    console.log(`[prune-party-rooms] dry run: ${count} expired room(s) would be deleted`);
    return;
  }
  const result = await query('DELETE FROM party_room WHERE expires_at <= NOW()');
  console.log(`[prune-party-rooms] deleted ${result.rowCount} expired room(s)`);
}

main()
  .catch((error) => {
    console.error('[prune-party-rooms] failed:', error);
    process.exitCode = 1;
  })
  .finally(() => closePool());
