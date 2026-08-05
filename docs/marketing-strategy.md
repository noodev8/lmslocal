# Marketing Strategy

Working document. Written 5 August 2026, two weeks before the 2026/27 Premier League season.
Expect to strike things out — nothing here is settled, and a section that stops being useful
should be deleted rather than left to rot. (The previous `pricing-strategy.md` was left to rot
for eighteen months and ended up describing a subscription model we never shipped.)

Copy rules for anything customer-facing live in `docs/design-system.md` §9. Artwork lives in
`lmslocal-marketing/`. This file is strategy only — who, why, and what we say.

---

## 1. What we actually sell

Worth stating plainly, because it constrains everything below.

| | |
|---|---|
| Free tier | 20 player places, no card, permanent |
| Starter pack | +20 places, £10 |
| Popular pack | +50 places, £20 |
| Best value pack | +120 places, £40 |
| Fixture service | £10 a competition — **free right now** |
| Done-for-you setup | Normally £30 — **free right now** |

A place is consumed when a player joins beyond the free twenty, and is not returned when they
leave. The free twenty are counted live, so those do free up.

**The two facts that shape the strategy:**

1. **The same person joining a second competition uses a second place.** Revenue does not come
   from one big competition — it comes from organisers who run *repeatedly*. A 60-player pub comp
   is £20 to us, once. That same landlord running a comp every few weeks is the actual business.
2. **Under 20 players is free forever.** Most workplace and mates' groups never pay, and that is
   fine — they are the top of the funnel, not a leak. We are not trying to convert them.

So the organiser we want is not "someone who will run a competition". It is **someone who will
run competitions plural, with more than twenty people in them**. Pubs and venues, mostly.

---

## 2. The theory

Players first, organisers out of the player pool.

```
Free national game  →  players get used to the mechanic
        ↓
   instigators surface (the ones who invite others)
        ↓
   they start one for their own group / ask their local to run one
        ↓
   venue runs it repeatedly  →  revenue
```

Why this way round rather than selling to landlords directly: a pub LMS is nearly always started
by a regular, not by the landlord. The landlord says yes to something a customer asks for. Cold
leaflets ask a busy person to invent the idea themselves, which is a much harder ask than
agreeing to one.

The free game is not a loss leader for the product — it *is* the product, demonstrated. Someone
who has played four rounds already knows what a lock time is and why they cannot pick Arsenal
twice.

---

## 3. The free national game

Fresh £50 to the winner, every week. A new competition starts every week using the following
week's fixtures.

**Rollover is deliberately off for now.** A rolling jackpot pulls much harder than a flat £50
(and fits the pools-coupon language exactly), but it needs a budget that can absorb a £300 week.
Revisit when there is one. — *decision: 5 Aug 2026*

**What makes this work is not the £50, it is that a game always starts next week.** Every ad has
an immediate entry point. No "season starts in August", no "come back Saturday". Someone who sees
a post on a Wednesday is playing by the weekend, and the same creative can run continuously for
twenty weeks against a live signal instead of one annual shot. That is rare, and it is the
strongest single asset in the plan.

Players can sit in several competitions at once, so the free game does **not** compete with a
pub's own game — a player can be in both, and the app shows them where they still owe a pick.
That is worth protecting. The free game should never be positioned as the flagship; it is a
warm-up. Playing against 800 strangers has no texture. Playing against people you drink with is
the actual product, because the slagging in the bar is the point.

**Runway: about 20 weeks** from mid-August 2026 before interest fades toward the end of the
season. Roughly to early January 2027, then reassess.

**Cost:** near £50/week at steady state, since about one game finishes for each one that starts,
regardless of how many overlap.

**Operational check, not yet done:** we are the organiser of the national game, so its players
consume places on our own account. `competition_user` rows are billed with no exclusions (see
the bots note in `CLAUDE.md`). Confirm an internal account can run unbounded before the first
game gets big, or the platform will start billing us for our own marketing.

---

## 4. Who we are talking to

Five audiences, not two. Different message, different channel, different moment.

### A — Free-game player
Wide, cheap, top of funnel. Football interest, no geography.
**Message:** free, one team a week, £50, starts Monday.
**Do not** explain the pricing. They are not buying anything.

### B — The instigator
The regular who already runs the fantasy league, the sweepstake, the quiz team. **This is the
organiser pipeline and the most under-served audience in the plan.** They are identifiable in
our own data — the players who invite others, who check standings daily, who ask questions.
**Message:** "start one for your lot — first 20 free, no card."
**Channel:** in-product prompt after a few rounds, plus lookalike ads off that segment.
This bridge does not currently exist. See §7.

### C — Landlord / venue
Small, high-intent, geographic. The revenue audience.
**Message:** footfall on a quiet Sunday, no work for you, free for twenty.
**Channel:** leaflets in person, local Facebook, licensed-trade groups.
`lmslocal-marketing/leaflet/a5-landlord.html` is the artwork.

### D — Club, society or team
Cricket, football, social, anything with a committee and a shortfall. No landlord gatekeeper, no
premises, and the buyer is the same person as the user. A club of 60 crosses the free tier
immediately.
**Message:** fundraising — the competition that pays for itself. See §5.
**Channel:** search, content, word of mouth, club association groups. No artwork exists yet.

### E — Workplace or mates' group
**Probably the easiest first revenue and the most under-weighted.** An office of 40 crosses the
free tier on day one, and there is no gatekeeper at all.
**Message:** neither fundraising nor footfall — nobody here is raising money. It is something to
talk about at work for three months, and it runs itself.
**Channel:** search, content, word of mouth. No artwork exists yet.

---

