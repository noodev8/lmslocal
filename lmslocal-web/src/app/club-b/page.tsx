import type { Metadata } from 'next';
import Home from '../page';

/**
 * Landing target for the QR code on the B club leaflet
 * (lmslocal-marketing/leaflet/a5-club-b.html). Its partner is /club-a.
 *
 * Identical to /club-a on purpose — see the comment there for why both
 * variants land on the homepage rather than on a page of their own, and why
 * the path is the measurement. docs/marketing-mailshot.md §7.
 */

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};

export default function ClubBLanding() {
  return <Home />;
}
