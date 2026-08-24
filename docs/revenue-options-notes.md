# Revenue options — working notes

**Status: scratch. Not authoritative, not a decision record, safe to delete.**

Written 2026-08-24 from a conversation between Andreas and Claude about whether advertising
could fund LMSLocal alongside organiser credits. Nothing here has been built or agreed. It exists
so the next session does not have to redo the arithmetic.

---

## Waiting on Andreas

Five open questions. Each is a decision rather than a task — none of them can be settled from the
code, and the sections below are the arithmetic behind them.

1. **Does the free tier change, and to what?** 20 places against 12-player competitions means the
   median organiser never pays. The site already promises those places are "yours for good", so
   this has to be settled before the organiser count grows, not after. Keep 20? Reduce it? First
   competition free, later ones charged? Per season instead of per lifetime?
2. **Do we carry advertising at all — and does that include licensed bookmakers?** Andreas's
   position is that not being a bookmaker does not stop us advertising them. The open part is
   whether we act on it, and how ad slots sit alongside `/help/is-it-gambling`.
3. **Do we start collecting date of birth at registration now?** And as a real DOB or a simple
   18+ confirmation? This is the one that cannot be applied retroactively, so it is the most
   time-sensitive item in the file regardless of what is decided about ads.
4. **Is local sponsorship a paid feature, a pricing tier, or bundled — and at what price?** Plus
   the content policy question: what may an organiser put in that slot, given a bookmaker in it
   drags the compliance problem back to us.
5. **Has the `/help/is-it-gambling` page been read and approved?** It is live and speaks in
   LMSLocal's voice about other people's legal exposure. It was written to the "explain, do not
   guarantee" rule and is fully sourced, but it has not been signed off — the pub answer in
   particular is the bluntest thing on the site.

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

### The bit that is time-critical

The site already promises the 20 places are **"yours for good"** and **"free for as long as you
run it"** — `/pricing`, the home page, `/help/faq`, and the SiteSchema offer. That promise is fine
against 27 organisers and expensive against 1,500, and it cannot be withdrawn from people who
already have it.

**So the free tier is a decision to take before the growth, not after it.** Options if it needs to
change: a smaller lifetime allowance, first competition free and later ones charged, or per-season
rather than per-lifetime. No recommendation here — it is Andreas's call and it is a pricing
decision, not a technical one.

---

## Advertising

At 236 monthly actives it earns roughly £20 a month and is not worth the pixels. At 24,000 it is a
real line:

- ~290,000 page views/month, two slots ≈ 580,000 impressions
- £2 RPM ≈ **£14k/year**; £4 RPM (betting-adjacent) ≈ **£28k/year**
- Bookmaker affiliate instead: UK CPA £25–40 per depositing customer. 1% annual conversion of 24k
  users ≈ £7k/year; 3% ≈ £21k/year

So at the target scale advertising plausibly **out-earns credits** under today's competition sizes.
Both legs need work; the ad leg currently has no foundations laid at all.

### Andreas's position on gambling ads

He is deliberately not a bookmaker and not in the money flow, but takes the view — reasonably —
that this does not stop him carrying ads for licensed bookmakers. The tension to manage is
`/help/is-it-gambling`, which explains at length that we are not part of anyone's gambling
arrangements. Carrying betting ads does not contradict that, but the page and the ad slot should
not sit on the same screen without thought.

### Age — what the rules actually require

- **The 25% rule**: no medium may carry gambling ads if more than 25% of its audience is, or is
  likely to be, under 18. It is an audience-composition test, so it needs age *data*, not a terms
  clause.
- **Affiliate liability sits with the operator.** The Gambling Commission holds licensees jointly
  responsible for their affiliates' content, so the bookmaker's affiliate programme is the real
  gatekeeper — they will ask how under-18s are excluded, because our non-compliance becomes their
  licence problem.
- Nobody verifies age. The industry norm is to **age-gate at signup** and self-certify the
  audience.

`routes/register.js` collects display name, email and password only. **Adding a date of birth
field is the single most time-sensitive item in these notes** — it can be captured from every new
user today and cannot be applied retroactively to 24,000 existing ones.

`components/CookieConsent.tsx` is a one-line accept/reject banner writing a localStorage flag.
Serving ads to UK/EEA traffic needs a real consent management platform with categories. Same
argument: cheap now, a retrofit later.

Sources for the above:
[CAP — appeal to children](https://www.asa.org.uk/advice-online/betting-and-gaming-appeal-to-children.html),
[Gambling Commission — advertising and marketing rules](https://www.gamblingcommission.gov.uk/licensees-and-businesses/guide/advertising-marketing-rules-and-regulations),
[CAP/BCAP under-18s guidance](https://www.asa.org.uk/news/cap-and-bcap-update-guidance-on-protecting-under-18s-in-gambling-and-lotteries-advertising.html).

---

## Local sponsorship — the alternative to an ad network

The structure, since it was not obvious first time round. **The money never touches LMSLocal**,
which keeps the not-in-the-money-flow position intact.

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

**It needs a content policy on what may go in the slot**, or an organiser will put a bookmaker
there and we inherit the compliance problem sideways.

---

## Foundations worth laying, in order

1. **Date of birth at registration.** Smallest change here, and the only one impossible to fix
   later.
2. **Decide the free tier** before "yours for good" reaches 1,500 organisers.
3. **A real CMP** with consent categories, replacing the current banner.
4. **Build the slot as one component** now — a sponsor today, an ad unit later — so it is not a
   retrofit fighting the design system.
5. **Measure players → organisers.** Nothing tracks it today, and at 24k users that conversion is
   the entire growth model.

## Explicitly not concluded

- Whether to carry ads at all.
- Whether the free tier changes, and to what.
- Whether sponsorship is a paid feature, a tier, or bundled.
- Any of the RPM and CPA figures above — they are industry ranges from an August 2026
  conversation, not quotes from a network.
