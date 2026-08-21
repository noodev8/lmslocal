import Link from 'next/link';
import { LABEL, EYEBROW, HEADING, PANEL } from '@/lib/design';

export const metadata = {
  title: 'Getting Started for Organisers - LMSLocal Help',
  description:
    'How to set up and run a Last Man Standing competition for your pub, workplace or club: creating it, choosing who runs the fixtures, inviting players, and what happens each round.',
  keywords:
    'run last man standing, last man standing organiser, pub competition, workplace sweepstake, set up last man standing',
  alternates: { canonical: 'https://lmslocal.co.uk/help/getting-started/organizers' },
  openGraph: {
    title: 'Getting Started for Organisers',
    description: 'Set up a Last Man Standing competition for your pub, workplace or club in about five minutes.',
    type: 'article'
  }
};

const SETUP = [
  {
    title: 'Create your account',
    body: 'Email address and a password. Verify the email and you are in — there is no card to enter and nothing to install.'
  },
  {
    title: 'Create the competition',
    body: 'Give it a name your players will recognise — "The Red Lion LMS" rather than "Competition 1" — and decide the two rules that set hard: how many lives everyone starts with (none, or one), and whether a team can be picked twice. Neither can be changed once round one is under way, because changing the game underneath people already playing it is not fair on them.'
  },
  {
    title: 'Choose the team list',
    body: 'Which teams your players pick from. The Premier League list is the one to use for a normal competition; we add others as we cover them.'
  },
  {
    title: 'Invite your players',
    body: 'Your competition gets an invite code. Share the code, or the link that carries it — WhatsApp, a poster behind the bar, the group chat. Players enter the code on the LMSLocal home page. Joining stays open until round one locks.'
  }
];

const FIXTURES = [
  {
    title: 'Do it for me',
    body: 'We add each round’s fixtures and enter the results. You are offered a start date as you create the competition, and round one is sitting there from the moment it exists — so the players you are recruiting have something to look at rather than an empty screen. Where we have no dates to offer yet, you press Ready on the Round screen once the first set of fixtures is available.'
  },
  {
    title: 'I’ll do my own',
    body: 'You enter each round yourself from the Round screen: set the lock date and time for the round, add the matches, then enter the results once they have been played. More work, but total control over what counts and when. Nothing starts until you say so.'
  }
];

const ROUND_CYCLE = [
  {
    title: 'The round opens',
    body: 'Players see the matches and the deadline. They pick until it passes; you can see who has and who has not.'
  },
  {
    title: 'Results go in',
    body: 'By us or by you, depending on which you chose. While you are entering them, tapping a result again clears it.'
  },
  {
    title: 'You submit the round',
    body: 'This is what works out lives and eliminations. Check the results before you do — once submitted they are final, and putting a wrong one right means a conversation with us rather than an edit on screen.'
  },
  {
    title: 'The next round follows',
    body: 'We add it, or you do. It carries on like that until somebody is the last one standing.'
  }
];

const CONTROLS = [
  'Set or change a player’s pick before the round locks',
  'Adjust anyone’s lives, or put them back in after elimination',
  'Add players who have not got a smartphone, and remove anyone who drops out',
  'Reset the whole competition and run it again with the same players'
];

const PRACTICE = [
  {
    title: 'Say when the deadline is',
    body: 'The single most common complaint is a player who did not know picks had closed. Tell them the deadline in the same place you tell them everything else.'
  },
  {
    title: 'Be consistent, not lenient',
    body: 'You will get asked to make exceptions. Whichever way you go matters less than going the same way every time, and being seen to.'
  },
  {
    title: 'Say something each week',
    body: 'Who went out, who is left, who had a narrow escape. A competition nobody talks about quietly stops being fun long before it ends.'
  }
];

