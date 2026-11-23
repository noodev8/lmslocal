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
*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { MatchdayCoupon, MatchdayFixture, MatchdayRoundPredictions, matchdayApi } from '@/lib/api';
import { useCompetitionGate } from '@/hooks/useCompetitionGate';
import CompetitionUnavailable from '@/components/CompetitionUnavailable';
import { LABEL, EYEBROW, HEADING, PANEL, BTN_PRIMARY, BTN_DARK, BTN_OUTLINE } from '@/lib/design';
import { GAME_NAMES, MATCHDAY_SCORING, formatKickoff, outcomeWord, signedPoints } from '@/lib/games';

// Long enough to see the team turn green before the strip moves on, short enough not to wait for.
const ADVANCE_DELAY_MS = 350;

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
  const [busyFixture, setBusyFixture] = useState<number | null>(null);
  const [current, setCurrent] = useState(0);
  // Everyone's predictions, once the round has locked (docs/matchday.md §8.6). Null before then,
  // and if it fails to load the cards simply go without it - it is extra, not the page.
  const [everyone, setEveryone] = useState<MatchdayRoundPredictions | null>(null);

  const stripRef = useRef<HTMLDivElement | null>(null);
  const placedOnce = useRef(false);
  const reducedMotion = useRef(false);
  // The move to the next card after a prediction is saved, while it is pending. Any other move
  // cancels it: a player who taps a team and then straight away taps Previous or the tracker meant
  // to go there, and must not be carried forward a moment later.
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The card on screen now, for tapTeam: its save is awaited, and by the time it returns the player
  // may have moved (Previous, the tracker, a swipe) - the `current` its closure saw is stale.
  const currentRef = useRef(0);

  useEffect(() => {
    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return () => { if (advanceTimer.current) clearTimeout(advanceTimer.current); };
  }, []);

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

  // Another round is another strip: start it from scratch.
  useEffect(() => {
    placedOnce.current = false;
  }, [requestedRound]);

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

  const goTo = useCallback((index: number, smooth = true) => {
    const strip = stripRef.current;
    if (!strip) return;
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    const clamped = Math.max(0, Math.min(index, fixtures.length - 1));
    strip.scrollTo({ left: clamped * strip.clientWidth, behavior: smooth && !reducedMotion.current ? 'smooth' : 'auto' });
    currentRef.current = clamped;
    setCurrent(clamped);
  }, [fixtures.length]);

  // Open on the first match still to predict, so a player who comes back mid-week lands on what is
  // missing rather than on match 1. Once only: after that, where they are is where they put it.
  useEffect(() => {
    if (!coupon || placedOnce.current || fixtures.length === 0) return;
    placedOnce.current = true;
    const firstMissing = open ? fixtures.findIndex(f => f.my_team === null) : -1;
    // After paint, so the strip has a width to scroll by.
    requestAnimationFrame(() => goTo(firstMissing > 0 ? firstMissing : 0, false));
  }, [coupon, open, fixtures, goTo]);

  // Keep the tracker in step with the strip however it was moved: a swipe, a trackpad, a key.
  const onStripScroll = () => {
    const strip = stripRef.current;
    if (!strip || strip.clientWidth === 0) return;
    const index = Math.round(strip.scrollLeft / strip.clientWidth);
    currentRef.current = index;
    if (index !== current) setCurrent(index);
  };

  // Arrow keys move between cards - never choose. Choosing is always a tap on a team.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') goTo(current - 1);
      if (e.key === 'ArrowRight') goTo(current + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, goTo]);

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
   * is predicted, and the strip moves on to the next match.
   */
  const tapTeam = async (index: number, team: string) => {
    const fixture = fixtures[index];
    if (!fixture || busyFixture !== null) return;
    const takingBack = fixture.my_team === team;
    setBusyFixture(fixture.fixture_id);
    setSaveError('');
    try {
      const res = takingBack
        ? await matchdayApi.clearPrediction(fixture.fixture_id)
        : await matchdayApi.setPrediction(fixture.fixture_id, team);
      if (res.data.return_code !== 'SUCCESS') {
        handleSaveFailure(res.data.return_code, res.data.message);
        return;
      }
      updateFixture(fixture.fixture_id, takingBack ? null : team);
      // Move on only from the card that was tapped. A player who went elsewhere while the save was
      // in flight, or in the moment before the move, meant to be there - checked both now and when
      // the timer fires, since a swipe does not pass through goTo to cancel it.
      if (!takingBack && index + 1 < fixtures.length && currentRef.current === index) {
        advanceTimer.current = setTimeout(() => {
          advanceTimer.current = null;
          if (currentRef.current === index) goTo(index + 1);
        }, ADVANCE_DELAY_MS);
      }
    } catch {
      setSaveError('That did not save. Check your connection and try again.');
    } finally {
      setBusyFixture(null);
    }
  };

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

      {/* The tracker. Segments, not a count: a player sees at a glance how many are left and
          where. Green means predicted; the word is in each segment's label for a screen reader. */}
      {coupon.is_player && (
        <div className="mb-2 flex gap-1" role="tablist" aria-label="Matches">
          {fixtures.map((f, index) => {
            const done = f.my_team !== null;
            return (
              <button
                key={f.fixture_id}
                type="button"
                role="tab"
                aria-selected={index === current}
                aria-label={`Match ${index + 1}: ${f.home_team} v ${f.away_team}, ${done ? 'predicted' : 'not predicted'}`}
                onClick={() => goTo(index)}
                className="group flex-1 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
              >
                <span
                  className={`block h-2 rounded-full transition-colors ${
                    done ? 'bg-moss' : 'bg-ink/15 group-hover:bg-ink/30'
                  } ${index === current ? 'ring-2 ring-ink ring-offset-2 ring-offset-stock' : ''}`}
                />
              </button>
            );
          })}
        </div>
      )}

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

      {/* The strip. Native scrolling with snap points: a swipe or a trackpad moves it, nothing
          chooses a team but a tap. */}
      <div
        ref={stripRef}
        onScroll={onStripScroll}
        className="flex snap-x snap-mandatory overflow-x-auto [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none' }}
      >
        {fixtures.map((fixture, index) => (
          <div
            key={fixture.fixture_id}
            className="w-full flex-none snap-center pb-2 pr-2"
          >
            <MatchCard
              fixture={fixture}
              position={index + 1}
              count={fixtures.length}
              editable={open}
              busy={busyFixture === fixture.fixture_id}
              explainScoring={explainScoring && open}
              isPlayer={coupon.is_player}
              onTap={(team) => tapTeam(index, team)}
              crowd={crowds.get(fixture.fixture_id) ?? null}
              competitionId={competitionId}
            />
          </div>
        ))}
      </div>

      {/* Previous / next, for a mouse. A finger has the swipe, but these cost nothing there. */}
      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => goTo(current - 1)}
          disabled={current === 0}
          className={`${LABEL} flex items-center gap-1 text-ink transition-colors hover:text-ink-fade disabled:invisible`}
        >
          <ChevronLeftIcon className="h-4 w-4" /> Previous
        </button>
        <span className="font-data text-[13px] text-ink-fade">{current + 1} of {fixtures.length}</span>
        <button
          type="button"
          onClick={() => goTo(current + 1)}
          disabled={current >= fixtures.length - 1}
          className={`${LABEL} flex items-center gap-1 text-ink transition-colors hover:text-ink-fade disabled:invisible`}
        >
          Next <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Done. On the last match the strip has nowhere left to go, and a player who has finished
          should not have to hunt for the small back link in the header. Shown on any card once
          every match is predicted, too. It goes to the game's home, as the back link does. Red while
          the round is open - finishing is the screen's next action - and ink once it is locked,
          when it is only the way out. Nothing to save: every tap was saved as it was made.
          Held back on an open last card until that match is predicted: offered before the
          tap, it reads as the way to finish and the last match gets skipped. */}
      {((current === fixtures.length - 1 && (!open || fixtures[current].my_team !== null)) || (open && allPredicted)) && (
        <div className="mt-6 text-center">
          {open && !allPredicted && (
            <p className="mb-3 text-[15px] text-ink-fade">
              <span className="font-data text-ink">{fixtures.length - coupon.predicted}</span>{' '}
              {fixtures.length - coupon.predicted === 1 ? 'match' : 'matches'} not predicted &mdash; they score 0.
              You can come back to them until the lock.
            </p>
          )}
          <Link
            href={`/game/${competitionId}`}
            className={`${open ? BTN_PRIMARY : BTN_DARK} block w-full px-6 py-3.5 text-xl`}
          >
            Done
          </Link>
        </div>
      )}

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

