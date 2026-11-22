'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Wordmark from '@/components/public/Wordmark';
import PublicFooter from '@/components/public/PublicFooter';
import Docket from '@/components/landing/Docket';
import { LABEL, EYEBROW, TICK } from '@/lib/design';

/**
 * Landing page. Visual direction is a football pools coupon: tinted stock, two
 * inks (deep green-black plus an overprint red), signage caps for display.
 *
 * Typography rule: the typewriter face (font-data) is reserved for things that
 * read as filled in by hand — entries on the sheet, figures in the ledger. All
 * interface labels use the body face, which stays legible at small sizes where
 * mono does not.
 *
 * Audience order: clubs first, then pubs, then workplaces — and pubs are never
 * dropped. Set 2026-08-18 from who actually turned up. The page was written for
 * pub landlords, but of the organisers who found us on their own the amateur and
 * junior sports clubs were an order of magnitude bigger (50 players across six
 * clubs against 6 across three pubs), and two of them independently wrote the
 * same prize structure by hand: half to the winner, half back to the club. That
 * is why the hero leads on what is left over rather than on footfall — a club
 * secretary sells a fundraiser to their own members, where a landlord has no
 * reason to push a winner-takes-all sweepstake. Do not reorder these without
 * new numbers.
 *
 * Voice rule: "you" on this page is always the organiser, never the player.
 * Anything the player does is written in the third person ("they pick").
 *
 * The two exceptions are the join strip at the very top and the players band
 * near the foot, which address the player directly as "you". Both are fenced
 * off visually — the strip by the ink bar, the band by being the one light
 * section between two dark ones — so the switch of audience is never something
 * the reader has to infer from the words. Do not let that voice leak into the
 * organiser sections between them.
 */

const WEEKEND = [
  {
    when: 'Midweek',
    what: 'The new round goes up',
    detail:
      'The round is built from the real fixture list and dropped straight into your competition, which is how most competitions run. If you would rather put the matches in yourself, you still can.',
  },
  {
    when: 'Friday, Saturday',
    what: 'Your players pick',
    detail:
      'One team each, on their phones. Anyone who has not got a phone tells you their team and you put it in for them. Picks lock an hour before kick-off, or at whatever time you set.',
  },
  {
    when: 'Full time',
    what: 'Results go in',
    detail:
      'They arrive on their own once the matches finish, or you enter the scores yourself if you are putting the matches in. Either way the eliminations follow — nobody works out who is still in by hand.',
  },
  {
    when: 'Sunday / Monday',
    what: 'You share the standings',
    detail:
      'A round update is written for you — who went out, who is left, who had the lucky escape. Copy it into WhatsApp, paste it into an email, or just send the link. That is the whole job.',
  },
];

/*
No price line on either card. This section answers "who keys the fixtures", and the two answers
do not cost the same, so a price beside each read as the reason to choose one - which it is not.
Pricing is one thing for the whole product and is stated on /pricing and in "Included either way"
below.
*/
const TWO_WAYS = [
  {
    title: 'We run the fixtures',
    detail:
      'Each round arrives already built, with results and eliminations following after full time. Best if you want it off your hands. Available on the leagues we cover.',
  },
  {
    title: 'You run the fixtures',
    detail:
      'You enter the fixtures and results yourself, round by round. Best if you want your own rounds, your own teams, or simply like holding the reins.',
  },
];


/*
Matchday, for its landing section. Each line is true of the build today, not of the plan - see the
section's own comment. "You" is the organiser, players are "they".
*/
const MATCHDAY_ROUND = [
  {
    what: 'The matches go up',
    detail:
      'We put every match of the gameweek in for you, and the results after full time. On Matchday there is nothing for you to enter.',
  },
  {
    what: 'They predict the winners',
    detail:
      'Home or away, match by match, as many as they like. They can change their minds until the round locks.',
  },
  {
    what: 'The table moves',
    detail:
      'Points go on as the results come in, and everyone can see who predicted what once the round has locked.',
  },
];

