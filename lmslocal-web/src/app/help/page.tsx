import Link from 'next/link';
import { LABEL, EYEBROW, HEADING, PANEL } from '@/lib/design';

export const metadata = {
  title: 'Help Centre: Last Man Standing and Matchday | LMSLocal',
  description:
    'Help for Last Man Standing football competitions and Matchday: the rules, a printable rules sheet, setting a competition up for your workplace, friends or club, joining as a player, and answers to common questions.',
  alternates: { canonical: 'https://lmslocal.co.uk/help' },
  openGraph: {
    title: 'LMSLocal Help Centre',
    description:
      'The rules of both games, setting up a competition, joining as a player, and answers to the questions organisers and players actually ask.',
    type: 'website'
  }
};

/**
 * Help home. Built to the coupon design system — see docs/design-system.md.
 *
 * Grouped by game first, then by job (2026-11-24). With two games, a flat list made the reader
 * work out which pages were about which game; now the game is the first thing each group says,
 * as docs/matchday.md §8.1 asks of every screen. Each destination keeps a line saying what is
 * actually on it, which is the one thing this page can add over the sidebar.
 *
 * Keep the groups in step with NAVIGATION in help/layout.tsx.
 */

type Destination = { href: string; title: string; blurb: string; download?: boolean };
type Group = { id: string; eyebrow: string; title: string; items: Destination[] };

const GROUPS: Group[] = [
  {
    id: 'lms',
    eyebrow: 'The knockout',
    title: 'Last Man Standing',
    items: [
      {
        href: '/help/how-to-play',
        title: 'The rules',
        blurb:
          'Everything in one place: what a draw does, why only ninety minutes count, no team twice, lives, postponed matches and what happens if everyone goes out.'
      },
      {
        href: '/last-man-standing-rules.pdf',
        title: 'The rules, printed',
        blurb: 'One A4 page with blanks for your entry fee, prize and deadline. Free to copy and pin up.',
        download: true
      },
      {
        href: '/last-man-standing-template',
        title: 'A free spreadsheet',
        blurb: 'For running one by hand: team dropdowns, a teams-used count and a duplicate-pick check.'
      }
    ]
  },
  {
    id: 'matchday',
    eyebrow: 'The league table · coming soon',
    title: 'Matchday',
    items: [
      {
        href: '/help/matchday',
        title: 'The rules',
        blurb:
          'Predict the winner of every match, +3 for a win and +1 for a draw, points on a league table, nobody knocked out. In beta and opening to everyone soon.'
      },
      {
        href: '/football-prediction-league',
        title: 'Running it as a prediction league',
        blurb: 'For organisers: why it keeps a whole workplace or group playing to the end, and how it compares with Last Man Standing.'
      }
    ]
  },
  {
    id: 'running',
    eyebrow: 'For organisers',
    title: 'Running a competition',
    items: [
      {
        href: '/help/getting-started/organizers',
        title: 'Setting one up',
        blurb:
          'Creating a competition, choosing whether we supply the matches or you do, inviting players, and what happens each round once it is live.'
      },
      {
        href: '/pricing',
        title: 'What it costs',
        blurb: 'The first 20 player places are free, with no card. The packs beyond that, and how places are counted.'
      },
      {
        href: '/help/fundraising',
        title: 'Raising money with one',
        blurb:
          'How clubs and others structure the entry fee and the prize, what a competition of a given size comes to, and whether to allow buy-backs.'
      },
      {
        href: '/help/is-it-gambling',
        title: 'Is it gambling?',
        blurb:
          'Where an entry fee and a prize pot sit under UK gambling law, in plain English, with the official pages to check. Not legal advice.'
      }
    ]
  },
  {
    id: 'playing',
    eyebrow: 'For players',
    title: 'Playing in one',
    items: [
      {
        href: '/help/getting-started/players',
        title: 'Joining and playing',
        blurb: 'Getting in with an invite code, making and changing your pick, and following how you are doing.'
      }
    ]
  },
  {
    id: 'more',
    eyebrow: 'Everything else',
    title: 'Questions and contact',
    items: [
      {
        href: '/help/faq',
        title: 'Frequently asked questions',
        blurb: 'Short answers on playing, running a competition and Matchday. The fastest route if you already know what you want to ask.'
      },
      {
        href: '/help/support',
        title: 'Contact us',
        blurb: 'A real person reads these and replies, usually the same day. No account needed.'
      }
    ]
  }
];

