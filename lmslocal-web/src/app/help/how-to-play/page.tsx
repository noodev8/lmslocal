import Link from 'next/link';
import { LABEL, EYEBROW, HEADING, PANEL } from '@/lib/design';

export const metadata = {
  title: 'How to Play Last Man Standing - LMSLocal Help',
  description:
    'The rules of Last Man Standing. Pick one team to win each round: if they win you go through, if they lose or draw it costs you. Draws, lives, regulation time and running out of teams, explained.',
  keywords:
    'last man standing rules, how to play last man standing, does a draw count, football elimination game, premier league last man standing',
  alternates: { canonical: 'https://lmslocal.co.uk/help/how-to-play' },
  openGraph: {
    title: 'How to Play Last Man Standing',
    description: 'Pick one team each week to win. If they lose or draw, it costs you. The complete rules.',
    type: 'article'
  }
};

/*
  The three steps below are shown on the page and handed to Google as HowTo structured data.
  One array feeds both, for the same reason the FAQ works that way - a second hand-written copy
  of the steps is a copy that will quietly stop matching the page.
*/
const STEPS = [
  {
    name: 'Join a competition',
    text: 'Get the invite code from whoever is running the competition, enter it on the LMSLocal home page, and you are in. Joining closes when the first round locks.'
  },
  {
    name: 'Pick one team to win',
    text: 'Each round, choose a single team you think will win their match. You can change your mind as often as you like until the round locks. You cannot pick the same team twice until you have used them all, at which point they all come back.'
  },
  {
    name: 'Win and go through',
    text: 'If your team wins in regulation time you go through to the next round. A draw or a defeat costs you a life, or puts you out if you have none left. Keep going until you are the last player standing.'
  }
];

const howToSchema = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to play Last Man Standing',
  description:
    'Last Man Standing is a football elimination competition. Pick one team to win each round: if they win you go through, if they lose or draw you are out.',
  totalTime: 'PT5M',
  step: STEPS.map((s, i) => ({
    '@type': 'HowToStep',
    position: i + 1,
    name: s.name,
    text: s.text
  }))
};

/* The two rules people get wrong, given their own weight rather than buried in a paragraph. */
const CAVEATS = [
  {
    title: 'You cannot pick the same team twice',
    body: 'Once you have used a team they drop off your list. When you have used every one of them, they all come back and you start the list again — so the rounds just before that are the tight ones.'
  },
  {
    title: 'Regulation time only',
    body: 'Results are settled on the ninety minutes plus stoppage time. A cup tie your team wins in extra time or on penalties still counts as a draw — and a draw goes against you.'
  }
];

const LIVES = [
  { n: '0', name: 'Knockout', body: 'One wrong pick and you are out. Short, brutal competitions.' },
  { n: '1', name: 'One life', body: 'Your first wrong pick costs the life. The next one puts you out.' }
];

const STRATEGY = [
  {
    title: 'Managing your teams',
    points: [
      'Do not spend a Manchester City or an Arsenal on an easy early round',
      'Save the strongest sides for the weeks where nothing looks safe',
      'Look at the fixtures a few rounds ahead before committing to one now',
      'Watch which teams the rest of the field is burning through'
    ]
  },
  {
    title: 'Reading a fixture',
    points: [
      'Home advantage is real — check where the match is being played',
      'Recent form and injuries matter more than the league table',
      'Derbies are unpredictable, whatever the form says',
      'A team fighting relegation at home is not the free win it looks'
    ]
  }
];

