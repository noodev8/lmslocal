'use client';

/*
The home screen of a Matchday competition (docs/matchday.md §8). /game/[id] renders this instead
of the Last Man Standing dashboard the moment it knows the game - one branch, at the top, so
neither screen carries the other game's conditions.

What it answers, in order: which game this is; what to do now (the coupon, while a round is
open); where you stand; how the table looks; and, for the organiser, the same tools as LMS minus
the ones that have no meaning here (no lives, no guest picks, no round to run - the matches and
results are ours).
*/

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeftIcon, ChevronRightIcon, UserGroupIcon, MegaphoneIcon, Cog6ToothIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { Competition, MatchdayCoupon, MatchdayTable, matchdayApi } from '@/lib/api';
import { LABEL, EYEBROW, HEADING, PANEL, BTN_PRIMARY, BTN_OUTLINE } from '@/lib/design';
import { GAME_NAMES, MATCHDAY_SCORING, endingLabel, ordinal, formatKickoff, signedPoints } from '@/lib/games';
import InviteBlock from '@/components/InviteBlock';
import { useToast, ToastContainer } from '@/components/Toast';

// How much of the table the home screen shows. Enough to see the race; the rest is a tap away.
const TABLE_PREVIEW_ROWS = 5;

export default function MatchdayHome({ competition }: { competition: Competition }) {
  const competitionId = competition.id;
  const [coupon, setCoupon] = useState<MatchdayCoupon | null>(null);
  const [table, setTable] = useState<MatchdayTable | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const { toasts, showToast, removeToast } = useToast();

  const isOrganiser = competition.is_organiser;
  const canManagePlayers = isOrganiser || competition.manage_players === true;
  const canManagePromote = isOrganiser || competition.manage_promote === true;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [couponRes, tableRes] = await Promise.all([
          matchdayApi.getPredictions(competitionId),
          matchdayApi.getTable(competitionId),
        ]);
        if (cancelled) return;
        if (couponRes.data.return_code === 'SUCCESS') setCoupon(couponRes.data);
        if (tableRes.data.return_code === 'SUCCESS') setTable(tableRes.data);
        if (couponRes.data.return_code !== 'SUCCESS' || tableRes.data.return_code !== 'SUCCESS') setLoadFailed(true);
      } catch {
        if (!cancelled) setLoadFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [competitionId]);

  const ready = loadFailed || (coupon !== null && table !== null);
  const isComplete = String(competition.status ?? '').toUpperCase() === 'COMPLETE';
  const round = coupon?.round ?? null;
  const roundOpen = round !== null && !round.locked;
  const isPlayer = coupon?.is_player ?? competition.is_participant === true;
  const me = table?.table.find(row => row.is_me) ?? null;
  const firstPlace = table?.table.filter(row => row.position === 1) ?? [];
  const resultsIn = coupon?.fixtures.filter(f => f.settled).length ?? 0;
  const roundPoints = coupon?.fixtures.reduce((sum, f) => sum + (f.my_points ?? 0), 0) ?? 0;
  const ending = endingLabel(competition.end_rule, competition.end_value);

  return (
    <div className="min-h-screen bg-stock font-body text-ink">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <header className="border-b border-ink/30">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/dashboard" className={`${LABEL} flex items-center gap-1.5 text-ink-fade transition-colors hover:text-ink`}>
            <ArrowLeftIcon className="h-4 w-4" />
            Dashboard
          </Link>
          {isOrganiser && <span className={`${LABEL} text-ink-fade`}>Organiser</span>}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6 sm:py-10">

        {/* Masthead. The game is the eyebrow, and its scoring is stated on the screen itself, so a
            player who only ever sees this page still knows the rules. */}
        <div className={`${PANEL} p-6 sm:p-8`}>
          <div className={`flex items-center gap-5 ${competition.logo_url ? '' : 'justify-center text-center'}`}>
            {competition.logo_url && (
              <Image
                src={competition.logo_url}
                alt={`${competition.name} logo`}
                width={84}
                height={84}
                className="flex-shrink-0 border border-ink/30"
                unoptimized
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            )}
            <div>
              <p className={EYEBROW}>{GAME_NAMES.matchday}</p>
              <h1 className={`${HEADING} mt-1 text-2xl sm:text-3xl`}>{competition.name}</h1>
              {competition.personal_name && (
                <p className="mt-1 font-data text-[15px] italic text-ink-fade">{competition.personal_name}</p>
              )}
              {competition.venue_name && <p className="mt-1 text-[15px] text-ink-fade">{competition.venue_name}</p>}
            </div>
          </div>
          <p className={`${LABEL} mt-5 border-t border-ink/30 pt-4 text-center text-ink`}>
            {MATCHDAY_SCORING}
            {ending && <span className="text-ink-fade"> &middot; {ending}</span>}
          </p>
        </div>

        {loadFailed && (
          <p className="border-l-2 border-overprint bg-stock-lit px-4 py-3 text-[15px] text-ink">
            Part of this screen didn&apos;t load. Refresh the page to try again.
          </p>
        )}

        {/* Everything below the masthead waits for both requests. Drawn as each arrived, the invite
            block and its QR code painted first - joining looks open until the round is known - and
            then jumped down the page as the round and the table landed above it. */}
        {!ready ? (
          <div className={`${PANEL} p-8 text-center`}>
            <div className="mb-4 inline-flex h-8 w-8 animate-spin items-center justify-center rounded-full border-2 border-ink border-t-transparent" />
            <p className={EYEBROW}>Loading</p>
          </div>
        ) : (
        <>
        {/* The result, once there is one. A field, so moss-wash with ink on top (design-system §8). */}
        {isComplete && table && (
          <div className="border border-ink/30 bg-moss-wash p-6 text-center">
            <p className={EYEBROW}>{firstPlace.length > 1 ? 'Shared win' : 'Winner'}</p>
            <p className="mt-2 font-data text-2xl text-ink">
              {firstPlace.map(row => row.display_name).join(' and ') || '—'}
            </p>
            {firstPlace[0] && (
              <p className={`${LABEL} mt-1 text-ink`}>{firstPlace[0].total} points</p>
            )}
            {me && !firstPlace.some(row => row.is_me) && (
              <p className="mt-3 text-[15px] text-ink">You finished {ordinal(me.position)} on {me.total} points.</p>
            )}
            <Link href={`/game/${competitionId}/table`} className={`${BTN_OUTLINE} mt-4 inline-block`}>
              Final table
            </Link>
          </div>
        )}

        {/* This round: the one thing a player can act on, so it comes before the standings. */}
        {!isComplete && coupon && (
          round === null ? (
            <div className={`${PANEL} p-6 text-center`}>
              <p className={EYEBROW}>Round 1</p>
              <p className="mt-2 text-[17px] text-ink">Waiting for the first round&apos;s matches.</p>
              <p className="mt-1 text-[15px] text-ink-fade">
                We add them for you &mdash; they&apos;ll appear here, and everyone can make their predictions.
              </p>
            </div>
          ) : roundOpen ? (
            <div className={`${PANEL} p-6 text-center`}>
              <p className={EYEBROW}>Round {round.round_number}</p>
              {isPlayer ? (
                <>
                  <p className="mt-2 font-display text-6xl text-overprint">
                    {coupon.predicted}<span className="text-ink/40">/{coupon.total_fixtures}</span>
                  </p>
                  <p className={`${LABEL} mt-1 text-ink-fade`}>Matches predicted</p>
                  <p className="mt-3 text-[15px] text-ink-fade">
                    Locks {formatKickoff(round.lock_time)}. Change any of them until then.
                  </p>
                  {/* Red only while nothing is predicted, the same rule as the dashboard card: the
                      screen's one red action means "this is on you". A player who has predicted
                      some and skipped the rest has made their predictions - skipping is allowed. */}
                  <Link
                    href={`/game/${competitionId}/coupon`}
                    className={`mt-5 inline-block ${
                      coupon.predicted === 0 ? `${BTN_PRIMARY} px-6 py-3 text-base` : BTN_OUTLINE
                    }`}
                  >
                    {coupon.predicted === 0 ? 'Make your predictions' : 'Your predictions'}
                  </Link>
                </>
              ) : (
                <>
                  <p className="mt-2 text-[17px] text-ink">{coupon.total_fixtures} matches this round.</p>
                  <p className="mt-1 text-[15px] text-ink-fade">
                    Players can predict until {formatKickoff(round.lock_time)}.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className={`${PANEL} p-6 text-center`}>
              <p className={EYEBROW}>Round {round.round_number}</p>
              <p className="mt-2 text-[17px] text-ink">
                {resultsIn === 0
                  ? 'Predictions locked. Matches in play.'
                  : resultsIn < coupon.total_fixtures
                    ? `Results coming in: ${resultsIn} of ${coupon.total_fixtures}.`
                    : 'All results in.'}
              </p>
              {isPlayer && (
                <>
                  <p className="mt-1 text-[15px] text-ink-fade">
                    You predicted {coupon.predicted} of {coupon.total_fixtures}
                    {resultsIn > 0 && <> &middot; <span className="font-data text-ink">{signedPoints(roundPoints)}</span> this round so far</>}
                  </p>
                  <Link href={`/game/${competitionId}/coupon`} className={`${BTN_OUTLINE} mt-4 inline-block`}>
                    Your predictions
                  </Link>
                </>
              )}
            </div>
          )
        )}

        {/* Where you stand. A stat block, as the LMS "Still in" count is. */}
        {!isComplete && me && (
          <Link
            href={`/game/${competitionId}/table`}
            className={`${PANEL} flex items-center justify-between gap-4 p-4 transition-colors hover:border-ink`}
          >
            <div>
              <p className={`${LABEL} text-ink-fade`}>Your position</p>
              <p className="mt-1 font-display text-3xl uppercase text-ink">
                {ordinal(me.position)} <span className="text-ink-fade">of {table?.table.length}</span>
                <span className="mx-2 text-ink/30">&middot;</span>
                {me.total} pts
              </p>
              {me.provisional && <p className="mt-0.5 text-[13px] text-ink-fade">Includes this round so far</p>}
            </div>
            <span className={`${LABEL} flex flex-none items-center gap-1 text-ink-fade`}>
              The table
              <ChevronRightIcon className="h-4 w-4" />
            </span>
          </Link>
        )}

        {/* The top of the table: dotted leaders, names in the typewriter face - the survival
            sheet's pattern, which design-system §8 makes the model for standings. */}
        {table && table.table.length > 0 && !isComplete && (
          <div className={`${PANEL} p-4 sm:p-5`}>
            <div className="mb-2 flex items-baseline justify-between">
              <p className={`${LABEL} text-ink-fade`}>The table</p>
              {competition.end_rule === 'rounds' && competition.end_value ? (
                <p className={`${LABEL} text-ink-fade`}>
                  {table.rounds_settled} of {competition.end_value} rounds played
                </p>
              ) : competition.end_value ? (
                <p className={`${LABEL} text-ink-fade`}>First to {competition.end_value}</p>
              ) : null}
            </div>
            <ol>
              {table.table.slice(0, TABLE_PREVIEW_ROWS).map(row => (
                <li key={row.user_id} className="flex items-baseline gap-3 py-1.5">
                  <span className="w-6 flex-none text-right font-data text-[15px] text-ink-fade">{row.position}</span>
                  <span className={`font-data text-[16px] ${row.is_me ? 'font-bold text-ink' : 'text-ink'}`}>
                    {row.display_name}{row.is_me && <span className="sr-only"> (you)</span>}
                  </span>
                  <span className="flex-1 translate-y-[-3px] border-b border-dotted border-ink/30" />
                  <span className="font-data text-[16px] text-ink">{row.total}{row.provisional ? '*' : ''}</span>
                </li>
              ))}
            </ol>
            <Link
              href={`/game/${competitionId}/table`}
              className={`${LABEL} mt-3 inline-flex items-center gap-1 text-ink underline decoration-dotted underline-offset-[6px]`}
            >
              Full table
            </Link>
          </div>
        )}

        <InviteBlock
          competitionName={competition.name}
          inviteCode={competition.invite_code}
          isOrganiser={isOrganiser}
          currentRound={round?.round_number}
          lockTime={round?.lock_time}
          entryFee={competition.entry_fee}
          prizeStructure={competition.prize_structure}
          onToast={showToast}
        />

        {/* The organiser's tools. No Round tile: the matches and results are ours, so there is
            nothing for them to run. The table is in its own tile for everyone. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link href={`/game/${competitionId}/table`} className={`${PANEL} flex flex-col items-center justify-center gap-2 p-5 transition-colors hover:border-ink`}>
            <TrophyIcon className="h-6 w-6 text-ink" />
            <span className={`${LABEL} text-ink`}>Table</span>
          </Link>
          {canManagePlayers && (
            <Link href={`/game/${competitionId}/players`} className={`${PANEL} flex flex-col items-center justify-center gap-2 p-5 transition-colors hover:border-ink`}>
              <UserGroupIcon className="h-6 w-6 text-ink" />
              <span className={`${LABEL} text-ink`}>Players</span>
            </Link>
          )}
          {canManagePromote && (
            <Link href={`/game/${competitionId}/promote`} className={`${PANEL} flex flex-col items-center justify-center gap-2 p-5 transition-colors hover:border-ink`}>
              <MegaphoneIcon className="h-6 w-6 text-ink" />
              <span className={`${LABEL} text-ink`}>Promote</span>
            </Link>
          )}
          {isOrganiser && (
            <Link href={`/game/${competitionId}/settings`} className={`${PANEL} flex flex-col items-center justify-center gap-2 p-5 transition-colors hover:border-ink`}>
              <Cog6ToothIcon className="h-6 w-6 text-ink" />
              <span className={`${LABEL} text-ink`}>Settings</span>
            </Link>
          )}
        </div>

        {/* The organiser's blurb, collapsed - the same reasoning as the LMS screen: it holds the
            entry fee and the prize, so it is never more than one tap away. */}
        {competition.description && (
          <div className={PANEL}>
            <button
              type="button"
              onClick={() => setDescriptionOpen(open => !open)}
              aria-expanded={descriptionOpen}
              className={`${LABEL} flex w-full items-center justify-between p-4 text-left text-ink-fade hover:text-ink`}
            >
              About this competition
              <ChevronRightIcon className={`h-4 w-4 transition-transform ${descriptionOpen ? 'rotate-90' : ''}`} />
            </button>
            {descriptionOpen && (
              <p className="whitespace-pre-line border-t border-ink/30 p-4 text-[15px] text-ink">{competition.description}</p>
            )}
          </div>
        )}
        </>
        )}
      </main>
    </div>
  );
}
