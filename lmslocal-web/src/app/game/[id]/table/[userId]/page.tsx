'use client';

/*
/game/[id]/table/[userId] - one player's Matchday predictions, round by round (docs/matchday.md
§8.6). Reached from the table and from the names on a card. View only.

Only LOCKED rounds, for anyone's predictions including your own: this is the "how did the table
get its shape" page, and the round still open has nothing settled to show. Your own open round is
on the predictions page.

A ledger, like the table: one row per match, the team predicted in the typewriter face, the word
and the points beside it.
*/

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { MatchdayRoundPredictions, MatchdayTable, matchdayApi } from '@/lib/api';
import { useCompetitionGate } from '@/hooks/useCompetitionGate';
import CompetitionUnavailable from '@/components/CompetitionUnavailable';
import { LABEL, EYEBROW, HEADING, PANEL, BTN_OUTLINE } from '@/lib/design';
import { GAME_NAMES, ordinal, outcomeWord, signedPoints } from '@/lib/games';

export default function MatchdayPlayerPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const competitionId = params.id as string;
  const userId = Number(params.userId);
  const requestedRound = searchParams.get('round');
  const { competition, unavailable } = useCompetitionGate(competitionId);

  const [data, setData] = useState<MatchdayRoundPredictions | null>(null);
  const [table, setTable] = useState<MatchdayTable | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (competition && competition.game_type !== 'matchday') router.replace(`/game/${competitionId}`);
  }, [competition, competitionId, router]);

  useEffect(() => {
    if (competition?.game_type !== 'matchday') return;
    let cancelled = false;
    setData(null);
    setError('');
    (async () => {
      try {
        const [roundRes, tableRes] = await Promise.all([
          matchdayApi.getRoundPredictions(Number(competitionId), requestedRound ? Number(requestedRound) : undefined),
          matchdayApi.getTable(Number(competitionId)),
        ]);
        if (cancelled) return;
        if (roundRes.data.return_code === 'SUCCESS') setData(roundRes.data);
        else setError(roundRes.data.message || 'These predictions could not be loaded.');
        if (tableRes.data.return_code === 'SUCCESS') setTable(tableRes.data);
      } catch {
        if (!cancelled) setError('These predictions could not be loaded. Check your connection and try again.');
      }
    })();
    return () => { cancelled = true; };
  }, [competition?.game_type, competitionId, requestedRound]);

  if (unavailable) return <CompetitionUnavailable />;

  const player = data?.players.find(p => p.user_id === userId) ?? null;
  const tableRow = table?.table.find(row => row.user_id === userId) ?? null;
  const name = player?.display_name ?? tableRow?.display_name ?? 'Player';
  const round = data?.round ?? null;
  const mine = new Map((data?.predictions ?? []).filter(p => p.user_id === userId).map(p => [p.fixture_id, p]));
  const roundPoints = Array.from(mine.values()).reduce((sum, p) => sum + (p.points ?? 0), 0);
  const unsettled = (data?.fixtures ?? []).some(f => !f.settled);

  return (
    <div className="min-h-screen bg-stock font-body text-ink">
      <header className="border-b border-ink/30">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href={`/game/${competitionId}/table`} className={`${LABEL} flex items-center gap-1.5 text-ink-fade transition-colors hover:text-ink`}>
            <ArrowLeftIcon className="h-4 w-4" />
            The table
          </Link>
          <span className={`${LABEL} text-ink-fade`}>{GAME_NAMES.matchday}</span>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className={EYEBROW}>{round ? `Round ${round.round_number}` : 'Predictions'}</p>
            <h1 className={`${HEADING} mt-1 truncate text-3xl`}>{name}</h1>
          </div>
          {tableRow && (
            <div className="flex-none text-right">
              <p className={`${LABEL} text-ink-fade`}>{ordinal(tableRow.position)} of {table?.table.length}</p>
              <p className="font-display text-2xl text-ink">{tableRow.total} pts{tableRow.provisional ? '*' : ''}</p>
            </div>
          )}
        </div>

        {error && (
          <div className={`${PANEL} p-6`}>
            <p className="text-[17px] text-ink">{error}</p>
            <Link href={`/game/${competitionId}/table`} className={`${BTN_OUTLINE} mt-4 inline-block`}>Back to the table</Link>
          </div>
        )}

        {!data && !error && (
          <div className={`${PANEL} p-8 text-center`}>
            <div className="mb-4 inline-flex h-8 w-8 animate-spin items-center justify-center rounded-full border-2 border-ink border-t-transparent" />
            <p className={EYEBROW}>Loading</p>
          </div>
        )}

        {data && !round && (
          <div className={`${PANEL} p-6 text-center`}>
            <p className="text-[17px] text-ink">Everyone&apos;s predictions appear here once round 1 locks.</p>
            <p className="mt-1 text-[15px] text-ink-fade">Until then, nobody can see anyone else&apos;s.</p>
          </div>
        )}

        {data && round && !player && (
          <div className={`${PANEL} p-6 text-center`}>
            <p className="text-[17px] text-ink">This player isn&apos;t in the competition.</p>
          </div>
        )}

        {data && round && player && (
          <>
            <div className={`${PANEL} divide-y divide-ink/30`}>
              {data.fixtures.map(fixture => {
                const prediction = mine.get(fixture.fixture_id);
                const teamName = prediction
                  ? (prediction.team === fixture.home_team_short ? fixture.home_team : fixture.away_team)
                  : null;
                return (
                  <div key={fixture.fixture_id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-ink-fade">{fixture.home_team} v {fixture.away_team}</p>
                      <p className={`truncate font-data text-[16px] ${teamName ? 'text-ink' : 'text-ink-fade'}`}>
                        {teamName ?? 'Not predicted'}
                      </p>
                    </div>
                    {/* Every state carries its word as well as its number (design-system §8). */}
                    <div className="flex-none text-right">
                      {prediction && prediction.points !== null ? (
                        <>
                          <p className={`${LABEL} text-ink`}>{outcomeWord(prediction.team, fixture.result)}</p>
                          <p className="font-data text-[15px] text-ink">{signedPoints(prediction.points)}</p>
                        </>
                      ) : prediction ? (
                        <p className={`${LABEL} text-ink-fade`}>In play</p>
                      ) : (
                        <p className="font-data text-[15px] text-ink-fade">0</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-3 text-right text-[15px] text-ink">
              This round: <span className="font-data">{signedPoints(roundPoints)}</span>
              {unsettled && <span className="text-ink-fade"> so far</span>}
            </p>

            {/* Round by round. Only locked rounds exist here, so the next link stops at the latest one. */}
            <div className="mt-6 flex items-center justify-between border-t border-ink/30 pt-4">
              {round.round_number > 1 ? (
                <Link
                  href={`/game/${competitionId}/table/${userId}?round=${round.round_number - 1}`}
                  className={`${LABEL} text-ink underline decoration-dotted underline-offset-[6px]`}
                >
                  &larr; Round {round.round_number - 1}
                </Link>
              ) : <span />}
              {round.round_number < round.latest_locked_round_number && (
                <Link
                  href={`/game/${competitionId}/table/${userId}?round=${round.round_number + 1}`}
                  className={`${LABEL} text-ink underline decoration-dotted underline-offset-[6px]`}
                >
                  Round {round.round_number + 1} &rarr;
                </Link>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
