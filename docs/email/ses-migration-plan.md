# Moving email to Amazon SES — a plan to review, not a decision

**Status: proposal. Nothing here is agreed and nothing has been built.** Written 2026-08-28 so
there is something concrete to say yes or no to on a named date, rather than re-deriving the
argument every time the Resend bill comes up.

**This does not change `docs/email/README.md`.** That file describes what we actually send and how
it is wired. If any of this is ever built, that is when the README changes.

---

## 1. Why this exists

The email exit point was deliberately built so a change of provider is one function. From
`services/emailService.js`:

> This is now the ONLY place in the codebase that constructs a Resend client or calls
> `resend.emails.send`, which is what makes a change of provider one function rather than a
> search. Keep it that way.

That was the right call and it holds. But "one function" describes the *send call*, not the
migration. The rest of this file is the rest of the migration.

### The money

| Volume/month | Resend | SES (@ $0.10 per 1,000) | Saving/year |
|---|---|---|---|
| 3k (free tier) | $0 | ~$0.30 | nothing |
| 50k | $20 (Pro) | ~$5 | ~$180 |
| 100k | $35 (Pro) | ~$10 | ~$300 |
| 500k (the target) | several hundred | ~$50 | thousands |

The Resend figure above 100k is not researched — check the Scale ladder before quoting it. The
shape is what matters: **the saving is trivial until it suddenly isn't.**

### The thing that argues for going sooner than the money does

**Sender reputation does not transfer between providers.** A new sending domain on SES starts at
zero and has to be warmed by ramping volume gradually over weeks. Doing that at 20k/month is
routine. Doing it at 400k/month, mid-season, with pick reminders on the line, is not.

So the cost of waiting is not the Resend bill. It is that the migration gets harder exactly as it
gets more worthwhile.

---

## 2. What we found when we looked

Read from the code and the production database on 2026-08-28.

- **`deliver()` (`services/emailService.js:87`) is genuinely the only exit.** Confirmed — one
  `new Resend()` at line 30, two `resend.emails.send` calls inside `deliver()`, nothing else.
- **`readSendResult()` already normalises the provider response** into
  `{ success, messageId, suppressed, error }`. Callers do not read Resend's shape directly. This
  is most of an adapter already.
- **`email_tracking` has 736 rows, and 0 bounces, 0 complaints, 0 opens.** The columns
  `bounce_type`, `resend_event_data` and `opened_at` exist and are entirely unpopulated.
- **There is no email webhook route.** `routes/` has `stripe-webhook.js` and nothing equivalent
  for email. Nothing consumes Resend's delivery events.
- **There is no suppression list.** `app_user` has `email_verified`, `email` and
  `unsubscribe_token` — no bounce or complaint state anywhere.
- Sending is from `EMAIL_FROM=noreply@email.noodev8.com`, one domain, both streams.
- `List-Unsubscribe` and `X-Entity-Ref-ID` headers are already set on the templated senders.

### The finding that reorders the plan

**We do not currently handle bounces or complaints at all.** Resend absorbs them silently, so
this has never hurt. On SES it would be fatal: AWS holds you to a bounce rate under ~5% and a
complaint rate under ~0.1%, measures it themselves, and suspends accounts that exceed it.

So the work is not "port bounce handling to SES". It is "build bounce handling, which we have
never had". That is the bulk of the effort, it is provider-independent, and **it has standalone
value on Resend today** — right now a dead address is retried forever and quietly drags the
domain's reputation down.

That is why phase 1 below is not gated on the SES decision.

---

## 3. The plan

Five phases. Phases 1 and 2 are worth doing whatever is decided about SES; they are the ones that
make the decision cheap and reversible. Phases 3 to 5 are the migration proper.

### Phase 0 — Unblock the present (now, ~1 hour)

Not part of the migration; listed because it is the thing actually hurting today.

- Resend free tier is 3,000/month, **100/day**, **one verified domain**. Pick reminders are being
  pruned on game days to stay under it. That is the product being degraded to save $20.
