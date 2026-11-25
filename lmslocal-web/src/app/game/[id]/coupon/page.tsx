'use client';

/*
/game/[id]/coupon - a Matchday player's predictions for a round (docs/matchday.md §8.2).

ONE VIEW: A STRIP OF CARDS, one per match, with a tracker above it (2026-11-22). There used to be
a second view, the whole coupon as a sheet of rows; it was dropped to leave a player one way to do
the one thing. A player predicts, checks and, after the lock, sees results on the same cards.

  - TAP A TEAM to predict it. The strip then moves to the next match. Tapping the team already
    predicted takes the prediction back, which is how a match is skipped: there is no Skip button.
  - MOVING BETWEEN CARDS NEVER CHOOSES ANYTHING. The strip is a native horizontal scroller with
    snap points, so a finger swipes it, a trackpad scrolls it, and a mouse uses the arrows or the
    tracker. Nothing here asks which device it is on, and no copy tells anyone to swipe - which
    makes no sense on a laptop.
  - THE TRACKER is one segment per match, green once predicted, and a tap on one jumps to that card.
    It answers "how many are left, and which" without a count to read.

Each answer is saved as it is given (set-prediction), so a player who stops halfway keeps what
they did. Saving is not optimistic: the card changes once the server has the answer, because a
prediction that silently failed would cost real points.

THE STRIP ITSELF - tracker, cards, moving between them, Done - is components/coupon/CardStrip.tsx,
shared with Matchday Party since 2026-11-24. This page loads the round, saves each tap and adds the
crowd line; how the cards behave is changed there.
*/

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { MatchdayCoupon, MatchdayFixture, MatchdayRoundPredictions, matchdayApi } from '@/lib/api';
import { useCompetitionGate } from '@/hooks/useCompetitionGate';
import CompetitionUnavailable from '@/components/CompetitionUnavailable';
import { LABEL, EYEBROW, HEADING, PANEL, BTN_OUTLINE } from '@/lib/design';
import CardStrip, { type StripFixture, type TapOutcome } from '@/components/coupon/CardStrip';
import { GAME_NAMES, MATCHDAY_SCORING, formatKickoff, outcomeWord, signedPoints } from '@/lib/games';

