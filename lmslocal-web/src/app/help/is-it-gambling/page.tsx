import Link from 'next/link';
import { LABEL, EYEBROW, HEADING, PANEL } from '@/lib/design';

export const metadata = {
  title: 'Is a Last Man Standing Competition Gambling? UK Rules Explained - LMSLocal',
  description:
    'Plain-English guide to where a pub, club or workplace Last Man Standing competition sits under UK gambling law: entry fees, prize money, private and non-commercial betting, and the official Gambling Commission pages to check. Not legal advice.',
  keywords:
    'is last man standing gambling, last man standing legal uk, pub competition gambling licence, office sweepstake legal, entry fee prize competition law, gambling act 2005 private betting',
  alternates: { canonical: 'https://lmslocal.co.uk/help/is-it-gambling' },
  openGraph: {
    title: 'Is a Last Man Standing competition gambling?',
    description:
      'Where an entry fee, a prize pot and a pub, club or office competition sit under UK gambling law — in plain English, with the official pages to check.',
    type: 'article'
  }
};

/*
  The legal landscape page.

  WRITTEN TO A RULE, AGREED WITH ANDREAS 2026-08-24: explain the landscape, make it easier to
  understand, link to the real sources, and guarantee nothing. We are not lawyers and the page
  says so more than once, in the places somebody skim-reading would stop.

  Every factual claim below is traceable to one of the SOURCES at the foot of the page. The
  research behind it, so a future editor does not have to redo it:

    - A lottery under the Gambling Act 2005 needs the prize allocated by a process relying WHOLLY
      on chance. Last Man Standing players choose their own team, so the familiar office-sweepstake
      exemptions (work lottery, private society lottery) do not map onto it the way people assume.
      That misconception is the single most useful thing this page corrects.
    - Choosing a team to win a future match is betting. The relevant reliefs are therefore s.296
      (private betting, and acting otherwise than in the course of a business), Schedule 15
      (domestic betting and workers betting) and s.302 (non-commercial betting) - NOT Schedule 11.
    - So the question deciding most real cases is not "is it a club?" but "is anybody doing this
      in the course of a business, and who keeps the money?"

  ANSWER FIRST, THEN QUALIFY (2026-09-16). The page hedged so evenly that a reader could not tell
  what the answer was - every question got two balanced paragraphs and no verdict. Each question
  now opens with a one-line `verdict`, and the qualification follows it. The hedging was not
  removed, it was moved behind the answer.

  On charity: there is NO charity exemption in the betting sections - the tidy charity and society
  exemptions are lottery ones, and this is not a lottery. What a named cause actually does is
  settle the question the Act does ask, s.302's "in the course of a business", because an organiser
  who keeps nothing and hands the lot over is self-evidently not in business. So the page is firm
  that this is the strongest position available, and equally firm that it is the absence of profit
  doing the work rather than the word "charity". Do not shorten that to "charity means it is legal".

  DO NOT let a later edit turn the hedging into a promise. Saying a particular setup "is legal"
  needs a solicitor behind it, not a search result. Every section still ends by pointing at
  somebody who can answer properly.
*/

/* The Q&A block. Data rather than markup so the page and its FAQPage schema cannot drift apart -
   the same reasoning as /help/faq, which this deliberately mirrors. */
