'use client';

import Link from 'next/link';
import PublicHeader from '@/components/public/PublicHeader';
import PublicFooter from '@/components/public/PublicFooter';
import { LABEL, EYEBROW, TICK } from '@/lib/design';

/**
 * Pricing. Organisers print this page to take away, so the print styles are
 * deliberate — keep them working when editing.
 */

const PACKS = [
  { name: 'Free tier', note: 'Yours for good, no card needed', credits: '20 places', price: '£0', saving: null },
  { name: 'Starter pack', note: 'A few more places', credits: '+20 places', price: '£10', saving: null },
  { name: 'Popular pack', note: 'For regular competitions', credits: '+50 places', price: '£20', saving: 'Save 20%' },
  { name: 'Best value pack', note: 'For venues and busy organisers', credits: '+120 places', price: '£40', saving: 'Save 33%' }
];

const INCLUDED = [
  'No card to start',
  'No subscription fees',
  'Set up in about five minutes',
  'Promotional templates for WhatsApp and social',
  'Add players who have not got a smartphone',
  'Pay only when you grow'
];

export default function PricingPage() {
  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            margin: 1cm;
            size: A4 portrait;
          }
          .pricing-page {
            background: #ffffff !important;
          }
          .pricing-page * {
            box-shadow: none !important;
          }
        }
      `}</style>

      <div className="pricing-page flex min-h-screen flex-col bg-stock font-body text-ink">
        <div className="print:hidden">
          <PublicHeader current="pricing" />
        </div>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
          <p className={`${EYEBROW} text-overprint`}>What it costs</p>
          <h1 className="mt-4 font-display text-6xl font-semibold uppercase leading-[0.88] text-ink sm:text-7xl">
            Start free.
            <br />
            Pay when you grow.
          </h1>
          <p className="mt-6 max-w-xl text-xl leading-relaxed text-ink">
            Twenty player places are free and always yours. Beyond that, each extra player uses
            one place as they join.
          </p>

          {/* ---------------------------------------------------------- credits */}
          <section className="mt-14">
            <h2 className="font-display text-4xl font-semibold uppercase leading-[0.9] text-ink sm:text-5xl">
              Player places
            </h2>
            <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink">
              One place lets one more player join. Buy them when you need them; purchased places
              are good for twelve months from the date you buy them.
            </p>

            <div className="mt-7 overflow-x-auto">
              <table className="w-full min-w-[34rem] border-y border-ink/30 text-left">
                <thead>
                  <tr className="border-b border-ink/30">
                    <th className={`${LABEL} py-3 pr-4 text-ink-fade`}>Package</th>
                    <th className={`${LABEL} py-3 pr-4 text-ink-fade`}>Places</th>
                    <th className={`${LABEL} py-3 pr-4 text-ink-fade`}>Price</th>
                    <th className={`${LABEL} py-3 text-ink-fade`}>Saving</th>
                  </tr>
                </thead>
                <tbody>
                  {PACKS.map((pack) => (
                    <tr key={pack.name} className="border-b border-ink/30 last:border-b-0">
                      <td className="py-4 pr-4 align-top">
                        <span className="font-display text-2xl uppercase tracking-[0.03em] text-ink">
                          {pack.name}
                        </span>
                        <span className="mt-1 block text-[15px] text-ink-fade">{pack.note}</span>
                      </td>
                      <td className="py-4 pr-4 align-top font-data text-[15px] text-ink">{pack.credits}</td>
                      <td className="py-4 pr-4 align-top">
                        <span className="font-display text-3xl font-semibold text-ink">{pack.price}</span>
                      </td>
                      <td className="py-4 align-top">
                        {pack.saving && (
                          <span className={`${LABEL} bg-overprint px-2 py-1 text-stock-lit`}>{pack.saving}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-6 max-w-2xl border-l-2 border-ink/40 bg-stock-lit px-4 py-3 text-[16px] leading-relaxed text-ink">
              <strong className="font-semibold">How places work.</strong> Your free twenty are
              counted live: if a player leaves, that place opens up for someone else. Places you
              have bought work differently — one is used each time a player joins beyond the free
              twenty, and it is not returned when that player later leaves. The exception is
              removing someone before the competition has started, which gives the place back.
              Someone joining two of your competitions uses two places. Bought places last twelve
              months from purchase.
            </p>
          </section>

          {/* -------------------------------------------------- fixture service */}
          <section className="mt-16 border-t border-ink/30 pt-14">
            <h2 className="font-display text-4xl font-semibold uppercase leading-[0.9] text-ink sm:text-5xl">
              Fixtures and results
            </h2>
            <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink">
              You choose this when you create a competition, and you can change your mind at any
              time afterwards.
            </p>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <div className="border border-ink/30 bg-stock-lit p-5 sm:p-6">
                <h3 className="font-display text-2xl uppercase tracking-[0.03em] text-ink">
                  We run them
                </h3>
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className={`${LABEL} text-ink-fade`}>£10 a competition</span>
                  <span className={`${LABEL} bg-overprint px-2 py-1 text-stock-lit`}>Free right now</span>
                </p>
                <p className="mt-3 text-[17px] leading-relaxed text-ink">
                  Each round arrives already built from the real fixture list, and results and
                  eliminations follow after full time. Nothing for you to enter. Available on the
                  leagues we cover.
                </p>
              </div>

              <div className="border border-ink/30 bg-stock-lit p-5 sm:p-6">
                <h3 className="font-display text-2xl uppercase tracking-[0.03em] text-ink">
                  You run them
                </h3>
                <p className="mt-2">
                  <span className={`${LABEL} text-ink-fade`}>Always free</span>
                </p>
                <p className="mt-3 text-[17px] leading-relaxed text-ink">
                  Enter the fixtures and results yourself, round by round. Best if you want your own
                  rounds, your own teams, or simply like holding the reins.
                </p>
              </div>
            </div>
          </section>

          {/* ------------------------------------------------------- onboarding */}
          <section className="mt-16 border-t border-ink/30 pt-14">
            <h2 className="font-display text-4xl font-semibold uppercase leading-[0.9] text-ink sm:text-5xl">
              Getting set up
            </h2>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <div className="border border-ink/30 bg-stock-lit p-5 sm:p-6">
                <h3 className="font-display text-2xl uppercase tracking-[0.03em] text-ink">
                  Done for you
                </h3>
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className={`${LABEL} text-ink-fade`}>Normally £30</span>
                  <span className={`${LABEL} bg-overprint px-2 py-1 text-stock-lit`}>Free right now</span>
                </p>
                <ul className="mt-4 space-y-2.5">
                  {['We set the whole competition up', 'We manage it for you', 'Weekly check-ins and direct support'].map(
                    (item) => (
                      <li key={item} className="flex items-baseline gap-3">
                        <span aria-hidden="true" className={TICK}>
                          &#10003;
                        </span>
                        <span className="text-[17px] text-ink">{item}</span>
                      </li>
                    )
                  )}
                </ul>
                <Link
                  href="/onboarding"
                  className={`${LABEL} mt-6 inline-block rounded-sm border border-ink px-4 py-2.5 text-ink transition-colors hover:bg-ink hover:text-stock-lit print:hidden`}
                >
                  Apply for it
                </Link>
              </div>

              <div className="border border-ink/30 bg-stock-lit p-5 sm:p-6">
                <h3 className="font-display text-2xl uppercase tracking-[0.03em] text-ink">
                  Do it yourself
                </h3>
                <p className="mt-2">
                  <span className={`${LABEL} text-ink-fade`}>Free</span>
                </p>
                <p className="mt-3 text-[17px] leading-relaxed text-ink">
                  Rather crack on alone? The setup wizard takes about five minutes and asks you
                  nothing you do not already know.
                </p>
              </div>
            </div>
          </section>

          {/* ---------------------------------------------------------- included */}
          <section className="mt-16 border-t border-ink/30 pt-14">
            <h2 className={`${EYEBROW} text-ink-fade`}>Included on every plan</h2>
            <ul className="mt-5 grid gap-x-8 gap-y-3.5 sm:grid-cols-2">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-baseline gap-3">
                  <span aria-hidden="true" className={TICK}>
                    &#10003;
                  </span>
                  <span className="text-[17px] text-ink">{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <div className="mt-14 print:hidden">
            <Link
              href="/competition/create"
              className="inline-block rounded-sm bg-overprint px-8 py-4 font-display text-2xl uppercase tracking-[0.06em] text-stock-lit transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Start one — free
            </Link>
            <p className={`${LABEL} mt-4 text-ink-fade`}>20 places free · no card</p>
          </div>

          {/* Print-only footer, since the screen footer is hidden on paper */}
          <div className="mt-8 hidden border-t border-ink/30 pt-3 text-center font-data text-[12px] text-ink-fade print:block">
            <p>LMSLocal · www.lmslocal.co.uk · Operated by Noodev8 Ltd (company number 16222537)</p>
          </div>
        </main>

        <PublicFooter />
      </div>
    </>
  );
}
