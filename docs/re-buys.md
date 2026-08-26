# Re-buys

**Status: agreed, not built. Written 26 Aug 2026.** Nothing in here has shipped. §11 is the build
list; §10 is what has to be exercised before it goes near a customer.

Companion to `docs/reset-billing.md`, and that doc should be read first — this one closes a hole
in it and reuses its arithmetic wholesale. Where the two touch, reset-billing is the older
decision and this one bends to fit it, not the other way round.

---

## 1. The decision

**Bringing an eliminated player back into a competition consumes a place, priced exactly as a
join.** Free under the organiser's live free twenty, one credit beyond it, counted by the same
fragment as everything else.

Two stages, and the second is optional:

- **Stage 1 (§3-§7)** — the charge. One column, one SQL fragment, one route. This is the part
  that closes the gap and it is deliberately boring.
- **Stage 2 (§8)** — the player-facing re-buy feature: a window, a request, a growing pot. Pure
  presentation on top of Stage 1, built whenever it is wanted.

They are not alternatives. Stage 1 is the load-bearing part and it is the small part.

### The word

**Re-buy**, not buy-in. In poker a buy-in is how you enter and a re-buy is how you come back after
busting. The entry here is the join, which is already priced; this is the coming back. The
player-facing verb is **"buy back in"** — plainer than the noun, and it is what an organiser
already says out loud.

---

## 2. Why — the gap

An organiser has two free, unlimited powers on `/game/[id]/players`:

| Power | Where | What it does |
|---|---|---|
| Lives stepper | `players/page.tsx:781-805` → `update-player-lives.js` | `competition_user.lives_remaining`, capped at 2 in the UI |
| Mark as active | `players/page.tsx:889` → `update-player-status.js` | `competition_user.status` |

They are independent, and the distinction matters for scoping. Elimination sets **both** — the
results processors write `lives_remaining = 0` and `status = 'out'` together
(`push-results-to-competition.js:304`, `organizer-process-results.js:242`). A player sitting on
zero lives is still `active`; they go `out` on the *next* loss. So **adding a life resurrects
nobody**, and the only thing that brings an eliminated player back is Mark as active.

Run that down a 52-player list and you have rebuilt the field. No rows were created, so no place
was consumed, so nothing was charged — and the organiser has a fresh competition for nothing.

**That is a reset by another door.** `reset-billing.md` §2 already decided this exact question:
the product sells slots that are *spent*, not seats that are *occupied*, and *"a new competition
with 200 players is a new competition with 200 players."* The reset charge exists because rows
surviving does not mean the money should. A mass revival is the same event reaching the same
outcome, and charging for one while the other is free makes the reset charge optional for anyone
who works it out.

### It does not have to wait for the end

The obvious gate — refuse once `competition.status = 'COMPLETE'` — is worthless. `COMPLETE` is
sticky (set only on a winner, `organizer-process-results.js:363`, and written back only by a
reset), but the organiser simply never lets the competition finish: revive during the final live
round, or top everyone up as they go, and the shell runs for ever. **Gating on competition status
was considered and dropped.** Do not reach for it again.

### How exposed we actually are

Checked against live on 26 Aug 2026. Five organisers are over the free limit at all:

| Organiser | Chargeable places | Competitions |
|---|---|---|
| 1003 | 78 | 2 |
| 1047 | 70 | 1 |
| 915 | 52 | 1 |
| 1126 | 28 | 1 |
| 1115 | 23 | 1 |

And the shape exists already:

| Competition | Status | Out | Total |
|---|---|---|---|
| 149 — Lakers LMS | COMPLETE | 44 | 52 |
| 161 — Marshfield U11's World Cup | COMPLETE | 21 | 21 |
| 173 — Marshfield JYFC | ACTIVE | 17 | 57 |

Lakers is one afternoon of dropdown-clicking from a free second season worth about 32 credits.
**Nobody is known to have done this.** The gap is worth closing because it is large and cheap to
close, not because it is being exploited — and that is the argument for keeping Stage 1 small.

---

## 3. What it costs — places, not credits

**This is the section that makes the whole thing cheap. Read it before proposing anything else.**

