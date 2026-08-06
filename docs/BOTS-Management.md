# Bot Management Guide

Bots are placeholder players you can put into a competition so it is not empty when a real
player joins, and keep picking each round. They are driven entirely from **lmslocal-admin →
Bots**.

---

## The two rules that shape everything else

**1. Bots are obviously bots.** Every one is called `Bot <Name>` and every player sees that
name in standings, pick statistics and player lists. Nothing hides it or dresses it up.

**2. Bots can only go in our own competitions.** The Bots screen only offers competitions run by
an organiser in `BOT_ORGANISER_IDS` (`lmslocal-server/services/botPool.js`), currently just
organiser 50. Every bot route refuses anything else with `COMPETITION_NOT_ELIGIBLE`.

The second rule is about money. `competition_user` rows are counted against the organiser's
free player allowance in six places, with no exclusion for bots — so a bot uses up one of the 20
free places exactly like a person, and past that it costs the organiser a credit. Worse,
`get-competition-by-code` answers `FULL` and turns real players away once an organiser is at the
limit with no credit left. Seeding a customer's competition would spend their money and could
lock their players out. Confining bots to our own accounts is what makes that survivable without
putting a bot exclusion into live billing code.

Adding an id to `BOT_ORGANISER_IDS` is therefore a decision about someone's credit balance, not
a config tweak.

---

## The Bots screen

`lmslocal-admin` → **Bots**. Also reachable from the Competitions list — the **Bots** column
links straight through to the right competition.

Pick a competition from the selector at the top. Everything below it then applies to that
competition.

### Adding bots

Set a count and press **Add bots**. Bots are drawn at random from the pool, and a bot already in
the competition is never drawn twice.

Bots can only join in the same window a real player can: before round 1 exists, or during
round 1 until it locks. After that the button disables and says why. A bot arriving mid
competition with a full set of lives would be a different kind of entrant to everyone around it.

### Making picks

**Make picks** gives that many bots a random team from the current round's fixtures, choosing
only from bots that have not picked yet.

The count is the point of the control: leaving some bots without a pick is how you produce a
round where not everyone has answered.

A bot with no legal team left — normal deep into a competition with no-team-twice on — is
skipped and reported separately rather than failing the whole call.

### Setting one bot's pick

Each row has a dropdown of the round's teams. Pick one to set it, or choose **No pick** to clear
it. Teams the bot has already used stay in the list but are disabled and marked `(used)`.

Clearing a pick hands the team back, so the bot can use it again later.

### Removing a bot

The ✕ on a row takes that bot out of the competition and deletes its picks and round history
there. The account itself stays in the pool and is untouched in every other competition.

It only appears while the competition has not started — before round 1 exists, or during round 1
until it locks, the same window adding gets. Past that, removing would delete picks a locked
round is about to be scored on. The route enforces it too, with `COMPETITION_STARTED`.

This is not `remove-player`. That route refunds a credit on the assumption one was spent getting
the player in — nothing charges on the way in here, so using it would mint credit out of
nothing.

### Growing the pool

**Create bots** in the Bot pool panel adds more, continuing the name series (`Bot Uma`,
`Bot Victor`, …). Up to 20 per press.

The pool is shared: the same bot can be in any number of competitions at once. So it only has to
be as big as the largest single competition, not the total across all of them.

---

## API reference

All under `/admin/*`, all requiring an admin token (`middleware/admin-auth.js`).

| Route | Method | Purpose |
|---|---|---|
| `/admin/get-bots` | GET | Pool, eligible competitions, and one competition's bots and picks |
| `/admin/create-bots` | POST | Add new bots to the pool |
| `/admin/add-bots-to-competition` | POST | Put bots into a competition |
| `/admin/remove-bot-from-competition` | POST | Take one bot out and delete its history there |
| `/admin/set-bot-picks` | POST | Random picks for bots that have not picked |
| `/admin/set-bot-pick` | POST | Set or clear one bot's pick |

Each route's header block carries its full payload, response and return codes.

### Return codes worth knowing

| Code | Meaning |
|---|---|
| `COMPETITION_NOT_ELIGIBLE` | That competition's organiser may not use bots |
| `COMPETITION_STARTED` | Round 2 exists, or round 1 has locked — too late to add bots |
| `NO_BOTS_AVAILABLE` | Every bot in the pool is already in this competition |
| `NOT_A_BOT` | The user_id is a real account — the guard on the delete path |
| `NO_ROUNDS` / `NO_FIXTURES` | Nothing to pick from yet |
| `ROUND_LOCKED` | Picking has closed for this round |
| `TEAM_NOT_IN_ROUND` | That team is not playing this round |
| `TEAM_ALREADY_USED` | no-team-twice is on and this bot has used that team |

---

## Notes

- **No email ever reaches a bot.** Bot addresses end `@lms-guest.com`, which every send route
  already skips. This is why new bots must keep the `bot_<name>@lms-guest.com` shape — a bot
  created outside it would start receiving player email.
- **Picking never locks a round.** `checkAndLockRoundIfComplete` returns `AUTO_LOCK_DISABLED`
  before doing anything (`utils/roundLocking.js`); waiting for the first kickoff was judged more
  interesting than locking the moment the last pick lands.
- **Bots count as players everywhere else.** They appear in the platform stats on the admin
  Overview screen and in the organiser's own player counts. At current numbers that is noise,
  but it is worth remembering when reading those figures.
- **A bot picks under exactly the same rules as a person.** `set-bot-pick` runs the two checks
  `set-pick.js` runs on a human, in the same order: `TEAM_NOT_ALLOWED` against the
  `allowed_teams` table, then `TEAM_ALREADY_USED` against previous picks. The bulk route filters
  candidates the same way, and both write `allowed_teams` back exactly as a real pick does.
- **Bots get the same auto-reset players get.** `get-allowed-teams.js` has always rebuilt a
  player's `allowed_teams` from scratch when it is empty — that is the "you ran out of teams!"
  path. Bots never open that screen, so they never healed: competition 199's two oldest bots sat
  on zero rows while the humans beside them were correct. The bot routes now run the same
  rebuild (`services/allowedTeams.js`), so a bot heals the first time the Bots screen loads it.

## History

`/bot-join` and `/bot-pick` were deleted when this screen was built. They were public routes
guarded only by the string `BOT_MAGIC_2025`, which was committed in the repo and printed in this
document, so anyone with the repo could add bots to any competition by invite code. The same
reasoning retired that secret from the fixture-service routes earlier.

There is no legacy bot format. Older competitions were once said to hold bots with numeric
emails and realistic names; no such account exists in the database.
