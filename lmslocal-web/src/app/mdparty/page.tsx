'use client';

/*
  Matchday Party — the phone screen (docs/matchday-party.md §3).

  ONE SCREEN FOR EVERY PLAYER, host included, and the same game whatever the number of players: the
  real engine and routes, 1 to MAX_PLAYERS (20) in a room. Playing alone is simply a room with only
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
import { partyApi, type PartyState, type PartyFixture } from '@/lib/api';
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

/** Points this prediction scored: 3 for the winner, 1 for a draw, 0 otherwise; null if blank or unplayed. */
function pointsFor(fixture: PartyFixture, predicted: number | undefined): number | null {
  if (!fixture.result || predicted === undefined) return null;
  const { home_goals: h, away_goals: a } = fixture.result;
  if (h === a) return 1;
  const winner = h > a ? fixture.home.id : fixture.away.id;
  return predicted === winner ? 3 : 0;
}

function Form({ form }: { form: ('W' | 'D' | 'L')[] }) {
  if (form.length === 0) return null;
  return (
    <span className="ml-2 inline-flex gap-0.5 align-middle">
      {form.map((f, i) => (
        <span
          key={i}
          className={`inline-flex h-4 w-4 items-center justify-center font-data text-[10px] ${
            f === 'W' ? 'bg-ink text-stock-lit' : f === 'L' ? 'border border-overprint text-overprint' : 'border border-ink/40 text-ink-fade'
          }`}
        >
          {f}
        </span>
      ))}
    </span>
  );
}

