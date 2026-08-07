'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Wordmark from '@/components/public/Wordmark';
import SurvivalSheet from '@/components/landing/SurvivalSheet';
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

// Real platform figures. Update these by hand rather than inventing them.
const TALLY = [
  { value: '13', label: 'competitions' },
  { value: '11', label: 'organisers' },
  { value: '110', label: 'players' },
];

const WEEKEND = [
  {
    when: 'Midweek',
    what: 'The new round goes up',
    detail:
      'Switch our fixture service on and the round is built from the real fixture list and dropped straight into your competition. Leave it off and you enter your own fixtures instead.',
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
      'Either they arrive with the fixtures, or you enter the scores yourself. Either way the eliminations follow on their own — nobody works out who is still in by hand.',
  },
  {
    when: 'Sunday / Monday',
    what: 'You share the standings',
    detail:
      'A round update is written for you — who went out, who is left, who had the lucky escape. Copy it into WhatsApp, paste it into an email, or just send the link. That is the whole job.',
  },
];

const TWO_WAYS = [
  {
    title: 'We run the fixtures',
    price: '20 credits a competition',
    flag: 'Free right now',
    detail:
      'Each round arrives already built, with results and eliminations following after full time. Best if you want it off your hands. Available on the leagues we cover.',
  },
  {
    title: 'You run the fixtures',
    price: 'Always free',
    flag: null,
    detail:
      'You enter the fixtures and results yourself, round by round. Best if you want your own rounds, your own teams, or simply like holding the reins.',
  },
];

const PLAYER_RULES = [
  {
    text: 'They pick one team each round from the fixtures.',
    strong: 'one team',
  },
  {
    text: 'That team wins and they stay in. A draw or a defeat and they are out.',
    strong: 'they are out',
  },
  {
    text: 'They can never pick the same team twice, so it gets harder every round.',
    strong: 'same team twice',
  },
];

