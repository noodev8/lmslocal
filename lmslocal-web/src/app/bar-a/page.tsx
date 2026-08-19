import type { Metadata } from 'next';
import Home from '../page';

/**
 * Landing target for the QR code on the pub leaflet
 * (lmslocal-marketing/leaflet/a5-landlord.html).
 *
 * Same shape as /club-a and /club-b — see the comment in /club-a for why the
 * variants render the homepage rather than a page of their own, and why the
 * path is the measurement. docs/marketing-mailshot.md §7.
 *
 * Named for the audience, not the sheet: this is the pub sheet, where club-a
 * and club-b are an A/B pair of the same club sheet. There is no /bar-b yet.
 * If one is ever added, both must land here-style on the homepage, or a
 * difference between them cannot be attributed to the leaflet.
 *
 * Note a5-landlord-post.html — the posted version — still carries the generic
 * site-qr.png, so its scans are NOT in this number.
 */

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};

export default function BarALanding() {
  return <Home />;
}
