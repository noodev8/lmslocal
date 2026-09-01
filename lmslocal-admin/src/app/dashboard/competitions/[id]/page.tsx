'use client';

/*
=======================================================================================================================================
Admin Competition Stats
=======================================================================================================================================
Purpose: One competition, read only. The question it exists to answer is "how many picks are in
         for the round that is open, and who am I waiting on" - the list screen carries the
         fraction, this is the working behind it.

READ ONLY, deliberately. Admin can already set a pick (routes/admin-set-pick.js) and drive bots,
and putting either button next to a list of who has not picked turns a reporting screen into an
operational one - a different thing, with a different appetite for a misclick. Everything here
is a fact about the competition; nothing here changes it.

FETCHED ON ENTRY ONLY. The whole point of the drill-down is that the list screen does not have to
carry this, so it must not load until somebody asks for it. One call, one refresh button, no
polling - none of these numbers move while you are reading them.

The stats are the SERVER'S. current_round comes back already worked out
(lmslocal-server/services/pickProgress.js) and is shared with the list, so the fraction on the row
you clicked is the fraction at the top of this page. Never recompute either half here; that is
exactly how two screens start disagreeing.

Room below the round history for whatever the next question turns out to be. Adding a panel here
costs the list screen nothing, which is the reason this is a separate screen at all.
=======================================================================================================================================
*/

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import AdminHeader from '@/components/AdminHeader';
import {
  adminApi,
  getToken,
  CompetitionStatsResponse,
  CompetitionStatsPlayer,
  CompetitionStatsRound,
  CurrentRoundProgress,
} from '@/lib/api';
import { formatAge, formatDate, formatTime } from '@/lib/dates';

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  setup: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  complete: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

// Matches the list screen exactly - "Pending" reads as a state, "Setup" reads as an instruction.
const STATUS_LABEL: Record<string, string> = {
  active: 'active',
  setup: 'pending',
  complete: 'complete',
};

