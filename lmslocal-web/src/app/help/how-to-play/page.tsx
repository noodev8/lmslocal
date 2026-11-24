import Link from 'next/link';
import { LABEL, EYEBROW, HEADING, PANEL, BTN_PRIMARY, BTN_DARK } from '@/lib/design';

/*
  THE RULES PAGE IS BUILT AROUND SEARCHES, NOT AROUND OUR SCREENS (rewritten 2026-11-24).

  Search Console, Aug–Nov 2026: this page had 4,306 impressions at position 9.3 and a 0.6% click
  rate - the biggest leak on the site. The searches behind it are rules questions: "last man
  standing rules" (232), "last man standing football rules" (353), "rules football" (110),
  "match rules", "game rules", "how does last man standing work", "what happens if everyone goes
  out". So the title and H1 carry "Last Man Standing football rules", and each question people
  type is an H2 in their own words, answered in the first sentence under it.

  The URL stays /help/how-to-play: it is the page that has the impressions, and a move would put
  them at risk for a small gain from a keyword in the path.

  "You" here is the player, as on the other help pages - not the organiser, as on the home page.
*/
export const metadata = {
  title: 'Last Man Standing Football Rules: How It Works | LMSLocal',
  description:
    'The rules of Last Man Standing football in plain English: pick one team to win each round, a draw counts as a loss, no team twice, lives, and what happens if everyone goes out. Free printable rules.',
  keywords:
    'last man standing rules, last man standing football rules, how does last man standing work, how to play last man standing, does a draw count in last man standing, last man standing rules pdf',
  alternates: { canonical: 'https://lmslocal.co.uk/help/how-to-play' },
  openGraph: {
    title: 'Last Man Standing football rules',
    description:
      'Pick one team to win each round. A draw counts as a loss, and you cannot use a team twice. The complete rules, with a printable sheet.',
    type: 'article'
  }
};

/* The rules in brief. Numbered on the page: it is the part people screenshot and paste. */
const RULES = [
  'Each round, pick one team to win their match.',
  'If they win, you go through to the next round.',
  'If they draw or lose, you are out — or you lose a life, if your competition has lives.',
  'Miss the deadline and it counts the same as a losing pick.',
  'You cannot pick the same team twice until you have used every team.',
  'The last player left wins.'
];

/*
  Each entry is a question as people search it, rendered as an H2 and handed to Google as FAQPage
  data from this one array, so the two can never drift apart. Kept in step with the same answers
  on /help/faq.
*/
const QUESTIONS: { id: string; q: string; a: string[] }[] = [
  {
    id: 'draw',
    q: 'Does a draw count as a win?',
    a: [
      'No. Your team has to win. A draw is treated exactly like a defeat: it costs you a life, or puts you out if you have none left.',
      'This catches out more people than any other rule, so it is worth remembering before you pick a team you fancy for a point.'
    ]
  },
  {
    id: 'extra-time',
    q: 'Do extra time and penalties count?',
    a: [
      'No. Results are settled on ninety minutes plus stoppage time. A cup tie your team wins in extra time or on penalties still counts as a draw — and a draw goes against you.'
    ]
  },
  {
    id: 'same-team',
    q: 'Can you pick the same team twice?',
    a: [
      'Not under the usual rule, which most competitions use. Once you have used a team, it drops off your list.',
      'When you have used every team, they all come back and you start the list again. That happens per player, so somebody who joined later still has their own teams to work through. The rounds just before your list resets are the tight ones.'
    ]
  },
  {
    id: 'deadline',
    q: 'When do picks lock?',
    a: [
      'At the round’s deadline, which is shown on your dashboard and again on the pick screen. When we supply the matches it is the first kick-off of the round; an organiser who puts the matches in sets their own. Either way, read it there rather than guessing.',
      'Until then you can change your pick as often as you like, or clear it and come back to it.'
    ]
  },
  {
    id: 'missed-pick',
    q: 'What happens if you forget to pick?',
    a: ['Missing the deadline counts the same as a losing pick. You lose a life, or you are out if you had none left.']
  },
  {
    id: 'postponed',
    q: 'What happens if a match is postponed?',
    a: [
      'It is your organiser’s call — there is no automatic "void". Some wait for the rearranged match, others count the pick as a win. Ask yours what they do before it comes up.'
    ]
  },
  {
    id: 'everyone-out',
    q: 'What happens if everyone goes out in the same round?',
    a: [
      'Nobody is left standing, so the players who went out together share it. What that means for the prize is the organiser’s call: usually the pot is split between them, or the competition is run again.'
    ]
  },
  {
    id: 'how-long',
    q: 'How long does a Last Man Standing competition last?',
    a: [
      'Until somebody wins, so it has no fixed length. A small competition can be over in five or six rounds. A big one, especially with lives, can run for much of a season.'
    ]
  }
];

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: QUESTIONS.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a.join(' ') }
  }))
};