export default function HowToPlayPage() {
  return (
    <div className="max-w-3xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }} />

      <p className={`${EYEBROW} text-overprint`}>The rules</p>
      <h1 className={`${HEADING} mt-4 text-5xl sm:text-6xl`}>How to play Last Man Standing</h1>
      <p className="mt-6 max-w-xl text-xl leading-relaxed text-ink">
        Pick one team to win, each round. If they win, you go through. If they lose or draw, it
        costs you. Keep going until you are the only one left.
      </p>

      {/* ------------------------------------------------------------ win / go out */}
      <section className="mt-12 border-t border-ink/30 pt-10">
        <p className={`${EYEBROW} text-ink-fade`}>The whole game</p>

        <div className="mt-6 grid gap-px border border-ink/30 bg-ink/30 sm:grid-cols-2">
          <div className="bg-stock-lit p-6">
            <p className={`${LABEL} text-overprint`}>You go through</p>
            <p className="mt-3 font-display text-3xl uppercase tracking-[0.02em] text-ink">Your team wins</p>
            <p className="mt-3 text-[17px] leading-relaxed text-ink">
              That is the only outcome that carries you into the next round.
            </p>
          </div>

          <div className="bg-stock-lit p-6">
            <p className={`${LABEL} text-ink-fade`}>It costs you</p>
            <ul className="mt-3 space-y-1.5">
              {['Your team loses', 'Your team draws', 'You miss the deadline'].map((item) => (
                <li key={item} className="font-display text-2xl uppercase tracking-[0.02em] text-ink">
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[17px] leading-relaxed text-ink">
              Each of these takes a life. With no lives left, it puts you out.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {CAVEATS.map((c) => (
            <div key={c.title} className="border-l-2 border-ink/40 bg-stock-lit px-4 py-3">
              <p className={`${LABEL} text-ink`}>{c.title}</p>
              <p className="mt-1.5 text-[16px] leading-relaxed text-ink">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ lives */}
      <section className="mt-14 border-t border-ink/30 pt-10">
        <h2 className={`${HEADING} text-4xl`}>Lives</h2>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink">
          Your organiser decides how many lives everyone starts with, before the competition
          begins. It cannot be changed once round one is under way.
        </p>

        <dl className="mt-7 divide-y divide-ink/30 border-y border-ink/30">
          {LIVES.map((l) => (
            <div key={l.n} className="flex items-baseline gap-5 py-5">
              <dt className="font-data text-4xl font-semibold text-ink">{l.n}</dt>
              <dd>
                <p className="font-display text-2xl uppercase tracking-[0.02em] text-ink">{l.name}</p>
                <p className="mt-1 text-[17px] leading-relaxed text-ink">{l.body}</p>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ------------------------------------------------------------------ steps */}
      <section className="mt-14 border-t border-ink/30 pt-10">
        <h2 className={`${HEADING} text-4xl`}>Playing a round</h2>

        <ol className="mt-7 divide-y divide-ink/30 border-y border-ink/30">
          {STEPS.map((step, i) => (
            <li key={step.name} className="flex gap-5 py-6">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 flex-none items-center justify-center bg-overprint font-display text-lg text-stock-lit"
              >
                {i + 1}
              </span>
              <div>
                <p className="font-display text-2xl uppercase tracking-[0.02em] text-ink">{step.name}</p>
                <p className="mt-2 text-[17px] leading-relaxed text-ink">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-6 max-w-2xl border-l-2 border-ink/40 bg-stock-lit px-4 py-3 text-[16px] leading-relaxed text-ink">
          <strong className="font-semibold">Nothing is final until the round locks.</strong> Until
          then you can switch teams as often as you like, or clear your pick and come back to it.
          The deadline is on your dashboard and again on the pick screen &mdash; your organiser sets
          it, and there is no automatic buffer before kick-off, so read it rather than assuming.
        </p>
      </section>

      {/* --------------------------------------------------------------- strategy */}
      <section className="mt-14 border-t border-ink/30 pt-10">
        <h2 className={`${HEADING} text-4xl`}>Strategy</h2>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink">
          None of this is a rule. It is just what tends to separate the players who last.
        </p>

        <div className="mt-7 grid gap-8 sm:grid-cols-2">
          {STRATEGY.map((group) => (
            <div key={group.title}>
              <p className={`${LABEL} text-ink-fade`}>{group.title}</p>
              <ul className="mt-3 space-y-2">
                {group.points.map((point) => (
                  <li key={point} className="flex gap-3 text-[17px] leading-relaxed text-ink">
                    <span aria-hidden="true" className="text-ink-fade">
                      &mdash;
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- how it ends */}
      <section className="mt-14 border-t border-ink/30 pt-10">
        <h2 className={`${HEADING} text-4xl`}>How it ends</h2>

        <dl className="mt-7 divide-y divide-ink/30 border-y border-ink/30">
          <div className="py-5">
            <dt className="font-display text-2xl uppercase tracking-[0.02em] text-ink">One player left</dt>
            <dd className="mt-1 text-[17px] leading-relaxed text-ink">
              They have won it. That is the last man standing.
            </dd>
          </div>
          <div className="py-5">
            <dt className="font-display text-2xl uppercase tracking-[0.02em] text-ink">Everyone left goes out together</dt>
            <dd className="mt-1 text-[17px] leading-relaxed text-ink">
              Nobody is standing, so they share it. What that means for the prize is your
              organiser&apos;s call &mdash; usually the pot is split, or the whole thing is reset and
              run again.
            </dd>
          </div>
        </dl>
      </section>

      {/* -------------------------------------------------------------------- next */}
      <section className={`${PANEL} mt-14 p-6 sm:p-7`}>
        <p className={`${EYEBROW} text-overprint`}>Next</p>
        <h2 className={`${HEADING} mt-3 text-3xl`}>Ready to play?</h2>
        <p className="mt-3 max-w-lg text-[17px] leading-relaxed text-ink">
          If somebody has sent you a code, you are two minutes from your first pick. If you want to
          run one yourself, the first twenty player places are free.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link
            href="/help/getting-started/players"
            className="rounded-sm bg-overprint px-6 py-3 font-display text-xl uppercase tracking-[0.06em] text-stock-lit transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Joining as a player
          </Link>
          <Link
            href="/help/getting-started/organizers"
            className={`${LABEL} text-ink underline decoration-dotted underline-offset-[6px] transition-colors hover:text-overprint`}
          >
            Running one yourself
          </Link>
        </div>
      </section>
    </div>
  );
}
