import Link from 'next/link';
import { LABEL, EYEBROW, HEADING, PANEL } from '@/lib/design';

export const metadata = {
  title: 'Matchday Rules - Predict Every Match | LMSLocal',
  description:
    'Matchday is a football prediction league from LMSLocal: predict the winner of every match in the gameweek, +3 for a win, +1 for a draw, -1 for a loss. Nobody is knocked out. In beta, coming soon to everyone.',
  alternates: { canonical: 'https://lmslocal.co.uk/help/matchday' },
  openGraph: {
    title: 'Matchday rules',
    description:
      'Predict the winner of every match. Points go on a league table, nobody is knocked out, and most points after the last round wins.',
    type: 'article'
  }
};

/**
 * The Matchday rules, for players and organisers. The contract is docs/matchday.md: §1 for every
 * rule stated here, §2 for the words (a "prediction", never a "pick"; no betting words). Change
 * that doc first, then this page.
 *
 * Matchday is in preview (MATCHDAY_PREVIEW_ORGANISER_IDS), so this page explains the game and says
 * it is coming soon; it offers no way to start one. At launch, drop the beta notice and point the
 * "Next" panel at the create wizard.
 */

const SCORING = [
  { points: '+3', name: 'Predicted team wins', body: 'The result they called.' },
  { points: '+1', name: 'Draw', body: 'Nobody can predict a draw, so a draw is a point for everyone who predicted that match.' },
  { points: '−1', name: 'Predicted team loses', body: 'The only result that costs points.' },
  { points: '0', name: 'Left blank', body: 'A match nobody predicted scores nothing, with no penalty for skipping it.' }
];

const ROUND = [
  {
    name: 'The matches go up',
    text: 'Every match of the gameweek is put in for the competition, by us. The organiser has nothing to enter, on Matchday or after it.'
  },
  {
    name: 'Predict the winners',
    text: 'For each match, choose the home team or the away team to win. Predict as many or as few as you like, and change your mind as often as you like until the round locks. There is one deadline for the whole gameweek.'
  },
  {
    name: 'Watch the table',
    text: 'Points go on as the results come in. Once the round has locked, everyone in the competition can see who predicted what.'
  }
];

const ENDING = [
  {
    title: 'A set number of rounds',
    body: 'The organiser chooses 4, 6 or 8 rounds when they set it up. Whoever has the most points after the last round wins.'
  },
  {
    title: 'Level on points',
    body: 'The player with more winning predictions finishes higher. Still level, the one who made more predictions. Still level after that, they share it.'
  }
];

const DETAILS = [
  {
    title: 'A total never goes below zero',
    body: 'A bad round can cost points, but if it would take a total under zero, the total stops at zero. There is no hidden debt to pay off afterwards.'
  },
  {
    title: 'Regulation time only',
    body: 'As in Last Man Standing, results are the ninety minutes plus stoppage time. Extra time and penalties do not count.'
  },
  {
    title: 'A postponed match scores 0',
    body: 'Whatever was predicted on it.'
  },
  {
    title: 'Joining closes when round 1 locks',
    body: 'Exactly as in Last Man Standing. A late joiner would start too far behind to have a chance.'
  },
  {
    title: 'Coming to the app very soon',
    body: 'Until the iPhone and Android app update arrives, Matchday is played in a web browser at lmslocal.co.uk, on a phone, tablet or computer.'
  },
  {
    title: 'Players make their own predictions',
    body: 'Unlike Last Man Standing, an organiser cannot put predictions in on somebody’s behalf.'
  }
];