/* The handful of things people arrive already wanting to know. */
const QUICK_ANSWERS = [
  { href: '/help/how-to-play#draw', q: 'Does a draw count as a win?', a: 'No. A draw costs you the same as a defeat.' },
  { href: '/help/faq#can-i-change-my-pick', q: 'Can I change my pick?', a: 'Yes, right up until the round locks.' },
  {
    href: '/help/how-to-play#same-team',
    q: 'Can I pick the same team twice?',
    a: 'Not until you have used every team. Then they all come back.'
  },
  {
    href: '/help/faq#can-eliminated-players-rejoin',
    q: 'Can I get back in once I am out?',
    a: 'Only if your organiser brings you back. Some run it as a buy-back — ask them.'
  },
  {
    href: '/help/matchday',
    q: 'What is Matchday?',
    a: 'The second game: predict every match, points on a table, nobody goes out. Coming soon.'
  },
  {
    // Straight to pricing: somebody asking what it costs wants the packs, not a summary of them.
    href: '/pricing',
    q: 'What does it cost to run?',
    a: 'Your first 20 player places are free. See what the packs cost beyond that.'
  }
];

export default function HelpHomePage() {
  return (
    <div className="max-w-3xl">
      <h1 className={`${HEADING} text-5xl sm:text-6xl`}>Help centre</h1>
      <p className="mt-6 max-w-xl text-[18px] leading-relaxed text-ink">
        The rules of both games, running a competition for your workplace, friends or club, and
        playing in one.
      </p>

      {/* ------------------------------------------------------------ quick answers */}
      <section className="mt-16 border-t border-ink/30 pt-12">
        <p className={`${EYEBROW} text-overprint`}>Asked most often</p>
        <div className="mt-7 grid gap-px border border-ink/30 bg-ink/30 sm:grid-cols-2">
          {QUICK_ANSWERS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="bg-stock-lit p-6 transition-colors hover:bg-stock focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
            >
              <p className={`${LABEL} text-ink-fade`}>{item.q}</p>
              <p className="mt-2 text-[17px] leading-relaxed text-ink">{item.a}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- the groups */}
      {GROUPS.map((group) => (
        <section key={group.id} id={group.id} className="mt-20 scroll-mt-8 border-t border-ink/30 pt-12">
          <p className={`${EYEBROW} text-overprint`}>{group.eyebrow}</p>
          <h2 className={`${HEADING} mt-4 text-4xl`}>{group.title}</h2>
          <dl className="mt-7 divide-y divide-ink/30 border-y border-ink/30">
            {group.items.map((d) => (
              <div key={d.href} className="py-7">
                <dt>
                  {/* A file is a plain anchor: Link would try to route to it. */}
                  {d.download ? (
                    <a
                      href={d.href}
                      download
                      className={`${HEADING} text-2xl tracking-[0.02em] underline decoration-ink/30 decoration-dotted underline-offset-[6px] transition-colors hover:text-overprint hover:decoration-overprint`}
                    >
                      {d.title}
                    </a>
                  ) : (
                    <Link
                      href={d.href}
                      className={`${HEADING} text-2xl tracking-[0.02em] underline decoration-ink/30 decoration-dotted underline-offset-[6px] transition-colors hover:text-overprint hover:decoration-overprint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink`}
                    >
                      {d.title}
                    </Link>
                  )}
                </dt>
                <dd className="mt-2 text-[17px] leading-relaxed text-ink">{d.blurb}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      {/* ---------------------------------------------------------------- new here? */}
      <section className={`${PANEL} mt-20 p-7 sm:p-8`}>
        <p className={`${EYEBROW} text-overprint`}>Not started yet?</p>
        <h2 className={`${HEADING} mt-3 text-3xl`}>Set one up in five minutes</h2>
        <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-ink">
          Twenty player places are free. There is no card to enter and nothing to install &mdash;
          yours or your players&apos;.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
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
