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
 * SEO LEADS THE STRUCTURE (rewritten 2026-11-24). Search Console, Aug–Nov 2026:
 * organisers arrive searching for the game, not the cause. "last man standing
 * football" alone was 1,734 impressions; rules searches ("last man standing
 * rules", "football rules", "how does it work") about 1,000 more; fundraiser and
 * pub searches about 200 between them. The page ranks for those game words, so
 * the H1 carries "Last Man Standing football competition" and the rules sit
 * straight under the hero. Keep both. Do not move the H1 to a two-game pitch:
 * nobody searches for "Matchday", which earns its traffic from its own pages.
 *
 * Audience order: workplaces and groups of friends, then clubs, then pubs. Set
 * 2026-11-24 from the last 40 competitions: workplaces (Aptar, Arriva,
 * Edmundson Electrical, Legl) and friends or family ("Leach clan", "Murray",
 * a run of "Premier League LMS") outnumber the clubs, junior football clubs
 * bring the biggest single groups, and pubs are close to none. The 2026-08-18
 * order (clubs, pubs, workplaces, with the fundraising pot as the headline) is
 * replaced; the pot calculator stays, lower down, for those who charge an entry.
 * Pubs are never dropped. Do not reorder without new numbers.
 *
 * The promo video was removed from the hero (2026-11-24, Andreas) to give the
 * page room. The files stay in public/.
 *
 * Voice rule: "you" on this page is always the organiser, never the player.
 * Anything the player does is written in the third person ("they pick"). The
 * exceptions are the join strip at the very top and the players band near the
 * foot, both fenced off visually, so the switch of audience is never something
 * the reader has to infer from the words.
 *
 * Spacing: major sections use py-20 sm:py-28, a step up from the design
 * system's py-14 sm:py-20, by request — this page should read as clear and
 * unhurried, one idea per section.
 */

/* The rules in four lines - the answer to the rules searches, on the page Google trusts most. */
const RULES = [
  {
    what: 'Pick one team to win',
    detail: 'Each round, every player picks one team from that round’s matches.',
  },
  {
    what: 'Win and they are through',
    detail:
      'A draw counts the same as a loss: it puts them out, or costs a life if your competition has lives. Ninety minutes only — extra time and penalties do not count.',
  },
  {
    what: 'No team twice',
    detail:
      'Under the usual rule, a team they have used is gone for them. Once they have used every team, the whole list comes back.',
  },
  {
    what: 'Last one standing wins',
    detail:
      'Players drop away round by round. If the last few all go out together, you decide: share the prize or run it again.',
  },
];

const WEEKEND = [
  {
    when: 'Midweek',
    what: 'The new round goes up',
    detail:
      'We build it from the real fixture list and drop it straight into your competition, which is how most competitions run. If you would rather put the matches in yourself, you can.',
  },
  {
    when: 'Friday, Saturday',
    what: 'Your players pick',
    detail:
      'One team each, on their phones. Anyone without the app tells you their team and you put it in for them. Picks lock when the round locks: at the first kick-off when we supply the matches, or at a time you set when you put them in yourself.',
  },
  {
    when: 'Full time',
    what: 'Results go in',
    detail:
      'They arrive on their own once the matches finish, or you enter the scores if you are putting the matches in. Either way the eliminations follow — nobody works out who is still in by hand.',
  },
  {
    when: 'Sunday / Monday',
    what: 'You share the standings',
    detail:
      'A round update is written for you — who went out, who is left, who had the lucky escape. Copy it into WhatsApp, or just send the link. That is the whole job.',
  },
];

const INCLUDED = [
  '20 player places, free, no card needed',
  'Your own join code or link to hand out',
  'A printable A4 poster',
  'Eliminations worked out for you',
];

/*
Matchday. Rules: docs/matchday.md §1. Words: §2 - no "pick", no betting words.

Announced, not offered: creating one is preview-only (MATCHDAY_PREVIEW_ORGANISER_IDS), so there is
deliberately no button for it. At launch, add a "Start one" to the Matchday card and drop the
"coming soon" lines - here, in the hero, /help/matchday and the FAQ.

Every line is true of the build today, not the plan: always on our matches, web only until the app
update ships (change that line when it does), and no entering predictions for somebody else - the
honest counterpart to the Terry section, which is an LMS-only promise.
*/
const MATCHDAY_DETAILS = [
  'They can change their predictions until the round locks',
  'Everyone sees who predicted what once the round has locked',
  'Level on points? Most wins, then most predictions made',
  'Joining closes when round 1 locks',
  'The same price as Last Man Standing: one player, one place',
  'Runs on the leagues we cover, with our matches and results',
  'Played in a web browser for now; coming to the app very soon',
  'Players make their own predictions; you cannot enter them for someone',
];