const QUESTIONS = [
  {
    q: 'Is a Last Man Standing competition gambling?',
    verdict: 'No, unless people pay to enter.',
    a: [
      'Gambling law in Great Britain turns on three ingredients together: a payment to take part, a prize, and an outcome nobody taking part controls. Take away any one of them and what is left is not regulated gambling.',
      'A competition with no entry fee is missing the first, so it is not gambling however big the prize is. That is how most LMSLocal competitions run, and there is nothing further to think about.'
    ]
  },
  {
    q: 'Can I charge an entry fee?',
    verdict: 'Yes. Nothing stops you charging one - it is where the money ends up that decides the rest.',
    a: [
      'People charge entry fees for these competitions all the time, and there are plainly lawful ways to do it. The question is never the fee on its own; it is whether anybody is making money out of other people betting.',
      'If you would rather not have the question at all, put a free entry route alongside the paid one. The Gambling Commission is specific about what that takes: the free route must be no less convenient than the paid one, promoted just as prominently, and the competition must not be able to tell the two apart when it works out who won.'
    ]
  },
  {
    q: 'Is it not just a sweepstake? Those are allowed at work.',
    verdict: 'No - and this is the misunderstanding that trips most people up.',
    a: [
      'The office sweepstake exemptions - work lotteries, private society lotteries - are exemptions for lotteries, and a lottery in law is one where the prize is allocated by a process relying wholly on chance. Names drawn out of a hat.',
      'Your players choose their own team every round. That is judgement, not chance, so it is not a lottery and those exemptions are not the ones that apply. Picking a team to win a match is a bet on a future event, and betting sits in different parts of the Act with different reliefs. The useful part: those reliefs fit an ordinary pub or workplace competition better than the lottery ones ever did.'
    ]
  },
  {
    q: 'So what does the law actually ask about a paid competition?',
    verdict: 'One question above all others: is anybody doing this in the course of a business?',
    a: [
      'That test is written into the Act. Section 302 makes betting non-commercial where no party enters into it in the course of a business or holds themselves out as being in the business of accepting bets, and section 296 puts private betting - between people living at the same premises, or employed by the same employer - outside the offence.',
      'So the facts that decide it are who is running it and who keeps the money, not what the competition is called or whether the venue happens to be a club. A competition among colleagues where every penny goes back out and nobody takes a cut is the clearest case there is.'
    ]
  },
  {
    q: 'What about a few mates, or everyone in the same house?',
    verdict: 'Two of these have a relief written into the Act by name. "Mates" on its own is not one of them.',
    a: [
      'Schedule 15 defines private betting as either domestic betting - "made on premises in which each party to the transaction lives" - or workers\u2019 betting, "between persons each of whom is employed under a contract of employment with the same employer". Section 296 then puts private betting outside the offence altogether. A houseshare running one between themselves, or colleagues at one employer, are the two cases the Act names.',
      'Friends scattered across a town do not fit either description, however small and friendly the group is, and neither does a club just by being a club - the relief there is the different one above: nobody acting in the course of a business. In practice a competition among friends where nobody takes a cut is exactly what that describes. But it is a judgement about the facts rather than a category you fall into automatically, so if yours is large, public, or run by somebody who stands to gain, read Schedule 15 and section 296 below and put it to your licensing authority.'
    ]
  },
  {
    q: 'What if every penny goes to charity or a good cause?',
    verdict: 'Then you are on the firmest ground a paid competition can be on.',
    a: [
      'An organiser who takes nothing, holds the money for a cause named in advance and hands over the lot is not accepting bets in the course of a business on any reading. That is the question the Act asks about betting, and a named cause answers it about as plainly as it can be answered. It is also how the competitions we see raising money are run - an under-12s football team, a local foodbank.',
      'Be clear about what is doing the work, though: it is the absence of profit, not the word "charity". There is no charity exemption in the betting sections - the tidy charity and society exemptions belong to lotteries, and this is not a lottery. So do the things that make the absence of profit obvious. Name the cause before you take a penny, keep the money apart from the till, hand over all of it, and publish the total. If the pot is unusually large, or the "cause" is really your own running costs, put it to your licensing authority first - it is one phone call.'
    ]
  },
  {
    q: 'Can a members club run one for its members?',
    verdict: 'Yes, in the ordinary case - members only, no profit, money accounted for.',
    a: [
      'A club running a competition for its own members, not for profit, with the money going back to the players or into club funds, sits comfortably inside the non-commercial betting relief - the "nobody is in the course of a business" one. Note that it is that relief and not the private betting one: a club is not a household and not an employer, so Schedule 15 does not cover it.',
      'Just do not lean on the reason people usually give for it. The tidy "members of a society" exemption is a lottery exemption and needs a result decided by chance, which this is not. What carries the weight is that nobody is trading and nobody is profiting - so keep it that way, write down where the money went, and if your club is large or the pot is significant, put it to your local licensing authority rather than to this page.'
    ]
  },
  {
    q: 'Can a pub run one?',
    verdict: 'Yes - provided none of the entry money stays in the till.',
    a: [
      'A pub takes more care than a club for one reason: a landlord is running a business on business premises, and "in the course of a business" is the exact phrase the law turns on. That does not put it out of reach, and pubs run these lawfully week in, week out.',
      'The one fact most likely to put a competition on the wrong side of the line is the venue keeping a slice. Money that goes straight back out as prizes, or to a named cause, is a different picture entirely from money that ends up behind the bar. And if the real aim is a busy Tuesday - it usually is - a free-to-enter competition with a prize the pub puts up gets there without raising the question at all.'
    ]
  },
  {
    q: 'Does LMSLocal handle the entry money?',
    verdict: 'No. We never touch it, by design.',
    a: [
      'We never take entry fees, never hold stakes and never pay prizes. We sell you the tool that runs the competition - fixtures, picks, eliminations - and whatever your players pay, if anything, is collected and paid out by you, in whatever way you choose.',
      'That keeps us out of anybody else’s gambling arrangements. It also means how your competition is funded is yours to get right rather than ours, and we cannot be your route to being compliant.'
    ]
  }
];

/* Ordered from least to most likely to need advice. The ordering is the advice, and the labels are
   verdicts rather than moods - somebody skimming only the left column should still come away
   knowing which row they are in and what it means. */
