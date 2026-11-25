'use client';

/*
  The Matchday Party reveal's clock, shared by every screen (docs/matchday-party.md §6).

  ONE MATCH AT A TIME (2026-11-24). All ten playing out at once was a wall of numbers: nobody could
  follow ten scores in fifty seconds or tell whom to watch. So the round is revealed match by match,
  each in three parts - who predicted each side, the ninety minutes, full time - like a results show
  reading the scores out. The rules and the coupon are unchanged.

  ONE CLOCK FOR THE WHOLE ROOM. Every screen works out where the reveal is from the moment the server
  locked the round (round.locked_at) against the server's clock (server_now), never from when it
  loaded. The TV and every phone show the same match and the same goal at the same moment, and a
  refreshed screen comes back at the right point.

  HALF TIME IS A PAUSE (2026-11-25): the clock holds at 45' for a moment with the score up, a beat of
  tension in every match. And the PLAYERS' LEAGUE moves after every match (liveStandings), so everyone
  can see where they stand all the way through the round rather than adding up their own points.
*/

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PartyFixture } from '@/lib/api';

export const PREROLL_MS = 4000;   // the kick-off countdown, once per round
export const INTRO_MS = 2500;     // the fixture and who predicted each side
export const HALF_MS = 4000;      // each half of forty-five minutes
export const HALFTIME_MS = 1500;  // the pause at half time
export const RESULT_MS = 3000;    // full time, who scored, and the league moving
export const MATCH_MS = INTRO_MS + HALF_MS + HALFTIME_MS + HALF_MS + RESULT_MS;

export function revealLength(matches: number): number {
  return PREROLL_MS + matches * MATCH_MS;
}

export type RevealPhase = 'countdown' | 'intro' | 'play' | 'halftime' | 'result' | 'done';

export type RevealPosition = {
  phase: RevealPhase;
  /** The match being revealed, 0-based. matches - 1 once done. */
  index: number;
  /** 0 to 90 within the current match; 90 from its result onwards. */
  minute: number;
  /** Seconds to kick-off, during the countdown. */
  countdown: number;
  /** Milliseconds since the reveal began, for anything timed off the clock. */
  elapsed: number;
};

export function positionAt(elapsed: number, matches: number): RevealPosition {
  if (elapsed < PREROLL_MS) {
    return { phase: 'countdown', index: 0, minute: 0, countdown: Math.ceil((PREROLL_MS - elapsed) / 1000), elapsed };
  }
  const into = elapsed - PREROLL_MS;
  const index = Math.floor(into / MATCH_MS);
  if (index >= matches) return { phase: 'done', index: matches - 1, minute: 90, countdown: 0, elapsed };
  let t = into - index * MATCH_MS;
  if (t < INTRO_MS) return { phase: 'intro', index, minute: 0, countdown: 0, elapsed };
  t -= INTRO_MS;
  if (t < HALF_MS) return { phase: 'play', index, minute: Math.min(45, Math.floor((t / HALF_MS) * 45) + 1), countdown: 0, elapsed };
  t -= HALF_MS;
  if (t < HALFTIME_MS) return { phase: 'halftime', index, minute: 45, countdown: 0, elapsed };
  t -= HALFTIME_MS;
  if (t < HALF_MS) return { phase: 'play', index, minute: Math.min(90, 46 + Math.floor((t / HALF_MS) * 45)), countdown: 0, elapsed };
  return { phase: 'result', index, minute: 90, countdown: 0, elapsed };
}

/** The moment (ms into the reveal) a goal in match `index` at `minute` goes in. */
export function goalMoment(index: number, minute: number): number {
  const kickOff = PREROLL_MS + index * MATCH_MS + INTRO_MS;
  if (minute <= 45) return kickOff + ((minute - 1) / 45) * HALF_MS;
  return kickOff + HALF_MS + HALFTIME_MS + ((minute - 46) / 45) * HALF_MS;
}

