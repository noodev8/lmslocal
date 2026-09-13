import Link from 'next/link';
import PublicHeader from '@/components/public/PublicHeader';
import PublicFooter from '@/components/public/PublicFooter';
import { LABEL, EYEBROW, HEADING, PANEL, TICK, BTN_PRIMARY, BTN_DARK } from '@/lib/design';

export const metadata = {
  title: 'Free Last Man Standing Spreadsheet Template (Excel) | LMSLocal',
  description:
    'A free Last Man Standing spreadsheet template for Excel or Google Sheets. Team dropdowns, a teams-used count and a duplicate-pick check, with the current Premier League clubs already in it.',
  keywords:
    'last man standing template, last man standing spreadsheet, last man standing excel template, lms spreadsheet, premier league last man standing spreadsheet, last man standing organiser template',
  alternates: { canonical: 'https://lmslocal.co.uk/last-man-standing-template' },
  openGraph: {
    title: 'Free Last Man Standing spreadsheet template',
    description:
      'Team dropdowns, a teams-used count and a duplicate-pick check, with the current Premier League clubs already in it. Free, no email required.',
    url: 'https://lmslocal.co.uk/last-man-standing-template',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Last Man Standing spreadsheet template',
    description: 'Free Excel template with team dropdowns and a duplicate-pick check. No email required.'
  }
};

/*
  THE TEMPLATE PAGE.

  Google's own "People also ask" carries "Can you provide a template for a Premier League Last Man
  Standing spreadsheet?" on more than one query in this niche, and "people also search for" lists
  "Last man standing organiser template". We had nothing for any of it. Search Console shows 7
  impressions across every template query in sixteen months, which measures our absence rather
  than the demand.

  THIS PAGE IS NOT THE RULES PAGE. /help/how-to-play already targets "last man standing rules" -
  a second page aimed at the same term would cannibalise it and make both worse. This one is the
  organiser's question (how do I RUN one on a sheet), it links to the rules rather than restating
  them, and the only rules here are the three DECISIONS a spreadsheet cannot make for you.

  NO EMAIL WALL. The download is a plain link. Gating it would convert a handful of addresses and
  cost the page the thing it is for, which is ranking - a page people bounce off is a page Google
  stops showing. It is also the wrong first impression from a product whose pitch is that it does
  not make you jump through hoops.

  HONESTY ABOUT THE SHEET. It does not work out eliminations, and the page says so plainly rather
  than letting someone find out in October. That is not a crippled demo - see the note in
  scripts/make-lms-template.py. The argument this page makes is true precisely because we gave
  them a genuinely good sheet first.
*/

const FILE = '/last-man-standing-template.xlsx';

const WHATS_IN_IT = [
  'A pick grid for 40 players over 15 rounds',
  'Team dropdowns, so nobody invents a club',
  'A teams-used count per player',
  'A duplicate-pick check that flags itself red',
  'Eliminated players fade out automatically',
  'A rules sheet you can print and pin up'
];

/* The three things a sheet cannot decide for you, and the three that cause every argument. */
const DECIDE = [
  {
    t: 'What a missed pick means',
    b: 'Somebody will forget. Decide before round one whether that is elimination or the loss of a life, say it out loud, and then hold to it. Changing this halfway through is the single quickest way to fall out with people.'
  },
  {
    t: 'When picks lock',
    b: 'Set a deadline before the first kick-off of the round. Arguments in a Last Man Standing competition are almost never about bad luck - they are about a pick that arrived after somebody already knew a score.'
  },
  {
    t: 'What happens if everyone goes out at once',
    b: 'It happens more often than people expect, usually in a round where the favourites all draw. Either share the prize between everyone knocked out in that round, or replay it with the same players. Pick one now, not then.'
  }
];

