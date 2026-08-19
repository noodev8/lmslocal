# Marketing Strategy

Working document, written 5 August 2026. Nothing here is settled — **delete a section that stops
being useful rather than leaving it to rot.** (`pricing-strategy.md` rotted for eighteen months
and ended up describing a subscription model we never shipped.)

Copy rules live in `docs/design-system.md` §9. Artwork lives in `lmslocal-marketing/`. This file
is strategy only — who, why, and what we say. **How a campaign actually gets sent** — lists,
costs, batch sizes, results — is `docs/marketing-mailshot.md`. It is still named for the
mailshot; the current plan there is hand delivery to local bars, with the mail batch held.

---

## 1. What we sell

| | |
|---|---|
| Free tier | 20 player places, no card, permanent |
| Starter pack | +20 places, £10 |
| Popular pack | +50 places, £20 |
| Best value pack | +120 places, £40 |
| Fixture service | 20 credits a competition — **free right now** |
| Done-for-you setup | Normally £30 — **free right now** |

A place is consumed when a player joins beyond the free twenty, and is not returned when they
leave. The free twenty are counted live, so those do free up. Two deliberate exceptions:
removing a player while the competition is still in SETUP returns the place
(`docs/reset-billing.md` §6), and **starting a competition again re-charges** for everyone still
in it, because the previous run's places were spent on the previous run.

**The two facts that shape everything below:**

1. **The same person joining a second competition uses a second place.** Revenue comes from
   organisers who run *repeatedly* — a 60-player pub comp is £20 to us, once.
2. **Under 20 players is free forever.** Most workplace and mates' groups never pay. They are the
   top of the funnel, not a leak.

So the organiser we want is **someone who will run competitions plural, with more than twenty
people in them**. Pubs and venues, mostly.

---

## 2. The theory

Free national game → players learn the mechanic → instigators surface → they start one for their
own group or ask their local to run one → venue runs it repeatedly → revenue.

Why this way round rather than selling to landlords directly: a pub LMS is nearly always started
by a regular, not by the landlord, and the landlord says yes to something a customer asks for.
Cold leaflets ask a busy person to invent the idea themselves, which is a much harder ask.

The free game is not a loss leader — it *is* the product, demonstrated.

---

## 3. The free national game

Fresh £50 to the winner, with a new competition starting every week off the following week's
fixtures.

**Rollover is deliberately off.** A rolling jackpot pulls harder and fits the pools-coupon
language, but needs a budget that can absorb a £300 week. — *decision: 5 Aug 2026*

**What makes this work is not the £50, it is that a game always starts next week.** Every ad has
an immediate entry point, so one creative can run continuously for twenty weeks against a live
signal instead of getting one annual shot.

It does **not** compete with a pub's own game — players can sit in several at once. The free game
should never be positioned as the flagship: playing against 800 strangers has no texture, and the
slagging in the bar is the actual product.

- **Runway:** ~20 weeks from mid-August 2026, to roughly early January 2027, then reassess.
- **Cost:** near £50/week at steady state — about one game finishes for each one that starts.

---

## 4. Who we are talking to

**A — Free-game player.** Wide, cheap, top of funnel; football interest, no geography.
*Message:* free, one team a week, £50, starts Monday. **Do not explain the pricing** — they are
not buying anything.

**B — The instigator.** The regular who already runs the fantasy league or the sweepstake. **The
organiser pipeline, and the most under-served audience here.** Identifiable in our own data:
players who invite others, check standings daily, ask questions.
*Message:* "start one for your lot — 20 places free, no card."
*Channel:* in-product prompt after a few rounds, plus lookalike ads off that segment. **This
bridge does not exist** — see §7.

**C — Landlord / venue.** Small, high-intent, geographic. The revenue audience.
*Message:* footfall on a quiet Sunday, no work for you, free for twenty.
*Channel:* leaflets in person, local Facebook, licensed-trade groups.
*Artwork:* `a5-landlord.html` to leave on a bar; `a5-landlord-post.html` for an envelope, its back
page a signed note doing the job the conversation does when you hand one over.

**D — Club, society or team.** Committee and a shortfall, no gatekeeper, and the buyer is the
user. A club of 60 crosses the free tier immediately.
*Message:* fundraising — the competition that pays for itself (§5).
*Channel:* search, content, club association groups. *Artwork:* `a5-club-a.html`.

**E — Workplace or mates' group.** **Probably the easiest first revenue and the most
under-weighted.** An office of 40 crosses the free tier on day one, with no gatekeeper at all.
*Message:* nobody here is raising money — it is something to talk about at work for three months,
and it runs itself.
*Channel:* search, content, word of mouth. *Artwork:* `a5-workplace.html`.

---

## 5. The money angle

**Fundraising is right for clubs, wrong for pubs.** Clubs exist to raise funds and naming it is
the strongest argument available. A landlord is not fundraising — they want bodies through the
door and hands on pints, so "pays for itself" reads oddly to someone whose goal is selling beer.
The landing page and `a5-landlord.html` are each already correct for their audience.

*An earlier version of this section banned pitching organisers on money at all. It was wrong: it
collapsed two audiences into one rule and then banned the half that mattered. Superseded 5 Aug
2026.*

