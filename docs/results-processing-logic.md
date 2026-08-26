# Results Processing — The Logic

What happens when a result is entered and the **Process** button is pressed. This is the rules
document, written a level above the code: it describes what the process *is*, not how any
particular route implements it. Two routes implement it today (`organizer-process-results` for
manual competitions, the admin results push for `fixture_service` ones) and they are deliberate
copies of one ruleset. This doc is that ruleset.

Companion docs: `results-processing-performance.md` (why results push one competition at a time,
and how to make this scale), `results-processing-correction.md` (how to change a result
that was already processed).

---

## Where this starts

Everything here happens **after** the round has locked and picks are closed. Nothing in this
process can change a pick, and nothing here touches team availability — that all belongs to the
picking lifecycle, which finished before this begins. See "What this process does not touch".

Both entering a result and processing refuse outright while the round is still open, on **both**
routes in — organiser and fixture service alike. This is a rule, enforced on every request, not
merely a screen that hides the buttons — processing early would charge a no-pick penalty to
players who were still entitled to pick, and a life once taken cannot be given back. A round with
no lock time set has nothing to wait for and is allowed through.

---

## The shape

Four parts, plus a doorway. The important structural fact is the **scope** column: the first two
run per fixture, as often as results arrive; the last two run once, when the round closes.

| | scope | when |
|---|---|---|
| **1. RESULT** | per fixture | organiser enters it — no player effect |
| *the claim* | per fixture | process pressed — makes parts 2–4 run-once |
| **2. PLAYER** | per fixture | outcome recorded, history written, losers charged |
| **3. ROUND** | per round | *gated:* every fixture processed → no-pick penalties |
| **4. COMPETITION** | per competition | *gated:* same gate → one or fewer left → end it |

Parts 3 and 4 share a single gate, so in practice they are two halves of one "round closes" event.

---

## Part 1 — RESULT

The organiser states what happened: a winning team, or a draw. Nothing else occurs. No player is
affected, no life moves, no history is written.

This is a **statement of fact about the match**, deliberately separated from the act of applying
it. That separation is why a result and its processed state are two distinct pieces of
information rather than one. It buys two things:

- An organiser can enter ten results across a Sunday afternoon and apply them in one go.
- A result entered wrongly can be corrected freely, right up until it is processed. After
  processing it is frozen — lives have already moved, and there is no safe way to un-move them.

A result may be entered for a fixture nobody picked. That is fine and has no consequences; the
fixture still gets processed, it simply has no players in it.

### Two ways a result arrives

The rule above is one rule, but there are two routes to it, and they differ in shape.

**An organiser enters it directly.** They state the outcome — home win, away win, or draw — one
fixture at a time, for their own competition. Entering and processing are two separate actions,
so the gap described above is plainly visible: results accumulate, then the organiser presses
process when they are ready.

**The fixture service stages it, then pushes it.** Results are entered centrally once, as
**scores**, from which the winner (or a draw) is derived. They land in a staging area first, and
are then pushed to each subscribed competition in turn — one competition per push, deliberately,
so that a slow or failing competition cannot take the rest of the batch down with it.

For the fixture service, the gap between stating a fact and applying it sits at **staging**, not
at the push: a staged result cannot be entered before that fixture has kicked off, because there
is no real result to record yet. The push then writes the result onto the competition's fixtures
and processes it as one indivisible act. So the separation is preserved — it just happens one
step earlier.

Two consequences worth knowing:

- **The fixture service never overwrites an existing result**, processed or not. Where an
  organiser may correct a mistake up until processing, a pushed result treats any result already
  present as authoritative and leaves it alone.
- **A push can safely be repeated.** The admin drives it by hand, one competition at a time, and a
  row whose outcome was unclear can simply be pressed again — a repeat finds nothing to write and
  nothing to process, and says so.

---

## The claim

Before any player is touched, every fixture about to be processed is marked as processed — and
the processing that follows works only on the fixtures the claim **actually won**, not the ones
it set out to process.

This exists for one reason: **processing is not idempotent**. Deducting a life is a subtraction,
not an assignment. Run it twice and a player loses two lives for one wrong pick, and once that is
committed there is no way to tell, after the fact, whether a player on one life was on two or
three before. So the process must be un-runnable twice.

The claim is a conditional act — mark these fixtures *only if not already marked* — which is both
a test and a write in one indivisible step. Nothing can slip into the gap between checking and
claiming, because there is no gap. Two runs starting together (an organiser double-click, a retry
firing while the first is still going) both intend to process the same fixture; one wins it, the
other comes away with nothing and stops. One life lost, not two.

**Claiming nothing is not an error.** It means another run took the work. The correct response is
to stop quietly and report that there was nothing to process — the same outcome as if no results
had been set at all.