The instinct is to call a re-buy "one credit" and take it from the organiser's available pool,
falling back to their free allowance when they have one. That does not work, and finding out why
is what pointed at the right answer:

**There is no free-credit pool to take from.** The free twenty is not a balance. It is
`max(0, chargeable_players - FREE_PLAYER_LIMIT)`, recomputed live on every query. There is no
counter to decrement, no row to write, nothing that could "drop by one". Building one means
inventing a second currency, showing it on the billing screen, reconciling it with the live count,
and explaining the difference to organisers.

So do not make it a credit. **Make it a place.**

A re-buy *is* a player joining — same event, same price, same rule. The only reason it currently
costs nothing is that the `competition_user` row never went away, so the live count does not move.
Give the count something to move:

```sql
ALTER TABLE competition_user ADD COLUMN re_buys INTEGER NOT NULL DEFAULT 0;
```

and fold it into the count. A re-buy is then a chargeable place in exactly the sense every
existing query already means, and:

```
cost of a re-buy = 1 if (chargeable places, including re_buys) >= FREE_PLAYER_LIMIT, else 0
```

which is not a new formula. It is `deduct-credit.js` unchanged.

---

## 4. The counting change

Since the `reset-billing.md` §4 work, **every PAYG counting query reads one fragment**:
`organiserChargeableCountSql` in `services/botPool.js:118`. That is the main edit.

```sql
-- services/botPool.js, organiserChargeableCountSql
SELECT COUNT(chg_cu.id) + COALESCE(SUM(chg_cu.re_buys), 0)
```

and the same addition in `countCompetitionChargeableMembers` (`botPool.js:~170`), which is what
`resetCost.js` prices a reset with. `COUNT` returns 0 over no rows while `SUM` returns NULL, which
is what the `COALESCE` is for — without it an organiser with no memberships counts as NULL and
every comparison against the free limit silently goes unknown.

The route that grants a re-buy (§5) does the debit through the same path a join does.

### The one query that does NOT come along, and why

**`services/placeUsage.js` needs its own edit.** It composes `chargeableMemberFilter` but writes
its own `COUNT(mem.id)` rather than calling the fragment — deliberately, and its header says so.
It will not pick up `re_buys` on its own.

The trap, which is the same one its header already warns about: chargeability lives in a
`LEFT JOIN app_user mem`, so `mem.id` is NULL for a bot while the `competition_user` row still
exists. A plain `SUM(cu.re_buys)` therefore counts bot re-buys straight back in, against
`reset-billing.md` §4. It has to be conditioned on the join:

```sql
COUNT(mem.id) + COALESCE(SUM(CASE WHEN mem.id IS NOT NULL THEN cu.re_buys ELSE 0 END), 0)
```

and the `ORDER BY` wants the same expression, or the biggest holder stops sorting first.

So the counting change is **three places, not one**: the two functions in `botPool.js`, and this.

### What does come right for free

- **Under the free twenty, a re-buy costs nothing** — automatically. This is the behaviour we
  wanted and it falls out rather than being built.
- **`/get-user-credits`** reports places used correctly, because it reads the fragment.
- **The reset quote** prices a re-bought field correctly, because `resetCost.js` counts through
  the same functions.
- **Removing the player returns the place** — and their re-buys with it, since the count is live
  and the row is gone. The `reset-billing.md` §6 release valve keeps working unchanged.
- **The FULL gate** in `get-competition-by-code.js` stays consistent with what is actually being
  charged for.

### On the billing page: re-buys are shown, not absorbed

`billing/page.tsx:260` renders the **"Where your credits are"** panel from `place_usage`. A
re-buy must **not** silently inflate a competition's number — an organiser with twelve players
reading `14` has been handed a bug to report. The panel exists precisely to account for a total
the organiser cannot otherwise reconcile (see the header of `placeUsage.js`), so it has to show
the working:

```
Lakers LMS      Finished     52
Red Barn        Running      10      8 players + 2 re-buys
```

which means `place_usage` rows carry `re_buys` as their own field alongside `places`, not folded
into it. The breakdown line appears only where `re_buys > 0`.

**One line of existing copy becomes false** and has to change with it — `billing/page.tsx:266`:

