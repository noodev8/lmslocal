'use client';

/*
  Matchday Party — the phone screen (docs/matchday-party.md §3).

  ONE SCREEN FOR EVERY PLAYER, host included, and the same game whatever the number of players: the
  real engine and routes, 1 to MAX_PLAYERS (8) in a room. Playing alone is simply a room with only
  the host in it - there is no solo mode (Andreas, 2026-11-24).

  - The HOST creates the game (signed in; preview hosts only) and gets the controls.
  - EVERYONE ELSE joins with the room code and a name, no account. /mdparty?code=ABCDE fills the code in.

  Each device keeps its room code and player token in localStorage (mdparty_session), so a refresh
  carries on the same game. The page polls the room's state every two seconds with the version it
  already has, so an idle poll is one cheap read.

  Still to come (phases 3-4): the TV view with the vidiprinter and sound, and the finished design.
  Words follow docs/matchday.md §2: "predict" and "prediction", never "pick" or any betting word.
*/

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { partyApi, type PartyState, type PartyFixture, type PartyPlayersRow } from '@/lib/api';
import CardStrip, { type StripFixture, type TapOutcome } from '@/components/coupon/CardStrip';
import PhoneReveal from '@/components/mdparty/PhoneReveal';
import { Confetti } from '@/components/mdparty/Celebration';
import { clockOffset, ordinal, useRevealPosition } from '@/lib/mdpartyReveal';
import { outcomeWord, signedPoints } from '@/lib/games';
import { LABEL, EYEBROW, HEADING, PANEL, BTN_PRIMARY, BTN_OUTLINE } from '@/lib/design';

const SESSION_KEY = 'mdparty_session';
type Session = { code: string; player_token: string };

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

/*
  A party fixture as a card in the shared strip (components/coupon/CardStrip.tsx, the same cards as
  Matchday). Team ids are the keys. `chosen` comes from this phone's coupon while the round is open,
  and from the predictions the server holds once it has locked.
*/
function toStripFixture(f: PartyFixture, chosen: number | undefined, banker = false): StripFixture {
  const winner = !f.result || f.result.home_goals === f.result.away_goals
    ? null
    : f.result.home_goals > f.result.away_goals ? f.home : f.away;
  const score = f.result ? `${f.result.home_goals}–${f.result.away_goals}` : '';
  const resultKey = !f.result ? null : winner ? String(winner.id) : 'DRAW';
  const chosenKey = chosen === undefined ? null : String(chosen);
  const points = !f.result || chosenKey === null ? null : resultKey === 'DRAW' ? 1 : resultKey === chosenKey ? 3 : 0;
  return {
    id: f.id,
    home: { key: String(f.home.id), name: f.home.name, form: f.home.form },
    away: { key: String(f.away.id), name: f.away.name, form: f.away.form },
    chosen: chosenKey,
    banker,
    resultText: f.result ? (winner ? `${winner.name} won ${score}` : `Draw ${score}`) : null,
    outcome: points === null ? null : { word: outcomeWord(chosenKey, resultKey), points: signedPoints(points) },
  };
}

