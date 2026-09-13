import Link from 'next/link';
import AudiencePage, { type AudienceContent } from '@/components/public/AudiencePage';

export const metadata = {
  title: 'Last Man Standing for Pubs - Run One Behind the Bar | LMSLocal',
  description:
    'Run a Last Man Standing football competition in your pub. You set the entry fee and the prize and keep what is left. Matches and results handled for you, and regulars without a smartphone can still play.',
  keywords:
    'last man standing pub, pub last man standing competition, pub football competition, pub fundraiser football, run a competition in my pub, pub sweepstake alternative',
  alternates: { canonical: 'https://lmslocal.co.uk/last-man-standing-for-pubs' },
  openGraph: {
    title: 'Last Man Standing for pubs',
    description:
      'A competition that runs for weeks and gives regulars a reason to come back in. You set the entry fee and the prize and keep what is left.',
    url: 'https://lmslocal.co.uk/last-man-standing-for-pubs',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Last Man Standing for pubs',
    description:
      'A competition that runs for weeks and gives regulars a reason to come back in. Set up in about five minutes.'
  }
};

/*
  The pub page. The argument is FOOTFALL ON A QUIET NIGHT, not "organise a competition" - a
  landlord does not want a competition, they want people through the door on a Tuesday.

  The smartphone point is load-bearing and specific to this audience. A pub has regulars in their
  seventies who will not download anything, and every competitor's answer is "they download the
  app". Ours is that you can put their pick in for them, which is the single most persuasive true
  thing we can say to a landlord.

  Money is the other half, and it is where the care goes: this page describes what the product
  does with an entry fee and links to /help/is-it-gambling. It must never tell a landlord their
  setup is lawful. See the note at the top of that page.
*/

const content: AudienceContent = {
  eyebrow: 'For pubs and bars',
  title: (
    <>
      Last Man
      <br />
      Standing for pubs
    </>
  ),
  lead: (
    <>
      A competition that runs for weeks, not an evening. Regulars come back in to find out whether
      they survived, and the whole thing is run from behind the bar in a few minutes a week.
    </>
  ),
  sections: [
    {
      heading: 'It gives them a reason to come back',
      body: [
        'A quiz night fills the room once. A Last Man Standing competition keeps going for as long as people keep surviving - every weekend there is a result, somebody goes out, and the people still in have something to talk about at the bar.',
        'Players pick one team to win each round. A draw or a defeat and they are out. They cannot pick the same team twice until they have used them all, so by round five the easy choices are gone and it stops being about who knows football.'
      ],
      list: [
        'Runs for weeks off one setup',
        'A result to talk about every weekend',
        'Nobody needs to know much about football',
        'Works alongside whatever else you run'
      ]
    },
    {
      heading: 'The money is yours',
      body: [
        'You decide whether there is an entry fee at all, what it is, and what the prize is. We take no cut of it - what your players pay you never passes through us. Plenty of pubs run it for nothing more than a free round for the winner.',
        <>
          If you do take entry money, it is worth understanding where that sits before you start
          rather than afterwards. We have written a plain-English guide to the landscape, with the
          official pages to check:{' '}
          <Link
            href="/help/is-it-gambling"
            className="underline decoration-dotted underline-offset-4 hover:text-overprint"
          >
            is it gambling?
          </Link>{' '}
          We are not lawyers, and that page does not pretend to be a ruling on your pub.
        </>
      ]
    },
    {
      heading: 'Your regulars without a smartphone',
      body: [
        'This is usually the thing that kills a pub competition. Someone who has been drinking in your pub for thirty years is not going to download an app to pick Arsenal, and if the competition cannot include them it is the wrong competition.',
        'So you can enter a pick on somebody else\'s behalf. They tell you their team across the bar, you put it in, and they appear in the standings like everyone else. For the players who do want it on their phone, there is a free app and a browser version, and neither is required.'
      ]
    }
  ],
  weekly: {
    heading: 'What you actually do',
    items: [
      'Set it up once - about five minutes, and you can have it running before you decide whether to spend anything.',
      'Put the join link or QR code where people will see it. Ready-made WhatsApp and social invites are generated for you.',
      'The new round goes up with the real matches already in it, on the leagues we cover.',
      'After full time, the results land and the eliminations follow on their own. Nobody works out who is still in by hand.',
      'A round update is written for you - who went out, who is left. Paste it into WhatsApp or read it out.'
    ]
  },
  questions: [
    {
      q: 'How many people do I need?',
      a: 'It works from about a dozen and it works with a hundred. Fewer players means it finishes sooner, which is not a problem - plenty of pubs run one competition after another through the season rather than one long one.'
    },
    {
      q: 'What if a regular has not got a smartphone?',
      a: 'You can enter their pick for them. They tell you their team at the bar, you put it in, and they show up in the standings like anybody else. Nobody is shut out of the competition for not owning the right phone.'
    },
    {
      q: 'Do I have to charge an entry fee?',
      a: 'No, and many pubs do not. A competition with no entry fee is not gambling however large the prize is, which is the version with nothing to think about. If you do want to charge, read our guide to where that sits under UK gambling law before you start.'
    },
    {
      q: 'What does it cost me?',
      a: 'The first twenty player places are free with no card needed. Beyond that, packs start at £10 for twenty more places. There is no subscription and we take nothing from your entry fees.'
    }
  ],
  ctaNote: '20 places free · no card · about five minutes',
  alsoSee: [
    { href: '/help/is-it-gambling', label: 'Is it gambling?' },
    { href: '/pricing', label: 'What it costs' },
    { href: '/last-man-standing-for-clubs', label: 'For clubs' },
    { href: '/app', label: 'The app' }
  ]
};

export default function PubsPage() {
  return <AudiencePage content={content} />;
}