export default function CouponPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const competitionId = params.id as string;
  const requestedRound = searchParams.get('round');
  const { competition, unavailable } = useCompetitionGate(competitionId);

  const [coupon, setCoupon] = useState<MatchdayCoupon | null>(null);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  // Everyone's predictions, once the round has locked (docs/matchday.md §8.6). Null before then,
  // and if it fails to load the cards simply go without it - it is extra, not the page.
  const [everyone, setEveryone] = useState<MatchdayRoundPredictions | null>(null);

  // A Matchday screen only. The LMS pick screen is the other game's; the reverse redirect lives
  // there (docs/matchday.md §8.4).
  useEffect(() => {
    if (competition && competition.game_type !== 'matchday') router.replace(`/game/${competitionId}`);
  }, [competition, competitionId, router]);

  const load = useCallback(async () => {
    try {
      const res = await matchdayApi.getPredictions(
        Number(competitionId),
        requestedRound ? Number(requestedRound) : undefined
      );
      if (res.data.return_code === 'SUCCESS') {
        setCoupon(res.data);
        setLoadError('');
      } else {
        setLoadError(res.data.message || 'These predictions could not be loaded.');
      }
    } catch {
      setLoadError('These predictions could not be loaded. Check your connection and try again.');
    }
  }, [competitionId, requestedRound]);

  useEffect(() => {
    if (competition?.game_type === 'matchday') load();
  }, [competition?.game_type, load]);

  const round = coupon?.round ?? null;
  const open = round !== null && !round.locked && coupon?.is_player === true;
  const fixtures = useMemo(() => coupon?.fixtures ?? [], [coupon]);

  const lockedRoundNumber = round?.locked ? round.round_number : null;
  useEffect(() => {
    setEveryone(null);
    if (lockedRoundNumber === null) return;
    let cancelled = false;
    matchdayApi.getRoundPredictions(Number(competitionId), lockedRoundNumber)
      .then(res => { if (!cancelled && res.data.return_code === 'SUCCESS') setEveryone(res.data); })
      .catch(() => { /* the cards work without it */ });
    return () => { cancelled = true; };
  }, [competitionId, lockedRoundNumber]);

  // Per match: who predicted the home team, who the away team, who neither. Every member is in
  // exactly one list, so "not predicted" is a real count (§8.6).
  const crowds = useMemo(() => {
    const out = new Map<number, Crowd>();
    if (!everyone) return out;
    const byFixture = new Map<number, Map<number, string>>();
    for (const p of everyone.predictions) {
      if (!byFixture.has(p.fixture_id)) byFixture.set(p.fixture_id, new Map());
      byFixture.get(p.fixture_id)!.set(p.user_id, p.team);
    }
    for (const f of everyone.fixtures) {
      const teams = byFixture.get(f.fixture_id) ?? new Map<number, string>();
      const crowd: Crowd = { home: [], away: [], none: [] };
      for (const player of everyone.players) {
        const team = teams.get(player.user_id);
        if (team === f.home_team_short) crowd.home.push(player);
        else if (team === f.away_team_short) crowd.away.push(player);
        else crowd.none.push(player);
      }
      out.set(f.fixture_id, crowd);
    }
    return out;
  }, [everyone]);

  const updateFixture = (fixtureId: number, myTeam: string | null) => {
    setCoupon(state => {
      if (!state) return state;
      const next = state.fixtures.map(f => (f.fixture_id === fixtureId ? { ...f, my_team: myTeam } : f));
      return { ...state, fixtures: next, predicted: next.filter(f => f.my_team !== null).length };
    });
  };

  const handleSaveFailure = (code: string | undefined, message: string | undefined) => {
    if (code === 'ROUND_LOCKED') {
      setSaveError('This round has locked - predictions can no longer change.');
      load();
    } else {
      setSaveError(message || 'That did not save. Try again.');
    }
  };

  /**
   * A tap on a team. The team already predicted is taken back (the match then scores 0); any other
   * is predicted, and the strip moves on to the next match (CardStrip does the moving).
   */
  const tapTeam = async (index: number, team: string): Promise<TapOutcome> => {
    const fixture = fixtures[index];
    if (!fixture) return 'failed';
    const takingBack = fixture.my_team === team;
    setSaveError('');
    try {
      const res = takingBack
        ? await matchdayApi.clearPrediction(fixture.fixture_id)
        : await matchdayApi.setPrediction(fixture.fixture_id, team);
      if (res.data.return_code !== 'SUCCESS') {
        handleSaveFailure(res.data.return_code, res.data.message);
        return 'failed';
      }
      updateFixture(fixture.fixture_id, takingBack ? null : team);
      return takingBack ? 'cleared' : 'chosen';
    } catch {
      setSaveError('That did not save. Check your connection and try again.');
      return 'failed';
    }
  };

  // The strip's view of each match. Results are read from the result, never from the points.
  const stripFixtures: StripFixture[] = fixtures.map(f => ({
    id: f.fixture_id,
    home: { key: f.home_team_short, name: f.home_team },
    away: { key: f.away_team_short, name: f.away_team },
    meta: formatKickoff(f.kickoff_time),
    chosen: f.my_team,
    resultText: f.result === null
      ? null
      : f.result === 'DRAW'
        ? 'Draw'
        : `${f.result === f.home_team_short ? f.home_team : f.away_team} won`,
    outcome: f.settled && f.my_team !== null && f.my_points !== null
      ? { word: outcomeWord(f.my_team, f.result), points: signedPoints(f.my_points) }
      : null,
  }));

  if (unavailable) return <CompetitionUnavailable />;

  const shell = (children: React.ReactNode) => (
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
      <main className="mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );

  if (loadError) {
    return shell(
      <div className={`${PANEL} p-6`}>
        <p className="text-[17px] text-ink">{loadError}</p>
        <button type="button" onClick={load} className={`${BTN_OUTLINE} mt-4`}>Try again</button>
      </div>
    );
  }

  if (!coupon || !competition) {
    return shell(
      <div className={`${PANEL} p-8 text-center`}>
        <div className="mb-4 inline-flex h-8 w-8 animate-spin items-center justify-center rounded-full border-2 border-ink border-t-transparent" />
        <p className={EYEBROW}>Loading</p>
        <p className="mt-2 text-[17px] text-ink-fade">Fetching this round&apos;s matches&hellip;</p>
      </div>
    );
  }

  if (!round || fixtures.length === 0) {
    return shell(
      <div className={`${PANEL} p-6 text-center`}>
        <p className={EYEBROW}>No round yet</p>
        <p className="mt-2 text-[17px] text-ink">The first round&apos;s matches aren&apos;t out yet.</p>
        <p className="mt-1 text-[15px] text-ink-fade">They&apos;ll appear here as soon as they are.</p>
      </div>
    );
  }

  const settledCount = fixtures.filter(f => f.settled).length;
  const roundPoints = fixtures.reduce((sum, f) => sum + (f.my_points ?? 0), 0);
  const allPredicted = coupon.predicted === fixtures.length;
  // The scoring is explained once, in round 1. By round 2 everyone playing has seen it, and it is
  // still on the competition's home screen and under the table.
  const explainScoring = round.round_number === 1;

  return shell(
    <>
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className={EYEBROW}>Round {round.round_number}</p>
          <h1 className={`${HEADING} mt-1 text-3xl`}>{coupon.is_player ? 'Your predictions' : 'The matches'}</h1>
        </div>
        <div className="text-right">
          <p className={`${LABEL} text-ink-fade`}>{round.locked ? 'Locked' : 'Locks'}</p>
          <p className="font-data text-[15px] text-ink">{formatKickoff(round.lock_time)}</p>
        </div>
      </div>

      {saveError && <ErrorLine message={saveError} />}

      {/* One line on where the round stands. */}
      <p className="mb-4 text-[15px] text-ink-fade">
        {!coupon.is_player
          ? 'You organise this one without playing.'
          : open
            ? allPredicted
              ? <>All {fixtures.length} predicted. You can change any of them until the lock.</>
              : coupon.predicted === 0
                ? 'Tap the team you think will win.'
                : <><span className="font-data text-ink">{fixtures.length - coupon.predicted}</span> still to predict.</>
            : settledCount === 0
              ? <>You predicted {coupon.predicted} of {fixtures.length}. Matches in play.</>
              : <>This round: <span className="font-data text-ink">{signedPoints(roundPoints)}</span> &middot; {settledCount} of {fixtures.length} results in</>}
      </p>

      <CardStrip
        fixtures={stripFixtures}
        editable={open}
        isPlayer={coupon.is_player}
        placementKey={round.round_number}
        scoringLine={explainScoring ? MATCHDAY_SCORING : null}
        onTap={tapTeam}
        renderExtra={(_, index) => {
          const fixture = fixtures[index];
          const crowd = crowds.get(fixture.fixture_id);
          return crowd ? <CrowdLine fixture={fixture} crowd={crowd} competitionId={competitionId} /> : null;
        }}
        done={{ href: `/game/${competitionId}` }}
      />

      {/* Earlier rounds. A link per direction rather than a picker: looking back is occasional. */}
      <div className="mt-8 flex items-center justify-between border-t border-ink/30 pt-4">
        {round.round_number > 1 ? (
          <Link href={`/game/${competitionId}/coupon?round=${round.round_number - 1}`} className={`${LABEL} text-ink underline decoration-dotted underline-offset-[6px]`}>
            &larr; Round {round.round_number - 1}
          </Link>
        ) : <span />}
        {!round.latest && (
          <Link href={`/game/${competitionId}/coupon`} className={`${LABEL} text-ink underline decoration-dotted underline-offset-[6px]`}>
            Latest round &rarr;
          </Link>
        )}
      </div>
    </>
  );
}