**Why it is safe to say:** terms §6 is the load-bearing protection — LMSLocal never processes,
holds or distributes entry fees or prize money; the organiser runs their own pot and we sell
software. Entry-fee last man standing is skill-based, so it is a prize competition, not a lottery
(the lottery problem arises when allocation is by chance). "Pays for itself" is a modest claim.

**Three cautions:**
- **Never promise an amount.** "Raise £500 for your club" is not a claim we can stand behind.
- **Describe what the organiser controls; do not design their scheme.** "Set the entry fee, set
  the prize" is the product. Splits and recommended pot structures read as us operating it, which
  is what terms §6 exists to prevent.
- **Never pair paid entry with randomly-assigned picks.** That is where a prize competition
  becomes a lottery needing a licence.

Commercial read, not legal advice. Worth a solicitor's twenty minutes before scaling ad spend
behind the fundraising angle.

**Also never:** present the free game as the main event (it is a taster for the local one), or
quote a price that is not on the pricing page. "Free right now" is the real current state, not an
invented promotion — and it will stop being true, so anything printed with it has a shelf life.

---

## 6. Channels

| Channel | Audience | State |
|---|---|---|
| Facebook — wide interest | A | Not started |
| Facebook — local / trade groups | C | Not started |
| In-product prompt | B | **Does not exist** |
| A5 leaflet, landlord | C | Built |
| A5 mailer, landlord | C | Built — double sided, for an envelope |
| Walking the leaflet into local bars | C | **Current plan** — `marketing-mailshot.md` §1, bars that advertise live sport |
| Addressed mailshot | D + C | **Held** — `marketing-mailshot.md` §6, built and costed, list drawn, nothing sent |
| A5 leaflet, player | A/C | Built — generic, code filled in by hand |
| A5 leaflet, club | D | Built |
| A5 leaflet, workplace | E | Built |
| Per-competition leaflet | players of a live comp | Built, in-app (`/leaflet/[competitionId]`) |
| Social tiles | A | Built — square, portrait, story |
| Search / content | D | Nothing |

---

## 7. Known blockers

Marketing problems that are engineering tickets. **Ad spend should track progress on 1**, or we
pay to fill a bucket with a hole in it.

1. **Player notifications are partly built, not finished.** An eliminated player who hears nothing
   has no reason to open the app again — the funnel leaking at its widest point. Scale spend to
   how finished this is rather than waiting for perfect: a small first game is worth running to
   learn from, a big one is not.
2. **No player → organiser bridge.** Nothing ever asks a player to start their own, so audience B
   is a plan with no mechanism.
3. **Internal billing on our own game.** We are the organiser of the national game, so its players
   consume places on our own account — `competition_user` rows are billed with no exclusions.
   Confirm an internal account can run unbounded before the first game gets big.
4. **Competition 1992 does not exist yet.** The code is reserved but nothing is created against
   it. The tiles say "draw or lose and you are out", true only with `lives_per_player = 0`, and
   carry 18+ / UK-only from terms §5, so ad targeting has to match.

---

## 8. Open questions

- Do we run the free game and the venue push together from week one, or stagger them?
- What is the weekly budget beyond the £50 prize?
- How do we measure "instigator" in the data — invites sent, or something better?

---

## Log

| Date | What |
|---|---|
| 5 Aug 2026 | Doc created; deleted `pricing-strategy.md` (a £29/£79 subscription never shipped). Settled: fresh £50 weekly, no rollover until budget allows. |
| 5 Aug 2026 | Three social tiles for the free game, join code 1992. Headline is "win £50 every game", not "every week" — terms §5 lets us cancel or suspend, so the cadence is not printable as a promise. |
| 5 Aug 2026 | §5 rewritten, old rule withdrawn as wrong: fundraising is right for clubs and wrong for pubs, so the landing page and landlord leaflet were both already correct. Kept three narrower cautions. Audiences split four → five: D clubs (fundraising), E workplaces (neither). |
| 5 Aug 2026 | D and E artwork built — one each, not a shared piece, resolving a §8 open question. |
| 19 Aug 2026 | `marketing-mailshot.md` split out — execution of an addressed campaign (lists, costs, batches, results) rather than strategy. Settled there: post not cold email, clubs 75 / pubs 25, self-fulfilled under 1,000 pieces. |
| 19 Aug 2026 | Channel order changed: **the pub leaflet gets walked into local bars showing live sport, and the 400-piece club mailshot is held** until a landlord has held the sheet. Nothing about the audiences changed — this is about spending £450 of postage before anyone outside the project has seen the artwork. See `marketing-mailshot.md` §1. Note §5's "pubs want footfall, clubs want funds" now has a documented exception: a local pub runs this by hand and splits the pot with the football team that drinks there, which is why the pub sheet carries a fundraising line. |
| 15 Aug 2026 | Landlord mailer (`a5-landlord-post.html`) for approaching pubs without walking in. First double-sided piece; the front finally sells footfall and dwell time, which §5 had claimed of the landlord leaflet since 5 Aug but which `a5-landlord.html` does not actually say. |
</content>
