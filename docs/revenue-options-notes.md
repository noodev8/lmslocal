# Revenue options — working notes

**Status: scratch. Not authoritative, not a decision record, safe to delete.**

Started 2026-08-24 from a conversation between Andreas and Claude about whether advertising
could fund LMSLocal alongside organiser credits. Revised 2026-08-25 once Andreas answered the
open questions, and again **2026-08-28** after a conversation about sponsorship, club
fundraising and email volume. Nothing here has been built.

It exists so the next session does not have to redo the arithmetic. `docs/marketing-strategy.md`
is who we sell to and what we say; this is where the money would come from.

**Standing position (2026-08-28): none of this is being built now.** The priority is features
and getting players into competitions. This file is for when there is traction to monetise, not
a backlog. The one exception is the email domain question in §6, which is cheap now and
awkward later.

---

## 1. The angle that changed the shape of this

Andreas's stated market is **clubs raising money** — grassroots sports clubs, social clubs,
schools, charities running a season-long fundraiser. Not primarily pubs, though pubs come along
with it. `/help/fundraising` already argues this case on the site.

That matters more than it first looks, because it decides most of the questions below for us:

- **It argues against betting advertising**, harder than the compliance cost alone does. A club
  treasurer choosing a fundraising tool for a junior football section will not choose one with a
  bookmaker's logo on the join page. The audience that makes the fundraising angle work is the
  audience most repelled by the ad that pays best.
- **It argues for sponsorship**, strongly. Clubs already have sponsors — shirt sponsors, ground
  boards, matchday programmes. Selling a local business a slot is something club committees do
  every season and already know how to price. We would not be teaching a new behaviour, we would
  be adding one more slot to a list they already sell.
- **It argues for per-season rather than per-lifetime pricing.** A club's cycle is a season. See
  §3.

**Market size is unresearched.** The UK has on the order of a hundred thousand-plus grassroots
sports clubs and a similar order of registered charities, but those are recalled figures, not
sourced ones, and "has a committee that would run a season-long online competition" is a much
smaller subset. If this angle becomes the plan, size it properly first.

---

## 2. Where things stand

1. **The free tier is not locked, anywhere, and never was.** `/terms` says we may change prices
   or introduce new charges with 30 days notice to existing customers, and §13 lets us modify the
   terms at any time. **Nothing here is time-critical.**
2. **We carry no advertising.** Not a rejection on principle; not worth the compliance apparatus
   at current scale.
3. **Gambling advertising is undecided, leaning out** (2026-08-28). Andreas's view: it could be
   the single biggest earner, but dropping it avoids the whole compliance apparatus *and* keeps
   the club market open, which is the growth story. Not closed off, but nothing is being built
   toward it and the reasons to say no are currently stronger than the money.
4. **We deliberately do not collect date of birth**, or ask for 18+ confirmation. Registration is
   kept frictionless while the user base grows. See §7 for why that is cheaper to reverse than it
   looks.
5. **`/help/is-it-gambling` is approved and live.**

### Still open

- What the free tier should be once there is scale to price against. Not answerable at 27
  organisers.
- Whether sponsorship is ever built, and if so whether it is a paid feature, a tier, or bundled.

### Worth knowing, not worth acting on

The marketing copy promises more than the terms do. Eight live places say the free places are
**"yours for good"** or free **"for as long as you run it"**: `pricing/page.tsx`,
`pricing/layout.tsx` (×2), `SiteSchema.tsx`, `layout.tsx` (meta, ×3), `page.tsx`,
`help/faq/page.tsx`, `register/page.tsx`. The terms govern, so this is not a legal exposure — but
if the tier is ever reduced, that copy is what people will quote back. Change it *before* a
reduction rather than alongside one.

---

## 3. The arithmetic

Read from the production database on **2026-08-24**. Stale quickly; re-run before relying on it.

| | |
|---|---|
| Registered users (excluding guests) | 430 |
| Organisers (own ≥1 competition) | 27 |
| Competitions | 30 |
| Credit purchases, lifetime | 7 |
| Revenue, lifetime | £140 |
| Distinct players who picked in 30 days | 236 |
| **Average competition size** | **12.1 players** |
| Competitions that ever passed 20 players | 6 of 30 |
| Organisers who ever passed 20 places total | 5 of 27 |

Season had only just started, so the 30-day figures are a floor.

```sql
SELECT (SELECT COUNT(*) FROM app_user WHERE email NOT LIKE '%@lms-guest.com') AS users,
       (SELECT COUNT(DISTINCT organiser_id) FROM competition) AS organisers,
       (SELECT COUNT(*) FROM competition) AS comps,
       (SELECT COUNT(*) FROM credit_purchases) AS purchases,
       (SELECT COALESCE(SUM(paid_amount),0) FROM credit_purchases) AS revenue;

WITH sizes AS (
  SELECT c.id, COUNT(cu.id) AS players
  FROM competition c LEFT JOIN competition_user cu ON cu.competition_id = c.id
  GROUP BY c.id)
SELECT COUNT(*) AS comps, ROUND(AVG(players),1) AS avg_players,
       COUNT(*) FILTER (WHERE players > 20) AS over_20
FROM sizes;
```

