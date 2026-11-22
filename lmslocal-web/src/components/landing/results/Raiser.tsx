'use client';

import { useId, useState } from 'react';
import styles from './results.module.css';

/*
  Every number is the organiser's to set; only the cost of player places comes from us. An earlier
  version showed a fixed worked example, and an organiser read it as our terms and asked whether
  they were allowed to change it.

  Packs must match /pricing. The free twenty are counted live, so a player who leaves frees a place.
*/
const FREE_PLACES = 20;
const PACKS = [
  { places: 20, price: 10 },
  { places: 50, price: 20 },
  { places: 120, price: 40 },
];

/** Cheapest combination of packs that covers the places needed beyond the free twenty. */
function placesCost(extra: number): number {
  if (extra <= 0) return 0;
  let best = Infinity;
  for (let big = 0; big <= 3; big++) {
    for (let mid = 0; mid <= 4; mid++) {
      for (let small = 0; small <= 8; small++) {
        const places = big * PACKS[2].places + mid * PACKS[1].places + small * PACKS[0].places;
        if (places < extra) continue;
        const price = big * PACKS[2].price + mid * PACKS[1].price + small * PACKS[0].price;
        if (price < best) best = price;
      }
    }
  }
  return best === Infinity ? 0 : best;
}

const money = (n: number) => `${n < 0 ? '-' : ''}£${Math.abs(n).toLocaleString('en-GB')}`;

function Slider({
  label,
  display,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  display: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div className={styles.slider}>
      <label htmlFor={id} className={styles.sliderLabel}>
        {label}
      </label>
      <output htmlFor={id} className={styles.sliderValue}>
        {display}
      </output>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={styles.range}
      />
    </div>
  );
}

export default function Raiser() {
  const [players, setPlayers] = useState(60);
  const [fee, setFee] = useState(5);
  const [share, setShare] = useState(50);

  const pot = players * fee;
  const prize = Math.round((pot * share) / 100);
  const places = placesCost(players - FREE_PLACES);
  const left = pot - prize - places;

  return (
    <div className={styles.raiser}>
      <div className={styles.sliders}>
        <Slider label="Players" display={String(players)} value={players} min={5} max={200} step={1} onChange={setPlayers} />
        <Slider label="Entry fee" display={money(fee)} value={fee} min={0} max={50} step={1} onChange={setFee} />
        <Slider label="To the winner" display={`${share}%`} value={share} min={0} max={100} step={5} onChange={setShare} />
      </div>

      <dl className={styles.ledger} aria-live="polite">
        <div className={styles.ledgerRow}>
          <dt>
            {players} × {money(fee)} collected
          </dt>
          <dd>{money(pot)}</dd>
        </div>
        <div className={styles.ledgerRow}>
          <dt>Prize for the winner</dt>
          <dd>{prize === 0 ? money(0) : money(-prize)}</dd>
        </div>
        <div className={styles.ledgerRow}>
          <dt>{places === 0 ? `Places from us (within your free ${FREE_PLACES})` : 'Places from us'}</dt>
          <dd>{places === 0 ? money(0) : money(-places)}</dd>
        </div>
      </dl>

      <p className={styles.left}>
        <span className={styles.leftLabel}>Left for your club</span>
        <span className={left < 0 ? `${styles.leftValue} ${styles.isRed}` : styles.leftValue}>{money(left)}</span>
      </p>
    </div>
  );
}
