'use client';

/*
=======================================================================================================================================
Fixture Calendar
=======================================================================================================================================
Purpose: Key blocks of fixtures weeks ahead of them going out, and promote one into the staging
         table when its kickoffs are confirmed.

  fixture_block  --Stage-->  fixture_load  --push-->  round + fixture
  (this screen)              (Fixtures screen, unchanged)

Why this is a separate screen from Fixtures, rather than another tab on it:

fixture_load may hold only ONE batch per team list at a time. That rule is right for the thing
being pushed - a round is one batch, and the results screen has no way to tell two apart - but it
also made it impossible to write down what is coming in three weeks. So a new competition had
nothing in it until an operator staged and the organiser pressed Ready, and every player they
recruited in the meantime landed on an empty screen.

Blocks are the calendar. Several may exist at once, they are provisional, and they can be edited
until the moment they are staged. Nothing here pushes anything to a competition - promoting hands
the block to the Fixtures screen, and the rest of the flow is untouched.

See docs/competition-start.md.
=======================================================================================================================================
*/

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import AdminHeader from '@/components/AdminHeader';
import {
  adminApi,
  getToken,
  apiBaseUrl,
  FixtureTeamList,
  FixtureBlock,
  BlockFixtureInput,
} from '@/lib/api';
import { ukTimeToUtcIso } from '@/lib/uk-time';

type Notice = { tone: 'success' | 'info' | 'error'; text: string } | null;

/* A fixture being entered: teams plus its own kickoff, held as separate UK date and time fields
   because that is what the inputs bind to. Converted to UTC only on submit. */
type DraftFixture = {
  home_team_short: string;
  away_team_short: string;
  date: string;
  time: string;
};

// ======================================================================================
// Dates
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

/** A stored timestamp, shown in UK time. */
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

/** Splits a stored UTC timestamp back into the UK date and time fields the form edits. */
function toDraftDateTime(iso: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    // Intl gives 24 for midnight in en-GB; the time input will not accept it.
    time: `${get('hour') === '24' ? '00' : get('hour')}:${get('minute')}`,
  };
}