> *"Each player holds one credit for as long as their competition exists — including competitions
> that have finished."*

A re-bought player holds two. `services/joinBlocked.js` sends the same breakdown by email through
`usageLines()`, so whatever the panel says, that has to say too — the two disagreeing is the exact
failure that service was written to prevent.

---

## 5. The charge, and where it lives

A new route — proposed **`/buy-player-back-in`** — rather than a flag on `update-player-status`.
Its own route because it is its own decision with its own price, and because
`update-player-status` is also how an organiser marks someone *out*, which must stay free and
instant.

Inside the transaction it already needs:

1. Refuse unless the player is currently `out`. Re-buying an active player is meaningless.
2. Price it: chargeable count (now including `re_buys`) against `FREE_PLAYER_LIMIT`.
3. If chargeable, debit `paid_credit` and write a `credit_transactions` row. Refuse with
   **`INSUFFICIENT_CREDITS`** — already the vocabulary, `deduct-credit.js:158` — before touching
   anything.
4. `status = 'active'`, `lives_remaining = 1`, `re_buys = re_buys + 1`.
5. `audit_log` row, as both existing routes already write.

**All or nothing**, in one transaction, per `reset-billing.md` §3. No partial re-buy.

### Lives on return

**Zero lives.** Not `lives_per_player`, and not one.

This was written the wrong way round first time — as "one life, because with zero they'd be
eliminated on the next loss and the re-buy bought nothing" — and that reasoning is simply false.
**Zero lives is not eliminated.** The results processors set `status = 'out'` only when lives
would go *below* zero (`push-results-to-competition.js:304`), so zero means *in, one loss from
out*: exactly the position of every player who has already spent their lives. A re-bought player
has spent theirs.

Anything above zero hands them a cushion the survivors do not have. The case that exposes it is
`lives_per_player = 0`, where one loss has always ended it: a single life makes the player who was
knocked out **and paid to come back** strictly better off than everyone who never lost at all.

**The re-buy buys the resurrection. It does not buy lives.**

Caught on the first run through the front end, on a competition with `lives_per_player = 0`, by
looking at the three players side by side — which is the only way it was ever going to show up.

### The dialog

Per `reset-billing.md` §5, **the organiser is told the price before the button, never by pressing
it** — and per §7 there are three states:

- **Free** (under the limit): say nothing about credits at all. No price, no balance, no
  reassurance that it is free. Same reasoning as §7's third state — telling someone an action
  costs nothing invents a worry they did not have.
- **Priced**: `Bringing Dave back will use 1 place, leaving you 44.`
- **Short**: the action is not offered. Message names Billing in words. **No link and no button** —
  `reset-billing.md` §7 decided against the round trip back through Stripe and that decision
  stands here.

Balance comes from `getUserCredits()`, which is **cached for an hour** (`api.ts:1058`). Invalidate
it after a successful re-buy or the number on screen is wrong immediately.

---

## 6. Lives: not charged, removed instead

The original request was to charge for the lives stepper. It ended up deleted, and the route it
called is now support-only. Worth following the reasoning, because the first two answers here were
both wrong.

**First answer — price it.** Wrong target. A life given to an active player resurrects nobody
(§2), so pricing it taxes the ordinary generous case without catching the case we care about.

**Second answer — leave it free, accept the residual.** This doc originally said an organiser
topping everybody up "can make a competition run indefinitely… one competition running long, which
they have paid for". **That understated it badly.** Work it through with a maximum of one life:

- Round N: player on 1 life, loses → 0 lives, **still active**
- Organiser sets them back to 1
- Round N+1: loses → 0, still active…

**Nobody can ever be eliminated.** Not a long game — a game that cannot end, and therefore a
competition that never needs paying for again. It was the last free door left open.

**The answer: remove the stepper.** Not primarily because of the hole, which is self-limiting —
an organiser who prevents all elimination has no winner, no payout and nothing to sell. Two better
reasons:

1. **Nobody uses it.** Checked against `audit_log` on 26 Aug 2026: five lives changes in ten
   months of production, four of them from testing this work, one in a competition since deleted.
   **No customer has ever adjusted a player's lives**, and the control was not hidden — it was the
   first thing on every player row, ahead of Set pick.
