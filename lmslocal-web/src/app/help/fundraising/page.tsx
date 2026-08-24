import Link from 'next/link';
import { LABEL, EYEBROW, HEADING, PANEL } from '@/lib/design';

export const metadata = {
  title: 'Football Fundraising Ideas: Run a Last Man Standing Competition - LMSLocal',
  description:
    'A Last Man Standing competition is one of the simplest ways for a club, pub or workplace to raise money: a small entry fee, a few weeks of interest, and no equipment. What it typically raises, three ways to structure it, and how to run it well.',
  keywords:
    'football fundraising ideas, club fundraiser football, pub fundraiser ideas, last man standing fundraiser, charity football competition, workplace fundraising football, sweepstake alternative',
  alternates: { canonical: 'https://lmslocal.co.uk/help/fundraising' },
  openGraph: {
    title: 'Football fundraising: running a Last Man Standing competition',
    description:
      'A small entry fee, a few weeks of interest, nothing to buy and nothing to set up on the night. What it raises and how to structure it.',
    type: 'article'
  }
};

/*
  Fundraising guide.

  Written because the site claimed fundraising in its own title tag and then said almost nothing
  about it: one line on the home page, two words in a keywords tag. Somebody searching "football
  fundraising idea for a club" had nothing here to land on.

  THE ARITHMETIC IS ARITHMETIC, NOT A FORECAST. The examples multiply a stated number of players
  by a stated entry fee and show the result. Never turn them into "you will raise" or an average
  drawn from our own data - we do not collect what organisers charge or take, because we are
  deliberately not in the money flow at all.

  Anything about entry fees links to /help/is-it-gambling rather than restating it. One page owns
  that subject, and it is the one carrying the disclaimers.
*/

const WHY = [
  {
    title: 'It runs for weeks, not an evening',
    body: 'A quiz raises what it raises on the night. A Last Man Standing competition keeps the same group of people talking about it every weekend until somebody wins, which is why the money and the goodwill both go further.'
  },
  {
    title: 'The buy-in is small',
    body: 'A fiver each is nothing to ask and adds up quickly across forty people. Nobody has to be talked into it, and nobody feels stung when they go out in round two.'
  },
  {
    title: 'There is nothing to buy',
    body: 'No printing, no equipment, no room to book, no volunteers on the night. The whole thing is a link you send to a group chat.'
  },
  {
    title: 'It brings people back',
    body: 'Players check in every week to make a pick. For a pub that is footfall on a quiet night; for a club it is members who otherwise only appear at the AGM.'
  }
];

const STRUCTURES = [
  {
    title: 'Entry fee, split pot',
    body: 'The classic. Everyone pays in, a share goes to the winner and the rest to the cause. A 50/50 split is the one people expect; some clubs go 25/75 in the cause’s favour and nobody minds, provided you say so at the start.',
    note: 'Say the split before anyone pays, not after somebody wins.'
  },
  {
    title: 'Entry fee, donated prize',
    body: 'Every penny of the entry money goes to the cause, and the prize is something a sponsor puts up: a meal for two, a shirt, a bar tab. Raises the most per player, and gives a local business a reason to be involved.',
    note: 'The best-value version if you can find the prize.'
  },
  {
    title: 'Free to enter, sponsored prize',
    body: 'No entry fee at all. The competition draws people in and the money comes from what they spend while they are there, or from a bucket nobody is obliged to put anything in.',
    note: 'The simplest to run and the one with no rules to think about.'
  }
];

/* Plain multiplication, shown as such. See the file header before editing these. */
const SUMS = [
  { players: 20, fee: 5, pot: 100 },
  { players: 40, fee: 5, pot: 200 },
  { players: 60, fee: 10, pot: 600 },
  { players: 100, fee: 10, pot: 1000 }
];

const RUNNING = [
  {
    title: 'Say where the money goes, first',
    body: 'Before anyone pays. The cause, the split, who is holding the money and when it gets handed over. People give more readily to something specific than to "club funds", and it heads off the only awkward conversation this ever produces.'
  },
  {
    title: 'Collect it however suits you',
    body: 'Cash behind the bar, a bank transfer, a JustGiving page — we are not involved in it, so use whatever your players already use. Tick people off as they pay and add them to the competition as you go.'
  },
  {
    title: 'Announce the total',
    body: 'At the end, tell everyone what was raised and hand it over publicly if you can. It is the part most organisers skip and the part that makes the next one twice as easy to fill.'
  },
  {
    title: 'Run it again',
    body: 'Reset the competition rather than starting a new one and your players keep their place without being invited again. Most fundraisers stall on recruitment; this is the one thing that removes it.'
  }
];

