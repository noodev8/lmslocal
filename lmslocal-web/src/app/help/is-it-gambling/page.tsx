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

  DO NOT let a later edit turn the hedging into a promise. Saying a particular setup "is legal"
  needs a solicitor behind it, not a search result.
*/

/* The Q&A block. Data rather than markup so the page and its FAQPage schema cannot drift apart -
   the same reasoning as /help/faq, which this deliberately mirrors. */
const QUESTIONS = [
  {
    q: 'Is a Last Man Standing competition gambling?',
    a: [
      'It depends entirely on whether people pay to enter. Gambling law in Great Britain turns on three ingredients together: a payment to take part, a prize, and an outcome nobody taking part controls. Take away any one of them and what is left is not regulated gambling.',
      'A competition with no entry fee is not gambling, however big the prize is. That is the version most LMSLocal competitions run, and it is the version with nothing to think about.'
    ]
  },
  {
    q: 'Can I charge an entry fee?',
    a: [
      'People do, and there are lawful ways to do it, but this is where it stops being a simple question and starts depending on who you are, who is playing, and where the money ends up. The rest of this page is about that.',
      'If you want the prize without the question, put a free entry route alongside the paid one. The Gambling Commission is specific about what that takes: the free route must be no less convenient than the paid one, promoted just as prominently, and the competition must not be able to tell the two apart when it works out who won.'
    ]
  },
  {
    q: 'Is it not just a sweepstake? Those are allowed at work.',
    a: [
      'This is the most common misunderstanding, and it matters. The office sweepstake exemptions - work lotteries, private society lotteries - are exemptions for lotteries, and a lottery in law is one where the prize is allocated by a process relying wholly on chance. Names drawn out of a hat.',
      'In Last Man Standing your players choose their own team every round. That is judgement, not chance, so those exemptions are not the ones that apply. Picking a team to win a match is a bet on a future event, and betting is governed by different parts of the Act.'
    ]
  },
  {
    q: 'So what does apply to a paid competition?',
    a: [
      'The reliefs that matter for betting are about who is running it, not what it is called. The Gambling Act 2005 says a person does not commit an offence by making or accepting a bet if they act "otherwise than in the course of a business", and it treats betting as private where it is between people who live at the same premises, or between people employed by the same employer.',
      'A competition among colleagues at one workplace, where every penny of the entry money goes back out as prizes and nobody takes a cut, is the clearest case there is. The further you get from that, the more worth asking about it becomes.'
    ]
  },
  {
    q: 'Can a members club run one for its members?',
    a: [
      'A club running a competition for its own members, not for profit, with the money going back to the players or into club funds, sits at the comfortable end of this. But be careful with the reason people usually give for it: the tidy "members of a society" exemption is a lottery exemption, and it needs the result decided by chance, which Last Man Standing is not.',
      'There is no equally tidy members exemption for betting. What carries the weight is that nobody is doing it commercially and nobody is profiting - so keep it that way, write down where the money went, and if your club is large or the pot is significant, ask your local licensing authority rather than relying on this page.'
    ]
  },
  {
    q: 'Can a pub run one?',
    a: [
      'A pub is harder than a club, for one reason: a landlord is running a business, on business premises, and whether something happens "in the course of a business" is exactly the question the law asks.',
      'The fact most likely to put a competition on the wrong side of it is the venue keeping a slice of the entry money. Money that goes straight back out as prizes, or to a named charity, is a different picture from money that ends up in the till. If the real goal is bringing people in on a quiet Tuesday - and it usually is - a free-to-enter competition with a prize the pub puts up does that without raising the question at all.'
    ]
  },
  {
    q: 'Does LMSLocal handle the entry money?',
    a: [
      'No, and that is deliberate. We never take entry fees, never hold stakes and never pay prizes. We sell you the tool that runs the competition - fixtures, picks, eliminations - and what your players pay, if anything, is collected and paid out by you, in whatever way you choose.',
      'It means we are not part of anybody else’s gambling arrangements. It also means the way your competition is funded is your responsibility rather than ours, and we cannot be your route to being compliant.'
    ]
  }
];

/* Ordered from least to most likely to need advice. The ordering is the advice. */
const MONEY = [
  {
    label: 'Nothing to think about',
    title: 'No entry fee at all',
    body: 'Free to enter, with a prize the venue or a sponsor puts up. No payment means no gambling, whatever the prize is worth. It still fills a room on a quiet night, which is usually the point.'
  },
  {
    label: 'Straightforward',
    title: 'Entry fee, every penny back out as prizes',
    body: 'Players pay in, the winner takes the pot, the organiser keeps nothing. Nobody is profiting and nobody is trading.'
  },
  {
    label: 'Straightforward',
    title: 'Entry fee, proceeds to a charity or club funds',
    body: 'The same thing with the destination changed. Say up front which cause it is and announce the total afterwards - the players are the ones who raised it.'
  },
  {
    label: 'Ask first',
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
    acceptedAnswer: { '@type': 'Answer', text: item.a.join(' ') }
  }))
};

export default function IsItGamblingPage() {
  return (
    <div className="max-w-3xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <p className={`${EYEBROW} text-overprint`}>Entry fees and the law</p>
      <h1 className={`${HEADING} mt-4 text-5xl sm:text-6xl`}>Is it gambling?</h1>
      <p className="mt-6 max-w-xl text-xl leading-relaxed text-ink">
        Almost always, no &mdash; because almost always there is no entry fee. Once money changes
        hands it becomes a real question, and it is worth understanding rather than guessing at.
      </p>

      {/* The disclaimer goes above the content, not buried under it. */}
      <p className="mt-8 max-w-2xl border-l-2 border-overprint bg-stock-lit px-4 py-3 text-[16px] leading-relaxed text-ink">
        <strong className="font-semibold">We are not lawyers and this is not legal advice.</strong>{' '}
        It is a plain-English map of the landscape, written to help you put the right question to
        somebody who can answer it properly. Every claim here links to the official page it came
        from. If money is involved and you are unsure, check with your local licensing authority
        before you run it.
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
          first is entirely your choice as the organiser, and it is the choice that decides
          everything else on this page.
        </p>
      </section>

      {/* ------------------------------------------------------------- money routes */}
      <section className="mt-14 border-t border-ink/30 pt-10">
        <h2 className={`${HEADING} text-4xl`}>Where the money goes</h2>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink">
          If you read one section, read this one. Who ends up with the entry money matters more
          than what the competition is called or where it is played.
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