const MONEY = [
  {
    label: 'Not gambling at all',
    title: 'No entry fee',
    body: 'Free to enter, with a prize the venue or a sponsor puts up. No payment means no gambling, whatever the prize is worth. It still fills a room on a quiet night, which is usually the point.'
  },
  {
    label: 'Clear in practice',
    title: 'Entry fee, all of it back out as prizes',
    body: 'Players pay in, the winner takes the pot, the organiser keeps nothing. Nobody is trading and nobody is profiting, which is what the betting reliefs are built around.'
  },
  {
    label: 'Firmest ground of all',
    title: 'Entry fee, every penny to a named cause',
    body: 'The same thing with the destination changed: a charity, a junior team, the club fund. Name the cause before you take a penny, keep it apart from the till, hand over the lot and announce the total - the players are the ones who raised it.'
  },
  {
    label: 'Get advice first',
    title: 'The venue or organiser keeps a share',
    body: 'This is the one that changes the character of the whole thing, because it is the point at which somebody is making money out of other people betting. Get proper advice before running it this way.'
  }
];

const SOURCES = [
  {
    title: 'Free draws and prize competitions',
    who: 'Gambling Commission',
    href: 'https://www.gamblingcommission.gov.uk/public-and-players/guide/page/free-draws-and-prize-competitions',
    note: 'What keeps a prize competition outside gambling regulation, and exactly what a free entry route has to look like.'
  },
  {
    title: 'Types of lottery you can run without a licence',
    who: 'Gambling Commission',
    href: 'https://www.gamblingcommission.gov.uk/public-and-players/guide/page/types-of-lottery-you-can-run-without-a-licence',
    note: 'The exempt lotteries - work, private society, residents, customer - with their limits. Worth reading to see why they do not fit a competition where the players choose.'
  },
  {
    title: 'The status of lotteries under the Act',
    who: 'Gambling Commission',
    href: 'https://www.gamblingcommission.gov.uk/guidance/guidance-to-licensing-authorities/part-34-the-status-of-lotteries-under-the-act',
    note: 'The formal definition, including the "wholly on chance" test that decides whether you are looking at a lottery at all.'
  },
  {
    title: 'Gambling Act 2005, section 296',
    who: 'legislation.gov.uk',
    href: 'https://www.legislation.gov.uk/ukpga/2005/19/section/296',
    note: 'Private betting, and the line about acting otherwise than in the course of a business.'
  },
  {
    title: 'Gambling Act 2005, section 302',
    who: 'legislation.gov.uk',
    href: 'https://www.legislation.gov.uk/ukpga/2005/19/section/302',
    note: 'Two lines, and the most useful two on this page: betting is non-commercial where no party is acting in the course of a business or holding themselves out as accepting bets.'
  },
  {
    title: 'Gambling Act 2005, Schedule 15',
    who: 'legislation.gov.uk',
    href: 'https://www.legislation.gov.uk/ukpga/2005/19/schedule/15',
    note: 'What counts as private betting: domestic betting and workers betting, defined.'
  }
];

const INGREDIENTS = [
  { t: 'A payment to take part', b: 'An entry fee, a stake, a buy-in. Not the price of your pint.' },
  { t: 'A prize', b: 'Money, or something worth money.' },
  { t: 'An outcome you do not control', b: 'Whether Arsenal win on Saturday.' }
];

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: QUESTIONS.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: [item.verdict, ...item.a].join(' ') }
  }))
};

