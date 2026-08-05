'use client';

/*
=======================================================================================================================================
Admin Bots
=======================================================================================================================================
Purpose: Put bots into a competition so it is not empty when a real player joins, and keep them
         picking each round.

Replaces driving /bot-join and /bot-pick by hand with curl. Those were public routes guarded
only by the string BOT_MAGIC_2025, which was committed in the repo.

Bots only appear here for competitions run by an approved organiser (BOT_ORGANISER_IDS in
services/botPool.js). That restriction is about money, not tidiness: competition_user rows are
counted against the organiser's free player allowance with no exclusion for bots, so seeding a
customer's competition would spend their credits and could turn real players away at the join
screen. The selector only ever offers competitions where that bill lands on us.
=======================================================================================================================================
*/

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowPathIcon,
  PlusIcon,
  SparklesIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import AdminHeader from '@/components/AdminHeader';
import {
  adminApi,
  getToken,
  apiBaseUrl,
  Bot,
  BotCompetition,
  BotCompetitionDetail,
  BotMembership,
} from '@/lib/api';

// Feedback banner under the header. Kept as data rather than a formatted string so the tone
// drives the styling - same shape as the fixtures screen.
type Notice = { tone: 'success' | 'info' | 'error'; text: string } | null;

const NOTICE_STYLES: Record<'success' | 'info' | 'error', string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  info: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  error: 'border-red-200 bg-red-50 text-red-700',
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  out: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_BADGE[status.toLowerCase()] || STATUS_BADGE.out;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {status}
    </span>
  );
}

/*
Number input plus a button, used for "add N bots" and "make N picks".

Both actions are a count against a known maximum, and both want the maximum to be the default -
the common case is "fill it up". Sharing one control keeps them from drifting apart.
*/
function CountAction({
  label,
  icon,
  max,
  busy,
  disabled,
  disabledReason,
  onRun,
}: {
  label: string;
  icon: React.ReactNode;
  max: number;
  busy: boolean;
  disabled: boolean;
  disabledReason?: string;
  onRun: (count: number) => void;
}) {
  const [count, setCount] = useState(max);

  // Follow the maximum as it moves - adding five bots should leave the box offering the rest,
  // not a number that is now too big.
  useEffect(() => {
    setCount(max);
  }, [max]);

  const clamped = Math.max(1, Math.min(count || 1, max));
  const off = disabled || busy || max < 1;

  return (
    <div className="flex items-center gap-1.5" title={disabled ? disabledReason : undefined}>
      <input
        type="number"
        min={1}
        max={max}
        value={count}
        disabled={off}
        onChange={(e) => setCount(parseInt(e.target.value, 10) || 0)}
        className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-sm tabular-nums outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:bg-slate-50 disabled:text-slate-400"
        aria-label={label}
      />
      <button
        onClick={() => onRun(clamped)}
        disabled={off}
        className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {icon}
        {busy ? 'Working...' : label}
      </button>
    </div>
  );
}

