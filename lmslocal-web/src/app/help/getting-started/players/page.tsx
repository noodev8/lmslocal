import Link from 'next/link';
import { LABEL, EYEBROW, HEADING, PANEL } from '@/lib/design';

export const metadata = {
  title: 'Getting Started for Players - LMSLocal Help',
  description:
    'How to join a Last Man Standing competition with an invite code, make and change your pick before the deadline, and follow how you are doing.',
  keywords: 'join last man standing, last man standing player, invite code, make picks, football predictions',
  alternates: { canonical: 'https://lmslocal.co.uk/help/getting-started/players' },
  openGraph: {
    title: 'Getting Started for Players',
    description: 'Join a Last Man Standing competition, make your first pick, and follow how you are doing.',
    type: 'article'
  }
};

const JOINING = [
  {
    title: 'Get the code',
    body: 'Whoever is running the competition has an invite code. If they sent you a link instead, the code is already in it — just follow the link and skip to the last step.'
  },
  {
    title: 'Enter it on the home page',
    body: 'There is a join box on the LMSLocal home page. Type the code in there.'
  },
  {
    title: 'Sign in, or sign up',
    body: 'An email address and a password. Nothing to install, and the same account works for every competition you join.'
  }
];

const RULES = [
  { term: 'One pick a round', def: 'Choose a single team you think will win their match.' },
  { term: 'It has to be a win', def: 'A draw counts against you exactly the same as a defeat.' },
  { term: 'Change it freely', def: 'Until the round locks you can switch teams, or clear your pick and come back.' },
  { term: 'No team twice', def: 'Until you have used them all, at which point they all come back.' },
  { term: 'Miss the deadline', def: 'Counts the same as a losing pick.' }
];

const SCENARIOS = [
  {
    q: 'You missed the deadline',
    a: 'It counts as a losing pick: you lose a life, or you are out if you had none left. Set yourself a reminder — the deadline is on your dashboard and again on the pick screen.'
  },
  {
    q: 'Your team’s match was postponed',
    a: 'There is no automatic void. The fixture stays unresulted and the round waits. What happens next is your organiser’s decision, so ask them.'
  },
  {
    q: 'You are down to your last life',
    a: 'Play it safe. This is the week to spend one of the strong teams you have been saving, not the week to be clever.'
  },
  {
    q: 'You are running out of teams',
    a: 'Everybody is. When you have used all of them they come back and you start again — but the rounds just before that are where competitions get decided, so look a few weeks ahead before you commit.'
  }
];

