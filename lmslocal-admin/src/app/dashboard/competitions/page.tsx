'use client';

/*
=======================================================================================================================================
Admin Competitions List
=======================================================================================================================================
Purpose: Drill-down from the dashboard's "Competitions" cards - every competition on the
         platform with organiser, player count, and last activity, filterable by status and,
         via ?organiser=<id> from the Organisers screen, down to one person's competitions.
=======================================================================================================================================
*/

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowPathIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  TrashIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import AdminHeader from '@/components/AdminHeader';
import { adminApi, getToken, AdminCompetition, apiBaseUrl, getWebBaseUrl } from '@/lib/api';

type SortKey = 'name' | 'status' | 'player_count' | 'last_activity';
type SortDirection = 'asc' | 'desc';

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'status', label: 'Status' },
  { key: 'player_count', label: 'Players' },
  { key: 'last_activity', label: 'Last activity' },
];

// Local-only marker for "which competition did I last click View as organiser on" - not an
// audit trail, just a convenience so the row is easy to find again after tabbing back.
const LAST_VIEWED_KEY = 'admin_last_viewed_competition';

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  setup: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  complete: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

// Squash runs of whitespace to a single space and trim, mirroring how HTML renders text.
const collapseSpaces = (value: string) => value.replace(/\s+/g, ' ').trim();

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

const formatMoney = (amount: number) =>
  `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/*
Who runs this competition, with an address that can be copied in one click.

Deliberately thin. This used to also carry the organiser's competition count and lifetime spend,
which made every row three lines tall to answer a question about a person rather than about the
competition. That belongs on the Organisers screen, which is what the name links to. The paid
badge stays because "is this a customer" changes how you read every other cell on the row - and
it is lifetime spend across credit_purchases, never paid_credit, since credit can be granted
without a purchase behind it.
*/
function OrganiserCell({ competition }: { competition: AdminCompetition }) {
  const [copied, setCopied] = useState(false);
  const email = competition.organiser_email;
  const hasPaid = competition.organiser_lifetime_spend > 0;

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const copyEmail = async () => {
    if (!email) return;
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
    } catch {
      // Clipboard access can be refused (insecure context, denied permission). Selecting the
      // address by hand still works, so there is nothing to recover from - just don't claim
      // a copy happened.
    }
  };

  if (!email && !competition.organiser_name) {
    return <span className="text-slate-400">—</span>;
  }

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <Link
          href={`/dashboard/organisers?q=${encodeURIComponent(email || competition.organiser_name || '')}`}
          className="truncate font-medium text-slate-900 underline-offset-2 hover:text-indigo-600 hover:underline"
          title="Show this organiser"
        >
          {competition.organiser_name || 'Unnamed'}
        </Link>
        {hasPaid && (
          <span
            className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20"
            title={`Lifetime spend ${formatMoney(competition.organiser_lifetime_spend)} · ${competition.organiser_credit} credit remaining`}
          >
            {formatMoney(competition.organiser_lifetime_spend)}
          </span>
        )}
        {email && (
          <button
            onClick={copyEmail}
            title={copied ? 'Copied' : `Copy ${email}`}
            aria-label={`Copy email address for ${competition.organiser_name || email}`}
            className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            {copied ? (
              <CheckIcon className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <ClipboardIcon className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>

      <div className="truncate text-xs text-slate-500" title={email || undefined}>
        {email || 'No email on account'}
      </div>
    </div>
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

/*
Opt-in switch for the automated fixture service.

competition.fixture_service is what every push reads - fixtures and results only reach
competitions where it is true. Nothing could set it before this: create-competition hardcodes
false and no route ever changed it, so opting a competition in meant a hand-written UPDATE
against production.
*/
function FixtureServiceToggle({
  competition,
  busy,
  onToggle,
}: {
  competition: AdminCompetition;
  busy: boolean;
  onToggle: (competition: AdminCompetition, next: boolean) => void;
}) {
  const on = competition.fixture_service;
  // A finished competition would never be pushed to, so the switch would be a lie.
  const disabled = busy || (!on && competition.status === 'complete');

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onToggle(competition, !on)}
      title={
        competition.status === 'complete' && !on
          ? 'Competition has finished'
          : on
            ? `Receiving ${competition.team_list_name || 'staged'} fixtures - click to opt out`
            : `Click to opt into ${competition.team_list_name || 'staged'} fixtures`
      }
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${
        on ? 'bg-emerald-500' : 'bg-slate-300'
      }`}
    >
      <span
        className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? 'translateX(18px)' : 'translateX(3px)' }}
      />
    </button>
  );
}