2. **Re-buy now covers what it was informally for.** Handing out a life was the mercy mechanism —
   the player who missed a pick for a real reason. That now has a proper route, priced and
   recorded. Keeping the stepper meant keeping a free, unlimited, invisible version of the thing
   §5 had just priced, which is the pattern this whole document exists to close.

**Lives are still displayed** on the player row, because "how many lives has this player got" is a
question an organiser genuinely scans the list for. It is just not editable.

`update-player-lives` **stays registered as a support route** so a wrongly-eliminated player can
be put right — the same bargain as §7: one blunt rule, exceptions absorbed by a human. Its proper
home is `lmslocal-admin` behind admin auth (CLAUDE.md: *"admin gets its own routes"*), and until
it moves this is a UI-only gate, which is worth naming rather than pretending otherwise.

**Marking a player out stays free**, obviously, and stays instant.

---

## 7. Support absorbs the exceptions

**Decided: one blunt rule, no correction carve-out.**

The awkward case is a player eliminated by a wrongly-entered result. Under this doc, putting them
right costs the organiser a place. That is a charge for our mistake, or theirs, and it is not
nice.

Every mechanism for avoiding it is worse than the problem:

- A free allowance of N re-buys per competition needs a counter, and produces the unanswerable
  question *"why did the fourth one cost me?"*
- A time window ("free within 24h of the result") is guessable but arbitrary, and the organiser
  who notices late is punished for noticing late.
- A separate free "correction" action is a second button doing the same thing, which anyone can
  use instead of the paid one.

So: **the rule is simple and support refunds the exceptions.** A credit back is ten seconds of
Andreas's time on a case that is rare by construction — a wrongly-entered result in a competition
over the free limit. Being willing to absorb that is exactly what buys the right to have one blunt
rule instead of a clever one, and a clever rule would cost more to build, explain and maintain
than the refunds ever will.

If the tickets ever become frequent, that is evidence for a free allowance and it will come with
a number attached. Not before.

---

## 8. Stage 2 — the re-buy feature

Optional, later, and worth more than the money. Everything here sits on top of Stage 1 unchanged.

**The case for it is retention, not revenue.** Elimination is currently the moment a player closes
the app for the last time. In a 50-player competition that is 49 people who stop opening it, most
by week five. A re-buy window turns that moment from an exit into a decision. The organiser's pot
grows, which is what *they* care about. No other LMS offers it, and poker has spent decades
proving the mechanic works.

What it needs:

- **A window.** `competition.re_buy_until_round` — poker's late-registration close. After it,
  knockout is knockout, which is what keeps the endgame meaning anything. Organiser sets it at
  creation or in settings; null means re-buys off.
- **A player-facing path.** An eliminated player currently hits a dead end. Instead: *"You're out
  — you can buy back in until round 6. Ask your organiser."* A request the organiser sees in one
  list, rather than the player having to catch them at the bar.
- **Organiser approval in one place**, not one dropdown per player. This is the part that has to
  be easy or the feature does not get used.
- **The pot.** `competition.entry_fee` already exists. A re-buy adds to the prize pot and the
  number should be visible to everyone — it is the reason players tolerate the mechanic.
- **Honesty in the standings.** A player who bought back in is marked as such. Nobody should have
  to wonder why a name reappeared.
- **Email**: the eliminated-player mail gains the window when it is open, and it is a natural
  `emailCatalog.js` entry. Follow `docs/email/README.md`.

None of this changes the billing. That is the point of doing §3-§5 first.

---

## 9. Deliberately not doing

**Do not "improve" these later without re-reading this section.**

- **Gating on `competition.status`** — §2. Sticky, and trivially avoided by never finishing.
- **A second currency for re-buys** — §3. There is no free-credit pool and inventing one costs a
  billing redesign to solve a problem that does not exist once a re-buy is a place.
- **A free allowance / correction carve-out** — §7. Support absorbs it instead.
- **Charging for lives** — §6. Wrong target; the stepper was removed instead.
- **Putting the lives stepper back on the organiser's screen** — §6. It is the one control that
  can stop a competition ever ending, and no customer ever used it.
