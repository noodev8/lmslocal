# Charging for a reset

**Status: agreed, not built.** Written 8 Aug 2026. No code has been written for any of this.
Picking it up needs a test competition set up by hand — see §8.

Two separable pieces of work here, and they can ship in either order:

- **§1-§3, §5-§6** — reset re-charges for the players still in the competition
- **§4** — bots stop being chargeable anywhere, which is its own change and stands alone

---

## 1. The decision

**A reset re-charges for the players who are still in the competition.**

Today it charges nothing. `reset-competition.js` only ever `UPDATE`s `competition_user`
(lines 176-185) — lives, status, `paid`, `joined_at`. The rows survive. Credits are deducted in
exactly one situation anywhere in the codebase: when a `competition_user` row is **created**
(`join-competition-by-code.js:190`, `add-offline-player.js:156`, `deduct-credit.js:108`). A reset
creates none, so it is free at any size.

That is wrong, and the reason is in §2.

---

## 2. Why — slots, not seats

The product sells **slots**, which are *spent*. The code implements **seats**, which are
*occupied*. The two agree right up until a competition is reset, and then they diverge completely.

`docs/marketing-strategy.md:26` states the intended rule: *"A place is consumed when a player
joins beyond the free twenty, and is not returned when they leave."* Consumed. Spent. Gone.

But the counting query is a **live** count:

```sql
SELECT COUNT(cu.id) FROM competition c
LEFT JOIN competition_user cu ON cu.competition_id = c.id
WHERE c.organiser_id = $1
```

So a slot behaves like a seat that is occupied for as long as the row exists. An organiser with
200 players pays 180 slots once, and then those 200 people sit in those slots for ever. Reset the
competition every August for ten years and it is still 180.

**A new competition with 200 players is a new competition with 200 players.** The previous run's
slots were spent on the previous run. This is the whole point of pricing in slots rather than
seats, and reset is the one place the implementation forgets it.

It is also the exact customer the strategy doc names as the business.
`docs/marketing-strategy.md:31-33`: *"Revenue does not come from one big competition — it comes
from organisers who run repeatedly. A 60-player pub comp is £20 to us, once. That same landlord
running a comp every few weeks is the actual business."* Reset **is** that landlord running again,
and it is currently the only repeat path that bills nothing.

---

## 3. What gets charged

Charge a reset as though every remaining member joined again, one at a time, through the normal
join path. **One pricing rule in the product, not two.** The organiser's free twenty are counted
live and globally, exactly as they are everywhere else, so they have to be honoured here too.

```
others = the organiser's live chargeable memberships in their OTHER competitions
here   = chargeable members of THIS competition        (both exclude bots — §4)

cost   = max(0, others + here - 20) - max(0, others - 20)
```

| Situation | others | here | cost |
|---|---|---|---|
| One competition, 200 players | 0 | 200 | 180 |
| One competition, 25 players | 0 | 25 | 5 |
| One competition, 12 players | 0 | 12 | 0 |
| Resetting a 200 while a 30-player comp runs elsewhere | 30 | 200 | 200 |

The last row is worth understanding rather than treating as a bug: the free twenty are already
spoken for by the other competition, so every one of the 200 is paid. That falls out of the
formula instead of needing a special case, which is the reason to use the formula.

**All or nothing.** The charge and the wipe go in the one transaction that already exists in
`reset-competition.js`. There is no partial reset and no partial charge. If the debit cannot be
taken in full, nothing is deleted, nothing is reset, and no credit moves.

### The free tier is not re-granted per run