/**
 * One match. The two teams ARE the choice - no Home / Away buttons under a fixture line, which said
 * the same thing twice. Home team first, as a fixture is always written.
 */
type CrowdPlayer = { user_id: number; display_name: string; is_me: boolean };
type Crowd = { home: CrowdPlayer[]; away: CrowdPlayer[]; none: CrowdPlayer[] };

function MatchCard({
  fixture, position, count, editable, busy, explainScoring, isPlayer, onTap, crowd, competitionId,
}: {
  fixture: MatchdayFixture;
  position: number;
  count: number;
  editable: boolean;
  busy: boolean;
  explainScoring: boolean;
  /** An organiser who is not playing has no predictions, so "not predicted" says nothing true. */
  isPlayer: boolean;
  onTap: (team: string) => void;
  crowd: Crowd | null;
  competitionId: string;
}) {
  const resultText = fixture.result === null
    ? null
    : fixture.result === 'DRAW'
      ? 'Draw'
      : `${fixture.result === fixture.home_team_short ? fixture.home_team : fixture.away_team} won`;

  return (
    // The one print-offset shadow in the system belongs to "the sheet", and a card is exactly that.
    <div className={`${PANEL} p-5 shadow-[4px_4px_0_0_rgba(28,38,32,0.16)] sm:p-6`}>
      <div className="flex items-baseline justify-between">
        <p className={`${LABEL} text-ink-fade`}>Match {position} of {count}</p>
        <p className="font-data text-[13px] text-ink-fade">{formatKickoff(fixture.kickoff_time)}</p>
      </div>

      {editable && <p className={`${LABEL} mt-4 text-center text-ink`}>Who wins?</p>}

      <div className="mt-4 space-y-2">
        <TeamButton
          name={fixture.home_team}
          chosen={fixture.my_team === fixture.home_team_short}
          editable={editable}
          busy={busy}
          onClick={() => onTap(fixture.home_team_short)}
        />
        <p className={`${LABEL} text-center text-ink-fade`}>v</p>
        <TeamButton
          name={fixture.away_team}
          chosen={fixture.my_team === fixture.away_team_short}
          editable={editable}
          busy={busy}
          onClick={() => onTap(fixture.away_team_short)}
        />
      </div>

      {/* One statement under the teams (design-system §8). Every state carries its word as well as
          its colour. */}
      <div className="mt-4 min-h-[20px] text-center text-[13px]">
        {busy ? (
          <span className="text-ink-fade">Saving&hellip;</span>
        ) : fixture.settled && fixture.my_team !== null && fixture.my_points !== null ? (
          <span className="inline-flex items-center gap-1.5">
            {resultText && <span className="text-ink-fade">{resultText} &middot;</span>}
            <span className={`${LABEL} text-ink`}>{outcomeWord(fixture.my_team, fixture.result)}</span>
            <span className="font-data text-ink">{signedPoints(fixture.my_points)}</span>
          </span>
        ) : resultText ? (
          <span className="text-ink-fade">{resultText}{isPlayer && fixture.my_team === null ? ' · not predicted' : ''}</span>
        ) : editable ? (
          fixture.my_team !== null
            ? <span className="text-ink-fade">Tap it again to take it back</span>
            : explainScoring
              ? <span className={`${LABEL} text-ink`}>{MATCHDAY_SCORING}</span>
              : null
        ) : isPlayer && fixture.my_team === null ? (
          <span className="text-ink-fade">Not predicted &middot; scores 0</span>
        ) : null}
      </div>

      {crowd && <CrowdLine fixture={fixture} crowd={crowd} competitionId={competitionId} />}
    </div>
  );
}

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

function TeamButton({
  name, chosen, editable, busy, onClick,
}: {
  name: string; chosen: boolean; editable: boolean; busy: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!editable || busy}
      aria-pressed={chosen}
      aria-label={chosen ? `${name} (your prediction${editable ? ' - tap to take it back' : ''})` : editable ? `${name} to win` : name}
      className={`relative flex min-h-[64px] w-full items-center justify-center border px-4 py-3 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
        chosen
          ? 'border-2 border-moss bg-moss-wash'
          : !editable
            ? 'cursor-default border-ink/15'
            : 'cursor-pointer border-ink/30 hover:border-ink disabled:cursor-wait'
      }`}
    >
      <span className="font-data text-xl leading-tight text-ink">{name}</span>
    </button>
  );
}