- Take Resend Pro ($20/month, 50k emails, unlimited domains) **on an account owned by LMSLocal**,
  not under noodev8.
- Verify `mail.lmslocal.co.uk` (transactional) and `news.lmslocal.co.uk` (marketing) — DKIM, SPF,
  DMARC on the parent. `lmslocal.co.uk` itself is untouched and keeps serving the site.
- Add `EMAIL_FROM_TRANSACTIONAL` and `EMAIL_FROM_MARKETING`; `deliver()` picks by stream.

**Why this is not wasted money if SES happens anyway**: the domain split is provider-independent,
and phase 4 migrates one stream at a time — which needs two streams to exist first.

### Phase 1 — Bounce and complaint handling, on Resend (now, ~1 day)

Independently valuable. Do it whether or not SES ever happens.

- New route `routes/email-webhook.js` (POST, returns 200 with `return_code` like everything else,
  signature-verified). Register in `server.js`.
- Consume Resend's `email.bounced`, `email.complained`, `email.delivered`, `email.opened` events.
  Correlate on the message id already stored in `email_tracking.resend_message_id`, falling back to
  the `X-Entity-Ref-ID` header that the senders already set.
- New table `email_suppression` — `email`, `reason` (`hard_bounce` / `complaint` /
  `manual`), `created_at`, `source`. One row per dead address, provider-independent by design.
- `deliver()` checks it **beside the existing opt-out check**, at the same point and for the same
  reason: it is a promise about send time, not queue time. Suppressed returns the existing
  `{ suppressed: true }` shape so `readSendResult()` and every caller already handle it.
  Distinguish the reason so a bounce is not reported as an unsubscribe.
- Hard bounces and complaints suppress permanently. Soft bounces do not suppress — count them, and
  suppress only after N consecutive.

**Test it while free and quiet.** This is exactly the phase that benefits from low volume: a
handful of real events a day is a readable log, not a firehose.

### Phase 2 — A provider adapter behind `deliver()` (~half a day)

No behaviour change. The point is to make phase 4 a config flip rather than a rewrite.

- New `services/emailProviders/resend.js` and `.../ses.js`, each exporting one
  `send(payload) -> { messageId, error }`.
- `deliver()` keeps everything it currently does — the opt-out check, the suppression check, the
  reply-to default, test mode — and hands the finished payload to whichever provider the stream
  selects. **All the policy stays in `deliver()`; the adapters only speak to an API.**
- Selection by env var per stream, e.g. `EMAIL_PROVIDER_TRANSACTIONAL=resend`,
  `EMAIL_PROVIDER_MARKETING=resend`. Per stream, not global — phase 4 depends on it.
- `readSendResult()` becomes provider-agnostic; the adapter returns the normalised shape and
  `deliver()` stops knowing about `result.data.id`.
- **Rename `email_tracking.resend_message_id` to `provider_message_id`** with a migration, and add
  `provider`. The current name becomes a lie the moment anything sends via SES.

Ship this with SES unconfigured. It is a refactor with the existing behaviour intact.

### Phase 3 — Stand SES up, send nothing real (~half a day)

- AWS account, SES in `eu-west-1` or `eu-west-2` (UK/EU recipients, and it keeps data in-region).
- Verify `news.lmslocal.co.uk` first — DKIM via the three CNAMEs SES gives you, plus a custom
  MAIL FROM subdomain for SPF alignment.
- **Request production access** (exit the sandbox). This is a support ticket AWS reviews, not a
  checkbox, and it asks how you handle bounces and complaints — which phase 1 lets you answer
  truthfully. Allow days, not minutes. In the sandbox you get 200/day to verified addresses only,
  which is plenty for testing.
- A **configuration set** with an SNS destination for bounce, complaint, delivery and reject
  events, pointing at the same `email-webhook` route from phase 1 (a second handler for SNS's
  envelope format, including subscription confirmation).
- IAM user scoped to `ses:SendEmail` on that identity only. Credentials in `.env`, never hardcoded
  — new variables: `AWS_SES_REGION`, `AWS_SES_ACCESS_KEY_ID`, `AWS_SES_SECRET_ACCESS_KEY`,
  `AWS_SES_CONFIGURATION_SET`.