const AUDIENCES = [
  {
    href: '/last-man-standing-at-work',
    label: 'At work',
    blurb: 'A competition for the office, the depot or the whole company, run from one link.',
  },
  {
    href: '/last-man-standing-for-clubs',
    label: 'For clubs',
    blurb: 'Football, golf or social clubs — with the pot split between the winner and club funds if you like.',
  },
  {
    href: '/last-man-standing-for-pubs',
    label: 'For pubs',
    blurb: 'A poster on the wall, a code at the bar, and the regulars back in every weekend.',
  },
];

/*
Answers taken from /help/faq and kept in step with it. Written about "players", not "you": on this
page "you" is the organiser. Also emitted as FAQPage structured data below, so every question and
answer here must stay visible on the page, word for word.
*/
const FAQS = [
  {
    q: 'What is a Last Man Standing football competition?',
    a: 'An elimination competition on real football matches. Each round every player picks one team to win. A win takes them through to the next round; a draw or a loss puts them out, or costs a life if the competition has lives. The last player left wins.',
  },
  {
    q: 'Does a draw count as a win?',
    a: 'No. The team has to win. A draw is treated exactly like a defeat, and results count at ninety minutes plus stoppage time only — extra time and penalties are ignored.',
  },
  {
    q: 'Can you pick the same team twice?',
    a: 'Not under the usual rule, which most competitions run: once a player has used a team it is gone for them, until they have used every team and the whole list comes back. The organiser chooses the rule when setting the competition up.',
  },
  {
    q: 'What happens if everyone goes out in the same round?',
    a: 'The competition ends with no winner, and everyone is told. What happens to the prize is the organiser’s call: commonly it is shared between everyone who went out in that last round, or the competition is run again.',
  },
  {
    q: 'How much does LMSLocal cost?',
    a: 'Players join free. Organisers get 20 player places free with no card needed, shared across every competition they run. Past that, places come in packs starting at £10 for 20.',
  },
  {
    q: 'Is a Last Man Standing competition gambling?',
    a: 'A competition with no entry fee is not gambling at all, whatever the prize. With an entry fee it depends on who is playing and where the money ends up. LMSLocal never takes entry fees or pays prizes — that stays between the organiser and the players.',
  },
];

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

const H2 = 'font-display text-5xl font-semibold uppercase leading-[0.9] text-ink sm:text-6xl';
const BIG_BUTTON =
  'rounded-sm bg-overprint px-7 py-3.5 font-display text-2xl uppercase tracking-[0.06em] text-stock-lit transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';