export default function FundraisingPage() {
  return (
    <div className="max-w-3xl">
      <p className={`${EYEBROW} text-overprint`}>For organisers</p>
      <h1 className={`${HEADING} mt-4 text-5xl sm:text-6xl`}>Raising money with a competition</h1>
      <p className="mt-6 max-w-xl text-xl leading-relaxed text-ink">
        A small entry fee, a few weeks of everyone paying attention, and nothing to buy or book. It
        is the least work of any fundraiser we know of, and it is the reason most people run one.
      </p>

      {/* ------------------------------------------------------------------- why */}
      <section className="mt-14 border-t border-ink/30 pt-10">
        <h2 className={`${HEADING} text-4xl`}>Why it works</h2>

        <dl className="mt-7 divide-y divide-ink/30 border-y border-ink/30">
          {WHY.map((item) => (
            <div key={item.title} className="py-5">
              <dt className="font-display text-2xl uppercase tracking-[0.02em] text-ink">{item.title}</dt>
              <dd className="mt-2 text-[17px] leading-relaxed text-ink">{item.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* --------------------------------------------------------------- the sums */}
      <section className="mt-14 border-t border-ink/30 pt-10">
        <h2 className={`${HEADING} text-4xl`}>What it comes to</h2>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink">
          Nothing clever here &mdash; players multiplied by entry fee. What reaches your cause
          depends on how you split it, which is the next section.
        </p>

        <div className="mt-7 overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-y border-ink/30">
                <th className={`${LABEL} py-3 pr-4 text-ink-fade`}>Players</th>
                <th className={`${LABEL} py-3 pr-4 text-ink-fade`}>Entry</th>
                <th className={`${LABEL} py-3 text-ink-fade`}>Pot</th>
              </tr>
            </thead>
            <tbody>
              {SUMS.map((row) => (
                <tr key={row.players} className="border-b border-ink/30">
                  <td className="py-3 pr-4 font-mono text-[17px] text-ink">{row.players}</td>
                  <td className="py-3 pr-4 font-mono text-[17px] text-ink">&pound;{row.fee}</td>
                  <td className="py-3 font-mono text-[17px] font-bold text-ink">&pound;{row.pot}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 max-w-2xl border-l-2 border-ink/40 bg-stock-lit px-4 py-3 text-[16px] leading-relaxed text-ink">
          Against that, what the tool costs you: the first twenty player places are free and stay
          free, and after that packs start at &pound;10 for twenty more. A sixty-player competition
          costs you &pound;20 to run, once.
        </p>
      </section>

      {/* ------------------------------------------------------------- structures */}
      <section className="mt-14 border-t border-ink/30 pt-10">
        <h2 className={`${HEADING} text-4xl`}>Three ways to set it up</h2>

        <div className="mt-7 space-y-px bg-ink/30">
          {STRUCTURES.map((item) => (
            <div key={item.title} className="bg-stock-lit p-6">
              <p className="font-display text-2xl uppercase tracking-[0.02em] text-ink">{item.title}</p>
              <p className="mt-3 text-[17px] leading-relaxed text-ink">{item.body}</p>
              <p className={`${LABEL} mt-3 text-overprint`}>{item.note}</p>
            </div>
          ))}
        </div>

        <p className="mt-7 max-w-2xl border-l-2 border-overprint bg-stock-lit px-4 py-3 text-[16px] leading-relaxed text-ink">
          <strong className="font-semibold">Charging an entry fee has rules attached.</strong> They
          are not onerous and most fundraisers sit well inside them, but they are worth ten minutes
          before you take anybody&rsquo;s money &mdash;{' '}
          <Link href="/help/is-it-gambling" className="underline decoration-dotted underline-offset-4 hover:text-overprint">
            where a competition sits under UK gambling law
          </Link>
          .
        </p>
      </section>

      {/* ---------------------------------------------------------------- running */}
      <section className="mt-14 border-t border-ink/30 pt-10">
        <h2 className={`${HEADING} text-4xl`}>Running it well</h2>

        <dl className="mt-7 divide-y divide-ink/30 border-y border-ink/30">
          {RUNNING.map((item) => (
            <div key={item.title} className="py-5">
              <dt className={`${LABEL} text-ink-fade`}>{item.title}</dt>
              <dd className="mt-2 text-[17px] leading-relaxed text-ink">{item.body}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-ink">
          We never take entry fees, hold stakes or pay prizes &mdash; deliberately. The money is
          between you and your players, and the only thing you ever pay us for is player places.
        </p>
      </section>

      {/* --------------------------------------------------------------------- next */}
      <section className={`${PANEL} mt-14 p-6 sm:p-7`}>
        <p className={`${EYEBROW} text-overprint`}>Next</p>
        <h2 className={`${HEADING} mt-3 text-3xl`}>Set one up</h2>
        <p className="mt-3 max-w-lg text-[17px] leading-relaxed text-ink">
          About five minutes, twenty free places, no card. You can have it running before you have
          decided what to charge.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link
            href="/register"
            className="rounded-sm bg-overprint px-6 py-3 font-display text-xl uppercase tracking-[0.06em] text-stock-lit transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Create a competition
          </Link>
          <Link
            href="/help/getting-started/organizers"
            className={`${LABEL} text-ink underline decoration-dotted underline-offset-[6px] transition-colors hover:text-overprint`}
          >
            How setting up works
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
