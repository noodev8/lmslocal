'use client';

/*
=======================================================================================================================================
Admin Growth
=======================================================================================================================================
Purpose: The figures behind the platform rather than the ones on it - which organisers become
         winners, where signups leak, how much of what we hold is paid for, and revenue over the
         last year.

WINNERS LEAD (2026-10-24). A winner is an organiser whose biggest competition outgrew the free
allowance, and every one so far has paid. Small groups play free and bring players in; winners
are the business. The question this screen exists for is whether enough of them are arriving to
be worth carrying on, so the organiser funnel sits above everything else and is counted by the
month an organiser started - winners arrive with the season, and the empty months are the point.

WHY A SECOND SCREEN AT ALL, given the Overview was deleted for being one.

Overview did not die because a second screen is wrong. It died because its counts DUPLICATED the
Competitions screen and DISAGREED with it - 16 active against 14 - and the disagreement came from
a second implementation, in SQL, of the rule deciding which competitions were real. Two copies of
one question. (That rule is now a column, competition.archived_at, which is one of the reasons it
went - see services/competitionEngagement.js.)

So this screen is built to the rule that failure implies, and the rule is the point:

  1. Nothing here restates a headline from the Competitions screen. The funnel deliberately stops
     at "took part" and does NOT carry the live player count, which is that screen's own card.
  2. Where the two screens do touch - places - both read the SAME server service
     (services/placeUsage.js). One implementation, so they cannot drift even where a figure
     appears twice.
  3. Deliberately spare. A credit-ledger breakdown (bought vs consumed, a balance granted for
     testing) and an organiser-level paywall stat were both tried here and cut - the first was
     too much for one screen, the second could only ever read 100% (an organiser cannot sit past
     the free limit without paying, since that is exactly what the join gate blocks on) and so
     said nothing.

The screen is read-only and fetched once on entry. Nothing here changes while you look at it.
=======================================================================================================================================
*/

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import AdminHeader from '@/components/AdminHeader';
import { adminApi, getToken, AdminGrowth } from '@/lib/api';

/*
A step in the funnel. The bar is proportional to the TOP of the funnel, not to the step above it,
so the steps stay comparable to each other - a bar measured against its predecessor makes a small
drop late on look like the same size as a large drop early.
*/
function FunnelStep({
  label,
  value,
  of,
  hint,
  tone = 'default',
}: {
  label: string;
  value: number;
  of: number;
  hint: string;
  tone?: 'default' | 'warn';
}) {
  const pct = of > 0 ? Math.round((value / of) * 100) : 0;
  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-sm tabular-nums text-slate-500">
          <span className="text-base font-semibold text-slate-900">{value.toLocaleString()}</span>
          {' · '}
          {pct}%
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${tone === 'warn' ? 'bg-amber-400' : 'bg-indigo-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </div>
  );
}

// A single figure with its working underneath. Same restraint as the Competitions people row:
// lighter type, no gradient, and never a control.
function Figure({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-semibold tabular-nums text-slate-900">{value}</span>
        <span className="text-sm font-medium text-slate-600">{label}</span>
      </div>
      <p className="mt-0.5 text-xs text-slate-400">{hint}</p>
    </div>
  );
}