function League({ table, meId, final }: { table: PartyPlayersRow[]; meId: number | undefined; final: boolean }) {
  return (
    <div className="mt-8">
      <h2 className={`${HEADING} text-3xl`}>{final ? 'Final table' : 'The league'}</h2>
      <table className="mt-4 w-full text-left text-[16px]">
        <thead>
          <tr className={`${LABEL} text-ink-fade`}>
            <th className="py-2">#</th><th>Player</th><th className="text-right">Round</th><th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {table.map((p) => (
            <tr key={p.player_id} className={`border-t border-ink/20 ${p.player_id === meId ? 'font-semibold' : ''}`}>
              <td className="py-2 font-data">{p.position}</td>
              <td>{p.name}</td>
              <td className="text-right font-data text-moss">{p.round_points < 0 ? `\u2212${-p.round_points}` : `+${p.round_points}`}</td>
              <td className="text-right font-data text-lg">{p.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PartyPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<PartyState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rounds, setRounds] = useState(2);
  const [coupon, setCoupon] = useState<Record<number, number>>({});
  // This round's banker on this phone: one of the coupon's own predictions, or none (§2).
  const [banker, setBanker] = useState<number | null>(null);
  // The coupon is two steps: the cards, then the banker on a screen of its own (2026-11-25). A banker
  // button on each card went by too fast - the cards move on after a tap - and choosing a banker
  // means comparing the predictions, which one card at a time cannot show.
  const [step, setStep] = useState<'cards' | 'banker'>('cards');
  const [couponRound, setCouponRound] = useState(0);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const versionRef = useRef<number | undefined>(undefined);
  // This device's clock against the server's, so the reveal runs on the room's one clock (§6).
  const [offsetMs, setOffsetMs] = useState(0);

  // Arriving from the create wizard (/mdparty?new=1): the host means to start a game, so this opens
  // on the start screen rather than resuming. A game of theirs still in play is offered as a Resume
  // link, not entered - one game at a time, and creating a new one ends it (create-mdparty-room).
  const [startingNew, setStartingNew] = useState(false);
  const [resumable, setResumable] = useState<Session | null>(null);
  // Said on the start screen after the host ended a game, so ending is seen to have worked.
  const [notice, setNotice] = useState<string | null>(null);

  const forgetSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    versionRef.current = undefined;
    setState(null);
    setSession(null);
  }, []);

  // Players need no account, so there is no sign-in gate here; only creating a game asks for one.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromLink = params.get('code');
    if (fromLink) setJoinCode(fromLink.toUpperCase());
    const saved = loadSession();
    if (params.get('new') !== null) {
      setStartingNew(true);
      if (!saved) return;
      // Only a game still in play is worth resuming.
      partyApi.state(saved.code, saved.player_token)
        .then((res) => {
          const live = res.data.return_code === 'SUCCESS' && res.data.room && res.data.room.state !== 'finished';
          if (live) setResumable(saved);
          else localStorage.removeItem(SESSION_KEY);
        })
        .catch(() => {});
      return;
    }
    setSession(saved);
  }, []);

  /*
    dropIfFinished: a finished game is not reopened. Set when the page first loads a remembered game
    (coming back to /mdparty later starts afresh) - not on the live poll, so the final table of a
    game that has just finished stays on screen until the player leaves or presses New game.
  */
  const refresh = useCallback(async (s: Session, force = false, dropIfFinished = false) => {
    try {
      const res = await partyApi.state(s.code, s.player_token, force ? undefined : versionRef.current);
      const data = res.data;
      if (data.return_code === 'PARTY_NOT_FOUND' || (dropIfFinished && data.room?.state === 'finished')) {
        forgetSession();
        return;
      }
      if (data.return_code !== 'SUCCESS' || data.unchanged) return;
      versionRef.current = data.room?.version;
      const offset = clockOffset(data.server_now);
      if (offset !== null) setOffsetMs(offset);
      setState(data);
    } catch {
      // A missed poll is retried two seconds later; nothing to tell anyone.
    }
  }, [forgetSession]);

  useEffect(() => {
    if (!session) return;
    refresh(session, true, true);
    const id = setInterval(() => refresh(session), 2000);
    return () => clearInterval(id);
  }, [session, refresh]);

  // A fresh coupon for each round, seeded from anything already sent.
  useEffect(() => {
    const round = state?.round;
    if (!round || round.number === couponRound) return;
    const seeded: Record<number, number> = {};
    for (const [fixtureId, teamId] of Object.entries(round.my_predictions)) seeded[Number(fixtureId)] = teamId;
    setCoupon(seeded);
    setBanker(round.my_banker ?? null);
    setStep('cards');
    setCouponRound(round.number);
  }, [state?.round, couponRound]);

  const act = async (fn: () => Promise<{ data: { return_code: string; message?: string } }>) => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (res.data.return_code !== 'SUCCESS') setError(res.data.message || res.data.return_code);
      await refresh(session, true);
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const startSession = (s: Session) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    versionRef.current = undefined;
    setCouponRound(0);
    setResumable(null);
    setNotice(null);
    setSession(s);
  };

  // Ending is final: the game is forgotten on this device and the host is back at the start.
  const endGame = async () => {
    if (!session || !state?.room) return;
    setBusy(true);
    setError(null);
    try {
      const res = await partyApi.end(state.room.code);
      if (res.data.return_code === 'SUCCESS' || res.data.return_code === 'INVALID_STATE') {
        forgetSession();
        setConfirmEnd(false);
        setStartingNew(true);
        setNotice('Game ended.');
      } else {
        setError(res.data.message || res.data.return_code);
      }
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const joinGame = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await partyApi.join(joinCode.trim(), joinName);
      if (res.data.return_code === 'SUCCESS' && res.data.player_token) {
        startSession({ code: joinCode.trim().toUpperCase(), player_token: res.data.player_token });
      } else {
        setError(res.data.message || res.data.return_code);
      }
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const createGame = async () => {
    // The host is a signed-in user (§3); a player never needs to be.
    if (!localStorage.getItem('jwt_token')) {
      router.push('/login');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await partyApi.create(rounds);
      if (res.data.return_code === 'SUCCESS' && res.data.code && res.data.player_token) {
        startSession({ code: res.data.code, player_token: res.data.player_token });
      } else {
        setError(res.data.message || res.data.return_code);
      }
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const newGame = () => {
    forgetSession();
    setConfirmEnd(false);
    setStartingNew(true);
  };

  const room = state?.room;
  const me = state?.me;
  const isHost = me?.is_host === true;
  const round = state?.round;
  const submitted = state?.players?.find((p) => p.id === me?.player_id)?.submitted === true;
  const stillToSend = (state?.players ?? []).filter((p) => !p.submitted).map((p) => p.name);
  const everyoneSent = (state?.players?.length ?? 0) > 0 && stillToSend.length === 0;
  const lastRound = (room?.current_round ?? 0) >= (room?.rounds_total ?? 0);
  // The team this phone's banker is on, for the "Sent" line.
  const bankerFixture = banker === null ? undefined : state?.round?.fixtures.find((f) => f.id === banker);
  const bankerName = !bankerFixture || coupon[bankerFixture.id] === undefined
    ? null
    : coupon[bankerFixture.id] === bankerFixture.home.id ? bankerFixture.home.name : bankerFixture.away.name;
  // Whether the reveal has run its course, so the host's button can wait quietly until it has.
  const revealDone = useRevealPosition(round?.locked_at, offsetMs, round?.fixtures.length ?? 10, room?.state !== 'revealing', 500).phase === 'done';

  return (
    <div className="min-h-screen bg-stock font-body text-ink">
      <header className="border-b border-ink/30">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/dashboard" className={`${LABEL} text-ink-fade hover:text-ink`}>
            &larr; Dashboard
          </Link>
          <span className={`${LABEL} text-overprint`}>Matchday Party &middot; preview</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        {error && <p className="mb-6 border border-overprint p-3 text-[15px]">{error}</p>}
        {!session && notice && <p className="mb-6 border-l-2 border-ink/40 bg-stock-lit px-4 py-3 text-[16px]">{notice}</p>}

        {/* A game of the host's still in play, when they came to start a new one. */}
        {!session && resumable && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-ink/30 bg-stock-lit px-4 py-3">
            <p className="text-[16px]">
              You have a game in progress (<span className="font-data">{resumable.code}</span>). Starting a new one ends it.
            </p>
            <button type="button" onClick={() => startSession(resumable)} className={`${LABEL} text-ink underline decoration-dotted underline-offset-4 hover:text-overprint`}>
              Resume it &rarr;
            </button>
          </div>
        )}

        {/* ------------------------------------------------------------ join */}
        {!session && !startingNew && (
          <section className={`${PANEL} mb-8 p-6 sm:p-8`}>
            <p className={`${EYEBROW} text-overprint`}>Joining a game?</p>
            <h1 className={`${HEADING} mt-3 text-4xl`}>Put the code in</h1>
            <p className="mt-3 text-[16px] text-ink-fade">It is on the host&apos;s screen. No account needed.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="CODE"
                maxLength={5}
                autoComplete="off"
                aria-label="Room code"
                className="w-32 rounded-sm border border-ink/40 bg-stock px-3 py-3 font-data text-xl uppercase tracking-[0.15em] focus:border-ink focus:outline-none"
              />
              <input
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder="Your name"
                maxLength={20}
                autoComplete="off"
                aria-label="Your name"
                className="w-48 rounded-sm border border-ink/40 bg-stock px-3 py-3 text-[17px] focus:border-ink focus:outline-none"
              />
              <button
                type="button"
                onClick={joinGame}
                disabled={busy || joinCode.trim().length !== 5 || !joinName.trim()}
                className={`${BTN_PRIMARY} px-6 py-3 text-xl disabled:opacity-40`}
              >
                Join
              </button>
            </div>
          </section>
        )}

        {/* ------------------------------------------------------------ setup */}
        {!session && (
          <section className={`${PANEL} p-6 sm:p-8`}>
            <p className={`${EYEBROW} text-overprint`}>Hosting?</p>
            <h2 className={`${HEADING} mt-3 text-4xl`}>Start a Matchday Party</h2>
            <p className="mt-5 max-w-lg text-[17px] leading-relaxed">
              Predict the winner of ten made-up Premier League matches a round. Points go on a
              table. Most points after the last round wins.
            </p>
            <p className={`${LABEL} mt-8 text-ink-fade`}>How many rounds?</p>
            <div className="mt-3 flex gap-3" role="radiogroup" aria-label="How many rounds">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rounds === n}
                  onClick={() => setRounds(n)}
                  className={`h-14 w-16 border font-display text-2xl ${rounds === n ? 'border-ink bg-ink text-stock-lit' : 'border-ink/30 hover:border-ink'}`}
                >
                  {n}
                </button>
              ))}
            </div>
            <button type="button" onClick={createGame} disabled={busy} className={`${BTN_PRIMARY} mt-8 px-7 py-3.5 text-2xl disabled:opacity-50`}>
              Create the game
            </button>
          </section>
        )}

        {session && !room && <p className="text-ink-fade">Loading the game&hellip;</p>}

        {room && (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className={`${LABEL} text-ink-fade`}>
                  Game <span className="font-data text-ink">{room.code}</span>
                  {room.current_round > 0 && <> &middot; round {room.current_round} of {room.rounds_total}</>}
                </p>
              </div>
              {/* The host's controls, on every stage of the game: the TV can be opened at any point,
                  so its link is never only in the lobby (2026-11-25). */}
              {isHost && room.state !== 'finished' && (
                <span className="flex items-center gap-5">
                <a href={`/mdparty/tv?code=${room.code}`} target="_blank" rel="noopener noreferrer" className={`${LABEL} text-ink underline decoration-dotted underline-offset-4 hover:text-overprint`}>
                  Open TV screen &#8599;
                </a>
                {confirmEnd ? (
                  <span className="flex items-center gap-3">
                    <button type="button" onClick={endGame} disabled={busy} className={`${LABEL} text-overprint underline`}>
                      End the game
                    </button>
                    <button type="button" onClick={() => setConfirmEnd(false)} className={`${LABEL} text-ink-fade underline`}>
                      Keep playing
                    </button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirmEnd(true)} className={`${LABEL} text-ink-fade underline hover:text-ink`}>
                    End game
                  </button>
                )}
                </span>
              )}
            </div>

            {/* ------------------------------------------------------------ the end */}
            {/* First on the screen when the game is over: the winner gets "You won!" and confetti;
                everyone else where they finished and who won. No celebration for a game the host
                ended early - it was stopped, not won (2026-11-25). */}
            {room.state === 'finished' && (() => {
              const table = state?.players_table ?? [];
              const winners = table.filter((p) => p.position === 1);
              const mine = table.find((p) => p.player_id === me?.player_id);
              const iWon = !room.ended_early && mine?.position === 1;
              return (
                <section className={`${PANEL} relative mt-6 p-6 text-center sm:p-8`}>
                  {iWon && <Confetti pieces={60} />}
                  {room.ended_early ? (
                    <p className={`${HEADING} text-4xl`}>Game over</p>
                  ) : iWon ? (
                    <>
                      <p className="font-display text-lg uppercase tracking-[0.3em] text-overprint">{winners.length > 1 ? 'Joint champions' : 'Champion'}</p>
                      <p className="mt-1 font-display text-6xl uppercase leading-none">You won!</p>
                    </>
                  ) : (
                    <>
                      <p className={`${LABEL} text-ink-fade`}>You finished</p>
                      <p className="mt-1 font-display text-6xl uppercase leading-none">{mine ? `${ordinal(mine.position)}` : 'Full time'}</p>
                      {mine && table.length > 1 && <p className="mt-1 text-[16px] text-ink-fade">of {table.length}</p>}
                    </>
                  )}
                  {winners.length > 0 && (
                    <p className="mt-5 text-[17px]">
                      {room.ended_early ? 'Leading when it ended: ' : iWon ? '' : 'Winner: '}
                      {!iWon && <strong>{winners.map((w) => w.name).join(' & ')}</strong>}
                      {iWon && 'With '}
                      {winners[0].points} points.
                    </p>
                  )}
                  <button type="button" onClick={newGame} className={`${BTN_PRIMARY} mt-6 px-6 py-3 text-xl`}>
                    New game
                  </button>
                </section>
              );
            })()}

            {/* ------------------------------------------------------------ lobby */}
            {room.state === 'lobby' && (
              <section className={`${PANEL} mt-6 p-6 sm:p-8`}>
                <p className={`${LABEL} text-ink-fade`}>Room code</p>
                <p className="mt-2 font-data text-6xl tracking-[0.15em]">{room.code}</p>
                {!isHost && (
                  <p className="mt-4 text-[16px] text-ink-fade">You&apos;re in. The host starts the game when everyone is ready.</p>
                )}
                <p className={`${LABEL} mt-8 text-ink-fade`}>In the room</p>
                <ul className="mt-3 space-y-1.5">
                  {state?.players?.map((p) => (
                    <li key={p.id} className="text-[17px]">
                      {p.name}
                      {p.is_host && <span className={`${LABEL} ml-2 text-ink-fade`}>host</span>}
                    </li>
                  ))}
                </ul>
                {isHost && (
                  <ol className="mt-6 space-y-4 text-[16px]">
                    <li className="flex gap-3">
                      <span className="font-data text-overprint">1</span>
                      <span>
                        Put it on the TV: open <span className="font-data">lmslocal.co.uk/mdparty/tv</span> in the TV&apos;s
                        browser and type the code, or{' '}
                        <a href={`/mdparty/tv?code=${room.code}`} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-4 hover:text-overprint">
                          open the TV screen in a new tab
                        </a>
                        .
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-data text-overprint">2</span>
                      <span>Everyone joins on their phone, from the TV&apos;s QR code or the code above. A game is always six players: anyone joining takes a seat, and the seats nobody takes are filled for you.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-data text-overprint">3</span>
                      <span>Start when everyone is in. On your own? Start now: the other five seats are already filled.</span>
                    </li>
                  </ol>
                )}
                {!isHost && <p className="mt-8 text-[16px]">Waiting for the host to start the game.</p>}
                {isHost && (
                  <button type="button" onClick={() => act(() => partyApi.start(room.code))} disabled={busy} className={`${BTN_PRIMARY} mt-8 px-7 py-3.5 text-2xl disabled:opacity-50`}>
                    Start the game
                  </button>
                )}
              </section>
            )}

            {/* ------------------------------------------------------------ coupon */}
            {/* The same cards as Matchday. A tap only changes this phone's coupon; Done sends it,
                and the round locks once everyone's is in (or the host locks it). */}
            {room.state === 'open' && round && (
              <section className="mx-auto mt-6 max-w-xl">
                <p className={EYEBROW}>Round {round.number}</p>
                <h2 className={`${HEADING} mt-1 text-3xl`}>Your predictions</h2>
                {/* The host kicks off; the round never starts by itself (2026-11-25). Once everyone has
                    sent a coupon, Kick off is the host's next action, at the top where it is seen. */}
                {isHost && everyoneSent && (
                  <div className="mb-6 mt-4 border border-ink bg-stock-lit p-5 text-center">
                    <p className="font-display text-2xl uppercase">Everyone&apos;s in</p>
                    <button type="button" onClick={() => act(() => partyApi.lock(room.code))} disabled={busy} className={`${BTN_PRIMARY} mt-4 block w-full px-7 py-3.5 text-2xl disabled:opacity-50`}>
                      Kick off
                    </button>
                  </div>
                )}
                <p className="mb-4 mt-3 text-[15px] text-ink-fade">
                  {!submitted
                    ? 'Tap the team you think will win.'
                    : stillToSend.length > 0
                      ? <>Sent{bankerName ? <> &middot; banker &#9733; {bankerName}</> : ''}. Waiting for {stillToSend.join(', ')}. You can change yours and send again until kick-off.</>
                      : isHost
                        ? <>Sent. You can still change yours and send again before you kick off.</>
                        : <>Sent. Waiting for the host to kick off.</>}
                </p>
                {step === 'cards' && (
                <CardStrip
                  fixtures={round.fixtures.map((f) => toStripFixture(f, coupon[f.id], banker === f.id))}
                  editable
                  placementKey={round.number}
                  onTap={(index, teamKey): TapOutcome => {
                    const fixtureId = round.fixtures[index].id;
                    const teamId = Number(teamKey);
                    const takingBack = coupon[fixtureId] === teamId;
                    setCoupon((c) => {
                      const next = { ...c };
                      if (takingBack) delete next[fixtureId];
                      else next[fixtureId] = teamId;
                      return next;
                    });
                    // A banker on a match taken back goes with it: there is nothing left to bank.
                    if (takingBack && banker === fixtureId) setBanker(null);
                    return takingBack ? 'cleared' : 'chosen';
                  }}
                  requireAll
                  done={{
                    // Every match is picked (§2), then the banker.
                    label: 'Next: your banker',
                    busy,
                    onClick: () => {
                      setStep('banker');
                      window.scrollTo({ top: 0 });
                    },
                  }}
                />
                )}

                {/* The banker: one decision, with every prediction in view. */}
                {step === 'banker' && (
                  <div className={`${PANEL} p-5 sm:p-6`}>
                    <p className={`${HEADING} text-3xl`}>&#9733; Your banker</p>
                    <p className="mt-2 text-[16px] text-ink">
                      Doubles whatever this pick scores. One a round.
                    </p>
                    <ul className="mt-5 space-y-2" role="radiogroup" aria-label="Your banker">
                      {round.fixtures.filter((f) => coupon[f.id] !== undefined).map((f) => {
                        const team = coupon[f.id] === f.home.id ? f.home : f.away;
                        const other = team.id === f.home.id ? f.away : f.home;
                        const chosen = banker === f.id;
                        return (
                          <li key={f.id}>
                            <button
                              type="button"
                              role="radio"
                              aria-checked={chosen}
                              onClick={() => setBanker(chosen ? null : f.id)}
                              className={`flex w-full items-baseline justify-between gap-3 border px-4 py-3 text-left transition-colors ${
                                chosen ? 'border-2 border-overprint bg-stock-lit' : 'border-ink/30 hover:border-ink'
                              }`}
                            >
                              <span>
                                <span className="font-display text-xl uppercase">{team.name}</span>
                                <span className="ml-2 text-[14px] text-ink-fade">{team.id === f.home.id ? 'v' : 'at'} {other.name}</span>
                              </span>
                              <span className={`${LABEL} ${chosen ? 'text-overprint' : 'text-ink-fade'}`}>{chosen ? '\u2605 Banker' : '\u2606'}</span>
                            </button>
                          </li>
                        );
                      })}
                      <li>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={banker === null}
                          onClick={() => setBanker(null)}
                          className={`w-full border px-4 py-3 text-left ${banker === null ? 'border-2 border-ink bg-stock-lit' : 'border-dashed border-ink/30 hover:border-ink'}`}
                        >
                          <span className={LABEL}>No banker this round</span>
                        </button>
                      </li>
                    </ul>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        await act(() => partyApi.setPredictions(room.code, session!.player_token, round.number,
                          Object.entries(coupon).map(([fixture_id, team_id]) => ({ fixture_id: Number(fixture_id), team_id })),
                          banker !== null && coupon[banker] !== undefined ? banker : null));
                        setStep('cards');
                      }}
                      className={`${BTN_PRIMARY} mt-6 block w-full px-6 py-3.5 text-xl disabled:opacity-50`}
                    >
                      {submitted ? 'Send again' : 'Send'}
                    </button>
                    <button type="button" onClick={() => setStep('cards')} className={`${LABEL} mt-4 block w-full text-center text-ink-fade underline decoration-dotted underline-offset-4 hover:text-ink`}>
                      &larr; Back to the matches
                    </button>
                  </div>
                )}
                {isHost && !everyoneSent && (
                  <button type="button" onClick={() => act(() => partyApi.lock(room.code))} disabled={busy} className={`${BTN_OUTLINE} mt-8`}>
                    Kick off now &middot; {stillToSend.length} still to send
                  </button>
                )}
              </section>
            )}

            {/* ------------------------------------------------------------ reveal */}
            {/* On the phone, one match at a time: this player's team in it, the score, their running
                total (§6). The room watches the match itself on the TV (/mdparty/tv). The host's
                button moves every screen on - quietly during the reveal, which is how it is skipped,
                and as the main action once every result is in. */}
            {room.state === 'revealing' && round && round.locked && (
              <section className="mx-auto mt-6 max-w-xl">
                <p className={EYEBROW}>Round {round.number}</p>
                <div className="mt-4">
                  <PhoneReveal
                    key={round.number}
                    fixtures={round.fixtures}
                    predictions={round.my_predictions}
                    banker={round.my_banker}
                    lockedAt={round.locked_at}
                    offsetMs={offsetMs}
                    table={state?.players_table ?? []}
                    crowd={round.crowd}
                    playerId={me?.player_id}
                  />
                </div>
                {/* Once the results are in, the league is here too - nobody has to be watching the TV -
                    and the host's one button starts the next round, or shows the champion after the
                    last. No tables step in between (2026-11-25): it was a press for nothing. */}
                {revealDone && <League table={state?.players_table ?? []} meId={me?.player_id} final={false} />}
                {isHost ? (
                  revealDone ? (
                    <button type="button" onClick={() => act(() => lastRound ? partyApi.showTable(room.code) : partyApi.nextRound(room.code))} disabled={busy} className={`${BTN_PRIMARY} mt-8 block w-full px-7 py-3.5 text-2xl disabled:opacity-50`}>
                      {lastRound ? 'Show the champion' : 'Next round'}
                    </button>
                  ) : (
                    <button type="button" onClick={() => act(() => lastRound ? partyApi.showTable(room.code) : partyApi.nextRound(room.code))} disabled={busy} className={`${LABEL} mt-8 block w-full text-center text-ink-fade underline decoration-dotted underline-offset-4 hover:text-ink`}>
                      {lastRound ? 'Skip to the champion' : 'Skip to the next round'}
                    </button>
                  )
                ) : revealDone ? (
                  <p className="mt-8 text-center text-[16px] text-ink-fade">
                    {lastRound ? 'Waiting for the host to show the champion.' : 'Waiting for the host to start the next round.'}
                  </p>
                ) : null}
              </section>
            )}

            {/* No results cards after the reveal: nobody looks back at them, only at the tables
                (2026-11-25). */}

            {/* ------------------------------------------------------------ tables */}
            {/* The players' league only; the teams' league is gone from every screen (2026-11-25).
                A room reaches 'table' only from an older flow now: the host goes from the reveal
                straight to the next round. */}
            {(room.state === 'table' || room.state === 'finished') && (
              <section className="mx-auto max-w-xl">
                <League table={state?.players_table ?? []} meId={me?.player_id} final={room.state === 'finished'} />
              </section>
            )}

            {!isHost && room.state === 'table' && (
              <p className="mt-10 text-[16px] text-ink-fade">Waiting for the host to start the next round.</p>
            )}
            {isHost && room.state === 'table' && (
              <button type="button" onClick={() => act(() => partyApi.nextRound(room.code))} disabled={busy} className={`${BTN_PRIMARY} mt-10 px-7 py-3.5 text-2xl disabled:opacity-50`}>
                {room.current_round < room.rounds_total ? `Round ${room.current_round + 1}` : 'Finish the game'}
              </button>
            )}

          </>
        )}
      </main>
    </div>
  );
}
