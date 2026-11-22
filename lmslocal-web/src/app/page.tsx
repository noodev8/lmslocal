import { VT323, Atkinson_Hyperlegible_Mono } from 'next/font/google';
import ResultsService from '@/components/landing/results/ResultsService';

/**
 * Landing page. Redesigned 2026-11-22 to lead with the national game alongside organiser-run
 * fundraisers, in its own visual world (a Saturday results service). It deliberately does NOT
 * follow docs/design-system.md, which still governs every other signed-out page. The direction is
 * recorded in .impeccable/surfaces/, and product facts in PRODUCT.md.
 *
 * The fonts load here rather than in the root layout so that no other page pays for them.
 */

const vt = VT323({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-vt',
  display: 'swap',
});

// Hyperlegible for anything longer than a line: VT323 is a screen face and tires the eye in a
// paragraph, and plenty of players read on a small phone in a dim pub.
const hyper = Atkinson_Hyperlegible_Mono({
  subsets: ['latin'],
  variable: '--font-hyper',
  display: 'swap',
});

export default function LandingPage() {
  return <ResultsService fontClass={`${vt.variable} ${hyper.variable}`} />;
}
