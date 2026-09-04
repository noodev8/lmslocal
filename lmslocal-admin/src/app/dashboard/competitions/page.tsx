'use client';

/*
=======================================================================================================================================
Admin Competitions List
=======================================================================================================================================
Purpose: Drill-down from the dashboard's "Competitions" cards - every competition on the
         platform with organiser, player count, and last activity, filterable by status and,
         via ?organiser=<id> from the Organisers screen, down to one person's competitions.

         The status tiles count REAL competitions only. Anything archived is pulled out into its
         own "Archived" tile and tab, so the headline figures stop flattering us - a competition
         nobody but its organiser ever touched used to sit in "Active" forever. People figures
         live on the overview, not here; this screen counts competitions.

         ARCHIVED IS A DECISION SOMEBODY MADE, not a calculation (2026-09-04). It was derived -
         no real players or no picks, quiet 7 days - and is now competition.archived_at, set by
         the flag button on each row.

         What replaced the rule is already on the screen: "Last activity" is the same signal the
         rule read, it is the DEFAULT SORT, and descending puts the deadest competitions in front
         of you - which is the point at which a person decides, rather than a threshold. Do not
         turn that column back into a verdict.

         The name on each row opens /dashboard/competitions/[id] - the read-only stats screen,
         which loads nothing until you go into it. Everything beyond the columns here belongs
         there, so this screen can stay a list. The one figure that made the trip in the other
         direction is the current round's pick progress, because it is the thing you scan for:
         finding the competition where nobody has picked should not mean opening thirty screens.
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
  FlagIcon,
} from '@heroicons/react/24/outline';
import { FlagIcon as FlagSolidIcon } from '@heroicons/react/24/solid';
import AdminHeader from '@/components/AdminHeader';
import { adminApi, getToken, AdminCompetition, AdminStats, apiBaseUrl, getWebBaseUrl } from '@/lib/api';
import { formatAge, formatDate, formatTime } from '@/lib/dates';

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

/*
What each status is CALLED on screen. "setup" stays the stored value, the URL parameter and the
API's filter - this is display only, and the two must not be confused: renaming the value would
break the ?status= links the dashboard hands over and the filter the server accepts.

"Pending" because "Setup" reads like an instruction rather than a state - these are competitions
waiting to begin, not competitions being configured.
*/
const STATUS_LABEL: Record<string, string> = {
  active: 'active',
  setup: 'pending',
  complete: 'complete',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_BADGE[status] || STATUS_BADGE.complete;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {STATUS_LABEL[status] || status}
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

/*
Competition 117, "App Store", is ours and is hidden from this screen entirely.

It exists so Apple's reviewers have something to sign into when an iOS release is submitted, and
it is never played. On a platform with eighteen competitions it was one row in eighteen of noise,
and worse, it counted: it sat in the SETUP tab and the status breakdown as though somebody had
created a competition and abandoned it.

Hidden here rather than deleted or flagged in the database - it has to keep working for the next
submission, and a column on `competition` for one permanent exception would be a schema change
carrying a single row forever. By id, not by name, so renaming it in the app cannot bring it back.
*/
const HIDDEN_COMPETITION_IDS = [117];

/*
Who runs this competition, with an address that can be copied in one click.

Deliberately thin: a name and an address that can be copied in one click. Everything about the
PERSON - competition count, lifetime spend, when they were last seen - belongs on the Organisers
screen, which is what the name links to. A spend badge lived here too and went the same way; this
screen is read a row at a time about competitions, and money is a question you ask about an
organiser, in the place that ranks them by it.
*/
function OrganiserCell({ competition }: { competition: AdminCompetition }) {
  const [copied, setCopied] = useState(false);
  const email = competition.organiser_email;

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


const TILE_TONES = {
  default: 'from-indigo-500 to-cyan-400',
  good: 'from-emerald-500 to-teal-400',
  neutral: 'from-slate-500 to-slate-400',
  warn: 'from-amber-500 to-orange-400',
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
People, under the competition tiles.

Deliberately smaller and deliberately not a button. The four tiles above are controls - they
filter the list - and these are not; making them the same size would invite a click that does
nothing. Lighter type, no gradient rule, tighter padding, but the same grid so the edges line up.

Four cards is the budget, and it is the tiles' column count that sets it. Adding a fifth meant a
fifth column here and lost that alignment, so "paid places" arriving cost "registered" its place
rather than widening the row - see the note where it stood. Anything new has to displace
something, which is the point: this row mixes live people with an all-time share already, and a
sixth figure is a sixth chance to read two of them as one population.
*/
function PeopleCard({
  label,
  value,
  hint,
  // A unit stuck to the figure, for the one card that is not a count of things. Rendered inside
  // the same span so it cannot wrap away from its number.
  unit = '',
}: {
  label: string;
  value: number;
  hint: string;
  unit?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-semibold tabular-nums text-slate-900">
          {value.toLocaleString()}{unit}
        </span>
        <span className="text-sm font-medium text-slate-600">{label}</span>
      </div>
      <p className="mt-0.5 text-xs text-slate-400">{hint}</p>
    </div>
  );
}

/*
How far through the round in progress this competition is - picks in over players still in.

THE ONE STAT ON THIS SCREEN, and the reason there is a stats screen behind it. It is here rather
than only on the drill-down because it is what you SCAN: the competition where nobody has picked
is worth finding without opening every row, and a fraction is small enough not to turn the list
into a dashboard. Everything else the drill-down shows stayed there.

Blank when there is nothing to say - no round yet, or nobody still in. Same discipline as "still
in" a column to the left, which only appears once somebody is out: a cell that is always
populated is a cell nobody reads.

The numbers are the server's (services/pickProgress.js), shared with /admin/get-competition-stats
so this cell and that screen cannot disagree. Nothing is computed here beyond choosing a colour.
*/
function PickProgressCell({ competition }: { competition: AdminCompetition }) {
  const round = competition.current_round;

  if (!round || round.players_due === 0) {
    return <span className="text-slate-300">—</span>;
  }

  const { picks_made, players_due, picks_outstanding, real_outstanding, is_locked } = round;
  const allIn = picks_outstanding === 0;

  /*
  Amber only while something can still be done about it. Once a round has locked, outstanding
  picks are history - the lives are already gone - and colouring them as a warning would leave
  rows demanding attention that nobody can give them.
  */
  const tone = allIn
    ? 'text-emerald-600'
    : is_locked
      ? 'text-slate-500'
      : 'text-amber-600 font-medium';

  return (
    <div
      className="whitespace-nowrap tabular-nums"
      title={
        allIn
          ? `Round ${round.round_number}: everyone still in has picked`
          : is_locked
            ? `Round ${round.round_number}: ${picks_outstanding} never picked`
            : `Round ${round.round_number}: ${picks_outstanding} still to pick (${real_outstanding} of them people), locks ${formatDate(round.lock_time)} at ${formatTime(round.lock_time)}`
      }
    >
      <span className={tone}>
        {picks_made}
        <span className="text-slate-300">/</span>
        {players_due}
      </span>
      {/* The count that matters, spelled out only when it is not zero and not yet spent. */}
      {!allIn && !is_locked && (
        <div className="text-xs text-slate-400">{picks_outstanding} to pick</div>
      )}
    </div>
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
    batch_staged?: boolean;
    matched_fixtures?: number;
    round_kickoff?: string | null;
    batch_kickoff?: string | null;
  };
  onCancel: () => void;
  onOverride: () => void;
}) {
  const {
    competition,
    round_number,
    total_fixtures,
    unresolved_fixtures,
    batch_staged,
    matched_fixtures,
    round_kickoff,
    batch_kickoff,
  } = target;

  /*
  The push matches a staged result to a fixture on home team + away team + kickoff time. An
  organiser who keyed their own round chose that kickoff themselves, usually as their pick
  deadline rather than the real one, so taking the round over can leave it matching nothing -
  invisible to the push, and no longer entered by the organiser either. Marshfield JYFC went
  that way with 57 players sitting in a locked round.
  */
  const unreachable = batch_staged === true && matched_fixtures === 0;

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

        {unreachable && (
          <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <p className="font-medium">The staged batch cannot reach this round.</p>
            <p className="mt-1">
              None of its unresulted fixtures match on kickoff time, so it would not appear on the
              Results screen and nobody could resolve it.
              {round_kickoff && batch_kickoff && (
                <>
                  {' '}This round kicks off {formatDate(round_kickoff)} at{' '}
                  {formatTime(round_kickoff)}; the batch kicks off {formatDate(batch_kickoff)} at{' '}
                  {formatTime(batch_kickoff)}.
                </>
              )}{' '}
              Align the kickoff times first.
            </p>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onOverride}
            disabled={unreachable}
            title={unreachable ? 'Align the kickoff times before taking this round over.' : undefined}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
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
  // Set when arriving from the Organisers screen - narrows the whole page to one person.
  const organiserParam = searchParams.get('organiser');
  const organiserId = organiserParam ? parseInt(organiserParam, 10) : null;
  /*
  Active is the landing tab: it is the question this screen is usually open to answer, and it is
  the number that has to be true. "all" is a real value rather than the absence of one, so that
  clicking the lit Active tile can turn it off and stay off - with an empty default, clearing the
  filter would drop the parameter and land straight back on Active.

  The exception is arriving from the Organisers screen. That click means "show me this person's
  competitions", all of them - defaulting them to Active would silently hide the setup and
  finished ones and make their row's count disagree with the list it opened.
  */
  const statusParam = searchParams.get('status') || (organiserParam ? 'all' : 'active');

  const [competitions, setCompetitions] = useState<AdminCompetition[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('last_activity');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [deleteTarget, setDeleteTarget] = useState<AdminCompetition | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [markingId, setMarkingId] = useState<number | null>(null);
  /* People figures for the row under the tiles. Null until they arrive, and null if they fail -
     losing them must not take the competitions list with it. */
  const [people, setPeople] = useState<AdminStats['users'] | null>(null);
  /* Organisers holding something active or pending, and how many of those have paid. Sits in the
     same row and arrives in the same request, so it is kept beside the people figures rather
     than in its own state. */
  const [organisers, setOrganisers] = useState<AdminStats['organisers'] | null>(null);
  /* Free against billable places, for the paid-share card. Same request again. */
  const [places, setPlaces] = useState<AdminStats['places'] | null>(null);
  const [lastViewed, setLastViewed] = useState<{ id: number; at: number } | null>(null);
  const [roundInProgressTarget, setRoundInProgressTarget] = useState<{
    competition: AdminCompetition;
    round_number?: number;
    total_fixtures?: number;
    unresolved_fixtures?: number;
    batch_staged?: boolean;
    matched_fixtures?: number;
    round_kickoff?: string | null;
    batch_kickoff?: string | null;
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
            batch_staged: result.batch_staged,
            matched_fixtures: result.matched_fixtures,
            round_kickoff: result.round_kickoff,
            batch_kickoff: result.batch_kickoff,
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

  /*
  Archive a competition, or bring it back.

  Two states, not three. There used to be a third - "hand this row back to the rule" - because
  archived was DERIVED and an admin could only override the calculation. There is no calculation
  now, so there is nothing to hand back to: archived is on or off.

  No optimistic update here, unlike the fixture-service switch. Archiving a row moves it to a
  different tab, so the honest feedback is the row leaving the list once the server has agreed -
  flipping it locally first would make it vanish and then reappear on failure.
  */
  const handleSetArchived = async (competition: AdminCompetition, archived: boolean) => {
    setMarkingId(competition.id);
    setError('');
    try {
      const result = await adminApi.setCompetitionArchived(competition.id, archived);
      if (result.return_code === 'SUCCESS') {
        await load();
      } else if (result.return_code !== 'UNAUTHORIZED' && result.return_code !== 'TOKEN_EXPIRED') {
        setError(result.message || 'Could not update the competition');
      }
    } catch {
      setError(`Could not reach ${apiBaseUrl}.`);
    } finally {
      setMarkingId(null);
    }
  };

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Numbers and dates are almost always wanted biggest-first; names are not. Starting every
      // column ascending meant clicking "Last activity" - the one you click to see what has just
      // happened - answered with the deadest competitions on the platform. The organisers screen
      // already does this; this one was missed.
      setSortDirection(key === 'name' || key === 'status' ? 'asc' : 'desc');
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
        /* Dropped here, once, rather than in the render - every count on this screen (the status
           breakdown, the organiser filter, the row total) reads this array, and filtering later
           would leave them all including a competition nobody can see. */
        setCompetitions(result.competitions.filter((c) => !HIDDEN_COMPETITION_IDS.includes(c.id)));
      } else if (result.return_code !== 'UNAUTHORIZED' && result.return_code !== 'TOKEN_EXPIRED') {
        setError(result.message || 'Could not load competitions');
      }
    } catch {
      setError(`Could not reach ${apiBaseUrl}. The server may be down, or this site's address may not be in the server's CORS allowlist (CLIENT_URL).`);
    } finally {
      setLoading(false);
    }

    /*
    People are a second request, after the list rather than alongside it: the competitions are
    the screen and these are context. A failure is swallowed - a missing people row is a smaller
    loss than an error banner over a list that loaded fine.
    */
    try {
      const stats = await adminApi.getStats();
      const ok = stats.return_code === 'SUCCESS';
      setPeople(ok && stats.users ? stats.users : null);
      setOrganisers(ok && stats.organisers ? stats.organisers : null);
      setPlaces(ok && stats.places ? stats.places : null);
    } catch {
      setPeople(null);
      setOrganisers(null);
      setPlaces(null);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    localStorage.removeItem(LAST_VIEWED_KEY);
    setLastViewed(null);
    load();
  }, [router, load]);

  /*
  Status and organiser are independent filters, so changing one must not drop the other.

  Clicking the tile that is already lit clears it to "all". Not for reachability - the four tiles
  partition the platform, so every competition is one click away from exactly one of them - but to
  reach the combined list, the only view where the search box spans every live status at once.
  */
  const setStatus = (status: string) => {
    const next = status === statusParam ? 'all' : status;
    const params = new URLSearchParams();
    params.set('status', next);
    if (organiserParam) params.set('organiser', organiserParam);
    const qs = params.toString();
    router.push(qs ? `/dashboard/competitions?${qs}` : '/dashboard/competitions');
  };

  /*
  "archived" is a tab, not a status - an archived competition still has a real status underneath.
  So it is filtered as its own view AND excluded from every other one, including Total. Leaving
  the rows in the status tabs while pulling them out of the counts would be the worst of both:
  tiles that disagree with the list beneath them.
  */
  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    const archivedTab = statusParam === 'archived';
    const matches = competitions.filter((c) =>
      (archivedTab
        ? c.is_archived
        : !c.is_archived && (statusParam === 'all' || c.status === statusParam)) &&
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

  /*
  A total of exactly the rows the table shows below it, so it moves with the tab, the organiser
  scope and the search box rather than describing a different set from the one you are looking
  at. Sits above the table rather than among the people cards, which are platform-wide and stay
  put under a filter - a total that is meant to answer "what am I looking at right now" has to
  shrink and grow with the table, not sit fixed above it describing everything.

  "Picks" is summed only over rows with a round to pick in (same test PickProgressCell uses) -
  a pending competition contributes players but has nothing to add to a fraction of picks made.

  The tone mirrors PickProgressCell's own rule so the headline and the column it summarises never
  disagree about what colour "still work to do" is. There is no single is_locked here - some
  rounds in the total will be locked and some will not - so the split that matters is actionable:
  real_outstanding (people, not bots) in a round that has NOT locked. Amber while that is above
  zero; once every open round either locked or emptied, nothing more can change today.
  */
  const totals = useMemo(() => {
    let players = 0;
    let picksMade = 0;
    let playersDue = 0;
    let actionableOutstanding = 0;
    filtered.forEach((c) => {
      players += c.player_count;
      if (c.current_round && c.current_round.players_due > 0) {
        picksMade += c.current_round.picks_made;
        playersDue += c.current_round.players_due;
        if (!c.current_round.is_locked) {
          actionableOutstanding += c.current_round.real_outstanding;
        }
      }
    });
    const hasPickData = playersDue > 0;
    const allIn = hasPickData && picksMade === playersDue;
    const tone = allIn
      ? 'text-emerald-600'
      : actionableOutstanding > 0
        ? 'text-amber-600 font-medium'
        : 'text-slate-500';
    return {
      players,
      picksMade,
      playersDue,
      hasPickData,
      pct: hasPickData ? Math.round((picksMade / playersDue) * 100) : 0,
      tone
    };
  }, [filtered]);

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
    const counts: Record<string, number> = { active: 0, setup: 0, complete: 0, archived: 0 };
    scoped.forEach((c) => {
      // An archived competition is counted once, as archived, and nowhere else. Competition 176
      // reached ACTIVE with a round pushed and not one pick ever made, and sat in the "Active"
      // tile from 16 July - that number was the reason this tab exists at all.
      if (c.is_archived) counts.archived += 1;
      else counts[c.status] = (counts[c.status] || 0) + 1;
    });
    return counts;
  }, [scoped]);

  return (
    <div className="min-h-screen">
      <AdminHeader title="Competitions">
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
            {/* Says "all", so it has to mean all - without the parameter this would drop onto
                the Active tab and show a fraction of what it offered. */}
            <Link
              href="/dashboard/competitions?status=all"
              className="rounded-lg border border-indigo-300 bg-white px-3 py-1 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100"
            >
              Show all competitions
            </Link>
          </div>
        )}

        {!loading && scoped.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatusTile
              label="Active"
              value={statusCounts.active}
              tone="good"
              active={statusParam === 'active'}
              onClick={() => setStatus('active')}
            />
            <StatusTile
              label="Pending"
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
            <StatusTile
              label="Archived"
              value={statusCounts.archived}
              tone="warn"
              active={statusParam === 'archived'}
              onClick={() => setStatus('archived')}
            />
          </div>
        )}

        {/*
          People. A separate, quieter row rather than a fifth tile, because these count humans
          and the tiles count competitions - and because nothing here filters anything.

          "Active" means the same thing in both rows: in a competition that is neither complete
          nor archived. A player eliminated from a running competition still counts; they stop
          counting when it ends, not when they lose.

          Hidden while the page is scoped to one organiser - these are platform-wide figures, and
          sitting them under a banner reading "showing competitions run by X" would invite them to
          be read as that person's.
        */}
        {people && organiserId === null && (
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <PeopleCard
              label="active players"
              value={people.active}
              hint={`of ${people.total.toLocaleString()} registered, in a live competition`}
            />
            {/*
              "Registered" (cumulative accounts, with new-in-30-days as its hint) stood here and
              was removed. It could only ever rise, so it could not tell growth from churn - the
              same objection that retired the cumulative "genuine people" count and /dashboard
              itself. Its useful half survives: the active-players hint above still says what
              share of the register is playing.

              Its hint was also quietly misleading. "228 new in 30 days" was true and read as
              current growth, but only 2 of those landed in the last week - an August burst that
              had already stopped.
            */}
            {/*
              Organisers sit third, not first: the row leads with the figures read most often,
              and this one is a few dozen against a few hundred.

              "Live" and not "all we have ever had", to match the Organisers screen, which lists
              only organisers with something active or pending. A total including everyone whose
              competitions have all finished or been archived can only ever rise, so it could
              not tell growth from churn - the same reason "active players" replaced a cumulative
              count. Null while it is loading or if it failed, and the card simply stays away.
            */}
            {organisers !== null && (
              <PeopleCard
                label="organisers"
                value={organisers.live}
                hint="running something active or pending"
              />
            )}
            {/*
              The paid share, and the only money on this screen.

              Counted in PLACES, not people, because the place is what we sell - and that is the
              only unit that makes the fraction fair. Players never pay us, so a "% of players
              paying" would describe hundreds of people as customers who bought nothing. And an
              organiser under the free limit is not a failed sale, so a "% of organisers paying"
              damns the platform for something nobody has been asked to do yet.

              It also falls, which the alternatives could not: a large free competition lowers it,
              correctly, being real load that earns nothing.

              Places CONSUMED past a free allowance, NOT credits bought - organisers buy in packs
              and sit on the balance, so the two are far apart. This card is demand; revenue is a
              different figure and does not belong under a row of player counts.

              THE PERCENTAGE LEADS, and the raw counts are demoted to the hint, because this is
              the one card on the row not counting live people. It showed 151 of 384 beside "241
              active players" and the two invited a comparison that cannot be made: 384 is
              PLACES, all-time, guests included; 241 is registered PEOPLE in a live competition.
              Bridging them takes four steps - drop 24 guest places, drop 35 second memberships
              held by the same person, drop 84 people whose competitions have all finished.

              The all-time scope is not fixable and must not be "fixed". A finished competition
              still holds its places and still consumes the organiser's free 20 - that is what
              the join gate enforces, and services/placeUsage.js exists to say so. Scoping this
              to live competitions would sit better beside its neighbours and be wrong about
              money. A share does not invite the subtraction; a count does.
            */}
            {places !== null && places.total > 0 && (
              <PeopleCard
                label="paid places"
                value={Math.round((places.billable / places.total) * 100)}
                unit="%"
                hint={`${places.billable.toLocaleString()} of ${places.total.toLocaleString()} places held, finished comps included`}
              />
            )}
            <PeopleCard
              label="guests"
              value={people.active_guests}
              hint="playing without an account"
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
            {/*
              The table's own headline, not a platform one - see the note on `totals` above.
              Lives on the table rather than floating in the search row above it, and says "X
              competitions" up front so it cannot be mistaken for the "241 active players" card:
              that one is unique registered people across the whole live platform; this is a raw
              sum of player_count for whatever the tab and search currently show, bots and
              re-joins and all - the same 14 rows currently below it, no more, no fewer.
            */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm">
              <span className="text-slate-500">
                {filtered.length} competition{filtered.length === 1 ? '' : 's'} shown
              </span>
              <span className="text-slate-600">
                <span className="font-semibold tabular-nums text-slate-900">{totals.players}</span>{' '}
                player{totals.players === 1 ? '' : 's'}
                {totals.hasPickData && (
                  <>
                    {' · '}
                    <span className={`font-semibold tabular-nums ${totals.tone}`}>
                      {totals.picksMade}
                      <span className="font-normal text-slate-400">/</span>
                      {totals.playersDue} picked ({totals.pct}%)
                    </span>
                  </>
                )}
              </span>
            </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <SortableHeader col={COLUMNS[0]} sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
                  <SortableHeader col={COLUMNS[1]} sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
                  <th className="px-4 py-3 font-semibold">Organiser</th>
                  <SortableHeader col={COLUMNS[2]} sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} />
                  <th
                    className="px-4 py-3 font-semibold"
                    title="Picks in for the round currently open, out of the players still in"
                  >
                    Picks
                  </th>
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
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <Link
                        href={`/dashboard/competitions/${c.id}`}
                        className="transition hover:text-indigo-600 hover:underline"
                      >
                        {c.name}
                      </Link>
                      {/* Below the name and out of the way - it is only ever read deliberately,
                          when quoting a row. Same mono grey the fixtures screen uses for an id. */}
                      <div className="font-mono text-xs font-normal text-slate-400">#{c.id}</div>
                      {/* When it was archived, shown only in the Archived tab - the view where
                          you are deciding whether that decision still holds. Everywhere else it
                          would be a line of explanation on a row nobody is questioning. */}
                      {c.is_archived && statusParam === 'archived' && c.archived_at && (
                        <div className="mt-0.5 text-xs font-normal text-amber-700">
                          Archived {new Date(c.archived_at).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric'
                          })}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                      {/* Pending only. On a started competition the start date is in the past and
                          adds a column of noise to every row; the badge alone is the answer. */}
                      {c.status === 'setup' && c.start_date && (
                        <div
                          className="mt-1 whitespace-nowrap text-xs text-slate-500"
                          title={`Round 1 locks ${formatDate(c.start_date)} at ${formatTime(c.start_date)}`}
                        >
                          {formatDate(c.start_date)}
                        </div>
                      )}
                    </td>
                    <td className="max-w-[16rem] px-4 py-3"><OrganiserCell competition={c} /></td>
                    {/* Total first, since that is what the column has always meant and what the
                        header sorts by. "Still in" only appears once somebody is out: on a
                        pending competition it would repeat the number directly above it. */}
                    <td className="px-4 py-3 tabular-nums text-slate-600">
                      {c.player_count}
                      {c.still_in_count < c.player_count && (
                        <div
                          className="text-xs text-slate-400"
                          title={`${c.player_count - c.still_in_count} eliminated`}
                        >
                          {c.still_in_count} still in
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3"><PickProgressCell competition={c} /></td>
                    {/* The exact day moves into the tooltip, since the cell now reads relatively. */}
                    <td
                      className="px-4 py-3 text-slate-500"
                      title={`Last activity ${formatDate(c.last_activity)} — created ${formatDate(c.created_at)}`}
                    >
                      {formatAge(c.last_activity)}
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
                        {/* No "back to the rule" button any more - there is no rule to go back
                            to. Archive and unarchive are the whole of it. */}
                        <button
                          onClick={() => handleSetArchived(c, !c.is_archived)}
                          disabled={markingId === c.id}
                          className={`rounded-lg p-1.5 transition disabled:opacity-50 ${
                            c.is_archived
                              ? 'text-amber-600 hover:bg-emerald-50 hover:text-emerald-600'
                              : 'text-slate-400 hover:bg-amber-50 hover:text-amber-600'
                          }`}
                          title={
                            c.is_archived
                              ? 'Unarchive - count this competition again'
                              : 'Archive and take it out of the counts'
                          }
                        >
                          {c.is_archived ? (
                            <FlagSolidIcon className="h-4 w-4" />
                          ) : (
                            <FlagIcon className="h-4 w-4" />
                          )}
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
