import Link from 'next/link';
import AudiencePage, { type AudienceContent } from '@/components/public/AudiencePage';

export const metadata = {
  title: 'Run a Football Prediction League for Work or Friends | LMSLocal',
  description:
    'Matchday is a football prediction league for your workplace, friends or club. Players predict the winner of every match, points go on a league table, and nobody is knocked out. We put the matches and results in. In beta, opening soon.',
  keywords:
    'football prediction league, premier league prediction league, prediction league for friends, office football predictions, work football prediction game, football predictor league',
  alternates: { canonical: 'https://lmslocal.co.uk/football-prediction-league' },
  openGraph: {
    title: 'Matchday: a football prediction league',
    description:
      'Predict the winner of every match. Points on a league table, nobody knocked out, and nothing for the organiser to enter.',
    url: 'https://lmslocal.co.uk/football-prediction-league',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Matchday: a football prediction league',
    description:
      'Predict the winner of every match. Points on a league table, nobody knocked out, nothing for the organiser to enter.'
  }
};

/*
  MATCHDAY'S SEARCH PAGE (2026-11-24). Nobody searches for "Matchday" - it is a common football
  word we cannot own (docs/matchday.md §11) - so this page is built on the phrase people do type,
  "football prediction league", and on the workplaces and groups of friends who make up most of
  our organisers. /help/matchday stays as the rules page; this one makes the case to an organiser.

  The argument is EVERYONE PLAYS TO THE END: Last Man Standing loses most of its players in the
  first few weeks, and this does not. The second is that it is simpler than the predictor games
  people know - home or away, no scores to guess - and asks nothing of the organiser.

  Rules from docs/matchday.md §1, words from §2: "predict" and "prediction", never "pick", and none
  of the betting words. Every claim is true of the build today: always on our matches, web only
  until the app update, no entering predictions for somebody else.

  Announced, not offered: creating one is preview-only (MATCHDAY_PREVIEW_ORGANISER_IDS), so the
  button below starts Last Man Standing, and says so. At launch, point `cta` at the create wizard
  with a Matchday label, rewrite "Can I run one now?", and drop the "opening soon" wording here, in
  the metadata and in ctaNote.
*/

const content: AudienceContent = {
  eyebrow: 'Matchday · a football prediction league · in beta',
  title: (
    <>
      A prediction league
      <br />
      nobody drops out of
    </>
  ),
  lead: (
    <>
      Matchday is a football prediction league for your workplace, your mates or your club. Players
      predict the winner of every match in the round, the points go on a league table, and nobody
      is knocked out &mdash; so your whole group is still playing on the last weekend.
    </>
  ),
  sections: [
    {
      heading: 'Everybody plays to the end',
      body: [
        'A knockout loses most of its players in the first few weeks. Once they are out they stop checking, and by the final rounds the competition belongs to a handful of people. Matchday keeps everybody in: a bad weekend costs points, never a place.',
        'You choose how long it runs when you set it up — 4, 6 or 8 rounds — so it has a finishing date everyone knows from the start. Most points after the last round wins.'
      ],
      list: [
        'Nobody is knocked out',
        'You choose the length: 4, 6 or 8 rounds',
        'Most points after the last round wins',
        'Level on points? Most wins, then most predictions made'
      ]
    },
    {
      heading: 'Simple enough for anyone',
      body: [
        'For each match, players choose the home team or the away team to win. There are no scores to guess and no draws to call, so somebody who barely follows football can fill in a round in a couple of minutes.',
        'A win they predicted is worth 3 points. If the match is drawn, everyone who predicted it gets 1, whichever side they chose. A wrong prediction scores nothing, the same as leaving it blank, and nothing ever takes points away — a total only goes up.'
      ],
      list: [
        'Predicted team wins: 3 points',
        'The match is a draw: 1 point',
        'Predicted team loses: 0',
        'Match left blank: 0'
      ]
    },
    {
      heading: 'Nothing for you to enter',
      body: [
        'We put every match of the gameweek into your competition, and the results in after full time. The table moves as the results come in, and once a round has locked everyone can see who predicted what — which is where the arguments start.',
        'Matchday always runs on the leagues we cover, with our matches and results. Unlike Last Man Standing, there is no version where you put the matches in yourself.'
      ]
    },
    {
      heading: 'Matchday or Last Man Standing?',
      body: [
        'Both run on the same real matches and cost the same: one player, one place, with the first twenty places free.',
        <>
          Run Last Man Standing if you want a knockout with one survivor, or if some of your players
          do not use phones &mdash; in Last Man Standing you can add them and put their picks in for
          them. Run Matchday if you want everybody involved to the end and a fixed finishing date.
          In Matchday every player makes their own predictions. The{' '}
          <Link href="/help/how-to-play" className="underline decoration-dotted underline-offset-4 hover:text-overprint">
            Last Man Standing rules
          </Link>{' '}
          and the{' '}
          <Link href="/help/matchday" className="underline decoration-dotted underline-offset-4 hover:text-overprint">
            Matchday rules
          </Link>{' '}
          set the two side by side.
        </>
      ]
    }
  ],
  weekly: {
    heading: 'What you actually do',
    items: [
      'Set it up once and choose 4, 6 or 8 rounds',
      'Send the join link or code to your group, before round 1 locks',
      'Watch the table — the matches and results are ours to put in'
    ]
  },
  questions: [
    {
      q: 'Can I run a Matchday competition now?',
      a: 'Not quite yet. Matchday is in beta and opens to every organiser soon. Last Man Standing is open now, on the same matches.'
    },
    {
      q: 'Can players predict a draw?',
      a: 'No. For each match they choose the home team or the away team. If it ends level, everyone who predicted that match gets a point.'
    },
    {
      q: 'Do players have to predict every match?',
      a: 'No. A match left blank scores 0 and there is no penalty. But predictions made is one of the tie-breaks, so filling in the whole round never hurts.'
    },
    {
      q: 'Can players join after it has started?',
      a: 'No. Joining closes when round 1 locks, as in Last Man Standing. Somebody joining later would start too far behind to have a chance.'
    },
    {
      q: 'Can it be played in the app?',
      a: 'Very soon. Until the iPhone and Android app update arrives, Matchday is played in a web browser, on a phone, tablet or computer.'
    },
    {
      q: 'What does it cost?',
      a: 'The same as Last Man Standing. Players join free. You get 20 player places free with no card, and packs of places start at £10 for 20 after that.'
    },
    {
      q: 'Does there have to be an entry fee?',
      a: 'No, and plenty of groups play for bragging rights. A competition with no entry fee is not gambling, whatever the prize. LMSLocal never takes entry money or pays prizes.'
    }
  ],
  cta: { href: '/competition/create', label: 'Start Last Man Standing — free' },
  ctaNote: 'Matchday opens to every organiser soon · Last Man Standing is open now · 20 places free',
  alsoSee: [
    { href: '/help/matchday', label: 'The Matchday rules' },
    { href: '/help/how-to-play', label: 'Last Man Standing rules' },
    { href: '/last-man-standing-at-work', label: 'At work' },
    { href: '/pricing', label: 'Pricing' }
  ]
};

export default function FootballPredictionLeaguePage() {
  return <AudiencePage content={content} />;
}