/*
  Shown on the page and handed to Google as HowTo data, from one array, for the same reason the
  questions work that way.
*/
const STEPS = [
  {
    name: 'Join a competition',
    text: 'Get the invite code from whoever is running the competition, enter it on the LMSLocal home page, and you are in. Joining closes when the first round locks.'
  },
  {
    name: 'Pick one team to win',
    text: 'Each round, choose a single team you think will win their match. You can change your mind until the round locks. You cannot pick the same team twice until you have used them all.'
  },
  {
    name: 'Win and go through',
    text: 'If your team wins in ninety minutes you go through to the next round. A draw or a defeat costs you a life, or puts you out if you have none left. Keep going until you are the last player standing.'
  }
];

const howToSchema = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to play Last Man Standing football',
  description:
    'Last Man Standing is a football elimination competition. Pick one team to win each round: if they win you go through, if they lose or draw you are out.',
  totalTime: 'PT5M',
  step: STEPS.map((s, i) => ({
    '@type': 'HowToStep',
    position: i + 1,
    name: s.name,
    text: s.text
  }))
};

const LIVES = [
  { n: '0', name: 'Knockout', body: 'One wrong pick and you are out. Short, brutal competitions.' },
  { n: '1', name: 'One life', body: 'Your first wrong pick costs the life. The next one puts you out.' }
];

const STRATEGY = [
  {
    title: 'Managing your teams',
    points: [
      'Do not spend a Manchester City or an Arsenal on an easy early round',
      'Save the strongest sides for the weeks where nothing looks safe',
      'Look at the fixtures a few rounds ahead before committing to one now',
      'Watch which teams the rest of the field is burning through'
    ]
  },
  {
    title: 'Reading a match',
    points: [
      'Home advantage is real — check where the match is being played',
      'Recent form and injuries matter more than the league table',
      'Derbies are unpredictable, whatever the form says',
      'A team fighting relegation at home is not the free win it looks'
    ]
  }
];

const SECTION = 'mt-20 border-t border-ink/30 pt-12';

