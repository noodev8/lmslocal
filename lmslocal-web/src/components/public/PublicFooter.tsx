import Link from 'next/link';
import { LABEL } from '@/lib/design';

/**
 * Footer for every signed-out page. Built to the coupon design system — see
 * docs/design-system.md. Company details are a legal requirement, so they stay
 * on every page rather than only the landing page.
 */

/*
  Two rows, deliberately. The lower one is the legal and support furniture; the upper one is the
  product, and it is here because these pages need internal links from every page on the site to
  be found and to carry any weight. A sitemap entry on its own tells Google a URL exists and
  almost nothing about whether it matters.
*/
const PAGES = [
  { href: '/app', label: 'The app' },
  { href: '/last-man-standing-for-pubs', label: 'For pubs' },
  { href: '/last-man-standing-at-work', label: 'At work' },
  { href: '/last-man-standing-for-clubs', label: 'For clubs' }
];

const LINKS = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/help', label: 'Help' },
  { href: '/pricing', label: 'Pricing' }
];

export default function PublicFooter({ width = 'wide' }: { width?: 'wide' | 'narrow' }) {
  const measure = width === 'narrow' ? 'max-w-3xl' : 'max-w-6xl';

  return (
    <footer className="bg-ink print:hidden">
      <div className={`mx-auto ${measure} border-t border-stock/25 px-4 py-9 sm:px-6`}>
        <div className="flex flex-wrap gap-x-6 gap-y-2 border-b border-stock/20 pb-6">
          {PAGES.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${LABEL} text-stock/65 transition-colors hover:text-stock`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <span className="font-display text-xl uppercase tracking-[0.1em] text-stock/85">
            LMSLocal
          </span>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`${LABEL} text-stock/65 transition-colors hover:text-stock`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-7 space-y-1 text-[14px] leading-relaxed text-stock/60">
          <p>&copy; 2026 LMSLocal. Operated by Noodev8 Ltd, company number 16222537.</p>
          <p>3 Cumberland Place, Welshpool, SY21 7SB.</p>
        </div>
      </div>
    </footer>
  );
}
