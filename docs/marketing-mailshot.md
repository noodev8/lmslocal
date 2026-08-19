# Mailshot Plan

Working document, written 19 August 2026. Execution only — **who gets an envelope, where the
addresses come from, what it costs, and what came back.** Strategy, audiences and copy rules live
in `docs/marketing-strategy.md`; artwork lives in `lmslocal-marketing/`.

Same rule as the strategy doc: **delete a section that stops being useful rather than leaving it
to rot.** The results log at §8 is the part that matters — fill it in during the season.

---

## 1. The decision

**Addressed physical mail, self-fulfilled, in small measured batches.** Not cold email, not an
agency, not door drops.

Three reasons, in order of weight:

1. **There is no usable email list, and building one puts the product's email at risk.** Real
   product mail goes through Resend on our sending domain. Cold bulk from the same domain or
   account risks reputation damage or suspension, which takes pick reminders and join
   confirmations down with it. If cold email ever happens it is a separate domain on a separate
   account — never `deliver()`'s infrastructure.
2. **The legal position is clean for post and murky for email.** Addressed business post has no
   consent regime. UK PECR allows B2B email to limited companies with an opt-out, but a large
   share of pubs and clubs are sole traders or unincorporated associations, which count as
   individuals and need consent we do not have.
3. **A letter reaches a desk in the building where the decision is made.** A club secretary opens
   the post. A club's shared inbox is checked by nobody in particular.

---

## 2. Who gets it

**Clubs only — audience D in `marketing-strategy.md` §4.** Clubs are the audience actually using
the product. A club of 60 crosses the free tier immediately, there is no gatekeeper, and the buyer
is the user. Artwork: `a5-club-a.html` and `a5-club-b.html`.

**Pubs are deliberately not in this batch.** An earlier version split it 75/25 to keep a pub probe
running alongside. Dropped on 19 Aug 2026, for the reason the arithmetic at §7 makes plain: a
100-piece cell cannot produce a readable number, so the probe would have cost a quarter of the
budget to learn nothing. Splitting a batch this size across two audiences means measuring neither.

**This is a decision about batch one, not about pubs.** The landlord mailer
(`a5-landlord-post.html`) stays built and ready. Pubs get their own batch, at their own size, once
the club number tells us what a working response rate looks like — and it is worth knowing that
strategy §2 predicts a lower one, because a cold letter asks the landlord to invent the idea
themselves, which a regular normally does for them.

---

## 3. Timing

**The season is the window, and the window is wide.** Roughly **August to February** — after that
the fixture list gets disjointed and the format stops working. Within it:

- A competition can start at any point, and finished competitions get restarted.
- So there is **no single annual shot to miss.** Every letter has a live entry point, the same
  property that makes the free national game work continuously (`marketing-strategy.md` §3).

That kills the "hold everything for January" idea. **Post in steady batches across the season
instead**, and treat the calendar as a series of nudges rather than a deadline:

| Moment | Why it is a good week to land |
|---|---|
| Early season | Fever is highest, and a comp started now runs its full length |
| Around a cup weekend or international break | Organiser has a gap and is thinking about fixtures |
| Late December | New Year, second-half comp, everyone is out of the first one |
| Early February | Last honest start before the fixtures fall apart — say so plainly |

**Print shelf life:** anything printed carrying "free right now" (fixture service, done-for-you
setup) stops being true when pricing changes. Another reason batches stay small — a 5,000 print
run is cheap per unit and worthless the day the offer ends.

---

## 4. Where the addresses come from

**Built, not bought.** Brokered pub/club data is mostly resold from these same public sources,
aged, at 15–30p a record.

**Geography: the whole UK.** There is no reason to hold to one region — the product is national,
the fixtures are national, and a UK-wide draw is more representative than one county. **One
condition: sample it randomly.** Taking the first 300 rows alphabetically or by county means
accidentally testing Bedfordshire, which is the confound the region rule was there to avoid.

