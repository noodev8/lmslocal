/*
=======================================================================================================================================
Script: email-sweep.js
=======================================================================================================================================
Purpose: Send ONE outline email to whoever currently qualifies for it, unattended.

         Until this existed every comms email was operator-driven: someone had to open
         lmslocal-admin, pick a type, read the count and press Send. That was deliberate while the
         rules were being settled, and it stops working the moment an email has a window narrower
         than the gap between visits - pick_reminder qualifies for twelve hours before a round
         locks, so an email nobody presses is an email that never goes.

         The Send button is NOT replaced. It stays the way to send something now, to a chosen
         competition, or to named people. This is what stops an email being forgotten.

ONE EMAIL PER RUN, NAMED ON THE COMMAND LINE, and that is the whole of the configuration. There is
no schedule, flag or bucket anywhere in the codebase: an email is on the cron when it has a crontab
line, and off when that line is commented out. One place to look, and switching one off is a `#`
rather than an edit, a commit, a deploy and a restart.

The cost of that, accepted deliberately (2026-08-18): lmslocal-admin cannot show which emails are
scheduled, because the crontab lives on the VPS and the app cannot read it. A flag in the code to
drive that badge would be a SECOND switch that could disagree with the real one, and a screen
saying an email is running when it is not is worse than a screen that says nothing at all.
`crontab -l` is the answer instead.

Usage:
  node scripts/email-sweep.js empty_comp              # send
  node scripts/email-sweep.js empty_comp --dry-run    # list who would get it, send nothing
  node scripts/email-sweep.js empty_comp --test       # one sample to EMAIL_TEST_RECIPIENT

Crontab - one line per email, comment it out to switch that email off. Server clock is GMT, so
write the BST equivalent in the comment as elsewhere in the file:

  # 9:00 AM - chase organisers whose competition nobody has joined
  0 8 * * * cd /apps/production/lmslocal-server && /root/.nvm/versions/node/v22.17.0/bin/node scripts/email-sweep.js empty_comp >/dev/null

`>/dev/null` and NOT `2>&1`, deliberately. The redirect throws away the run summary - what went
out is recorded in Resend and on the admin Emails screen under Sent, which are better records than
cron mail nobody reads - while stderr still shouts. Given the buffering below, the only things that
can now produce output at all are a misspelt email type, a failed send and an outright crash, so
anything arriving is worth reading. Adding 2>&1 would make a typo in a crontab line fail silently
every day forever.

docs/email/email-cron-priority-order.txt holds the full block, in priority order, ready to paste.

NOTHING GUARDS AGAINST RUNNING IT TWICE, and nothing needs to. Every send writes an email_queue
row, and every candidate query excludes anyone who already has one - so a second run finds nobody.
That is what makes this safe to run as often as you like, in any order, by cron or by hand, and it
is why there is no lock and no state of its own here.

ORDER IN THE CRONTAB IS THE PRIORITY ORDER, and it is the only one - see services/emailQuiet.js.
Anyone emailed in the last 48 hours is marked as sent rather than emailed, so whichever email runs
first takes the collisions and the ones below it get whoever is left. Nothing is exempt, on purpose:
a priority field in the code would be a second way to say what this file's order already says.

NO TWO LINES IN THE SAME MINUTE. Two lines at the same minute run at the same time, and then
neither can see what the other sent - the rule is enforced by reading email_queue, and the row only
exists once the send has happened. The queue row is written BEFORE the Resend call, so any real gap
is enough; the same clock minute is not. Nothing else about the times is fixed - an email can run
several times a day, and the gaps need not be even.

OUTPUT IS SILENT UNLESS SOMETHING HAPPENED, so a daily run does not accumulate a log forever. See
the note by `log` below.
=======================================================================================================================================
*/

require('dotenv').config();
const { closePool } = require('../database');
const { entryFor, wiredTypes } = require('../services/emailCatalog');
const { sendTest, sendToAll } = require('../services/emailSweep');
const { findRecentlyEmailed } = require('../services/emailQuiet');

const args = process.argv.slice(2);
const emailType = args.find((a) => !a.startsWith('--')) || null;
const isDryRun = args.includes('--dry-run');
const isTest = args.includes('--test');