export default function IsItGamblingPage() {
  return (
    <div className="max-w-3xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <p className={`${EYEBROW} text-overprint`}>Entry fees and the law</p>
      <h1 className={`${HEADING} mt-4 text-5xl sm:text-6xl`}>Is it gambling?</h1>
      <p className="mt-6 max-w-xl text-xl leading-relaxed text-ink">
        Almost always, no. A competition nobody pays to enter is not gambling, whatever the prize
        is worth, and that is how most competitions on here run.
      </p>
      <p className="mt-4 max-w-xl text-xl leading-relaxed text-ink">
        Charge an entry fee and it becomes a real question &mdash; but a narrower one than people
        expect. It comes down to whether anybody is making money out of it. If every penny goes
        back out as prizes, or to a cause you have named, nobody is, and that is the strongest
        position there is.
      </p>

      {/* The disclaimer goes above the content, not buried under it. */}
      <p className="mt-8 max-w-2xl border-l-2 border-overprint bg-stock-lit px-4 py-3 text-[16px] leading-relaxed text-ink">
        <strong className="font-semibold">We are not lawyers and this is not legal advice.</strong>{' '}
        This page is written to be useful rather than evasive, so it says plainly where each
        common setup stands and what the law is actually asking. That is not the same as clearing
        your particular competition. Every claim links to the official page it came from, and if
        money is changing hands and anything here does not fit you exactly, put it to your local
        licensing authority before you run it &mdash; they answer this sort of question all the
        time, and it costs one phone call.
      </p>

      {/* ------------------------------------------------------------ three things */}
      <section className="mt-14 border-t border-ink/30 pt-10">
        <h2 className={`${HEADING} text-4xl`}>It takes three things</h2>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink">
          Regulated gambling in Great Britain needs all three of these at once. Remove any one and
          you are outside it.
        </p>

        <ol className="mt-7 divide-y divide-ink/30 border-y border-ink/30">
          {INGREDIENTS.map((item, i) => (
            <li key={item.t} className="flex gap-5 py-6">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 flex-none items-center justify-center bg-overprint font-display text-lg text-stock-lit"
              >
                {i + 1}
              </span>
              <div>
                <p className="font-display text-2xl uppercase tracking-[0.02em] text-ink">{item.t}</p>
                <p className="mt-2 text-[17px] leading-relaxed text-ink">{item.b}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-ink">
          A Last Man Standing competition always has the second and the third. Whether it has the
          first is entirely your choice as the organiser &mdash; which means you get to decide
          whether any of this applies to you at all.
        </p>
      </section>

      {/* ------------------------------------------------------------- money routes */}
      <section className="mt-14 border-t border-ink/30 pt-10">
        <h2 className={`${HEADING} text-4xl`}>Where the money goes</h2>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink">
          If you read one section, read this one. Who ends up with the entry money decides this,
          far more than what the competition is called or where it is played. The first three rows
          are the ones nearly everybody is in.
        </p>

        <dl className="mt-7 divide-y divide-ink/30 border-y border-ink/30">
          {MONEY.map((item) => (
            <div key={item.title} className="py-5">
              <dt>
                <span className={`${LABEL} text-overprint`}>{item.label}</span>
                <span className="mt-1.5 block font-display text-2xl uppercase tracking-[0.02em] text-ink">
                  {item.title}
                </span>
              </dt>
              <dd className="mt-2 text-[17px] leading-relaxed text-ink">{item.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ------------------------------------------------------------------ the Q&A */}
      <section className="mt-14 border-t border-ink/30 pt-10">
        <h2 className={`${HEADING} text-4xl`}>The questions people ask</h2>

        <dl className="mt-8 divide-y divide-ink/30 border-y border-ink/30">
          {QUESTIONS.map((item) => (
            <div key={item.q} className="py-7">
              <dt className="font-display text-2xl uppercase leading-tight tracking-[0.02em] text-ink">
                {item.q}
              </dt>
              <dd className="mt-3 space-y-3">
                <p className="text-[17px] font-semibold leading-relaxed text-overprint">
                  {item.verdict}
                </p>
                {item.a.map((para, i) => (
                  <p key={i} className="text-[17px] leading-relaxed text-ink">
                    {para}
                  </p>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ------------------------------------------------------------------ sources */}
      <section className="mt-14 border-t border-ink/30 pt-10">
        <h2 className={`${HEADING} text-4xl`}>Check it yourself</h2>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink">
          The actual sources, not summaries of summaries. They are short, and they are written for
          the public rather than for lawyers.
        </p>

        <ul className="mt-7 divide-y divide-ink/30 border-y border-ink/30">
          {SOURCES.map((source) => (
            <li key={source.href} className="py-5">
              <a
                href={source.href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-display text-xl uppercase tracking-[0.02em] text-ink underline decoration-dotted underline-offset-[6px] transition-colors hover:text-overprint"
              >
                {source.title}
              </a>
              <p className={`${LABEL} mt-1.5 text-ink-fade`}>{source.who}</p>
              <p className="mt-2 text-[17px] leading-relaxed text-ink">{source.note}</p>
            </li>
          ))}
        </ul>

        <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-ink">
          All of the above is the law in England, Scotland and Wales. Northern Ireland has its own
          gambling legislation and none of this transfers to it.
        </p>
      </section>

      {/* --------------------------------------------------------------------- next */}
      <section className={`${PANEL} mt-14 p-6 sm:p-7`}>
        <p className={`${EYEBROW} text-overprint`}>Next</p>
        <h2 className={`${HEADING} mt-3 text-3xl`}>Raising money with one</h2>
        <p className="mt-3 max-w-lg text-[17px] leading-relaxed text-ink">
          How clubs and pubs actually structure a competition that raises something &mdash; what a
          typical one brings in, and the three ways of setting it up.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link
            href="/help/fundraising"
            className="rounded-sm bg-overprint px-6 py-3 font-display text-xl uppercase tracking-[0.06em] text-stock-lit transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Fundraising guide
          </Link>
          <Link
            href="/help/getting-started/organizers"
            className={`${LABEL} text-ink underline decoration-dotted underline-offset-[6px] transition-colors hover:text-overprint`}
          >
            Setting one up
          </Link>
        </div>
      </section>
    </div>
  );
}
