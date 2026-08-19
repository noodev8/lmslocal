# Leaflet Plan

Working document, written 19 August 2026, **rewritten the same day when the plan changed**.
Execution only — who gets a leaflet, how it reaches them, what it costs, and what came back.
Strategy, audiences and copy rules live in `docs/marketing-strategy.md`; artwork lives in
`lmslocal-marketing/`.

**The filename still says "mailshot" because ten files link to it.** The plan no longer does.
Addressed mail is §6, on hold.

Same rule as the strategy doc: **delete a section that stops being useful rather than leaving it
to rot.** The logs at §7 are the part that matters — fill them in as it happens.

---

## 1. The decision

**Hand the pub leaflet to local bars that advertise live sport. Do that before spending £450 on
post.**

The previous plan — 400 addressed letters to clubs, £450, everything built and ready to go — is
not cancelled. It is **held at §6** until some real landlords have held the sheet.

Three reasons, in order of weight:

1. **Nobody has ever seen the leaflet.** £450 of postage is a large amount to spend proving that
   the sheet reads well, when twenty conversations answer the same question for the price of the
   paper. The sheet has been through a design system and a copy review; it has not been through a
   landlord.
2. **A letter cannot answer a question, and a person can.** The objection that kills this — "who
   is going to run it?", "we already do a sweepstake", "my regulars are not on their phones" —
   never arrives through a letterbox. It arrives across a bar, and only if someone is standing
   there. That is the output of walking in, more than any signup.
3. **The offer is now something you can actually make in person.** The sheet says *I will help set
   this up with you.* Delivered by hand that is a sentence with a face attached; posted, it is a
   claim from a stranger.

**This is not a test, and must not be written up as one.** Twenty or thirty bars, chosen by
walking past them, is a sales round. It cannot produce a response rate, and any number that comes
out of it should not be compared with the mail arithmetic at §6 — see §5.

---

## 2. Who gets one

**Bars advertising live sport.** The filter is the poster in the window: Sky, TNT, "LIVE FOOTBALL
HERE", a fixture list on a chalkboard.

It is a good filter for one reason that has nothing to do with football fandom: **they are already
paying for it.** A pub with a sports subscription has decided that live football is how it fills
the room, and it costs them real money every month. Last Man Standing is the same bet with no
monthly fee — a reason for the same people to be in on a Tuesday as well as a Saturday. A pub with
no screens has to be sold the whole idea first.

**Where the pitch comes from — a real one, not a hypothetical.** A pub locally is running Last Man
Standing by hand right now: £X in, pot split 50/50 — half to the winner, half to the football team
that drinks there after games, for shirts and pitch fees. The team *is* the regulars. That is
worth telling other landlords because it is true, it is nearby, and it answers "what is in it for
me" without a spreadsheet. It is also why the pub sheet carries a fundraising line even though
strategy §5 says pubs want footfall and clubs want funds — see the comment in `a5-landlord.html`,
which exists so nobody deletes that line as off-strategy.

**Keep it open, though.** Plenty of bars have no Sunday side. The sheet says "the team that drinks
in your bar, **or anything else**" for exactly that reason, and in conversation the same applies —
the local team, a charity, or straight to the winner with the bar keeping the trade.

**Worth knowing before the walk: who can actually say yes.** A free house or a tenanted pub
decides at the bar. A managed house on a large operator's estate often cannot — the manager may
want it and still have no authority to run anything with money in it. Not a reason to skip them,
but it is the difference between "no" and "not my call", and only one of those is about the
product.

---

## 3. What to carry

**`lmslocal-marketing/leaflet/a5-landlord.html`.** A5, single sided, reads one-handed on a bar.

- **Print short runs.** `node make-pdf.js a5-landlord --home` for your own printer,
  `node make-pdf.js a5-landlord` for a print shop (154 × 216mm, 3mm bleed, text outlined). Never
  print the HTML by hand — a `file://` page silently falls back to Arial for two of the three
  brand fonts. `lmslocal-marketing/README.md` has the detail.
- **It carries `bar-a-qr.png` → `lmslocal.co.uk/bar-a`**, which is how a scan gets counted (§5).
- **Not the club sheets.** `a5-club-a.html` and `a5-club-b.html` are the club A/B pair and sell
  fundraising to a committee.
- **Not `a5-landlord-post.html`.** That is the posted version, with a note on its back page for a
  cold envelope, and it still carries the generic `site-qr.png`. Handed over in person the note is
  redundant and the scan is uncounted.