function DeleteModal({
  competition,
  onCancel,
  onDeleted,
}: {
  competition: AdminCompetition;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  // Some stored names carry double or trailing spaces. HTML collapses those when the name is
  // rendered above, so an exact comparison would ask for a string the user cannot see or type.
  // Compare the way the browser displays it instead.
  const nameMatches = collapseSpaces(confirmText) === collapseSpaces(competition.name);

  const handleDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      const result = await adminApi.deleteCompetition(competition.id);
      if (result.return_code === 'SUCCESS') {
        onDeleted();
      } else {
        setError(result.message || 'Could not delete competition');
      }
    } catch {
      setError(`Could not reach ${apiBaseUrl}.`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Delete competition</h2>
        <p className="mt-1 text-sm text-slate-500">
          This permanently removes <strong>{competition.name}</strong> and everything attached to
          it - rounds, fixtures, picks, player progress, and membership records. This cannot be
          undone.
        </p>

        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {competition.player_count} player{competition.player_count === 1 ? '' : 's'} &middot;
          status: {competition.status}
        </div>

        <label htmlFor="confirm-name" className="mt-4 block text-sm font-medium text-slate-700">
          Type the competition name <strong>{competition.name}</strong> to confirm:
        </label>
        <input
          id="confirm-name"
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400"
          autoComplete="off"
        />

        {error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting || !nameMatches}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? 'Deleting...' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}

/*
Shown when switching a competition on hits ROUND_IN_PROGRESS. Not an error state - a deliberate
second step. Overriding here takes over an unfinished round on the admin side: manual result
entry switches off immediately, and finishing that round becomes the admin's job via the
fixtures/results push, not the organiser's.
*/
function RoundInProgressModal({
  target,
  onCancel,
  onOverride,
}: {
  target: {
    competition: AdminCompetition;
    round_number?: number;
    total_fixtures?: number;
    unresolved_fixtures?: number;
  };
  onCancel: () => void;
  onOverride: () => void;
}) {
  const { competition, round_number, total_fixtures, unresolved_fixtures } = target;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Round still in progress</h2>
        <p className="mt-1 text-sm text-slate-500">
          <strong>{competition.name}</strong>
          {round_number != null && <> - Round {round_number}</>} has{' '}
          {unresolved_fixtures != null && total_fixtures != null
            ? `${unresolved_fixtures} of ${total_fixtures}`
            : 'some'}{' '}
          fixtures still to be resulted.
        </p>

        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Switching on now disables manual result entry for this competition immediately. You
          will need to finish this round yourself, through the admin Fixtures/Results screen.
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onOverride}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700"
          >
            Switch on and take over this round
          </button>
        </div>
      </div>
    </div>
  );
}