function ErrorLine({ message }: { message: string }) {
  // Ink text with an overprint rule, never red text: overprint is the brand's second ink, and an
  // error set in it reads as emphasis (design-system §2).
  return <p className="mb-4 border-l-2 border-overprint bg-stock-lit px-4 py-3 text-[15px] text-ink">{message}</p>;
}

type CrowdPlayer = { user_id: number; display_name: string; is_me: boolean };
type Crowd = { home: CrowdPlayer[]; away: CrowdPlayer[]; none: CrowdPlayer[] };

/**
 * Who predicted what on one match - only ever given for a locked round (§8.6). One line of counts,
 * the names behind a tap. Each name goes to that player's predictions, so a surprise on the card
 * leads to the rest of their round.
 */
function CrowdLine({ fixture, crowd, competitionId }: { fixture: MatchdayFixture; crowd: Crowd; competitionId: string }) {
  const [showNames, setShowNames] = useState(false);

  // What a prediction on each side scored, once the match is settled - read from the result, the
  // same as the Won / Lost words, never from a points value.
  const sideWord = (team: string) => {
    if (!fixture.settled || fixture.result === null) return null;
    return outcomeWord(team, fixture.result);
  };

  const column = (label: string, team: string | null, players: CrowdPlayer[]) => (
    <div className="min-w-0">
      <p className={`${LABEL} text-ink-fade`}>
        {label}
        {team && sideWord(team) && <span className="text-ink"> &middot; {sideWord(team)}</span>}
      </p>
      {players.length === 0 ? (
        <p className="mt-1 text-[13px] text-ink-fade">Nobody</p>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {players.map(player => (
            <li key={player.user_id} className="truncate">
              <Link
                href={`/game/${competitionId}/table/${player.user_id}`}
                className={`font-data text-[14px] text-ink underline decoration-dotted underline-offset-[4px] hover:text-ink-fade ${player.is_me ? 'font-bold' : ''}`}
              >
                {player.display_name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="mt-4 border-t border-ink/30 pt-3 text-center">
      <button
        type="button"
        onClick={() => setShowNames(value => !value)}
        aria-expanded={showNames}
        className="text-[13px] text-ink hover:text-ink-fade"
      >
        <span className="font-data">{fixture.home_team} {crowd.home.length}</span>
        <span className="text-ink-fade"> &middot; </span>
        <span className="font-data">{fixture.away_team} {crowd.away.length}</span>
        {crowd.none.length > 0 && (
          <><span className="text-ink-fade"> &middot; </span><span className="text-ink-fade">not predicted {crowd.none.length}</span></>
        )}
        <span className={`${LABEL} ml-2 text-ink-fade underline decoration-dotted underline-offset-[4px]`}>
          {showNames ? 'Hide' : 'Who'}
        </span>
      </button>

      {showNames && (
        <div className="mt-3 grid grid-cols-2 gap-4 text-left">
          {column(fixture.home_team, fixture.home_team_short, crowd.home)}
          {column(fixture.away_team, fixture.away_team_short, crowd.away)}
          {crowd.none.length > 0 && (
            <div className="col-span-2">{column('Not predicted', null, crowd.none)}</div>
          )}
        </div>
      )}
    </div>
  );
}