const MATCHDAY_DETAILS = [
  'The same price as Last Man Standing: one player, one place',
  'Level on points? Most wins, then most predictions made, decides it',
  'Joining closes when round 1 locks, as in Last Man Standing',
  'Played in a web browser for now, and coming to the app very soon',
  'Players make their own predictions; you cannot enter them for someone',
  'Runs on the leagues we cover, with our matches and results',
];

const INCLUDED = [
  '20 player places, free, no card needed',
  'Your own join code or link to hand out',
  'A printable A4 poster for the venue',
  'Eliminations worked out for you, either way',
  'No card to start, no subscription',
];

export default function LandingPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Two independent boxes, top strip and players band. Sharing one state would
  // mirror keystrokes between them, which reads as a glitch on the way past.
  const [code, setCode] = useState('');
  const [bandCode, setBandCode] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    const userData = localStorage.getItem('user');

    if (token && userData && userData !== 'undefined' && userData !== 'null') {
      try {
        JSON.parse(userData);
        setIsLoggedIn(true);
      } catch {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('user');
        setIsLoggedIn(false);
      }
    }
  }, []);

  // The join page looks the code up before asking for anything, and handles
  // signed in, signed out and expired sessions itself.
  const goToJoin = (raw: string) => {
    const trimmed = raw.trim().toUpperCase();
    if (!trimmed) return;
    router.push(`/join/${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="min-h-screen bg-stock font-body text-ink">
      {/* ---------------------------------------------------------------- */}
      {/* Player door: the only thing on the page addressed to players      */}
      {/* ---------------------------------------------------------------- */}
      <div className="sticky top-0 z-50 bg-ink shadow-[0_1px_0_0_rgba(221,225,214,0.18)]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            goToJoin(code);
          }}
          className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:justify-start sm:gap-4 sm:px-6 sm:py-3"
        >
          <label htmlFor="join-code" className={`${LABEL} text-stock/80`}>
            <span className="sm:hidden">Got a code?</span>
            <span className="hidden sm:inline">Got a code from your organiser?</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              id="join-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ENTER CODE"
              autoComplete="off"
              className="w-32 rounded-sm border border-stock/40 bg-transparent px-2.5 py-1.5 font-data text-sm uppercase tracking-[0.1em] text-stock placeholder:text-stock/50 focus:border-stock focus:outline-none sm:w-40 sm:px-3"
            />
            <button
              type="submit"
              className={`${LABEL} rounded-sm bg-overprint px-4 py-2 text-stock-lit transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stock`}
            >
              Join
            </button>
          </div>
        </form>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Header                                                            */}
      {/* ---------------------------------------------------------------- */}
      <header className="border-b border-ink/30">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Wordmark />
          <nav className="flex items-center gap-3 sm:gap-7">
            <Link href="/pricing" className={`${LABEL} text-ink-fade transition-colors hover:text-ink`}>
              Pricing
            </Link>
            <Link
              href="/help"
              className={`${LABEL} hidden text-ink-fade transition-colors hover:text-ink sm:block`}
            >
              Help
            </Link>
            {/*
            Signed out, the button names both doors. A lone "Sign in" reads as a door someone with
            no account cannot open, when registering is one link away behind it. It still goes to
            /login, which offers "Create one".

            The "/ Register" half is dropped below sm rather than shrunk: the wordmark and Pricing
            already fill a 360px header, and the full label pushes the row into overflow. Sign in
            is the half that must survive, because a returning user has nowhere else to go from
            here - someone without an account still has the two big CTAs further down the page.
            */}
            <Link
              href={isLoggedIn ? '/dashboard' : '/login'}
              className={`${LABEL} whitespace-nowrap rounded-sm border border-ink px-3 py-2 text-ink transition-colors hover:bg-ink hover:text-stock-lit sm:px-3.5`}
            >
              {isLoggedIn ? 'Dashboard' : <>Sign in<span className="hidden sm:inline"> / Register</span></>}
            </Link>
          </nav>
        </div>
      </header>

      {/* ---------------------------------------------------------------- */}
      {/* Hero: what it does for the organiser, not how the game works      */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-14">
          <div>
            <p className={`${EYEBROW} text-overprint`}>Last Man Standing · for clubs, pubs and workplaces</p>
            <h1 className="mt-4 font-display text-[4rem] font-semibold uppercase leading-[0.82] tracking-[0.01em] text-ink sm:text-[5.5rem] lg:text-[6.2rem]">
              The
              <br />
              competition
              <br />
              <span className="text-overprint">that pays</span>
              <br />
              <span className="text-overprint">for itself.</span>
            </h1>
            <p className="mt-7 max-w-lg text-xl leading-relaxed text-ink">
              Run one for your club, your pub or your workplace. Set the entry fee, set the prize,
              and keep whatever is left &mdash; for club funds, for kit, or for a charity of your
              choice.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-4">
              <Link
                href={isLoggedIn ? '/dashboard' : '/competition/create'}
                className="rounded-sm bg-overprint px-7 py-3.5 font-display text-2xl uppercase tracking-[0.06em] text-stock-lit transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                {isLoggedIn ? 'Go to your dashboard' : 'Start one — free'}
              </Link>
              <span className={`${LABEL} text-ink-fade`}>20 places free · no card</span>
            </div>
            {/* The one pointer to Matchday above the fold. A line, not a second hero: the page
                still sells Last Man Standing, the game anyone can start today. */}
            <a
              href="#matchday"
              className={`${LABEL} mt-6 inline-block text-ink-fade underline decoration-dotted underline-offset-[6px] transition-colors hover:text-ink`}
            >
              New: Matchday, a second game &mdash; coming soon &darr;
            </a>
          </div>

          {/*
          The film, not an illustration. This slot held SurvivalSheet - a drawn paper coupon,
          nicely done and instantly readable, but not the product. It meant the most prominent
          image on the page was a mock-up while the only real screens sat below the fold, and it
          repeated the film's own opening scene a second time.

          The poster is a real app screen rather than the film's title card, so the hero reads as
          the product even before anyone presses play. A title card here would have put a second
          headline next to the h1.

          Click to play, not autoplay: 41s, silent, and a hero that starts moving on arrival is
          what people scroll past. preload="metadata" keeps the 1MB off the first paint.

          bg-stock because a <video> paints black wherever it has no frame - before load, and in
          any letterbox if the element and the file disagree on aspect.
          */}
          <div>
            <video
              className="block w-full border border-ink/30 bg-stock"
              controls
              playsInline
              preload="metadata"
              poster="/promo-poster.jpg"
            >
              <source src="/promo.mp4" type="video/mp4" />
              Your browser cannot play this video.
            </video>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-fade">
              Forty seconds, start to finish &mdash; setting one up, players joining, a round
              playing out. Every screen is the real thing. No sound.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* The money, straight after the promise that mentions it            */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-y border-ink/30 bg-stock-deep">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="max-w-2xl">
            <p className={`${EYEBROW} text-overprint`}>Work out your own</p>
            <h2 className="mt-4 font-display text-5xl font-semibold uppercase leading-[0.9] text-ink sm:text-6xl">
              What it would raise for you
            </h2>
            <p className="mt-5 text-xl leading-relaxed text-ink">
              Move the sliders to the competition you would actually run. None of these numbers are
              fixed by us.
            </p>
          </div>
          <div className="mt-9">
            <Docket />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* What running one costs you in time, and the fixtures choice       */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <h2 className="max-w-2xl font-display text-5xl font-semibold uppercase leading-[0.9] text-ink sm:text-6xl">
          Your weekend, start to finish
        </h2>
        <p className="mt-5 max-w-xl text-xl leading-relaxed text-ink">
          The reason people give up running these is the admin. So here is honestly all of it, and
          how much of it you keep hold of is your call.
        </p>

        <ol className="mt-10 border-t border-ink/30">
          {WEEKEND.map((stage) => (
            <li
              key={stage.when}
              className="grid gap-2 border-b border-ink/30 py-6 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-8"
            >
              <span className={`${LABEL} text-overprint sm:pt-2`}>{stage.when}</span>
              <div>
                <h3 className="font-display text-2xl uppercase tracking-[0.03em] text-ink">
                  {stage.what}
                </h3>
                <p className="mt-2 max-w-xl text-[17px] leading-relaxed text-ink">{stage.detail}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* The fixtures decision, stated plainly */}
        <h3 className={`${EYEBROW} mt-12 text-ink-fade`}>Two ways to run it</h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {TWO_WAYS.map((way) => (
            <div key={way.title} className="border border-ink/30 bg-stock-lit p-5 sm:p-6">
              <h4 className="font-display text-2xl uppercase tracking-[0.03em] text-ink">
                {way.title}
              </h4>
              <p className="mt-3 text-[17px] leading-relaxed text-ink">{way.detail}</p>
            </div>
          ))}
        </div>
        {/*
          Not "you can change your mind later", which read as something the organiser could do and
          is not: update-competition deliberately leaves fixture_service alone, the settings screen
          does not offer it, and set-fixture-service-organiser is unregistered. Only an admin can
          flip it, through /admin/set-fixture-service - so the sentence has to point at us.
        */}
        <p className="mt-4 text-[16px] leading-relaxed text-ink-fade">
          You choose per competition when you set it up. Ask us if you want it switched over at any
          time.
        </p>

        <h3 className={`${EYEBROW} mt-12 text-ink-fade`}>Included either way</h3>
        <ul className="mt-5 grid gap-x-8 gap-y-3.5 sm:grid-cols-2">
          {INCLUDED.map((item) => (
            <li key={item} className="flex items-baseline gap-3">
              <span
                aria-hidden="true"
                className={TICK}
              >
                &#10003;
              </span>
              <span className="text-[17px] text-ink">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Offline players — the objection that decides it for a lot of      */}
      {/* venues, and the thing existing organisers rate most               */}
      {/*                                                                   */}
      {/* "Terry", not "Big Ben" or "Old Ben". The oldest name explained     */}
      {/* itself faster, which is why it was chosen, but it classified the   */}
      {/* person it was meant to include. Plenty of people who avoid an app  */}
      {/* are wary of technology rather than old, and being filed under      */}
      {/* "old" is its own reason to opt out — so the heading was creating   */}
      {/* an objection in the section that exists to remove one. A plain     */}
      {/* first name reads as somebody's regular beside "doesn't use the     */}
      {/* app", and carries no nickname to decode.                           */}
      {/* Do not put an age word back.                                      */}
      {/*                                                                   */}
      {/* "Doesn't use the app", not "hasn't got a smartphone", for the same */}
      {/* reason: most people who avoid the app own a phone and simply will  */}
      {/* not use it, so the old heading described a smaller group than the  */}
      {/* section actually serves and read as a shortcoming rather than a    */}
      {/* preference. The body copy below covers both cases unchanged.       */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-y border-ink/30 bg-stock-deep">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-16">
            <div>
              <p className={`${EYEBROW} text-overprint`}>Everyone plays</p>
              <h2 className="mt-4 font-display text-5xl font-semibold uppercase leading-[0.9] text-ink sm:text-6xl">
                Terry doesn&rsquo;t use the app
              </h2>
              <p className="mt-6 max-w-lg text-xl leading-relaxed text-ink">
                Add him yourself and he is on the sheet with everybody else. Each round he tells
                you his team and you put it in.
              </p>
              <p className="mt-4 max-w-lg text-xl leading-relaxed text-ink">
                No email address, no app, nothing for him to set up &mdash; and he can win the whole
                thing.
              </p>
              <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-ink-fade">
                That is the difference between a competition for whoever will use an app and a
                competition for your whole crowd.
              </p>
            </div>

            {/* The point made concretely, in the language of the sheet */}
            <div className="self-center border border-ink/30 bg-stock-lit p-5 sm:p-6">
              <p className={`${LABEL} text-ink-fade`}>Round 8 · picks in</p>
              <ul className="mt-4 space-y-3">
                <li className="flex items-baseline justify-between gap-3 border-b border-dotted border-ink/25 pb-3">
                  <span className="font-data text-[15px] text-ink">Dave R.</span>
                  <span className="font-data text-[13px] text-ink-fade">picked on the app</span>
                </li>
                <li className="flex items-baseline justify-between gap-3">
                  <span className="font-data text-[15px] text-ink">Terry M.</span>
                  <span className="font-data text-[13px] text-overprint">you put his in</span>
                </li>
              </ul>
              <p className="mt-5 text-[16px] leading-relaxed text-ink">
                On the sheet they look exactly the same. Because they are.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Matchday — the second game, in beta. Rules: docs/matchday.md §1,  */}
      {/* words: §2 (no "pick", no betting words).                          */}
      {/*                                                                   */}
      {/* Announced, not offered: creating one is preview-only              */}
      {/* (MATCHDAY_PREVIEW_ORGANISER_IDS), so there is deliberately no     */}
      {/* button here. At launch, add a "Start one" and drop the "coming    */}
      {/* soon" lines - here, in the hero, /help/matchday and the FAQ.      */}
      {/*                                                                   */}
      {/* Every claim is checked against what is built, not the plan:       */}
      {/* always on our fixtures, web only until the app update (due very   */}
      {/* soon - change the app line when it ships), and no entering        */}
      {/* predictions for somebody else - the honest                        */}
      {/* counterpart to the Terry section above, an LMS-only promise.      */}
      {/* ---------------------------------------------------------------- */}
      <section id="matchday" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-14 sm:px-6 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-16">
          <div>
            <p className={`${EYEBROW} text-overprint`}>A second game &middot; in beta</p>
            <h2 className="mt-4 font-display text-5xl font-semibold uppercase leading-[0.9] text-ink sm:text-6xl">
              Matchday
            </h2>
            <p className="mt-6 max-w-lg text-xl leading-relaxed text-ink">
              Not everybody wants to be knocked out in week two. Matchday runs on the same real
              matches, but players predict the winner of every match in the gameweek, and the
              points go on a league table.
            </p>
            <p className="mt-4 max-w-lg text-xl leading-relaxed text-ink">
              Nobody goes out, so your whole crowd is still playing &mdash; and still arguing about
              it &mdash; on the last weekend. You choose how long it runs: 4, 6 or 8 rounds. Most
              points at the end wins.
            </p>
            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-ink-fade">
              Matchday is in beta and coming soon to everyone.
            </p>
          </div>

          <div className="self-center border border-ink/30 bg-stock-lit p-5 sm:p-6">
            <p className={`${LABEL} text-ink-fade`}>How a match scores</p>
            <ul className="mt-4 space-y-3">
              <li className="flex items-baseline justify-between gap-3 border-b border-dotted border-ink/25 pb-3">
                <span className="font-data text-[15px] text-ink">Predicted team wins</span>
                <span className="font-data text-[15px] text-overprint">+3</span>
              </li>
              <li className="flex items-baseline justify-between gap-3 border-b border-dotted border-ink/25 pb-3">
                <span className="font-data text-[15px] text-ink">It&rsquo;s a draw</span>
                <span className="font-data text-[15px] text-ink">+1</span>
              </li>
              <li className="flex items-baseline justify-between gap-3 border-b border-dotted border-ink/25 pb-3">
                <span className="font-data text-[15px] text-ink">Predicted team loses</span>
                <span className="font-data text-[15px] text-ink-fade">&minus;1</span>
              </li>
              <li className="flex items-baseline justify-between gap-3">
                <span className="font-data text-[15px] text-ink">Left blank</span>
                <span className="font-data text-[15px] text-ink-fade">0</span>
              </li>
            </ul>
            <p className="mt-5 text-[16px] leading-relaxed text-ink">
              A bad round can cost points, but nobody&rsquo;s total ever drops below zero.
            </p>
          </div>
        </div>

        <h3 className={`${EYEBROW} mt-14 text-ink-fade`}>A round of Matchday</h3>
        <ol className="mt-5 grid gap-px border border-ink/30 bg-ink/30 sm:grid-cols-3">
          {MATCHDAY_ROUND.map((step, i) => (
            <li key={step.what} className="bg-stock-lit p-5 sm:p-6">
              <span className={`${LABEL} text-overprint`}>{i + 1}</span>
              <h4 className="mt-2 font-display text-2xl uppercase tracking-[0.03em] text-ink">
                {step.what}
              </h4>
              <p className="mt-2 text-[17px] leading-relaxed text-ink">{step.detail}</p>
            </li>
          ))}
        </ol>

        <h3 className={`${EYEBROW} mt-12 text-ink-fade`}>Good to know</h3>
        <ul className="mt-5 grid gap-x-8 gap-y-3.5 sm:grid-cols-2">
          {MATCHDAY_DETAILS.map((item) => (
            <li key={item} className="flex items-baseline gap-3">
              <span aria-hidden="true" className={TICK}>
                &#10003;
              </span>
              <span className="text-[17px] text-ink">{item}</span>
            </li>
          ))}
        </ul>

        <Link
          href="/help/matchday"
          className={`${LABEL} mt-10 inline-block text-ink underline decoration-dotted underline-offset-[6px] transition-colors hover:text-overprint`}
        >
          The full Matchday rules &rarr;
        </Link>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Close                                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="bg-ink">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="max-w-2xl font-display text-6xl font-semibold uppercase leading-[0.88] text-stock-lit sm:text-7xl">
            Put one up
            <br />
            on the noticeboard
          </h2>
          <p className="mt-6 max-w-lg text-xl leading-relaxed text-stock/85">
            Twenty player places, free. You only pay once you go past twenty.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
            <Link
              href={isLoggedIn ? '/dashboard' : '/competition/create'}
              className="rounded-sm bg-overprint px-8 py-4 font-display text-2xl uppercase tracking-[0.06em] text-stock-lit transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stock"
            >
              {isLoggedIn ? 'Go to your dashboard' : 'Start one — free'}
            </Link>
            <Link
              href="/onboarding"
              className={`${LABEL} text-stock/85 underline decoration-dotted underline-offset-[6px] transition-colors hover:text-stock`}
            >
              Or have us set it up for you
            </Link>
          </div>

        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Players. Their own band rather than a footnote inside the close:  */}
      {/* light stock between two ink blocks, so the one section addressed  */}
      {/* to somebody else is the one that visibly changes colour.          */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-y border-ink/30 bg-stock-lit">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
            <div>
              <p className={`${EYEBROW} text-overprint`}>Not running one &mdash; playing in one?</p>
              <h2 className="mt-4 font-display text-5xl font-semibold uppercase leading-[0.9] text-ink sm:text-6xl">
                Join your competition
              </h2>
              <p className="mt-5 max-w-lg text-xl leading-relaxed text-ink">
                Your organiser will have given you a code, on a poster or in a message. Put it in
                here and you are on the sheet.
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  goToJoin(bandCode);
                }}
                className="mt-7 flex flex-wrap items-center gap-3"
              >
                <label htmlFor="join-code-band" className="sr-only">
                  Competition code
                </label>
                <input
                  id="join-code-band"
                  value={bandCode}
                  onChange={(e) => setBandCode(e.target.value.toUpperCase())}
                  placeholder="ENTER CODE"
                  autoComplete="off"
                  className="w-44 rounded-sm border border-ink/40 bg-stock px-4 py-3.5 font-data text-lg uppercase tracking-[0.12em] text-ink placeholder:text-ink-fade/70 focus:border-ink focus:outline-none sm:w-56"
                />
                <button
                  type="submit"
                  className="rounded-sm bg-overprint px-7 py-3.5 font-display text-2xl uppercase tracking-[0.06em] text-stock-lit transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  Join
                </button>
              </form>
              <p className="mt-4 text-[16px] leading-relaxed text-ink-fade">
                No code yet? Ask whoever is running it &mdash; only they can hand one out.
              </p>
            </div>

            <div className="border border-ink/30 bg-stock p-6 sm:p-7">
              <p className={`${EYEBROW} text-ink-fade`}>Once you are in</p>
              <p className="mt-3 text-[17px] leading-relaxed text-ink">
                The app is the easiest way to make your pick each round and find out whether you
                survived.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href="https://apps.apple.com/gb/app/lms-local/id6755344736"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${LABEL} rounded-sm border border-ink/40 px-4 py-2.5 text-ink transition-colors hover:bg-ink hover:text-stock-lit`}
                >
                  App Store
                </a>
                <a
                  href="https://play.google.com/store/apps/details?id=uk.co.lmslocal.lmslocal_flutter"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${LABEL} rounded-sm border border-ink/40 px-4 py-2.5 text-ink transition-colors hover:bg-ink hover:text-stock-lit`}
                >
                  Google Play
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Free to take away                                                 */}
      {/* ---------------------------------------------------------------- */}
      {/*
        Deliberately the LAST thing before the footer, and deliberately not in the hero.

        These are the two downloads, and they are a genuine alternative to signing up - a
        spreadsheet is what somebody uses INSTEAD of us. Put high on the page that competes
        with "Start one - free" at the moment somebody is deciding, which is the one place we
        should not be handing out the other option. Put here it reaches the reader who has
        scrolled the whole page and not signed up, and for that reader a download they remember
        us by beats a bounce.

        It also earns its place on merit: the home page is the only page Google reliably crawls
        (a site: search in Sept 2026 returned nine URLs for the entire domain), so an in-body
        link from here is the strongest internal signal we can give these pages.
      */}
      <section className="border-t border-ink/30 bg-stock">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <p className={`${EYEBROW} text-overprint`}>Free to take away</p>
          {/*
            "On paper", not "yourself". Both downloads are for somebody running a competition
            WITHOUT us, and "yourself" is the word this site uses for doing your own fixtures ON
            the platform ("You run the fixtures"), so it read as a feature rather than the
            alternative it is. Paper and a spreadsheet are what these actually are.
          */}
          <h2 className="mt-4 max-w-2xl font-display text-4xl font-semibold uppercase leading-[0.9] text-ink sm:text-5xl">
            Running one on paper instead?
          </h2>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink">
            Take these whether you use LMSLocal or not. No sign-up, no email address, nothing to
            hand over.
          </p>

          <ul className="mt-9 grid gap-px border border-ink/30 bg-ink/30 sm:grid-cols-3">
            {[
              {
                href: '/last-man-standing-rules.pdf',
                label: 'The rules, printed',
                blurb: 'One A4 page with blanks for your entry fee, prize and deadline. Pin it up.',
                download: true
              },
              {
                href: '/last-man-standing-template',
                label: 'A spreadsheet',
                blurb: 'Team dropdowns, a teams-used count and a check that catches a duplicate pick.',
                download: false
              },
              {
                href: '/help/how-to-play',
                label: 'How it all works',
                blurb: 'The full rules, what a draw does, lives, and running out of teams.',
                download: false
              }
            ].map((item) => (
              <li key={item.href} className="bg-stock-lit">
                <a
                  href={item.href}
                  {...(item.download ? { download: true } : {})}
                  className="flex h-full flex-col p-6 transition-colors hover:bg-stock focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
                >
                  <span className="font-display text-2xl uppercase tracking-[0.02em] text-ink">
                    {item.label}
                  </span>
                  <span className="mt-3 text-[16px] leading-relaxed text-ink">{item.blurb}</span>
                  <span className={`${LABEL} mt-4 text-overprint`}>Get it &rarr;</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Footer. The shared component, not a copy - this page carried its   */}
      {/* own hand-written one, which had already drifted: the product links */}
      {/* added to PublicFooter never reached the home page, the one page    */}
      {/* whose links matter most.                                          */}
      {/* ---------------------------------------------------------------- */}
      <PublicFooter />
    </div>
  );
}
