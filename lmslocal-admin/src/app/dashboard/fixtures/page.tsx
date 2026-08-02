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
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  PaperAirplaneIcon,
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
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-8 text-center">
        <ExclamationTriangleIcon className="mx-auto h-8 w-8 text-amber-600" />
        <h2 className="mt-2 font-semibold text-amber-900">Fixtures are set</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-amber-800">
          Enter the results before creating new fixtures.
        </p>
        {cutoff && (
          <p className="mt-3 text-sm font-medium text-amber-900">
            Cut-off:{' '}
            {new Date(cutoff).toLocaleDateString('en-GB', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
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
      setNotice({ tone: 'error', text: 'Choose a kickoff date and time first.' });
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
        completePairs
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
          <h2 className="text-sm font-semibold text-slate-900">Kickoff &amp; lock time</h2>
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
}: {
  teamList: FixtureTeamList;
  setNotice: (n: Notice) => void;
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

  return (
    <>
      <div className="space-y-2">
        {fixtures.map((fixture) => {
          const locked = savedOutcome(fixture);
          const outcome = locked ?? selected[fixture.fixture_id];
          const isConfirming = confirming === fixture.fixture_id;

          const buttons: { key: ResultOutcome; label: string; tone: string }[] = [
            { key: 'home_win', label: fixture.home_team_name, tone: 'bg-indigo-600 hover:bg-indigo-700' },
            { key: 'draw', label: 'Draw', tone: 'bg-slate-600 hover:bg-slate-700' },
            { key: 'away_win', label: fixture.away_team_name, tone: 'bg-indigo-600 hover:bg-indigo-700' },
          ];

          return (
            <div
              key={fixture.fixture_id}
              className={`rounded-xl border p-4 transition ${
                locked ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-900">
                  {fixture.home_team_name}
                  <span className="mx-2 text-slate-400">v</span>
                  {fixture.away_team_name}
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(fixture.kickoff_time).toLocaleDateString('en-GB', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </div>

              <div className="flex gap-2">
                {buttons.map((b) => {
                  const resolvedTone =
                    outcome === b.key
                      ? locked
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-700 text-white ring-2 ring-indigo-300'
                      : outcome
                        ? 'bg-slate-200 hover:bg-slate-300 text-slate-500'
                        : `${b.tone} text-white`;

                  return (
                    <button
                      key={b.key}
                      type="button"
                      disabled={!!locked || isConfirming}
                      onClick={() => setSelected((prev) => ({ ...prev, [fixture.fixture_id]: b.key }))}
                      className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed ${resolvedTone}`}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>

              {!locked && (
                <button
                  type="button"
                  disabled={!selected[fixture.fixture_id] || isConfirming}
                  onClick={() => handleConfirm(fixture)}
                  className="mt-2 w-full rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {isConfirming ? 'Confirming...' : 'Confirm'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
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
  const [pushing, setPushing] = useState<'fixtures' | 'results' | null>(null);

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

  // Pushing a batch whose deadline has already passed creates a round that's locked before any
  // player can pick it - block it rather than let that happen by accident.
  const cutoffPassed = !!teamList?.pending_cutoff && new Date(teamList.pending_cutoff) <= new Date();

  const [confirmAction, setConfirmAction] = useState<Tab | null>(null);

  const runPushFixtures = async () => {
    setConfirmAction(null);
    setPushing('fixtures');
    setNotice(null);
    try {
      const result = await adminApi.pushFixtures();
      if (result.return_code === 'SUCCESS') {
        setNotice({ tone: 'success', text: 'Fixtures pushed.' });
        load();
      } else if (result.return_code === 'NO_ACTIVE_FIXTURES') {
        setNotice({
          tone: 'info',
          text: 'Nothing to push - no fixtures are staged. Add some on the fixtures tab first.',
        });
      } else if (result.return_code === 'NO_SUBSCRIBED_COMPETITIONS') {
        setNotice({ tone: 'info', text: 'No competition is opted into the fixture service.' });
      } else if (result.return_code !== 'UNAUTHORIZED' && result.return_code !== 'TOKEN_EXPIRED') {
        setNotice({ tone: 'error', text: result.message || 'Could not push fixtures.' });
      }
    } catch {
      setNotice({ tone: 'error', text: `Could not reach ${apiBaseUrl}.` });
    } finally {
      setPushing(null);
    }
  };

  const runPushResults = async () => {
    setConfirmAction(null);
    setPushing('results');
    setNotice(null);
    try {
      const result = await adminApi.pushResults();
      if (result.return_code === 'SUCCESS') {
        setNotice({ tone: 'success', text: 'Results pushed.' });
        load();
      } else if (result.return_code === 'NO_RESULTS_TO_PUSH') {
        setNotice({ tone: 'info', text: 'No staged results are waiting to be pushed.' });
      } else if (result.return_code !== 'UNAUTHORIZED' && result.return_code !== 'TOKEN_EXPIRED') {
        setNotice({ tone: 'error', text: result.message || 'Could not push results.' });
      }
    } catch {
      setNotice({ tone: 'error', text: `Could not reach ${apiBaseUrl}.` });
    } finally {
      setPushing(null);
    }
  };

  return (
    <div className="min-h-screen">
      <AdminHeader title="Fixtures" backHref="/dashboard">
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

              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmAction('fixtures')}
                  disabled={pushing !== null || cutoffPassed || !teamList.pending_fixtures}
                  title={
                    cutoffPassed
                      ? 'The staged batch\'s deadline has already passed - stage a new batch instead.'
                      : !teamList.pending_fixtures
                        ? 'No fixtures are staged yet.'
                        : undefined
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <PaperAirplaneIcon className="h-4 w-4" />
                  {pushing === 'fixtures' ? 'Pushing...' : 'Push fixtures'}
                </button>
                <button
                  onClick={() => setConfirmAction('results')}
                  disabled={pushing !== null || !teamList.pending_fixtures}
                  title={!teamList.pending_fixtures ? 'No fixtures are staged yet.' : undefined}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <PaperAirplaneIcon className="h-4 w-4" />
                  {pushing === 'results' ? 'Pushing...' : 'Push results'}
                </button>
              </div>
            </div>

            {tab === 'fixtures' ? (
              <FixturesTab teamList={teamList} onStaged={load} setNotice={setNotice} />
            ) : (
              <ResultsTab teamList={teamList} setNotice={setNotice} />
            )}
          </>
        )}

        {!loading && teamLists.length === 0 && (
          <p className="text-sm text-slate-500">
            No active team list, so there is nothing to load fixtures against.
          </p>
        )}
      </main>

      {confirmAction === 'fixtures' && (
        <PushConfirmModal
          title="Push staged fixtures"
          description="This sends every staged fixture to each opted-in competition and creates a new round for it. Players will see it immediately."
          confirmLabel="Push fixtures"
          onCancel={() => setConfirmAction(null)}
          onConfirm={runPushFixtures}
        />
      )}

      {confirmAction === 'results' && (
        <PushConfirmModal
          title="Push staged results"
          description="This settles every staged result against live picks. It eliminates players who picked losing or drawing teams, and can complete competitions outright."
          confirmLabel="Push results"
          tone="danger"
          onCancel={() => setConfirmAction(null)}
          onConfirm={runPushResults}
        />
      )}
    </div>
  );
}

function PushConfirmModal({
  title,
  description,
  confirmLabel,
  tone = 'default',
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'default' | 'danger';
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const danger = tone === 'danger';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              danger ? 'bg-red-50' : 'bg-indigo-50'
            }`}
          >
            <PaperAirplaneIcon className={`h-5 w-5 ${danger ? 'text-red-600' : 'text-indigo-600'}`} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