/** The label we suggest for a block, from its earliest kickoff. Editable - it is only a name. */
function suggestLabel(date: string): string {
  if (!date) return '';
  // Parsed as local midnight, which is the date the operator typed regardless of timezone.
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

const TIME_SHORTCUTS = ['12:30', '15:00', '17:30', '19:30', '20:00'];

// ======================================================================================
// Small pieces
// ======================================================================================

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

// ======================================================================================
// Block entry - used for both adding and editing
// ======================================================================================

function BlockForm({
  teamList,
  editing,
  onSaved,
  onCancel,
  setNotice,
}: {
  teamList: FixtureTeamList;
  /* The block being edited, or null when adding a new one. */
  editing: FixtureBlock | null;
  onSaved: () => void;
  onCancel: () => void;
  setNotice: (n: Notice) => void;
}) {
  // Defaults applied to each new pair as it is created, so a block of ten 3pm kickoffs is one
  // choice rather than ten.
  const [defaultDate, setDefaultDate] = useState('');
  const [defaultTime, setDefaultTime] = useState('15:00');
  const [label, setLabel] = useState('');
  const [labelTouched, setLabelTouched] = useState(false);
  const [opensGameweek, setOpensGameweek] = useState(true);
  const [fixtures, setFixtures] = useState<DraftFixture[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Load the block being edited into the form, or reset to empty for a new one.
  useEffect(() => {
    if (editing) {
      const drafts = editing.fixtures.map((f) => ({
        home_team_short: f.home_team_short,
        away_team_short: f.away_team_short,
        ...toDraftDateTime(f.kickoff_time),
      }));
      setFixtures(drafts);
      setLabel(editing.label);
      setLabelTouched(true);
      setOpensGameweek(editing.opens_gameweek);
      setDefaultDate(drafts[0]?.date ?? '');
      setDefaultTime(drafts[0]?.time ?? '15:00');
    } else {
      setFixtures([]);
      setLabel('');
      setLabelTouched(false);
      setOpensGameweek(true);
      setDefaultDate('');
      setDefaultTime('15:00');
    }
  }, [editing]);

  const dateShortcuts = useMemo(() => {
    const build = (day: number, weeks: number, prefix: string) => {
      const d = nextDayOfWeek(day, weeks);
      return {
        value: toDateInputValue(d),
        label: `${prefix} ${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })}`,
      };
    };
    // Three weeks out, because that is the range a competition can be created against.
    return [
      build(6, 0, 'Sat'), build(0, 0, 'Sun'),
      build(6, 1, 'Sat'), build(0, 1, 'Sun'),
      build(6, 2, 'Sat'), build(0, 2, 'Sun'),
    ];
  }, []);

  // A team already in this block cannot be picked again - it would give a player two fixtures
  // to satisfy with one pick.
  const usedTeams = useMemo(() => {
    const used = new Set<string>();
    fixtures.forEach((f) => {
      if (f.home_team_short) used.add(f.home_team_short);
      if (f.away_team_short) used.add(f.away_team_short);
    });
    return used;
  }, [fixtures]);

  // Where the next clicked team goes. Derived rather than tracked, so removing a fixture
  // mid-entry cannot leave the cursor pointing at a filled slot.
  const nextSlot = useMemo(() => {
    for (let i = 0; i < fixtures.length; i++) {
      if (!fixtures[i].home_team_short) return { index: i, side: 'home' as const };
      if (!fixtures[i].away_team_short) return { index: i, side: 'away' as const };
    }
    return { index: fixtures.length, side: 'home' as const };
  }, [fixtures]);

  const handleTeamClick = (shortName: string) => {
    if (!defaultDate) {
      setNotice({ tone: 'error', text: 'Pick the date first - each fixture takes its kick off from it.' });
      return;
    }

    setFixtures((prev) => {
      const updated = [...prev];
      if (nextSlot.index >= updated.length) {
        updated.push({
          home_team_short: shortName,
          away_team_short: '',
          date: defaultDate,
          time: defaultTime,
        });
      } else if (nextSlot.side === 'home') {
        updated[nextSlot.index] = { ...updated[nextSlot.index], home_team_short: shortName };
      } else {
        updated[nextSlot.index] = { ...updated[nextSlot.index], away_team_short: shortName };
      }
      return updated;
    });

    if (!labelTouched && defaultDate) setLabel(suggestLabel(defaultDate));
  };

  const complete = fixtures.filter((f) => f.home_team_short && f.away_team_short);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);

    if (complete.length === 0) {
      setNotice({ tone: 'error', text: 'Add at least one fixture with both teams.' });
      return;
    }
    if (!label.trim()) {
      setNotice({ tone: 'error', text: 'Give the block a label - it is what an organiser sees.' });
      return;
    }
    if (complete.some((f) => !f.date || !f.time)) {
      setNotice({ tone: 'error', text: 'Every fixture needs a kick off date and time.' });
      return;
    }

    const payload: BlockFixtureInput[] = complete.map((f) => ({
      home_team_short: f.home_team_short,
      away_team_short: f.away_team_short,
      kickoff_time: ukTimeToUtcIso(f.date, f.time),
    }));

    setSubmitting(true);
    try {
      const result = editing
        ? await adminApi.updateFixtureBlock(editing.id, label.trim(), payload, opensGameweek)
        : await adminApi.addFixtureBlock(teamList.id, label.trim(), payload, opensGameweek);

      if (result.return_code === 'SUCCESS') {
        setNotice({
          tone: 'success',
          text: editing ? 'Block updated.' : `Block added - ${payload.length} fixtures.`,
        });
        onSaved();
      } else if (result.return_code !== 'UNAUTHORIZED' && result.return_code !== 'TOKEN_EXPIRED') {
        setNotice({ tone: 'error', text: result.message || 'Could not save that block.' });
      }
    } catch {
      setNotice({ tone: 'error', text: `Could not reach ${apiBaseUrl}.` });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-slate-900">
          {editing ? `Edit "${editing.label}"` : 'New block'}
        </h2>
        <span className="text-xs text-slate-400">entered as UK time, stored as UTC</span>
      </div>

      {/* Defaults for new pairs. Each fixture keeps its own time and can be changed below. */}
      <label className="mb-2 block text-xs font-medium text-slate-600">Date</label>
      <div className="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {dateShortcuts.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => {
              setDefaultDate(s.value);
              if (!labelTouched) setLabel(suggestLabel(s.value));
            }}
            className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
              defaultDate === s.value
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'border border-slate-300 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <input
        type="date"
        value={defaultDate}
        onChange={(e) => {
          setDefaultDate(e.target.value);
          if (!labelTouched) setLabel(suggestLabel(e.target.value));
        }}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
      />

      <label className="mb-2 mt-5 block text-xs font-medium text-slate-600">
        Kick off <span className="font-normal text-slate-400">— applied to each fixture as you add it</span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {TIME_SHORTCUTS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setDefaultTime(t)}
            className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
              defaultTime === t
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'border border-slate-300 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'
            }`}
          >
            {t}
          </button>
        ))}
        <input
          type="time"
          value={defaultTime}
          onChange={(e) => setDefaultTime(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
        />
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <label className="mb-1 block text-xs font-medium text-slate-600">
          Label <span className="font-normal text-slate-400">— what an organiser sees when choosing a start date</span>
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            setLabelTouched(true);
          }}
          placeholder="Sat 29 Aug"
          maxLength={60}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
        />
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-3 border-t border-slate-100 pt-4">
        <input
          type="checkbox"
          checked={opensGameweek}
          onChange={(e) => setOpensGameweek(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-indigo-600"
        />
        <span className="text-sm text-slate-700">
          This block starts a new gameweek
          <span className="mt-0.5 block text-xs text-slate-500">
            Untick for the later slices of a gameweek you have already started pushing. Only a
            block that starts one can be a competition&apos;s first round.
          </span>
        </span>
      </label>

      {/* Team picker and the block being built */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">{teamList.name}</h3>
            <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
              pick {nextSlot.side}
            </span>
          </div>
          <p className="mb-3 text-xs text-slate-500">Click teams in turn — home, then away.</p>
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

        <div className="order-1 lg:order-2">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Fixtures</h3>
            <span className="text-xs text-slate-500">
              {complete.length} fixture{complete.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="max-h-[420px] space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
            {fixtures.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-slate-400">
                Nothing yet. Pick a date, then click teams.
              </p>
            )}
            {fixtures.map((fixture, index) => {
              const home = teamList.teams.find((t) => t.short_name === fixture.home_team_short);
              const away = teamList.teams.find((t) => t.short_name === fixture.away_team_short);
              const isNext = index === nextSlot.index;
              const done = fixture.home_team_short && fixture.away_team_short;

              return (
                <div
                  key={index}
                  className={`rounded-lg border bg-white px-3 py-2 ${done ? 'border-emerald-200' : 'border-slate-200'}`}
                >
                  <div className="flex items-center gap-2 text-sm">
                    <div className="flex flex-1 items-center justify-between">
                      <span className={isNext && nextSlot.side === 'home' ? 'font-medium text-indigo-600' : 'text-slate-800'}>
                        {home?.name || 'Home'}
                      </span>
                      <span className="mx-2 text-xs text-slate-400">v</span>
                      <span className={isNext && nextSlot.side === 'away' ? 'font-medium text-indigo-600' : 'text-slate-800'}>
                        {away?.name || 'Away'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFixtures((prev) => prev.filter((_, i) => i !== index))}
                      className="rounded p-0.5 text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                      title="Remove"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Per fixture, because a real block holds a 12:30 and a 15:00. The earliest
                      of these becomes the round's lock time. */}
                  <div className="mt-1.5 flex gap-1.5 border-t border-slate-100 pt-1.5">
                    <input
                      type="date"
                      value={fixture.date}
                      onChange={(e) =>
                        setFixtures((prev) =>
                          prev.map((f, i) => (i === index ? { ...f, date: e.target.value } : f))
                        )
                      }
                      className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-indigo-400"
                    />
                    <input
                      type="time"
                      value={fixture.time}
                      onChange={(e) =>
                        setFixtures((prev) =>
                          prev.map((f, i) => (i === index ? { ...f, time: e.target.value } : f))
                        )
                      }
                      className="w-24 rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-indigo-400"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        <button
          type="submit"
          disabled={submitting || complete.length === 0}
          className="flex-1 rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitting ? 'Saving...' : editing ? 'Save changes' : `Add block (${complete.length})`}
        </button>
        {editing && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-6 py-3 font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

// ======================================================================================
// One block in the list
// ======================================================================================

function BlockCard({
  block,
  pendingBatch,
  onEdit,
  onChanged,
  setNotice,
}: {
  block: FixtureBlock;
  pendingBatch: boolean;
  onEdit: () => void;
  onChanged: () => void;
  setNotice: (n: Notice) => void;
}) {
  const [busy, setBusy] = useState<'promote' | 'delete' | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const staged = block.staged_at !== null;
  const bound = block.competition_count > 0;
  const kickoffPassed = block.lock_time !== null && new Date(block.lock_time) <= new Date();

  const handlePromote = async () => {
    setBusy('promote');
    setNotice(null);
    try {
      const result = await adminApi.promoteFixtureBlock(block.id);
      if (result.return_code === 'SUCCESS') {
        setNotice({
          tone: 'success',
          text: `"${block.label}" is staged — ${result.fixtures_staged} fixtures. Push it to each competition on the Fixtures screen.`,
        });
        onChanged();
      } else if (result.return_code !== 'UNAUTHORIZED' && result.return_code !== 'TOKEN_EXPIRED') {
        setNotice({ tone: 'error', text: result.message || 'Could not stage that block.' });
      }
    } catch {
      setNotice({ tone: 'error', text: `Could not reach ${apiBaseUrl}.` });
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    setBusy('delete');
    setNotice(null);
    try {
      const result = await adminApi.deleteFixtureBlock(block.id);
      if (result.return_code === 'SUCCESS') {
        setNotice({ tone: 'success', text: `"${block.label}" deleted.` });
        setConfirmingDelete(false);
        onChanged();
      } else if (result.return_code !== 'UNAUTHORIZED' && result.return_code !== 'TOKEN_EXPIRED') {
        setNotice({ tone: 'error', text: result.message || 'Could not delete that block.' });
        setConfirmingDelete(false);
      }
    } catch {
      setNotice({ tone: 'error', text: `Could not reach ${apiBaseUrl}.` });
    } finally {
      setBusy(null);
    }
  };

  // Why the Stage button is not available, in the order the server would refuse.
  const promoteBlocker = staged
    ? 'Already staged'
    : block.fixtures.length === 0
      ? 'No fixtures in this block'
      : kickoffPassed
        ? 'First kick off has passed'
        : pendingBatch
          ? 'Another batch is staged — push and clear it first'
          : null;

  return (
    <div
      className={`rounded-xl border shadow-sm ${
        staged ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`truncate font-semibold ${staged ? 'text-slate-500' : 'text-slate-900'}`}>
              {block.label}
            </span>
            {staged && (
              <span className="shrink-0 rounded-md bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                staged
              </span>
            )}
            {!block.opens_gameweek && (
              <span className="shrink-0 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                continues gameweek
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {block.fixtures.length} fixture{block.fixtures.length === 1 ? '' : 's'}
            {block.lock_time && (
              <>
                <span className="mx-1.5 text-slate-300">·</span>
                locks {formatKickoff(block.lock_time)}
              </>
            )}
            {bound && (
              <>
                <span className="mx-1.5 text-slate-300">·</span>
                <span className="font-medium text-indigo-600">
                  {block.competition_count} competition{block.competition_count === 1 ? '' : 's'} start here
                </span>
              </>
            )}
          </p>
        </div>

        {!staged && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              title="Edit this block"
            >
              <PencilSquareIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={bound}
              title={bound ? 'Competitions have their first round on this block' : 'Delete this block'}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:text-slate-200 disabled:hover:bg-transparent"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handlePromote}
              disabled={promoteBlocker !== null || busy !== null}
              title={promoteBlocker ?? 'Copy into the staging table, ready to push'}
              className="ml-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              {busy === 'promote' ? 'Staging...' : 'Stage'}
            </button>
          </div>
        )}
      </div>

      {promoteBlocker && !staged && (
        <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500">{promoteBlocker}</p>
      )}

      <ul className="divide-y divide-slate-50">
        {block.fixtures.map((fixture) => (
          <li key={fixture.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
            <span className={staged ? 'text-slate-500' : 'text-slate-800'}>
              {fixture.home_team_name}
              <span className="mx-2 text-slate-400">v</span>
              {fixture.away_team_name}
            </span>
            <span className="shrink-0 text-xs text-slate-400">{formatKickoff(fixture.kickoff_time)}</span>
          </li>
        ))}
      </ul>

      {confirmingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Delete &quot;{block.label}&quot;?</h2>
            <p className="mt-1 text-sm text-slate-500">
              Its {block.fixtures.length} fixture{block.fixtures.length === 1 ? '' : 's'} go with it.
              Nothing has been sent to a competition, so this only removes what was keyed here.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setConfirmingDelete(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={busy !== null}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {busy === 'delete' ? 'Deleting...' : 'Delete'}
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

export default function FixtureCalendarPage() {
  const router = useRouter();

  const [teamLists, setTeamLists] = useState<FixtureTeamList[]>([]);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [blocks, setBlocks] = useState<FixtureBlock[]>([]);
  const [pendingBatch, setPendingBatch] = useState(false);
  const [editing, setEditing] = useState<FixtureBlock | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(true);

  const loadLists = useCallback(async () => {
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
      setNotice({ tone: 'error', text: `Could not reach ${apiBaseUrl}.` });
    }
  }, []);

  const loadBlocks = useCallback(async (listId: number) => {
    setLoading(true);
    try {
      const result = await adminApi.getFixtureBlocks(listId);
      if (result.return_code === 'SUCCESS') {
        setBlocks(result.blocks || []);
        setPendingBatch(result.pending_batch ?? false);
      } else if (result.return_code !== 'UNAUTHORIZED' && result.return_code !== 'TOKEN_EXPIRED') {
        setNotice({ tone: 'error', text: result.message || 'Could not load the calendar.' });
        setBlocks([]);
      }
    } catch {
      setNotice({ tone: 'error', text: `Could not reach ${apiBaseUrl}.` });
      setBlocks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    loadLists();
  }, [router, loadLists]);

  useEffect(() => {
    if (selectedListId !== null) loadBlocks(selectedListId);
  }, [selectedListId, loadBlocks]);

  const teamList = useMemo(
    () => teamLists.find((l) => l.id === selectedListId) ?? null,
    [teamLists, selectedListId]
  );

  const refresh = useCallback(() => {
    setEditing(null);
    setShowForm(false);
    if (selectedListId !== null) loadBlocks(selectedListId);
    // The pending-batch flag on the team list is stale once a block is staged.
    loadLists();
  }, [selectedListId, loadBlocks, loadLists]);

  const upcoming = blocks.filter((b) => b.staged_at === null);

  return (
    <div className="min-h-screen">
      <AdminHeader title="Fixture calendar" backHref="/dashboard/fixtures">
        <button
          onClick={() => selectedListId !== null && loadBlocks(selectedListId)}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </AdminHeader>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <NoticeBanner notice={notice} />

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {teamLists.length > 1 && (
              <select
                value={selectedListId ?? ''}
                onChange={(e) => {
                  setSelectedListId(Number(e.target.value));
                  setEditing(null);
                  setShowForm(false);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
              >
                {teamLists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-slate-500">
              {upcoming.length} block{upcoming.length === 1 ? '' : 's'} waiting
            </p>
          </div>

          {teamList && !showForm && !editing && (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
            >
              Add a block
            </button>
          )}
        </div>

        {pendingBatch && (
          <div className="mb-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              A batch is already staged for this list. Push it to every competition and clear it on
              the Fixtures screen before staging another — only one can be out at a time.
            </span>
          </div>
        )}

        {teamList && (showForm || editing) && (
          <div className="mb-6">
            <BlockForm
              teamList={teamList}
              editing={editing}
              onSaved={refresh}
              onCancel={() => {
                setEditing(null);
                setShowForm(false);
              }}
              setNotice={setNotice}
            />
          </div>
        )}

        {loading && blocks.length === 0 ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : blocks.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-10 text-center">
            <CalendarDaysIcon className="mx-auto h-8 w-8 text-slate-400" />
            <h2 className="mt-2 font-semibold text-slate-700">Nothing in the calendar</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              Key the next two or three gameweeks here. A new competition picks its start date from
              these, so an empty calendar means new organisers have nothing to start on.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {blocks.map((block) => (
              <BlockCard
                key={block.id}
                block={block}
                pendingBatch={pendingBatch}
                onEdit={() => {
                  setEditing(block);
                  setShowForm(false);
                  setNotice(null);
                }}
                onChanged={refresh}
                setNotice={setNotice}
              />
            ))}
          </div>
        )}

        {!loading && teamLists.length === 0 && (
          <p className="text-sm text-slate-500">
            No active team list, so there is nothing to key fixtures against.
          </p>
        )}
      </main>
    </div>
  );
}
