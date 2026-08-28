/*
=======================================================================================================================================
Script: prune-email-send-log.js
=======================================================================================================================================
Purpose: Delete email_send_log rows older than the retention window.

         email_send_log takes one row per provider call, written inside deliver(). Nothing else
         bounds it: unlike join_block, whose rate strangers control, this one grows at exactly the
         rate the product succeeds. At 500k emails a month it is roughly 6 million rows and a
         gigabyte a year, measured at 174 bytes a row.

Usage:
  node scripts/prune-email-send-log.js              # delete and report
  node scripts/prune-email-send-log.js --dry-run    # report what would go, delete nothing

Crontab (server clock is GMT; comment the BST equivalent as elsewhere):
  50 3 * * * cd /apps/production/lmslocal-server && /root/.nvm/versions/node/v22.17.0/bin/node scripts/prune-email-send-log.js   # 04:50 BST

Five minutes after prune-join-blocks so the two never contend, and separate from it for the same
reason that one is separate from sync-competition-status: a failure here should take nothing else
down with it.

WHY 90 DAYS

Long enough to span the SES migration's phase 4 and 5 - marketing moves to SES while transactional
stays on Resend, and phase 5's decision is only taken after a full campaign cycle. Both providers
therefore have to still be in the table when that comparison is made, which is what the `provider`
column exists for. 90 days holds about 1.5 million rows at 500k a month, a quarter of a gigabyte.

WHAT IS LOST, SAID PLAINLY

Deleting a row throws away the only record that some emails ever existed. Queued mail is also on
email_queue and email_tracking, and password reset and verification also write audit_log - but the
Stripe payment confirmation, the contact form and onboarding are recorded HERE AND NOWHERE ELSE.
After 90 days "did his receipt go out in June?" stops having an answer. That is the accepted trade,
not an oversight; if long-term volume history is wanted later, aggregate before pruning rather than
extending this window forever.
=======================================================================================================================================
*/

require('dotenv').config();
const { query, closePool } = require('../database');

const RETENTION_DAYS = 90;
const isDryRun = process.argv.slice(2).includes('--dry-run');

const run = async () => {
  console.log(`=== prune-email-send-log ${new Date().toISOString()}${isDryRun ? ' (DRY RUN)' : ''} ===`);

  try {
    if (isDryRun) {
      const preview = await query(`
        SELECT COUNT(*) AS doomed,
               MIN(sent_at) AS oldest
        FROM   email_send_log
        WHERE  sent_at < NOW() - ($1 || ' days')::interval
      `, [RETENTION_DAYS]);

      const { doomed, oldest } = preview.rows[0];
      console.log(`Would delete ${doomed} row(s) older than ${RETENTION_DAYS} days.`);
      if (Number(doomed) > 0) console.log(`Oldest is ${new Date(oldest).toISOString()}.`);
    } else {
      const result = await query(`
        DELETE FROM email_send_log
        WHERE sent_at < NOW() - ($1 || ' days')::interval
      `, [RETENTION_DAYS]);

      console.log(`Deleted ${result.rowCount} row(s) older than ${RETENTION_DAYS} days.`);
    }

    /*
    Reported per provider, not as one total. Through phases 4 and 5 of the SES migration the two
    run side by side, and "1.4m rows remain" would hide the only thing worth seeing here - whether
    the stream that moved is actually sending.
    */
    const remaining = await query(`
      SELECT provider, COUNT(*) AS total
      FROM email_send_log
      GROUP BY provider
      ORDER BY provider
    `);

    if (remaining.rows.length === 0) {
      console.log('0 row(s) remain.');
    } else {
      for (const row of remaining.rows) {
        console.log(`${row.total} row(s) remain on ${row.provider}.`);
      }
    }

    await closePool();
    process.exit(0);

  } catch (error) {
    console.error('prune-email-send-log FAILED:', error.message);
    await closePool().catch(() => {});
    process.exit(1);
  }
};

run();
