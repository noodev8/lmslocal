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
  | 'credits_available'
  | 'spend_12m'
  | 'last_active_at';
type SortDirection = 'asc' | 'desc';

// 'all' is everyone; the rest narrow to a group worth contacting for a different reason.
type Filter = 'all' | 'empty' | 'quiet' | 'paying';

/*
Andreas's own test accounts, hidden from this screen. They are real accounts doing real things -
just not customers - and on a list of fifteen organisers two of them being ours is noise on every
read.

By EMAIL rather than user id, because that is how they are recognised: `lmslocal8@gmail.com` even
carries the display name "Andreas". Note which one is NOT here - aandreou25@gmail.com stays,
because that account runs genuine competitions for real players and belongs in every count.

Expected to come back when they are being tested with. This is a display filter over one array,
so removing an address from the list is the whole of it.
*/
const HIDDEN_ORGANISER_EMAILS = ['brookfieldcomfort@gmail.com', 'lmslocal8@gmail.com'];

/*
THE TILES ARE WORKLISTS, NOT STATISTICS.

Every one of them has to answer "who should I contact, and why". Three were dropped when that
became the test:

  Running          organisers with an ACTIVE competition. competition.status only moves SETUP ->
                   ACTIVE as a side effect of somebody loading /get-user-dashboard after round 1
                   locks, so it sat at 0 for the whole pre-season with 14 competitions in SETUP.
                   "What is running" is the competitions screen's question anyway.
  Gone quiet (old) required competitions_active > 0, so it could only ever read 0 while Running
                   did. Two tiles wired to the same unreliable column. Replaced below with a
                   version that reads the organiser's own last session, which is always true.
  New              signed up in the last 30 days. Four of its six were already in "No players",
                   and "Last seen" carries recency in the table - a second near-copy of the same
                   people is not a second thing to do.

An organiser who has not opened the site in a month. Reads last_active_at rather than their
players' picks: a competition can tick along on autopilot while its organiser has gone, which is
exactly the person worth an email - two of the three this finds today are paying customers.
*/
const QUIET_AFTER_DAYS = 30;

const isQuiet = (o: AdminOrganiser): boolean => {
  const age = daysSince(o.last_active_at);
  return age === null || age > QUIET_AFTER_DAYS;
};

/*
Created a competition and recruited nobody. The most actionable group on the platform: they got
far enough to set something up and then stalled at the one step we can actually help with.

players_total already excludes bots and the organiser themselves, so 0 means what it says.
*/
const isEmpty = (o: AdminOrganiser): boolean => o.competitions_total > 0 && o.players_total === 0;

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'name', label: 'Organiser' },
  { key: 'competitions_total', label: 'Competitions', numeric: true },
  /* "Recruited", because that is now what it counts - bots and the organiser's own membership are
     both excluded, so a 0 means nobody has joined rather than "one, themselves". */
  { key: 'players_total', label: 'Recruited', numeric: true },
  /* Headroom, not consumption: free places left plus credit bought. "Billable" (how far PAST the
     free allowance they were) answered the billing question and told you nothing about whether
     somebody could start a competition tomorrow, which is what this screen is read for. */
  { key: 'credits_available', label: 'Credits', numeric: true },
  { key: 'spend_12m', label: 'Spend 12m', numeric: true },
  /* Signed up removed: a join date is a fact about the past that never changes and never prompts
     an action. "Last seen" is the column that answers what it was being read for. */
  { key: 'last_active_at', label: 'Last seen' },
];

