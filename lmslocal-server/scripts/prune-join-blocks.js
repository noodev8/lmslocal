/*
=======================================================================================================================================
Script: prune-join-blocks.js
=======================================================================================================================================
Purpose: Delete join_block rows older than the retention window.

         join_block is written from a PUBLIC, UNAUTHENTICATED endpoint, so without this it grows
         forever at a rate strangers control. The write path collapses repeats inside a short
         window, which bounds the rate, but nothing bounds the total.

Usage:
  node scripts/prune-join-blocks.js              # delete and report
  node scripts/prune-join-blocks.js --dry-run    # report what would go, delete nothing

Crontab (server clock is GMT; comment the BST equivalent as elsewhere in the file):
  45 3 * * * cd /apps/production/lmslocal-server && /root/.nvm/versions/node/v22.17.0/bin/node scripts/prune-join-blocks.js   # 04:45 BST

Kept separate from sync-competition-status.js on purpose: that script's name says what it does,
and a prune failure should not take the status sync down with it.

Retention is 90 days while the dashboard only looks back 7. The extra is deliberate - it costs
almost nothing and means "how often does this actually happen?" can still be answered later
instead of having thrown the evidence away.
=======================================================================================================================================
*/

require('dotenv').config();
const { query, closePool } = require('../database');

const RETENTION_DAYS = 90;
const isDryRun = process.argv.slice(2).includes('--dry-run');

const run = async () => {
  console.log(`=== prune-join-blocks ${new Date().toISOString()}${isDryRun ? ' (DRY RUN)' : ''} ===`);

  try {
    if (isDryRun) {
      const preview = await query(`
        SELECT COUNT(*) AS doomed,
               MIN(occurred_at) AS oldest
        FROM   join_block
        WHERE  occurred_at < NOW() - ($1 || ' days')::interval
      `, [RETENTION_DAYS]);

      const { doomed, oldest } = preview.rows[0];
      console.log(`Would delete ${doomed} row(s) older than ${RETENTION_DAYS} days.`);
      if (Number(doomed) > 0) console.log(`Oldest is ${new Date(oldest).toISOString()}.`);
    } else {
      const result = await query(`
        DELETE FROM join_block
        WHERE occurred_at < NOW() - ($1 || ' days')::interval
      `, [RETENTION_DAYS]);

      console.log(`Deleted ${result.rowCount} row(s) older than ${RETENTION_DAYS} days.`);
    }

    const remaining = await query('SELECT COUNT(*) AS total FROM join_block');
    console.log(`${remaining.rows[0].total} row(s) remain.`);

    await closePool();
    process.exit(0);

  } catch (error) {
    console.error('prune-join-blocks FAILED:', error.message);
    await closePool().catch(() => {});
    process.exit(1);
  }
};

run();