/** The difference between the server's clock and this device's, from a state response. */
export function clockOffset(serverNow: string | undefined): number | null {
  if (!serverNow) return null;
  const t = Date.parse(serverNow);
  return Number.isNaN(t) ? null : t - Date.now();
}

/**
 * Where the reveal is, ticking. `lockedAt` is round.locked_at; `offsetMs` is clockOffset(server_now).
 * `final` skips straight to the end (the room has moved on from the reveal).
 */
export function useRevealPosition(
  lockedAt: string | null | undefined,
  offsetMs: number,
  matches: number,
  final = false,
  tickMs = 100
): RevealPosition {
  const compute = useCallback((): RevealPosition => {
    if (final || !lockedAt) return positionAt(revealLength(matches), matches);
    return positionAt(Date.now() + offsetMs - Date.parse(lockedAt), matches);
  }, [lockedAt, offsetMs, matches, final]);

  const [position, setPosition] = useState<RevealPosition>(compute);
  useEffect(() => {
    setPosition(compute());
    if (final) return;
    const id = setInterval(() => setPosition(compute()), tickMs);
    return () => clearInterval(id);
  }, [compute, final, tickMs]);
  return position;
}

/** A fixture's score at a minute. */
export function scoreAt(fixture: PartyFixture, minute: number): { home: number; away: number } {
  const goals = fixture.result?.goals ?? [];
  return {
    home: goals.filter((g) => g.side === 'home' && g.minute <= minute).length,
    away: goals.filter((g) => g.side === 'away' && g.minute <= minute).length,
  };
}

/** Points a prediction would score if the match ended at this score: 3 / 1 / 0. */
export function provisionalPoints(fixture: PartyFixture, predicted: number, score: { home: number; away: number }): number {
  if (score.home === score.away) return 1;
  const leader = score.home > score.away ? fixture.home.id : fixture.away.id;
  return leader === predicted ? 3 : 0;
}

/** How many matches have reached full time on the reveal. */
export function revealedCount(position: RevealPosition, matches: number): number {
  if (position.phase === 'done') return matches;
  if (position.phase === 'countdown') return 0;
  return position.index + (position.phase === 'result' ? 1 : 0);
}

/** Points per player for every match fully revealed so far (results in), for a running total. */
export function pointsSoFar(fixtures: PartyFixture[], predictions: Record<string, number>, position: RevealPosition): number {
  let total = 0;
  fixtures.slice(0, revealedCount(position, fixtures.length)).forEach((f) => {
    const predicted = predictions[String(f.id)];
    if (predicted === undefined || !f.result) return;
    total += provisionalPoints(f, predicted, { home: f.result.home_goals, away: f.result.away_goals });
  });
  return total;
}

export type Crowd = { fixture_id: number; home: number[]; away: number[] };
export type StandingRow = {
  player_id: number; name: string;
  /** Banked: earlier rounds plus the matches of this round that have reached full time. */
  points: number;
  /** What the match being played would add if it ended now. 0 until it has a goal. */
  live: number;
  round_points: number; position: number; move: number;
};

