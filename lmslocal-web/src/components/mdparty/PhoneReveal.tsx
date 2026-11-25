'use client';

/*
  The reveal on a player's phone, one match at a time (docs/matchday-party.md §6).

  ONE THING TO LOOK AT: the match being revealed, which team this player predicted in it, the score,
  and how it is going for them - with their running total for the round underneath. The whole room
  watches the match itself on the TV; this only answers "and me?". No list, no other matches, no sound.
  One line underneath says where they stand in the players' league as it moves (2026-11-25).

  It runs on the room's one clock (lib/mdpartyReveal.ts), so it changes match when the TV does.
*/

import { LABEL } from '@/lib/design';
import type { PartyFixture, PartyPlayersRow } from '@/lib/api';
import {
  liveStandings, ordinal, pointsSoFar, provisionalPoints, revealedCount, scoreAt, useRevealPosition, type Crowd,
} from '@/lib/mdpartyReveal';

export default function PhoneReveal({
  fixtures,
  predictions,
  lockedAt,
  offsetMs,
  table,
  crowd,
  playerId,
}: {
  fixtures: PartyFixture[];
  /** fixture id -> predicted team id */
  predictions: Record<string, number>;
  lockedAt: string | null;
  offsetMs: number;
  table: PartyPlayersRow[];
  crowd: Crowd[] | null;
  playerId: number | undefined;
}) {
  const pos = useRevealPosition(lockedAt, offsetMs, fixtures.length);
  const total = pointsSoFar(fixtures, predictions, pos);
  const inPlay = pos.phase === 'play' || pos.phase === 'halftime';
  const now = fixtures[pos.index] ? scoreAt(fixtures[pos.index], pos.minute) : { home: 0, away: 0 };
  const standings = liveStandings(table, fixtures, crowd, revealedCount(pos, fixtures.length), inPlay ? { index: pos.index, score: now } : null);
  const standing = standings.find((r) => r.player_id === playerId);
  const isLive = inPlay && standings.some((r) => r.live > 0);
  const showMove = pos.phase === 'result' || pos.phase === 'intro' || pos.phase === 'done';
  const place = standing && table.length > 1 ? (
    <>
      You&apos;re <span className="font-data text-ink">{ordinal(standing.position)}</span>
      {isLive && <span> (live)</span>}
      {showMove && standing.move > 0 && <span className="text-moss"> ▲{standing.move}</span>}
      {showMove && standing.move < 0 && <span className="text-overprint"> ▼{-standing.move}</span>}
      {' · '}
    </>
  ) : null;

  if (pos.phase === 'countdown') {
    return (
      <div className="py-12 text-center">
        <p className={`${LABEL} text-ink-fade`}>Watch the TV</p>
        <p className="mt-3 font-display text-5xl uppercase">Kick-off in {pos.countdown}</p>
      </div>
    );
  }

  if (pos.phase === 'done') {
    return (
      <div className="py-12 text-center">
        <p className={`${LABEL} text-ink-fade`}>Your round</p>
        <p className="mt-2 font-data text-7xl">+{total}</p>
        {standing && table.length > 1 && (
          <p className="mt-4 text-[18px] text-ink-fade">You&apos;re <span className="font-data text-ink">{ordinal(standing.position)}</span> of {table.length}</p>
        )}
      </div>
    );
  }

  const match = fixtures[pos.index];
  const predicted = predictions[String(match.id)];
  const mine = predicted === undefined ? null : predicted === match.home.id ? match.home : match.away;
  const score = scoreAt(match, pos.minute);
  const showScore = pos.phase !== 'intro';
  const points = mine && showScore ? provisionalPoints(match, mine.id, score) : null;
  const atFullTime = pos.phase === 'result';

  const verdict = points === null
    ? ''
    : atFullTime
      ? (points === 3 ? 'Won' : points === 1 ? 'Drew' : 'Lost')
      : (points === 3 ? 'Winning' : points === 1 ? 'Drawing' : 'Losing');

  return (
    <div className="text-center">
      <p className={`${LABEL} text-ink-fade`}>Match {pos.index + 1} of {fixtures.length}</p>

      <div className="mt-5 border border-ink/30 bg-stock-lit px-5 py-6 shadow-[4px_4px_0_0_rgba(28,38,32,0.16)]">
        <p className={`${LABEL} text-ink-fade`}>{mine ? 'You predicted' : 'You left this one blank'}</p>
        <p className="mt-2 font-display text-4xl uppercase leading-none">{mine ? mine.name : `${match.home.name} v ${match.away.name}`}</p>

        <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <span className={`text-right font-data text-[15px] ${mine?.id === match.home.id ? 'font-bold text-ink' : 'text-ink-fade'}`}>{match.home.name}</span>
          <span className="min-w-[3.2em] font-data text-4xl tabular-nums">{showScore ? `${score.home}–${score.away}` : 'v'}</span>
          <span className={`text-left font-data text-[15px] ${mine?.id === match.away.id ? 'font-bold text-ink' : 'text-ink-fade'}`}>{match.away.name}</span>
        </div>

        <p className="mt-3 font-data text-[15px] text-ink-fade">
          {pos.phase === 'intro' ? 'Kick-off' : pos.phase === 'halftime' ? 'Half time' : atFullTime ? 'Full time' : `${pos.minute}'`}
        </p>

        {points !== null && (
          <p className={`mt-4 font-display text-3xl uppercase ${points === 3 ? 'text-moss' : points === 1 ? 'text-ink' : 'text-overprint'}`}>
            {verdict} +{points}
          </p>
        )}
      </div>

      <p className="mt-5 text-[16px] text-ink-fade">
        {/* As it stands, like the position beside it, so the two never disagree. */}
        {place}<span className="font-data text-xl text-ink">+{standing ? standing.round_points + standing.live : total}</span> this round
      </p>
    </div>
  );
}