**The claim and everything after it are one atomic unit.** If anything downstream fails, the
claim must be undone with it. *Claimed but not processed* is the one state the system must never
be able to reach: the fixtures would be marked done while the players were never touched, and
nothing would ever pick them up again.

---

## Part 2 — PLAYER

For each claimed fixture, every pick on it is resolved. Three things happen, and it is worth
keeping them separate in your head, because the first two are **recording** and the third is
**consequence**.

**Deciding the outcome.** The picked team is compared against the result. Picked the winner → WIN.
Picked the loser → LOSE. A **draw eliminates everyone in that fixture**, whoever they backed —
there is no such thing as surviving a draw.

**Recording it.** The outcome is stamped on the pick, and a permanent history row is written for
that player, round and fixture. The history is append-only and is never revised **during
processing**; it is the record of what happened, kept separately from the player's current
standing. (Correcting a result that was already processed is a separate, deliberate, audited
action that may revise it, and is the only thing that may — see
`results-processing-correction.md`.)

**Charging the losers.** Winners are recorded but never charged. Losers lose a life, and are
eliminated if that takes them below zero.

### How lives read

Lives are the number of mistakes a player can still absorb, so **zero lives does not mean
eliminated** — it means the next loss eliminates. The displayed count floors at zero and never
shows negative, but the elimination test uses the true value, which is allowed to go under. That
is what lets zero mean "one more and you're out" rather than "already out".

---

## Part 3 — ROUND

**Gated: this runs only when every fixture in the round has been processed.**

Note the gate carefully — it is *processed*, not *results entered*. All ten results can be known
while only three have been applied, and the round is not finished until every fixture has been
applied. Knowing is not applying.

Once the round closes, players who never picked are found and charged a life, exactly as if they
had picked a loser. They are found **by absence**: a player who did not pick has no pick record at
all. There is no row saying "no pick" — the missing row *is* the state.

This produces a consequence worth being explicit about, because it surprises people:

> A player who never picked is **not** penalised when their round's results start arriving. They
> are penalised when the round *finishes*. Until then they sit in limbo — no pick, no penalty,
> still active.

An unpicked pick returns a player to the never-picked state exactly. Undo a pick and leave it
undone, and the round will charge you the no-pick penalty; you are indistinguishable from someone
who never showed up.

---

## Part 4 — COMPETITION

**Gated: the same gate as part 3.**

The competition ends when **one or fewer players remain active**, which resolves two ways:

- **One remains** → they have won, and are recorded as the winner.
- **Nobody remains** → the competition ends with **no winner**.

Zero survivors is a real outcome, not an error: it happens when the last players standing are all
eliminated in the same round, because they backed the same losing team or were caught by a draw.
It is not a draw in the sporting sense — it is a competition that ended with nobody left.

### Winning is decided by processing, not by fact

A player can be the only survivor in principle — everyone else knocked out by the early kick-off —
while the competition remains active in the system until the last fixture of the round is
processed. **This is intended.** Nobody is the winner until the round is closed, even if the
result is a foregone conclusion. The alternative would mean declaring a winner mid-round, before
the round's own rules have finished running.

---

## What this process does not touch

Stated explicitly, because these are the assumptions that go wrong later.

**Team availability.** The pool of teams a player may still pick is consumed **when the pick is
made**, not when it is processed. This process never touches it. Every change to team availability
happens during the picking lifecycle: the full list is granted on joining, a team is consumed on
picking, restored on changing or undoing a pick, and refilled when a player exhausts the list.
Processing has no interaction with any of it. The two lifecycles meet only at the pick itself.

(Team availability is also conditional on the competition's reuse rule — where reuse is allowed,
nothing is ever consumed.)

**Picks themselves.** Beyond stamping an outcome, no pick is created, moved or removed here.

**Eliminated players' leftovers.** A knocked-out player keeps their unused team availability. It
is harmless — they cannot pick — but the rows remain. This is not a bug.

---

## Two states that look alike and are not

Both of these are represented by a **missing row**, and they mean opposite things:

| missing row | meaning | consequence |
|---|---|---|
| no pick for the round | the player didn't pick | penalised at round close |
| no availability for a team | the player already used it | blocked from picking it |

---

## Open decisions

Recorded as choices, not defects.

**The round-close gate delays a settled result.** A competition decided by the Saturday lunchtime
kick-off stays active until someone processes the last irrelevant fixture of the round. Accepted:
see "Winning is decided by processing, not by fact".

**Zero-winner competitions have no special handling.** They simply end with nobody recorded as
having won. Whether that deserves distinct treatment — in the UI, in notifications — is open.

**The ruleset lives in two places.** Manual and automated competitions run separate
implementations of this document, kept in step by hand. Consolidating them into one shared piece
of logic has been deliberately deferred. Until it happens, **any rule change here must be made in
both** — the lives and elimination threshold above all — or the two paths will disagree about when
a player is out.
