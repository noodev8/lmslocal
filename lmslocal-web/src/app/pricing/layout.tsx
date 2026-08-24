import type { Metadata } from 'next';

/*
  Metadata for /pricing.

  It lives in a layout because the page itself is a client component - it carries print styles and
  interactive state - and a 'use client' file cannot export metadata. Without this the page
  inherited the site-wide title and description word for word and had no canonical of its own,
  while sitting at priority 0.9 in the sitemap: the second most important page on the site,
  indexed as a duplicate of the home page.
*/

export const metadata: Metadata = {
  title: 'Pricing - Last Man Standing Competitions from £0 | LMSLocal',
  description:
    'Twenty player places free for as long as you run it, no card needed. After that, packs from £10 for 20 more places. No subscription, no cut of your entry fees - what your players pay you is yours.',
  alternates: { canonical: 'https://lmslocal.co.uk/pricing' },
  openGraph: {
    title: 'LMSLocal Pricing - start free, pay by the place',
    description:
      'Your first 20 player places are free and yours for good. Packs from £10 after that, no subscription, and we take nothing from your entry fees.',
    url: 'https://lmslocal.co.uk/pricing',
    type: 'website'
  },
  /* Without its own twitter block this page inherits the home page's card wholesale, so a shared
     pricing link previews as the site's front door. */
  twitter: {
    card: 'summary_large_image',
    title: 'LMSLocal Pricing - start free, pay by the place',
    description:
      'Your first 20 player places are free and yours for good. Packs from £10 after that, no subscription, and we take nothing from your entry fees.'
  }
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
