'use client';

/*
/game/[id]/table - the Matchday league table (docs/matchday.md §8.3).

Position, name, total, then the figures that break a tie, shown so nobody has to argue: wins,
then predictions made. The footer states the ending and the tie-break order in words.

Built on the survival sheet's pattern (design-system §8): names in the typewriter face, the count
in display type, hairline rules. A ledger, not a dashboard - no bars, no charts.
*/

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { MatchdayTable, matchdayApi } from '@/lib/api';
import { useCompetitionGate } from '@/hooks/useCompetitionGate';
import CompetitionUnavailable from '@/components/CompetitionUnavailable';
import { LABEL, EYEBROW, HEADING, PANEL, BTN_OUTLINE } from '@/lib/design';
import { GAME_NAMES, MATCHDAY_SCORING, endingLabel } from '@/lib/games';

/*
A big competition - a workplace, a club with a hundred-odd players - would make this a page of
scrolling to find yourself. So the table opens on the top TOP_ROWS, then your own row with
NEIGHBOURS either side if you are further down, and the whole thing a tap away. Below
SHOW_ALL_UNDER players it simply shows everyone: cutting a 25-row table to 20 saves nothing.
*/
const TOP_ROWS = 20;
const NEIGHBOURS = 2;
const SHOW_ALL_UNDER = 30;

