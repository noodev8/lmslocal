import Link from 'next/link';
import PublicHeader from './PublicHeader';
import PublicFooter from './PublicFooter';
import { EYEBROW } from '@/lib/design';

/**
 * Shared frame for the signed-out auth pages (sign in, create account, reset
 * password). Keeps them identical to each other and to /join/[code], which is
 * where most players meet a form for the first time.
 */

export default function AuthShell({
  eyebrow,
  title,
  intro,
  children,
  footer
}: {
  eyebrow: string;
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-stock font-body text-ink">
      <PublicHeader width="narrow" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <p className={`${EYEBROW} text-overprint`}>{eyebrow}</p>
        <h1 className="mt-4 font-display text-5xl font-semibold uppercase leading-[0.9] text-ink sm:text-6xl">
          {title}
        </h1>
        {intro && <div className="mt-5 max-w-lg text-xl leading-relaxed text-ink">{intro}</div>}
        <div className="mt-8 max-w-md">{children}</div>
        {footer && <div className="mt-6 max-w-md text-[16px] text-ink-fade">{footer}</div>}
      </main>
      <PublicFooter width="narrow" />
    </div>
  );
}

/** Shared field styling, so every input on every auth page matches. */
export const authInput =
  'mt-2 block w-full rounded-sm border border-ink/40 bg-stock-lit px-3 py-2.5 text-[17px] text-ink placeholder:text-ink-fade/70 focus:border-ink focus:outline-none';

export const authButton =
  'w-full rounded-sm bg-overprint px-8 py-4 font-display text-2xl uppercase tracking-[0.06em] text-stock-lit transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

/** Error and success notices, matching the join page. */
export function Notice({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
  return (
    <p
      className={`mb-6 border-l-2 px-4 py-3 text-[17px] text-ink ${
        tone === 'error' ? 'border-overprint bg-stock-lit' : 'border-ink bg-stock-lit'
      }`}
    >
      {children}
    </p>
  );
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="underline decoration-dotted underline-offset-4 hover:text-ink">
      {children}
    </Link>
  );
}
