'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { userApi, cacheUtils } from '@/lib/api';
import type { UserCredits, CreditBillingHistoryItem, PlaceUsage } from '@/lib/api';
import { LABEL, EYEBROW, PANEL, BTN_DARK } from '@/lib/design';

/**
 * Credits and billing. Built to docs/design-system.md — the header and loading
 * state deliberately mirror /dashboard, since that is the only way in.
 *
 * "Credits" is the noun throughout because the two entry points on the
 * dashboard say "Add credits" and "View credits" (design system §9: an action
 * keeps its name through the whole flow). A credit is a player place, which is
 * the word /pricing uses to a signed-out reader.
 */

export default function BillingPage() {
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [purchases, setPurchases] = useState<CreditBillingHistoryItem[]>([]);
  const [placeUsage, setPlaceUsage] = useState<PlaceUsage[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Credit pack configuration (matches backend config/credit-packs.js)
  const creditPacks = [
    {
      pack_type: 'starter_20',
      name: 'Starter pack',
      credits: 20,
      price: 10,
      description: 'Extra capacity as you grow',
      badge: null
    },
    {
      pack_type: 'popular_50',
      name: 'Popular pack',
      credits: 50,
      price: 20,
      description: 'For regular competitions',
      badge: 'Save 20%'
    },
    {
      pack_type: 'value_120',
      name: 'Best value pack',
      credits: 120,
      price: 40,
      description: 'For venues and busy organisers',
      badge: 'Save 33%'
    }
  ];

  // Fetch credit data and billing history on component mount
  useEffect(() => {
    const fetchBillingData = async () => {
      try {
        setLoading(true);

        // Fetch credit balance
        const creditsResponse = await userApi.getUserCredits();
        if (creditsResponse.data.return_code === 'SUCCESS' && creditsResponse.data.credits) {
          setCredits(creditsResponse.data.credits);
          setPlaceUsage(creditsResponse.data.place_usage || []);
        } else if (creditsResponse.data.return_code === 'GUEST_USER_NO_CREDITS') {
          setError('Guest players do not have their own credits. Ask your competition organiser about a place.');
          return;
        } else {
          setError('We could not load your credit balance. Refresh the page to try again.');
        }

        // Fetch billing history
        const historyResponse = await userApi.getBillingHistory();
        if (historyResponse.data.return_code === 'SUCCESS' && historyResponse.data.purchases) {
          setPurchases(historyResponse.data.purchases);
        }

      } catch (err) {
        console.error('Error fetching billing data:', err);
        setError('We could not load your billing information. Refresh the page to try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchBillingData();

    // Check for successful payment (Stripe redirect)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      // Invalidate cache to show updated credits
      cacheUtils.invalidateCredits();
      // Reload data after payment
      setTimeout(() => {
        window.location.href = '/billing'; // Remove query params and reload
      }, 100);
    }
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const handlePurchase = async (packType: string) => {
    try {
      // Create Stripe checkout session
      const response = await userApi.createCheckoutSession(packType);

      if (response.data.return_code === 'SUCCESS' && response.data.checkout_url) {
        // Redirect to Stripe checkout
        window.location.href = response.data.checkout_url;
      } else {
        alert(response.data.message || 'Failed to create checkout session');
      }
    } catch (err) {
      console.error('Error creating checkout session:', err);
      alert('Failed to start payment process. Please try again.');
    }
  };

  // Capacity. paid_credit is a LIVE BALANCE, not a purchase total: a credit is
  // deducted the moment a chargeable player joins beyond the free limit, and
  // handed back when one is removed (server routes join-competition-by-code,
  // add-offline-player, remove-player). So the players it has already paid for
  // must NOT be subtracted from it a second time — doing that understated an
  // organiser's headroom by exactly the number of paid players they had.
  const freeLimit = credits?.free_player_limit || 20; // Use dynamic limit from backend
  const slotsUsed = credits?.total_players || 0;
  const freeLeft = Math.max(0, freeLimit - slotsUsed);
  const boughtLeft = credits?.paid_credit || 0;
  const slotsAvailable = freeLeft + boughtLeft;
  const freeUsed = Math.min(slotsUsed, freeLimit);

  // Header is repeated across the three states rather than hoisted into a
  // layout, matching /dashboard — this page is the only thing under /billing.
  const header = (
    <header className="border-b border-ink/30">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="font-display text-2xl font-semibold uppercase tracking-[0.1em] text-ink sm:text-[1.75rem]"
        >
          LMSLocal
        </Link>
        <Link
          href="/dashboard"
          className={`${LABEL} text-ink-fade transition-colors hover:text-ink`}
        >
          Back to dashboard
        </Link>
      </div>
    </header>
  );

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-stock font-body text-ink">
        {header}
        <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className={`${PANEL} p-8 text-center`}>
            <div className="mb-4 inline-flex h-8 w-8 animate-spin items-center justify-center rounded-full border-2 border-ink border-t-transparent" />
            <p className={EYEBROW}>Loading credits</p>
            <p className="mt-2 text-[17px] text-ink-fade">Fetching your balance&hellip;</p>
          </div>
        </main>
      </div>
    );
  }

  // Error state. Per §2, errors are ink text with an overprint rule beside
  // them — overprint as a plain error colour reads as emphasis, not alarm.
  if (error || !credits) {
    return (
      <div className="min-h-screen bg-stock font-body text-ink">
        {header}
        <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h1 className="font-display text-5xl font-semibold uppercase leading-[0.9] text-ink sm:text-6xl">
            Credits
          </h1>
          <p className="mt-7 max-w-xl border-l-2 border-overprint bg-stock-lit px-4 py-3 text-[17px] leading-relaxed text-ink">
            {error || 'We could not load your billing information. Refresh the page to try again.'}
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stock font-body text-ink">
      {header}

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <p className={`${EYEBROW} text-overprint`}>Credits and billing</p>
        <h1 className="mt-4 font-display text-5xl font-semibold uppercase leading-[0.9] text-ink sm:text-6xl">
          Your balance
        </h1>

        {/* Balance as a §6 ledger: the figures add up, so they are set as a
            reckoning rather than a sentence, and the total is the big number
            instead of being stated twice.

            Both rows are what is LEFT, never what was spent, so the two add to
            the total by construction. The earlier ledger set a purchase figure
            against a headcount and could not stay honest, because the balance
            it called "Bought" had already had those players taken out of it.
            What has been used is stated underneath as a sentence instead. */}
        <section className="mt-8 border-y border-ink/30 py-8">
          <dl className="w-full max-w-sm font-data text-[15px]">
            <div className="flex items-baseline justify-between gap-6 py-1.5">
              <dt className="text-ink-fade">Free credits left</dt>
              <dd className="tabular-nums text-ink">{freeLeft}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-6 py-1.5">
              <dt className="text-ink-fade">Bought credits left</dt>
              <dd className="tabular-nums text-ink">+{boughtLeft}</dd>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-6 border-t border-ink/30 pt-3">
              <dt className={`${LABEL} text-ink-fade`}>
                {slotsAvailable === 1 ? 'Credit left' : 'Credits left'}
              </dt>
              <dd className="font-display text-5xl font-semibold leading-none text-overprint">
                {slotsAvailable}
              </dd>
            </div>
          </dl>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink">
            {slotsUsed} {slotsUsed === 1 ? 'player has' : 'players have'} joined your competitions
            {freeUsed > 0 && <> — {freeUsed} on your free {freeUsed === 1 ? 'credit' : 'credits'}</>}
            {slotsUsed > freeLimit && (
              <>
                , {slotsUsed - freeLimit} on credits you bought
              </>
            )}
            . You can add {slotsAvailable} more {slotsAvailable === 1 ? 'player' : 'players'}.
          </p>
        </section>

        {/* --------------------------------------------- where the credits are

            The totals above say how many credits are gone. This says which
            competitions are holding them, which is the part an organiser
            cannot work out for themselves — a credit is held by a player's
            entry for as long as that competition exists, so a competition
            that finished last month still holds its eight. Somebody blocked
            on a brand new competition with four people in it has, without
            this, nothing on screen that explains why.

            "Where your credits are", not "have gone": they are held, not
            spent, and the wording is the whole point.

            The deletion line is deliberately flat and sits here rather than
            in the join-blocked email — beside the buy button, at the moment
            of the decision, so nobody pays without knowing the door exists.
            It is not an offer, and it carries what deletion costs, because
            for most organisers it is a bad trade. */}
        {placeUsage.length > 0 && (
          <section className="mt-14">
            <h2 className="font-display text-4xl font-semibold uppercase leading-[0.9] text-ink sm:text-5xl">
              Where your credits are
            </h2>
            {/* Was "each player holds one credit", which stopped being true when a player could
                buy back in after being knocked out - they then hold two. Phrased around the
                place rather than the person, which covers both and needs no exception. */}
            <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink">
              A place is held for as long as its competition exists — including competitions that
              have finished. Every player holds one, and one more each time they buy back in after
              being knocked out.
            </p>

            <dl className="mt-8 w-full max-w-md font-data text-[15px]">
              {placeUsage.map((row) => (
                <div
                  key={row.competition_id}
                  className="flex items-baseline justify-between gap-6 border-b border-ink/30 py-2.5 last:border-b-0"
                >
                  <dt className="text-ink">
                    {row.name}
                    {row.status_label && (
                      <span className="ml-2 text-ink-fade">{row.status_label}</span>
                    )}

                    {/* Only where it applies. On the overwhelming majority of rows re_buys is 0,
                        and "8 players + 0 re-buys" is noise on a panel whose whole job is to
                        account for one number without adding to it. */}
                    {row.re_buys > 0 && (
                      <span className="mt-0.5 block text-[13px] text-ink-fade">
                        {row.members} player{row.members !== 1 ? 's' : ''} + {row.re_buys} re-buy
                        {row.re_buys !== 1 ? 's' : ''}
                      </span>
                    )}
                  </dt>
                  <dd className="tabular-nums text-ink">{row.places}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-ink-fade">
              Deleting a competition frees the free credits its players are holding. It also
              removes that competition&apos;s results for good, and does not refund credits you
              have bought.
            </p>
          </section>
        )}

        {/* ------------------------------------------------------------ packs */}
        <section className="mt-14">
          <h2 className="font-display text-4xl font-semibold uppercase leading-[0.9] text-ink sm:text-5xl">
            Buy more credits
          </h2>
          <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink">
            One credit lets one more player join. Bought credits are good for twelve months from
            the date you buy them.
          </p>

          <div className="mt-7 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-y border-ink/30 text-left">
              <thead>
                <tr className="border-b border-ink/30">
                  <th className={`${LABEL} py-3 pr-4 text-ink-fade`}>Package</th>
                  <th className={`${LABEL} py-3 pr-4 text-ink-fade`}>Credits</th>
                  <th className={`${LABEL} py-3 pr-4 text-ink-fade`}>Price</th>
                  <th className={`${LABEL} py-3 text-ink-fade`}>
                    <span className="sr-only">Buy</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Free tier, listed first to match /pricing so the two read as one table */}
                <tr className="border-b border-ink/30">
                  <td className="py-4 pr-4 align-top">
                    <span className="font-display text-2xl uppercase tracking-[0.03em] text-ink">
                      Free tier
                    </span>
                    <span className="mt-1 block text-[15px] text-ink-fade">
                      Yours for good, no card needed
                    </span>
                  </td>
                  <td className="py-4 pr-4 align-top font-data text-[15px] text-ink">
                    {freeLimit} credits
                  </td>
                  <td className="py-4 pr-4 align-top">
                    <span className="font-display text-3xl font-semibold text-ink">&pound;0</span>
                  </td>
                  <td className="py-4 align-top">
                    <span className={`${LABEL} text-ink-fade`}>Included</span>
                  </td>
                </tr>

                {creditPacks.map((pack) => (
                  <tr key={pack.pack_type} className="border-b border-ink/30 last:border-b-0">
                    <td className="py-4 pr-4 align-top">
                      <span className="font-display text-2xl uppercase tracking-[0.03em] text-ink">
                        {pack.name}
                      </span>
                      <span className="mt-1 block text-[15px] text-ink-fade">{pack.description}</span>
                    </td>
                    <td className="py-4 pr-4 align-top font-data text-[15px] text-ink">
                      +{pack.credits} credits
                    </td>
                    <td className="py-4 pr-4 align-top">
                      <span className="font-display text-3xl font-semibold text-ink">
                        &pound;{pack.price}
                      </span>
                      {pack.badge && (
                        <span className={`${LABEL} mt-2 block w-fit bg-overprint px-2 py-1 text-stock-lit`}>
                          {pack.badge}
                        </span>
                      )}
                    </td>
                    <td className="py-4 align-top">
                      {/* BTN_DARK, not BTN_PRIMARY: three overprint buttons in a
                          column would spend the second ink on a repeated action. */}
                      <button
                        onClick={() => handlePurchase(pack.pack_type)}
                        className={`${BTN_DARK} px-5 py-2 text-lg`}
                      >
                        Buy
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-6 max-w-2xl border-l-2 border-ink/40 bg-stock-lit px-4 py-3 text-[16px] leading-relaxed text-ink">
            <strong className="font-semibold">How credits work.</strong> Your free {freeLimit} are
            counted live: if a player leaves, that credit opens up for someone else. Credits you
            have bought work differently — one is used each time a player joins beyond the free
            {' '}{freeLimit}, and it is not returned when that player later leaves. The exception is
            removing someone before the competition has started, which gives the credit back.
            Someone joining two of your competitions uses two credits. Bought credits last twelve
            months from purchase, and once a competition is under way a purchase is not refunded.
          </p>
        </section>

        {/* ---------------------------------------------------------- history */}
        <section className="mt-14">
          <h2 className="font-display text-4xl font-semibold uppercase leading-[0.9] text-ink sm:text-5xl">
            Purchases
          </h2>

          {purchases.length === 0 ? (
            <div className={`${PANEL} mt-7 p-6`}>
              <p className="text-[17px] leading-relaxed text-ink">
                Nothing bought yet. Your free {freeLimit} credits cover your first
                {' '}{freeLimit} players, and anything you buy will be listed here.
              </p>
            </div>
          ) : (
            <div className="mt-7 overflow-x-auto">
              <table className="w-full min-w-[36rem] border-y border-ink/30 text-left">
                <thead>
                  <tr className="border-b border-ink/30">
                    <th className={`${LABEL} py-3 pr-4 text-ink-fade`}>Date</th>
                    <th className={`${LABEL} py-3 pr-4 text-ink-fade`}>Package</th>
                    <th className={`${LABEL} py-3 pr-4 text-ink-fade`}>Credits</th>
                    <th className={`${LABEL} py-3 pr-4 text-ink-fade`}>Paid</th>
                    <th className={`${LABEL} py-3 text-ink-fade`}>Promo code</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((purchase) => (
                    <tr key={purchase.id} className="border-b border-ink/30 last:border-b-0">
                      <td className="py-4 pr-4 align-top font-data text-[15px] text-ink">
                        {formatDate(purchase.purchased_at)}
                      </td>
                      <td className="py-4 pr-4 align-top text-[17px] text-ink">
                        {purchase.pack_name}
                      </td>
                      <td className="py-4 pr-4 align-top font-data text-[15px] text-ink">
                        +{purchase.credits_purchased}
                      </td>
                      <td className="py-4 pr-4 align-top">
                        <span className="font-data text-[15px] text-ink">
                          &pound;{purchase.paid_amount.toFixed(2)}
                        </span>
                        {purchase.promo_code && purchase.original_price && (
                          <span className="mt-1 block font-data text-[13px] text-ink-fade">
                            was &pound;{purchase.original_price.toFixed(2)}, saved &pound;
                            {purchase.discount_amount?.toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td className="py-4 align-top">
                        {purchase.promo_code ? (
                          <span className="font-data text-[15px] text-ink">{purchase.promo_code}</span>
                        ) : (
                          <span className="text-ink-fade">&mdash;</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