export default function HowToPlayPage() {
  return (
    <div className="max-w-3xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <p className={`${EYEBROW} text-overprint`}>Last Man Standing &middot; the rules</p>
      <h1 className={`${HEADING} mt-5 text-5xl sm:text-6xl`}>Last Man Standing football rules</h1>
      <p className="mt-7 max-w-xl text-xl leading-relaxed text-ink">
        Pick one team to win, each round. If they win, you go through. If they draw or lose, it
        costs you. You cannot use the same team twice, and the last player left wins.
      </p>

      {/*
        The printable sheet, high on the page. "Last man standing rules pdf" is a real search and a
        PDF is its own indexable document, which is why it also has a row in the sitemap.
        Built by scripts/make-rules-pdf.js; rerun that after editing scripts/rules-pdf/rules.html.
      */}
      <div className="mt-9 flex flex-wrap items-center gap-4">
        <a href="/last-man-standing-rules.pdf" download className={`${BTN_PRIMARY} inline-block px-6 py-3 text-xl`}>
          Print the rules
        </a>
        <Link href="/last-man-standing-template" className={`${BTN_DARK} inline-block px-6 py-3 text-xl`}>
          Free spreadsheet
        </Link>
      </div>
      <p className={`${LABEL} mt-4 text-ink-fade`}>
        One page, A4 &middot; blanks for your entry fee, prize and deadline &middot; free to copy
      </p>

      {/* On this page: a jump list, since the page is long and most visitors want one answer. */}
      <nav aria-label="On this page" className={`${PANEL} mt-12 p-6 sm:p-7`}>
        <p className={`${LABEL} text-ink-fade`}>On this page</p>
        <ul className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
          {[
            { id: 'what-is-it', label: 'What is Last Man Standing?' },
            { id: 'the-rules', label: 'The rules in brief' },
            ...QUESTIONS.map((item) => ({ id: item.id, label: item.q })),
            { id: 'lives', label: 'Lives' },
            { id: 'strategy', label: 'Strategy' }
          ].map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="text-[16px] text-ink underline decoration-ink/30 decoration-dotted underline-offset-4 transition-colors hover:text-overprint"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* ------------------------------------------------------------ what it is */}
      <section id="what-is-it" className={`${SECTION} scroll-mt-8`}>
        <h2 className={`${HEADING} text-4xl`}>What is Last Man Standing?</h2>
        <p className="mt-5 text-[17px] leading-relaxed text-ink">
          Last Man Standing is a football survival game played over several weeks. Everybody taking
          part picks one team each round to win their match. Anyone whose team wins goes through;
          anyone whose team draws or loses is knocked out. You cannot pick the same team twice, so
          the safe choices run out as the weeks go on, and the last player left wins.
        </p>
        <p className="mt-4 text-[17px] leading-relaxed text-ink">
          It is also called LMS, Last Man Standing football or a survivor competition. Workplaces,
          groups of friends, clubs and pubs run it through the season &mdash; usually on the
          Premier League, though any league with a fixture list works the same way.
        </p>
      </section>

      {/* ------------------------------------------------------------ in brief */}
      <section id="the-rules" className={`${SECTION} scroll-mt-8`}>
        <h2 className={`${HEADING} text-4xl`}>The rules in brief</h2>
        <ol className="mt-8 divide-y divide-ink/30 border-y border-ink/30">
          {RULES.map((rule, i) => (
            <li key={rule} className="flex items-baseline gap-5 py-5">
              <span className="w-6 flex-none font-data text-lg text-overprint">{i + 1}</span>
              <span className="text-[18px] leading-relaxed text-ink">{rule}</span>
            </li>
          ))}
        </ol>

        <div className="mt-10 grid gap-px border border-ink/30 bg-ink/30 sm:grid-cols-2">
          <div className="bg-stock-lit p-7">
            <p className={`${LABEL} text-overprint`}>You go through</p>
            <p className="mt-3 font-display text-3xl uppercase tracking-[0.02em] text-ink">Your team wins</p>
            <p className="mt-3 text-[17px] leading-relaxed text-ink">
              The only outcome that carries you into the next round.
            </p>
          </div>
          <div className="bg-stock-lit p-7">
            <p className={`${LABEL} text-ink-fade`}>It costs you</p>
            <ul className="mt-3 space-y-1.5">
              {['Your team loses', 'Your team draws', 'You miss the deadline'].map((item) => (
                <li key={item} className="font-display text-2xl uppercase tracking-[0.02em] text-ink">
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[17px] leading-relaxed text-ink">
              Each takes a life. With no lives left, it puts you out.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ the questions */}
      {QUESTIONS.map((item) => (
        <section key={item.id} id={item.id} className={`${SECTION} scroll-mt-8`}>
          <h2 className={`${HEADING} text-4xl`}>{item.q}</h2>
          {item.a.map((p) => (
            <p key={p} className="mt-5 text-[17px] leading-relaxed text-ink">
              {p}
            </p>
          ))}
        </section>
      ))}

      {/* ------------------------------------------------------------------ lives */}
      <section id="lives" className={`${SECTION} scroll-mt-8`}>
        <h2 className={`${HEADING} text-4xl`}>Lives</h2>
        <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink">
          Your organiser decides how many lives everyone starts with, before the competition begins.
          It cannot be changed once round one is under way.
        </p>
        <dl className="mt-8 divide-y divide-ink/30 border-y border-ink/30">
          {LIVES.map((l) => (
            <div key={l.n} className="flex items-baseline gap-6 py-6">
              <dt className="font-data text-4xl font-semibold text-ink">{l.n}</dt>
              <dd>
                <p className="font-display text-2xl uppercase tracking-[0.02em] text-ink">{l.name}</p>
                <p className="mt-1 text-[17px] leading-relaxed text-ink">{l.body}</p>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ------------------------------------------------------------------ steps */}
      <section className={SECTION}>
        <h2 className={`${HEADING} text-4xl`}>Playing a round</h2>
        <ol className="mt-8 divide-y divide-ink/30 border-y border-ink/30">
          {STEPS.map((step, i) => (
            <li key={step.name} className="flex gap-5 py-7">
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

      {/* --------------------------------------------------------------- strategy */}
      <section id="strategy" className={`${SECTION} scroll-mt-8`}>
        <h2 className={`${HEADING} text-4xl`}>Last Man Standing strategy</h2>
        <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink">
          None of this is a rule. It is just what tends to separate the players who last.
        </p>
        <div className="mt-8 grid gap-10 sm:grid-cols-2">
          {STRATEGY.map((group) => (
            <div key={group.title}>
              <p className={`${LABEL} text-ink-fade`}>{group.title}</p>
              <ul className="mt-4 space-y-2.5">
                {group.points.map((point) => (
                  <li key={point} className="flex gap-3 text-[17px] leading-relaxed text-ink">
                    <span aria-hidden="true" className="text-ink-fade">
                      &mdash;
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ other game */}
      <section className={SECTION}>
        <p className={`${EYEBROW} text-ink-fade`}>The other game &middot; coming soon</p>
        <h2 className={`${HEADING} mt-4 text-4xl`}>Rather not be knocked out?</h2>
        <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink">
          Matchday runs on the same matches, but you predict the winner of every match and the
          points go on a league table. Nobody goes out. It is in beta and opening to everyone soon.
        </p>
        <Link
          href="/help/matchday"
          className={`${LABEL} mt-6 inline-block text-ink underline decoration-dotted underline-offset-[6px] transition-colors hover:text-overprint`}
        >
          The Matchday rules &rarr;
        </Link>
      </section>

      {/* -------------------------------------------------------------------- next */}
      <section className={`${PANEL} mt-20 p-7 sm:p-8`}>
        <p className={`${EYEBROW} text-overprint`}>Next</p>
        <h2 className={`${HEADING} mt-3 text-3xl`}>Play or run one</h2>
        <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-ink">
          If somebody has sent you a code, you are two minutes from your first pick. If you want to
          run one yourself, the first twenty player places are free.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link href="/competition/create" className={`${BTN_PRIMARY} inline-block px-6 py-3 text-xl`}>
            Start one &mdash; free
          </Link>
          <Link
            href="/help/getting-started/players"
            className={`${LABEL} text-ink underline decoration-dotted underline-offset-[6px] transition-colors hover:text-overprint`}
          >
            Joining as a player
          </Link>
        </div>
      </section>
    </div>
  );
}
