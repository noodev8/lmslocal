/*
=======================================================================================================================================
Script: sync-competition-status.js
=======================================================================================================================================
Purpose: Promote competitions from SETUP to ACTIVE once their Round 1 lock time has passed.
         Run nightly by cron. Corrects a reporting column only - nothing that decides whether a
         player may join reads it. See docs/player-onboarding.md §4.2.
Usage:
  node scripts/sync-competition-status.js              # promote and report
  node scripts/sync-competition-status.js --dry-run    # report what would change, change nothing

Crontab (server clock is GMT; comment the BST equivalent as elsewhere in the file):
  30 3 * * * cd /apps/production/lmslocal-server && /root/.nvm/versions/node/v22.17.0/bin/node scripts/sync-competition-status.js   # 04:30 BST

Exits non-zero on failure so a wrapper or cron mail surfaces the problem. A quiet run printing
"nothing to promote" is the normal case, not a fault - most nights there is nothing to do.
=======================================================================================================================================
*/

require('dotenv').config();
const { query, closePool } = require('../database');
const { syncCompetitionStatus } = require('../services/competitionStatus');

const isDryRun = process.argv.slice(2).includes('--dry-run');

const run = async () => {
  const startedAt = new Date();
  console.log(`=== sync-competition-status ${startedAt.toISOString()}${isDryRun ? ' (DRY RUN)' : ''} ===`);

  try {
    let promoted;

    if (isDryRun) {
      // Same predicate as the real thing, without the write, so a dry run cannot
      // report something the live call would not have done.
      const preview = await query(`
        SELECT c.id AS competition_id, c.name, r.lock_time
        FROM   competition c
        JOIN   round r ON r.competition_id = c.id
        WHERE  r.round_number = 1
          AND  r.lock_time <= CURRENT_TIMESTAMP
          AND  c.status = 'SETUP'
      `);
      promoted = preview.rows;
    } else {
      promoted = await syncCompetitionStatus();
    }

    if (promoted.length === 0) {
      console.log('Nothing to promote.');
    } else {
      console.log(`${isDryRun ? 'Would promote' : 'Promoted'} ${promoted.length} competition(s):`);
      promoted.forEach(c => {
        console.log(`  - ${c.competition_id} ${c.name} (Round 1 locked ${new Date(c.lock_time).toISOString()})`);
      });
    }

    await closePool();
    process.exit(0);

  } catch (error) {
    console.error('sync-competition-status FAILED:', error.message);
    await closePool().catch(() => {});
    process.exit(1);
  }
};

run();