function CompetitionsList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusParam = searchParams.get('status') || '';
  // Set when arriving from the Organisers screen - narrows the whole page to one person.
  const organiserParam = searchParams.get('organiser');
  const organiserId = organiserParam ? parseInt(organiserParam, 10) : null;

  const [competitions, setCompetitions] = useState<AdminCompetition[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('last_activity');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [deleteTarget, setDeleteTarget] = useState<AdminCompetition | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [lastViewed, setLastViewed] = useState<{ id: number; at: number } | null>(null);
  const [roundInProgressTarget, setRoundInProgressTarget] = useState<{
    competition: AdminCompetition;
    round_number?: number;
    total_fixtures?: number;
    unresolved_fixtures?: number;
  } | null>(null);

  // Remembers which competition "View as organiser" last opened, purely so the row is easy to
  // spot again when tabbing back - not an audit trail, just a local convenience marker.
  useEffect(() => {
    const raw = localStorage.getItem(LAST_VIEWED_KEY);
    if (raw) {
      try {
        setLastViewed(JSON.parse(raw));
      } catch {
        // Corrupt entry - ignore, treat as never viewed
      }
    }
  }, []);

  const handleImpersonate = async (competition: AdminCompetition) => {
    setImpersonatingId(competition.id);
    setError('');
    try {
      const result = await adminApi.impersonateOrganiser(competition.id);
      if (result.return_code === 'SUCCESS' && result.token && result.user) {
        const userParam = encodeURIComponent(JSON.stringify(result.user));
        const url = `${getWebBaseUrl()}/admin-bridge#token=${result.token}&user=${userParam}&competition_id=${competition.id}`;
        window.open(url, '_blank', 'noopener');

        const marker = { id: competition.id, at: Date.now() };
        localStorage.setItem(LAST_VIEWED_KEY, JSON.stringify(marker));
        setLastViewed(marker);
      } else {
        setError(result.message || 'Could not view as organiser');
      }
    } catch {
      setError(`Could not reach ${apiBaseUrl}.`);
    } finally {
      setImpersonatingId(null);
    }
  };

  const handleToggleFixtureService = async (
    competition: AdminCompetition,
    next: boolean,
    override?: boolean
  ) => {
    setTogglingId(competition.id);
    setError('');

    // Flip locally first so the switch responds immediately, and put it back if the server
    // disagrees - this is a row in a table, not a form, so there is nothing else to undo.
    setCompetitions((prev) =>
      prev.map((c) => (c.id === competition.id ? { ...c, fixture_service: next } : c))
    );

    try {
      const result = await adminApi.setFixtureService(competition.id, next, override);
      if (result.return_code === 'SUCCESS') {
        setRoundInProgressTarget(null);
      } else {
        setCompetitions((prev) =>
          prev.map((c) => (c.id === competition.id ? { ...c, fixture_service: !next } : c))
        );
        if (result.return_code === 'ROUND_IN_PROGRESS') {
          // Not an error - a deliberate second step. The admin sees exactly what they'd be
          // overriding and chooses, right there, whether to take the round over.
          setRoundInProgressTarget({
            competition,
            round_number: result.round_number,
            total_fixtures: result.total_fixtures,
            unresolved_fixtures: result.unresolved_fixtures,
          });
        } else if (result.return_code !== 'UNAUTHORIZED' && result.return_code !== 'TOKEN_EXPIRED') {
          setError(result.message || 'Could not change the fixture service setting');
        }
      }
    } catch {
      setCompetitions((prev) =>
        prev.map((c) => (c.id === competition.id ? { ...c, fixture_service: !next } : c))
      );
      setError(`Could not reach ${apiBaseUrl}.`);
    } finally {
      setTogglingId(null);
    }
  };

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

  // Status and organiser are independent filters, so changing one must not drop the other.
  const setStatus = (status: string) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (organiserParam) params.set('organiser', organiserParam);
    const qs = params.toString();
    router.push(qs ? `/dashboard/competitions?${qs}` : '/dashboard/competitions');
  };

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    const matches = competitions.filter((c) =>
      (!statusParam || c.status === statusParam) &&
      (organiserId === null || c.organiser_id === organiserId) &&
      (c.name.toLowerCase().includes(term) ||
        (c.organiser_email || '').toLowerCase().includes(term) ||
        (c.organiser_name || '').toLowerCase().includes(term))
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
  }, [competitions, statusParam, organiserId, search, sortKey, sortDirection]);

  // Name for the "showing one organiser" banner, taken from any of their rows.
  const organiserName = useMemo(() => {
    if (organiserId === null) return null;
    const match = competitions.find((c) => c.organiser_id === organiserId);
    return match ? match.organiser_name || match.organiser_email || `Organiser ${organiserId}` : null;
  }, [competitions, organiserId]);

  // Status breakdown ignores the active tab and the search box, so the counts stay a stable
  // reference point while filtering. It does respect the organiser filter - when the page is
  // scoped to one person, a platform-wide total next to their four rows would just confuse.
  const scoped = useMemo(
    () => (organiserId === null ? competitions : competitions.filter((c) => c.organiser_id === organiserId)),
    [competitions, organiserId]
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { active: 0, setup: 0, complete: 0 };
    scoped.forEach((c) => {
      counts[c.status] = (counts[c.status] || 0) + 1;
    });
    return counts;
  }, [scoped]);

  return (
    <div className="min-h-screen">
      <AdminHeader title="Competitions" backHref="/dashboard">
        <button
          onClick={() => {
            localStorage.removeItem(LAST_VIEWED_KEY);
            setLastViewed(null);
            load();
          }}
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

        {organiserId !== null && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
            <span>
              Showing competitions run by <strong>{organiserName || `organiser ${organiserId}`}</strong>
            </span>
            <Link
              href="/dashboard/competitions"
              className="rounded-lg border border-indigo-300 bg-white px-3 py-1 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100"
            >
              Show all competitions
            </Link>
          </div>
        )}

        {!loading && scoped.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatusTile
              label="Total"
              value={scoped.length}
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
            placeholder="Search competition or organiser..."
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
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <SortableHeader col={COLUMNS[0]} sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
                  <SortableHeader col={COLUMNS[1]} sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
                  <th className="px-4 py-3 font-semibold">Organiser</th>
                  <SortableHeader col={COLUMNS[2]} sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
                  <SortableHeader col={COLUMNS[3]} sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
                  <th className="px-4 py-3 font-semibold" title="Receives fixtures and results from the fixture service">
                    Auto
                  </th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className={`transition hover:bg-slate-50 ${
                      lastViewed?.id === c.id ? 'bg-indigo-50/50' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="max-w-[16rem] px-4 py-3"><OrganiserCell competition={c} /></td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{c.player_count}</td>
                    <td
                      className="px-4 py-3 text-slate-500"
                      title={`Created ${formatDate(c.created_at)}`}
                    >
                      {formatDate(c.last_activity)}
                    </td>
                    <td className="px-4 py-3">
                      <FixtureServiceToggle
                        competition={c}
                        busy={togglingId === c.id}
                        onToggle={handleToggleFixtureService}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleImpersonate(c)}
                          disabled={impersonatingId === c.id}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-50"
                          title="View as organiser"
                        >
                          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(c)}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          title="Delete competition"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {deleteTarget && (
        <DeleteModal
          competition={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null);
            load();
          }}
        />
      )}

      {roundInProgressTarget && (
        <RoundInProgressModal
          target={roundInProgressTarget}
          onCancel={() => setRoundInProgressTarget(null)}
          onOverride={() =>
            handleToggleFixtureService(roundInProgressTarget.competition, true, true)
          }
        />
      )}
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