export default function OrganizersGettingStartedPage() {
  return (
    <div className="max-w-3xl">
      <p className={`${EYEBROW} text-overprint`}>For organisers</p>
      <h1 className={`${HEADING} mt-4 text-5xl sm:text-6xl`}>Setting up a competition</h1>
      <p className="mt-6 max-w-xl text-xl leading-relaxed text-ink">
        About five minutes from a standing start. Your first twenty player places are free and stay
        free, so you can have the whole thing running before you decide whether to spend anything.
      </p>

      {/* -------------------------------------------------------------- the setup */}
      <section className="mt-12 border-t border-ink/30 pt-10">
        <h2 className={`${HEADING} text-4xl`}>Getting it running</h2>

        <ol className="mt-7 divide-y divide-ink/30 border-y border-ink/30">
          {SETUP.map((step, i) => (
            <li key={step.title} className="flex gap-5 py-6">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 flex-none items-center justify-center bg-overprint font-display text-lg text-stock-lit"
              >
                {i + 1}
              </span>
              <div>
                <p className="font-display text-2xl uppercase tracking-[0.02em] text-ink">{step.title}</p>
                <p className="mt-2 text-[17px] leading-relaxed text-ink">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-6 max-w-2xl border-l-2 border-ink/40 bg-stock-lit px-4 py-3 text-[16px] leading-relaxed text-ink">
          <strong className="font-semibold">You do not have to fill it first.</strong> Players can
          keep joining right up until round one locks, so send the code out as soon as the
          competition exists and let it fill while you get on with something else.
        </p>
      </section>

      {/* ---------------------------------------------------------- who runs them */}
      <section className="mt-14 border-t border-ink/30 pt-10">
        <h2 className={`${HEADING} text-4xl`}>Fixtures and results</h2>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink">
          You choose who handles the matches when you create the competition. It is not a switch you
          can throw yourself afterwards &mdash; but if you change your mind, ask us and we will move
          the competition over.
        </p>

        <div className="mt-7 grid gap-px border border-ink/30 bg-ink/30 sm:grid-cols-2">
          {FIXTURES.map((option) => (
            <div key={option.title} className="bg-stock-lit p-6">
              <p className="font-display text-2xl uppercase tracking-[0.02em] text-ink">{option.title}</p>
              <p className="mt-3 text-[17px] leading-relaxed text-ink">{option.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ the round */}
      <section className="mt-14 border-t border-ink/30 pt-10">
        <h2 className={`${HEADING} text-4xl`}>What happens each round</h2>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink">
          All of it on the competition&apos;s Round screen, which shows you whatever the round needs
          next.
        </p>

        <dl className="mt-7 divide-y divide-ink/30 border-y border-ink/30">
          {ROUND_CYCLE.map((phase) => (
            <div key={phase.title} className="py-5">
              <dt className="font-display text-2xl uppercase tracking-[0.02em] text-ink">{phase.title}</dt>
              <dd className="mt-1.5 text-[17px] leading-relaxed text-ink">{phase.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* --------------------------------------------------------- what you control */}
      <section className="mt-14 border-t border-ink/30 pt-10">
        <h2 className={`${HEADING} text-4xl`}>What you can override</h2>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink">
          The platform runs the competition; it does not referee it. Where a call is a judgement
          rather than a fact, it is yours to make, and you have the tools to make it stick.
        </p>

        <ul className="mt-6 space-y-2.5">
          {CONTROLS.map((item) => (
            <li key={item} className="flex gap-3 text-[17px] leading-relaxed text-ink">
              <span aria-hidden="true" className="text-ink-fade">
                &mdash;
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------------------------------------------------------- practice */}
      <section className="mt-14 border-t border-ink/30 pt-10">
        <h2 className={`${HEADING} text-4xl`}>Running it well</h2>

        <dl className="mt-7 divide-y divide-ink/30 border-y border-ink/30">
          {PRACTICE.map((item) => (
            <div key={item.title} className="py-5">
              <dt className={`${LABEL} text-ink-fade`}>{item.title}</dt>
              <dd className="mt-2 text-[17px] leading-relaxed text-ink">{item.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* -------------------------------------------------------------------- next */}
      <section className={`${PANEL} mt-14 p-6 sm:p-7`}>
        <p className={`${EYEBROW} text-overprint`}>Next</p>
        <h2 className={`${HEADING} mt-3 text-3xl`}>Set yours up</h2>
        <p className="mt-3 max-w-lg text-[17px] leading-relaxed text-ink">
          Twenty player places free, no card, nothing to install. If a question comes up first, the
          FAQ has the short answers.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link
            href="/register"
            className="rounded-sm bg-overprint px-6 py-3 font-display text-xl uppercase tracking-[0.06em] text-stock-lit transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Create a competition
          </Link>
          <Link
            href="/help/faq#organising"
            className={`${LABEL} text-ink underline decoration-dotted underline-offset-[6px] transition-colors hover:text-overprint`}
          >
            Organiser questions
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