const TEXT_LINK = `${LABEL} inline-block text-ink underline decoration-dotted underline-offset-[6px] transition-colors hover:text-overprint`;

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

  const startHref = isLoggedIn ? '/dashboard' : '/competition/create';
  const startLabel = isLoggedIn ? 'Go to your dashboard' : 'Start one — free';

  return (
    <div className="min-h-screen bg-stock font-body text-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }}
      />

      {/* ---------------------------------------------------------------- */}
      {/* Player door: the only thing at the top addressed to players       */}
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
            {/* "Rules" is what most visitors came for (see the header comment); it
                goes to the full rules page. */}
            <Link
              href="/help/how-to-play"
              className={`${LABEL} hidden text-ink-fade transition-colors hover:text-ink sm:block`}
            >
              Rules
            </Link>
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
            no account cannot open. The "/ Register" half is dropped below sm rather than shrunk,
            because the full label overflows a 360px header.
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
      {/* Hero: the search phrase as the promise                            */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:py-32">
        <div className="max-w-4xl">
          <p className={`${EYEBROW} text-overprint`}>For workplaces, friends, clubs and pubs</p>
          <h1 className="mt-6 font-display text-[3.4rem] font-semibold uppercase leading-[0.86] tracking-[0.01em] text-ink sm:text-[5rem] lg:text-[6rem]">
            Run a Last Man Standing
            <br />
            <span className="text-overprint">football competition</span>
          </h1>
          <p className="mt-9 max-w-2xl text-xl leading-relaxed text-ink sm:text-[1.4rem]">
            Set it up in a few minutes and send your players the link. We put the real matches in
            each round and the results in after full time, so nobody works out who is still in by
            hand.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link href={startHref} className={BIG_BUTTON}>
              {startLabel}
            </Link>
            <span className={`${LABEL} text-ink-fade`}>20 places free · no card</span>
          </div>

          <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3">
            <a href="#how-it-works" className={`${TEXT_LINK} text-ink-fade`}>
              How the game works &darr;
            </a>
            {/* Matchday above the fold, boxed so it is seen, but still not a second hero: the
                H1 stays LMS because that is what people search for. The two-games section
                follows the hero directly. */}
            <a
              href="#two-games"
              className={`${LABEL} rounded-sm border border-overprint px-3.5 py-2 text-overprint transition-colors hover:bg-overprint hover:text-stock-lit`}
            >
              New: Matchday &mdash; a prediction league where nobody goes out &darr;
            </a>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Two games. LMS can be started today; Matchday is announced only.  */}
      {/* See the comment on MATCHDAY_DETAILS.                              */}
      {/* ---------------------------------------------------------------- */}
      <section id="two-games" className="scroll-mt-16 border-y border-ink/30 bg-stock-deep">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="max-w-2xl">
            <p className={`${EYEBROW} text-overprint`}>Two games, the same matches</p>
            <h2 className={`mt-5 ${H2}`}>Knockout or league table</h2>
            <p className="mt-6 text-xl leading-relaxed text-ink">
              Not everybody wants to be out in week two. Run Last Man Standing, or Matchday, where
              nobody goes out and everyone is still playing on the last weekend.
            </p>
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col border border-ink/30 bg-stock-lit p-7 sm:p-9">
              <p className={`${LABEL} text-ink-fade`}>The knockout</p>
              <h3 className="mt-3 font-display text-4xl uppercase tracking-[0.02em] text-ink">
                Last Man Standing
              </h3>
              <ul className="mt-6 flex-1 space-y-3">
                {[
                  'One team a round, to win',
                  'A draw or a loss and they are out',
                  'Runs until one player is left',
                  'On our matches, or ones you put in',
                ].map((line) => (
                  <li key={line} className="flex items-baseline gap-3">
                    <span aria-hidden="true" className={TICK}>
                      &#10003;
                    </span>
                    <span className="text-[17px] text-ink">{line}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
                <Link href={startHref} className={BIG_BUTTON}>
                  {startLabel}
                </Link>
                <Link href="/help/how-to-play" className={TEXT_LINK}>
                  Rules &rarr;
                </Link>
              </div>
            </div>

            <div className="flex flex-col border border-ink/30 bg-stock-lit p-7 sm:p-9">
              <p className={`${LABEL} text-overprint`}>The league table &middot; coming soon</p>
              <h3 className="mt-3 font-display text-4xl uppercase tracking-[0.02em] text-ink">
                Matchday
              </h3>
              <ul className="mt-6 flex-1 space-y-3">
                {[
                  'Predict the winner of every match in the round',
                  'Points go on a league table',
                  'Nobody goes out',
                  'You choose the length: 4, 6 or 8 rounds',
                ].map((line) => (
                  <li key={line} className="flex items-baseline gap-3">
                    <span aria-hidden="true" className={TICK}>
                      &#10003;
                    </span>
                    <span className="text-[17px] text-ink">{line}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
                <span className={`${LABEL} rounded-sm border border-ink/40 px-4 py-3 text-ink-fade`}>
                  In beta &middot; open to everyone soon
                </span>
                <a href="#matchday" className={TEXT_LINK}>
                  How it scores &darr;
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* The rules, in four lines                                          */}
      {/* ---------------------------------------------------------------- */}
      <section id="how-it-works" className="scroll-mt-16">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="max-w-2xl">
            <p className={`${EYEBROW} text-overprint`}>The rules</p>
            <h2 className={`mt-5 ${H2}`}>How Last Man Standing works</h2>
          </div>

          <ol className="mt-14 grid gap-px border border-ink/30 bg-ink/30 sm:grid-cols-2">
            {RULES.map((rule, i) => (
              <li key={rule.what} className="bg-stock-lit p-7 sm:p-9">
                <span className="font-data text-lg text-overprint">{i + 1}</span>
                <h3 className="mt-3 font-display text-3xl uppercase tracking-[0.02em] text-ink">
                  {rule.what}
                </h3>
                <p className="mt-3 max-w-md text-[17px] leading-relaxed text-ink">{rule.detail}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3">
            <Link href="/help/how-to-play" className={TEXT_LINK}>
              The full rules: lives, postponements, strategy &rarr;
            </Link>
            <a href="/last-man-standing-rules.pdf" download className={TEXT_LINK}>
              Print the rules (PDF) &rarr;
            </a>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* What running one asks of you                                      */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-y border-ink/30 bg-stock-deep">
       <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="max-w-2xl">
          <p className={`${EYEBROW} text-overprint`}>Running one</p>
          <h2 className={`mt-5 ${H2}`}>Your week, start to finish</h2>
          <p className="mt-6 text-xl leading-relaxed text-ink">
            The reason people give up running these is the admin. Here is honestly all of it.
          </p>
        </div>

        <ol className="mt-14 border-t border-ink/30">
          {WEEKEND.map((stage) => (
            <li
              key={stage.when}
              className="grid gap-2 border-b border-ink/30 py-8 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-10"
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

        <ul className="mt-12 grid gap-x-10 gap-y-4 sm:grid-cols-2">
          {INCLUDED.map((item) => (
            <li key={item} className="flex items-baseline gap-3">
              <span aria-hidden="true" className={TICK}>
                &#10003;
              </span>
              <span className="text-[17px] text-ink">{item}</span>
            </li>
          ))}
        </ul>
        {/*
          Pointing at us, not "you can change your mind later": fixture_service is fixed at
          creation and only an admin can flip it (/admin/set-fixture-service).
        */}
        <p className="mt-8 max-w-2xl text-[16px] leading-relaxed text-ink-fade">
          Putting the matches in yourself, or using your own teams? Choose that when you set the
          competition up, and ask us if you want it switched over later.
        </p>
       </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Matchday in full                                                  */}
      {/* ---------------------------------------------------------------- */}
      <section id="matchday" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-20 sm:px-6 sm:py-28">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] lg:gap-20">
          <div>
            <p className={`${EYEBROW} text-overprint`}>A football prediction league &middot; in beta</p>
            <h2 className={`mt-5 ${H2}`}>Matchday</h2>
            <p className="mt-7 max-w-lg text-xl leading-relaxed text-ink">
              We put every match of the gameweek in for you. Your players predict the winner of
              each one &mdash; home or away, as many as they like &mdash; and the points go on a
              league table as the results come in.
            </p>
            <p className="mt-5 max-w-lg text-xl leading-relaxed text-ink">
              Most points after the last round wins. There is nothing for you to enter.
            </p>
          </div>

          <div className="self-center border border-ink/30 bg-stock-lit p-7 sm:p-8">
            <p className={`${LABEL} text-ink-fade`}>How a match scores</p>
            <ul className="mt-5 space-y-4">
              {[
                { label: 'Predicted team wins', pts: '+3', tone: 'text-overprint' },
                { label: 'It’s a draw', pts: '+1', tone: 'text-ink' },
                { label: 'Predicted team loses', pts: '0', tone: 'text-ink-fade' },
                { label: 'Left blank', pts: '0', tone: 'text-ink-fade' },
              ].map((row, i, all) => (
                <li
                  key={row.label}
                  className={`flex items-baseline justify-between gap-3 ${i < all.length - 1 ? 'border-b border-dotted border-ink/25 pb-4' : ''}`}
                >
                  <span className="font-data text-[15px] text-ink">{row.label}</span>
                  <span className={`font-data text-[15px] ${row.tone}`}>{row.pts}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-[16px] leading-relaxed text-ink">
              Nothing ever takes points away: a total only goes up.
            </p>
          </div>
        </div>

        <h3 className={`${EYEBROW} mt-20 text-ink-fade`}>Good to know</h3>
        <ul className="mt-6 grid gap-x-10 gap-y-4 sm:grid-cols-2">
          {MATCHDAY_DETAILS.map((item) => (
            <li key={item} className="flex items-baseline gap-3">
              <span aria-hidden="true" className={TICK}>
                &#10003;
              </span>
              <span className="text-[17px] text-ink">{item}</span>
            </li>
          ))}
        </ul>

        <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3">
          <Link href="/help/matchday" className={TEXT_LINK}>
            The full Matchday rules &rarr;
          </Link>
          <Link href="/football-prediction-league" className={TEXT_LINK}>
            A prediction league for work or friends &rarr;
          </Link>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Offline players. LMS only - Matchday has no entering predictions  */}
      {/* for someone, which is why the eyebrow names the game.             */}
      {/*                                                                   */}
      {/* "Terry", with no age word: being filed under "old" is its own     */}
      {/* reason to opt out. "Doesn't use the app", not "hasn't got a       */}
      {/* smartphone": most people who avoid the app own a phone. Do not    */}
      {/* put either back.                                                  */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-y border-ink/30 bg-stock-deep">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] lg:gap-20">
            <div>
              <p className={`${EYEBROW} text-overprint`}>Last Man Standing &middot; everyone plays</p>
              <h2 className={`mt-5 ${H2}`}>Terry doesn&rsquo;t use the app</h2>
              <p className="mt-7 max-w-lg text-xl leading-relaxed text-ink">
                Add him yourself and he is on the sheet with everybody else. Each round he tells you
                his team and you put it in. No email address, nothing for him to set up &mdash; and
                he can win the whole thing.
              </p>
            </div>

            <div className="self-center border border-ink/30 bg-stock-lit p-7 sm:p-8">
              <p className={`${LABEL} text-ink-fade`}>Round 8 · picks in</p>
              <ul className="mt-5 space-y-4">
                <li className="flex items-baseline justify-between gap-3 border-b border-dotted border-ink/25 pb-4">
                  <span className="font-data text-[15px] text-ink">Dave R.</span>
                  <span className="font-data text-[13px] text-ink-fade">picked on the app</span>
                </li>
                <li className="flex items-baseline justify-between gap-3">
                  <span className="font-data text-[15px] text-ink">Terry M.</span>
                  <span className="font-data text-[13px] text-overprint">you put his in</span>
                </li>
              </ul>
              <p className="mt-6 text-[16px] leading-relaxed text-ink">
                On the sheet they look exactly the same. Because they are.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* The pot. Lower than it was: most organisers who find us are not   */}
      {/* fundraising, but those who charge an entry still want the sums.   */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="max-w-2xl">
          <p className={`${EYEBROW} text-overprint`}>Charging an entry?</p>
          <h2 className={`mt-5 ${H2}`}>Work out the pot</h2>
          <p className="mt-6 text-xl leading-relaxed text-ink">
            Move the sliders to the competition you would actually run. Every number is yours to
            set, including what goes to the winner and what goes to your club or a charity.
          </p>
        </div>
        <div className="mt-12">
          <Docket />
        </div>
        <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3">
          <Link href="/help/is-it-gambling" className={TEXT_LINK}>
            Is an entry fee gambling? &rarr;
          </Link>
          <Link href="/help/fundraising" className={TEXT_LINK}>
            Running one as a fundraiser &rarr;
          </Link>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Who runs one: also the strongest internal link the audience pages */}
      {/* get, since the home page is the page Google crawls most.          */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-y border-ink/30 bg-stock-deep">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="max-w-2xl">
            <p className={`${EYEBROW} text-overprint`}>Who runs one</p>
            <h2 className={`mt-5 ${H2}`}>Workmates, mates and members</h2>
            <p className="mt-6 text-xl leading-relaxed text-ink">
              Most competitions here are run for a workplace or a group of friends, then football
              clubs, golf clubs and pubs.
            </p>
          </div>
          <ul className="mt-14 grid gap-px border border-ink/30 bg-ink/30 sm:grid-cols-3">
            {AUDIENCES.map((item) => (
              <li key={item.href} className="bg-stock-lit">
                <Link
                  href={item.href}
                  className="flex h-full flex-col p-7 transition-colors hover:bg-stock focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
                >
                  <span className="font-display text-3xl uppercase tracking-[0.02em] text-ink">
                    {item.label}
                  </span>
                  <span className="mt-3 flex-1 text-[16px] leading-relaxed text-ink">{item.blurb}</span>
                  <span className={`${LABEL} mt-5 text-overprint`}>Read more &rarr;</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Questions. Mirrored in FAQ_SCHEMA.                                */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:gap-20">
          <div>
            <p className={`${EYEBROW} text-overprint`}>Questions</p>
            <h2 className={`mt-5 ${H2}`}>Asked most</h2>
            <Link href="/help/faq" className={`${TEXT_LINK} mt-8`}>
              Every question &rarr;
            </Link>
          </div>
          <dl className="border-t border-ink/30">
            {FAQS.map((f) => (
              <div key={f.q} className="border-b border-ink/30 py-7">
                <dt className="font-display text-2xl uppercase tracking-[0.02em] text-ink">{f.q}</dt>
                <dd className="mt-3 max-w-2xl text-[17px] leading-relaxed text-ink">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Close                                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="bg-ink">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <h2 className="max-w-2xl font-display text-6xl font-semibold uppercase leading-[0.88] text-stock-lit sm:text-7xl">
            Start yours
            <br />
            this week
          </h2>
          <p className="mt-7 max-w-lg text-xl leading-relaxed text-stock/85">
            Twenty player places, free. You only pay once you go past twenty.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
            <Link
              href={startHref}
              className="rounded-sm bg-overprint px-8 py-4 font-display text-2xl uppercase tracking-[0.06em] text-stock-lit transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stock"
            >
              {startLabel}
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
      {/* Players. Their own band, light stock after the ink close, so the  */}
      {/* one section addressed to somebody else visibly changes colour.    */}
      {/* Game-neutral wording: a Matchday player lands here too.           */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-b border-ink/30 bg-stock-lit">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-20">
            <div>
              <p className={`${EYEBROW} text-overprint`}>Not running one &mdash; playing in one?</p>
              <h2 className={`mt-5 ${H2}`}>Join your competition</h2>
              <p className="mt-6 max-w-lg text-xl leading-relaxed text-ink">
                Your organiser will have given you a code, on a poster or in a message. Put it in
                here and you are on the sheet.
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  goToJoin(bandCode);
                }}
                className="mt-8 flex flex-wrap items-center gap-3"
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
                <button type="submit" className={BIG_BUTTON}>
                  Join
                </button>
              </form>
              <p className="mt-5 text-[16px] leading-relaxed text-ink-fade">
                No code yet? Ask whoever is running it &mdash; only they can hand one out.
              </p>
            </div>

            <div className="border border-ink/30 bg-stock p-7 sm:p-8">
              <p className={`${EYEBROW} text-ink-fade`}>Once you are in</p>
              <p className="mt-4 text-[17px] leading-relaxed text-ink">
                The app is the easiest way to play each round and keep up with how you are doing.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
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
      {/* Free to take away. Deliberately last before the footer: these are */}
      {/* the alternative to signing up, so they wait for the reader who    */}
      {/* scrolled the whole page and did not. "On paper", not "yourself":  */}
      {/* "yourself" is this site's word for entering your own matches.     */}
      {/* ---------------------------------------------------------------- */}
      <section className="bg-stock">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <p className={`${EYEBROW} text-overprint`}>Free to take away</p>
          <h2 className="mt-5 max-w-2xl font-display text-4xl font-semibold uppercase leading-[0.9] text-ink sm:text-5xl">
            Running one on paper instead?
          </h2>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink">
            Take these whether you use LMSLocal or not. No sign-up, no email address, nothing to
            hand over.
          </p>

          <ul className="mt-12 grid gap-px border border-ink/30 bg-ink/30 sm:grid-cols-2">
            {[
              {
                href: '/last-man-standing-rules.pdf',
                label: 'The rules, printed',
                blurb: 'One A4 page with blanks for your entry fee, prize and deadline. Pin it up.',
                download: true,
              },
              {
                href: '/last-man-standing-template',
                label: 'A spreadsheet',
                blurb: 'Team dropdowns, a teams-used count and a check that catches a duplicate pick.',
                download: false,
              },
            ].map((item) => (
              <li key={item.href} className="bg-stock-lit">
                <a
                  href={item.href}
                  {...(item.download ? { download: true } : {})}
                  className="flex h-full flex-col p-7 transition-colors hover:bg-stock focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
                >
                  <span className="font-display text-2xl uppercase tracking-[0.02em] text-ink">
                    {item.label}
                  </span>
                  <span className="mt-3 text-[16px] leading-relaxed text-ink">{item.blurb}</span>
                  <span className={`${LABEL} mt-5 text-overprint`}>Get it &rarr;</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* The shared footer, not a copy - a hand-written one here had drifted from PublicFooter. */}
      <PublicFooter />
    </div>
  );
}