/*
How long until the round locks, in the words you would use out loud. Only ever shown for a round
that is still open; once it has locked, the answer is the date it happened and the countdown is
noise.
*/
function timeUntil(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'now';
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return `${Math.max(1, Math.round(ms / 60_000))} min`;
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)} days`;
}

function StatCard({
  label,
  value,
  hint,
  tone = 'plain',
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'plain' | 'good' | 'warn';
}) {
  const valueTone =
    tone === 'good' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : 'text-slate-900';
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${valueTone}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

/*
The headline panel: the fraction, and what it means right now.

The wording turns on is_locked, because the same two numbers mean opposite things either side of
the lock. Open, four outstanding is four people who still have time. Locked, it is four people
who missed it - and there is nothing to chase, only something to know.
*/
function CurrentRoundPanel({ round }: { round: CurrentRoundProgress }) {
  const { players_due, picks_made, picks_outstanding, bots_outstanding, real_outstanding } = round;
  const pct = players_due === 0 ? 0 : Math.round((picks_made / players_due) * 100);
  const allIn = picks_outstanding === 0;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Round {round.round_number}
        </h2>
        <div className="flex items-center gap-1.5 text-sm text-slate-500">
          {round.is_locked ? (
            <>
              <LockClosedIcon className="h-4 w-4 text-slate-400" />
              <span>
                Locked {formatDate(round.lock_time)} at {formatTime(round.lock_time)}
              </span>
            </>
          ) : (
            <>
              <ClockIcon className="h-4 w-4 text-slate-400" />
              <span>
                Locks in {timeUntil(round.lock_time)} — {formatDate(round.lock_time)} at{' '}
                {formatTime(round.lock_time)}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-1">
        <span className="text-4xl font-semibold tabular-nums text-slate-900">
          {picks_made}
          <span className="text-slate-300">/</span>
          {players_due}
        </span>
        <span className="pb-1 text-sm text-slate-500">picks in</span>
      </div>

      {/* The bar is the fraction again, for the glance rather than the read. */}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${allIn ? 'bg-emerald-500' : 'bg-indigo-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-3 text-sm">
        {allIn ? (
          <span className="inline-flex items-center gap-1.5 text-emerald-700">
            <CheckCircleIcon className="h-4 w-4" />
            Everyone still in has picked
          </span>
        ) : round.is_locked ? (
          <span className="inline-flex items-center gap-1.5 text-slate-600">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
            {picks_outstanding} never picked
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-slate-600">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
            {picks_outstanding} still to pick
            {/*
            Only worth saying when some of the outstanding are bots. Otherwise it is a
            parenthesis explaining that a number equals itself.
            */}
            {bots_outstanding > 0 && (
              <span className="text-slate-400">
                ({real_outstanding} {real_outstanding === 1 ? 'person' : 'people'}, {bots_outstanding}{' '}
                {bots_outstanding === 1 ? 'bot' : 'bots'})
              </span>
            )}
          </span>
        )}
      </div>
    </section>
  );
}

/*
Who has picked and who has not, for the current round.

Sorted with the people you are waiting on at the top, because that is the only reason to read
this list. Eliminated members sink to the bottom whatever they did - they owe nothing.
*/
function PlayerList({ players, isLocked }: { players: CompetitionStatsPlayer[]; isLocked: boolean }) {
  const rank = (p: CompetitionStatsPlayer) => {
    if (p.status !== 'active') return 3;
    return p.has_picked ? 2 : 1;
  };
  const sorted = [...players].sort(
    (a, b) => rank(a) - rank(b) || (a.name || '').localeCompare(b.name || '')
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3 font-semibold">Player</th>
            <th className="px-4 py-3 font-semibold">Pick</th>
            <th className="px-4 py-3 font-semibold">Made</th>
            <th className="px-4 py-3 font-semibold">Lives</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((p) => {
            const out = p.status !== 'active';
            return (
              <tr key={p.user_id} className={out ? 'text-slate-400' : ''}>
                <td className="px-4 py-3">
                  <div className={`font-medium ${out ? 'text-slate-400' : 'text-slate-900'}`}>
                    {p.name || '—'}
                    {p.is_organiser && (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-500">
                        organiser
                      </span>
                    )}
                    {p.is_bot && (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-500">
                        bot
                      </span>
                    )}
                    {out && (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-500">
                        out
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-normal text-slate-400">{p.email || '—'}</div>
                </td>
                <td className="px-4 py-3">
                  {p.has_picked ? (
                    <span className={out ? '' : 'text-slate-900'}>{p.picked_team}</span>
                  ) : out ? (
                    /* An eliminated player not picking is the expected state, not a gap. */
                    <span className="text-slate-300">—</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                      <ExclamationTriangleIcon className="h-4 w-4" />
                      {isLocked ? 'Never picked' : 'Waiting'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {p.picked_at ? (
                    <span title={`${formatDate(p.picked_at)} at ${formatTime(p.picked_at)}`}>
                      {formatAge(p.picked_at)}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-500">{p.lives_remaining}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/*
Round history. Newest first, matching the panel above it.

Wins, losses and no-shows are blank rather than zero on the round in progress: player_progress
rows only appear once a round is resulted, and three zeroes on a row would read as "everybody
drew" instead of "not played yet".
*/
function RoundHistory({ rounds }: { rounds: CompetitionStatsRound[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3 font-semibold">Round</th>
            <th className="px-4 py-3 font-semibold">Locks</th>
            <th className="px-4 py-3 font-semibold">Fixtures</th>
            <th className="px-4 py-3 font-semibold">Picks</th>
            <th className="px-4 py-3 font-semibold">Won</th>
            <th className="px-4 py-3 font-semibold">Lost</th>
            <th className="px-4 py-3 font-semibold" title="Resulted with no pick at all">
              No pick
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rounds.map((r) => {
            const resulted = r.players_in_at_round > 0;
            return (
              <tr key={r.round_id}>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {r.round_number}
                  {!r.is_locked && (
                    <span className="ml-2 rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-normal text-indigo-700">
                      open
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500" title={formatDate(r.lock_time)}>
                  {formatDate(r.lock_time)} {formatTime(r.lock_time)}
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-500">{r.fixture_count}</td>
                <td className="px-4 py-3 tabular-nums text-slate-600">{r.picks_made}</td>
                <td className="px-4 py-3 tabular-nums text-slate-500">
                  {resulted ? r.wins : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-500">
                  {resulted ? r.losses : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {!resulted ? (
                    <span className="text-slate-300">—</span>
                  ) : r.missed > 0 ? (
                    <span className="font-medium text-amber-700">{r.missed}</span>
                  ) : (
                    <span className="text-slate-500">0</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function CompetitionStatsPage({ params }: { params: Promise<{ id: string }> }) {
  // Next 15 hands route params through a promise; `use` unwraps it in the client component.
  const { id } = use(params);
  const competitionId = Number(id);
  const router = useRouter();

  const [data, setData] = useState<CompetitionStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminApi.getCompetitionStats(competitionId);
      if (response.return_code !== 'SUCCESS') {
        setError(response.message || 'Could not load this competition');
        setData(null);
      } else {
        setData(response);
      }
    } catch {
      setError('Could not reach the server');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [competitionId]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/');
      return;
    }
    if (!Number.isInteger(competitionId) || competitionId <= 0) {
      setError('That is not a competition id');
      setLoading(false);
      return;
    }
    load();
  }, [competitionId, load, router]);

  const competition = data?.competition;
  const currentRound = data?.current_round ?? null;
  const players = data?.players ?? [];
  const rounds = data?.rounds ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminHeader title={competition?.name || 'Competition'} backHref="/dashboard/competitions">
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </AdminHeader>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        {loading && !data && <p className="text-sm text-slate-500">Loading…</p>}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {competition && (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                  STATUS_BADGE[competition.status] || STATUS_BADGE.complete
                }`}
              >
                {STATUS_LABEL[competition.status] || competition.status}
              </span>
              <span className="font-mono text-xs text-slate-400">#{competition.id}</span>
              <span>{competition.organiser_name || 'No organiser'}</span>
              {competition.organiser_email && (
                <span className="text-slate-400">{competition.organiser_email}</span>
              )}
              <span className="text-slate-400">
                Created {formatDate(competition.created_at)}
              </span>
              {competition.team_list_name && (
                <span className="text-slate-400">{competition.team_list_name}</span>
              )}
            </div>

            {currentRound ? (
              <CurrentRoundPanel round={currentRound} />
            ) : (
              /*
              No round at all. Normal, not an error: every manual competition sits here until its
              organiser presses Ready, and there is nothing to count until then.
              */
              <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
                No rounds yet — nothing has been pushed to this competition.
              </section>
            )}

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard
                label="Players"
                value={competition.player_count}
                hint="every membership"
              />
              <StatCard
                label="Still in"
                value={competition.still_in_count}
                hint={`${competition.player_count - competition.still_in_count} eliminated`}
              />
              <StatCard
                label="Rounds"
                value={rounds.length}
                hint={rounds.length > 0 ? `${rounds.filter((r) => r.is_locked).length} locked` : undefined}
              />
              <StatCard
                label="Picks made"
                value={rounds.reduce((sum, r) => sum + r.picks_made, 0)}
                hint="all rounds"
              />
            </div>

            {players.length > 0 && (
              <section className="space-y-2">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  <UserGroupIcon className="h-4 w-4" />
                  {currentRound ? `Round ${currentRound.round_number} picks` : 'Players'}
                </h2>
                <PlayerList players={players} isLocked={currentRound?.is_locked ?? false} />
              </section>
            )}

            {rounds.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Round history
                </h2>
                <RoundHistory rounds={rounds} />
              </section>
            )}

            {data?.generated_at && (
              <p className="text-xs text-slate-400">
                Read at {formatTime(data.generated_at)}. Nothing on this screen refreshes on its
                own.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