export default function PartyPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<PartyState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rounds, setRounds] = useState(6);
  const [coupon, setCoupon] = useState<Record<number, number>>({});
  const [couponRound, setCouponRound] = useState(0);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const versionRef = useRef<number | undefined>(undefined);

  // Players need no account, so there is no sign-in gate here; only creating a game asks for one.
  useEffect(() => {
    setSession(loadSession());
    const fromLink = new URLSearchParams(window.location.search).get('code');
    if (fromLink) setJoinCode(fromLink.toUpperCase());
  }, []);

  const refresh = useCallback(async (s: Session, force = false) => {
    try {
      const res = await partyApi.state(s.code, s.player_token, force ? undefined : versionRef.current);
      const data = res.data;
      if (data.return_code === 'PARTY_NOT_FOUND') {
        localStorage.removeItem(SESSION_KEY);
        setSession(null);
        setState(null);
        versionRef.current = undefined;
        return;
      }
      if (data.return_code !== 'SUCCESS' || data.unchanged) return;
      versionRef.current = data.room?.version;
      setState(data);
    } catch {
      // A missed poll is retried two seconds later; nothing to tell anyone.
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    refresh(session, true);
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
    setSession(s);
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
    localStorage.removeItem(SESSION_KEY);
    versionRef.current = undefined;
    setState(null);
    setSession(null);
    setConfirmEnd(false);
  };

  const room = state?.room;
  const me = state?.me;
  const isHost = me?.is_host === true;
  const round = state?.round;
  const submitted = state?.players?.find((p) => p.id === me?.player_id)?.submitted === true;

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

        {/* ------------------------------------------------------------ join */}
        {!session && (
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
              {[4, 6, 8].map((n) => (
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
              {isHost && room.state !== 'finished' && (
                confirmEnd ? (
                  <span className="flex items-center gap-3">
                    <button type="button" onClick={() => act(() => partyApi.end(room.code))} className={`${LABEL} text-overprint underline`}>
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
                )
              )}
            </div>

            {/* ------------------------------------------------------------ lobby */}
            {room.state === 'lobby' && (
              <section className={`${PANEL} mt-6 p-6 sm:p-8`}>
                <p className={`${LABEL} text-ink-fade`}>Room code</p>
                <p className="mt-2 font-data text-6xl tracking-[0.15em]">{room.code}</p>
                <p className="mt-4 text-[16px] text-ink-fade">
                  Everyone else opens <span className="font-data text-ink">lmslocal.co.uk/mdparty</span> on their
                  phone and puts this code in &mdash; up to 20 players. Playing on your own? Just start.
                </p>
                <p className={`${LABEL} mt-8 text-ink-fade`}>In the room</p>
                <ul className="mt-3 space-y-1.5">
                  {state?.players?.map((p) => (
                    <li key={p.id} className="text-[17px]">
                      {p.name}
                      {p.is_host && <span className={`${LABEL} ml-2 text-ink-fade`}>host</span>}
                    </li>
                  ))}
                </ul>
                {!isHost && <p className="mt-8 text-[16px]">Waiting for the host to start the game.</p>}
                {isHost && (
                  <button type="button" onClick={() => act(() => partyApi.start(room.code))} disabled={busy} className={`${BTN_PRIMARY} mt-8 px-7 py-3.5 text-2xl disabled:opacity-50`}>
                    Start the game
                  </button>
                )}
              </section>
            )}

            {/* ------------------------------------------------------------ coupon */}
            {room.state === 'open' && round && (
              <section className="mt-6">
                <h2 className={`${HEADING} text-4xl`}>Round {round.number}: who wins?</h2>
                <p className="mt-3 text-[16px] text-ink-fade">
                  Tap the winner of each match. A draw scores 1 whichever side you chose. Leave a
                  match blank and it scores 0.
                </p>
                <ul className="mt-6 divide-y divide-ink/30 border-y border-ink/30">
                  {round.fixtures.map((f) => (
                    <li key={f.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-3">
                      {(['home', 'away'] as const).map((side, i) => {
                        const team = f[side];
                        const chosen = coupon[f.id] === team.id;
                        const button = (
                          <button
                            key={side}
                            type="button"
                            onClick={() => setCoupon((c) => {
                              const next = { ...c };
                              if (next[f.id] === team.id) delete next[f.id];
                              else next[f.id] = team.id;
                              return next;
                            })}
                            className={`border px-3 py-3 text-left transition-colors ${chosen ? 'border-ink bg-ink text-stock-lit' : 'border-ink/30 hover:border-ink'} ${i === 1 ? 'text-right' : ''}`}
                          >
                            <span className="font-display text-xl uppercase tracking-[0.02em]">{team.name}</span>
                            <Form form={team.form} />
                          </button>
                        );
                        return i === 0 ? [button, <span key="v" className={`${LABEL} text-ink-fade`}>v</span>] : button;
                      })}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act(() => partyApi.setPredictions(room.code, session!.player_token, round.number,
                      Object.entries(coupon).map(([fixture_id, team_id]) => ({ fixture_id: Number(fixture_id), team_id }))))}
                    className={`${BTN_PRIMARY} px-7 py-3.5 text-2xl disabled:opacity-50`}
                  >
                    {submitted ? 'Send again' : 'Send predictions'}
                  </button>
                  <span className={`${LABEL} text-ink-fade`}>{Object.keys(coupon).length} of {round.fixtures.length} predicted</span>
                </div>
                {submitted && (
                  <p className="mt-4 text-[16px]">
                    Sent. Waiting for {state?.players?.filter((p) => !p.submitted).map((p) => p.name).join(', ') || 'the round to lock'}.
                  </p>
                )}
                {isHost && (
                  <button type="button" onClick={() => act(() => partyApi.lock(room.code))} disabled={busy} className={`${BTN_OUTLINE} mt-6`}>
                    Lock the round now
                  </button>
                )}
              </section>
            )}

            {/* ------------------------------------------------------------ results */}
            {(room.state === 'revealing' || room.state === 'table' || room.state === 'finished') && round && round.locked && (
              <section className="mt-6">
                <h2 className={`${HEADING} text-4xl`}>Round {round.number} results</h2>
                <ul className="mt-6 divide-y divide-ink/30 border-y border-ink/30">
                  {round.fixtures.map((f) => {
                    const predicted = round.my_predictions[String(f.id)];
                    const pts = pointsFor(f, predicted);
                    const minutes = (side: 'home' | 'away') =>
                      f.result!.goals.filter((g) => g.side === side).map((g) => `${g.minute}'`).join(' ');
                    return (
                      <li key={f.id} className="grid grid-cols-[1fr_auto_1fr_3rem] items-center gap-3 py-3">
                        <div className="text-right">
                          <p className={`font-display text-lg uppercase ${predicted === f.home.id ? 'underline decoration-overprint decoration-2 underline-offset-4' : ''}`}>{f.home.name}</p>
                          <p className="font-data text-[12px] text-ink-fade">{minutes('home')}</p>
                        </div>
                        <p className="font-data text-2xl">{f.result!.home_goals} &ndash; {f.result!.away_goals}</p>
                        <div>
                          <p className={`font-display text-lg uppercase ${predicted === f.away.id ? 'underline decoration-overprint decoration-2 underline-offset-4' : ''}`}>{f.away.name}</p>
                          <p className="font-data text-[12px] text-ink-fade">{minutes('away')}</p>
                        </div>
                        <p className={`text-right font-data text-lg ${pts === 3 ? 'text-overprint' : 'text-ink-fade'}`}>{pts === null ? '–' : `+${pts}`}</p>
                      </li>
                    );
                  })}
                </ul>
                <p className={`${LABEL} mt-3 text-ink-fade`}>Your prediction is underlined</p>
                {isHost && room.state === 'revealing' && (
                  <button type="button" onClick={() => act(() => partyApi.showTable(room.code))} disabled={busy} className={`${BTN_PRIMARY} mt-8 px-7 py-3.5 text-2xl disabled:opacity-50`}>
                    Show the tables
                  </button>
                )}
              </section>
            )}

            {/* ------------------------------------------------------------ tables */}
            {(room.state === 'table' || room.state === 'finished') && (
              <section className="mt-12 grid gap-10 sm:grid-cols-2">
                <div>
                  <h2 className={`${HEADING} text-3xl`}>{room.state === 'finished' ? 'Final table' : 'The table'}</h2>
                  <table className="mt-4 w-full text-left text-[15px]">
                    <thead>
                      <tr className={`${LABEL} text-ink-fade`}>
                        <th className="py-2">#</th><th>Player</th><th className="text-right">Round</th><th className="text-right">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state?.players_table?.map((p) => (
                        <tr key={p.player_id} className="border-t border-ink/20">
                          <td className="py-2 font-data">{p.position}</td>
                          <td>{p.name}</td>
                          <td className="text-right font-data text-ink-fade">+{p.round_points}</td>
                          <td className="text-right font-data text-lg">{p.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <h2 className={`${HEADING} text-3xl`}>The league</h2>
                  <table className="mt-4 w-full text-left text-[14px]">
                    <thead>
                      <tr className={`${LABEL} text-ink-fade`}>
                        <th className="py-1.5">#</th><th>Team</th><th className="text-right">P</th><th className="text-right">GD</th><th className="text-right">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state?.teams_table?.map((t) => (
                        <tr key={t.team_id} className="border-t border-ink/20">
                          <td className="py-1 font-data">{t.position}</td>
                          <td>{t.name}</td>
                          <td className="text-right font-data">{t.played}</td>
                          <td className="text-right font-data">{t.gd > 0 ? `+${t.gd}` : t.gd}</td>
                          <td className="text-right font-data">{t.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {isHost && room.state === 'table' && (
              <button type="button" onClick={() => act(() => partyApi.nextRound(room.code))} disabled={busy} className={`${BTN_PRIMARY} mt-10 px-7 py-3.5 text-2xl disabled:opacity-50`}>
                {room.current_round < room.rounds_total ? `Round ${room.current_round + 1}` : 'Finish the game'}
              </button>
            )}

            {room.state === 'finished' && (
              <section className={`${PANEL} mt-10 p-6`}>
                <p className="text-[17px]">
                  {room.ended_early ? 'The game was ended early.' : 'That is the game.'}
                  {state?.players_table?.[0] && !room.ended_early && <> Winner: <strong>{state.players_table[0].name}</strong>, {state.players_table[0].points} points.</>}
                </p>
                <button type="button" onClick={newGame} className={`${BTN_PRIMARY} mt-5 px-6 py-3 text-xl`}>
                  New game
                </button>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
