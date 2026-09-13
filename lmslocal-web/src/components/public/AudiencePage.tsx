import Link from 'next/link';
import type { ReactNode } from 'react';
import PublicHeader from './PublicHeader';
import PublicFooter from './PublicFooter';
import { LABEL, EYEBROW, HEADING, PANEL, TICK, BTN_PRIMARY } from '@/lib/design';

/*
  Shared frame for the three audience pages: pubs, workplaces and clubs.

  WHY A SHARED COMPONENT AND NOT A SHARED PAGE. Everything ranked on lmslocal.co.uk ranked on the
  home page - the whole site was one commercial page competing for every intent at once, while
  competitors rank a page per intent (football-knockout.co.uk/last-man-standing-game-workplace,
  lms-challenge.com/run-last-man-standing-competition). These three pages are the answer to that.

  So the chrome is shared and THE WORDS ARE NOT. Each page carries its own argument, because three
  pages saying the same thing with the nouns swapped are doorway pages, and Google has been able
  to spot those for twenty years. If you add a fourth audience, write it a real page or do not
  write it at all - a page that only exists to hold a keyword will cost more than it earns.

  Copy rules still apply here (docs/design-system.md SS9): "you" is the organiser, it is "matches"
  rather than "fixtures", prices and offers are facts with no urgency theatre, and nothing claims
  a legal position - anything touching money links to /help/is-it-gambling rather than answering.
*/

export type AudienceSection = {
  heading: string;
  body: ReactNode[];
  /** Optional tick list beneath the prose. */
  list?: string[];
};

export type AudienceContent = {
  eyebrow: string;
  /** Rendered as the h1. Use a two-line shape - the display face is condensed and wants breaking. */
  title: ReactNode;
  lead: ReactNode;
  sections: AudienceSection[];
  /** The "what you actually do" list. Every page has one; it is the objection that stops people. */
  weekly: { heading: string; items: string[] };
  questions: { q: string; a: string }[];
  ctaNote: string;
  alsoSee: { href: string; label: string }[];
};

export default function AudiencePage({ content }: { content: AudienceContent }) {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: content.questions.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a }
    }))
  };

  return (
    <div className="flex min-h-screen flex-col bg-stock font-body text-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <PublicHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <p className={`${EYEBROW} text-overprint`}>{content.eyebrow}</p>
        <h1 className={`${HEADING} mt-4 text-6xl sm:text-7xl`}>{content.title}</h1>
        <p className="mt-6 max-w-2xl text-xl leading-relaxed text-ink">{content.lead}</p>

        {content.sections.map((section) => (
          <section key={section.heading} className="mt-14 border-t border-ink/30 pt-10">
            <h2 className={`${HEADING} text-4xl`}>{section.heading}</h2>
            {section.body.map((para, i) => (
              <p key={i} className="mt-4 max-w-2xl text-[17px] leading-relaxed text-ink">
                {para}
              </p>
            ))}
            {section.list && (
              <ul className="mt-7 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {section.list.map((item) => (
                  <li key={item} className="flex gap-3 text-[17px] leading-relaxed text-ink">
                    <span className={TICK} aria-hidden="true">
                      &#10003;
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        {/* The weekly job, in a panel, because "how much work is this?" is the real objection. */}
        <section className="mt-14">
          <div className={`${PANEL} max-w-2xl p-5 sm:p-6`}>
            <h2 className={`${HEADING} text-3xl`}>{content.weekly.heading}</h2>
            <ol className="mt-5 divide-y divide-ink/30 border-y border-ink/30">
              {content.weekly.items.map((item, i) => (
                <li key={item} className="flex gap-4 py-4">
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 flex-none items-center justify-center bg-overprint font-display text-[15px] text-stock-lit"
                  >
                    {i + 1}
                  </span>
                  <span className="text-[17px] leading-relaxed text-ink">{item}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mt-14 border-t border-ink/30 pt-10">
          <h2 className={`${HEADING} text-4xl`}>Questions</h2>
          <dl className="mt-7 divide-y divide-ink/30 border-y border-ink/30">
            {content.questions.map((item) => (
              <div key={item.q} className="py-6">
                <dt className="font-display text-2xl uppercase tracking-[0.02em] text-ink">{item.q}</dt>
                <dd className="mt-2 max-w-2xl text-[17px] leading-relaxed text-ink">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="mt-14">
          <Link href="/competition/create" className={`${BTN_PRIMARY} inline-block px-8 py-4 text-2xl`}>
            Start one &mdash; free
          </Link>
          <p className={`${LABEL} mt-4 text-ink-fade`}>{content.ctaNote}</p>
        </div>

        <nav className="mt-12 border-t border-ink/30 pt-6">
          <p className={`${LABEL} text-ink-fade`}>Also worth reading</p>
          <ul className="mt-3 flex flex-wrap gap-x-7 gap-y-2">
            {content.alsoSee.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`${LABEL} text-ink underline decoration-dotted underline-offset-[6px] transition-colors hover:text-overprint`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </main>

      <PublicFooter />
    </div>
  );
}