export default function MatchdayTablePage() {
  const params = useParams();
  const router = useRouter();
  const competitionId = params.id as string;
  const { competition, unavailable } = useCompetitionGate(competitionId);
  const [data, setData] = useState<MatchdayTable | null>(null);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);

  // Matchday only; LMS has its own standings.
  useEffect(() => {
    if (competition && competition.game_type !== 'matchday') router.replace(`/game/${competitionId}/standings`);
  }, [competition, competitionId, router]);

  const load = async () => {
    try {
      const res = await matchdayApi.getTable(Number(competitionId));
      if (res.data.return_code === 'SUCCESS') {
        setData(res.data);
        setError('');
      } else {
        setError(res.data.message || 'The table could not be loaded.');
      }
    } catch {
      setError('The table could not be loaded. Check your connection and try again.');
    }
  };

  useEffect(() => {
    if (competition?.game_type === 'matchday') load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competition?.game_type, competitionId]);

  if (unavailable) return <CompetitionUnavailable />;

  const isComplete = String(data?.competition.status ?? '').toUpperCase() === 'COMPLETE';
  const rows = data?.table ?? [];

  // The rows on screen, and where a gap sits. Indexes, not positions: positions repeat on a tie.
  const myIndex = rows.findIndex(row => row.is_me);
  const trimmed = !showAll && rows.length >= SHOW_ALL_UNDER;
  const shownIndexes = new Set<number>();
  rows.forEach((_, index) => {
    if (!trimmed || index < TOP_ROWS) shownIndexes.add(index);
  });
  if (trimmed && myIndex >= TOP_ROWS) {
    for (let i = Math.max(TOP_ROWS, myIndex - NEIGHBOURS); i <= Math.min(rows.length - 1, myIndex + NEIGHBOURS); i++) {
      shownIndexes.add(i);
    }
  }
  const anyProvisional = rows.some(row => row.provisional);
  const ending = data ? endingLabel(data.competition.end_rule, data.competition.end_value) : '';

  return (
    <div className="min-h-screen bg-stock font-body text-ink">
      <header className="border-b border-ink/30">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href={`/game/${competitionId}`} className={`${LABEL} flex items-center gap-1.5 text-ink-fade transition-colors hover:text-ink`}>
            <ArrowLeftIcon className="h-4 w-4" />
            {competition?.name ?? 'Back'}
          </Link>
          <span className={`${LABEL} text-ink-fade`}>{GAME_NAMES.matchday}</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <p className={EYEBROW}>{isComplete ? 'Final' : data?.latest_round_number ? `After round ${data.rounds_settled}` : 'Before round 1'}</p>
            <h1 className={`${HEADING} mt-1 text-3xl`}>The table</h1>
          </div>
          {ending && (
            <div className="text-right">
              <p className={`${LABEL} text-ink-fade`}>Game length</p>
              <p className="text-[15px] text-ink">{ending}</p>
            </div>
          )}
        </div>

        {error && (
          <div className={`${PANEL} mb-4 p-4`}>
            <p className="border-l-2 border-overprint pl-3 text-[15px] text-ink">{error}</p>
            <button type="button" onClick={load} className={`${BTN_OUTLINE} mt-3`}>Try again</button>
          </div>
        )}

        {!data && !error && (
          <div className={`${PANEL} p-8 text-center`}>
            <div className="mb-4 inline-flex h-8 w-8 animate-spin items-center justify-center rounded-full border-2 border-ink border-t-transparent" />
            <p className={EYEBROW}>Loading</p>
          </div>
        )}

        {data && rows.length === 0 && (
          <div className={`${PANEL} p-6 text-center`}>
            <p className="text-[17px] text-ink">Nobody has joined yet.</p>
            <p className="mt-1 text-[15px] text-ink-fade">The table fills in as players join.</p>
          </div>
        )}

        {data && rows.length > 0 && (
          <div className={`${PANEL} overflow-x-auto`}>
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">League table, best first</caption>
              <thead>
                <tr className="border-b border-ink/30">
                  <th scope="col" className={`${LABEL} w-10 px-3 py-3 text-right text-ink-fade`}>Pos</th>
                  <th scope="col" className={`${LABEL} px-3 py-3 text-ink-fade`}>Player</th>
                  <th scope="col" className={`${LABEL} px-2 py-3 text-right text-ink-fade`} title="Wins">W</th>
                  <th scope="col" className={`${LABEL} px-2 py-3 text-right text-ink-fade`} title="Draws">D</th>
                  <th scope="col" className={`${LABEL} px-2 py-3 text-right text-ink-fade`} title="Losses">L</th>
                  <th scope="col" className={`${LABEL} hidden px-2 py-3 text-right text-ink-fade sm:table-cell`} title="Predictions made">Predicted</th>
                  <th scope="col" className={`${LABEL} px-3 py-3 text-right text-ink-fade`}>Pts</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  if (!shownIndexes.has(index)) return null;
                  const winner = isComplete && row.position === 1;
                  // A row of dots where rows are skipped, so the jump from 20th to 47th is visible.
                  const gapBefore = index > 0 && !shownIndexes.has(index - 1);
                  return (
                    <Fragment key={row.user_id}>
                    {gapBefore && (
                      <tr className="border-b border-ink/30">
                        <td colSpan={7} className="px-3 py-1 text-center font-data text-[15px] text-ink-fade" aria-hidden="true">&middot; &middot; &middot;</td>
                      </tr>
                    )}
                    <tr
                      className={`border-b border-ink/30 last:border-b-0 ${winner ? 'bg-moss-wash' : ''}`}
                    >
                      <td className="px-3 py-3 text-right font-data text-[15px] text-ink-fade">{row.position}</td>
                      <td className="px-3 py-3">
                        <span className={`font-data text-[16px] text-ink ${row.is_me ? 'font-bold' : ''}`}>{row.display_name}</span>
                        {row.is_me && <span className={`${LABEL} ml-2 text-ink-fade`}>You</span>}
                        {winner && <span className={`${LABEL} ml-2 text-ink`}>Winner</span>}
                      </td>
                      <td className="px-2 py-3 text-right font-data text-[15px] text-ink">{row.wins}</td>
                      <td className="px-2 py-3 text-right font-data text-[15px] text-ink">{row.draws}</td>
                      <td className="px-2 py-3 text-right font-data text-[15px] text-ink">{row.losses}</td>
                      <td className="hidden px-2 py-3 text-right font-data text-[15px] text-ink sm:table-cell">{row.predictions}</td>
                      <td className="px-3 py-3 text-right font-display text-2xl text-ink">
                        {row.total}
                        {row.provisional && <span className="text-ink-fade" aria-label="includes this round so far">*</span>}
                      </td>
                    </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {trimmed && (
              <div className="border-t border-ink/30 p-3 text-center">
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className={`${LABEL} text-ink underline decoration-dotted underline-offset-[6px] hover:text-ink-fade`}
                >
                  Show all {rows.length} players
                </button>
              </div>
            )}
          </div>
        )}

        {/* The rules of the table, in words, so a tie never becomes an argument. */}
        {data && (
          <div className="mt-5 space-y-1 text-[15px] text-ink-fade">
            {anyProvisional && <p>* Includes the round still being played - it can still move.</p>}
            <p>{MATCHDAY_SCORING}. A total never goes below 0: it is reset to 0 after a round that would take it negative.</p>
            <p>Level on points? More wins goes ahead, then more predictions made. Still level means sharing the place.</p>
          </div>
        )}
      </main>
    </div>
  );
}
