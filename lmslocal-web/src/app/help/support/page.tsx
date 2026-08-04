import { Metadata } from 'next';
import ContactForm from '@/components/public/ContactForm';
import { EYEBROW, LABEL } from '@/lib/design';

export const metadata: Metadata = {
  title: 'Contact us | LMSLocal Help',
  description:
    'Get in touch with LMSLocal. Message us about joining or running a competition, picks and results, billing, or anything that is broken.',
  keywords: 'contact, support, help, get in touch, lmslocal',
  alternates: { canonical: '/help/support' },
  openGraph: {
    title: 'Contact us | LMSLocal Help',
    description: 'Get in touch with LMSLocal. We read everything and reply, usually the same day.',
    url: '/help/support',
    siteName: 'LMSLocal',
    locale: 'en_GB',
    type: 'website'
  },
  twitter: {
    card: 'summary',
    title: 'Contact us | LMSLocal Help',
    description: 'Get in touch with LMSLocal. We read everything and reply, usually the same day.'
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } }
};

export default function SupportPage() {
  return (
    <div>
      <p className={`${EYEBROW} text-overprint`}>A real person answers these</p>
      <h1 className="mt-4 font-display text-5xl font-semibold uppercase leading-[0.9] text-ink sm:text-6xl">
        Get in touch
      </h1>
      <p className="mt-6 max-w-lg text-xl leading-relaxed text-ink">
        No ticket system, no bot. Whatever you send lands in our inbox and we reply to you
        directly, usually the same day.
      </p>

      {/* Pick up the phone, if that suits better */}
      <div className="mt-9 grid gap-4 sm:grid-cols-2">
        <div className="border border-ink/30 bg-stock-lit p-5">
          <h2 className={`${LABEL} text-ink-fade`}>Call us</h2>
          <a
            href="tel:+447818443886"
            className="mt-2 block font-display text-3xl uppercase tracking-[0.03em] text-ink transition-colors hover:text-overprint"
          >
            07818 443886
          </a>
          <p className="mt-2 text-[15px] text-ink-fade">Andreas, 11am to 5pm.</p>
        </div>

        <div className="border border-ink/30 bg-stock-lit p-5">
          <h2 className={`${LABEL} text-ink-fade`}>Email us</h2>
          <a
            href="mailto:lmslocal8@gmail.com"
            className="mt-2 block break-all font-data text-xl text-ink underline decoration-dotted underline-offset-4 transition-colors hover:text-overprint"
          >
            lmslocal8@gmail.com
          </a>
          <p className="mt-2 text-[15px] text-ink-fade">Any time. We reply within a day.</p>
        </div>
      </div>

      <h2 className="mt-12 font-display text-3xl uppercase tracking-[0.03em] text-ink">
        Or send it from here
      </h2>
      <p className="mt-3 max-w-lg text-[17px] leading-relaxed text-ink">
        Nothing to install and no account needed. If it is about a competition, its name and code
        save us a round trip.
      </p>

      <div className="mt-7">
        <ContactForm />
      </div>
    </div>
  );
}
