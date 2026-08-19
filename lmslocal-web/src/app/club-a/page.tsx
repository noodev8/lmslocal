import type { Metadata } from 'next';
import Home from '../page';

/**
 * Landing target for the QR code on the A club leaflet
 * (lmslocal-marketing/leaflet/a5-club-a.html). Its partner is /club-b.
 *
 * This renders the homepage. That is the whole design and it is deliberate:
 * a club arriving from the leaflet should see the page the homepage already
 * is — clubs first, "keep whatever is left" in the hero — and giving each
 * variant its own copy would mean changing the leaflet AND the destination at
 * once, so a difference between A and B could not be attributed to either.
 *
 * The path is the measurement. Nothing else anywhere links here, so every
 * page view is a scan of that leaflet, and Vercel Web Analytics reports by
 * path with no extra code. Page views are also all the Hobby plan gives us —
 * custom events and UTM parameters are Pro features — which is why this is a
 * distinct route rather than a query string on /.
 *
 * See docs/marketing-mailshot.md §7.
 *
 * noindex because this serves the same content as /, and two indexed copies
 * of the homepage compete with each other. Crawler hits would also land in
 * the scan count and inflate it. Note the page is NOT disallowed in
 * robots.ts, and must not be: a blocked crawler never reads the noindex.
 */

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};

export default function ClubALanding() {
  return <Home />;
}
