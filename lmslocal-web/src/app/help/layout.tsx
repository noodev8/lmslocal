'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import PublicHeader from '@/components/public/PublicHeader';
import PublicFooter from '@/components/public/PublicFooter';
import { LABEL } from '@/lib/design';

/**
 * Help section frame. Built to the coupon design system — see docs/design-system.md.
 *
 * The sidebar is a flat list rather than collapsible sections: there are six
 * destinations in total, so a disclosure control was hiding two links behind a
 * click for no benefit. On narrow screens the same list becomes a horizontal
 * strip, which avoids a full-screen modal menu for six items.
 */

type NavItem = { name: string; href: string; group?: string };

const NAVIGATION: NavItem[] = [
  { name: 'Help home', href: '/help' },
  { name: 'How to play', href: '/help/how-to-play' },
  { name: 'For organisers', href: '/help/getting-started/organizers', group: 'Getting started' },
  { name: 'For players', href: '/help/getting-started/players', group: 'Getting started' },
  { name: 'FAQ', href: '/help/faq' },
  { name: 'Support', href: '/help/support' }
];

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const linkClass = (href: string) => {
    const active = pathname === href;
    return `block border-l-2 py-2 pl-3 text-[16px] transition-colors ${
      active
        ? 'border-overprint font-semibold text-ink'
        : 'border-transparent text-ink-fade hover:border-ink/40 hover:text-ink'
    }`;
  };

  return (
    <div className="flex min-h-screen flex-col bg-stock font-body text-ink">
      <PublicHeader current="help" />

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <p className={`${LABEL} text-overprint`}>Help centre</p>

        <div className="mt-6 flex flex-col gap-10 md:flex-row md:gap-14">
          {/* Navigation: a column on desktop, a scrolling strip on mobile */}
          <nav className="md:w-56 md:flex-shrink-0" aria-label="Help sections">
            <div className="hidden md:sticky md:top-8 md:block">
              {NAVIGATION.map((item, i) => {
                const newGroup = item.group && item.group !== NAVIGATION[i - 1]?.group;
                return (
                  <div key={item.href}>
                    {newGroup && (
                      <p className={`${LABEL} mt-5 pb-1 pl-3 text-ink-fade`}>{item.group}</p>
                    )}
                    <Link href={item.href} className={linkClass(item.href)}>
                      {item.name}
                    </Link>
                  </div>
                );
              })}
            </div>

            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 md:hidden">
              {NAVIGATION.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${LABEL} whitespace-nowrap rounded-sm border px-3 py-2 transition-colors ${
                    pathname === item.href
                      ? 'border-overprint bg-overprint text-stock-lit'
                      : 'border-ink/30 text-ink-fade hover:text-ink'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </nav>

          <div className="min-w-0 flex-1">
            <main>{children}</main>

            {/*
              Every help page ends with a way to reach us. Someone who has read a page and still
              has a question should not have to go looking for the contact link — that is the
              moment they are most likely to give up instead.
            */}
            {pathname !== '/help/support' && (
              <aside className="mt-16 border border-ink/30 bg-stock-lit p-6 sm:p-7">
                <p className={`${LABEL} text-overprint`}>Still stuck?</p>
                <h2 className="mt-3 font-display text-3xl uppercase tracking-[0.03em] text-ink">
                  Ask us directly
                </h2>
                <p className="mt-3 max-w-lg text-[17px] leading-relaxed text-ink">
                  A real person reads these and replies, usually the same day. No account needed.
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <Link
                    href="/help/support"
                    className="rounded-sm bg-overprint px-6 py-3 font-display text-xl uppercase tracking-[0.06em] text-stock-lit transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  >
                    Send a message
                  </Link>
                  <a
                    href="tel:+447818443886"
                    className={`${LABEL} text-ink underline decoration-dotted underline-offset-[6px] transition-colors hover:text-overprint`}
                  >
                    Or call 07818 443886
                  </a>
                </div>
              </aside>
            )}
          </div>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}