## 5. The money angle, and where it belongs

An earlier version of this section said never to pitch organisers on money at all. That was
wrong, and it was wrong in a specific way worth recording: it collapsed two audiences into one
rule and then banned the half that mattered. Superseded 5 Aug 2026.

**Fundraising is the right angle for clubs.** Football, cricket, social, anything with a
committee and a shortfall. They exist to raise funds; naming it is the strongest argument
available and hiding it loses the sale for nothing. The landing page already does this — "the
competition that pays for itself" — and it should stay.

**Fundraising is the wrong angle for pubs.** A landlord is not fundraising. They want bodies
through the door on a dead Tuesday and hands on pints during the Sunday games. "Pays for itself"
is faintly odd to someone whose goal is not to break even on the competition but to sell beer.
`a5-landlord.html` correctly sells footfall and dwell time, and it should stay that way too.

So the landing page and the landlord leaflet are not in conflict. They are two audiences
correctly served, and the doc was the thing that was wrong.

### Why this is safe to say

- **Terms §6 is the load-bearing protection**: LMSLocal never processes, holds or distributes
  entry fees or prize money. The organiser runs their own pot; we sell software. Keep that
  separation intact and keep saying it.
- **Entry-fee last man standing is ordinary and legal.** It is skill-based — you choose which
  team wins — so it is a prize competition, not a lottery. The lottery problem arises when
  allocation is by chance.
- "Pays for itself" is a modest claim. Entry fees cover the platform cost. It is not "get rich",
  and it is far easier to stand behind than most marketing copy.

### The three cautions that do earn their place

- **Never promise an amount.** "Raise £500 for your club" is a claim we cannot stand behind and
  it is exactly the kind that gets challenged.
- **Describe what the organiser controls; do not design their scheme.** "Set the entry fee, set
  the prize" is the product. Splits, percentages and recommended pot structures start to read as
  us operating it, which is what terms §6 exists to prevent.
- **Never pair paid entry with randomly-assigned picks.** That is the line where a prize
  competition becomes a lottery and needs a licence. Not relevant to anything we run today —
  just do not build toward it.

This is a commercial read, not legal advice. Worth twenty minutes of a solicitor's time before
scaling ad spend behind the fundraising angle.

## 5a. Other things we do not say

Beyond the honesty rules in the design system:

- **Never present the free game as the main event.** It is a taster for the local one.
- **Do not quote a price that is not on the pricing page.** "Free right now" on the fixture
  service is the real current state, not a promotion we invented — and it will stop being true,
  so anything printed with it on has a shelf life.

---

## 6. Channels

| Channel | Audience | State |
|---|---|---|
| Facebook — wide interest | A | Not started |
| Facebook — local / trade groups | C | Not started |
| In-product prompt | B | **Does not exist** |
| A5 leaflet, landlord | C | Built |
| A5 leaflet, player | A/C | Built — generic, code filled in by hand |
| Per-competition leaflet | players of a live comp | Built, in-app (`/leaflet/[competitionId]`) |
| Social tiles | A | Built — square, portrait and story for the free game |
| Search / content | D | Nothing |

---

## 7. Known blockers

These are marketing problems even though they are engineering tickets.

1. **Player notifications are partly built, not finished.** The machinery exists and is
   evolving, but it is not yet reliably reaching players. This matters more than it looks: an
   eliminated player who hears nothing has no reason to open the app again, and that is the
   funnel leaking at its widest point. Scale the ad spend to how finished this is rather than
   waiting for it to be perfect — a small first game is worth running to learn from, a big one
   is not.
2. **No player → organiser bridge.** Nothing in the product ever asks a player to start their
   own. Audience B is a plan with no mechanism.
3. ~~No social artwork.~~ Done 5 Aug 2026 — three tiles for the free game in
   `lmslocal-marketing/social/`. Audiences D and E still have none.
4. **Internal billing on our own game** — see §3.
5. **Competition 1992 does not exist yet.** The code is reserved but nothing is created against
   it. The tiles say "draw or lose and you are out", which is only true if it is set up with
   `lives_per_player = 0`. They also carry 18+ / UK-only from terms §5, so the ad targeting has
   to match.

Order matters: ad spend should track progress on 1, or we pay to fill a bucket with a hole in it.

---

## 8. Open questions

- Who goes through the door first — do we run the free game and the venue push together from
  week one, or stagger them?
- D and E need artwork. D cannot reuse the landlord leaflet — different motivation, not just
  different wording — so is it one club-facing piece, or one each?
- What is the actual weekly budget beyond the £50 prize?
- How do we measure "instigator" in the data — invites sent, or something better?

---

## Log

| Date | What |
|---|---|
| 5 Aug 2026 | Doc created. Deleted `pricing-strategy.md` (described a £29/£79 subscription model that was never shipped; live pricing is credit packs). Settled: fresh £50 weekly, no rollover until budget allows. |
| 5 Aug 2026 | Three social tiles built for the free game (square, portrait, story), join code 1992. Headline is "win £50 every game", not "every week" — terms §5 lets us cancel or suspend, so the cadence is not printable as a promise. Open question raised: the homepage sells "the competition that pays for itself" while §5 of this doc said never to pitch organisers on money. |
| 5 Aug 2026 | §5 rewritten and the old rule withdrawn — it was wrong. Fundraising is right for clubs and wrong for pubs, so the landing page and the landlord leaflet were both already correct and the blanket ban was the error. Kept three narrower cautions: no promised amounts, describe what the organiser controls rather than designing their scheme, never pair paid entry with random picks. Audiences split from four to five: D is now clubs (fundraising), E is workplaces and mates' groups (neither). |