- **Retrospective charges.** Nobody is billed for a revival that already happened. `re_buys`
  starts at 0 for every existing row and the numbers simply become correct going forward, exactly
  as the bot change did (`reset-billing.md` §4, *"Not doing: retrospective refunds"*).

---

## 10. Testing

`docs/testing-rules.md` applies: **live production database, no staging copy.** Ask which
competition to test against — organiser 50 owns real competitions as well as the sandbox, so
ownership is not permission. Do not top up `paid_credit` from a script; Andreas sets it by hand.

As in `reset-billing.md` §8, **`FREE_PLAYER_LIMIT` has to come down** for any of this to be
observable — organiser 50's chargeable population is small and every re-buy quotes free against a
limit of 20. Lower it in `lmslocal-server/.env` only, and **put it back to 20 when finished.**

What needs covering:

1. **Under the free limit** — re-buy is free, **no price shown at all**, `paid_credit` untouched,
   `re_buys` still increments.
2. **Over the limit, affordable** — one credit debited, one `credit_transactions` row, player
   returns `active` on **zero** lives, level with everyone who has spent theirs. Check this on a
   competition with `lives_per_player = 0`, where any cushion at all is visible immediately.
3. **Over the limit, short** — refused, and **nothing changes**: status still `out`, lives still
   0, `re_buys` unmoved, no debit.
4. **The count really moved** — after a re-buy, `/get-user-credits` reports one more place used,
   the billing panel attributes it to the right competition, and the rows still **sum to the
   total**. That summing is the panel's entire job; a re-buy counted in one half and not the other
   breaks it silently and looks like a rounding bug.
5. **Knock-on effects are intended, not surprises** — a re-buy can be what pushes an organiser
   past the free limit, making the *next real joiner* chargeable, and can tip
   `get-competition-by-code` into answering FULL. Both are correct under "a place is a place" and
   both need seeing once on purpose.
6. **Reset ordering** — `reset-competition` must price the field **before** zeroing `re_buys`,
   or the reset quote and the reset charge disagree. Getting this backwards is silent.
7. **Removal returns the place** — remove a re-bought player in SETUP and the count drops by their
   membership *and* their re-buys.
8. **Bots** — a bot is never chargeable anywhere (`reset-billing.md` §4), so a bot re-buy costs
   nothing. Confirm **both** counts still exclude them once `SUM` is in: the `botPool.js`
   fragment, and `placeUsage.js`, where the bot lives on the far side of a `LEFT JOIN` and an
   unconditioned `SUM` puts it back (§4).

---

## 11. Files in scope

**Stage 1**

| File | Change |
|---|---|
| `competition_user` | **new column** `re_buys INTEGER NOT NULL DEFAULT 0` — via `db/write.js` |
| `lmslocal-server/services/botPool.js` | `+ COALESCE(SUM(re_buys), 0)` in both count paths (§4) |
| `lmslocal-server/services/placeUsage.js` | its own count, bot-conditioned; carry `re_buys` per row (§4) |
| `lmslocal-server/services/joinBlocked.js` | `usageLines()` gains re-buys, so email and panel agree (§4) |
| `lmslocal-web/src/app/billing/page.tsx` | show the breakdown; rewrite the "one credit per player" line (§4) |
| `lmslocal-server/routes/buy-player-back-in.js` | **new** — price, debit, restore, audit (§5) |
| `lmslocal-server/server.js` | register the new route |
| `lmslocal-server/routes/reset-competition.js` | zero `re_buys` on reset, **after** pricing (§10.6) |
| `lmslocal-server/routes/update-player-status.js` | refuse `out → active`; `USE_RE_BUY` (§5) |
| `lmslocal-server/routes/update-player-lives.js` | support-only header; max 1 life (§6) |
| `lmslocal-web/src/app/game/[id]/players/page.tsx` | priced action for `out` players; three states (§5); invalidate the credits cache; **lives stepper removed** (§6) |
| `lmslocal-web/src/lib/api.ts` | the new route + types; `updatePlayerLives` helper deleted (§6) |
| `docs/reset-billing.md` | a pointer here from §6, since the refund window now returns re-buys too |

**Stage 2** — scoped when it is started, not before. §8 is the brief.
