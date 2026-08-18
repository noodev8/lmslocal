/*
=======================================================================================================================================
Script: email-sweep.js
=======================================================================================================================================
Purpose: Send every scheduled outline email to whoever currently qualifies, unattended.

         Until this existed every comms email was operator-driven: someone had to open
         lmslocal-admin, pick a type, read the count and press Send. That was deliberate while the
         rules were being settled, and it stops working the moment an email has a window narrower
         than the gap between visits - pick_reminder qualifies for twelve hours before a round
         locks, so an email nobody presses is an email that never goes.

         The Send button is NOT replaced. It stays the way to send something now, to a chosen
         competition, or to named people. This is what stops an email being forgotten.

WHICH EMAILS THIS SENDS is not decided here. It is the `cron` field on services/emailCatalog.js,
which holds a bucket name matching the argument below. An email without the field is not
scheduled, and today that is all of them - the machinery ships first and emails join one at a
time, each watched running before the next.

Usage:
  node scripts/email-sweep.js daily              # send
  node scripts/email-sweep.js daily --dry-run    # list who would get what, send nothing
  node scripts/email-sweep.js daily --test       # one sample per type to EMAIL_TEST_RECIPIENT

Crontab (server clock is GMT; comment the BST equivalent as elsewhere in the file):
  0 8 * * * cd /apps/production/lmslocal-server && /root/.nvm/versions/node/v22.17.0/bin/node scripts/email-sweep.js daily   # 09:00 BST

Once a day, because the button still exists: anything urgent gets pressed, and this is here so
nothing is forgotten rather than so everything is instant. If pick_reminder is ever scheduled it
will want a second bucket run twice - add it on the half hour, not on the hour, or the advisory
lock below will make one of the two runs skip.

Kill switch: EMAIL_CRON_ENABLED=false in .env stops every send without a deploy. --dry-run still
works while it is off, so the switch can be checked without turning it back on.
=======================================================================================================================================
*/

require('dotenv').config();
const { query, closePool } = require('../database');
const { entryFor, scheduledTypes, cronBuckets } = require('../services/emailCatalog');
const { sendTest, sendToAll } = require('../services/emailSweep');

const args = process.argv.slice(2);
const bucket = args.find((a) => !a.startsWith('--')) || null;
const isDryRun = args.includes('--dry-run');
const isTest = args.includes('--test');

/*
How many of one email type go out in a single run. The rest are not lost - they simply qualify
again tomorrow, because eligibility is live state rather than a list held anywhere.

It exists for the run nobody is watching. A rule change, a bad migration or a competition
imported in bulk could put hundreds of people into one candidate query, and the difference between
a button and a cron is that a button has somebody reading the number first. Fifty is high enough
that a normal day is never truncated - the largest candidate list on the platform when this was
written was four - and low enough that a wrong one is a mistake we can apologise for rather than a
domain reputation we have to rebuild.
*/
const SEND_CAP = Number(process.env.SWEEP_SEND_CAP || 50);

/*
A single lock for the whole script, not one per bucket.

Two sweeps running at once could both pass findCandidates before either writes a queue row, and
send the same person the same email twice - the once-ever guards read email_queue, so they only
protect against a run that has already finished. The window is small and the cost of losing that
bet is the one thing this system must never do.

pg_try_advisory_lock rather than a table: it is released automatically when the connection drops,
so a killed run cannot leave the next one blocked forever. The number is arbitrary but must not
collide with another advisory lock in the codebase; nothing else uses one today.
*/
const LOCK_KEY = 4820261;

/** Log one line with a consistent prefix, so a cron mail is greppable. */
const log = (msg) => console.log(`email-sweep: ${msg}`);