export default function PlayersGettingStartedPage() {
  return (
    <div className="max-w-3xl">
      <p className={`${EYEBROW} text-overprint`}>For players</p>
      <h1 className={`${HEADING} mt-4 text-5xl sm:text-6xl`}>Joining and playing</h1>
      <p className="mt-6 max-w-xl text-xl leading-relaxed text-ink">
        Someone has sent you a code. Two minutes from here to your first pick &mdash; it is free to
        play and there is nothing to install.
      </p>

      {/* ---------------------------------------------------------------- joining */}
      <section className="mt-12 border-t border-ink/30 pt-10">
        <h2 className={`${HEADING} text-4xl`}>Getting in</h2>

        <ol className="mt-7 divide-y divide-ink/30 border-y border-ink/30">
          {JOINING.map((step, i) => (
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

        <p className="mt-6 text-[17px] leading-relaxed text-ink">
          <Link href="/" className="underline decoration-dotted underline-offset-4 hover:text-overprint">
            Go to the join box
          </Link>{' '}
          if you have your code to hand.
        </p>

        <p className="mt-6 max-w-2xl border-l-2 border-ink/40 bg-stock-lit px-4 py-3 text-[16px] leading-relaxed text-ink">
          <strong className="font-semibold">Joining closes when round one locks.</strong> After that
          the competition is shut and you will have to wait for the next one, so do not sit on the
          code.
        </p>
      </section>

      {/* ------------------------------------------------------------------ rules */}
      <section className="mt-14 border-t border-ink/30 pt-10">
        <h2 className={`${HEADING} text-4xl`}>The rules, briefly</h2>

        <dl className="mt-7 divide-y divide-ink/30 border-y border-ink/30">
          {RULES.map((rule) => (
            <div key={rule.term} className="flex flex-col gap-1 py-4 sm:flex-row sm:gap-6">
              <dt className="font-display text-xl uppercase tracking-[0.02em] text-ink sm:w-56 sm:flex-none">
                {rule.term}
              </dt>
              <dd className="text-[17px] leading-relaxed text-ink">{rule.def}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-6 text-[17px] leading-relaxed text-ink">
          <Link href="/help/how-to-play" className="underline decoration-dotted underline-offset-4 hover:text-overprint">
            The full rules
          </Link>{' '}
          cover lives, regulation time and how a competition ends.
        </p>
      </section>

      {/* --------------------------------------------------------------- your pick */}
      <section className="mt-14 border-t border-ink/30 pt-10">
        <h2 className={`${HEADING} text-4xl`}>Making your pick</h2>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink">
          Press <strong className="font-semibold">Play</strong> on the competition and choose your
          team. The deadline is on the screen while you do it.
        </p>

        <div className="mt-7 grid gap-px border border-ink/30 bg-ink/30 sm:grid-cols-2">
          <div className="bg-stock-lit p-6">
            <p className={`${LABEL} text-ink-fade`}>Before the deadline</p>
            <p className="mt-3 text-[17px] leading-relaxed text-ink">
              Your pick is yours alone &mdash; nobody else can see it, not even players who have
              already picked. Change it as often as you like.
            </p>
          </div>
          <div className="bg-stock-lit p-6">
            <p className={`${LABEL} text-ink-fade`}>After it locks</p>
            <p className="mt-3 text-[17px] leading-relaxed text-ink">
              Everyone&apos;s picks appear on the standings, and yours is final. Then it is just the
              football.
            </p>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- following */}
      <section className="mt-14 border-t border-ink/30 pt-10">
        <h2 className={`${HEADING} text-4xl`}>Following how you are doing</h2>

        <div className="mt-7 grid gap-8 sm:grid-cols-2">
          <div>
            <p className={`${LABEL} text-ink-fade`}>Your dashboard</p>
            <ul className="mt-3 space-y-2">
              {['Which round it is', 'Whether you are still in', 'Lives remaining', 'How each of your rounds went'].map(
                (item) => (
                  <li key={item} className="flex gap-3 text-[17px] leading-relaxed text-ink">
                    <span aria-hidden="true" className="text-ink-fade">
                      &mdash;
                    </span>
                    <span>{item}</span>
                  </li>
                )
              )}
            </ul>
          </div>

          <div>
            <p className={`${LABEL} text-ink-fade`}>The standings</p>
            <ul className="mt-3 space-y-2">
              {[
                'Who is left and on how many lives',
                'What everyone picked, once the round locks',
                'Who went out and when'
              ].map((item) => (
                <li key={item} className="flex gap-3 text-[17px] leading-relaxed text-ink">
                  <span aria-hidden="true" className="text-ink-fade">
                    &mdash;
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- scenarios */}
      <section className="mt-14 border-t border-ink/30 pt-10">
        <h2 className={`${HEADING} text-4xl`}>When something goes wrong</h2>

        <dl className="mt-7 divide-y divide-ink/30 border-y border-ink/30">
          {SCENARIOS.map((item) => (
            <div key={item.q} className="py-5">
              <dt className="font-display text-2xl uppercase tracking-[0.02em] text-ink">{item.q}</dt>
              <dd className="mt-1.5 text-[17px] leading-relaxed text-ink">{item.a}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-6 max-w-2xl border-l-2 border-ink/40 bg-stock-lit px-4 py-3 text-[16px] leading-relaxed text-ink">
          <strong className="font-semibold">Ask your organiser first.</strong> They set the
          deadlines, enter or check the results and make the judgement calls, so most things are
          quicker to sort out with them than with us.
        </p>
      </section>

      {/* -------------------------------------------------------------------- next */}
      <section className={`${PANEL} mt-14 p-6 sm:p-7`}>
        <p className={`${EYEBROW} text-overprint`}>Next</p>
        <h2 className={`${HEADING} mt-3 text-3xl`}>Know the rules cold</h2>
        <p className="mt-3 max-w-lg text-[17px] leading-relaxed text-ink">
          Most players go out on something they did not know rather than on a bad guess. It is a
          short read.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link
            href="/help/how-to-play"
            className="rounded-sm bg-overprint px-6 py-3 font-display text-xl uppercase tracking-[0.06em] text-stock-lit transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            The full rules
          </Link>
          <Link
            href="/help/faq#playing"
            className={`${LABEL} text-ink underline decoration-dotted underline-offset-[6px] transition-colors hover:text-overprint`}
          >
            Player questions
          </Link>
        </div>
      </section>
    </div>
  );
}
