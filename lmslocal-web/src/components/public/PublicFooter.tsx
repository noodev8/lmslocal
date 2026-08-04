import Link from 'next/link';
import { LABEL } from '@/lib/design';

/**
 * Footer for every signed-out page. Built to the coupon design system — see
 * docs/design-system.md. Company details are a legal requirement, so they stay
 * on every page rather than only the landing page.
 */

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
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
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