**The sheet is full.** It is a fixed 210mm with `overflow:hidden`, so anything added is clipped
silently from the bottom — the contact block goes first. Two additions already did this. If a
conversation suggests a change, something else comes off; the file says so at the top.

---

## 4. The ask

Talk to whoever is behind the bar, get to the landlord, leave the sheet either way.

The sheet's own ask is **"Talk to Andreas — I will help set this up with you"**, and in person that
is the whole pitch: not "sign up", but "I will do the first one with you". The product supports it
— a competition can start whenever the organiser presses Ready, and 20 players are free with no
card, so there is nothing to close.

Things worth having straight before walking in, because they are the questions that get asked:

- **What it costs them:** nothing to 20 players. Packs from £10 after that.
- **Who does the work each week:** nobody — rounds go up on their own, players pick on their
  phones, and whoever has no phone gets their pick put in by the landlord.
- **Where the money goes:** wherever they say. LMSLocal never touches it (terms §6). Never quote
  an amount they might raise.
- **When it can start:** whenever they are ready, and a finished competition gets restarted. The
  season runs roughly to February, after which the fixture list gets disjointed and the format
  stops working — say that plainly rather than selling a February start.

---

## 5. What can be read off this, and what cannot

**The conversation is the output.** Write down what was said, especially the objection, on the day
— it is worth more than the count of leaflets left, and it is gone by the weekend.

**The scan count is the only number.** `bar-a-qr.png` resolves to `lmslocal.co.uk/bar-a`; nothing
else anywhere links to that path, so every page view is a scan of the pub leaflet. Vercel Web
Analytics reports it by path with no extra code.

**Do not read a rate off it.** Twenty bars is not a sample of anything, the bars were chosen by
walking past them, and you were standing there — which is the point of the exercise and also the
thing that makes the number unrepresentative of a leaflet that arrives alone. The mail arithmetic
at §6 exists precisely because 100 pieces cannot produce a readable number; thirty hand-delivered
sheets certainly cannot. **This round decides whether the sheet and the pitch work at all**, on
evidence you can hear. The measurable version is §6, later, if it is still wanted.

### The three paths and the rules that keep them countable

| Path | Sheet | QR asset |
|---|---|---|
| `/bar-a` | `a5-landlord.html` (pub, hand-delivered) | `bar-a-qr.png` |
| `/club-a` | `a5-club-a.html` (club mail, held) | `club-a-qr.png` |
| `/club-b` | `a5-club-b.html` (club mail, held) | `club-b-qr.png` |

Each renders the homepage component — one design, several addresses, so nothing diverges when the
homepage changes. Named for the audience, not the sheet: `/club-a` and `/club-b` are an A/B pair,
`/bar-a` is the pub sheet and there is no `/bar-b`.

All three carry `noindex, follow` and inherit a canonical pointing at `/` from the root layout;
**none is disallowed in `robots.ts`, and none must be** — a crawler that is blocked never fetches
the page, so it never reads the noindex. None is in `sitemap.ts` either: a sitemap entry
contradicts the noindex, and crawler hits would land in the scan count and inflate it.

**Distinct paths rather than `?src=`** because query strings get stripped, shared and lost when
someone retypes. **Hobby plan, so page views only** — custom events and UTM parameters are Pro
features, which is why the tracking is path-based. Free to 50,000 events a month; over that,
collection pauses rather than bills. **The reporting window is one month**, so write counts into
§7 as you go rather than trusting the dashboard to still hold them.

**A join code was considered and rejected:** `/join/CLUBA` would tie a scan to a signup, but the
leaflet asks the organiser to *start* a competition, not to join ours.

**Note the current scan counts before the first walk** — the test scans of 19 Aug are in there.

---

## 6. The club mail batch — built, held

**Everything for this exists.** It is not cancelled and nothing should be deleted: if the walk-in
round says the sheet works, this is how it goes to 400 clubs who are nowhere near here. What it is
waiting for is evidence that a cold reader acts on the artwork, which is exactly what §1 is for.

**The shape:** 400 UK clubs, self-fulfilled, ~£450, 200 `a5-club-a.html` / 200 `a5-club-b.html`.

**Why post and not cold email** — the reasoning has not changed and is worth not re-deriving:

1. **There is no usable email list, and building one puts the product's email at risk.** Real
   product mail goes through Resend on our sending domain; cold bulk from the same domain or
   account risks reputation damage or suspension, which takes pick reminders and join
   confirmations down with it. If cold email ever happens it is a separate domain on a separate
   account — never `deliver()`'s infrastructure.
2. **The legal position is clean for post and murky for email.** Addressed business post has no
   consent regime. UK PECR allows B2B email to limited companies with an opt-out, but a large
   share of pubs and clubs are sole traders or unincorporated associations, which count as
   individuals and need consent we do not have.
