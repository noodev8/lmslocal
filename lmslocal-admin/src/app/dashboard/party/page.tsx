'use client';

/*
=======================================================================================================================================
Admin Party
=======================================================================================================================================
Purpose: Matchday Party housekeeping: how many rooms exist, and a button to delete the expired ones
         (docs/matchday-party.md §7). The same prune runs nightly as scripts/prune-party-rooms.js;
         this is for running it by hand.

A placeholder page by request (2026-11-24): its position in the admin tool is to be settled later.
Only expired rooms are ever deleted, so the button is safe to press while a game is being played.
=======================================================================================================================================
*/

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon, TrashIcon } from '@heroicons/react/24/outline';
import AdminHeader from '@/components/AdminHeader';
import { adminApi, apiBaseUrl, getToken, PartyRoomCounts } from '@/lib/api';

export default function AdminPartyPage() {
  const router = useRouter();
  const [counts, setCounts] = useState<PartyRoomCounts | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const run = useCallback(async (dryRun: boolean) => {
    setBusy(true);
    try {
      const res = await adminApi.prunePartyRooms(dryRun);
      if (res.return_code === 'SUCCESS' && res.counts) {
        setCounts(res.counts);
        if (!dryRun) {
          setNotice({ tone: 'success', text: `Deleted ${res.deleted ?? 0} expired room${res.deleted === 1 ? '' : 's'}.` });
        }
      } else {
        setNotice({ tone: 'error', text: res.message || res.return_code });
      }
    } catch {
      setNotice({ tone: 'error', text: `Could not reach ${apiBaseUrl}.` });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    run(true);
  }, [router, run]);

  const tiles: { label: string; value: number | undefined; hint: string }[] = [
    { label: 'Live rooms', value: counts?.live, hint: 'Not yet expired' },
    { label: 'In play', value: counts?.in_play, hint: 'Live and not finished' },
    { label: 'Expired', value: counts?.expired, hint: 'Waiting to be pruned' },
  ];

  return (
    <div className="min-h-screen">
      <AdminHeader title="Matchday Party" backHref="/dashboard/competitions">
        <button
          onClick={() => run(true)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white transition hover:bg-white/10 disabled:opacity-50"
        >
          <ArrowPathIcon className="h-4 w-4" />
          Refresh
        </button>
      </AdminHeader>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {notice && (
          <div
            className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
              notice.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {notice.text}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-slate-500">{t.label}</p>
              <p className="mt-1.5 text-2xl font-semibold tabular-nums text-slate-900">{t.value ?? '—'}</p>
              <p className="mt-0.5 text-xs text-slate-400">{t.hint}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Prune expired rooms</h2>
          <p className="mt-1 text-sm text-slate-500">
            Deletes every room more than 24 hours old, with its players, rounds and predictions. Live
            rooms are never touched. This also runs nightly.
          </p>
          <button
            onClick={() => run(false)}
            disabled={busy || !counts || counts.expired === 0}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <TrashIcon className="h-4 w-4" />
            {counts && counts.expired > 0 ? `Prune ${counts.expired} expired room${counts.expired === 1 ? '' : 's'}` : 'Nothing to prune'}
          </button>
        </div>
      </main>
    </div>
  );
}