### The finding that mattered most

**The free tier (20 places) is larger than the average competition (12.1 players).** Only 5 of 27
organisers have ever gone past it. That, not slow adoption, is why lifetime revenue is £140.

Projected to the stated target of **24,000 users**, holding today's ratios:

- 24,000 ÷ ~16 users per organiser ≈ **1,500 organisers**
- 18% exceed the free tier ≈ **280 paying organisers**
- At £20 average purchase, 1.5 packs/year ≈ **£8–9k per year**

Twenty-four thousand users producing under ten thousand pounds. The organiser model monetises
*large* competitions; most of ours are small ones.

That is the argument for eventually revisiting the tier — and, if it is revisited, for asking
whether **per-lifetime is the right unit at all**. A season is the natural cycle of the product
and of a club committee, and per-season is the only version where 1,500 organisers is a business
rather than a hosting bill. Not a recommendation to act on now; growth matters more than margin
at this size.

---

## 4. Sponsorship — the best fit, still just an idea

Nothing built, nothing designed, no pricing decided. **The money never touches LMSLocal**, which
keeps the not-in-the-money-flow position intact.

1. The organiser sells the slot to a local business themselves — typically £50–150 for a season.
2. The sponsor pays **the organiser**, directly. The organiser keeps all of it. We never see,
   hold or invoice that money.
3. **We sell the capability, not the advertising**: a sponsor slot on the competition — logo, one
   line, a link — shown on the join page, the competition dashboard, the WhatsApp invite text, the
   printable QR poster and the weekly emails. Charge the organiser per competition or per season,
   say £20.

Why it is attractive: no ad sales, no advertiser vetting, no CPM dependency, no gambling exposure,
and it sells itself ("this pays for itself five times over") in a way another credit pack does
not. 1,500 organisers at a 30% attach rate ≈ £9k/year, roughly doubling the credit line — and for
clubs it is a slot they already know how to sell (§1).

**It would need a content policy on what may go in the slot**, or an organiser will put a
bookmaker there and we inherit the compliance problem sideways. That policy is the whole
difficulty of this feature; the plumbing is easy.

### Adjacent, cheaper, and arguably better first

**Prize sponsorship.** A local business funds the prize rather than buying a banner. Cheap for the
sponsor, tangible for the player, and it improves the competition rather than taxing attention. No
inventory, no impressions, no consent platform. Probably the version to try first if any of this
is ever tried.

---

## 5. Advertising — parked

Kept for the arithmetic, not as a plan. At 236 monthly actives it earns roughly £20 a month and is
not worth the pixels. At 24,000 it would be a real line:

- ~290,000 page views/month, two slots ≈ 580,000 impressions
- £2 RPM ≈ **£14k/year**; £4 RPM (betting-adjacent) ≈ **£28k/year**
- Bookmaker affiliate instead: UK CPA £25–40 per depositing customer. 1% annual conversion of 24k
  users ≈ £7k/year; 3% ≈ £21k/year

**Email inventory specifically is worse than it looks.** The target is 500k emails a month. Email
ad networks (LiveIntent, Jeeng and similar) generally want seven figures monthly before they will
take you on, and UK non-endemic CPMs in that range are low single digits — call it £500–2,000 a
month gross, paid for in deliverability on the exact emails (pick reminders) that make the product
work. Those are industry ranges from conversation, not quotes. Of everything in this file, generic
email ad inventory has the worst ratio of money to damage.

### What gambling ads would require, if ever revisited

- **The 25% rule**: no medium may carry gambling ads if more than 25% of its audience is, or is
  likely to be, under 18. It is an audience-**composition** test.
- **Affiliate liability sits with the operator.** The Gambling Commission holds licensees jointly
  responsible for their affiliates' content, so the bookmaker's affiliate programme is the real
  gatekeeper — they will ask how under-18s are excluded, because our non-compliance becomes their
  licence problem.
- Nobody verifies age. The industry norm is to age-gate at signup and self-certify the audience.
- **A real consent management platform** with categories, replacing the one-line accept/reject
  banner in `components/CookieConsent.tsx`, before serving ads to UK/EEA traffic.
- Andreas's position: he is deliberately not a bookmaker and not in the money flow, and takes the
  view — reasonably — that this does not stop him carrying ads for licensed bookmakers. The
  tension to manage is `/help/is-it-gambling`, which explains at length that we are not part of
  anyone's gambling arrangements. Carrying betting ads does not contradict that, but the page and
  the ad slot should not sit on the same screen without thought.