3. **A letter reaches a desk in the building where the decision is made.** A club secretary opens
   the post; a club's shared inbox is checked by nobody in particular.

**Cost, DIY, 400 pieces:**

| | |
|---|---|
| Print, 400 × A5 on silk | £45–80 |
| C5 envelopes + address labels | £20 |
| 2nd class stamps @ ~90p | ~£360 |
| **Total** | **~£450, or £1.10/piece** |

**Postage is the entire cost. Print is noise.** Printing more is nearly free; sending more is not.
Do not agonise over the run length; agonise over the list. Via a mailing house at 2,000 pieces it
is roughly 55–75p all-in — cheaper per unit, three times the outlay. Under 1,000 pieces there is
no bulk rate to access, so a mailing house is just someone paid to fold paper. **Open question:**
the existing Royal Mail account is a *parcels* account, and letter products (Advertising Mail,
Mailmark) are separate services with their own contract terms and data-prep requirements — check
the rates before assuming it helps, and check with whoever does the books whether postage bought
on the other entity's account is a problem.

**Why 400 and not 100** — the arithmetic that decided it, at a 1% response rate:

| Pieces | Expected replies | Chance of **zero** replies | Verdict |
|---|---|---|---|
| 100 | 1 | **37%** | Cannot fail, so cannot inform |
| 200 | 2 | 13% | Still coin-flippy |
| **400** | **4** | **2%** | Zero now genuinely means it did not work |
| 1,000 | 10 | negligible | Batch two territory |

Cold addressed B2B mail with no prior relationship returns **0.5–1.5%** honestly, so 400 pieces
means **2 to 6 people getting in touch**. Judge it against that, not against a hoped-for fifty.
**400 also cannot pick a winner between A and B** — four replies split three-one is noise. The
split earns its place because printing both is free and **the few who reply can be asked which
sheet they got.**

**Timing, if it runs:** the season is the window and the window is wide — roughly August to
February, and a competition can start at any point, so there is no single annual shot to miss.
Post in steady batches. Anything printed carrying "free right now" stops being true when pricing
changes, which is another reason batches stay small.

### The list, built 19 Aug 2026

`lmslocal-marketing/list/` — see its README. **This is the reusable asset and the reason holding
the batch costs nothing.**

- **`pool.csv` — 7,714 clean UK clubs.** A later batch is a **draw from this**, not a rebuild.
- **`batch-one.csv`** — the 400 drawn, with variant and addressee.

Rebuild with `python build_pool.py && python sample.py`. The draw is seeded (`SEED = 20260819`) so
it reproduces byte for byte. **Batch two is one command, and must pass `--exclude`** — that flag is
the whole of hygiene rule 6, matching on address rather than name:

```bash
python sample.py --n 400 --out batch-two.csv --seed 20260901 --exclude "batch-*.csv"
```

**Only the scripts and the source `.ods` are in git; `pool.*` and `batch-*.csv` are ignored.** This
repo is public. The register is Open Government Licence data so mirroring it is fine, but the
batch files record *who we mailed* — our own data about named people, most at home addresses. They
regenerate from tracked inputs, so nothing needs syncing between machines **except the sent log
once a batch is actually posted**, which stops being reproducible the moment it carries results.

**Rules that make the result readable**, if it runs: UK-wide and **randomly sampled** (not the
first 400 alphabetically, which silently turns a national test into a county one);
football-weighted, not football-only, with `club_type` recorded as an *observation*, never a test;
**200/200 A and B assigned randomly**, not by source or region, or the variant is confounded with
whatever the list was ordered by; addressee **"The Secretary"** unless a real name is on the
source; deduplicate on address rather than name and drop anything without a postcode.

**Four things about the source data that cost an hour each if met cold:**

- **The CASC register alone was enough** — 8,128 rows in, 7,714 mailable, 133 postcode areas. CIU
  and the sport-by-sport lists were never touched; they are a 1,000+ problem.
- **The CASC export wraps every field at 40 characters by injecting a space mid-word.** 355 names
  affected, printing as `ABERDEEN AND DISTRICT ANGLING ASSOCIATIO N`. It cannot be undone by rule
  alone — 43 of the 355 have a *genuine* space there (`… Club Limited`). `dewrap.py` decides with
  three tests and its docstring says why fragment frequency alone fails.
- **1,519 rows repeat the club name as address line 1**, with a county often where the town should
  be. Both stripped in `build_pool.py`.
