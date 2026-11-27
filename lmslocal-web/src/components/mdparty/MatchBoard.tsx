'use client';

/*
  The scoreboard for the match being revealed (docs/matchday-party.md §6), shared by the TV and the
  phones (2026-11-27: the phones had a plainer card of their own, and the room wanted one picture).
  `compact` sizes it for a phone; everything else is the same.

  Each team on a full-width row of its own with its goals at the end, and under it the people who
  predicted it. Side by side either side of the score, long names (Crystal Palace, Nottm Forest) had
  a third of the card and squashed (2026-11-25). The two numbers share one column, so the score reads
  straight down.
*/

import type { PartyFixture } from '@/lib/api';
import { provisionalPoints, type Crowd, type RevealPosition } from '@/lib/mdpartyReveal';

export default function MatchBoard({
  match,
  score,
  pos,
  crowd,
  nameOf,
  litSide,
  compact = false,
  highlightId,
}: {
  match: PartyFixture;
  score: { home: number; away: number };
  pos: RevealPosition;
  crowd: Crowd[] | null;
  nameOf: (playerId: number) => string;
  /** The side that has just scored, lit red for a moment. */
  litSide: 'home' | 'away' | null;
  compact?: boolean;
  /** This phone's player, picked out in bold among the names. */
  highlightId?: number;
}) {
  const here = crowd?.find((c) => c.fixture_id === match.id);
  const bankers = new Set(here?.bankers ?? []);
  const ids = (side: 'home' | 'away') => (side === 'home' ? here?.home : here?.away) ?? [];

  const sz = compact
    ? { pad: 'px-4 py-4', clock: 'text-[15px]', team: 'text-3xl', names: 'text-[14px]', tag: 'text-[13px]', goals: 'text-5xl', row: 'py-3 gap-3' }
    : { pad: 'px-[2.5vw] py-[4vh]', clock: 'text-[clamp(1.4rem,2.6vw,2.2rem)]', team: 'text-[clamp(2.2rem,5vw,4.6rem)]', names: 'text-[clamp(1.05rem,1.8vw,1.6rem)]', tag: 'text-[clamp(1rem,1.7vw,1.5rem)]', goals: 'text-[clamp(3rem,7.5vw,7rem)]', row: 'py-[2vh] gap-6' };

  return (
    <section className={`border border-ink/30 bg-stock-lit ${sz.pad} shadow-[4px_4px_0_0_rgba(28,38,32,0.16)]`}>
      <p className={`text-center font-data ${sz.clock} text-ink-fade`}>
        {pos.phase === 'intro' ? 'Kick-off' : pos.phase === 'halftime' ? 'Half time' : pos.phase === 'result' ? 'Full time' : `${pos.minute}'`}
      </p>

      <div className={`${compact ? 'mt-3' : 'mt-5'} divide-y divide-ink/20 border-y border-ink/30`}>
        {([
          { team: match.home, goals: score.home, side: 'home' as const },
          { team: match.away, goals: score.away, side: 'away' as const },
        ]).map((row) => {
          const who = ids(row.side);
          const bankerNames = who.filter((id) => bankers.has(id)).map(nameOf).filter(Boolean);
          return (
            <div key={row.side} className={`grid grid-cols-[1fr_auto] items-center ${sz.row}`}>
              <div className="min-w-0 text-left">
                <p className={`font-display ${sz.team} uppercase leading-[0.95]`}>{row.team.name}</p>
                <p className={`mt-1.5 ${sz.names}`}>
                  {who.length
                    ? who.map((id, i) => (
                      <span key={id} className={id === highlightId ? 'font-bold' : ''}>{i > 0 ? ', ' : ''}{nameOf(id)}</span>
                    ))
                    : <span className="text-ink-fade">Nobody</span>}
                </p>
                {/* The banker, on a tag of its own: outlined while the team is winning, solid red
                    while it is not, then what it paid at full time. A banker doubles what its pick
                    scores (§2): no penalty, so just what it won, or nothing. */}
                {bankerNames.length > 0 && (() => {
                  const other = row.side === 'home' ? score.away : score.home;
                  const winning = pos.phase !== 'intro' && row.goals > other;
                  const settled = pos.phase === 'result';
                  const word = bankerNames.length > 1 ? 'Bankers' : 'Banker';
                  const paid = settled && match.result && here
                    ? provisionalPoints(match, row.team.id, { home: match.result.home_goals, away: match.result.away_goals },
                      { banker: true, homeCount: here.home.length, awayCount: here.away.length })
                    : 0;
                  const text = !settled
                    ? `${word} · ${bankerNames.join(', ')}`
                    : paid > 0 ? `${word} · ${bankerNames.join(', ')} +${paid}` : `${word} · ${bankerNames.join(', ')} · nothing`;
                  const danger = pos.phase !== 'intro' && !winning;
                  return (
                    <p className={`mt-2 inline-block px-2.5 py-0.5 font-display ${sz.tag} uppercase tracking-[0.04em] transition-colors ${
                      danger ? 'bg-overprint text-stock-lit' : 'border-2 border-overprint text-overprint'
                    }`}>
                      {text}
                    </p>
                  );
                })()}
              </div>
              <p className={`w-[1.6em] text-center font-data ${sz.goals} leading-none tabular-nums transition-[color,transform] duration-300 ${
                litSide === row.side ? 'scale-110 text-overprint' : pos.phase === 'intro' ? 'text-ink-fade/40' : 'text-ink'
              }`}>
                {pos.phase === 'intro' ? '–' : row.goals}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
