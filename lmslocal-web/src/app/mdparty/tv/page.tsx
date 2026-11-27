'use client';

/*
  Matchday Party — the TV screen (docs/matchday-party.md §3, §6).

  READ-ONLY AND SHARED. It shows the whole room what is happening and nobody's private view: the
  room code and a QR code to join, who has sent their coupon (never what they chose), the reveal on
  every match with its live score, then the tables. It holds no token and can do nothing; a refresh
  loses nothing. Open it on a laptop on HDMI, a smart TV's browser, or a tab cast to the TV.

  It follows the room by polling the same state as the phones, with the version it already has, so an
  idle poll is one cheap read. Big type throughout: it is read from across a room.
*/

import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { partyApi, type PartyState } from '@/lib/api';
import { LABEL, EYEBROW, HEADING } from '@/lib/design';
import TvReveal from '@/components/mdparty/TvReveal';
import { clockOffset } from '@/lib/mdpartyReveal';
import { Confetti, useFanfare } from '@/components/mdparty/Celebration';

export default function PartyTvPage() {
  const [code, setCode] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [state, setState] = useState<PartyState | null>(null);
  const [missing, setMissing] = useState(false);
  const [offsetMs, setOffsetMs] = useState(0);
  const [qr, setQr] = useState<string | null>(null);
  const versionRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const fromLink = new URLSearchParams(window.location.search).get('code');
    if (fromLink) setCode(fromLink.trim().toUpperCase());
  }, []);

  const refresh = useCallback(async (c: string) => {
    try {
      const res = await partyApi.state(c, undefined, versionRef.current);
      const data = res.data;
      if (data.return_code === 'PARTY_NOT_FOUND') { setMissing(true); return; }
      if (data.return_code !== 'SUCCESS' || data.unchanged) return;
      setMissing(false);
      versionRef.current = data.room?.version;
      const offset = clockOffset(data.server_now);
      if (offset !== null) setOffsetMs(offset);
      setState(data);
    } catch {
      // Retried on the next poll.
    }
  }, []);

  useEffect(() => {
    if (!code) return;
    versionRef.current = undefined;
    refresh(code);
    const id = setInterval(() => refresh(code), 2000);
    return () => clearInterval(id);
  }, [code, refresh]);

  // The QR code a phone scans to join: /mdparty with the code filled in.
  useEffect(() => {
    if (!code) return;
    QRCode.toDataURL(`${window.location.origin}/mdparty?code=${code}`, { margin: 1, width: 320, color: { dark: '#1c2620', light: '#00000000' } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [code]);

  const room = state?.room;
  const round = state?.round;

  // No code yet: one box, typed on the TV's own keyboard or remote.
  if (!code) {
    return (
      <Screen>
        <div className="mx-auto max-w-xl pt-[12vh] text-center">
          <p className={`${EYEBROW} text-overprint`}>Matchday Party &middot; TV screen</p>
          <h1 className={`${HEADING} mt-4 text-6xl`}>Type the game code</h1>
          <form
            onSubmit={(e) => { e.preventDefault(); if (typed.trim().length === 5) setCode(typed.trim().toUpperCase()); }}
            className="mt-10 flex justify-center gap-3"
          >
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value.toUpperCase())}
              maxLength={5}
              autoFocus
              aria-label="Game code"
              className="w-56 rounded-sm border border-ink/40 bg-stock-lit px-4 py-4 text-center font-data text-4xl uppercase tracking-[0.2em] focus:border-ink focus:outline-none"
            />
            <button type="submit" className="rounded-sm bg-overprint px-8 font-display text-3xl uppercase tracking-[0.06em] text-stock-lit">Show</button>
          </form>
        </div>
      </Screen>
    );
  }

  if (missing) {
    return (
      <Screen>
        <div className="pt-[15vh] text-center">
          <h1 className={`${HEADING} text-6xl`}>No game with code {code}</h1>
          <button type="button" onClick={() => { setCode(null); setMissing(false); setState(null); }} className={`${LABEL} mt-8 text-xl underline`}>
            Type another code
          </button>
        </div>
      </Screen>
    );
  }

  if (!room) return <Screen><p className="pt-[20vh] text-center font-data text-3xl text-ink-fade">Loading&hellip;</p></Screen>;

  const players = state?.players ?? [];

  return (
    <Screen code={room.code} round={room.current_round > 0 ? `Round ${room.current_round} of ${room.rounds_total}` : null}>
      {/* ------------------------------------------------------------ lobby */}
      {room.state === 'lobby' && (
        <div className="grid items-center gap-12 pt-[6vh] lg:grid-cols-[1fr_auto]">
          <div>
            <p className={`${EYEBROW} text-overprint`}>Join on your phone</p>
            <p className="mt-4 font-data text-[clamp(1.5rem,3vw,2.5rem)] text-ink">lmslocal.co.uk/mdparty</p>
            <p className={`${LABEL} mt-10 text-ink-fade`}>Game code</p>
            <p className="font-data text-[clamp(5rem,14vw,11rem)] leading-none tracking-[0.12em] text-ink">{room.code}</p>
            <p className={`${LABEL} mt-10 text-ink-fade`}>In the room &middot; {players.length}</p>
            <ul className="mt-3 flex flex-wrap gap-3">
              {players.map((p) => (
                <li key={p.id} className="border border-ink/30 bg-stock-lit px-4 py-2 font-display text-3xl uppercase">{p.name}</li>
              ))}
            </ul>
          </div>
          {qr && (
            <div className="text-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- a generated data URL, nothing to optimise */}
              <img src={qr} alt={`QR code to join game ${room.code}`} className="h-[min(40vh,320px)] w-[min(40vh,320px)]" />
              <p className={`${LABEL} mt-3 text-ink-fade`}>Or scan to join</p>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------ predicting */}
      {room.state === 'open' && round && (
        <div className="pt-[3vh]">
          <h1 className={`${HEADING} text-[clamp(3rem,6vw,5.5rem)]`}>Who wins?</h1>
          <p className="mt-3 text-[clamp(1.1rem,1.8vw,1.6rem)] text-ink-fade">
            {players.length > 0 && players.every((p) => p.submitted)
              ? <span className="font-display text-[1.4em] uppercase text-ink">Everyone&apos;s in &middot; waiting for the host to kick off</span>
              : 'Predict on your phone. The host kicks off once everyone has sent theirs.'}
          </p>
          <div className="mt-8 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
            <ol className="divide-y divide-ink/20 border-y border-ink/30">
              {round.fixtures.map((f) => (
                <li key={f.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-2 font-data text-[clamp(1rem,2vw,1.7rem)]">
                  <span className="truncate text-right uppercase">{f.home.name} <Form form={f.home.form} /></span>
                  <span className="text-ink-fade">v</span>
                  <span className="truncate uppercase"><Form form={f.away.form} /> {f.away.name}</span>
                </li>
              ))}
            </ol>
            <div>
              <p className={`${LABEL} text-ink-fade`}>Sent &middot; {players.filter((p) => p.submitted).length} of {players.length}</p>
              <ul className="mt-4 space-y-2">
                {players.map((p) => (
                  // Light rows, not solid black (2026-11-27: a column of black bars was too heavy for
                  // the room's screen). Sent is a paper row with a red tick; still thinking is faded.
                  <li key={p.id} className={`flex items-center justify-between border px-4 py-2 font-display text-[clamp(1.4rem,2.4vw,2.2rem)] uppercase ${p.submitted ? 'border-ink/20 bg-stock-lit text-ink' : 'border-dashed border-ink/20 text-ink-fade/70'}`}>
                    <span>{p.name}</span>
                    <span className={`${LABEL} ${p.submitted ? 'text-overprint' : ''}`}>{p.submitted ? '✓ Sent' : 'Thinking'}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ reveal */}
      {room.state === 'revealing' && round && (
        <div className="pt-[2vh]">
          <TvReveal
            key={round.number}
            fixtures={round.fixtures}
            crowd={round.crowd}
            players={players}
            table={state?.players_table ?? []}
            lockedAt={round.locked_at}
            offsetMs={offsetMs}
          />
        </div>
      )}

      {/* ------------------------------------------------------------ tables */}
      {(room.state === 'table' || room.state === 'finished') && (
        <div className="pt-[3vh]">
          {room.state === 'finished' && (
            <Champion table={state?.players_table ?? []} endedEarly={room.ended_early} />
          )}
          {/* The players' league only. The teams' league added numbers without adding anything for the
              room (2026-11-25); it stays on the phones' tables screen for anyone curious. */}
          <div className="max-w-4xl">
            <h2 className={`${HEADING} text-[clamp(2rem,3.5vw,3.2rem)]`}>{room.state === 'finished' ? 'Final table' : 'The league'}</h2>
            <table className="mt-4 w-full text-left font-data text-[clamp(1.2rem,2.2vw,2rem)]">
              <tbody>
                {state?.players_table?.map((p) => (
                  <tr
                    key={p.player_id}
                    className={`border-t border-ink/20 ${room.state === 'finished' && !room.ended_early && p.position === 1 ? 'bg-stock-lit text-overprint' : ''}`}
                  >
                    <td className="w-14 py-2 text-ink-fade">{p.position}</td>
                    <td className="font-display uppercase">{p.name}</td>
                    <td className="text-right text-ink-fade">+{p.round_points}</td>
                    <td className="w-24 text-right text-[1.2em]">{p.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Screen>
  );
}

/*
  The winner, made a moment of (2026-11-25): CHAMPION over the name in the biggest type on the site,
  confetti in the coupon's inks, a four-note fanfare. Level at the top is JOINT CHAMPIONS. A game the
  host ended early gets no celebration - it was stopped, not won - only who was leading.
*/
function Champion({ table, endedEarly }: { table: { player_id: number; name: string; points: number; position: number }[]; endedEarly: boolean }) {
  const winners = table.filter((p) => p.position === 1);
  const celebrate = !endedEarly && winners.length > 0;
  useFanfare(celebrate);

  if (!celebrate) {
    return (
      <div className="mb-10">
        <h1 className={`${HEADING} text-[clamp(3rem,6vw,5.5rem)]`}>Game over</h1>
        {winners.length > 0 && (
          <p className="mt-3 text-[clamp(1.2rem,2vw,1.8rem)] text-ink-fade">
            The game was ended early. {winners.map((w) => w.name).join(' and ')} {winners.length > 1 ? 'were' : 'was'} leading on {winners[0].points}.
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <Confetti />
      <div className="relative z-10 mb-12 pt-[4vh] text-center">
        <p className="font-display text-[clamp(1.6rem,3vw,2.8rem)] uppercase tracking-[0.3em] text-overprint">
          {winners.length > 1 ? 'Joint champions' : 'Champion'}
        </p>
        <h1 className="mt-2 font-display text-[clamp(4.5rem,13vw,12rem)] font-semibold uppercase leading-[0.85] text-ink">
          {winners.map((w) => w.name).join(' & ')}
        </h1>
        <p className="mt-6 font-data text-[clamp(1.6rem,3vw,2.8rem)] text-ink">{winners[0].points} points</p>
      </div>
    </>
  );
}

function Screen({ children, code, round }: { children: React.ReactNode; code?: string; round?: string | null }) {
  return (
    <div className="min-h-screen bg-stock px-[4vw] py-[3vh] font-body text-ink">
      <header className="flex items-baseline justify-between border-b border-ink/30 pb-3">
        <span className={`${LABEL} text-overprint`}>Matchday Party</span>
        <span className={`${LABEL} text-ink-fade`}>
          {round}{round && code ? ' · ' : ''}{code && <span className="font-data">{code}</span>}
        </span>
      </header>
      {children}
    </div>
  );
}

function Form({ form }: { form: ('W' | 'D' | 'L')[] }) {
  if (form.length === 0) return null;
  return (
    <span className="mx-1 inline-flex gap-0.5 align-middle">
      {form.map((f, i) => (
        <span
          key={i}
          className={`inline-flex h-5 w-5 items-center justify-center font-data text-[12px] ${
            f === 'W' ? 'bg-ink text-stock-lit' : f === 'L' ? 'border border-overprint text-overprint' : 'border border-ink/40 text-ink-fade'
          }`}
        >
          {f}
        </span>
      ))}
    </span>
  );
}