**Sport: football first, but sporty is the real filter.** Live Premier League is the hook, so
football clubs go to the front of the list. Club *type* beyond that looks unlikely to hurt —
cricket, rugby, bowls and social clubs all have members, a bar and a season — so the list is
football-weighted rather than football-only, and the codes at §7 record which is which. Treat any
difference as **observation, not a test**; see the note there on cell sizes.

**Clubs — best first:**

- **HMRC CASC register.** Public list of registered Community Amateur Sports Clubs. A few
  thousand, all real, all constituted, all with a committee. Probably the single best list here.
- **CIU** (Club and Institute Union) — working men's and social clubs. Culturally the closest
  thing to a pub that behaves like a club.
- **Sport by sport:** county FA lists / FA Full-Time, RFU club finder, England Golf, county cricket
  league sites, bowls associations. Tedious, but yields the club's real name and often a role
  title to address.

**Pubs, and gap-filling for clubs:**

- **FSA Food Hygiene Rating Scheme API.** Free, every licensed premises in the country with a full
  address, filterable by business type and local authority. Every pub and club is on it because
  they are all inspected. Sortable by postcode district, which is what makes region-at-a-time
  testing possible.
- **Google Places / OpenStreetMap** for filling gaps and sanity-checking addresses.

**Addressee:** "The Secretary" for clubs, "The Landlord" for pubs, unless a real name is on the
list. Both are normal and neither reads as junk.

**Hygiene:** deduplicate on address not name, drop anything without a postcode, and keep a sent
log so batch two never re-hits batch one.

---

## 5. Self-fulfil or mailing house

**The rule is about postage rates, not labour.**

- **Under 1,000 pieces: do it yourself.** There is no bulk rate to access at that volume, so a
  mailing house is just someone paid to fold paper.
- **Over 1,000: use a mailing house**, because they hold a Royal Mail bulk account. Advertising
  Mail starts at 1,000 items and runs roughly 40–55p against a ~90p 2nd class stamp. Their
  fulfilment fee is less than the postage they save.

**Open: the existing Royal Mail business account.** There is one already, on the ecommerce side of
the other business. Two things to check before assuming it helps:

- It is a **parcels** account. Letter products — Advertising Mail, Mailmark — are separate
  services with their own contract terms, minimum volumes and data-prep requirements (sortation,
  address file format, barcoding). A parcels account does not automatically carry them.
- Postage bought on the other entity's account for LMSLocal mail is a **bookkeeping question**.
  Worth thirty seconds with whoever does the books rather than discovering it at year end.

If the account does extend to letter products at volume, the 1,000-piece threshold above moves
down and self-fulfilling stays viable much further up. **Check the rates before batch two.**

---

## 6. What it costs

DIY, 400 addressed pieces — the batch-one shape. See §7 for why 400 and not 100:

| | |
|---|---|
| Print, 400 × A5 on silk (200 `a5-club-a.html`, 200 `a5-club-b.html`) | £45–80 |
| C5 envelopes + address labels | £20 |
| 2nd class stamps @ ~90p | ~£360 |
| **Total** | **~£450, or £1.10/piece** |

**Postage is the entire cost. Print is noise.** The operative consequence: printing more is nearly
free, sending more is not. Do not agonise over the run length; agonise over the list.

Via a mailing house, 2,000 pieces: roughly 55–75p all-in including print, postage and fulfilment —
about £1,300. Cheaper per unit, three times the total outlay.

**Expected return.** Cold addressed B2B mail with no prior relationship: **0.5–1.5% response** is
the honest range. At 400 pieces that is **2 to 6 people getting in touch.** Judge the batch
against that, not against a hoped-for fifty. Whether it is worth £450 depends on what a repeat
club organiser is worth across a season — see `marketing-strategy.md` §1: the money is in
organisers who run competitions *plural*, over twenty players.

---

## 7. Batch one

**400 clubs, ~£450, self-fulfilled over two evenings.**

