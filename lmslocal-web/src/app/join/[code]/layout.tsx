import type { Metadata } from 'next';

/**
 * Metadata only — this layout renders nothing of its own.
 *
 * /join/[code]/page.tsx is a client component, so it cannot export metadata, and without this it
 * inherited the root layout's. That copy sells the platform to organisers ("you set the entry fee
 * and keep what is left"), which is right for the landing page and wrong for the one link players
 * actually receive: an invite pasted into WhatsApp previewed as a pitch at the person running the
 * competition, aimed at someone being asked to play in it.
 *
 * Deliberately generic. Naming the competition would make a far better preview, but it means
 * calling get-competition-by-code server-side, and that endpoint is rate limited per IP
 * (joinLookupLimit, 30/min) — every crawler hit would arrive from the one Next.js server address
 * rather than the player's. Full and already-started codes return nothing either, so this copy
 * would still be the fallback. It is the floor, not the ceiling.
 *
 * "You" is the player here. §9 of docs/design-system.md reserves "you" for the organiser on
 * marketing pages and names the join route as the exception, which is the voice the page itself
 * already uses ("You have been invited").
 */

/*
 * GAME-NEUTRAL (2026-11-22). An invite can be to Last Man Standing or to Matchday
 * (docs/matchday.md), and this copy is fixed - see above for why it is not looked up per
 * competition. Naming either game here would describe the other one wrongly, so it names
 * neither; the page names the game the moment it opens.
 */
const TITLE = "You've been invited to a football competition";
const DESCRIPTION =
  'Football, every gameweek. Open the link to see the competition and how it is played, then join with your invite code.';

/*
 * Its own image, not the site-wide one — same reason as the copy. Source and
 * build script are lmslocal-marketing/social/og-join.html and make-png.js.
 *
 * Next.js merges metadata shallowly, so naming openGraph here replaces the root
 * object outright rather than inheriting its images. That is why this is spelled
 * out in full: leave it off and the preview has no image at all.
 */
const IMAGE = {
  url: '/og-join.png',
  width: 1200,
  height: 630,
  alt: 'LMSLocal — you have been invited to join a football competition.',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;

  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: {
      canonical: `/join/${encodeURIComponent(code)}`,
    },
    openGraph: {
      title: TITLE,
      description: DESCRIPTION,
      url: `https://lmslocal.co.uk/join/${encodeURIComponent(code)}`,
      siteName: 'LMSLocal',
      locale: 'en_GB',
      type: 'website',
      images: [IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: TITLE,
      description: DESCRIPTION,
      images: [IMAGE.url],
    },
  };
}

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