Sources:
[CAP — appeal to children](https://www.asa.org.uk/advice-online/betting-and-gaming-appeal-to-children.html),
[Gambling Commission — advertising and marketing rules](https://www.gamblingcommission.gov.uk/licensees-and-businesses/guide/advertising-marketing-rules-and-regulations),
[CAP/BCAP under-18s guidance](https://www.asa.org.uk/news/cap-and-bcap-update-guidance-on-protecting-under-18s-in-gambling-and-lotteries-advertising.html).

---

## 6. Email sending domains — the one thing worth doing early

Not a monetisation feature. It is what makes *any* promotional sending survivable later, and it is
much cheaper before volume than after.

**Where we are today**: everything sends from `EMAIL_FROM=noreply@email.noodev8.com` —
transactional and marketing alike, on a domain that is not even the product's own. Two separate
points, and the first is worth doing whatever happens with sponsorship.

**The principle.** Mailbox providers build reputation per sending domain. Pick reminders get
opened and clicked, so they earn a good reputation. A promotional blast gets ignored, marked spam
and unsubscribed, so it earns a bad one. Send both from one domain and the second poisons the
first — the reminder that makes the game work starts landing in Promotions or spam. Splitting them
means a bad campaign can only damage the campaign stream.

**What "splitting" means in practice** — subdomains of one registered domain, not new domains, and
nothing extra to buy:

| Stream | Suggested sender | Carries |
|---|---|---|
| Transactional | `noreply@mail.lmslocal.co.uk` | pick reminders, round open, results, password reset, join confirmations |
| Marketing | `hello@news.lmslocal.co.uk` | announcements, campaigns, anything sponsored |

You add each subdomain in Resend, publish the DNS records it gives you (DKIM, SPF, plus a DMARC
record on the parent), and each subdomain then warms its own reputation. `lmslocal.co.uk` itself
keeps serving the website and receiving mail — untouched.

**Why the noodev8 part matters separately**: sending product mail from an unrelated domain costs
recognition in the inbox and makes the sender look less trustworthy than it is. Moving to
`lmslocal.co.uk` subdomains is a deliverability *and* a branding win regardless of ads.

**Effort**: one env var per stream plus DNS records, and `deliver()` in
`services/emailService.js` is already the single exit point — it takes a stream argument and picks
the sender. Genuinely small. The cost of waiting is that a domain with a year of mixed reputation
cannot be un-mixed; you start the new one from scratch and re-warm it.

**Not urgent this week.** Worth doing before the first real marketing batch goes out, and before
volume climbs toward the 500k target.

---

## 7. Date of birth — deliberately not collected

`routes/register.js` collects display name, email and password only. That is a choice, not an
oversight: joining friction is the thing being optimised while the user base grows, and it has
worked.

An earlier version of this file called DOB "impossible to fix later" and ranked it most urgent.
**That was wrong**, and it is worth writing down why so it is not re-derived:

- The 25% rule is an **audience-composition** test. It asks about the shape of the audience, not
  the DOB of every individual in it. A representative sample satisfies it — an interstitial on
  next login, a one-off survey, analytics demographics.
- So a later backfill is **more expensive, not impossible**. The cost is friction applied to a
  large user base instead of a small one, which is real but payable.
- Collecting DOB now, for a monetisation route we have decided against, means holding personal
  data with no current purpose — a data-minimisation argument *against* collecting it.

**DOB is a prerequisite for advertising, not for growth.** Same box as the consent platform: built
if and when ads become real, and not before.

---

## 8. If sponsorship is ever built, build it in this shape

Recorded so the design is not re-derived. **Not a plan and not scheduled.**

- **Slots, not ad spots.** Named placement slots (`join_page`, `dashboard_card`, `email_footer`,
  `qr_poster`) that resolve to nothing by default. Adding a placement is then a row, not a
  template rewrite.
- **One `sponsor` entity scoped to a competition**, with an optional global fallback. The same
  shape serves a club's own shirt sponsor and, if it ever exists, a national partner. One concept,
  not two.
- **Impression and click counting from day one.** You cannot price, sell or renew without it, and
  adding it retroactively costs a whole season with no numbers. A click redirect route and a cheap
  impression row.
- **Sponsored content is its own preference section.** The consumer × section opt-out model in
  `services/emailPreference.js` handles this correctly already — the requirement is only that
  sponsorship never rides inside a transactional section's consent.
- **Free-and-sponsored vs paid-and-clean** is the natural tier fork if sponsorship is ever charged
  for. It needs the slot model to be per-competition and switchable, which the shape above gives
  for free.

---

## 9. Explicitly not concluded

- Whether gambling advertising is in or out. Leaning out (§2.3), not decided.
- What the free tier should become, if anything, once there is scale to price against.
- Whether per-season replaces per-lifetime as the unit.
- Whether sponsorship is ever built, and if so whether it is a paid feature, a tier, or bundled.
- The size of the club fundraising market. Unresearched (§1).
- Any RPM or CPA figure above — industry ranges from an August 2026 conversation, not quotes from
  a network.
