# Revenue options — working notes

**Status: scratch. Not authoritative, not a decision record, safe to delete.**

Written 2026-08-24 from a conversation between Andreas and Claude about whether advertising
could fund LMSLocal alongside organiser credits. Revised 2026-08-25 once Andreas answered the
open questions. Nothing here has been built. It exists so the next session does not have to
redo the arithmetic.

---

## Settled (2026-08-25)

The first version of this file carried five open questions and treated three of them as urgent.
Andreas has answered all five, and most of the urgency was misplaced.

1. **The free tier is not locked, anywhere, and never was.** `/terms` says we may change prices
   or introduce new charges with 30 days notice to existing customers, and §13 lets us modify
   the terms at any time. We are free to change the tier whenever we choose. **Nothing here is
   time-critical** — this was the previous version's central claim and it was wrong.
2. **We carry no advertising, and are not pursuing it.** Not a rejection on principle; it is
   not worth the compliance apparatus at current scale. Revisit if the numbers below ever
   become real.
3. **We deliberately do not collect date of birth, or ask for 18+ confirmation.** The current
   priority is growing the user base, and registration is kept as frictionless as possible —
   which has worked. See the DOB section for why this is cheaper to reverse than the first
   version claimed.
4. **Local sponsorship is an idea, nothing more.** Nothing built, nothing designed, no pricing.
5. **`/help/is-it-gambling` is approved and live.**

### The one thing left open

**What the free tier should be once there is scale to price against.** Not urgent, not a
decision to take at 27 organisers, and not answerable from the code. The arithmetic below is the
reason it will eventually need an answer.

### One thing worth knowing, not worth acting on

The marketing copy promises more than the terms do. Eight live places say the free places are
**"yours for good"** or free **"for as long as you run it"**:
`pricing/page.tsx`, `pricing/layout.tsx` (×2), `SiteSchema.tsx`, `layout.tsx` (meta, ×3),
`page.tsx`, `help/faq/page.tsx`, `register/page.tsx`.

The terms govern, so this is not a legal exposure. But if the tier is ever reduced, that copy is
what people will quote back, not the terms. Worth changing *before* a reduction rather than
alongside one. No reason to touch it today.

---

## The numbers it was based on

Read from the production database on **2026-08-24**. They will be stale quickly; re-run before
relying on any of it.

| | |
|---|---|
| Registered users (excluding guests) | 430 |
| Organisers (own ≥1 competition) | 27 |
| Competitions | 30 |
| Credit purchases, lifetime | 7 |
| Revenue, lifetime | £140 |
| Distinct players who picked in 30 days | 236 |
| Picks in 30 days | 244 |
| **Average competition size** | **12.1 players** |
| Competitions that ever passed 20 players | 6 of 30 |
| Organisers who ever passed 20 places total | 5 of 27 |

Season had only just started, so the 30-day activity figures are a floor.

Queries used:

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

---

## The finding that mattered most

**The free tier (20 places) is larger than the average competition (12.1 players).** Only 5 of 27
organisers have ever gone past it. That, not slow adoption, is why lifetime revenue is £140.

Projected to Andreas's stated target of **24,000 users**, holding today's ratios:

- 24,000 ÷ ~16 users per organiser ≈ **1,500 organisers**
- 18% exceed the free tier ≈ **280 paying organisers**
- At £20 average purchase, 1.5 packs/year ≈ **£8–9k per year**

Twenty-four thousand users producing under ten thousand pounds. The organiser model monetises
*large* competitions; most of ours are small ones.

This is the argument for eventually revisiting the tier — and, if it is revisited, for asking
whether **per-lifetime is the right unit at all**. A season is the natural cycle of the product,
and per-season is the only version where 1,500 organisers is a business rather than a hosting
bill. Not a recommendation to act on now; the growth matters more than the margin at this size.

---

## Advertising — parked

Kept for the arithmetic, not as a plan. At 236 monthly actives it earns roughly £20 a month and
is not worth the pixels. At 24,000 it would be a real line:

- ~290,000 page views/month, two slots ≈ 580,000 impressions
- £2 RPM ≈ **£14k/year**; £4 RPM (betting-adjacent) ≈ **£28k/year**
- Bookmaker affiliate instead: UK CPA £25–40 per depositing customer. 1% annual conversion of 24k
  users ≈ £7k/year; 3% ≈ £21k/year