export default function MatchdayRulesPage() {
  return (
    <div className="max-w-3xl">
      <p className={`${EYEBROW} text-overprint`}>The second game &middot; in beta</p>
      <h1 className={`${HEADING} mt-4 text-5xl sm:text-6xl`}>How to play Matchday</h1>
      <p className="mt-6 max-w-xl text-xl leading-relaxed text-ink">
        Predict the winner of every match in the gameweek. Points go on a league table, nobody is
        knocked out, and the most points after the last round wins.
      </p>

      <p className="mt-6 max-w-2xl border-l-2 border-overprint bg-stock-lit px-4 py-3 text-[16px] leading-relaxed text-ink">
        <strong className="font-semibold">Matchday is in beta and coming soon to everyone.</strong>{' '}
        Last Man Standing is open to every organiser now &mdash;{' '}
        <Link href="/help/how-to-play" className="underline decoration-dotted underline-offset-4 hover:text-overprint">
          its rules are here
        </Link>
        .
      </p>

      {/* ------------------------------------------------------------ what it is */}
      <section className="mt-12 border-t border-ink/30 pt-10">
        <h2 className={`${HEADING} text-4xl`}>What is Matchday?</h2>
        <p className="mt-4 text-[17px] leading-relaxed text-ink">
          A football prediction league, played on the same real matches as Last Man Standing. Where
          Last Man Standing asks for one team a round and knocks out anybody who gets it wrong,
          Matchday asks for the winner of every match and keeps everybody in. A wrong call costs a
          point; it never costs you your place.
        </p>
        <p className="mt-4 text-[17px] leading-relaxed text-ink">
          That makes it the one to run when you want your whole group playing to the last weekend,
          not just the few still standing.
        </p>
      </section>

      {/* --------------------------------------------------------------- scoring */}
      <section className="mt-12 border-t border-ink/30 pt-10">
        <h2 className={`${HEADING} text-4xl`}>Scoring</h2>
        <dl className="mt-7 divide-y divide-ink/30 border-y border-ink/30">
          {SCORING.map((s) => (
            <div key={s.name} className="flex items-baseline gap-5 py-5">
              <dt className="w-14 flex-none font-data text-4xl font-semibold text-ink">{s.points}</dt>
              <dd>
                <p className="font-display text-2xl uppercase tracking-[0.02em] text-ink">{s.name}</p>
                <p className="mt-1 text-[17px] leading-relaxed text-ink">{s.body}</p>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ------------------------------------------------------------------ round */}
      <section className="mt-14 border-t border-ink/30 pt-10">
        <h2 className={`${HEADING} text-4xl`}>Playing a round</h2>
        <ol className="mt-7 divide-y divide-ink/30 border-y border-ink/30">
          {ROUND.map((step, i) => (
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
      </section>

      {/* ------------------------------------------------------------- how it ends */}
      <section className="mt-14 border-t border-ink/30 pt-10">
        <h2 className={`${HEADING} text-4xl`}>How it ends</h2>
        <dl className="mt-7 divide-y divide-ink/30 border-y border-ink/30">
          {ENDING.map((e) => (
            <div key={e.title} className="py-5">
              <dt className="font-display text-2xl uppercase tracking-[0.02em] text-ink">{e.title}</dt>
              <dd className="mt-1 text-[17px] leading-relaxed text-ink">{e.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ----------------------------------------------------------- the details */}
      <section className="mt-14 border-t border-ink/30 pt-10">
        <h2 className={`${HEADING} text-4xl`}>The details</h2>
        <div className="mt-6 space-y-4">
          {DETAILS.map((d) => (
            <div key={d.title} className="border-l-2 border-ink/40 bg-stock-lit px-4 py-3">
              <p className={`${LABEL} text-ink`}>{d.title}</p>
              <p className="mt-1.5 text-[16px] leading-relaxed text-ink">{d.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------------------- next */}
      <section className={`${PANEL} mt-14 p-6 sm:p-7`}>
        <p className={`${EYEBROW} text-overprint`}>Next</p>
        <h2 className={`${HEADING} mt-3 text-3xl`}>Been sent a Matchday code?</h2>
        <p className="mt-3 max-w-lg text-[17px] leading-relaxed text-ink">
          Put it in the join box on the home page, in a web browser, and you are on the table. The
          price for organisers is the same as Last Man Standing: one player, one place, with the
          first twenty free.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link
            href="/"
            className="rounded-sm bg-overprint px-6 py-3 font-display text-xl uppercase tracking-[0.06em] text-stock-lit transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Enter a code
          </Link>
          <Link
            href="/help/faq#matchday"
            className={`${LABEL} text-ink underline decoration-dotted underline-offset-[6px] transition-colors hover:text-overprint`}
          >
            Matchday questions
          </Link>
        </div>
      </section>
    </div>
  );
}
