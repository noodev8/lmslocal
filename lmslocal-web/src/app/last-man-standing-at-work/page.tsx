import Link from 'next/link';
import AudiencePage, { type AudienceContent } from '@/components/public/AudiencePage';

export const metadata = {
  title: 'Last Man Standing at Work - Office Football Competition | LMSLocal',
  description:
    'Run a Last Man Standing football competition for your office or team. Free for twenty players, no money has to change hands, and it works across sites and people working from home.',
  keywords:
    'last man standing work, office last man standing, workplace football competition, office football sweepstake, work football competition, team building football competition',
  alternates: { canonical: 'https://lmslocal.co.uk/last-man-standing-at-work' },
  openGraph: {
    title: 'Last Man Standing at work',
    description:
      'An office competition that runs itself. No money has to change hands, and it works across sites and people working from home.',
    url: 'https://lmslocal.co.uk/last-man-standing-at-work',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Last Man Standing at work',
    description:
      'An office competition that runs itself. No money has to change hands, and it works across sites and from home.'
  }
};

/*
  The workplace page. The argument is NOT-MY-PROBLEM: whoever ends up organising this did not ask
  for another job, and the reason office competitions die in November is the spreadsheet, not the
  interest.

  The second argument is that you can run it with no money at all. That is genuinely the easiest
  answer to the HR question, and it is worth leading with rather than burying - a free competition
  is not gambling however big the prize, which takes the whole subject off the table. Anything
  beyond that links to /help/is-it-gambling and does not adjudicate.

  Do not add claims about Teams or Slack integrations. There are none. Sharing is a link, which is
  why the copy says a link.
*/

const content: AudienceContent = {
  eyebrow: 'For offices and teams',
  title: (
    <>
      Last Man
      <br />
      Standing at work
    </>
  ),
  lead: (
    <>
      The office competition that does not become somebody&apos;s second job. It runs for weeks off
      one setup, nobody has to put money in, and it includes the people who do not really follow
      football.
    </>
  ),
  sections: [
    {
      heading: 'Office competitions die in the spreadsheet',
      body: [
        'Not for lack of interest. They die because one person ends up chasing fifteen colleagues for picks on a Friday afternoon, working out by hand who survived, and posting a table nobody trusts. By November they have stopped.',
        'Here the picks come in on their own, the results land after full time, and the eliminations follow without anybody deciding them. The person who set it up is not the person who has to keep it alive.'
      ],
      list: [
        'No chasing - players pick in their own time',
        'Eliminations work themselves out',
        'A standings table nobody has to maintain',
        'One setup lasts the whole run'
      ]
    },
    {
      heading: 'Nobody has to put money in',
      body: [
        'The competition works perfectly well with no entry fee and no prize pot - plenty of workplaces run it for bragging rights, or for whatever the last one standing can talk the team into. A competition with no entry fee is not gambling however big the prize is, which takes the whole subject off the table before anyone has to raise it.',
        <>
          If your office does want to put a few pounds in, it is worth reading where that sits
          first. Our{' '}
          <Link
            href="/help/is-it-gambling"
            className="underline decoration-dotted underline-offset-4 hover:text-overprint"
          >
            plain-English guide
          </Link>{' '}
          covers the parts of UK gambling law that actually apply to colleagues betting between
          themselves - which are not the office-sweepstake rules most people assume. We are not
          lawyers and it is not advice about your workplace.
        </>
      ]
    },
    {
      heading: 'It includes the people who do not follow football',
      body: [
        'Fantasy football rewards the person who already spends Sunday reading team news, and everyone else works out within a fortnight that they cannot win. This does not. You pick one team you think will win, and that is the entire skill.',
        'Which means it survives contact with a real office - people across different sites, people working from home, people who joined because everyone else did. Everything works in a browser, so nobody has to install anything to take part, and there is a free app for the ones who would rather have one.'
      ]
    }
  ],
  weekly: {
    heading: 'What it takes to run',
    items: [
      'Set it up once. About five minutes, free for the first twenty players, no card needed.',
      'Share the join link - in an email, a Teams message, a WhatsApp group, however your team already talks.',
      'Each round goes up with the real matches already in it, on the leagues we cover.',
      'Results land after full time and the eliminations follow on their own.',
      'A round update is written for you to paste wherever everyone will read it.'
    ]
  },
  questions: [
    {
      q: 'Does it cost anything?',
      a: 'The first twenty player places are free, with no card needed to start. If more than twenty colleagues want in, packs start at £10 for twenty more places. There is no subscription.'
    },
    {
      q: 'Do we have to put money in?',
      a: 'No. It runs exactly the same with no entry fee and no prize pot, which is how a lot of workplaces run it. A competition with no entry fee is not regulated gambling however large the prize, so there is nothing to check with anybody.'
    },
    {
      q: 'Does everyone need to install an app?',
      a: 'No. Everything works in a phone or desktop browser, so people can take part from whatever they already have open. There is a free app for iPhone and Android for the people who prefer one, and the organiser side is a browser either way.'
    },
    {
      q: 'What about people who do not follow football?',
      a: 'They do fine. Each round you pick one team you think will win, and you cannot pick the same team twice until you have used them all - so the person who reads team news every Sunday runs out of good options at the same time as everybody else.'
    }
  ],
  ctaNote: '20 places free · no card · nothing to install',
  alsoSee: [
    { href: '/help/is-it-gambling', label: 'Is it gambling?' },
    { href: '/pricing', label: 'What it costs' },
    { href: '/help/how-to-play', label: 'How it works' },
    { href: '/app', label: 'The app' }
  ]
};

export default function WorkplacePage() {
  return <AudiencePage content={content} />;
}