Worth stating so nobody "fixes" it later. The twenty free places are a permanent, live-counted
allowance across the organiser's account — not twenty free players per competition and not twenty
free players per run. An organiser whose only competition is 12 players can reset it for ever
without paying, which is correct and intended (`marketing-strategy.md:34`: *"Under 20 players is
free forever… they are the top of the funnel, not a leak."*).

---

## 4. Bots are not chargeable anywhere

**Decided: a bot never costs a credit and never consumes a free place, in any counting query in
the system.** Not a reset-only carve-out — the rule becomes consistent everywhere, which is what
makes it worth doing.

A bot is identifiable by email: `bot_%@lms-guest.com`, the `BOT_EMAIL_LIKE` pattern in
`services/botPool.js:45`, with `isBotEmail()` as the JS form of the same test. No schema change,
no migration — every count is live, so the numbers simply become correct on deploy.

### The six queries

`services/botPool.js:18-32` already names them, because it was written to explain why they *did*
charge for bots:

| File | Where |
|---|---|
| `routes/join-competition-by-code.js` | 177-190 |
| `routes/get-competition-by-code.js` | 115, 159-163 |
| `routes/deduct-credit.js` | 91-108 |
| `routes/add-offline-player.js` | 143-156 |
| `routes/get-user-credits.js` | 102-110 |
| `routes/remove-player.js` | ~174-189 |

Six copies of the same count is six chances to drift, and this change edits all of them at once.
**Put the exclusion in `botPool.js` as a shared SQL fragment** and have the six use it, so "what
counts as chargeable" has one definition sitting next to the one definition of what a bot is.
That is already the stated job of that file.

### This fixes a real bug, not just an inconsistency

`get-competition-by-code.js:163` answers **FULL** and turns real players away once an organiser is
at the free limit with no credit. Bots currently count toward that limit — so seeding one of our
own competitions with bots can slam the door on the real players the seeding exists to attract.
`botPool.js:25-26` flags this as a known consequence. Excluding bots removes it.

### BOT_ORGANISER_IDS should stay, but its justification changes

Read `botPool.js:11` and `:28-31` before touching this. The list exists *because* of billing:

> *"Rather than put a bot exclusion into live billing code, bots are confined to organisers who
> are us. Adding an id to this list is therefore a decision about someone's credit balance and
> their players' ability to join, not a config tweak."*

Once bots cost nothing, **that entire rationale evaporates** — and someone reading the file later
could reasonably conclude the restriction is now pointless and open it up. It is not pointless,
but the reason is a different one and needs writing down in its place: a customer's competition
filling with fake entrants is bad on its own terms. Real players would see phantom names in the
standings, play against opponents who are not people, and be eliminated in a field padded with
accounts we drive. That is a product and trust problem, and it survives the billing change intact.

So: **keep `BOT_ORGANISER_IDS = [50]`, rewrite the comment above it.** The header block of
`botPool.js` also opens by saying billing "is the reason `BOT_ORGANISER_IDS` exists" (line 11) —
that line goes too.

### Not doing: retrospective refunds

Credits already spent on bots are not returned. `BOT_ORGANISER_IDS` is `[50]` and always has been,
so every one of those deductions was ours — there is no customer to make whole, and unpicking
historical `credit_transactions` rows to correct our own balance is not worth the risk to a live
ledger.

---

## 5. The dialog

The organiser is told the price **before** the button, never by pressing it.

Current reset UI: `lmslocal-web/src/app/game/[id]/settings/page.tsx:259` (`handleResetCompetition`),
behind a modal that already requires typing `RESET` to confirm. The type-to-confirm stays.

Needs a new read-only route — proposed `/get-reset-quote` — returning the §3 arithmetic for one
competition, so the modal can show it on open:

- credits the reset will use
- the organiser's current balance
- whether the balance covers it
- the chargeable player count

### What the copy has to say

Both ways out of paying for someone who is not playing the next game, because an organiser who
only knows about the first will make a worse decision:

> **Starting again will use 180 places, leaving you 45.**
>
> Everyone currently in stays in, and each of them uses a place. If someone is not playing the
> next game, you can remove them now and not spend a place on them — or remove them afterwards,
> any time before the game starts, and the place comes back.

That second half is the §6 refund, and it is the thing that makes this humane: **one person
dropping out does not force an organiser to rebuild a 99-player competition from scratch.** They
reset, then remove the one, then get the place back.

The organiser is free to remove players before resetting to bring the number down; that path
already exists. The quote is a live read, so reopening the modal after removing players shows the
new number.

The quote is **advisory, not binding**. The authoritative charge is recalculated inside the reset
transaction. A quote that has gone stale — a player joined in the meantime — must not commit a
price that was never true. If the recalculated cost exceeds the quoted one, the reset fails with
the §7 error and the organiser sees a fresh number rather than a surprise debit.

---

## 6. The SETUP refund stays — it is the release valve

**Decided: keep it exactly as it is.**

`remove-player.js:189` refunds a credit when a player is removed while the competition is in
SETUP, and reset sets `status = 'SETUP'` (`reset-competition.js:166`). Earlier this looked like an
accidental collision worth closing. It is not — it is the mechanism that makes a paid reset
tolerable, and it is fair in both directions: the organiser pays for the field they are actually
going to run, and can correct the field right up until the game starts.

The nets-to-zero loop it permits (reset → remove all → re-invite) is not worth defending against.
It costs the organiser nothing and gains them nothing.

**The window is real and must be described accurately in the copy: before the game starts.** Once
round 1 exists the competition leaves SETUP and refunds stop. Checked against the live database —
`competition.status` currently holds only `SETUP`, `ACTIVE` and `COMPLETE`, all uppercase, so the
exact-case comparison in `remove-player.js` is sound today. Since the refund is now something we
promise an organiser in writing, it is worth a case-insensitive comparison anyway rather than
trusting that to hold.

---

## 7. When they cannot afford it

**The reset route refuses with `INSUFFICIENT_CREDITS`** — already in the vocabulary, used by
`deduct-credit.js:158`. Reusing it rather than inventing a synonym. The response carries the
required amount and the current balance so the message can be specific:

> **Starting again will use 180 places. You have 20.**
>
> Buy more places, or remove players you are not expecting to play.

Plus a plain link to `/billing`. The reset control is not offered in this state.

### Deliberately not doing: the round trip back

**Decided against, on purpose — do not "improve" this later without re-reading this section.**

The tempting version sends the organiser to Stripe and lands them back on the reset dialog with a
topped-up balance. It was considered and dropped, because it means building two things that can
each fail in an ugly way:

1. **A return destination through Stripe.** `create-checkout-session.js:241` hardcodes
   `success_url` to `/billing`. Threading a `return_to` through the session means accepting a
   redirect target from the client on a payment return — needing a strict internal-path whitelist
   to avoid an open redirect.
2. **A race we would be making visible.** Stripe bounces the browser back immediately, but
   `paid_credit` only moves when the webhook lands (`stripe-webhook.js:79`). `billing/page.tsx:76-85`
   currently covers this with a 100 ms timeout and a page reload — a guess that usually works.
   Dropping someone straight back onto a reset dialog turns that guess into *"you just paid and
   still cannot afford it"*, which is the worst possible moment to be wrong.

The organiser goes to `/billing`, buys, and finds their way back themselves. It is two clicks and
it cannot mislead anyone. The existing billing page already refreshes the balance on return.

---

## 8. Testing

Hard, and needs setting up by hand. **To be done in a separate session**, once a test area exists.
Noted here so the setup does not have to be re-derived.

Constraints from `docs/testing-rules.md`: this is the **live production database** with no staging
copy. **Competition 199, organiser 50 (`aandreou25@gmail.com`)** is the only sandbox. Check
`organiser_id` before any targeted write — 199 and 170 are one keystroke apart and 170 belongs to
a customer.

Organiser 50 is also the only member of `BOT_ORGANISER_IDS`, so 199 is the only place §4 can be
exercised at all.

What needs covering:

1. **Under the free twenty** — reset stays free, no price shown, nothing debited.
2. **Over the twenty, affordable** — quote matches what is actually debited; balance drops by
   exactly that; a row lands in `credit_transactions`.
3. **Over the twenty, short** — reset refuses and **nothing is deleted**. The important one:
   verify rounds, picks and `player_progress` all survive a refused reset.
4. **Bots free everywhere** (§4) — not just the reset quote. A bot joining costs nothing; a
   bot-heavy competition still lets real players in rather than answering FULL; `/get-user-credits`
   reports usage without them.
5. **The refund window** — reset, pay, remove one player, get exactly one credit back. Then start
   the game and confirm removals stop refunding.
6. **Removing players first** — reopening the modal after removals shows a lower number.
7. **Stale quote** — a join between quote and confirm must not commit the old price.

---

## 9. Documentation to correct alongside

- **`services/botPool.js`** — header line 11 and the comment block at 18-32. Both currently
  explain a billing policy that this change reverses. See §4.
- **`docs/BOTS-Management.md`** — check for the same billing rationale repeated there.
- **`CLAUDE.md`** — the admin-tool section states bots are billed *"with no bot exclusion"* as the
  reason they are confined to our own organisers. That becomes wrong on both counts.
- **`docs/marketing-strategy.md:26-27`** — *"A place is consumed… and is not returned when they
  leave."* Broader than the code, which does return one via the SETUP refund. Worth tightening.
- **`reset-competition.js` header block** — the route grows a return code and a cost. The header
  is the contract and has to say so.

---

## 10. Files in scope

| File | Change |
|---|---|
| `lmslocal-server/routes/reset-competition.js` | charge inside the existing transaction; `INSUFFICIENT_CREDITS`; header block |
| `lmslocal-server/routes/get-reset-quote.js` | **new** — the §3 arithmetic, read-only |
| `lmslocal-server/server.js` | register the new route |
| `lmslocal-web/src/app/game/[id]/settings/page.tsx` | quote in the modal, two states, link to billing |
| `lmslocal-web/src/lib/api.ts` | the new route + types |
| **§4, separable** | |
| `lmslocal-server/services/botPool.js` | shared chargeable-count fragment; rewrite the rationale |
| `lmslocal-server/routes/join-competition-by-code.js` | exclude bots |
| `lmslocal-server/routes/get-competition-by-code.js` | exclude bots (fixes the FULL bug) |
| `lmslocal-server/routes/deduct-credit.js` | exclude bots |
| `lmslocal-server/routes/add-offline-player.js` | exclude bots |
| `lmslocal-server/routes/get-user-credits.js` | exclude bots |
| `lmslocal-server/routes/remove-player.js` | exclude bots; case-insensitive SETUP check (§6) |

No schema change, no migration. `credit_transactions` already carries what a reset charge needs —
whether it gets its own `transaction_type` or reuses `'deduction'` with a description is worth
deciding at build time, since it affects what the billing history reads like.
