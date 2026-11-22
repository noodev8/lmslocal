# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences, equally important on the public site (decided 2026-11-22):

- **Players.** Football fans who want a weekly Last Man Standing game on their phone. They arrive either
  from the national game or holding a join code an organiser gave them on a poster or in a WhatsApp message.
- **Organisers.** People who run a competition for their own crowd: amateur and junior sports clubs
  first, then pubs, then workplaces. Of the organisers who found the product on their own, clubs
  outnumbered pubs by an order of magnitude. A typical club runs it as a fundraiser, with half the pot
  going to the winner and half back to the club.

## Product Purpose

LMSLocal runs Last Man Standing football competitions. Each round, every player picks one team. A win
advances them; a draw, a loss or a missed pick knocks them out (or costs a life). They may not reuse a
team until every team has been used. The last one standing wins.

Two ways to play:

1. **The national game** (planned, not yet built). A free game on the Premier League. Every
   LMSLocal account is entered automatically, including people who joined through a club. The only
   prize is bragging rights; there is no prize and no entry fee.
2. **Organiser-run competitions.** Someone sets one up for their club, pub or workplace, hands out a
   join code, and the platform does the rounds, results and eliminations. The organiser sets any
   entry fee and prize and keeps all of it.

Success: players join the national game and keep coming back each round; organisers start
competitions, especially fundraisers.

## Positioning

- Every account plays in one shared national game *and* in as many local competitions as they belong to.
  "Local" stays in the name and means your club, your pub, your workplace.
- We never take a cut of entry fees and never see the money. The organiser keeps everything.
- Results and eliminations happen automatically, so organisers have no admin to do.
- Anyone can play, including someone who will not use an app: the organiser adds them and enters their picks.

## Operating Context

- Weekly rhythm: a round goes up midweek, players pick on Friday and Saturday, picks lock at the
  admin-set lock time, results arrive after full time, and standings get shared to WhatsApp or email.
- Results are judged on regulation time only (90 minutes plus stoppage).
- Players join an organiser's competition with a code or a link. The national game needs no code.
- Native apps: App Store (id6755344736) and Google Play (`uk.co.lmslocal.lmslocal_flutter`).
- Fixtures are either supplied by us for covered leagues or entered by the organiser. The choice is
  made per competition when it is created.

## Capabilities and Constraints

- Pricing for organisers: the first 20 player places are free with no card needed. Packs after that are
  +20 for £10, +50 for £20, +120 for £40. No subscription.
- The national game is **not built yet**. Until it is, the landing page mocks it with clearly
  placeholder facts.
- UK gambling: a free game with no payment is not gambling. The national game is free with no
  prize, and copy must keep it that way. Organisers own the legality of their own entry fees
  (see `/help/is-it-gambling`).
- The home page is the only page Google reliably crawls, so its in-body links to the help pages and
  the free downloads carry SEO weight.
- Stack: Next.js 15 / React 19 / Tailwind in `lmslocal-web/`.

## Brand Commitments

- The name is **LMSLocal** and the domain is lmslocal.co.uk. Both are kept.
- Voice: plain, honest and British. No hype, no invented claims.

## Evidence on Hand

- All-time real figures, last counted 2026-09-16, excluding our own organisers and bots: 34
  competitions, 30 organisers, 360 players. Update by hand; never inflate.
- Named causes that have been funded: an under-12s football team and a local foodbank, among others.
  We never see the money, so there is no total raised.
- A 41-second silent product film: `lmslocal-web/public/promo.mp4` and `promo-poster.jpg`.
- Free downloads: printable rules PDF (`/last-man-standing-rules.pdf`), spreadsheet template
  (`/last-man-standing-template`).
- **There are no testimonials or reviews. Never invent any.** There are no national-game figures yet either.

## Product Principles

- Prove it, don't claim it: show real screens and real numbers, even when they are small.
- Never state an opt-in feature as if everyone gets it.
- The organiser's money is theirs. Say so plainly.
- Nobody is left out for not using an app.

## Accessibility & Inclusion

Players and organisers range from junior-club parents to pub regulars who avoid technology. Copy
must work for both: legible type at phone sizes, and nothing that classifies people by age.