/*
  The players' league as it stands after `revealed` matches of this round: each player's points from
  earlier rounds (their table total less this round's, which the server already counts), plus the
  matches revealed so far. Level on points shares a position. `move` is the places gained (+) or
  lost (-) on the last match revealed, for the arrows, which show only on a settled result.

  THE LEAGUE MOVES ON EVERY GOAL (2026-11-25). Pass `playing` (the match being played and its score
  now) and each player also gets `live`: what that match would add if it ended as it stands, and the
  league is ordered by banked + live. NOT AT 0-0: strictly a goalless match is a draw worth 1 to every
  predictor, so the whole league would lurch at each kick-off; the live part counts only once the
  match has a goal, and a 0-0 that stays one gets its point at full time.
*/
export function liveStandings(
  table: { player_id: number; name: string; points: number; round_points: number }[],
  fixtures: PartyFixture[],
  crowd: Crowd[] | null,
  revealed: number,
  playing?: { index: number; score: { home: number; away: number } } | null
): StandingRow[] {
  const award = (c: Crowd, h: number, a: number, add: (id: number, pts: number) => void) => {
    if (h === a) [...c.home, ...c.away].forEach((id) => add(id, 1));
    else (h > a ? c.home : c.away).forEach((id) => add(id, 3));
  };
  const livePoints = new Map<number, number>();
  if (playing && playing.score.home + playing.score.away > 0) {
    const f = fixtures[playing.index];
    const c = f && crowd?.find((x) => x.fixture_id === f.id);
    if (c) award(c, playing.score.home, playing.score.away, (id, pts) => livePoints.set(id, (livePoints.get(id) ?? 0) + pts));
  }

  const rank = (count: number, withLive: boolean) => {
    const points = new Map(table.map((p) => [p.player_id, p.points - p.round_points]));
    const round = new Map(table.map((p) => [p.player_id, 0]));
    fixtures.slice(0, count).forEach((f) => {
      const c = crowd?.find((x) => x.fixture_id === f.id);
      if (!c || !f.result) return;
      award(c, f.result.home_goals, f.result.away_goals, (id, pts) => {
        if (!points.has(id)) return;
        points.set(id, points.get(id)! + pts);
        round.set(id, round.get(id)! + pts);
      });
    });
    const rows = table
      .map((p) => ({
        player_id: p.player_id,
        name: p.name,
        points: points.get(p.player_id)!,
        live: withLive ? livePoints.get(p.player_id) ?? 0 : 0,
        round_points: round.get(p.player_id)!,
      }))
      .sort((x, y) => (y.points + y.live) - (x.points + x.live) || x.name.localeCompare(y.name));
    let position = 0;
    return rows.map((r, i) => {
      const prev = rows[i - 1];
      if (i === 0 || prev.points + prev.live !== r.points + r.live) position = i + 1;
      return { ...r, position };
    });
  };
  const now = rank(revealed, true);
  // Arrows compare settled results only: the last full time against the one before it.
  const settledNow = new Map(rank(revealed, false).map((r) => [r.player_id, r.position]));
  const settledBefore = new Map(rank(Math.max(0, revealed - 1), false).map((r) => [r.player_id, r.position]));
  return now.map((r) => ({
    ...r,
    move: revealed === 0 ? 0 : (settledBefore.get(r.player_id) ?? 0) - (settledNow.get(r.player_id) ?? 0),
  }));
}

/** "1st", "2nd", "3rd", "11th". */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/*
  The teleprinter's sounds: a soft tick per character and a two-note chime per goal, made on the fly
  with the Web Audio API so there is nothing to download. Played on the TV only (§6). A browser lets
  a page make sound only after a tap on it.
*/
export function useTeleprinterSound(enabled: boolean) {
  const ctx = useRef<AudioContext | null>(null);
  const get = useCallback(() => {
    if (!enabled || typeof window === 'undefined') return null;
    if (!ctx.current) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx.current = new Ctor();
    }
    if (ctx.current.state === 'suspended') ctx.current.resume().catch(() => {});
    return ctx.current;
  }, [enabled]);

  const tick = useCallback(() => {
    const ac = get();
    if (!ac) return;
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'square';
    osc.frequency.value = 1800 + Math.random() * 400;
    gain.gain.setValueAtTime(0.025, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.02);
  }, [get]);

  const chime = useCallback(() => {
    const ac = get();
    if (!ac) return;
    const t = ac.currentTime;
    [880, 1318.5].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = t + i * 0.12;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
      osc.connect(gain).connect(ac.destination);
      osc.start(start);
      osc.stop(start + 0.65);
    });
  }, [get]);

  useEffect(() => () => { ctx.current?.close().catch(() => {}); }, []);
  return { tick, chime };
}
