'use client';

/*
=======================================================================================================================================
Admin Competitions List
=======================================================================================================================================
Purpose: Drill-down from the dashboard's "Competitions" cards - every competition on the
         platform with organiser, player count, and last activity, filterable by status.
=======================================================================================================================================
*/

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftIcon, ArrowPathIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { adminApi, getToken, AdminCompetition } from '@/lib/api';

type SortKey = 'name' | 'status' | 'player_count' | 'created_at' | 'last_activity';
type SortDirection = 'asc' | 'desc';

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'status', label: 'Status' },
  { key: 'player_count', label: 'Players' },
  { key: 'created_at', label: 'Created' },
  { key: 'last_activity', label: 'Last activity' },
];

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  setup: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  complete: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_BADGE[status] || STATUS_BADGE.complete;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {status}
    </span>
  );
}

function SortableHeader({
  col,
  sortKey,
  sortDirection,
  onSort,
}: {
  col: { key: SortKey; label: string };
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
}) {
  const active = sortKey === col.key;
  return (
    <th className="px-4 py-3 font-semibold">
      <button
        onClick={() => onSort(col.key)}
        className={`flex items-center gap-1 transition hover:text-slate-900 ${active ? 'text-slate-900' : ''}`}
      >
        {col.label}
        {active ? (
          sortDirection === 'asc' ? (
            <ChevronUpIcon className="h-3.5 w-3.5" />
          ) : (
            <ChevronDownIcon className="h-3.5 w-3.5" />
          )
        ) : (
          <ChevronDownIcon className="h-3.5 w-3.5 text-slate-300" />
        )}
      </button>
    </th>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const TILE_TONES = {
  default: 'from-indigo-500 to-cyan-400',
  good: 'from-emerald-500 to-teal-400',
  neutral: 'from-slate-500 to-slate-400',
} as const;

function StatusTile({
  label,
  value,
  tone = 'neutral',
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone?: keyof typeof TILE_TONES;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        active ? 'border-indigo-300 ring-1 ring-indigo-300' : 'border-slate-200'
      }`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${TILE_TONES[tone]}`} />
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums text-slate-900">
        {value.toLocaleString()}
      </p>
    </button>
  );
}

function CompetitionsList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusParam = searchParams.get('status') || '';

  const [competitions, setCompetitions] = useState<AdminCompetition[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('last_activity');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Always fetch the full list unfiltered - the status tabs and status breakdown stats both
  // filter client-side over the same dataset, so switching tabs needs no extra round trip.
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await adminApi.getCompetitions();
      if (result.return_code === 'SUCCESS' && result.competitions) {
        setCompetitions(result.competitions);
      } else if (result.return_code !== 'UNAUTHORIZED' && result.return_code !== 'TOKEN_EXPIRED') {
        setError(result.message || 'Could not load competitions');
      }
    } catch {
      setError('Could not reach the server. Is it running on port 3015?');
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

  const setStatus = (status: string) => {
    router.push(status ? `/dashboard/competitions?status=${status}` : '/dashboard/competitions');
  };

  const filtered = useMemo(() => {
    const matches = competitions.filter((c) =>
      (!statusParam || c.status === statusParam) &&
      (c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.organiser_email || '').toLowerCase().includes(search.toLowerCase()))
    );

    const sorted = [...matches].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [competitions, statusParam, search, sortKey, sortDirection]);

  // Status breakdown always reflects the full dataset, regardless of the active tab or search,
  // so the counts stay a stable reference point while filtering.
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { active: 0, setup: 0, complete: 0 };
    competitions.forEach((c) => {
      counts[c.status] = (counts[c.status] || 0) + 1;
    });
    return counts;
  }, [competitions]);

  return (
    <div className="min-h-screen">
      <header className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </button>
            <h1 className="font-semibold text-white">Competitions</h1>
          </div>
          <button
            onClick={() => load()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && competitions.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatusTile
              label="Total"
              value={competitions.length}
              active={statusParam === ''}
              onClick={() => setStatus('')}
            />
            <StatusTile
              label="Active"
              value={statusCounts.active}
              tone="good"
              active={statusParam === 'active'}
              onClick={() => setStatus('active')}
            />
            <StatusTile
              label="Setup"
              value={statusCounts.setup}
              tone="default"
              active={statusParam === 'setup'}
              onClick={() => setStatus('setup')}
            />
            <StatusTile
              label="Complete"
              value={statusCounts.complete}
              tone="neutral"
              active={statusParam === 'complete'}
              onClick={() => setStatus('complete')}
            />
          </div>
        )}

        <div className="mb-5 flex flex-wrap items-center justify-end gap-3">
          <input
            type="text"
            placeholder="Search name or organiser..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
          />
        </div>

        {loading && competitions.length === 0 && <p className="text-sm text-slate-500">Loading...</p>}

        {!loading && filtered.length === 0 && !error && (
          <p className="text-sm text-slate-500">No competitions found.</p>
        )}

        {filtered.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <SortableHeader col={COLUMNS[0]} sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
                  <SortableHeader col={COLUMNS[1]} sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
                  <th className="px-4 py-3 font-semibold">Organiser</th>
                  <SortableHeader col={COLUMNS[2]} sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
                  <SortableHeader col={COLUMNS[3]} sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
                  <SortableHeader col={COLUMNS[4]} sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 text-slate-600">{c.organiser_email || '—'}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{c.player_count}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(c.created_at)}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(c.last_activity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

export default function CompetitionsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <CompetitionsList />
    </Suspense>
  );
}
