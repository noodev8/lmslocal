# Email operations

What we send, and in what priority, is the `OUTLINE` array in
`lmslocal-admin/src/app/dashboard/emails/page.tsx` (it is the admin Emails screen). Which emails
are wired is `lmslocal-server/services/emailCatalog.js`. Each email's eligibility rules and their
reasoning are in the header and `findCandidates` of its service in `lmslocal-server/services/`.

## Sending

- **Admin → Emails**, or **`node scripts/email-sweep.js <email_type>`** on the VPS crontab. Both go
  through `sendToAll` in `services/emailSweep.js` and re-derive candidates on every run.
- The crontab block, in priority order, is `docs/email/email-cron-priority-order.txt`. No two lines
  in the same minute — the 48-hour quiet check cannot see a send that has not happened yet.
- **Never send outside this pipeline.** No one-off scripts with their own Resend client: they skip
  opt-outs and the unsubscribe footer. A bulk send is a new candidate query + catalog entry, built
  like `services/pickReminder.js`.

## Test mode

Every email leaves through `deliver()` in `services/emailService.js`. `{ testMode: true }`
redirects to `EMAIL_TEST_RECIPIENT` and prefixes the subject `[TEST]`. `deliver` defaults to
**live** (a redirected password reset is a broken product); the admin screen sends the flag on
every request, and `/admin/send-emails` treats an absent `test_mode` as true.

## Environment (`lmslocal-server/.env`)

`RESEND_API_KEY`, `EMAIL_FROM` (must be on the Resend-verified domain, so a noreply address),
`EMAIL_NAME`, `EMAIL_REPLY_TO` (where replies land — `deliver()` sets it unless the caller did),
`EMAIL_TEST_RECIPIENT`.

## Footer

`buildEmailFooter(unsubscribeUrl)` in `emailService.js` is the shared footer. It carries the legal
sender identification (company name, number, address); pass `null` for transactional mail to omit
the unsubscribe link. The company details are duplicated in
`lmslocal-web/src/components/public/PublicFooter.tsx` — change both.

## Legacy queue routes

`/load-pick-reminder`, `/load-results-email`, `/load-competition-announcement` and `/send-email`
(service-token routes writing to and draining `email_queue`) are still registered in `server.js`
but are not the way email is sent. Use the sweep.
