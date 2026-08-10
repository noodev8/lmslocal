'use client';

import Image from 'next/image';
import { useState } from 'react';

/**
 * The competition's badge — the organiser's pub crest, club logo or company mark.
 *
 * It is competition identity, not a profile picture, and it earns its place in three spots:
 * the join page (largest, where someone who typed a code off a beer mat needs to see the
 * badge before handing over an email), the dashboard card (small, to tell three competitions
 * apart in a list), and the /game/[id] masthead.
 *
 * There is always something to draw. A competition without a logo falls back to initials on a
 * tinted block rather than a gap, because an empty square beside a name reads as broken rather
 * than as unset. The same fallback covers a logo_url that 404s, which we cannot know until the
 * browser tries — hence the error state rather than a plain <Image>.
 */

type Props = {
  name: string;
  logoUrl?: string | null;
  /** Rendered edge length in px. Also the intrinsic size handed to next/image. */
  size?: number;
  className?: string;
};

/** Up to two initials, from the first and last word of the name. "The Crown & Anchor" -> "TA". */
function initialsFor(name: string): string {
  const words = name
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);

  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export default function CompetitionLogo({ name, logoUrl, size = 48, className = '' }: Props) {
  const [failed, setFailed] = useState(false);

  const box = `flex-shrink-0 border border-ink/30 ${className}`;
  const style = { width: size, height: size };

  if (!logoUrl || failed) {
    return (
      <div
        style={style}
        className={`${box} flex items-center justify-center bg-stock font-display uppercase leading-none text-ink-fade`}
        aria-hidden="true"
      >
        <span style={{ fontSize: Math.max(11, Math.round(size * 0.38)) }}>{initialsFor(name)}</span>
      </div>
    );
  }

  return (
    <Image
      src={logoUrl}
      alt={`${name} logo`}
      width={size}
      height={size}
      style={style}
      className={`${box} object-cover`}
      unoptimized
      onError={() => setFailed(true)}
    />
  );
}
