'use client';

import { useState } from 'react';
import { LABEL } from '@/lib/design';

/**
 * The fundraising section, rebuilt as a form the organiser fills in rather than
 * a worked example. An organiser previously read the fixed example as our terms
 * and asked whether they were allowed to change it — so here every number is
 * theirs to set, and only the player-slot cost comes from us.
 */

// Credit packs, matching /pricing. The free twenty are counted live, so a departing player
// frees one. Bought places are spent as players join and are only refunded if the player is
// removed while the competition is still in SETUP (see routes/remove-player.js).
const FREE_SLOTS = 20;
const PACKS = [
  { credits: 20, price: 10 },
  { credits: 50, price: 20 },
  { credits: 120, price: 40 },
];

/** Cheapest combination of packs that covers the places needed beyond the free 20. */
function slotCost(extraSlots: number): number {
  if (extraSlots <= 0) return 0;
  let best = Infinity;
  for (let big = 0; big <= 3; big++) {
    for (let mid = 0; mid <= 4; mid++) {
      for (let small = 0; small <= 8; small++) {
        const credits =
          big * PACKS[2].credits + mid * PACKS[1].credits + small * PACKS[0].credits;
        if (credits < extraSlots) continue;
        const price = big * PACKS[2].price + mid * PACKS[1].price + small * PACKS[0].price;
        if (price < best) best = price;
      }
    }
  }
  return best === Infinity ? 0 : best;
}

const money = (n: number) =>
  `£${n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const sliderClass =
  'h-1 w-full cursor-pointer appearance-none rounded-full bg-ink/25 accent-overprint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-overprint';

// Interface labels use the body face — the typewriter is reserved for the ledger.
const fieldLabel = `${LABEL} text-ink-fade`;

export default function Docket() {
  const [players, setPlayers] = useState(30);
  const [fee, setFee] = useState(10);
  const [prizeShare, setPrizeShare] = useState(75);

  const pot = players * fee;
  const prize = Math.round((pot * prizeShare) / 100);
  const slots = slotCost(Math.max(0, players - FREE_SLOTS));
  const left = pot - prize - slots;

  return (
    <div className="border border-dashed border-ink/40 bg-stock-lit p-5 sm:p-7">
      {/* Inputs */}
      <div className="grid gap-6 sm:grid-cols-3">
        <label className="block">
          <span className={fieldLabel}>
            Players
          </span>
          <span className="mt-1 block font-display text-4xl font-semibold text-ink">
            {players}
          </span>
          <input
            type="range"
            min={5}
            max={200}
            step={1}
            value={players}
            onChange={(e) => setPlayers(Number(e.target.value))}
            className={`mt-3 ${sliderClass}`}
          />
        </label>

        <label className="block">
          <span className={fieldLabel}>
            Entry fee
          </span>
          <span className="mt-1 block font-display text-4xl font-semibold text-ink">
            {money(fee)}
          </span>
          <input
            type="range"
            min={0}
            max={50}
            step={1}
            value={fee}
            onChange={(e) => setFee(Number(e.target.value))}
            className={`mt-3 ${sliderClass}`}
          />
        </label>

        <label className="block">
          <span className={fieldLabel}>
            To the winner
          </span>
          <span className="mt-1 block font-display text-4xl font-semibold text-ink">
            {prizeShare}%
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={prizeShare}
            onChange={(e) => setPrizeShare(Number(e.target.value))}
            className={`mt-3 ${sliderClass}`}
          />
        </label>
      </div>

      {/* Result */}
      <dl className="mt-7 border-t border-ink/30 pt-5 font-data text-[15px]">
        <div className="flex items-baseline justify-between gap-3 py-1.5">
          <dt className="text-ink-fade">
            {players} × {money(fee)} collected
          </dt>
          <dd className="text-ink">{money(pot)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 py-1.5">
          <dt className="text-ink-fade">Prize for the winner</dt>
          <dd className="text-ink">−{money(prize)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 py-1.5">
          <dt className="text-ink-fade">
            Player places from us{' '}
            {slots === 0 && <span className="text-ink">(free — within your {FREE_SLOTS})</span>}
          </dt>
          <dd className="text-ink">{slots === 0 ? money(0) : `−${money(slots)}`}</dd>
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-ink/30 pt-4">
          <dt className="font-display text-xl uppercase tracking-[0.1em] text-ink">
            Left for your club
          </dt>
          <dd
            className={`font-display text-4xl font-semibold sm:text-5xl ${
              left < 0 ? 'text-overprint' : 'text-ink'
            }`}
          >
            {money(left)}
          </dd>
        </div>
      </dl>

      <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-ink-fade">
        Every number above is yours to set, and you can change them whenever you like. We never
        handle the entry money — that stays between you and your players. The only thing you pay
        us for is player places beyond your free {FREE_SLOTS}.
      </p>
    </div>
  );
}
