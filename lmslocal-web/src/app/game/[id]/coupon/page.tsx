'use client';

/*
/game/[id]/coupon - a Matchday player's coupon for a round (docs/matchday.md §8.2).

Two views of one thing:
  - THE DECK: one card per match, Home / Away / Skip. How a coupon gets filled in - quick on a
    phone, one decision at a time. Swiping is a shortcut; the buttons are always there, because a
    desktop has no swipe and a gesture alone is not accessible.
  - THE COUPON: every match on one sheet, with what was predicted. The game's home while a round is
    open: a player who comes back mid-week sees what is done and what is missing, and can change
    any of it until the lock.

The deck opens by itself only when nothing has been predicted yet. After the last card, or any time
a player leaves it, they land on the coupon.

Each answer is saved as it is given (set-prediction), so a player who stops halfway keeps what
they did. Saving is not optimistic: the card moves on once the server has the answer, because a
prediction that silently failed would cost real points.
*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { MatchdayCoupon, MatchdayFixture, matchdayApi } from '@/lib/api';
import { useCompetitionGate } from '@/hooks/useCompetitionGate';
import CompetitionUnavailable from '@/components/CompetitionUnavailable';
import { LABEL, EYEBROW, HEADING, PANEL, BTN_PRIMARY, BTN_OUTLINE } from '@/lib/design';
import { GAME_NAMES, MATCHDAY_SCORING, formatKickoff, outcomeWord, signedPoints } from '@/lib/games';

// How far a card must be dragged before it counts as an answer. Far enough that scrolling the page
// with a thumb never chooses a team by accident.
const SWIPE_THRESHOLD_PX = 90;

type Side = 'home' | 'away';

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

  // The deck: the fixture ids to go through, and where we are in them. Null means the coupon view.
  const [deck, setDeck] = useState<number[] | null>(null);
  const [deckIndex, setDeckIndex] = useState(0);
  const deckOpenedOnce = useRef(false);

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
        setLoadError(res.data.message || 'This coupon could not be loaded.');
      }
    } catch {
      setLoadError('This coupon could not be loaded. Check your connection and try again.');
    }
  }, [competitionId, requestedRound]);

  useEffect(() => {
    if (competition?.game_type === 'matchday') load();
  }, [competition?.game_type, load]);

  const round = coupon?.round ?? null;
  const open = round !== null && !round.locked && coupon?.is_player === true;
  const fixtures = useMemo(() => coupon?.fixtures ?? [], [coupon]);

  // Open the deck by itself the first time, and only when the coupon is untouched - someone who
  // has already predicted six matches came back to see or change them, not to start over.
  useEffect(() => {
    if (!coupon || deckOpenedOnce.current) return;
    deckOpenedOnce.current = true;
    if (open && coupon.predicted === 0 && fixtures.length > 0) {
      setDeck(fixtures.map(f => f.fixture_id));
      setDeckIndex(0);
    }
  }, [coupon, open, fixtures]);

  const updateFixture = (fixtureId: number, myTeam: string | null) => {
    setCoupon(current => {
      if (!current) return current;
      const next = current.fixtures.map(f => (f.fixture_id === fixtureId ? { ...f, my_team: myTeam } : f));
      return { ...current, fixtures: next, predicted: next.filter(f => f.my_team !== null).length };
    });
  };

  const handleSaveFailure = (code: string | undefined, message: string | undefined) => {
    if (code === 'ROUND_LOCKED') {
      setSaveError('This round has locked - predictions can no longer change.');
      setDeck(null);
      load();
    } else {
      setSaveError(message || 'That did not save. Try again.');
    }
  };

  /** Choose a side. Returns true once the server has it. */
  const chooseTeam = async (fixture: MatchdayFixture, side: Side): Promise<boolean> => {
    const team = side === 'home' ? fixture.home_team_short : fixture.away_team_short;
    if (fixture.my_team === team) return true;
    setBusyFixture(fixture.fixture_id);
    setSaveError('');
    try {
      const res = await matchdayApi.setPrediction(fixture.fixture_id, team);
      if (res.data.return_code === 'SUCCESS') {
        updateFixture(fixture.fixture_id, team);
        return true;
      }
      handleSaveFailure(res.data.return_code, res.data.message);
      return false;
    } catch {
      setSaveError('That did not save. Check your connection and try again.');
      return false;
    } finally {
      setBusyFixture(null);
    }
  };

  /** Skip a match: clears any prediction on it, so it scores 0. */
  const skipFixture = async (fixture: MatchdayFixture): Promise<boolean> => {
    if (fixture.my_team === null) return true;
    setBusyFixture(fixture.fixture_id);
    setSaveError('');
    try {
      const res = await matchdayApi.clearPrediction(fixture.fixture_id);
      if (res.data.return_code === 'SUCCESS') {
        updateFixture(fixture.fixture_id, null);
        return true;
      }
      handleSaveFailure(res.data.return_code, res.data.message);
      return false;
    } catch {
      setSaveError('That did not save. Check your connection and try again.');
      return false;
    } finally {
      setBusyFixture(null);
    }
  };

  const advanceDeck = () => {
    if (!deck) return;
    if (deckIndex + 1 >= deck.length) {
      setDeck(null);
    } else {
      setDeckIndex(deckIndex + 1);
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
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
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

  if (!round) {
    return shell(
      <div className={`${PANEL} p-6 text-center`}>
        <p className={EYEBROW}>No round yet</p>
        <p className="mt-2 text-[17px] text-ink">The first round&apos;s matches aren&apos;t out yet.</p>
        <p className="mt-1 text-[15px] text-ink-fade">They&apos;ll appear here as soon as they are.</p>
      </div>
    );
  }

  // ------------------------------------------------------------------ the deck
  if (deck && open) {
    const fixture = fixtures.find(f => f.fixture_id === deck[deckIndex]);
    if (fixture) {
      return shell(
        <>
          {saveError && <ErrorLine message={saveError} />}
          <DeckCard
            key={fixture.fixture_id}
            fixture={fixture}
            position={deckIndex + 1}
            count={deck.length}
            busy={busyFixture === fixture.fixture_id}
            onChoose={async (side) => { if (await chooseTeam(fixture, side)) advanceDeck(); }}
            onSkip={async () => { if (await skipFixture(fixture)) advanceDeck(); }}
            onPrevious={deckIndex > 0 ? () => setDeckIndex(deckIndex - 1) : null}
          />
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setDeck(null)}
              className={`${LABEL} text-ink-fade underline decoration-dotted underline-offset-[6px] hover:text-ink`}
            >
              See the whole coupon
            </button>
          </div>
        </>
      );
    }
  }

  // ------------------------------------------------------------------ the coupon
  const unpredicted = fixtures.filter(f => f.my_team === null).map(f => f.fixture_id);
  const settledCount = fixtures.filter(f => f.settled).length;
  const roundPoints = fixtures.reduce((sum, f) => sum + (f.my_points ?? 0), 0);

  return shell(
    <>
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className={EYEBROW}>Round {round.round_number}</p>
          <h1 className={`${HEADING} mt-1 text-3xl`}>{coupon.is_player ? 'Your coupon' : 'The coupon'}</h1>
        </div>
        <div className="text-right">
          <p className={`${LABEL} text-ink-fade`}>{round.locked ? 'Locked' : 'Locks'}</p>
          <p className="font-data text-[15px] text-ink">{formatKickoff(round.lock_time)}</p>
        </div>
      </div>

      {saveError && <ErrorLine message={saveError} />}

      {/* Where this coupon stands, in one line, and the way back into the deck while there is
          anything left to predict. */}
      <div className={`${PANEL} mb-4 flex flex-wrap items-center justify-between gap-3 p-4`}>
        <p className="text-[17px] text-ink">
          {!coupon.is_player
            ? 'You organise this one without playing.'
            : open
              ? <><span className="font-data">{coupon.predicted}</span> of {coupon.total_fixtures} predicted</>
              : settledCount === 0
                ? <>You predicted <span className="font-data">{coupon.predicted}</span> of {coupon.total_fixtures}. Matches in play.</>
                : <>This round: <span className="font-data">{signedPoints(roundPoints)}</span>
                    <span className="text-ink-fade"> &middot; {settledCount} of {coupon.total_fixtures} results in</span></>}
        </p>
        {open && unpredicted.length > 0 && (
          <button
            type="button"
            onClick={() => { setDeck(unpredicted); setDeckIndex(0); }}
            className={`${BTN_PRIMARY} px-5 py-2.5 text-base`}
          >
            {coupon.predicted === 0 ? 'Start the cards' : `Predict the other ${unpredicted.length}`}
          </button>
        )}
      </div>

      <div className={`${PANEL} divide-y divide-ink/30`}>
        {fixtures.map(fixture => (
          <CouponRow
            key={fixture.fixture_id}
            fixture={fixture}
            editable={open}
            busy={busyFixture === fixture.fixture_id}
            onChoose={(side) => chooseTeam(fixture, side)}
            onSkip={() => skipFixture(fixture)}
          />
        ))}
      </div>

      {open && (
        <p className="mt-5 text-center text-[15px] text-ink-fade">
          {MATCHDAY_SCORING}. A match you skip scores nothing either way.
        </p>
      )}

      {/* Earlier rounds. A link per direction rather than a picker: looking back is occasional. */}
      <div className="mt-6 flex items-center justify-between">
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

/** One team as a tile, in the style of the LMS pick screen so the two read as one product. */
function TeamTile({
  name, chosen, disabled, onClick, label,
}: {
  name: string; chosen: boolean; disabled: boolean; onClick: () => void; label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={chosen}
      aria-label={`${label}: ${name}${chosen ? ' (predicted)' : ''}`}
      className={`relative flex min-h-[64px] flex-1 items-center justify-center border p-3 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
        chosen
          ? 'border-2 border-moss bg-moss-wash'
          : disabled
            ? 'cursor-default border-ink/15'
            : 'cursor-pointer border-ink/30 hover:border-ink disabled:cursor-wait'
      }`}
    >
      {chosen && (
        <span className={`${LABEL} absolute left-0 top-0 bg-moss px-2 py-1 text-[11px] text-stock-lit`}>Predicted</span>
      )}
      <span className="text-sm font-medium leading-tight text-ink sm:text-base">{name}</span>
    </button>
  );
}

function CouponRow({
  fixture, editable, busy, onChoose, onSkip,
}: {
  fixture: MatchdayFixture; editable: boolean; busy: boolean; onChoose: (side: Side) => void; onSkip: () => void;
}) {
  const homeChosen = fixture.my_team === fixture.home_team_short;
  const awayChosen = fixture.my_team === fixture.away_team_short;
  const resultText = fixture.result === null
    ? null
    : fixture.result === 'DRAW'
      ? 'Draw'
      : `${fixture.result === fixture.home_team_short ? fixture.home_team : fixture.away_team} won`;

  return (
    <div className="p-3 sm:p-4">
      <div className="flex items-center gap-2 sm:gap-4">
        <TeamTile name={fixture.home_team} label="Home" chosen={homeChosen} disabled={!editable || busy} onClick={() => onChoose('home')} />
        <span className={`${LABEL} flex-shrink-0 text-ink-fade`}>v</span>
        <TeamTile name={fixture.away_team} label="Away" chosen={awayChosen} disabled={!editable || busy} onClick={() => onChoose('away')} />
      </div>

      {/* One statement per row (design-system §8): what it meant for you if you predicted a team,
          otherwise what happened. Every state carries its word as well as its colour. */}
      <div className="mt-2 flex items-center justify-between gap-3 text-[13px]">
        <span className="font-data text-ink-fade">{formatKickoff(fixture.kickoff_time)}</span>
        {busy ? (
          <span className="text-ink-fade">Saving&hellip;</span>
        ) : fixture.settled && fixture.my_team !== null && fixture.my_points !== null ? (
          <span className="flex items-center gap-1.5">
            <span className={`h-2 w-2 flex-none rounded-full ${
              fixture.my_points > 1 ? 'bg-moss' : fixture.my_points < 0 ? 'bg-overprint' : 'bg-ink/40'
            }`} />
            <span className={`${LABEL} text-ink`}>{outcomeWord(fixture.my_points)}</span>
            <span className="font-data text-ink">{signedPoints(fixture.my_points)}</span>
          </span>
        ) : resultText ? (
          <span className="text-ink-fade">{resultText}{fixture.my_team === null ? ' · not predicted' : ''}</span>
        ) : editable && fixture.my_team !== null ? (
          <button
            type="button"
            onClick={onSkip}
            disabled={busy}
            className={`${LABEL} text-ink-fade underline decoration-dotted underline-offset-[4px] hover:text-ink`}
          >
            Skip this one
          </button>
        ) : fixture.my_team === null ? (
          <span className="text-ink-fade">{editable ? 'Not predicted' : 'Not predicted · scores 0'}</span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * One match as a card. Buttons for Home, Away and Skip are the controls; dragging the card left
 * (towards the home team) or right (towards the away team) is a shortcut, as are the arrow keys.
 */
function DeckCard({
  fixture, position, count, busy, onChoose, onSkip, onPrevious,
}: {
  fixture: MatchdayFixture;
  position: number;
  count: number;
  busy: boolean;
  onChoose: (side: Side) => void;
  onSkip: () => void;
  onPrevious: (() => void) | null;
}) {
  const [dragX, setDragX] = useState(0);
  const dragStart = useRef<number | null>(null);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Arrow keys, for a keyboard on a desktop: left chooses the home team, right the away team.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (busy) return;
      if (e.key === 'ArrowLeft') onChoose('home');
      if (e.key === 'ArrowRight') onChoose('away');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onChoose]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (busy || e.pointerType === 'mouse') return; // a mouse has the buttons; dragging is for thumbs
    dragStart.current = e.clientX;
    // Keep the drag ours if the thumb wanders off the card, or the release is never seen.
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragStart.current === null) return;
    setDragX(e.clientX - dragStart.current);
  };
  const onPointerEnd = () => {
    if (dragStart.current === null) return;
    dragStart.current = null;
    const dx = dragX;
    setDragX(0);
    if (dx <= -SWIPE_THRESHOLD_PX) onChoose('home');
    else if (dx >= SWIPE_THRESHOLD_PX) onChoose('away');
  };

  const leaning: Side | null = dragX <= -SWIPE_THRESHOLD_PX / 2 ? 'home' : dragX >= SWIPE_THRESHOLD_PX / 2 ? 'away' : null;
  const homeChosen = fixture.my_team === fixture.home_team_short;
  const awayChosen = fixture.my_team === fixture.away_team_short;

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-3 flex items-baseline justify-between">
        <p className={`${LABEL} text-ink-fade`}>Match {position} of {count}</p>
        <p className="font-data text-[13px] text-ink-fade">{formatKickoff(fixture.kickoff_time)}</p>
      </div>

      {/* The card. The one print-offset shadow in the system belongs to "the sheet", and a card
          held in the hand is exactly that. touch-action: pan-y keeps vertical scrolling native
          while a horizontal drag is ours. */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        style={{
          transform: reducedMotion.current ? undefined : `translateX(${dragX}px) rotate(${dragX / 30}deg)`,
          touchAction: 'pan-y',
        }}
        className={`${PANEL} select-none p-6 shadow-[4px_4px_0_0_rgba(28,38,32,0.16)] ${dragX === 0 ? 'transition-transform duration-200' : ''}`}
      >
        <p className={`${LABEL} text-center text-ink-fade`}>Who wins?</p>

        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <p className={`text-center font-data text-xl leading-tight ${leaning === 'home' ? 'text-moss' : 'text-ink'}`}>{fixture.home_team}</p>
          <span className={`${LABEL} text-ink-fade`}>v</span>
          <p className={`text-center font-data text-xl leading-tight ${leaning === 'away' ? 'text-moss' : 'text-ink'}`}>{fixture.away_team}</p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => onChoose('home')}
            aria-pressed={homeChosen}
            className={`rounded-sm border px-3 py-3 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-wait ${
              homeChosen ? 'border-2 border-moss bg-moss-wash' : 'border-ink hover:bg-ink hover:text-stock-lit'
            }`}
          >
            <span className={`${LABEL} block`}>Home</span>
            <span className="mt-0.5 block text-[13px]">{fixture.home_team_short} to win</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onChoose('away')}
            aria-pressed={awayChosen}
            className={`rounded-sm border px-3 py-3 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-wait ${
              awayChosen ? 'border-2 border-moss bg-moss-wash' : 'border-ink hover:bg-ink hover:text-stock-lit'
            }`}
          >
            <span className={`${LABEL} block`}>Away</span>
            <span className="mt-0.5 block text-[13px]">{fixture.away_team_short} to win</span>
          </button>
        </div>

        <p className={`${LABEL} mt-5 text-center text-ink`}>{MATCHDAY_SCORING}</p>
        {busy && <p className="mt-2 text-center text-[13px] text-ink-fade">Saving&hellip;</p>}
      </div>

      <div className="mt-4 flex items-center justify-between">
        {onPrevious ? (
          <button type="button" onClick={onPrevious} disabled={busy} className={`${LABEL} text-ink-fade hover:text-ink`}>
            &larr; Previous
          </button>
        ) : <span />}
        <button
          type="button"
          onClick={onSkip}
          disabled={busy}
          className={`${LABEL} text-ink underline decoration-dotted underline-offset-[6px] hover:text-ink-fade`}
        >
          Skip &mdash; scores 0
        </button>
      </div>
      <p className="mt-3 text-center text-[13px] text-ink-fade">Swipe the card towards a team, or use the buttons.</p>
    </div>
  );
}