- **400 clubs**, UK-wide, randomly sampled, football clubs weighted to the front (§4). No pubs.
- **200 `a5-club-a.html` / 200 `a5-club-b.html`.** Both sell fundraising; what differs is the
  route in — A leads on the promise ("a fundraiser that runs itself"), B leads on the hook and
  then states the mechanism ("members pay in, the club keeps the rest").
### Measurement: the list and the QR do different jobs

**Both, not either.** They answer different questions and neither substitutes for the other.

- **The sent list** identifies who *acted*. Every address is recorded against a variant, so anyone
  who rings or emails is attributable with no technology at all. This is the strong signal —
  replies are what convert.
- **The QR counts who *looked*.** Looking costs nothing and ringing a stranger costs something, so
  scans should outnumber replies several times over. At 400 pieces, where replies are expected to
  be 2–6, **the scan count is likely the only statistically meaningful number in the batch.**

The pair is what makes a thin batch readable:

| Scans | Replies | Reading |
|---|---|---|
| ~30 | 0–1 | The sheet works, the **ask** is wrong — a copy fix |
| ~0 | 0 | The sheet or the **list** is wrong — a targeting fix |
| ~30 | 4+ | It works; size batch two off this |

Without scans, "3 replies" cannot be told apart from the first two rows, which need opposite fixes.

**How it works.** Each variant carries its own code and its own printed URL —
`lmslocal.co.uk/club-a` on the A sheet, `/club-b` on B (`assets/club-a-qr.png`,
`club-b-qr.png`). Nothing else anywhere links to those paths, so **every hit is a leaflet.** That
is why it is a distinct path and not `?src=` on the homepage: query strings get stripped, shared
and lost when someone retypes. The URL is printed under the code because a QR is unreadable to a
human and some people will type it.

**Stored per scan: a timestamp and which variant.** Deliberately no IP address — counting does not
need one, and not holding it keeps this clear of anything needing a cookie banner or a
privacy-policy change. This counts scans; it does not identify clubs.

The pub leaflet (`a5-landlord.html`) carries the same mechanism at `/bar-a` — `bar-a-qr.png`,
named for the audience rather than a variant, with no `/bar-b`. It is not part of this mailshot
and its scans are a separate number; `a5-landlord-post.html` still carries the generic
`site-qr.png` and is in neither.

**Built, 19 Aug 2026.** `lmslocal-web/src/app/club-a/page.tsx`, `club-b/page.tsx` and
`bar-a/page.tsx` each render the homepage component — one design, two addresses, so nothing diverges when the homepage changes.
All three carry `noindex, follow` and inherit a canonical pointing at `/` from the root layout;
**none is disallowed in `robots.ts`, and none must be** — a crawler that is blocked never fetches
the page, so it never reads the noindex. None is listed in `sitemap.ts` either: they are not pages
we want indexed, and a sitemap entry contradicts the noindex. Vercel Web Analytics is enabled and `@vercel/analytics` is in the root layout.

**Hobby plan, so page views only** — custom events and UTM parameters are Pro features, which is
why the design counts paths. Free to 50,000 events a month; over that, collection pauses rather
than bills. **The reporting window is one month**, and mail responds over three weeks with a long
tail, so **write the counts into §8 weekly** rather than trusting the dashboard to still hold
them.

**A join code was considered and rejected** for this piece: `/join/CLUBA` would tie a scan to a
signup, but the leaflet asks the organiser to *start* a competition, not join ours, so the join
flow is the wrong destination.

- **Record the variant and the club type against every address before it goes out** (football /
  other). Costs nothing, and it is the only way the sent list can be read afterwards — see the
  measurement note below.
- **Log the send date.** Addressed mail responds over about three weeks with a long tail. Do not
  call it at day four.

### How many is enough

**The question a batch has to answer is "would zero replies mean anything?"** If zero is a
perfectly ordinary outcome even when the campaign is working, the batch cannot fail, which means
it cannot succeed either — it just costs money.

At a 1% response rate:

| Pieces | Expected replies | Chance of **zero** replies | Verdict |
|---|---|---|---|
| 100 | 1 | **37%** | Cannot fail, so cannot inform |
| 200 | 2 | 13% | Still coin-flippy |
| **400** | **4** | **2%** | Zero now genuinely means it did not work |
| 1,000 | 10 | negligible | Batch two territory |

**So 100 is not worth sending as a test.** Getting nothing back from 100 is equally consistent
with a 1% rate that would make the channel work and a 0.2% rate that would kill it, and there is
no way to tell which from the result. You would have spent £110 to arrive back where you started,
with the added danger of concluding "mail does not work" on evidence that says nothing of the
kind.

**400 is the smallest batch where a null result is informative**, and it lands on the budget
ceiling now that pubs are out. That is the recommendation.

**100 is worth sending as a dry run**, which is a different thing and should be called one: does
the list build produce real addresses, does the print look right in an envelope, how long does an
evening of stuffing actually take, does anything bounce. Run it as a rehearsal with no expectation
of replies, or skip it and go straight to 400 — but do not run it and then read the response
count.

### What 400 still cannot do

It cannot pick a winner between A and B. At 200 a side, four replies split three-one is noise, not
a result. The split earns its place for two non-statistical reasons: printing both costs nothing
(§6 — postage is the whole cost), and **the few who do reply can be asked which sheet they got and
what made them pick the phone up.** That conversation is the real output. Do not retire a variant
on this batch.

The creative test is **batch two's job**, at 1,000+, once §5's rate check says what that costs.

### The third variant

A more graphical design is being generated separately (Nano Banana) against the same brief. It is
**not in batch one** — it arrives after the print run and has not been through the design system.
Slot it in as the third arm at batch two, where the volume can actually separate it from the two
HTML sheets. Worth checking it against `design-system.md` §9 copy rules before it goes anywhere
near a printer, and against §5 of the strategy doc if it says anything about money.

**Not planned: walking in.** Handing one over converts far better and surfaces the objection you
cannot hear through a letterbox, but it is not something to build a plan on. If a couple happen
opportunistically, write down what they said — that is the value, not the signup.

---

## 8. Results log

Fill this in as batches land. The empty rows are the point of the document.

| Batch | Date sent | Audience | Variant | Code | Qty | Cost | Responses | Signups | Notes |
|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | |

---

## 8b. Next job: building the list

**Everything else for batch one is done.** Leaflets designed, QR codes generated, print PDFs in
`lmslocal-marketing/out/`, `/club-a` and `/club-b` live and counting. The list is the only thing
standing between here and posting.

**The deliverable:** a CSV of **400 UK clubs**, ready to mail-merge onto labels.

Columns: `club_name`, `addressee`, `address_1`, `address_2`, `town`, `postcode`, `club_type`
(football / other), `variant` (a / b), `source`, `date_added`.

**How it has to be built** — the rules that make the result readable, all of them from §4 and §7:

1. **Sources, in order of quality:** HMRC CASC register first (constituted, has a committee), then
   CIU, then sport-by-sport lists, then the FSA FHRS API to gap-fill and verify addresses.
2. **UK-wide, randomly sampled.** Not the first 400 rows alphabetically or by county — that
   silently turns a national test into a county one.
3. **Football-weighted, not football-only.** Live Premier League is the hook; cricket, rugby,
   bowls and social clubs all have members, a bar and a season. Record `club_type` so any
   difference can be *observed*, but it is not a test — the cells are far too small.
4. **200 variant a / 200 variant b**, assigned randomly, not by source or region — otherwise the
   variant is confounded with whatever the list was ordered by.
5. **Addressee is "The Secretary"** unless a real name is on the source. Both read as normal post.
6. **Hygiene:** deduplicate on address rather than name, drop anything without a postcode, and
   keep the file as the permanent sent log so batch two never re-hits batch one.

**Before it posts:** note the current `/club-a` and `/club-b` scan counts as the baseline — the
test scans of 19 Aug are in there — and record the send date in §8.

### Built, 19 Aug 2026

`lmslocal-marketing/list/` — see its README. Two files matter:

- **`pool.csv` — the full clean list, 7,714 UK clubs.** This is the reusable asset; the list
  build does not have to happen again. A later batch is a **draw from this**, not a rebuild.
- **`batch-one.csv`** — the 400 being posted, with variant and addressee.

Rebuild both with `python build_pool.py && python sample.py`. The draw is seeded (`SEED =
20260819`), so it reproduces byte for byte. **Batch two is one command, and must pass
`--exclude`** — that flag is the whole of hygiene rule 6, and it matches on address rather than
name, the same way the pool dedupes:

```bash
python sample.py --n 400 --out batch-two.csv --seed 20260901 --exclude "batch-*.csv"
```

**Only the scripts and the source `.ods` are in git; `pool.*` and `batch-*.csv` are ignored.**
This repo is public. The register is Open Government Licence data so mirroring it is fine, but
the batch files record *who we mailed* and eventually who replied — our own data about named
people, most of them at home addresses. They regenerate from the tracked inputs, so nothing needs
syncing between machines **except the sent log once a batch is actually posted**, which stops
being reproducible the moment it carries results.

**The CASC register alone was enough.** 8,128 rows in, 7,714 mailable after hygiene, spread over
133 postcode areas. CIU and the sport-by-sport lists were not needed and were not touched — they
are batch two's problem, at 1,000+.

**Two things about the CASC file that cost an hour each if met cold:**

- **It wraps every field at 40 characters by injecting a space mid-word.** 355 names are affected,
  and unfixed they print as `ABERDEEN AND DISTRICT ANGLING ASSOCIATIO N`. It cannot be undone by
  rule alone: 43 of the 355 have a *genuine* space at that position (`… Club Limited`) and joining
  those is just as wrong. `dewrap.py` decides with three tests and its docstring says why fragment
  frequency alone fails — "on" is commoner than "association". The 43 kept spaces were reviewed by
  hand.
- **1,519 rows repeat the club name as address line 1**, and a county often sits where the town
  should. Both are stripped in `build_pool.py`.

**The FSA FHRS pass was dropped, and rule 1 above overstates it.** Measured against a random 40
clubs, name lookup matched **5 confirmed and 2 name-only — 12.5%**. Small clubs register under a
different trading name and most have no food registration at all. So FHRS presence **cannot be
used as a filter** — it would discard seven eligible clubs in eight — and as address verification
it is mostly silence. **Postcode validation via postcodes.io replaced it**, which is cheap, covers
100%, and found 12 dead postcodes in the drawn sample. Do not spend the afternoon on FHRS again
without a better join key than the club's name.

**Worth knowing when reading the replies:** a large share of CASC addresses are the secretary's
home, not a clubhouse. That fits "The Secretary" as addressee and puts the sheet on a real
person's doormat, but it means it will not be seen on a club noticeboard — so do not expect the
second-hand reach a clubhouse drop would get.

**The file holds personal addresses.** It is the permanent sent log per rule 6 and has to persist,
but treat it accordingly if the repo ever goes public.

## 9. Open questions

- Does the existing Royal Mail account reach letter products, and at what rate? (§5)
- Nothing blocking the print run — measurement is built (see log).
- Does the graphical variant beat either HTML sheet enough to justify commissioning more of them?
- Does a mailed club convert differently from a searched-for club, once there are enough to tell?

---

## Log

