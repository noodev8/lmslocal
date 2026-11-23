/**
 * The games LMSLocal runs, and the words each one uses. docs/matchday.md §2.
 *
 * Every screen that names a game, states Matchday's scoring or describes how a game ends takes it
 * from here. "Matchday" is a working name: renaming it is a change to GAME_NAMES, not a hunt
 * through pages.
 *
 * THE VOCABULARIES DO NOT MIX. LMS says pick, lives, eliminated, still in. Matchday says predict,
 * prediction, points, the table. A player should know which game a sentence is about from the
 * words alone, so Matchday copy never says "pick" and LMS copy never says "points".
 *
 * AND NO BETTING WORDS (2026-11-22). Never "back", "backed" or "backing" a team: it reads as
 * gambling, which this is not and must never sound like.
 */

import type { GameType, MatchdayEndRule } from '@/lib/api';

export const GAME_NAMES: Record<GameType, string> = {
  lms: 'Last Man Standing',
  matchday: 'Matchday',
};

/** The name for a competition's game. Anything unset is LMS, as it is on the server. */
export function gameName(gameType?: GameType | null): string {
  return GAME_NAMES[gameType ?? 'lms'] ?? GAME_NAMES.lms;
}

/** One line each, for the create wizard's first question and the join page. */
export const GAME_SUMMARIES: Record<GameType, string> = {
  lms: 'Players pick one team each round. Win and they are through; draw or lose and they are out. Last one left wins.',
  matchday: 'Players predict the winner of every match each round and score points. Most points wins.',
};

/** Matchday's scoring, stated the same way everywhere it appears. 3 / 1 / 0 since 2026-11-23
 * (it was 3 / 1 / −1); the server's copy is POINTS in services/matchdayScoring.js. */
export const MATCHDAY_POINTS = { win: 3, draw: 1, loss: 0 } as const;
export const MATCHDAY_SCORING = 'Win +3 · Draw +1 · Lose 0';

/** "6 rounds". "First to 20 points" survives only for the two test competitions made before
 * points targets were withdrawn (ENDING_CHOICES below). */
export function endingLabel(rule?: MatchdayEndRule | null, value?: number | null): string {
  if (!rule || !value) return '';
  return rule === 'points' ? `First to ${value} points` : `${value} round${value === 1 ? '' : 's'}`;
}

/** 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st. */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/** "+3", "+1", "0". No score is negative since 3 / 1 / 0; the typographic minus stays in case one
 * ever is, so it would still read as a sign. */
export function signedPoints(points: number): string {
  if (points > 0) return `+${points}`;
  if (points < 0) return `−${Math.abs(points)}`;
  return '0';
}

/**
 * The word for a settled prediction. Every state carries its word (design-system §8).
 *
 * Read from the match result, never from the points: the points say what a result was worth, and
 * would make every word wrong the day the scoring changes. No result on a settled prediction is a
 * postponement fixed by hand.
 */
export function outcomeWord(myTeam: string | null, result: string | null): string {
  if (myTeam === null) return '';
  if (result === null) return 'Void';
  if (result === 'DRAW') return 'Drew';
  return result === myTeam ? 'Won' : 'Lost';
}

/**
 * "Sat 28 Nov, 3pm" - always UK time, for the reason roundState.ts gives: these are UK kickoffs,
 * and a player abroad still needs the time the match actually starts. On the hour drops ":00".
 */
export function formatKickoff(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short' });
  const time = date
    .toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: 'numeric', minute: '2-digit', hour12: true })
    .replace(/:00(?=\s*[ap]m\b)/i, '')
    .replace(/\s/g, '');
  return `${day}, ${time}`;
}

/**
 * How many rounds a Matchday game lasts: the organiser's only choice of ending, from a fixed list.
 * Points targets were withdrawn 2026-11-22 - simulated, "first to 20" ended in round 1 - and the
 * reasoning is in lmslocal-server/services/matchdayScoring.js, which enforces the same list.
 * Change both together. Six is the default because Last Man Standing usually lasts about six.
 */
export const ROUND_CHOICES = [4, 6, 8] as const;
export const DEFAULT_ROUNDS = 6;
