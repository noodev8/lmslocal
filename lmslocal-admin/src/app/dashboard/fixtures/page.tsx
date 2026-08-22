'use client';

/*
=======================================================================================================================================
Admin Fixtures
=======================================================================================================================================
Purpose: Stage fixtures and results centrally, then distribute them to every competition
         subscribed to the fixture service.

Replaces /admin-fixtures and /admin-results in lmslocal-web, which sat behind the hardcoded
access code 12221 and shipped the push secret BOT_MAGIC_2025 in the public browser bundle.

The model, which this screen deliberately preserves:

  only one staged batch at a time per team list  ->  one round in each subscribed competition

Staging is blocked while a batch is already sat in fixture_load - it has to be fully resulted
and pushed (which empties the table) before the next one can go in. Every fixture in a batch
shares one kickoff time, and that time becomes the round's lock time. So a real football
gameweek spread across Friday to Sunday is entered as several batches, each becoming its own
round with its own deadline - which is what every round in the database currently looks like.
=======================================================================================================================================
*/

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import AdminHeader from '@/components/AdminHeader';
import {
  adminApi,
  getToken,
  apiBaseUrl,
  FixtureTeamList,
  FixturePair,
  StagedFixture,
  ResultOutcome,
  PushTarget,
  PushOneResponse,
  FixturePushTarget,
  PushFixturesOneResponse,
  ClearBatchResponse,
} from '@/lib/api';
import { ukTimeToUtcIso, describeUkDateTime } from '@/lib/uk-time';

type Tab = 'fixtures' | 'results';

// Feedback banner shown under the tab bar. Kept as data rather than a formatted string so the
// tone drives the styling instead of the message being prefixed with a tick or a cross.
type Notice = { tone: 'success' | 'info' | 'error'; text: string } | null;

// ======================================================================================
// Date and time shortcuts
// ======================================================================================

/** Next occurrence of a weekday (0 = Sunday), optionally a number of weeks further out. */
function nextDayOfWeek(dayOfWeek: number, weeksAhead = 0): Date {
  const today = new Date();
  let daysUntil = dayOfWeek - today.getDay();
  if (daysUntil < 0) daysUntil += 7;
  daysUntil += weeksAhead * 7;

  const target = new Date(today);
  target.setDate(today.getDate() + daysUntil);
  return target;
}

/** 'YYYY-MM-DD' in local time. toISOString() would shift the date back an hour during BST. */
function toDateInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/* An already-stored timestamp, shown in UK time. describeUkDateTime is for the entry form, which
   holds a date and a time separately; this takes the ISO string the server sends back. */
function formatKickoff(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

const TIME_SHORTCUTS = [
  { value: '12:30', label: '12:30', sub: 'lunch' },
  { value: '15:00', label: '15:00', sub: '3pm' },
  { value: '17:30', label: '17:30', sub: '5:30pm' },
  { value: '19:30', label: '19:30', sub: '7:30pm' },
  { value: '20:00', label: '20:00', sub: '8pm' },
];

// ======================================================================================
// Small presentational pieces
// ======================================================================================

function Chip({
  label,
  sub,
  selected,
  onClick,
}: {
  label: string;
  sub?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
        selected
          ? 'bg-indigo-600 text-white shadow-sm'
          : 'border border-slate-300 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'
      }`}
    >
      <div>{label}</div>
      {sub && <div className="text-[10px] opacity-75">{sub}</div>}
    </button>
  );
}

function NoticeBanner({ notice }: { notice: Notice }) {
  if (!notice) return null;

  const tones = {
    success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-800', Icon: CheckCircleIcon },
    info: { box: 'border-sky-200 bg-sky-50 text-sky-800', Icon: InformationCircleIcon },
    error: { box: 'border-red-200 bg-red-50 text-red-700', Icon: ExclamationTriangleIcon },
  } as const;
  const { box, Icon } = tones[notice.tone];

  return (
    <div className={`mb-5 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${box}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{notice.text}</span>
    </div>
  );
}

/*
Read-only view of the staged batch, shown instead of the entry form while one is pending -
so the block ("finish this before staging another") is not a dead end, just a look at what's
already there.
*/
/*
The committing action, shared by both push lists.

Outlined rather than filled. A dozen of these stack down a list, and a column of solid buttons
reads as a dozen things all demanding to be pressed - which is the opposite of the truth, since
they are worked one at a time in order. It fills on hover and on touch, so the one under the
thumb is unmistakable at the moment it matters.

The ink is the near-black already used by Confirm on a fixture, because they are the same kind
of act: this writes and cannot be taken back. Indigo now means one thing only - a result chosen
but not yet confirmed - instead of standing for both a pick and a push.
*/
const PUSH_BUTTON =
  'min-h-[44px] w-24 shrink-0 rounded-lg border px-3 text-sm font-semibold transition ' +
  'disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-white disabled:text-slate-300';

const PUSH_BUTTON_READY =
  'border-slate-900 bg-white text-slate-900 hover:bg-slate-900 hover:text-white ' +
  'active:bg-slate-900 active:text-white';

/* A push that came back with an error keeps its place in the list but says so on the button. */
const PUSH_BUTTON_FAILED =
  'border-red-300 bg-white text-red-700 hover:bg-red-600 hover:text-white ' +
  'active:bg-red-600 active:text-white';