- **Test with the SES mailbox simulator**, which is the reason this phase is cheap now:
  `bounce@simulator.amazonses.com`, `complaint@simulator.amazonses.com`,
  `success@simulator.amazonses.com` generate real events without touching a real inbox or your
  reputation. Prove the whole suppression loop end to end before a single customer email goes
  through it.

### Phase 4 — Move the marketing stream only (~2 weeks, mostly waiting)

- Flip `EMAIL_PROVIDER_MARKETING=ses`. Transactional stays on Resend, untouched.
- Warm `news.lmslocal.co.uk` by ramping — small sends, growing over days, watching the SES
  reputation dashboard.
- **Marketing is the stream where failure is survivable.** A campaign landing in spam costs a
  campaign. A pick reminder landing in spam costs the game. Learn SES where the blast radius is
  small.

### Phase 5 — Decide about the transactional stream (later, and separately)

Only once phase 4 has run for a full campaign cycle with a clean bounce and complaint rate. This
is a second decision, not the tail of the first — it is entirely reasonable to end up permanently
split: marketing on SES for volume, transactional on Resend for the dashboard and the support when
something goes wrong at 7am on a Saturday.

---

## 4. Known gotchas — check these before committing

Flagged rather than solved. Each is a real risk of the estimate being wrong.

- **Custom headers.** SES v2's `Simple` content has historically been awkward about arbitrary
  headers, and we set both `X-Entity-Ref-ID` and `List-Unsubscribe`. If they cannot be set on the
  simple API, the adapter must build raw MIME instead — which is a meaningfully bigger job.
  **Verify this first; it is the single most likely thing to blow the estimate.**
- **Tag values.** SES `EmailTags` allows only alphanumerics, `-` and `_`. Our Resend tags carry
  `email_type` and `competition_id`, which look safe, but the adapter should validate rather than
  assume.
- **Gmail and Yahoo bulk sender rules.** Above 5,000 messages a day to Gmail you must have
  one-click `List-Unsubscribe` (`List-Unsubscribe-Post`, not just the mailto), aligned DMARC, and
  a spam rate under 0.3%. At the 500k/month target that is ~16k/day — **comfortably over the
  threshold**. Worth auditing on Resend now, since it applies there too.
- **No dashboard.** Resend's log is currently how email gets debugged. SES gives you CloudWatch
  metrics and whatever you build. Budget for that loss, or keep transactional on Resend (phase 5).
- **`email_queue` and `email_tracking` both exist** and their relationship was not examined for
  this plan. Check before the phase 2 migration.

---

## 5. The decision

**Phases 0, 1 and 2 are not part of the decision.** They are worth doing regardless: phase 0 stops
the product being degraded, phase 1 fixes a real gap we have today, phase 2 is a refactor that
makes every later option cheap. If nothing else in this file ever happens, those three still
should.

**Review date for phases 3–5: _____________** (to be set by Andreas).

Suggestion: a fixed date rather than a volume trigger, because volume triggers get noticed late.
**31 January 2027** would put it after the busiest stretch of the season with real numbers in hand.

Decide **go** if, on that date:

- monthly volume is past 50k and visibly climbing, **and**
- phases 1 and 2 are done and the suppression loop is demonstrably working, **and**
- the header question in §4 has been answered and did not turn into raw MIME, **and**
- there is a two-week window with no competing deadline for the warm-up.

Decide **wait** otherwise. Waiting costs the Resend bill, which at these volumes is $20–35/month
and not a reason to rush a migration during the season.

---

## 6. Explicitly not concluded

- Whether SES happens at all.
- Whether the transactional stream ever leaves Resend, or the split becomes permanent.
- The Resend Scale-tier cost above 100k/month. Unresearched (§1).
- Whether custom headers work on SES v2 `Simple` content (§4). Unverified, and the estimate
  depends on it.
- Any effort figure above. They are guesses from reading the code, not from doing the work.