const INCLUDED = [
  '20 player places, free, however long you run',
  'Your own join code or link to hand out',
  'A printable A4 poster for the venue',
  'Eliminations worked out for you, either way',
  'No card to start, no subscription, ever',
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
          <nav className="flex items-center gap-5 sm:gap-7">
            <Link href="/pricing" className={`${LABEL} text-ink-fade transition-colors hover:text-ink`}>
              Pricing
            </Link>
            <Link
              href="/help"
              className={`${LABEL} hidden text-ink-fade transition-colors hover:text-ink sm:block`}
            >
              Help
            </Link>
            <Link
              href={isLoggedIn ? '/dashboard' : '/login'}
              className={`${LABEL} rounded-sm border border-ink px-3.5 py-2 text-ink transition-colors hover:bg-ink hover:text-stock-lit`}
            >
              {isLoggedIn ? 'Dashboard' : 'Sign in'}
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
            <p className={`${EYEBROW} text-overprint`}>Last Man Standing · for organisers</p>
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
              Your regulars already know the game. Set the entry fee, set the prize, and keep
              whatever is left for the club or the charity of your choice.
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
          </div>

          <div>
            <SurvivalSheet />
            <p className="mt-4 text-[15px] leading-relaxed text-ink-fade">
              An example competition. Seven rounds gone, two players left &mdash; round eight
              decides it.
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
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className={`${LABEL} text-ink-fade`}>{way.price}</span>
                {way.flag && (
                  <span className={`${LABEL} bg-overprint px-2 py-1 text-stock-lit`}>
                    {way.flag}
                  </span>
                )}
              </p>
              <p className="mt-3 text-[17px] leading-relaxed text-ink">{way.detail}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[16px] leading-relaxed text-ink-fade">
          You choose per competition, and you can change your mind later.
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
      {/* ---------------------------------------------------------------- */}
      <section className="border-y border-ink/30 bg-stock-deep">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-16">
            <div>
              <p className={`${EYEBROW} text-overprint`}>Everyone plays</p>
              <h2 className="mt-4 font-display text-5xl font-semibold uppercase leading-[0.9] text-ink sm:text-6xl">
                Old Ben hasn&rsquo;t got a smartphone
              </h2>
              <p className="mt-6 max-w-lg text-xl leading-relaxed text-ink">
                He is still in it. Add him yourself and he is on the sheet with everybody else. Each
                round he tells you his team at the bar and you put it in for him.
              </p>
              <p className="mt-4 max-w-lg text-xl leading-relaxed text-ink">
                No email address, no app, nothing for him to set up &mdash; and he can win the whole
                thing.
              </p>
              <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-ink-fade">
                That is the difference between a competition for whoever happens to have the app and
                a competition for your whole crowd.
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
                  <span className="font-data text-[15px] text-ink">Old Ben</span>
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
      {/* The game itself, described as something your players do           */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-b border-ink/30 bg-stock-lit">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <h2 className="font-display text-4xl font-semibold uppercase leading-[0.9] text-ink sm:text-5xl">
            What your players do
          </h2>
          <div className="mt-7 grid gap-8 sm:grid-cols-3">
            {PLAYER_RULES.map((rule) => {
              const [before, after] = rule.text.split(rule.strong);
              return (
                <p key={rule.text} className="text-xl leading-relaxed text-ink">
                  {before}
                  <strong
                    className={`font-semibold ${
                      rule.strong === 'they are out' ? 'text-overprint' : ''
                    }`}
                  >
                    {rule.strong}
                  </strong>
                  {after}
                </p>
              );
            })}
          </div>
          <p className="mt-8 border-t border-ink/30 pt-5 text-[16px] text-ink-fade">
            Results stand on regulation time, 90 minutes plus stoppages. The last one standing takes
            the prize.
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Where we're up to — real numbers, honestly small                  */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="font-display text-5xl font-semibold uppercase leading-[0.9] text-ink sm:text-6xl">
              Where we&rsquo;re up to
            </h2>
            <p className="mt-5 max-w-md text-xl leading-relaxed text-ink">
              LMSLocal started this season. Everything running on it right now, counted honestly:
            </p>
            <p className="mt-5 max-w-md text-[16px] leading-relaxed text-ink-fade">
              There are no reviews on this page because we have not earned any yet. When an
              organiser says something worth quoting, it will go up here with their name and their
              venue on it.
            </p>
          </div>

          <dl className="grid grid-cols-3 self-start border-y border-ink/30">
            {TALLY.map((stat) => (
              <div key={stat.label} className="border-r border-ink/30 px-3 py-6 last:border-r-0 sm:px-5">
                <dd className="font-display text-6xl font-semibold leading-none text-overprint sm:text-7xl">
                  {stat.value}
                </dd>
                <dt className={`${LABEL} mt-2.5 text-ink-fade`}>{stat.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Close                                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="bg-ink">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="max-w-2xl font-display text-6xl font-semibold uppercase leading-[0.88] text-stock-lit sm:text-7xl">
            Put one up
            <br />
            behind the bar
          </h2>
          <p className="mt-6 max-w-lg text-xl leading-relaxed text-stock/85">
            Twenty player places, free, for as long as you like. You only pay once you go past
            twenty.
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
      {/* Footer                                                            */}
      {/* ---------------------------------------------------------------- */}
      <footer className="bg-ink">
        <div className="mx-auto max-w-6xl border-t border-stock/25 px-4 py-9 sm:px-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <span className="font-display text-xl uppercase tracking-[0.1em] text-stock/85">
              LMSLocal
            </span>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {[
                { href: '/terms', label: 'Terms' },
                { href: '/privacy', label: 'Privacy' },
                { href: '/help', label: 'Help' },
                { href: '/pricing', label: 'Pricing' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`${LABEL} text-stock/65 transition-colors hover:text-stock`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="mt-7 space-y-1 text-[14px] leading-relaxed text-stock/60">
            <p>&copy; 2026 LMSLocal. Operated by Noodev8 Ltd, company number 16222537.</p>
            <p>3 Cumberland Place, Welshpool, SY21 7SB.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
