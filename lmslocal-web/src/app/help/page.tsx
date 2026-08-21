import Link from 'next/link';
import { LABEL, EYEBROW, HEADING, PANEL } from '@/lib/design';

export const metadata = {
  title: 'Help Centre - LMSLocal',
  description:
    'How to run and play a Last Man Standing competition: the rules, setting one up for your pub, workplace or club, joining as a player, and answers to the common questions.',
  alternates: { canonical: 'https://lmslocal.co.uk/help' },
  openGraph: {
    title: 'LMSLocal Help Centre',
    description:
      'The rules, setting up a competition, joining as a player, and answers to the questions organisers and players actually ask.',
    type: 'website'
  }
};

/**
 * Help home. Built to the coupon design system — see docs/design-system.md.
 *
 * The old version was three panels of links to the same six pages the sidebar already lists,
 * plus its own copy of the contact panel the layout appends to every help page. This is one
 * ruled index instead: each destination gets a line saying what is actually on it, which is the
 * only thing a landing page here can add over the navigation.
 */

const DESTINATIONS = [
  {
    href: '/help/how-to-play',
    title: 'How to play',
    blurb:
      'The rules in full. What a draw does to your pick, why regulation time is the only thing that counts, how lives work, and what happens when you have used every team.',
    who: 'Everyone'
  },
  {
    href: '/help/getting-started/organizers',
    title: 'Setting up a competition',
    blurb:
      'Creating one, choosing whether we run the fixtures or you do, inviting players, and what happens each round once it is live.',
    who: 'Organisers'
  },
  {
    href: '/help/getting-started/players',
    title: 'Joining and playing',
    blurb: 'Getting in with an invite code, making and changing your pick, and following how you are doing.',
    who: 'Players'
  },
  {
    href: '/help/faq',
    title: 'Frequently asked questions',
    blurb:
      'Thirty-odd short answers, grouped by whether you are playing or running it. The fastest route if you already know what you want to ask.',
    who: 'Everyone'
  },
  {
    href: '/help/support',
    title: 'Contact us',
    blurb: 'A real person reads these and replies, usually the same day. No account needed.',
    who: 'Everyone'
  }
];

/* The handful of things people arrive already wanting to know. Deep links into the FAQ. */
const QUICK_ANSWERS = [
  { href: '/help/faq#does-a-draw-count-as-a-win', q: 'Does a draw count as a win?', a: 'No. A draw costs you the same as a defeat.' },
  { href: '/help/faq#can-i-change-my-pick', q: 'Can I change my pick?', a: 'Yes, right up until the round locks.' },
  {
    href: '/help/faq#what-happens-when-i-run-out-of-teams',
    q: 'What if I run out of teams?',
    a: 'They all come back and you start the list again.'
  },
  { href: '/help/faq#how-much-does-it-cost', q: 'What does it cost to run?', a: 'Your first 20 player places are free.' }
];

export default function HelpHomePage() {
  return (
    <div className="max-w-3xl">
      <h1 className={`${HEADING} text-5xl sm:text-6xl`}>Help centre</h1>
      <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink">
        Everything about running a Last Man Standing competition for your pub, workplace or club
        &mdash; and about playing in one.
      </p>

      {/* ------------------------------------------------------------ quick answers */}
      <section className="mt-12 border-t border-ink/30 pt-10">
        <p className={`${EYEBROW} text-overprint`}>Asked most often</p>

        <div className="mt-6 grid gap-px border border-ink/30 bg-ink/30 sm:grid-cols-2">
          {QUICK_ANSWERS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="bg-stock-lit p-5 transition-colors hover:bg-stock focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
            >
              <p className={`${LABEL} text-ink-fade`}>{item.q}</p>
              <p className="mt-2 text-[17px] leading-relaxed text-ink">{item.a}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- destinations */}
      <section className="mt-14 border-t border-ink/30 pt-10">
        <p className={`${EYEBROW} text-ink-fade`}>Browse</p>

        <dl className="mt-6 divide-y divide-ink/30 border-y border-ink/30">
          {DESTINATIONS.map((d) => (
            <div key={d.href} className="py-7 first:pt-6 last:pb-6">
              <dt className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <Link
                  href={d.href}
                  className={`${HEADING} text-2xl tracking-[0.02em] underline decoration-ink/30 decoration-dotted underline-offset-[6px] transition-colors hover:text-overprint hover:decoration-overprint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink`}
                >
                  {d.title}
                </Link>
                <span className={`${LABEL} text-ink-fade`}>{d.who}</span>
              </dt>
              <dd className="mt-2 text-[17px] leading-relaxed text-ink">{d.blurb}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ---------------------------------------------------------------- new here? */}
      <section className={`${PANEL} mt-14 p-6 sm:p-7`}>
        <p className={`${EYEBROW} text-overprint`}>Not started yet?</p>
        <h2 className={`${HEADING} mt-3 text-3xl`}>Set one up in five minutes</h2>
        <p className="mt-3 max-w-lg text-[17px] leading-relaxed text-ink">
          Twenty player places are free and stay free. There is no card to enter and nothing to
          install &mdash; yours or your players&apos;.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link
            href="/register"
            className="rounded-sm bg-overprint px-6 py-3 font-display text-xl uppercase tracking-[0.06em] text-stock-lit transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Create a competition
          </Link>
          <Link
            href="/pricing"
            className={`${LABEL} text-ink underline decoration-dotted underline-offset-[6px] transition-colors hover:text-overprint`}
          >
            What it costs
          </Link>
        </div>
      </section>
    </div>
  );
}