- **The FSA FHRS pass was dropped.** Against a random 40 clubs, name lookup matched **5 confirmed
  and 2 name-only — 12.5%**. It cannot be used as a filter (it would discard seven eligible clubs
  in eight) and is near-silent as verification. **postcodes.io replaced it** — cheap, 100% cover,
  and it found 12 dead postcodes in the drawn sample. Do not spend an afternoon on FHRS again
  without a better join key than the club's name.

**Worth knowing when reading replies:** a large share of CASC addresses are the secretary's home,
not a clubhouse. That fits "The Secretary" as addressee, but it means the sheet will not be seen on
a club noticeboard — do not expect the second-hand reach a clubhouse drop would get.

---

## 7. Logs

### Bars visited

Fill in on the day. The objection column is the one that matters.

| Date | Bar | Town | Live sport? | Spoke to | Left a sheet? | What they said / the objection |
|---|---|---|---|---|---|---|
| | | | | | | |

### Scans

`/bar-a` page views, from Vercel Web Analytics. Weekly, because the dashboard window is a month.

| Week ending | `/bar-a` | `/club-a` | `/club-b` | Notes |
|---|---|---|---|---|
| | | | | |

### Batches, if any post

| Batch | Date sent | Audience | Variant | Qty | Cost | Responses | Signups | Notes |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

---

## 8. Open questions

- Does a landlord, holding the sheet, get it in ten seconds? That is what the walk answers.
- What is the objection that comes up more than once? It is probably a product or copy fix, not a
  channel one.
- Is a hand-delivered pub sheet worth building a second variant for, or is the pitch doing the
  work?
- Does the existing Royal Mail account reach letter products, and at what rate? (§6)
- Does a graphical variant (Nano Banana, generated against the same brief, not yet through the
  design system) beat either HTML sheet enough to justify commissioning more? Batch-two question,
  and it needs a `design-system.md` §9 copy check before it goes near a printer.

---

## Log

| Date | What |
|---|---|
| 19 Aug 2026 | Doc created. Settled: addressed post over cold email, because there is no usable email list and cold bulk endangers the product's own sending reputation. |
| 19 Aug 2026 | Region constraint dropped — UK-wide, randomly sampled. Football clubs weighted to the front because live Premier League is the hook, but the filter is "sporty club with members and a bar", not football only. |
| 19 Aug 2026 | `a5-club-b.html` built as the club variant, testing the **motivation** rather than the wording. |
| 19 Aug 2026 | Measurement built. `/club-a` and `/club-b` render the homepage component with `noindex, follow`; Vercel Web Analytics enabled and wired into the root layout. Two things worth not re-deriving: the pages are deliberately **not** blocked in `robots.ts`, because a disallowed crawler never reads the noindex; and the Hobby plan collects page views but not custom events or UTM parameters, which is why the tracking is path-based. |
| 19 Aug 2026 | Batch one settled as **clubs only, 400 pieces, 200/200 A and B**. Pubs dropped from it because a 100-piece cell has a 37% chance of returning zero replies even when the channel works. 400 is the smallest batch where zero replies genuinely means it did not work. |
| 19 Aug 2026 | List built and made reusable. `pool.csv` keeps all **7,714** clean clubs; later batches are a draw from it via `sample.py --exclude`. **FSA FHRS dropped** — a 12.5% name-match rate makes it unusable as a filter; postcodes.io validates every record instead. The CASC export wraps fields at 40 characters mid-word, the one trap that would have reached the labels. |
| 19 Aug 2026 | **Plan changed: walk the pub sheet into local bars that advertise live sport, before spending £450 on post.** The mail batch is held at §6, not cancelled, and the list is why holding it costs nothing. Reasoning: nobody outside the project has held the leaflet yet, and twenty conversations answer "does this read?" for the price of the paper. This doc previously said in as many words that **walking in was "not something to build a plan on"** — that judgement was about scale, and scale is not the current problem; spending the postage before anyone has seen the sheet is. Accepted consequence: a walk-in round produces no response rate and must not be written up as a test. |
| 19 Aug 2026 | Pub sheet made the hand-delivery piece. `/bar-a` + `bar-a-qr.png` added so its scans are countable separately (`a5-landlord-post.html` keeps the generic code and is not in that number); fundraising line added and then sharpened to "the team that drinks in your bar, or anything else". The line looks like it contradicts strategy §5 — pubs want footfall, clubs want funds — and stays because **a real local pub is already running this by hand and splitting the pot 50/50 with the football team that drinks there**, for shirts and pitch fees. The team is the regulars, so footfall and fundraising are the same people. Recorded in the leaflet's own comments so it does not get "corrected" later. |