function PendingFixturesPanel({
  teamList,
  setNotice,
}: {
  teamList: FixtureTeamList;
  setNotice: (n: Notice) => void;
}) {
  const [fixtures, setFixtures] = useState<StagedFixture[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFixtures(null);

    adminApi.getStagedResults(teamList.id).then((result) => {
      if (cancelled) return;
      if (result.return_code === 'SUCCESS') {
        setFixtures(result.fixtures || []);
      } else if (result.return_code !== 'UNAUTHORIZED' && result.return_code !== 'TOKEN_EXPIRED') {
        setNotice({ tone: 'error', text: result.message || 'Could not load the staged fixtures.' });
        setFixtures([]);
      }
    }).catch(() => {
      if (!cancelled) {
        setNotice({ tone: 'error', text: `Could not reach ${apiBaseUrl}.` });
        setFixtures([]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [teamList.id, setNotice]);

  // All fixtures in a batch share one kickoff time - that's the cut-off, shown once rather
  // than repeated on every row.
  const cutoff = fixtures && fixtures.length > 0
    ? fixtures.reduce((earliest, f) => (f.kickoff_time < earliest ? f.kickoff_time : earliest), fixtures[0].kickoff_time)
    : null;

  return (
    <div>
      {/* A statement of fact, not a warning. Nothing here has gone wrong and nothing needs
          deciding - the batch is staged and results come next - so it reads as one line in the
          ordinary card colours rather than a full-width amber alert. */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <p className="text-sm text-slate-600">
          <span className="font-medium text-slate-900">Fixtures are set.</span> Enter the results
          before creating new fixtures.
          {cutoff && (
            <>
              <span className="mx-1.5 text-slate-300">·</span>
              Cut-off{' '}
              {new Date(cutoff).toLocaleDateString('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </>
          )}
        </p>
      </div>

      <div className="mt-6 space-y-2">
        {fixtures === null ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : (
          fixtures.map((fixture) => {
            const resulted = fixture.home_score !== null && fixture.away_score !== null;
            return (
              <div
                key={fixture.fixture_id}
                className={`rounded-lg border px-4 py-3 text-sm font-medium text-slate-900 ${
                  resulted ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white'
                }`}
              >
                {fixture.home_team_name}
                <span className="mx-2 text-slate-400">v</span>
                {fixture.away_team_name}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ======================================================================================
// Fixtures tab
// ======================================================================================

function FixturesTab({
  teamList,
  onStaged,
  setNotice,
}: {
  teamList: FixtureTeamList;
  onStaged: () => void;
  setNotice: (n: Notice) => void;
}) {
  const [kickoffDate, setKickoffDate] = useState('');
  const [kickoffTime, setKickoffTime] = useState('15:00');
  // Whether this batch STARTS a gameweek or continues one already being pushed. A competition
  // with no rounds yet can only take a batch that starts one - otherwise its round 1 would be the
  // Sunday leftovers of a gameweek everyone else played in full. Nothing in the fixture data can
  // tell these apart, so it is asked here.
  const [opensGameweek, setOpensGameweek] = useState(true);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [pairs, setPairs] = useState<FixturePair[]>([{ home_team_short: '', away_team_short: '' }]);
  const [submitting, setSubmitting] = useState(false);

  // Batches staged in this session, so it is obvious what has already gone in.
  const [staged, setStaged] = useState<{ count: number; at: string }[]>([]);

  // Starting a new list clears whatever was half-entered for the previous one - team codes from
  // one list are meaningless in another.
  useEffect(() => {
    setPairs([{ home_team_short: '', away_team_short: '' }]);
    setStaged([]);
  }, [teamList.id]);

  const dateShortcuts = useMemo(() => {
    const build = (day: number, weeks: number, prefix: string) => {
      const d = nextDayOfWeek(day, weeks);
      return {
        value: toDateInputValue(d),
        label: `${prefix} ${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })}`,
      };
    };
    return [
      build(5, 0, 'Fri'),
      build(6, 0, 'Sat'),
      build(0, 0, 'Sun'),
      build(5, 1, 'Fri'),
      build(6, 1, 'Sat'),
      build(0, 1, 'Sun'),
    ];
  }, []);

  // A team already used in this batch cannot be picked again - it would give a player two
  // fixtures to satisfy with one pick.
  const usedTeams = useMemo(() => {
    const used = new Set<string>();
    pairs.forEach((p) => {
      if (p.home_team_short) used.add(p.home_team_short);
      if (p.away_team_short) used.add(p.away_team_short);
    });
    return used;
  }, [pairs]);

  // Where the next clicked team goes. Derived from the list rather than tracked separately, so
  // removing a fixture mid-entry cannot leave the cursor pointing at a filled slot.
  const nextSlot = useMemo(() => {
    for (let i = 0; i < pairs.length; i++) {
      if (!pairs[i].home_team_short) return { index: i, side: 'home' as const };
      if (!pairs[i].away_team_short) return { index: i, side: 'away' as const };
    }
    return { index: pairs.length - 1, side: 'away' as const };
  }, [pairs]);

  const completePairs = pairs.filter((p) => p.home_team_short && p.away_team_short);

  if (teamList.pending_fixtures) {
    return <PendingFixturesPanel teamList={teamList} setNotice={setNotice} />;
  }

  const handleTeamClick = (shortName: string) => {
    const updated = [...pairs];
    if (nextSlot.side === 'home') {
      updated[nextSlot.index] = { ...updated[nextSlot.index], home_team_short: shortName };
    } else {
      updated[nextSlot.index] = { ...updated[nextSlot.index], away_team_short: shortName };
      // Completing the last pair opens a fresh one, so entry never needs an "add" button.
      if (nextSlot.index === pairs.length - 1) {
        updated.push({ home_team_short: '', away_team_short: '' });
      }
    }
    setPairs(updated);
  };

  const handleRemove = (index: number) => {
    setPairs((prev) =>
      prev.length > 1
        ? prev.filter((_, i) => i !== index)
        : [{ home_team_short: '', away_team_short: '' }]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);

    if (!kickoffDate || !kickoffTime) {
      setNotice({ tone: 'error', text: 'Choose a kick off date and time first.' });
      return;
    }
    if (completePairs.length === 0) {
      setNotice({ tone: 'error', text: 'Add at least one fixture with both teams.' });
      return;
    }

    setSubmitting(true);
    try {
      const result = await adminApi.addStagedFixtures(
        teamList.id,
        ukTimeToUtcIso(kickoffDate, kickoffTime),
        completePairs,
        opensGameweek
      );

      if (result.return_code === 'SUCCESS') {
        setStaged((prev) => [
          ...prev,
          {
            count: result.fixtures_added!,
            at: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        setNotice({ tone: 'success', text: 'Fixtures staged.' });
        setPairs([{ home_team_short: '', away_team_short: '' }]);
        setKickoffDate('');
        setKickoffTime('15:00');
        setOpensGameweek(true);
        onStaged();
      } else if (result.return_code === 'PENDING_BATCH') {
        setNotice({ tone: 'error', text: result.message || 'Finish the pending batch before staging a new one.' });
        onStaged();
      } else if (result.return_code !== 'UNAUTHORIZED' && result.return_code !== 'TOKEN_EXPIRED') {
        setNotice({ tone: 'error', text: result.message || 'Could not stage those fixtures.' });
      }
    } catch {
      setNotice({ tone: 'error', text: `Could not reach ${apiBaseUrl}.` });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {staged.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">Staged this session:</span>
          {staged.map((s, i) => (
            <span
              key={i}
              className="rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20"
            >
              {s.count} fixture{s.count === 1 ? '' : 's'} · {s.at}
            </span>
          ))}
        </div>
      )}

      {/* Kickoff - one time for the whole batch, which becomes the round's lock time */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Kick off &amp; lock time</h2>
          <span className="text-xs text-slate-400">
            entered as UK time, stored as UTC
          </span>
        </div>

        <label className="mb-2 block text-xs font-medium text-slate-600">Date</label>
        <div className="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {dateShortcuts.map((s) => (
            <Chip
              key={s.value}
              label={s.label}
              selected={kickoffDate === s.value}
              onClick={() => {
                setKickoffDate(s.value);
                setShowCustomDate(false);
              }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowCustomDate((v) => !v)}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
        >
          {showCustomDate ? 'Hide' : 'Another date...'}
        </button>
        {showCustomDate && (
          <input
            type="date"
            value={kickoffDate}
            onChange={(e) => setKickoffDate(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
          />
        )}

        <label className="mb-2 mt-5 block text-xs font-medium text-slate-600">Time</label>
        <div className="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {TIME_SHORTCUTS.map((s) => (
            <Chip
              key={s.value}
              label={s.label}
              sub={s.sub}
              selected={kickoffTime === s.value}
              onClick={() => {
                setKickoffTime(s.value);
                setShowCustomTime(false);
              }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowCustomTime((v) => !v)}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
        >
          {showCustomTime ? 'Hide' : 'Another time...'}
        </button>
        {showCustomTime && (
          <input
            type="time"
            value={kickoffTime}
            onChange={(e) => setKickoffTime(e.target.value)}
            className="mt-2 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
          />
        )}

        {kickoffDate && kickoffTime && (
          <p className="mt-4 border-t border-slate-100 pt-3 text-sm font-medium text-slate-700">
            {describeUkDateTime(kickoffDate, kickoffTime)}
          </p>
        )}

        <label className="mt-4 flex cursor-pointer items-start gap-3 border-t border-slate-100 pt-3">
          <input
            type="checkbox"
            checked={opensGameweek}
            onChange={(e) => setOpensGameweek(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-indigo-600"
          />
          <span className="text-sm text-slate-700">
            This batch starts a new gameweek
            <span className="mt-0.5 block text-xs text-slate-500">
              Untick for the Saturday and Sunday slices of a gameweek you have already started
              pushing. Competitions that have not started yet will sit out those, and begin on the
              next gameweek instead of joining halfway through.
            </span>
          </span>
        </label>
      </div>

      {/* Team picker and the batch being built */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                {teamList.name}
              </h2>
              <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                pick {nextSlot.side}
              </span>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Click teams in turn - home, then away. Each pair opens the next.
            </p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {teamList.teams.map((team) => {
                const used = usedTeams.has(team.short_name);
                return (
                  <button
                    key={team.id}
                    type="button"
                    disabled={used}
                    onClick={() => handleTeamClick(team.short_name)}
                    title={team.name}
                    className={`rounded-lg px-2 py-2 text-sm font-bold transition ${
                      used
                        ? 'cursor-not-allowed bg-slate-100 text-slate-300'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800'
                    }`}
                  >
                    {team.short_name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              New fixtures
            </h2>
            <span className="text-xs text-slate-500">
              {completePairs.length} fixture{completePairs.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="max-h-[420px] space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
            {pairs.map((pair, index) => {
              const isNext = index === nextSlot.index;
              const home = teamList.teams.find((t) => t.short_name === pair.home_team_short);
              const away = teamList.teams.find((t) => t.short_name === pair.away_team_short);
              const complete = pair.home_team_short && pair.away_team_short;

              return (
                <div
                  key={index}
                  className={`flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm ${
                    complete ? 'border-emerald-200' : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-1 items-center justify-between">
                    <span
                      className={
                        isNext && nextSlot.side === 'home'
                          ? 'font-medium text-indigo-600'
                          : 'text-slate-800'
                      }
                    >
                      {home?.name || 'Home'}
                    </span>
                    <span className="mx-2 text-xs text-slate-400">v</span>
                    <span
                      className={
                        isNext && nextSlot.side === 'away'
                          ? 'font-medium text-indigo-600'
                          : 'text-slate-800'
                      }
                    >
                      {away?.name || 'Away'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className="rounded p-0.5 text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                    title="Remove"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting || completePairs.length === 0 || !kickoffDate}
        className="w-full rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {submitting
          ? 'Confirming...'
          : `Confirm fixtures (${completePairs.length})`}
      </button>
    </form>
  );
}

// ======================================================================================
// Push fixtures - one competition at a time
// ======================================================================================

/*
Fixtures go out per competition, driven by hand: press a row, read what came back, press the
next. It used to be one button that swept every subscribed competition, and the only thing
keeping a mis-staged batch away from real customers was FIXTURE_SERVICE_TEST_MODE - an env var
naming one organiser's email, which had to be set before testing, unset afterwards, and which
silently starved every real customer of fixtures while it was on. Naming the competition on each
push makes the blast radius one competition, so the env var is gone.

Competitions that can't take the batch are listed too, greyed, with the reason. One that simply
vanished from the list would look like a bug, and "why hasn't that one got its fixtures?" is the
question this screen exists to answer.
*/

type FixturePushOutcome =
  | { ok: true; data: PushFixturesOneResponse }
  | { ok: false; message: string };

function PushFixturesPanel({
  teamList,
  stagedCount,
  setNotice,
}: {
  teamList: FixtureTeamList;
  stagedCount: number;
  setNotice: (n: Notice) => void;
}) {
  const [targets, setTargets] = useState<FixturePushTarget[] | null>(null);
  const [stagedTotal, setStagedTotal] = useState(0);
  const [earliestKickoff, setEarliestKickoff] = useState<string | null>(null);
  const [pushingId, setPushingId] = useState<number | null>(null);
  const [outcomes, setOutcomes] = useState<Record<number, FixturePushOutcome>>({});

  const load = useCallback(async () => {
    try {
      const result = await adminApi.getFixturePushTargets(teamList.id);
      if (result.return_code === 'SUCCESS') {
        setTargets(result.competitions || []);
        setStagedTotal(result.staged_total || 0);
        setEarliestKickoff(result.earliest_kickoff || null);
      } else if (result.return_code !== 'UNAUTHORIZED' && result.return_code !== 'TOKEN_EXPIRED') {
        setNotice({ tone: 'error', text: result.message || 'Could not load the competitions for this batch.' });
        setTargets([]);
      }
    } catch {
      setNotice({ tone: 'error', text: `Could not reach ${apiBaseUrl}.` });
      setTargets([]);
    }
  }, [teamList.id, setNotice]);

  // Reloads when the staged batch changes, so eligibility reflects what is actually staged.
  useEffect(() => {
    load();
  }, [load, stagedCount]);

  const handlePush = async (target: FixturePushTarget) => {
    setPushingId(target.competition_id);
    setNotice(null);
    try {
      const result = await adminApi.pushFixturesToCompetition(target.competition_id);
      if (result.return_code === 'SUCCESS') {
        setOutcomes((prev) => ({ ...prev, [target.competition_id]: { ok: true, data: result } }));
      } else if (result.return_code !== 'UNAUTHORIZED' && result.return_code !== 'TOKEN_EXPIRED') {
        setOutcomes((prev) => ({
          ...prev,
          [target.competition_id]: { ok: false, message: result.message || 'Push failed.' },
        }));
      }
      await load();
    } catch {
      // The server commits whether or not anyone is still listening, so a dropped connection is
      // more likely to mean "done" than "failed". Say that rather than inviting a blind retry.
      setOutcomes((prev) => ({
        ...prev,
        [target.competition_id]: {
          ok: false,
          message: 'Lost contact while pushing. Refresh to check - it may already be done.',
        },
      }));
      await load();
    } finally {
      setPushingId(null);
    }
  };

  if (targets === null) {
    return <p className="mt-6 text-sm text-slate-500">Loading competitions...</p>;
  }

  if (targets.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-6 py-6 text-center text-sm text-slate-500">
        No competition on this team list is subscribed to the fixture service.
      </div>
    );
  }

  const eligible = targets.filter((t) => t.eligible);

  /*
  Gone entirely once the batch has nowhere left to go: staged, but every competition already has
  it. Pushing fixtures is a job with an end - once the deadline has passed and every round is
  under way, a list of a dozen disabled Push buttons is answering a question nobody is asking,
  under a banner that has already said results are what is wanted next.

  It comes back the moment there is something to push, which is every time a new batch is staged.
  Still shown after a push in this session, because those rows carry the outcome of what just
  happened.

  The cost, accepted deliberately: this is the only screen that names a competition whose
  organiser has never pressed Ready. While a batch is pushable it says so; in this state it does
  not.
  */
  const pushedThisSession = Object.keys(outcomes).length > 0;
  if (stagedTotal > 0 && eligible.length === 0 && !pushedThisSession) return null;

  return (
    <div className="mt-8">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Push fixtures</h2>
          <p className="text-xs text-slate-500">
            {eligible.length} of {targets.length} competition{targets.length === 1 ? '' : 's'} can take this batch
            <span className="mx-1.5 text-slate-300">·</span>
            {stagedTotal} fixture{stagedTotal === 1 ? '' : 's'} staged
            {earliestKickoff && (
              <>
                <span className="mx-1.5 text-slate-300">·</span>
                locks {formatKickoff(earliestKickoff)}
              </>
            )}
          </p>
        </div>

        {stagedTotal === 0 && (
          <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Nothing is staged for this team list. Add fixtures above first.</span>
          </div>
        )}

        <ul className="divide-y divide-slate-100">
          {targets.map((target) => {
            const isPushing = pushingId === target.competition_id;
            const outcome = outcomes[target.competition_id];
            const pushed = outcome?.ok === true;
            const disabled = pushingId !== null || !target.eligible || pushed;

            return (
              <li key={target.competition_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {pushed && <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-600" />}
                    <span
                      className={`truncate text-sm font-medium ${target.eligible || pushed ? 'text-slate-900' : 'text-slate-400'}`}
                    >
                      {target.name}
                    </span>
                    {target.round_number !== null && (
                      <span className="shrink-0 text-xs text-slate-400">round {target.round_number}</span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {/* The id is what ties this row to db/query.js, /game/[id] and any hand-written
                        unwind. Names collide across organisers - "LMS", "Last man standing" and
                        "MIT LAST MAN STANDING" were all live at once - and this is the one screen
                        where pushing the wrong row cannot be taken back. */}
                    <span className="font-mono text-slate-400">#{target.competition_id}</span>
                    <span className="mx-1 text-slate-300">·</span>
                    {target.organiser_email}
                  </p>
                </div>

                <div className="text-right text-xs text-slate-500">
                  {isPushing ? (
                    <span className="flex items-center gap-1.5 text-indigo-600">
                      <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                      Pushing - don&apos;t refresh
                    </span>
                  ) : outcome && !outcome.ok ? (
                    <span className="text-red-600">{outcome.message}</span>
                  ) : outcome?.ok ? (
                    <span className="text-emerald-700">
                      round {outcome.data.round_number} {outcome.data.round_action}
                      <span className="mx-1 text-slate-300">·</span>
                      {outcome.data.fixtures_pushed} fixtures
                    </span>
                  ) : !target.eligible ? (
                    // The reason comes from the same rules the push enforces, so it can't be
                    // reassuring about something the push would then refuse.
                    <span className="text-slate-400">{target.reason}</span>
                  ) : (
                    <span>
                      {target.active_players} active player{target.active_players === 1 ? '' : 's'}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handlePush(target)}
                  disabled={disabled}
                  title={!target.eligible ? target.reason || undefined : pushed ? 'Already pushed.' : undefined}
                  className={`${PUSH_BUTTON} ${outcome && !outcome.ok ? PUSH_BUTTON_FAILED : PUSH_BUTTON_READY}`}
                >
                  {isPushing ? 'Pushing...' : outcome && !outcome.ok ? 'Retry' : 'Push'}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-500">
            Each push creates that competition&apos;s round and its players see it immediately. The batch
            stays staged for the others until you clear it on the results tab.
          </p>
        </div>
      </div>
    </div>
  );
}

// ======================================================================================
// Results tab
// ======================================================================================

/* Derives the outcome already saved on a fixture, if any. Both scores null means unresulted. */
function savedOutcome(fixture: StagedFixture): ResultOutcome | null {
  if (fixture.home_score === null || fixture.away_score === null) return null;
  if (fixture.home_score > fixture.away_score) return 'home_win';
  if (fixture.away_score > fixture.home_score) return 'away_win';
  return 'draw';
}

function ResultsTab({
  teamList,
  setNotice,
  onBatchCleared,
}: {
  teamList: FixtureTeamList;
  setNotice: (n: Notice) => void;
  onBatchCleared: () => void;
}) {
  const [fixtures, setFixtures] = useState<StagedFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<number | null>(null);

  // A result picked but not yet confirmed - can still be changed. Once confirmed it is saved
  // to the fixture itself and the row locks, so this only ever holds unconfirmed choices.
  const [selected, setSelected] = useState<Record<number, ResultOutcome>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminApi.getStagedResults(teamList.id);
      if (result.return_code === 'SUCCESS') {
        setFixtures(result.fixtures || []);
        setSelected({});
      } else if (result.return_code !== 'UNAUTHORIZED' && result.return_code !== 'TOKEN_EXPIRED') {
        setNotice({ tone: 'error', text: result.message || 'Could not load fixtures.' });
      }
    } catch {
      setNotice({ tone: 'error', text: `Could not reach ${apiBaseUrl}.` });
    } finally {
      setLoading(false);
    }
  }, [teamList.id, setNotice]);

  useEffect(() => {
    load();
  }, [load]);

  const handleConfirm = async (fixture: StagedFixture) => {
    const outcome = selected[fixture.fixture_id];
    if (!outcome) return;

    setConfirming(fixture.fixture_id);
    setNotice(null);

    try {
      const result = await adminApi.setStagedResult(fixture.fixture_id, outcome);
      if (result.return_code === 'SUCCESS') {
        setFixtures((prev) =>
          prev.map((f) =>
            f.fixture_id === fixture.fixture_id
              ? { ...f, home_score: result.home_score!, away_score: result.away_score! }
              : f
          )
        );
        setSelected((prev) => {
          const next = { ...prev };
          delete next[fixture.fixture_id];
          return next;
        });
      } else if (result.return_code !== 'UNAUTHORIZED' && result.return_code !== 'TOKEN_EXPIRED') {
        setNotice({ tone: 'error', text: result.message || 'Could not save that result.' });
      }
    } catch {
      setNotice({ tone: 'error', text: `Could not reach ${apiBaseUrl}.` });
    } finally {
      setConfirming(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading...</p>;
  }

  if (fixtures.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-8 text-center">
        <CheckCircleIcon className="mx-auto h-8 w-8 text-slate-400" />
        <h2 className="mt-2 font-semibold text-slate-700">Nothing waiting for results</h2>
        <p className="mt-1 text-sm text-slate-500">
          {teamList.name} has no staged fixtures right now.
        </p>
      </div>
    );
  }

  // All fixtures in a batch share one kickoff time - that's the cut-off, shown once rather
  // than repeated on every row.
  const cutoff = fixtures.reduce((earliest, f) => (f.kickoff_time < earliest ? f.kickoff_time : earliest), fixtures[0].kickoff_time);
  const beforeCutoff = new Date(cutoff) > new Date();

  return (
    <>
      {beforeCutoff && (
        <div className="mb-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Kick off is{' '}
          {new Date(cutoff).toLocaleDateString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
          . Results can be entered after that.
        </div>
      )}

      <div className="space-y-1.5">
        {fixtures.map((fixture) => {
          const locked = savedOutcome(fixture);

          /*
          A settled fixture collapses to one line. Entering results is done a match at a time as
          they finish, so on a phone the screen should be mostly the fixtures still needing an
          answer - a done match that keeps a full card of dead buttons pushes the live ones off
          the screen. It stays visible, and still says what was recorded, in a third of the height.
          */
          if (locked) {
            const code =
              locked === 'draw'
                ? 'DRAW'
                : locked === 'home_win'
                  ? fixture.home_team_short
                  : fixture.away_team_short;

            return (
              <div
                key={fixture.fixture_id}
                className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-2.5"
              >
                <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-600" />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-600">
                  {fixture.home_team_name}
                  <span className="mx-1.5 text-slate-400">v</span>
                  {fixture.away_team_name}
                </span>
                <span className="shrink-0 font-mono text-sm font-semibold tracking-wider text-emerald-700">
                  {code}
                </span>
              </div>
            );
          }

          const chosen = selected[fixture.fixture_id];
          const isConfirming = confirming === fixture.fixture_id;
          const disabled = beforeCutoff || isConfirming;

          /*
          Labelled with the three-letter code, not the club name. Three buttons across a phone
          leave about ten characters each, and "Crystal Palace" is fourteen - the names wrapped
          and the row went ragged. The codes are what a scoreboard uses, they never truncate, and
          the full names are on the line directly above.
          */
          const options: { key: ResultOutcome; code: string; says: string }[] = [
            { key: 'home_win', code: fixture.home_team_short, says: `${fixture.home_team_short} win` },
            { key: 'draw', code: 'DRAW', says: 'draw' },
            { key: 'away_win', code: fixture.away_team_short, says: `${fixture.away_team_short} win` },
          ];

          return (
            <div key={fixture.fixture_id} className="rounded-xl border border-slate-200 bg-white p-2.5">
              <p className="mb-2 truncate px-1 text-sm font-medium text-slate-900">
                {fixture.home_team_name}
                <span className="mx-1.5 font-normal text-slate-400">v</span>
                {fixture.away_team_name}
              </p>

              <div className="grid grid-cols-3 gap-1.5">
                {options.map((option) => {
                  const picked = chosen === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      disabled={disabled}
                      title={beforeCutoff ? 'Kick off has not happened yet.' : undefined}
                      onClick={() => setSelected((prev) => ({ ...prev, [fixture.fixture_id]: option.key }))}
                      // Filled only once chosen. All three filled made one choice look like three
                      // actions. min-h keeps every target past the 44px a thumb needs.
                      className={`flex min-h-[52px] items-center justify-center rounded-lg border px-1 font-mono text-base font-semibold tracking-wider transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        picked
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {option.code}
                    </button>
                  );
                })}
              </div>

              {/* Only once something is chosen. A permanently disabled Confirm on every row was
                  a screenful of dead button between the fixtures that still needed one. */}
              {chosen && (
                <button
                  type="button"
                  disabled={isConfirming}
                  onClick={() => handleConfirm(fixture)}
                  className="mt-1.5 min-h-[48px] w-full rounded-lg bg-slate-900 px-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isConfirming
                    ? 'Confirming...'
                    : `Confirm ${options.find((o) => o.key === chosen)!.says}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <PushResultsPanel
        teamList={teamList}
        resultedCount={fixtures.filter((f) => savedOutcome(f) !== null).length}
        setNotice={setNotice}
        onBatchCleared={onBatchCleared}
      />
    </>
  );
}

// ======================================================================================
// Push results - one competition at a time
// ======================================================================================

/*
Results go out per competition rather than in one sweep, and the admin drives it by hand: press
a row, wait, read what came back, press the next.

Two reasons it is not one button. Processing time scales with player count, so a batch of large
competitions could exceed the 60s proxy timeout in total while no single competition comes near
it - and the old all-competitions route ran the whole batch in ONE transaction, so a timeout
anywhere rolled every competition back and nobody got their results. Splitting it means nothing
compounds and a failure is confined to one competition.

Clearing the staged batch is its own button because the fixture_load rows have to survive until
the last competition has taken them - see clear-staged-batch.js.
*/

type PushOutcome =
  | { ok: true; data: PushOneResponse }
  | { ok: false; message: string };

function PushResultsPanel({
  teamList,
  resultedCount,
  setNotice,
  onBatchCleared,
}: {
  teamList: FixtureTeamList;
  resultedCount: number;
  setNotice: (n: Notice) => void;
  onBatchCleared: () => void;
}) {
  const [targets, setTargets] = useState<PushTarget[] | null>(null);
  const [stagedResulted, setStagedResulted] = useState(0);
  const [pushingId, setPushingId] = useState<number | null>(null);
  const [outcomes, setOutcomes] = useState<Record<number, PushOutcome>>({});
  const [clearing, setClearing] = useState(false);
  const [outstanding, setOutstanding] = useState<ClearBatchResponse['competitions'] | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await adminApi.getPushTargets(teamList.id);
      if (result.return_code === 'SUCCESS') {
        setTargets(result.competitions || []);
        setStagedResulted(result.staged_resulted || 0);
      } else if (result.return_code !== 'UNAUTHORIZED' && result.return_code !== 'TOKEN_EXPIRED') {
        setNotice({ tone: 'error', text: result.message || 'Could not load the competitions waiting for this batch.' });
        setTargets([]);
      }
    } catch {
      setNotice({ tone: 'error', text: `Could not reach ${apiBaseUrl}.` });
      setTargets([]);
    }
  }, [teamList.id, setNotice]);

  // Reloads when a result is confirmed, so the "x of y results in" line stays truthful.
  useEffect(() => {
    load();
  }, [load, resultedCount]);

  const handlePush = async (target: PushTarget) => {
    setPushingId(target.competition_id);
    setNotice(null);
    try {
      const result = await adminApi.pushResultsToCompetition(target.competition_id);
      if (result.return_code === 'SUCCESS') {
        setOutcomes((prev) => ({ ...prev, [target.competition_id]: { ok: true, data: result } }));
      } else if (result.return_code === 'ALREADY_PUSHED') {
        setOutcomes((prev) => ({
          ...prev,
          [target.competition_id]: { ok: true, data: { return_code: result.return_code } },
        }));
      } else if (result.return_code !== 'UNAUTHORIZED' && result.return_code !== 'TOKEN_EXPIRED') {
        setOutcomes((prev) => ({
          ...prev,
          [target.competition_id]: { ok: false, message: result.message || 'Push failed.' },
        }));
      }
      await load();
    } catch {
      // A dropped connection usually means the server finished anyway - it commits whether or
      // not anyone is still listening. Say so rather than calling it a failure.
      setOutcomes((prev) => ({
        ...prev,
        [target.competition_id]: {
          ok: false,
          message: 'Lost contact while pushing. Refresh to check - it may already be done.',
        },
      }));
      await load();
    } finally {
      setPushingId(null);
    }
  };

  const handleClear = async (force: boolean) => {
    setClearing(true);
    setNotice(null);
    try {
      const result = await adminApi.clearStagedBatch(teamList.id, force);
      if (result.return_code === 'SUCCESS') {
        setOutstanding(null);
        setNotice({ tone: 'success', text: `Staged batch cleared (${result.rows_cleared} fixtures). You can stage the next one.` });
        onBatchCleared();
      } else if (result.return_code === 'OUTSTANDING_COMPETITIONS') {
        setOutstanding(result.competitions || []);
      } else if (result.return_code !== 'UNAUTHORIZED' && result.return_code !== 'TOKEN_EXPIRED') {
        setNotice({ tone: 'error', text: result.message || 'Could not clear the staged batch.' });
      }
    } catch {
      setNotice({ tone: 'error', text: `Could not reach ${apiBaseUrl}.` });
    } finally {
      setClearing(false);
    }
  };

  if (targets === null) {
    return <p className="mt-6 text-sm text-slate-500">Loading competitions...</p>;
  }

  if (targets.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-6 py-6 text-center text-sm text-slate-500">
        No competition on the fixture service is waiting for this batch.
      </div>
    );
  }

  const anyResults = stagedResulted > 0;

  /*
  Clearing is blocked outright until every competition is settled, rather than warned about.
  The batch is the only source of results for a competition that has not been pushed yet, so
  clearing early stalls its round until the identical batch is staged again - a mistake with no
  quick undo, offered as a button that looked like ordinary tidying up.

  Safe to make hard: this list and the server's guard both filter on fixture_service = true, so
  a competition taken off the service mid-batch leaves both at once and cannot hold the batch
  hostage. The server keeps its force escape for the case this screen cannot see - a round
  resolved by hand - and the dialog below still exists for a client view that has gone stale.
  */
  const unsettled = targets.filter((t) => t.fixtures_pending > 0 || t.fixtures_unprocessed > 0);
  const canClear = unsettled.length === 0;

  return (
    <div className="mt-8">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Push results</h2>
        </div>

        {/* Only the case that stops you pressing anything. A part-entered batch is the ordinary
            state on a Friday night and needs no warning - the count in the header says it. */}
        {!anyResults && (
          <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-500">
            No results entered yet.
          </div>
        )}

        <ul className="divide-y divide-slate-100">
          {targets.map((target) => {
            const isPushing = pushingId === target.competition_id;
            const outcome = outcomes[target.competition_id];
            const finished = target.fixtures_pending === 0 && target.fixtures_unprocessed === 0;
            /*
            Whether pressing Push would actually do anything. results_to_push counts entered
            results this competition has not had yet; fixtures_unprocessed is a push that wrote
            results but never settled them, which pressing again finishes. Anything else and the
            push returns ALREADY_PUSHED, so the button has no business being live.
            */
            const needsPush = target.results_to_push > 0 || target.fixtures_unprocessed > 0;
            const disabled = pushingId !== null || !needsPush;

            /*
            A competition finished before this session opened collapses to one line with no
            button. Pushing eleven competitions on a phone is a worklist, and a row already done
            should not cost the same height - or carry a Push button to mis-tap - as one still
            waiting. A row pushed in THIS session keeps its full height: those numbers are the
            outcome of what just happened and are the reason to look.
            */
            if (!needsPush && !outcome) {
              return (
                <li
                  key={target.competition_id}
                  className="flex items-center gap-2.5 px-4 py-2.5"
                >
                  {/* A tick means the batch is finished here. A competition merely caught up on
                      what has been entered so far gets a plain dot - more results are coming and
                      it will need pressing again. */}
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {finished ? (
                      <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-500">
                    {target.name}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-slate-400">
                    #{target.competition_id}
                  </span>
                </li>
              );
            }

            return (
              <li key={target.competition_id} className="px-4 py-3">
                {/* Stacked on a phone, three columns from sm up. The name had to share a row with
                    a status column and a button, so it truncated to a few words at the width this
                    is actually read on. */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {finished && <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-600" />}
                      <span className="truncate text-sm font-medium text-slate-900">{target.name}</span>
                      {outcome?.ok && outcome.data.competition_status === 'COMPLETE' && (
                        <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                          complete
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {/* The id is what ties this row to db/query.js, /game/[id] and any hand-written
                          unwind. Names collide across organisers - "LMS", "Last man standing" and
                          "MIT LAST MAN STANDING" were all live at once - and this is the one screen
                          where pushing the wrong row cannot be taken back. */}
                      <span className="font-mono text-slate-400">#{target.competition_id}</span>
                      <span className="mx-1 text-slate-300">·</span>
                      {target.organiser_email}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <div className="text-xs text-slate-500 sm:text-right">
                      {isPushing ? (
                        <span className="flex items-center gap-1.5 text-indigo-600">
                          <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                          Processing - don&apos;t refresh
                        </span>
                      ) : outcome && !outcome.ok ? (
                        <span className="text-red-600">{outcome.message}</span>
                      ) : outcome?.ok && outcome.data.fixtures_processed !== undefined ? (
                        <span className="text-emerald-700">
                          {outcome.data.players_eliminated} eliminated
                          <span className="mx-1 text-slate-300">·</span>
                          {outcome.data.active_players_remaining} left
                        </span>
                      ) : finished ? (
                        <span className="text-slate-400">done</span>
                      ) : (
                        <span>
                          {target.players} player{target.players === 1 ? '' : 's'}
                          <span className="mx-1 text-slate-300">·</span>
                          {/* The number that says press me. Weighted, because it is the only
                              thing on the row that changes as the weekend goes on. */}
                          <span className="font-semibold text-slate-900">
                            {target.results_to_push > 0
                              ? `${target.results_to_push} to push`
                              : `${target.fixtures_unprocessed} to finish`}
                          </span>
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePush(target)}
                      disabled={disabled}
                      title={
                        !anyResults
                          ? 'Enter at least one result first.'
                          : !needsPush
                            ? 'Nothing new to push to this competition.'
                            : pushingId !== null
                              ? 'Another competition is being pushed.'
                              : undefined
                      }
                      className={`${PUSH_BUTTON} ${outcome && !outcome.ok ? PUSH_BUTTON_FAILED : PUSH_BUTTON_READY}`}
                    >
                      {isPushing ? 'Pushing...' : outcome && !outcome.ok ? 'Retry' : 'Push'}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-500">
            {canClear
              ? 'Clear the batch to stage the next round.'
              : `Clear once the results are in, to stage the next round. ${unsettled.length} still to come.`}
          </p>
          <button
            type="button"
            onClick={() => handleClear(false)}
            disabled={clearing || pushingId !== null || !canClear}
            title={!canClear ? 'Every competition needs its results first.' : undefined}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {clearing ? 'Clearing...' : 'Clear staged batch'}
          </button>
        </div>
      </div>

      {/* Refusing to clear is not the end of it - the admin may know a competition was taken off
          the service mid-batch, so name what is outstanding and let them decide. */}
      {outstanding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50">
                <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Some competitions are unfinished</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Clearing now leaves these without their results. Push them first unless you know they no longer need this batch.
                </p>
              </div>
            </div>

            <ul className="mt-4 space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              {outstanding.map((c) => (
                <li key={c.competition_id} className="flex justify-between gap-3">
                  <span className="truncate">
                    <span className="font-mono text-xs text-slate-400">#{c.competition_id}</span>{' '}
                    {c.name}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {c.fixtures_pending > 0
                      ? `${c.fixtures_pending} not pushed`
                      : `${c.fixtures_unprocessed} not processed`}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setOutstanding(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleClear(true)}
                disabled={clearing}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                Clear anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ======================================================================================
// Page
// ======================================================================================

export default function FixturesPage() {
  const router = useRouter();

  const [teamLists, setTeamLists] = useState<FixtureTeamList[]>([]);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('fixtures');
  const [notice, setNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const lists = await adminApi.getFixtureTeamLists();

      if (lists.return_code === 'SUCCESS' && lists.team_lists) {
        setTeamLists(lists.team_lists);
        setSelectedListId((current) =>
          current && lists.team_lists!.some((l) => l.id === current)
            ? current
            : lists.team_lists![0]?.id ?? null
        );
      } else if (lists.return_code !== 'UNAUTHORIZED' && lists.return_code !== 'TOKEN_EXPIRED') {
        setNotice({ tone: 'error', text: lists.message || 'Could not load team lists.' });
      }
    } catch {
      setNotice({
        tone: 'error',
        text: `Could not reach ${apiBaseUrl}. The server may be down, or this site's address may not be in the server's CORS allowlist (CLIENT_URL).`,
      });
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

  const teamList = useMemo(
    () => teamLists.find((l) => l.id === selectedListId) ?? null,
    [teamLists, selectedListId]
  );

  /* No screen-wide push button any more. Both fixtures and results go out one competition at a
     time, from the panel on their own tab, so the deadline guard that used to sit here moved
     into the eligibility rules the panels share with the server. */

  return (
    <div className="min-h-screen">
      <AdminHeader title="Fixtures" backHref="/dashboard">
        {/* The forward calendar. Blocks are keyed there weeks ahead and staged into this screen
            when their kickoffs are confirmed - see docs/competition-start.md. */}
        <Link
          href="/dashboard/fixtures/calendar"
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/10"
        >
          <CalendarDaysIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Calendar</span>
        </Link>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </AdminHeader>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <NoticeBanner notice={notice} />

        {loading && teamLists.length === 0 && <p className="text-sm text-slate-500">Loading...</p>}

        {teamList && (
          <>
            {/* Team list, tabs, and the two distribution buttons */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {teamLists.length > 1 && (
                  <select
                    value={teamList.id}
                    onChange={(e) => setSelectedListId(Number(e.target.value))}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                  >
                    {teamLists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                  </select>
                )}

                <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
                  {(['fixtures', 'results'] as Tab[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setTab(t);
                        setNotice(null);
                      }}
                      className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition ${
                        tab === t
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nothing pushes from up here any more. Both fixtures and results go out one
                  competition at a time from the panel on their own tab. */}
            </div>

            {tab === 'fixtures' ? (
              <>
                <FixturesTab teamList={teamList} onStaged={load} setNotice={setNotice} />
                {/* Below the entry form, not beside it: stage the batch, then push it to each
                    competition in turn. */}
                <PushFixturesPanel
                  teamList={teamList}
                  stagedCount={teamList.pending_fixtures ? 1 : 0}
                  setNotice={setNotice}
                />
              </>
            ) : (
              <ResultsTab teamList={teamList} setNotice={setNotice} onBatchCleared={load} />
            )}
          </>
        )}

        {!loading && teamLists.length === 0 && (
          <p className="text-sm text-slate-500">
            No active team list, so there is nothing to load fixtures against.
          </p>
        )}
      </main>
    </div>
  );
}

