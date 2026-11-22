'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './results.module.css';

/*
  SAMPLE DATA. The national game does not exist yet (PRODUCT.md), so every figure in the feed and
  the counter is invented to show the mechanism, and both carry a visible SAMPLE tag for that
  reason. Replace with the live round once the game is built; never present these numbers as real.

  Each result knocks out everyone who picked the losing side, or either side of a draw, which is why
  every result carries an OUT figure. The visitor's own pick sits on the last line and only turns to
  THROUGH once the whole round is in.

  The first lines are already printed when the page arrives and only the `live` ones type in. A feed
  that starts empty leaves the first viewport blank for seconds, and a service already running reads
  truer than one that starts the moment you look.
*/
const RESULTS: { score: string; out: number; live?: boolean }[] = [
  { score: 'Arsenal 2 Chelsea 1', out: 412 },
  { score: 'Liverpool 0 Fulham 0', out: 1204 },
  { score: 'Brentford 3 Everton 1', out: 96 },
  { score: 'Newcastle 1 Wolves 2', out: 2871, live: true },
  { score: 'Aston Villa 2 Tottenham 1', out: 1960, live: true },
];
const YOUR_PICK = 'Aston Villa';

const FINAL = 13402;
const START = FINAL + RESULTS.reduce((sum, r) => sum + (r.live ? r.out : 0), 0);
const LIVE_OUTS = RESULTS.filter((r) => r.live).length;

// Typing pace, in the feel of a teleprinter rather than a person: fast and even.
const MS_PER_CHAR = 30;
const GAP_MS = 320;
const FIRST_MS = 600;

const fmt = (n: number) => n.toLocaleString('en-GB');

/** Lays the live lines end to end on one timeline, so each starts typing when the last finishes. */
function timeline() {
  let t = FIRST_MS;
  return RESULTS.map((r) => {
    const live = !!r.live;
    const outText = `${fmt(r.out)} out`;
    const score = { text: r.score, delay: t, n: r.score.length, live };
    if (live) t += r.score.length * MS_PER_CHAR + 120;
    const out = { text: outText, delay: t, n: outText.length, live, value: r.out };
    if (live) t += outText.length * MS_PER_CHAR + GAP_MS;
    return { score, out };
  });
}

const LINES = timeline();

type Seg = { text: string; delay: number; n: number; live: boolean };

/** A segment of a line: typed in, with the print head showing, if live; already printed if not. */
function Segment({ seg, onDone }: { seg: Seg; onDone?: () => void }) {
  if (!seg.live) return <span>{seg.text}</span>;
  return (
    <span
      className={styles.type}
      style={{ '--n': seg.n, '--d': `${seg.delay}ms`, '--t': `${seg.n * MS_PER_CHAR}ms` } as React.CSSProperties}
      onAnimationEnd={(e) => {
        // The print-head animation ends at the same moment; count each segment once.
        if (!e.animationName.includes('printHead')) onDone?.();
      }}
    >
      {seg.text}
    </span>
  );
}

export default function Feed() {
  const [shown, setShown] = useState(START);
  const [landed, setLanded] = useState(0);
  const target = useRef(START);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    // With reduced motion the CSS typing is switched off, so no animationend will ever fire.
    // Show the finished round instead of a counter frozen at the start.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      target.current = FINAL;
      setShown(FINAL);
      setLanded(LIVE_OUTS);
    }
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, []);

  // The counter is driven by the typing itself (animationend on each OUT figure) rather than by
  // timers of its own. A timer started at hydration runs late by however long hydration took, and
  // the number would drop before the score that caused it had finished printing.
  const knockOut = (value: number) => {
    const from = target.current;
    const to = from - value;
    target.current = to;
    setLanded((n) => n + 1);
    const began = performance.now();
    const dur = 700;
    const step = (now: number) => {
      const p = Math.min(1, (now - began) / dur);
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setShown(Math.round(from + (to - from) * eased));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(step);
  };

  const through = landed >= LIVE_OUTS;

  return (
    <>
      <ol className={styles.feed} aria-label="Sample round of results">
        {LINES.map(({ score, out }, i) => (
          <li key={i} className={styles.feedLine}>
            <span className={styles.feedScore}>
              <Segment seg={score} />
            </span>
            <span className={styles.feedOut}>
              <Segment seg={out} onDone={() => knockOut(out.value)} />
            </span>
          </li>
        ))}
        {/* The visitor's pick waits, cursor flashing, until the round is in. */}
        <li className={`${styles.feedLine} ${styles.feedPick}`}>
          <span className={styles.feedScore}>
            Your pick: {YOUR_PICK}
            {!through && <span className={styles.flash} aria-hidden="true" />}
          </span>
          {through && (
            <span className={styles.feedThrough}>
              <Segment seg={{ text: 'Through', delay: 150, n: 7, live: true }} />
            </span>
          )}
        </li>
      </ol>

      <div className={styles.standing}>
        <p className={styles.count} aria-hidden="true">
          {fmt(shown)}
        </p>
        <p className={styles.countLabel}>
          <span className="sr-only">Sample: {fmt(FINAL)} </span>
          Still standing
          <span className={styles.sample}>Sample round · start to be announced</span>
        </p>
      </div>
    </>
  );
}
