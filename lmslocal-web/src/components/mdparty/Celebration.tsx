'use client';

/*
  The end of a Matchday Party game: the winner, made a moment of (docs/matchday-party.md §6).

  CONFETTI: scraps of the coupon's paper in its inks (ink, overprint red, moss green, stock), falling.
  Plain CSS, no library. Anyone with reduced motion set gets the screen without the fall.

  FANFARE: four notes up, on the TV only and only with its sound on, played once when the winner
  appears. Synthesised like the goal chime, so there is nothing to download.
*/

import { useEffect, useMemo } from 'react';

// The site's own inks (tailwind.config.js): ink, overprint, moss, and the lit stock for paper-white scraps.
const COLOURS = ['#1C2620', '#C8341E', '#2F4B32', '#F2F3EC', '#C8341E', '#1C2620'];

export function Confetti({ pieces = 90 }: { pieces?: number }) {
  // Random once per mount, client-side only (this never renders on the server: it appears after a poll).
  const bits = useMemo(
    () => Array.from({ length: pieces }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 2.5,
      duration: 3 + Math.random() * 3,
      size: 6 + Math.random() * 10,
      tilt: Math.random() * 360,
      drift: (Math.random() - 0.5) * 30,
      colour: COLOURS[i % COLOURS.length],
    })),
    [pieces]
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden motion-reduce:hidden" aria-hidden="true">
      <style>{`
        @keyframes mdpartyConfettiFall {
          0%   { transform: translate3d(0, -10vh, 0) rotate(0deg); opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translate3d(var(--drift), 110vh, 0) rotate(720deg); opacity: 0; }
        }
      `}</style>
      {bits.map((b, i) => (
        <span
          key={i}
          className="absolute top-0 block"
          style={{
            left: `${b.left}%`,
            width: `${b.size}px`,
            height: `${b.size * 0.6}px`,
            background: b.colour,
            transform: `rotate(${b.tilt}deg)`,
            animation: `mdpartyConfettiFall ${b.duration}s ${b.delay}s linear infinite`,
            ['--drift' as string]: `${b.drift}vw`,
          }}
        />
      ))}
    </div>
  );
}

/** Four notes up. Once per mount, only if the TV's sound is on. */
export function useFanfare(play: boolean) {
  useEffect(() => {
    if (!play || localStorage.getItem('mdparty_sound') === 'off') return;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ac = new Ctor();
    ac.resume().catch(() => {});
    const t = ac.currentTime + 0.05;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const start = t + i * 0.16;
      const length = i === 3 ? 1.1 : 0.22;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.16, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
      osc.connect(gain).connect(ac.destination);
      osc.start(start);
      osc.stop(start + length + 0.05);
    });
    const id = setTimeout(() => ac.close().catch(() => {}), 2500);
    return () => clearTimeout(id);
  }, [play]);
}
