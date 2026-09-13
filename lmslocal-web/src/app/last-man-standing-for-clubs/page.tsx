import Link from 'next/link';
import AudiencePage, { type AudienceContent } from '@/components/public/AudiencePage';

export const metadata = {
  title: 'Last Man Standing for Clubs - A Fundraiser That Runs Itself | LMSLocal',
  description:
    'Run a Last Man Standing competition as a club fundraiser. No night to organise, no volunteers on the door, and members stay involved for weeks. Free for the first twenty players.',
  keywords:
    'last man standing club, club fundraiser football, sports club fundraising ideas, grassroots club fundraiser, football club last man standing, charity last man standing',
  alternates: { canonical: 'https://lmslocal.co.uk/last-man-standing-for-clubs' },
  openGraph: {
    title: 'Last Man Standing for clubs',
    description:
      'A fundraiser with no night to organise and no volunteers on the door. Members stay involved for weeks rather than one evening.',
    url: 'https://lmslocal.co.uk/last-man-standing-for-clubs',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Last Man Standing for clubs',
    description:
      'A fundraiser with no night to organise and no volunteers on the door. Members stay involved for weeks.'
  }
};

/*
  The clubs page. The argument is VOLUNTEER TIME, which is the currency a grassroots club is
  actually short of - not ideas for fundraisers. A race night needs a venue, a licence, a rota and
  four people on the door; this needs one person and no evening.

  The second argument is recruitment, and the reset behaviour is the specific thing worth knowing:
  resetting a competition keeps the players, so the second fundraiser does not start from an empty
  room. That is a real product behaviour, not a slogan.

  NO MONEY CLAIMS. /help/fundraising carries a rule at the top of the file - worked examples from a
  stated entry fee, never "you will raise" and never an average. Do not let this page do what that
  page refuses to do; link to it instead.
*/

const content: AudienceContent = {
  eyebrow: 'For clubs and societies',
  title: (
    <>
      Last Man
      <br />
      Standing for clubs
    </>
  ),
  lead: (
    <>
      A fundraiser with no night to organise, no venue to book and nobody on the door. It runs for
      weeks in the background, and the only person it needs is you.
    </>
  ),
  sections: [
    {
      heading: 'It does not cost you a Saturday',
      body: [
        'The problem with a race night or a quiz is rarely that it does not work. It is that it needs a venue, a date everybody can make, a rota of volunteers, and somebody to carry the boxes home afterwards. Clubs are short of that long before they are short of ideas.',
        'This needs none of it. One person sets it up, the competition runs alongside the season, and there is no evening anybody has to turn up to. Members take part from wherever they already are.'
      ],
      list: [
        'No venue, no date, no licence to arrange',
        'No volunteers on the door',
        'Runs for weeks in the background',
        'Members take part from anywhere'
      ]
    },
    {
      heading: 'The second one is easier than the first',
      body: [
        'Most club fundraisers stall on recruitment - you fill the room once, and then you have to fill it again from scratch. This one does not work like that. When a competition finishes you can reset it rather than starting a new one, and your players keep their place without being invited all over again.',
        'It also keeps people involved for longer than an evening does. Every weekend somebody goes out, which is a reason for members to talk to each other about the club between matches.'
      ]
    },
    {
      heading: 'What it raises, honestly',
      body: [
        'That depends entirely on your entry fee and how many members take part, and we are not going to put a number on this page that flatters us.',
        <>
          What we have instead is the arithmetic, worked through from a stated entry fee, along with
          three ways to structure the prize and where each one tends to land:{' '}
          <Link
            href="/help/fundraising"
            className="underline decoration-dotted underline-offset-4 hover:text-overprint"
          >
            the fundraising guide
          </Link>
          . It also covers the part most organisers skip, which is telling everyone what was raised
          at the end.
        </>,
        <>
          If your club is charging an entry fee, it is worth ten minutes on{' '}
          <Link
            href="/help/is-it-gambling"
            className="underline decoration-dotted underline-offset-4 hover:text-overprint"
          >
            where that sits under UK gambling law
          </Link>
          . The tidy &quot;members of a society&quot; exemption people reach for is a lottery
          exemption, and this is not a lottery. We are not lawyers, and that page says so.
        </>
      ]
    }
  ],
  weekly: {
    heading: 'What running it involves',
    items: [
      'Set it up once - about five minutes, free for the first twenty players, no card needed.',
      'Send the join link round your members, or put the QR code on a poster at the ground.',
      'Each round appears with the real matches already in it, on the leagues we cover.',
      'Results land after full time and the eliminations follow on their own.',
      'A round update is written for you to post wherever your members already look.'
    ]
  },
  questions: [
    {
      q: 'How much can a club raise?',
      a: 'It depends on your entry fee and how many members join, so we publish the arithmetic rather than a headline figure. The fundraising guide works it through from a stated entry fee and sets out three ways to structure the prize.'
    },
    {
      q: 'Is it gambling if we charge to enter?',
      a: 'A competition with no entry fee is not regulated gambling however large the prize. Once money changes hands it becomes a real question, and not the one most people expect - the members-of-a-society exemption is a lottery exemption and this is not a lottery. Our guide maps the landscape and links to the official pages, but it is not legal advice.'
    },
    {
      q: 'Do members need to install anything?',
      a: 'No. Everything works in a browser on a phone or a laptop, and there is a free app for members who would rather have one. You can also enter a pick on behalf of anyone who is not online at all.'
    },
    {
      q: 'What happens when the competition finishes?',
      a: 'You can reset it and run another, and your players keep their place rather than having to be invited again. For a club running something every season, that removes the part that usually stops it happening twice.'
    }
  ],
  ctaNote: '20 places free · no card · no venue to book',
  alsoSee: [
    { href: '/help/fundraising', label: 'The fundraising guide' },
    { href: '/help/is-it-gambling', label: 'Is it gambling?' },
    { href: '/pricing', label: 'What it costs' },
    { href: '/last-man-standing-for-pubs', label: 'For pubs' }
  ]
};

export default function ClubsPage() {
  return <AudiencePage content={content} />;
}