const run = async () => {
  const started = Date.now();
  const mode = isDryRun ? ' (DRY RUN)' : isTest ? ' (TEST)' : '';
  log(`=== ${bucket || 'no bucket'} ${new Date().toISOString()}${mode} ===`);

  if (!bucket) {
    console.error(`email-sweep: no bucket given. Usage: node scripts/email-sweep.js <bucket> [--dry-run] [--test]`);
    const known = cronBuckets();
    console.error(`email-sweep: buckets in use: ${known.length ? known.join(', ') : 'none - no email is scheduled yet'}`);
    await closePool().catch(() => {});
    process.exit(1);
  }

  /*
  Checked before the lock and before any query. An operator who has switched this off wants it off
  now, not after it has taken a lock and worked out who to mail.

  --dry-run is exempt on purpose: the reason to look while it is disabled is usually to decide
  whether it is safe to re-enable, and refusing to answer that question would push someone into
  turning it on to find out.
  */
  const enabled = (process.env.EMAIL_CRON_ENABLED || 'true').toLowerCase() !== 'false';
  if (!enabled && !isDryRun) {
    log('EMAIL_CRON_ENABLED is false - nothing sent.');
    await closePool();
    process.exit(0);
  }

  const types = scheduledTypes(bucket);

  if (types.length === 0) {
    const known = cronBuckets();
    log(`no email is scheduled in '${bucket}'${known.length ? `. Buckets in use: ${known.join(', ')}` : ' - nothing is scheduled at all yet'}.`);
    await closePool();
    process.exit(0);
  }

  let lockHeld = false;
  let totalSent = 0;
  let totalFailed = 0;

  try {
    if (!isDryRun) {
      const lock = await query('SELECT pg_try_advisory_lock($1) AS got', [LOCK_KEY]);
      lockHeld = lock.rows[0].got === true;

      if (!lockHeld) {
        // Not an error. The previous run is still going, and this one has nothing useful to add.
        log('another sweep is already running - skipping this run.');
        await closePool();
        process.exit(0);
      }
    }

    for (const emailType of types) {
      const entry = entryFor(emailType);

      /*
      Cannot normally happen - scheduledTypes reads the same object - but a cron is the wrong place
      to throw on a case like this. Report it and carry on with the other types, so one bad entry
      does not silence every email in the bucket.
      */
      if (!entry) {
        console.error(`email-sweep: ${emailType} is scheduled but not in the catalog - skipped.`);
        totalFailed++;
        continue;
      }

      /*
      No competition_id, ever. This is the caller send-emails.js was written for - a cron cannot
      pick a competition - so a scoped email sweeps every competition that qualifies.
      */
      const candidates = await entry.service.findCandidates();

      if (candidates.length === 0) {
        log(`${emailType}: nobody qualifies.`);
        continue;
      }

      if (isDryRun) {
        const shown = candidates.slice(0, 5)
          .map((c) => `${c.user_email}${c.competition_id ? ` (comp ${c.competition_id})` : ''}`)
          .join(', ');
        const capNote = candidates.length > SEND_CAP ? `, would send ${SEND_CAP} this run (cap)` : '';
        log(`${emailType}: ${candidates.length} candidate(s)${capNote} - ${shown}${candidates.length > 5 ? ', ...' : ''}`);
        continue;
      }

      if (isTest) {
        const result = await sendTest(entry, candidates[0]);
        if (result.success) {
          log(`${emailType}: test copy of ${candidates[0].user_email}'s email sent to the test address. ${candidates.length} real recipient(s) untouched.`);
        } else {
          console.error(`email-sweep: ${emailType} test send failed: ${result.error}`);
          totalFailed++;
        }
        continue;
      }

      const { sent, failed, attempted, capped } = await sendToAll(entry, candidates, { cap: SEND_CAP });
      totalSent += sent;
      totalFailed += failed;

      log(`${emailType}: ${candidates.length} candidate(s), ${sent} sent, ${failed} failed.`);

      if (capped) {
        console.warn(`email-sweep: ${emailType} was capped at ${SEND_CAP} of ${candidates.length}. The remaining ${candidates.length - attempted} qualify again next run - check why the list is this big.`);
      }
    }

    const secs = ((Date.now() - started) / 1000).toFixed(1);
    log(`done in ${secs}s - ${totalSent} sent, ${totalFailed} failed across ${types.length} email type(s).`);

    if (lockHeld) await query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]);
    await closePool();

    /*
    A failed send is reported but does not fail the run. The queue row records it, the address is
    not retried, and exiting non-zero would make cron mail about one bad address look identical to
    the database being down.
    */
    process.exit(0);

  } catch (error) {
    console.error('email-sweep FAILED:', error.message);
    if (lockHeld) await query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {});
    await closePool().catch(() => {});
    process.exit(1);
  }
};

run();
