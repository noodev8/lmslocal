'use client';

/*
=======================================================================================================================================
Admin Organisers List
=======================================================================================================================================
Purpose: The people behind the competitions - who they are, how to reach them, and enough
         context to decide who is worth an email. Built for one-to-one outreach: every row
         gives a name, an address, and a mail button that opens a message to that person.

Competitions are the other way into the same data. This screen answers "who is running things
and how are they doing", the competitions screen answers "what is running and does it need
attention". Row actions cross between them.
=======================================================================================================================================
*/

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowPathIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ClipboardIcon,
  CheckIcon,
  EnvelopeIcon,
  TrophyIcon,
  CheckBadgeIcon,
} from '@heroicons/react/24/outline';
import AdminHeader from '@/components/AdminHeader';
import { adminApi, getToken, AdminOrganiser, apiBaseUrl } from '@/lib/api';

type SortKey =
  | 'name'
  | 'competitions_total'
  | 'players_total'
  | 'lifetime_spend'
  | 'signed_up_at'
  | 'last_player_activity';
type SortDirection = 'asc' | 'desc';

// 'all' is everyone; the rest narrow to a group worth contacting for a different reason.
type Filter = 'all' | 'paying' | 'running' | 'new' | 'dormant';

const NEW_WITHIN_DAYS = 30;
// An organiser whose competitions have seen no pick this long is worth a nudge, not a sale.
const DORMANT_AFTER_DAYS = 30;

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'name', label: 'Organiser' },
  { key: 'competitions_total', label: 'Competitions', numeric: true },
  { key: 'players_total', label: 'Players', numeric: true },
  { key: 'lifetime_spend', label: 'Spend', numeric: true },
  { key: 'signed_up_at', label: 'Signed up' },
  { key: 'last_player_activity', label: 'Last activity' },
];