const QUESTIONS = [
  {
    q: 'Is the template free?',
    a: 'Yes, and there is no email address to hand over. Download it, change it, share it with whoever you like - we are not asking for anything in return.'
  },
  {
    q: 'Does it work in Google Sheets?',
    a: 'Yes. Upload the file to Google Drive and open it with Google Sheets. The dropdowns, the teams-used count and the duplicate-pick check all survive the conversion.'
  },
  {
    q: 'Does it work out who is eliminated?',
    a: 'No, and nothing that runs in a spreadsheet really can - it would need a live results feed. You mark players out yourself using the status column, and the sheet fades the row when you do. Counting teams used and catching duplicate picks are automatic, because those are the parts a spreadsheet is genuinely good at.'
  },
  {
    q: 'Which teams are in it?',
    a: 'The 2026-27 Premier League clubs, taken from the same list our own competitions use. The Teams sheet is editable, so you can swap in any league, a World Cup group stage, or whatever you are actually running.'
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

export default function TemplatePage() {
  return (
    <div className="flex min-h-screen flex-col bg-stock font-body text-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <PublicHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <p className={`${EYEBROW} text-overprint`}>Free download</p>
        <h1 className={`${HEADING} mt-4 text-6xl sm:text-7xl`}>
          Last Man Standing
          <br />
          spreadsheet
        </h1>
        <p className="mt-6 max-w-2xl text-xl leading-relaxed text-ink">
          A sheet that already knows the rules: team dropdowns, a count of who has used what, and a
          check that catches the same team picked twice. This season&apos;s Premier League clubs are
          in it. No email address, no sign-up.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a href={FILE} download className={`${BTN_PRIMARY} inline-block px-7 py-3.5 text-2xl`}>
            Download the sheet
          </a>
          <Link href="/help/how-to-play" className={`${BTN_DARK} inline-block px-7 py-3.5 text-2xl`}>
            The rules
          </Link>
        </div>
        <p className={`${LABEL} mt-4 text-ink-fade`}>Excel .xlsx &middot; opens in Google Sheets &middot; free</p>

        <section className="mt-14 border-t border-ink/30 pt-10">
          <h2 className={`${HEADING} text-4xl`}>What is in it</h2>
          <ul className="mt-7 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {WHATS_IN_IT.map((item) => (
              <li key={item} className="flex gap-3 text-[17px] leading-relaxed text-ink">
                <span className={TICK} aria-hidden="true">
                  &#10003;
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14 border-t border-ink/30 pt-10">
          <h2 className={`${HEADING} text-4xl`}>Three things to decide first</h2>
          <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-ink">
            The rules of Last Man Standing are simple and{' '}
            <Link
              href="/help/how-to-play"
              className="underline decoration-dotted underline-offset-4 hover:text-overprint"
            >
              written up in full here
            </Link>
            . These three are not rules but decisions, they are the ones no spreadsheet can make for
            you, and they cause every argument we have ever heard about.
          </p>
          <ol className="mt-7 divide-y divide-ink/30 border-y border-ink/30">
            {DECIDE.map((item, i) => (
              <li key={item.t} className="flex gap-5 py-6">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 flex-none items-center justify-center bg-overprint font-display text-lg text-stock-lit"
                >
                  {i + 1}
                </span>
                <div>
                  <p className="font-display text-2xl uppercase tracking-[0.02em] text-ink">{item.t}</p>
                  <p className="mt-2 max-w-2xl text-[17px] leading-relaxed text-ink">{item.b}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* The honest limits. This section is the reason the page is worth trusting. */}
        <section className="mt-14 border-t border-ink/30 pt-10">
          <h2 className={`${HEADING} text-4xl`}>Where a spreadsheet gives up</h2>
          <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-ink">
            Honestly, for the first few rounds it is fine. The sheet above will see you through a
            small competition without much trouble, and plenty of people never need anything else.
          </p>
          <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-ink">
            What gets heavy is everything around it. Chasing fifteen people for a pick on a Friday
            afternoon. Checking every row against the weekend&apos;s results on a Sunday night.
            Re-typing the standings and hoping nobody spots a mistake, because once they do they
            stop trusting the table. That is usually round five, and it is usually when an office
            competition quietly stops.
          </p>

          <div className={`${PANEL} mt-8 max-w-2xl p-5 sm:p-6`}>
            <p className="text-[17px] leading-relaxed text-ink">
              LMSLocal is the same competition with that part taken out: the matches arrive already
              in the round, picks come in on their own, the eliminations follow after full time, and
              a round update is written for you to paste into WhatsApp. The first twenty player
              places are free and there is no card to enter.
            </p>
            <div className="mt-6">
              <Link href="/competition/create" className={`${BTN_PRIMARY} inline-block px-8 py-4 text-2xl`}>
                Start one &mdash; free
              </Link>
              <p className={`${LABEL} mt-4 text-ink-fade`}>20 places free &middot; about five minutes</p>
            </div>
          </div>
        </section>

        <section className="mt-14 border-t border-ink/30 pt-10">
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

        <nav className="mt-12 border-t border-ink/30 pt-6">
          <p className={`${LABEL} text-ink-fade`}>Also worth reading</p>
          <ul className="mt-3 flex flex-wrap gap-x-7 gap-y-2">
            {[
              { href: '/help/how-to-play', label: 'The rules' },
              { href: '/last-man-standing-at-work', label: 'At work' },
              { href: '/last-man-standing-for-pubs', label: 'For pubs' },
              { href: '/help/is-it-gambling', label: 'Is it gambling?' }
            ].map((link) => (
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