So at the target scale advertising plausibly out-earns credits under today's competition sizes.
That is the only reason it stays in the file. Nothing has been built and no foundations laid.

### Andreas's position, if it is ever revisited

He is deliberately not a bookmaker and not in the money flow, but takes the view — reasonably —
that this does not stop him carrying ads for licensed bookmakers. The tension to manage is
`/help/is-it-gambling`, which explains at length that we are not part of anyone's gambling
arrangements. Carrying betting ads does not contradict that, but the page and the ad slot should
not sit on the same screen without thought.

### What gambling ads would require

- **The 25% rule**: no medium may carry gambling ads if more than 25% of its audience is, or is
  likely to be, under 18. It is an audience-**composition** test.
- **Affiliate liability sits with the operator.** The Gambling Commission holds licensees jointly
  responsible for their affiliates' content, so the bookmaker's affiliate programme is the real
  gatekeeper — they will ask how under-18s are excluded, because our non-compliance becomes their
  licence problem.
- Nobody verifies age. The industry norm is to age-gate at signup and self-certify the audience.
- **A real consent management platform** with categories, replacing the one-line accept/reject
  banner in `components/CookieConsent.tsx`, before serving ads to UK/EEA traffic.

Sources:
[CAP — appeal to children](https://www.asa.org.uk/advice-online/betting-and-gaming-appeal-to-children.html),
[Gambling Commission — advertising and marketing rules](https://www.gamblingcommission.gov.uk/licensees-and-businesses/guide/advertising-marketing-rules-and-regulations),
[CAP/BCAP under-18s guidance](https://www.asa.org.uk/news/cap-and-bcap-update-guidance-on-protecting-under-18s-in-gambling-and-lotteries-advertising.html).

---

## Date of birth — deliberately not collected

`routes/register.js` collects display name, email and password only. That is a choice, not an
oversight: joining friction is the thing being optimised while the user base grows, and it has
worked.

**The first version of this file called DOB "impossible to fix later" and ranked it the most
urgent item. That was wrong**, and it is worth writing down why so it is not re-derived:

- The 25% rule is an **audience-composition** test. It asks about the shape of the audience, not
  the DOB of every individual in it. A representative sample satisfies it — an interstitial on
  next login, a one-off survey, analytics demographics.
- So a later backfill is **more expensive, not impossible**. The cost is friction applied to a
  large user base instead of a small one, which is a real cost but a payable one.
- Collecting DOB now, for a monetisation route we have decided against, means holding personal
  data with no current purpose. That is a data-minimisation argument **against** collecting it,
  not merely a cost of doing so.

**DOB is a prerequisite for advertising, not for growth.** It belongs in the same box as the CMP:
built if and when ads become real, and not before.

---

## Local sponsorship — an idea, nothing more

Nothing built, nothing designed, no pricing decided. Recorded because the structure was not
obvious first time round. **The money never touches LMSLocal**, which keeps the
not-in-the-money-flow position intact.

1. The organiser sells the slot to a local business themselves — typically £50–150 for a season.
2. The sponsor pays **the organiser**, directly. The organiser keeps all of it. We never see,
   hold or invoice that money.
3. **We sell the capability, not the advertising**: a sponsor slot on the competition — logo, one
   line, a link — shown on the join page, the competition dashboard, the WhatsApp invite text, the
   printable QR poster and the weekly emails. Charge the organiser per competition or per season,
   say £20.

Why it is attractive: no ad sales, no advertiser vetting, no CPM dependency, no gambling exposure,
and it sells itself ("this pays for itself five times over") in a way another credit pack does not.
1,500 organisers at a 30% attach rate ≈ £9k/year, roughly doubling the credit line.

**It would need a content policy on what may go in the slot**, or an organiser will put a
bookmaker there and we inherit the compliance problem sideways.

---

## Explicitly not concluded

- What the free tier should become, if anything, once there is scale to price against.
- Whether local sponsorship is ever built, and if so whether it is a paid feature, a tier, or
  bundled.
- Any of the RPM and CPA figures above — they are industry ranges from an August 2026
  conversation, not quotes from a network.