const formatMoney = (amount: number) =>
  `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const formatDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const daysSince = (iso: string | null): number | null =>
  iso === null ? null : Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

// "3 days ago" reads faster than a date when the question is "has this gone quiet".
const formatAge = (iso: string | null): string => {
  const days = daysSince(iso);
  if (days === null) return 'Never';
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months < 12 ? `${months} month${months === 1 ? '' : 's'} ago` : formatDate(iso);
};

function SortableHeader({
  col,
  sortKey,
  sortDirection,
  onSort,
}: {
  col: (typeof COLUMNS)[number];
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

const TILE_TONES = {
  default: 'from-indigo-500 to-cyan-400',
  good: 'from-emerald-500 to-teal-400',
  warn: 'from-amber-500 to-orange-400',
  neutral: 'from-slate-500 to-slate-400',
} as const;

function FilterTile({
  label,
  value,
  hint,
  tone = 'neutral',
  active,
  onClick,
}: {
  label: string;
  value: number;
  hint?: string;
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
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </button>
  );
}

// Copies to the clipboard and says so for a moment. Clipboard access can be refused (insecure
// context, denied permission), in which case selecting the text by hand still works - so there
// is nothing to recover from, just don't claim a copy happened.
function CopyButton({ text, title, className = '' }: { text: string; title: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          // Nothing to do - see comment above
        }
      }}
      title={copied ? 'Copied' : title}
      aria-label={title}
      className={className}
    >
      {copied ? <CheckIcon className="h-3.5 w-3.5 text-emerald-600" /> : <ClipboardIcon className="h-3.5 w-3.5" />}
    </button>
  );
}

/*
Competition counts as a single cell: the total, then the breakdown underneath but only where it
adds something. Most organisers have one competition in setup, and spelling that out on every
row would turn the column into noise that has to be read past to find the rows that differ.
*/
function CompetitionsCell({ organiser }: { organiser: AdminOrganiser }) {
  const parts: string[] = [];
  if (organiser.competitions_active) parts.push(`${organiser.competitions_active} active`);
  if (organiser.competitions_setup) parts.push(`${organiser.competitions_setup} setup`);
  if (organiser.competitions_complete) parts.push(`${organiser.competitions_complete} done`);

  return (
    <div>
      <Link
        href={`/dashboard/competitions?organiser=${organiser.id}`}
        className="font-medium tabular-nums text-slate-900 underline-offset-2 hover:text-indigo-600 hover:underline"
        title="Show this organiser's competitions"
      >
        {organiser.competitions_total}
      </Link>
      {organiser.competitions_total > 1 && parts.length > 0 && (
        <div className="text-xs text-slate-400">{parts.join(' · ')}</div>
      )}
    </div>
  );
}

function OrganisersList() {
  const router = useRouter();
  // ?q= arrives from the competitions screen, where clicking an organiser's name means "show me
  // this person". It seeds the search box rather than locking a filter, so it can be edited away.
  const searchParams = useSearchParams();

  const [organisers, setOrganisers] = useState<AdminOrganiser[]>([]);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('last_player_activity');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await adminApi.getOrganisers();
      if (result.return_code === 'SUCCESS' && result.organisers) {
        setOrganisers(result.organisers);
      } else if (result.return_code !== 'UNAUTHORIZED' && result.return_code !== 'TOKEN_EXPIRED') {
        setError(result.message || 'Could not load organisers');
      }
    } catch {
      setError(`Could not reach ${apiBaseUrl}. The server may be down, or this site's address may not be in the server's CORS allowlist (CLIENT_URL).`);
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

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Numbers and dates are almost always wanted biggest-first; names are not.
      setSortDirection(key === 'name' ? 'asc' : 'desc');
    }
  };

  const matchesFilter = useCallback((o: AdminOrganiser): boolean => {
    switch (filter) {
      case 'paying':
        return o.lifetime_spend > 0;
      case 'running':
        return o.competitions_active > 0;
      case 'new': {
        const age = daysSince(o.signed_up_at);
        return age !== null && age <= NEW_WITHIN_DAYS;
      }
      case 'dormant': {
        // Someone still running a competition that nobody has picked in for a month.
        if (o.competitions_active === 0) return false;
        const age = daysSince(o.last_player_activity);
        return age === null || age > DORMANT_AFTER_DAYS;
      }
      default:
        return true;
    }
  }, [filter]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    const matches = organisers.filter(
      (o) =>
        matchesFilter(o) &&
        ((o.name || '').toLowerCase().includes(term) || (o.email || '').toLowerCase().includes(term))
    );

    return [...matches].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      // Nulls (never active, no email) belong at the bottom whichever way the column is sorted.
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      const cmp =
        typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [organisers, search, matchesFilter, sortKey, sortDirection]);

  // Tile counts always reflect everyone, so they stay a stable reference point while filtering.
  const counts = useMemo(() => {
    const isNew = (o: AdminOrganiser) => {
      const age = daysSince(o.signed_up_at);
      return age !== null && age <= NEW_WITHIN_DAYS;
    };
    const isDormant = (o: AdminOrganiser) => {
      if (o.competitions_active === 0) return false;
      const age = daysSince(o.last_player_activity);
      return age === null || age > DORMANT_AFTER_DAYS;
    };
    return {
      total: organisers.length,
      paying: organisers.filter((o) => o.lifetime_spend > 0).length,
      running: organisers.filter((o) => o.competitions_active > 0).length,
      new: organisers.filter(isNew).length,
      dormant: organisers.filter(isDormant).length,
    };
  }, [organisers]);

  // Whatever is on screen right now, ready to paste into a mail client's Bcc field.
  const visibleEmails = useMemo(
    () => filtered.map((o) => o.email).filter((e): e is string => !!e).join(', '),
    [filtered]
  );

  return (
    <div className="min-h-screen">
      <AdminHeader title="Organisers" backHref="/dashboard">
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </AdminHeader>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && organisers.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
            <FilterTile
              label="Organisers"
              value={counts.total}
              active={filter === 'all'}
              onClick={() => setFilter('all')}
            />
            <FilterTile
              label="Paying"
              value={counts.paying}
              hint="have bought credit"
              tone="good"
              active={filter === 'paying'}
              onClick={() => setFilter('paying')}
            />
            <FilterTile
              label="Running"
              value={counts.running}
              hint="an active competition"
              tone="default"
              active={filter === 'running'}
              onClick={() => setFilter('running')}
            />
            <FilterTile
              label="New"
              value={counts.new}
              hint={`joined in ${NEW_WITHIN_DAYS} days`}
              tone="default"
              active={filter === 'new'}
              onClick={() => setFilter('new')}
            />
            <FilterTile
              label="Gone quiet"
              value={counts.dormant}
              hint={`running, no picks in ${DORMANT_AFTER_DAYS} days`}
              tone="warn"
              active={filter === 'dormant'}
              onClick={() => setFilter('dormant')}
            />
          </div>
        )}

        <div className="mb-5 flex flex-wrap items-center justify-end gap-3">
          {visibleEmails && (
            <CopyButtonWithLabel
              text={visibleEmails}
              count={filtered.filter((o) => o.email).length}
            />
          )}
          <input
            type="text"
            placeholder="Search name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
          />
        </div>

        {loading && organisers.length === 0 && <p className="text-sm text-slate-500">Loading...</p>}

        {!loading && filtered.length === 0 && !error && (
          <p className="text-sm text-slate-500">No organisers found.</p>
        )}

        {filtered.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  {COLUMNS.map((col) => (
                    <SortableHeader
                      key={col.key}
                      col={col}
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                    />
                  ))}
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((o) => (
                  <tr key={o.id} className="transition hover:bg-slate-50">
                    <td className="max-w-[20rem] px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-medium text-slate-900">{o.name || 'Unnamed'}</span>
                        {o.email_verified && (
                          <span className="shrink-0" title="Email verified">
                            <CheckBadgeIcon className="h-4 w-4 text-emerald-500" />
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="truncate text-xs text-slate-500" title={o.email || undefined}>
                          {o.email || 'No email on account'}
                        </span>
                        {o.email && (
                          <CopyButton
                            text={o.email}
                            title={`Copy ${o.email}`}
                            className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          />
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <CompetitionsCell organiser={o} />
                    </td>

                    {/*
                    The total matches the sum of this organiser's rows on the competitions
                    screen. The distinct count only appears when someone has played in more than
                    one of their competitions and the two numbers therefore disagree.
                    */}
                    <td className="px-4 py-3 text-slate-600">
                      <span className="tabular-nums">{o.players_total}</span>
                      {o.players_unique !== o.players_total && (
                        <div
                          className="text-xs text-slate-400"
                          title="Some people play in more than one of their competitions"
                        >
                          {o.players_unique} people
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {o.lifetime_spend > 0 ? (
                        <span
                          className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20"
                          title={`${o.credit} credit remaining`}
                        >
                          {formatMoney(o.lifetime_spend)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-500">{formatDate(o.signed_up_at)}</td>

                    <td className="px-4 py-3 text-slate-500">
                      <div title={`Last pick in any of their competitions: ${formatDate(o.last_player_activity)}`}>
                        {formatAge(o.last_player_activity)}
                      </div>
                      <div className="text-xs text-slate-400" title="When this organiser was last seen">
                        seen {formatAge(o.last_active_at).toLowerCase()}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {o.email && (
                          <a
                            href={`mailto:${o.email}`}
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600"
                            title={`Email ${o.name || o.email}`}
                          >
                            <EnvelopeIcon className="h-4 w-4" />
                          </a>
                        )}
                        <Link
                          href={`/dashboard/competitions?organiser=${o.id}`}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600"
                          title="Show their competitions"
                        >
                          <TrophyIcon className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
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

export default function OrganisersPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <OrganisersList />
    </Suspense>
  );
}

/*
Bulk copy of every address currently on screen. Deliberately a copy rather than a mailto: with
everyone in it - a long mailto is truncated by some mail clients and silently drops recipients,
and pasting into Bcc yourself is the safer habit for anything going to more than one person.
*/
function CopyButtonWithLabel({ text, count }: { text: string; count: number }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          // Clipboard refused - the addresses are all visible in the table anyway
        }
      }}
      className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
      title="Copy every address shown, ready to paste into Bcc"
    >
      {copied ? (
        <CheckIcon className="h-4 w-4 text-emerald-600" />
      ) : (
        <ClipboardIcon className="h-4 w-4" />
      )}
      {copied ? 'Copied' : `Copy ${count} email${count === 1 ? '' : 's'}`}
    </button>
  );
}
