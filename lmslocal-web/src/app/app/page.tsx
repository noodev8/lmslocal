import Link from 'next/link';
import PublicHeader from '@/components/public/PublicHeader';
import PublicFooter from '@/components/public/PublicFooter';
import { LABEL, EYEBROW, HEADING, PANEL, TICK, BTN_PRIMARY, BTN_DARK } from '@/lib/design';

export const metadata = {
  title: 'Last Man Standing App for iPhone and Android | LMSLocal',
  description:
    'Free Last Man Standing football app for players: join with a code, pick one team a round and follow the standings. Organisers run the competition in a browser, with nothing to install.',
  keywords:
    'last man standing app, last man standing football app, lms app, last man standing app free, football survivor app, last man standing iphone android',
  alternates: { canonical: 'https://lmslocal.co.uk/app' },
  openGraph: {
    title: 'The Last Man Standing app',
    description:
      'Free player apps for iPhone and Android. Join with a code, pick one team a round, follow the standings. Organisers run it in a browser.',
    url: 'https://lmslocal.co.uk/app',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Last Man Standing app',
    description:
      'Free player apps for iPhone and Android. Join with a code, pick one team a round, follow the standings.'
  }
};

/*
  THE APP PAGE.

  Built 2026-09-13 off Search Console. We were averaging position 9 on "last man standing app"
  with 119 impressions, plus another 139 across "last man standing football app", "last man
  standing app football" and "best last man standing app" - ranking for the app queries on a site
  that had no page about the app, and whose structured data said "no app to install". Page one for
  those terms is almost entirely App Store and Play listings, so a page that is actually about the
  app is the cheapest ranking left.

  TWO AUDIENCES, AND THAT IS THE POINT. "last man standing app" is typed both by a player who has
  been sent a code and by a landlord looking for something to RUN one with - "best app to run a
  last man standing competition for a pub" is a real query we already rank for. The page answers
  both in the order they need: what the apps are, then the fact that the organiser side is a
  browser and needs no install.

  VOICE: "you" stays the organiser, per docs/design-system.md §9. The player block addresses
  players directly, which is the same exception the join strip on the landing page takes, and it
  is signposted with its own heading rather than drifting mid-paragraph.

  HONESTY: these are PLAYER apps. You cannot create or run a competition from them. Do not let a
  later edit round that off into "manage your competition on the go" - it would be the single
  most damaging false claim on the site, because it is the one someone would download to test.
*/

const IOS_URL = 'https://apps.apple.com/gb/app/lms-local/id6755344736';
const ANDROID_URL = 'https://play.google.com/store/apps/details?id=uk.co.lmslocal.lmslocal_flutter';

/* Every line traceable to what the app actually does - see the store listing before adding one. */
const IN_THE_APP = [
  'Join with a code or a link',
  'See the matches for each round',
  'Pick a team before the deadline',
  'Watch the standings as results land',
  'Check which teams are still available',
  'See what everyone picked once a round locks'
];

/* Rendered as FAQPage schema as well as read by a person, so the two cannot drift apart. The
   answers are deliberately the ones an assistant would quote when asked "is there an LMS app". */
const QUESTIONS = [
  {
    q: 'Is there a Last Man Standing app?',
    a: 'Yes. LMS Local is a free Last Man Standing app for iPhone and Android. Players join a competition with a code, pick one team each round and follow the standings from their phone. Organisers set up and run the competition in a web browser instead.'
  },
  {
    q: 'Does it cost anything?',
    a: 'The app is free for players, with no ads and nothing to buy inside it. Organisers start free too: the first twenty player places cost nothing and there is no card to enter.'
  },
  {
    q: 'Do players have to install it?',
    a: 'No. Everything a player does works in a phone browser, so nobody is shut out of your competition for not wanting another app. The app is there for the players who would rather have one.'
  },
  {
    q: 'Can I run a competition from the app?',
    a: 'Not from the app. Setting up a competition, entering results and managing players are done in a browser, on a phone or a laptop. The app is built for playing rather than organising.'
  }
];

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: QUESTIONS.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a }
  }))
};

export default function AppPage() {
  return (
    <div className="flex min-h-screen flex-col bg-stock font-body text-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <PublicHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <p className={`${EYEBROW} text-overprint`}>iPhone and Android</p>
        <h1 className={`${HEADING} mt-4 text-6xl sm:text-7xl`}>
          The Last Man
          <br />
          Standing app
        </h1>
        <p className="mt-6 max-w-xl text-xl leading-relaxed text-ink">
          Free for players. Join with a code, pick one team a round, and follow the standings as the
          results come in. Setting a competition up is done in a browser &mdash; there is nothing for
          an organiser to install.
        </p>

        {/* ------------------------------------------------------------ the player block */}
        <section className="mt-12 border-y border-ink/30 py-10">
          <h2 className={`${HEADING} text-4xl`}>If you are playing</h2>
          <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink">
            Somebody has sent you a code. Get the app, or just open the link they sent &mdash; both
            work, and the app is free either way.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-4">
            <a
              href={IOS_URL}
              className={`${BTN_PRIMARY} inline-block px-7 py-3.5 text-2xl`}
            >
              App Store
            </a>
            <a
              href={ANDROID_URL}
              className={`${BTN_DARK} inline-block px-7 py-3.5 text-2xl`}
            >
              Google Play
            </a>
          </div>

          <ul className="mt-9 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {IN_THE_APP.map((item) => (
              <li key={item} className="flex gap-3 text-[17px] leading-relaxed text-ink">
                <span className={TICK} aria-hidden="true">
                  &#10003;
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ------------------------------------------------------------ the organiser block */}
        <section className="mt-14">
          <p className={`${EYEBROW} text-overprint`}>If you are running one</p>
          <h2 className={`${HEADING} mt-3 text-4xl`}>Nothing to install</h2>
          <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-ink">
            You set a competition up in a browser, on whatever you already have open. Matches and
            results are handled for you on the leagues we cover, the eliminations follow on their
            own, and a round update is written for you to paste into WhatsApp.
          </p>

          <div className={`${PANEL} mt-7 max-w-2xl p-5 sm:p-6`}>
            <p className="text-[17px] leading-relaxed text-ink">
              Your players do not need the app either. Everything works in a phone browser, so a
              competition is never held up by somebody who will not download something &mdash; and
              you can enter a pick by hand for anyone without a smartphone at all.
            </p>
          </div>

          <div className="mt-9">
            <Link
              href="/competition/create"
              className={`${BTN_PRIMARY} inline-block px-8 py-4 text-2xl`}
            >
              Start one &mdash; free
            </Link>
            <p className={`${LABEL} mt-4 text-ink-fade`}>20 places free &middot; no card</p>
          </div>
        </section>

        {/* ------------------------------------------------------------ questions */}
        <section className="mt-16 border-t border-ink/30 pt-10">
          <h2 className={`${HEADING} text-4xl`}>Questions</h2>
          <dl className="mt-7 divide-y divide-ink/30 border-y border-ink/30">
            {QUESTIONS.map((item) => (
              <div key={item.q} className="py-6">
                <dt className="font-display text-2xl uppercase tracking-[0.02em] text-ink">{item.q}</dt>
                <dd className="mt-2 max-w-2xl text-[17px] leading-relaxed text-ink">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