function Panel({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <p className="mt-1 text-xs text-slate-400">{note}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function GrowthPage() {
  const router = useRouter();
  const [growth, setGrowth] = useState<AdminGrowth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.getGrowth();
      if (
        response.return_code === 'SUCCESS' &&
        response.signups &&
        response.organisers &&
        response.places &&
        response.revenue_12mo !== undefined
      ) {
        setGrowth(response as AdminGrowth);
        setError(null);
      } else {
        setError(response.message || 'Could not load growth statistics');
      }
    } catch {
      setError('Could not reach the server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    load();
  }, [router, load]);

  const money = (pounds: number) =>
    pounds.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });

  // '2026-08' -> 'Aug 2026'. Built by hand: new Date('2026-08') parses as UTC midnight and can
  // land in July once a local offset is applied.
  const monthLabel = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}`;
  };

  return (
    <div className="min-h-screen">
      <AdminHeader title="Growth" backHref="/dashboard/competitions">
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </AdminHeader>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && !growth && <p className="text-sm text-slate-500">Loading...</p>}

        {growth && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <Panel
                title="Organisers"
                note={`Everyone who ever created a competition, deleted ones included. A winner ran one with more than ${growth.organisers.winner_above} real players. Size comes from competitions that still exist.`}
              >
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div>
                    {(
                      [
                        ['Created a competition', 'created', 'Ever pressed create, whatever happened next'],
                        ['Ran it', 'ran', 'Picks made, with at least two real players'],
                        [`Reached ${growth.organisers.growing_at}+ players`, 'growing', 'Nearest to becoming a winner — a second season or a bigger group'],
                        [`Winners — ${growth.organisers.winner_above + 1}+ players`, 'winners', 'Outgrew the free allowance'],
                        ['Paid', 'paid', 'Ever bought credits'],
                      ] as const
                    ).map(([label, key, hint]) => (
                      <FunnelStep
                        key={key}
                        label={label}
                        value={growth.organisers.funnel[key]}
                        of={growth.organisers.funnel.created}
                        hint={hint}
                      />
                    ))}
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Winners
                      </h3>
                      {growth.organisers.winners.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-500">None yet.</p>
                      ) : (
                        <table className="mt-2 w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-slate-400">
                              <th className="pb-1 font-medium">Organiser</th>
                              <th className="pb-1 text-right font-medium">Biggest</th>
                              <th className="pb-1 text-right font-medium">Paid</th>
                              <th className="pb-1 text-right font-medium">Started</th>
                              <th className="pb-1 text-right font-medium">Running now</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {growth.organisers.winners.map((w) => (
                              <tr key={w.organiser_id}>
                                <td className="py-1.5 text-slate-800">{w.display_name}</td>
                                <td className="py-1.5 text-right tabular-nums">{w.best_players}</td>
                                <td className="py-1.5 text-right tabular-nums">{money(w.paid)}</td>
                                <td className="py-1.5 text-right tabular-nums text-slate-500">{monthLabel(w.first_month)}</td>
                                <td className="py-1.5 text-right text-slate-500">{w.live ? 'Yes' : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/*
                      By the month an organiser started, so a row is a cohort: the August row
                      shows what August's newcomers have become since, and keeps changing as
                      they grow. Newest first - the question is always about the recent ones.
                    */}
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        By month started
                      </h3>
                      <table className="mt-2 w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-slate-400">
                            <th className="pb-1 font-medium">Month</th>
                            <th className="pb-1 text-right font-medium">Created</th>
                            <th className="pb-1 text-right font-medium">Ran</th>
                            <th className="pb-1 text-right font-medium">{growth.organisers.growing_at}+</th>
                            <th className="pb-1 text-right font-medium">Winners</th>
                            <th className="pb-1 text-right font-medium">Paid</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 tabular-nums">
                          {[...growth.organisers.by_month].reverse().map((m) => (
                            <tr key={m.month} className={m.created === 0 ? 'text-slate-300' : 'text-slate-700'}>
                              <td className="py-1.5">{monthLabel(m.month)}</td>
                              <td className="py-1.5 text-right">{m.created}</td>
                              <td className="py-1.5 text-right">{m.ran}</td>
                              <td className="py-1.5 text-right">{m.growing}</td>
                              <td className={`py-1.5 text-right ${m.winners > 0 ? 'font-semibold text-slate-900' : ''}`}>{m.winners}</td>
                              <td className="py-1.5 text-right">{m.paid}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </Panel>
            </div>

            {/*
              The funnel. It STOPS at "took part" by design - the live player count is the
              Competitions screen's card and repeating it here is exactly what killed Overview.
            */}
            <Panel
              title="Signups"
              note="Registered accounts only — a guest is created by joining, so counting one as a signup would make this move with competitions rather than people."
            >
              <FunnelStep
                label="Registered"
                value={growth.signups.registered}
                of={growth.signups.registered}
                hint={`${growth.signups.new_last_30_days.toLocaleString()} in the last 30 days, ${growth.signups.new_last_7_days.toLocaleString()} in the last 7`}
              />
              <FunnelStep
                label="Took part"
                value={growth.signups.took_part}
                of={growth.signups.registered}
                hint="Joined a competition or ran one — organising counts as taking part"
              />
              <FunnelStep
                label="Never joined anything"
                value={growth.signups.never}
                of={growth.signups.registered}
                tone="warn"
                hint={`${growth.signups.never_over_90_days.toLocaleString()} of them signed up over 90 days ago — those are gone, not in flight`}
              />
              {/*
                The two halves of "never" are the whole point of the row above. A signup from
                last week who has not joined anything is mid-flight and may still convert; one
                from four months ago has decided. Presenting them as one number invites the
                comfortable reading.
              */}
            </Panel>

            {/*
              Places AND revenue share a panel rather than each getting one - revenue is a single
              figure with nothing to unpack, and giving it a full panel of its own would spend as
              much space as the funnel on one number.
            */}
            <Panel
              title="Places & revenue"
              note={`Every competition still on the platform, archived included — finished ones are archived too, and they are where the paid places are. ${growth.places.limit} free per organiser, counted across everything they run.`}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Figure
                  label="paid places"
                  value={`${growth.places.total > 0 ? Math.round((growth.places.billable / growth.places.total) * 100) : 0}%`}
                  hint={`${growth.places.billable.toLocaleString()} of ${growth.places.total.toLocaleString()} held`}
                />
                <Figure
                  label="free places"
                  value={growth.places.free.toLocaleString()}
                  hint="covered by an allowance, earning nothing"
                />
                <Figure
                  label="revenue"
                  value={money(growth.revenue_12mo)}
                  hint="taken in the last 12 months"
                />
              </div>
            </Panel>
          </div>
        )}

        {growth && (
          <p className="mt-6 text-xs text-slate-400">
            Snapshot taken {new Date(growth.generated_at).toLocaleString('en-GB')}. Live
            competition and player counts live on the Competitions screen and are deliberately not
            repeated here.
          </p>
        )}
      </main>
    </div>
  );
}