/*
SILENT WHEN NOTHING HAPPENED.

Run daily forever, a script that prints even one line per run accumulates output indefinitely -
and a log that is 99% "nobody qualified" is one nobody reads, which defeats the point of keeping
it. So a scheduled run that finds nothing to do prints NOTHING, and cron mails nothing.

Lines are buffered rather than printed as they happen, and flushed at the end only if something
worth reporting went in. `interactive` overrides that: --dry-run and --test exist to be watched,
and a person who typed the command and got no output would reasonably think it was broken.

Errors never buffer. They go straight to stderr, so a failure is loud whatever mode the run is in.
*/
const interactive = isDryRun || isTest;
const buffered = [];
let reported = false;

/** Queue a line, and mark the run as worth reporting. */
const log = (msg) => {
  buffered.push(`email-sweep: ${msg}`);
  reported = true;
};

/** Queue a line WITHOUT making the run worth reporting on its own. */
const note = (msg) => buffered.push(`email-sweep: ${msg}`);

/** Print the buffer, if this run earned it. */
const flush = () => {
  if (reported || interactive) buffered.forEach((line) => console.log(line));
};

const run = async () => {
  const started = Date.now();
  const mode = isDryRun ? ' (DRY RUN)' : isTest ? ' (TEST)' : '';
  // A header on its own is not news - note, not log - so a quiet run stays silent.
  note(`=== ${emailType || 'no email'} ${new Date().toISOString()}${mode} ===`);

  /*
  A missing or unknown name is a mistake in the crontab, so it goes to stderr and exits non-zero -
  loud every day until somebody fixes it. Listing the real names is the useful half: what this
  catches is almost always a typo, or an email whose key was renamed with the crontab left behind.
  */
  if (!emailType) {
    console.error('email-sweep: no email named. Usage: node scripts/email-sweep.js <email_type> [--dry-run] [--test]');
    console.error(`email-sweep: wired emails: ${wiredTypes().join(', ')}`);
    await closePool({ quiet: true }).catch(() => {});
    process.exit(1);
  }

  const entry = entryFor(emailType);

  if (!entry) {
    console.error(`email-sweep: '${emailType}' is not a wired email.`);
    console.error(`email-sweep: wired emails: ${wiredTypes().join(', ')}`);
    await closePool({ quiet: true }).catch(() => {});
    process.exit(1);
  }

  try {
    /*
    No competition_id, ever. This is the caller routes/admin/send-emails.js was written for - a
    cron cannot pick a competition - so a scoped email sweeps every competition that qualifies.
    */
    const candidates = await entry.service.findCandidates();

    if (candidates.length === 0) {
      // The overwhelmingly common case, and the reason for the buffering above.
      note('nobody qualifies.');
      flush();
      await closePool({ quiet: true });
      process.exit(0);
    }

    if (isDryRun) {
      /*
      Marks each candidate magic send would decline, because the count on its own is the number
      BEFORE the 48-hour rule and a dry run exists to show what a real run would do. Read live here
      rather than reusing a send-time value: this branch never calls sendToAll.

      It is a snapshot and says so. Anything sent between this run and the real one moves people
      into the quiet period, and within a real run the set grows as it sends.
      */
      const quiet = await findRecentlyEmailed();
      const quietCount = candidates.filter((c) => quiet.has(c.user_id)).length;
      const shown = candidates
        .map((c) => `${quiet.has(c.user_id) ? '[48h] ' : '      '}${c.user_email}${c.competition_id ? ` (comp ${c.competition_id})` : ''}`)
        .join('\n  ');
      log(`${candidates.length} candidate(s), ${quietCount} would be marked as sent [48h]:\n  ${shown}`);

    } else if (isTest) {
      const result = await sendTest(entry, candidates[0]);
      if (result.success) {
        log(`test copy of ${candidates[0].user_email}'s email sent to the test address. ${candidates.length} real recipient(s) untouched.`);
      } else {
        console.error(`email-sweep: test send failed: ${result.error}`);
      }

    } else {
      const { sent, failed, skipped } = await sendToAll(entry, candidates);
      log(`${candidates.length} candidate(s), ${sent} sent, ${skipped} marked as sent (emailed inside 48h), ${failed} failed.`);
    }

    note(`done in ${((Date.now() - started) / 1000).toFixed(1)}s.`);
    flush();
    await closePool({ quiet: true });

    /*
    A failed send is reported but does not fail the run. The queue row records it, the address is
    not retried, and exiting non-zero would make cron mail about one bad address look identical to
    the database being down.
    */
    process.exit(0);

  } catch (error) {
    // Buffered context first, so the failure arrives with whatever got as far as being attempted.
    buffered.forEach((line) => console.error(line));
    console.error('email-sweep FAILED:', error.message);
    await closePool({ quiet: true }).catch(() => {});
    process.exit(1);
  }
};

run();