| Date | What |
|---|---|
| 19 Aug 2026 | Doc created. Settled: addressed post over cold email, because there is no usable email list and cold bulk endangers the product's own sending reputation. Settled: clubs 75 / pubs 25, pubs as a measured probe rather than a campaign. |
| 19 Aug 2026 | Region constraint dropped — UK-wide, randomly sampled. Football clubs to the front of the list because live Premier League is the hook, but the filter is "sporty club with members and a bar", not football only. |
| 19 Aug 2026 | `a5-club-b.html` built as the club variant. It tests the **motivation**, not the wording: A sells fundraising, B sells a club that stays talking between fixtures. Survival sheet, price and contact held identical so the top of the sheet is the only variable. |
| 19 Aug 2026 | Measurement built. `/club-a` and `/club-b` render the homepage component with `noindex, follow`; Vercel Web Analytics enabled and wired into the root layout. Two things worth not re-deriving: the pages are deliberately **not** blocked in `robots.ts`, because a disallowed crawler never reads the noindex; and the Hobby plan collects page views but not custom events or UTM parameters, which is why the tracking is path-based. |
| 19 Aug 2026 | Measurement settled: the sent list and the QR both, doing different jobs — the list identifies who acted, the QR counts who looked, and at 400 pieces the scan count is likely the only meaningful number. Per-variant paths `/club-a` and `/club-b`, distinct paths rather than `?src=` because query strings get stripped and retyped away. Timestamp and variant only, no IP. Neither page exists yet and the site has no analytics at all, so this is a blocker on printing. |
| 19 Aug 2026 | Batch one is **clubs only, 400 pieces, 200/200 A and B**. Pubs dropped from it — not abandoned, just given their own batch later, because a 100-piece pub cell has a 37% chance of returning zero replies even when the channel works, and would have spent a quarter of the budget on an unreadable number. 400 is the smallest batch where zero replies genuinely means it did not work. |
| 19 Aug 2026 | B's money message moved to **first in the body**, directly under the rule, and reworded to "Members pay in. The club keeps the rest." At the bottom of the sheet it was read seventh and missed on a full read-through — the fault was reading order, not wording. Paid for in height by cutting the lead to one line. B is no longer a belonging-versus-money test: both sheets sell fundraising, and what differs is the route in. |
| 19 Aug 2026 | B's funding message promoted from a clause in the lead to a display-size block — "You set the entry · You set the prize / **The rest goes to the club**", our own price riding underneath. Paid for in height by cutting the season list to one line per item, because the previous draft overflowed the sheet and silently clipped the contact block. The two sheets now differ in more than the headline, so a win cannot be attributed to the headline alone — acceptable, since §7 already says this batch cannot pick a creative winner. |
| 19 Aug 2026 | Both club sheets now carry the fundraising line — a club that cannot see the money angle has no reason to act. Narrows the test from "money or not" to "which motivation leads", which is weaker but honest; B keeps it as the last sentence of the lead, under a headline about the club talking. Site QR added to both, beside the wordmark rather than under it so it costs the sheet no height. |
| 19 Aug 2026 | Recorded what batch one cannot do: at 150 per cell it cannot pick a creative winner, only tell us whether addressed mail works at all. The split stays because print is free and responders can be asked. Creative test deferred to batch two, where the graphical (Nano Banana) variant joins as a third arm. |
| 19 Aug 2026 | Timing rewritten before it was ever acted on. A first draft treated late August as a missed window and proposed holding everything for January; wrong — the season runs to February, competitions start at any point and finished ones restart, so every letter has a live entry point. Steady batches across the season, not one annual shot. |
| 19 Aug 2026 | List built — 400 clubs, `lmslocal-marketing/list/batch-one.csv`, seeded and reproducible. Settled: the HMRC CASC register alone covers a 400 batch, so CIU and the sport-by-sport lists went untouched. Football weighted to 50% against a natural 10.6%. **FSA FHRS dropped from the pipeline** — a 12.5% name-match rate makes it unusable as a filter and near-silent as verification; postcodes.io validates every record instead. The CASC export wraps fields at 40 characters mid-word, which is the one trap that would have reached the labels. |
| 19 Aug 2026 | List work made reusable. `pool.csv` keeps all **7,714** clean clubs, so the build never has to happen twice — later batches are a draw from it via `sample.py --exclude`, which enforces hygiene rule 6 on address rather than name (verified: zero overlap between a drawn batch one and batch two). Settled what goes in git, the repo being public: scripts and the OGL-licensed source `.ods` tracked, `pool.*` and `batch-*.csv` ignored — they regenerate byte-identically, and the batch files are our own record of who we mailed rather than public data. The sent log is the one thing that must be moved between machines by hand. |