/*
The pick control for one bot.

Offers exactly what the player pick screen would offer that bot: the round's teams that are in
its allowed_teams. Anything not available is kept in the list but disabled with the reason on
hover - removing it entirely would leave an admin wondering why a team they can see in the
fixtures is missing from the dropdown.

The server applies the same two checks on the way in (TEAM_NOT_ALLOWED, TEAM_ALREADY_USED), so
this is a convenience, not the guard.
*/
function PickSelect({
  member,
  detail,
  busy,
  onPick,
}: {
  member: BotMembership;
  detail: BotCompetitionDetail;
  busy: boolean;
  onPick: (member: BotMembership, team: string | null) => void;
}) {
  const available = useMemo(() => new Set(member.available_teams), [member.available_teams]);
  const used = useMemo(() => new Set(member.used_teams), [member.used_teams]);

  const teams = useMemo(() => {
    const list: { short: string; name: string }[] = [];
    detail.fixtures.forEach((f) => {
      list.push({ short: f.home_team_short, name: f.home_team_name });
      list.push({ short: f.away_team_short, name: f.away_team_name });
    });
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [detail.fixtures]);

  const locked = detail.is_locked;
  const eliminated = member.status.toLowerCase() !== 'active';
  const off = busy || locked || eliminated;

  return (
    <select
      value={member.pick_team || ''}
      disabled={off}
      onChange={(e) => onPick(member, e.target.value || null)}
      title={
        locked
          ? 'Round has locked'
          : eliminated
            ? 'Bot is out of this competition'
            : undefined
      }
      className="w-44 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:bg-slate-50 disabled:text-slate-400"
    >
      <option value="">No pick</option>
      {teams.map((team) => {
        const isUsed = detail.no_team_twice && used.has(team.short);
        // The team it is currently on is out of allowed_teams by definition - keep it
        // selectable so the dropdown can show what the bot actually picked.
        const isCurrent = team.short === member.pick_team;
        const off = !isCurrent && (isUsed || !available.has(team.short));

        return (
          <option
            key={team.short}
            value={team.short}
            disabled={off}
            title={off ? (isUsed ? 'Already used in an earlier round' : 'Not available to this bot') : undefined}
          >
            {team.name}
            {off ? (isUsed ? ' (used)' : ' (unavailable)') : ''}
          </option>
        );
      })}
    </select>
  );
}

function RemoveBotModal({
  member,
  competitionName,
  onCancel,
  onConfirm,
  busy,
}: {
  member: BotMembership;
  competitionName: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Remove {member.display_name}?</h2>
        <p className="mt-1 text-sm text-slate-500">
          Takes {member.display_name} out of <strong>{competitionName}</strong> and deletes its
          picks and round history there. The bot account stays in the pool and is unaffected in
          any other competition.
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? 'Removing...' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BotsScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const competitionParam = searchParams.get('competition');

  const [bots, setBots] = useState<Bot[]>([]);
  const [competitions, setCompetitions] = useState<BotCompetition[]>([]);
  const [detail, setDetail] = useState<BotCompetitionDetail | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(
    competitionParam ? parseInt(competitionParam, 10) : null
  );

  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [adding, setAdding] = useState(false);
  const [picking, setPicking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pickingFor, setPickingFor] = useState<number | null>(null);
  const [removeTarget, setRemoveTarget] = useState<BotMembership | null>(null);
  const [removing, setRemoving] = useState(false);
  const [poolOpen, setPoolOpen] = useState(false);

  const load = useCallback(async (competitionId: number | null) => {
    setLoading(true);
    try {
      const result = await adminApi.getBots(competitionId ?? undefined);
      if (result.return_code === 'SUCCESS') {
        setBots(result.bots || []);
        setCompetitions(result.competitions || []);
        setDetail(result.detail || null);
      } else if (result.return_code !== 'UNAUTHORIZED' && result.return_code !== 'TOKEN_EXPIRED') {
        setNotice({ tone: 'error', text: result.message || 'Could not load bots' });
      }
    } catch {
      setNotice({ tone: 'error', text: `Could not reach ${apiBaseUrl}.` });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    load(selectedId);
  }, [router, load, selectedId]);

  const selectCompetition = (id: number | null) => {
    setSelectedId(id);
    setDetail(null);
    router.replace(id ? `/dashboard/bots?competition=${id}` : '/dashboard/bots');
  };

  const selected = useMemo(
    () => competitions.find((c) => c.id === selectedId) || null,
    [competitions, selectedId]
  );

  // Pool members not already in this competition - the ceiling on "add bots".
  const availableToAdd = useMemo(() => {
    if (!detail) return 0;
    const inCompetition = new Set(detail.members.map((m) => m.user_id));
    return bots.filter((b) => !inCompetition.has(b.id)).length;
  }, [bots, detail]);

  const withoutPick = useMemo(
    () =>
      detail
        ? detail.members.filter((m) => !m.pick_team && m.status.toLowerCase() === 'active').length
        : 0,
    [detail]
  );

  const handleAddBots = async (count: number) => {
    if (!selectedId) return;
    setAdding(true);
    setNotice(null);
    try {
      const result = await adminApi.addBotsToCompetition(selectedId, count);
      if (result.return_code === 'SUCCESS') {
        setNotice({
          tone: 'success',
          text: `${result.bots_added} bot${result.bots_added === 1 ? '' : 's'} added${
            result.bots_available ? ` · ${result.bots_available} still free` : ''
          }`,
        });
        await load(selectedId);
      } else {
        setNotice({ tone: 'error', text: result.message || 'Could not add bots' });
      }
    } catch {
      setNotice({ tone: 'error', text: `Could not reach ${apiBaseUrl}.` });
    } finally {
      setAdding(false);
    }
  };

  const handleMakePicks = async (count: number) => {
    if (!selectedId) return;
    setPicking(true);
    setNotice(null);
    try {
      const result = await adminApi.setBotPicks(selectedId, count);
      if (result.return_code === 'SUCCESS') {
        // skipped_no_teams is expected on a long competition with no-team-twice on, so it is
        // reported rather than hidden - it explains a lower number than was asked for.
        const skipped = result.skipped_no_teams || 0;
        setNotice({
          tone: skipped > 0 ? 'info' : 'success',
          text:
            `${result.picks_made} pick${result.picks_made === 1 ? '' : 's'} made` +
            (skipped > 0 ? ` · ${skipped} had no team left to pick` : ''),
        });
        await load(selectedId);
      } else {
        setNotice({ tone: 'error', text: result.message || 'Could not make picks' });
      }
    } catch {
      setNotice({ tone: 'error', text: `Could not reach ${apiBaseUrl}.` });
    } finally {
      setPicking(false);
    }
  };

  const handlePick = async (member: BotMembership, team: string | null) => {
    if (!selectedId || !detail) return;
    setPickingFor(member.user_id);
    setNotice(null);

    // Show it immediately and put it back if the server disagrees - this is a cell in a table,
    // so there is nothing else to unwind.
    const previous = member.pick_team;
    setDetail({
      ...detail,
      members: detail.members.map((m) =>
        m.user_id === member.user_id ? { ...m, pick_team: team } : m
      ),
    });

    try {
      const result = await adminApi.setBotPick(selectedId, member.user_id, team);
      if (result.return_code !== 'SUCCESS') {
        setDetail((current) =>
          current
            ? {
                ...current,
                members: current.members.map((m) =>
                  m.user_id === member.user_id ? { ...m, pick_team: previous } : m
                ),
              }
            : current
        );
        setNotice({ tone: 'error', text: result.message || 'Could not set that pick' });
      }
    } catch {
      setDetail((current) =>
        current
          ? {
              ...current,
              members: current.members.map((m) =>
                m.user_id === member.user_id ? { ...m, pick_team: previous } : m
              ),
            }
          : current
      );
      setNotice({ tone: 'error', text: `Could not reach ${apiBaseUrl}.` });
    } finally {
      setPickingFor(null);
    }
  };

  const handleRemove = async () => {
    if (!selectedId || !removeTarget) return;
    setRemoving(true);
    try {
      const result = await adminApi.removeBotFromCompetition(selectedId, removeTarget.user_id);
      if (result.return_code === 'SUCCESS') {
        setNotice({ tone: 'success', text: result.message || 'Bot removed' });
        setRemoveTarget(null);
        await load(selectedId);
      } else {
        setNotice({ tone: 'error', text: result.message || 'Could not remove that bot' });
      }
    } catch {
      setNotice({ tone: 'error', text: `Could not reach ${apiBaseUrl}.` });
    } finally {
      setRemoving(false);
    }
  };

  const handleCreateBots = async (count: number) => {
    setCreating(true);
    setNotice(null);
    try {
      const result = await adminApi.createBots(count);
      if (result.return_code === 'SUCCESS') {
        setNotice({
          tone: 'success',
          text: `${result.bots_created} bot${result.bots_created === 1 ? '' : 's'} created · pool is now ${result.pool_size}`,
        });
        await load(selectedId);
      } else {
        setNotice({ tone: 'error', text: result.message || 'Could not create bots' });
      }
    } catch {
      setNotice({ tone: 'error', text: `Could not reach ${apiBaseUrl}.` });
    } finally {
      setCreating(false);
    }
  };

  const addDisabledReason = !selected
    ? 'Choose a competition first'
    : !selected.can_add_bots
      ? 'Competition has started - bots can only join before round 1 locks, same as players'
      : availableToAdd < 1
        ? 'Every bot in the pool is already in this competition'
        : undefined;

  const pickDisabledReason = !detail
    ? 'Choose a competition first'
    : detail.round_id === null
      ? 'Competition has no rounds yet'
      : detail.fixtures.length === 0
        ? 'Round has no fixtures yet'
        : detail.is_locked
          ? 'Round has locked'
          : withoutPick < 1
            ? 'Every bot has already picked'
            : undefined;

  return (
    <div className="min-h-screen">
      <AdminHeader title="Bots" backHref="/dashboard">
        <button
          onClick={() => load(selectedId)}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </AdminHeader>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {notice && (
          <div className={`mb-6 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${NOTICE_STYLES[notice.tone]}`}>
            <span>{notice.text}</span>
            <button onClick={() => setNotice(null)} aria-label="Dismiss">
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="mb-6">
          <label htmlFor="competition" className="block text-sm font-medium text-slate-700">
            Competition
          </label>
          <select
            id="competition"
            value={selectedId ?? ''}
            onChange={(e) => selectCompetition(e.target.value ? parseInt(e.target.value, 10) : null)}
            className="mt-1.5 w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
          >
            <option value="">Choose a competition...</option>
            {competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.status.toLowerCase()} · {c.bot_count} bot
                {c.bot_count === 1 ? '' : 's'} of {c.player_count} player
                {c.player_count === 1 ? '' : 's'}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-slate-500">
            Only competitions run by an approved organiser appear here. Bots take up paid player
            places, so they are kept off customer competitions.
          </p>
        </div>

        {loading && competitions.length === 0 && (
          <p className="text-sm text-slate-500">Loading...</p>
        )}

        {selected && detail && (
          <div className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <h2 className="font-semibold text-slate-900">{selected.name}</h2>
                <p className="text-xs text-slate-500">
                  {detail.round_number !== null
                    ? `Round ${detail.round_number}`
                    : 'No rounds yet'}
                  {detail.lock_time && (
                    <>
                      {' · '}
                      {detail.is_locked ? 'locked' : 'locks'} {formatDateTime(detail.lock_time)}
                    </>
                  )}
                  {' · '}
                  {detail.members.length} bot{detail.members.length === 1 ? '' : 's'} of{' '}
                  {selected.player_count} player{selected.player_count === 1 ? '' : 's'}
                  {detail.no_team_twice && ' · no team twice'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <CountAction
                  label="Add bots"
                  icon={<PlusIcon className="h-4 w-4" />}
                  max={availableToAdd}
                  busy={adding}
                  disabled={!!addDisabledReason}
                  disabledReason={addDisabledReason}
                  onRun={handleAddBots}
                />
                <CountAction
                  label="Make picks"
                  icon={<SparklesIcon className="h-4 w-4" />}
                  max={withoutPick}
                  busy={picking}
                  disabled={!!pickDisabledReason}
                  disabledReason={pickDisabledReason}
                  onRun={handleMakePicks}
                />
              </div>
            </div>

            {addDisabledReason && selected.can_add_bots === false && (
              <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
                {addDisabledReason}
              </p>
            )}

            {detail.members.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                No bots in this competition yet.
              </p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 font-semibold">Bot</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Lives</th>
                    <th className="px-4 py-3 font-semibold">Pick this round</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detail.members.map((member) => (
                    <tr key={member.user_id} className="transition hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {member.display_name}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={member.status} />
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">
                        {member.lives_remaining ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {detail.fixtures.length === 0 ? (
                          <span className="text-slate-400">No fixtures</span>
                        ) : (
                          <PickSelect
                            member={member}
                            detail={detail}
                            busy={pickingFor === member.user_id}
                            onPick={handlePick}
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <button
                            onClick={() => setRemoveTarget(member)}
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                            title={`Remove ${member.display_name} from this competition`}
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* The pool changes rarely, so it stays out of the way until asked for. */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <button
              onClick={() => setPoolOpen((open) => !open)}
              className="flex items-center gap-1.5 font-semibold text-slate-900"
            >
              {poolOpen ? (
                <ChevronUpIcon className="h-4 w-4" />
              ) : (
                <ChevronDownIcon className="h-4 w-4" />
              )}
              Bot pool — {bots.length} bot{bots.length === 1 ? '' : 's'}
            </button>

            <CountAction
              label="Create bots"
              icon={<PlusIcon className="h-4 w-4" />}
              max={20}
              busy={creating}
              disabled={false}
              onRun={handleCreateBots}
            />
          </div>

          {poolOpen && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Bot</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">In competitions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bots.map((bot) => (
                  <tr key={bot.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{bot.display_name}</td>
                    <td className="px-4 py-3 text-slate-500">{bot.email}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{bot.competitions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {removeTarget && selected && (
        <RemoveBotModal
          member={removeTarget}
          competitionName={selected.name}
          busy={removing}
          onCancel={() => setRemoveTarget(null)}
          onConfirm={handleRemove}
        />
      )}
    </div>
  );
}

export default function BotsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <BotsScreen />
    </Suspense>
  );
}