const formatMoney = (amount: number) =>
  `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const formatDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/*
CALENDAR days, not elapsed 24-hour blocks, because "Today" and "Yesterday" are calendar words and
were being answered with arithmetic.

Dividing the elapsed milliseconds by 86,400,000 made a pick at 21:37 last night read as "Today"
at 09:41 this morning - twelve hours, so zero blocks - while the same organiser's login three days
earlier correctly read "3 days ago". Two lines of the same cell disagreeing about what day it is
looks like the data is wrong when only the arithmetic was.

Rounding rather than flooring the day difference: a clock change makes a local day 23 or 25 hours,
and both must still count as one day.
*/
const startOfDay = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

const daysSince = (iso: string | null): number | null =>
  iso === null ? null : Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / 86_400_000);

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
  const [sortKey, setSortKey] = useState<SortKey>('last_active_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await adminApi.getOrganisers();
      if (result.return_code === 'SUCCESS' && result.organisers) {
        /* Dropped here, once, so every tile count and every filter agrees with the rows below.
           Filtering in the render would leave the totals counting people nobody can see. */
        setOrganisers(
          result.organisers.filter((o) => !HIDDEN_ORGANISER_EMAILS.includes((o.email || '').toLowerCase()))
        );
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
        return o.spend_12m > 0;
      case 'empty':
        return isEmpty(o);
      case 'quiet':
        return isQuiet(o);
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
  const counts = useMemo(
    () => ({
      total: organisers.length,
      empty: organisers.filter(isEmpty).length,
      quiet: organisers.filter(isQuiet).length,
      paying: organisers.filter((o) => o.spend_12m > 0).length,
    }),
    [organisers]
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

        {/* Four, in the order they are worth acting on: everyone, then the two lists with
            something to do about them, then the customers to look after. */}
        {!loading && organisers.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <FilterTile
              label="Organisers"
              value={counts.total}
              hint="everyone"
              active={filter === 'all'}
              onClick={() => setFilter('all')}
            />
            <FilterTile
              label="No players yet"
              value={counts.empty}
              hint="set up, nobody joined"
              tone="warn"
              active={filter === 'empty'}
              onClick={() => setFilter('empty')}
            />
            <FilterTile
              label="Gone quiet"
              value={counts.quiet}
              hint={`not seen in ${QUIET_AFTER_DAYS} days`}
              tone="warn"
              active={filter === 'quiet'}
              onClick={() => setFilter('quiet')}
            />
            <FilterTile
              label="Paying"
              value={counts.paying}
              hint="paid in the last 12 months"
              tone="good"
              active={filter === 'paying'}
              onClick={() => setFilter('paying')}
            />
          </div>
        )}

        {/*
        No bulk-copy button. It put every visible address on the clipboard for a Bcc paste, which
        is the one thing this screen should not make easy: a pasted Bcc bypasses email_preference
        entirely, so somebody who unsubscribed still gets it. Anything going to more than one
        person belongs on Emails -> Broadcast, which counts the audience, honours opt-outs and
        leaves a record.

        The per-row mail button stays. One-to-one outreach is what this screen is for.
        */}
        <div className="mb-5 flex flex-wrap items-center justify-end gap-3">
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
                    People they recruited - not themselves, not bots. It therefore no longer
                    matches the sum of their rows on the competitions screen, which counts every
                    membership. The distinct count only appears when someone has played in more
                    than one of their competitions and the two numbers therefore disagree.
                    */}
                    <td className="px-4 py-3 text-slate-600">
                      <span
                        className="tabular-nums"
                        title="People who joined, excluding the organiser themselves and any bots"
                      >
                        {o.players_total}
                      </span>
                      {o.players_unique !== o.players_total && (
                        <div
                          className="text-xs text-slate-400"
                          title="Some people play in more than one of their competitions"
                        >
                          {o.players_unique} people
                        </div>
                      )}
                    </td>

                    {/*
                    CREDITS: how many more players they could take on right now - free places left
                    plus credit bought. A real 0 is shown as 0, not a dash: an organiser who cannot
                    add another player is the one row here worth acting on, and a dash reads as
                    "nothing to say".

                    Bots and guests are excluded server-side, which matters: the account with 190
                    credits bought has almost all of its members as bots, and bots are never
                    charged, so its free places were never spent either.
                    */}
                    <td
                      className={`px-4 py-3 tabular-nums ${o.credits_available === 0 ? 'font-medium text-red-700' : 'text-slate-600'}`}
                      title={
                        o.free_places_left > 0
                          ? `${o.free_places_left} free place${o.free_places_left === 1 ? '' : 's'} left + ${o.credit} bought · ${o.chargeable_players} players counted so far`
                          : `Free allowance used up · ${o.credit} bought · ${o.chargeable_players} players counted so far`
                      }
                    >
                      {o.credits_available}
                    </td>

                    {/* Real money, last 12 months. Test-mode Stripe sessions are excluded server
                        side, so this no longer counts £70 that was never taken. */}
                    <td className="px-4 py-3 tabular-nums text-slate-600" title={`${o.credit} credit remaining`}>
                      {o.spend_12m > 0 ? formatMoney(o.spend_12m) : <span className="text-slate-400">—</span>}
                    </td>


                    {/*
                    THE ORGANISER'S OWN last session, and only that. This screen is about the
                    person; how busy their players are is a question about a competition, and the
                    competitions screen answers it there.

                    The players' newest pick used to sit above this, and two dates about two
                    different people stacked under one heading read as one fact contradicting
                    itself. last_player_activity is still returned by the route but nothing on this
                    screen reads it any more - "Gone quiet" now keys off this column instead,
                    because an organiser can vanish while their competition ticks along without
                    them, and that is precisely the person worth an email.
                    */}
                    <td className="px-4 py-3 text-slate-500" title={formatDate(o.last_active_at)}>
                      {formatAge(o.last_active_at)}
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
