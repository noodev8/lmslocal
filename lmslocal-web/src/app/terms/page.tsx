import Link from 'next/link';
import { Metadata } from 'next';
import PublicHeader from '@/components/public/PublicHeader';
import PublicFooter from '@/components/public/PublicFooter';

export const metadata: Metadata = {
  title: 'Terms of Service | LMSLocal',
  description: 'Terms of Service for LMSLocal. Read our terms and conditions for using the Last Man Standing competition platform.',
  keywords: 'terms of service, terms and conditions, user agreement, lmslocal, legal',
  alternates: {
    canonical: '/terms',
  },
  openGraph: {
    title: 'Terms of Service | LMSLocal',
    description: 'Terms of Service for LMSLocal. Read our terms and conditions for using the Last Man Standing competition platform.',
    url: '/terms',
    siteName: 'LMSLocal',
    locale: 'en_GB',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Terms of Service | LMSLocal',
    description: 'Terms of Service for LMSLocal. Read our terms and conditions for using the Last Man Standing competition platform.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function TermsOfService() {
  return (
    <div className="flex min-h-screen flex-col bg-stock font-body text-ink">
      <PublicHeader width="narrow" />

      {/* Content */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <div>
          <h1 className="font-display text-5xl font-semibold uppercase leading-[0.9] text-ink sm:text-6xl">Terms of Service</h1>
          <p className="mt-4 font-body text-xs font-semibold uppercase tracking-[0.12em] text-ink-fade">Last updated: August 4, 2026</p>

          <div className="mt-10">
            <h2 className="mt-10 border-t border-ink/30 pt-6 font-display text-2xl uppercase tracking-[0.03em] text-ink">1. Acceptance of Terms</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              By accessing and using LMSLocal (&quot;the Service&quot;), operated by Noodev8 Ltd (Company Number: 16222537), you accept and agree to be bound by the terms and provision of this agreement.
            </p>

            <h2 className="mt-10 border-t border-ink/30 pt-6 font-display text-2xl uppercase tracking-[0.03em] text-ink">2. Beta Service</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              LMSLocal is currently in beta testing. The Service is provided &quot;as is&quot; and may contain bugs, errors, or limitations. We make no warranties about the reliability, availability, or performance of the Service during this beta period.
            </p>

            <h2 className="mt-10 border-t border-ink/30 pt-6 font-display text-2xl uppercase tracking-[0.03em] text-ink">3. User Accounts</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.
            </p>

            <h2 className="mt-10 border-t border-ink/30 pt-6 font-display text-2xl uppercase tracking-[0.03em] text-ink">4. Competition Rules</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              Competition organizers are responsible for setting and enforcing their own rules. LMSLocal provides the platform but does not mediate disputes between participants. All competition results are final as determined by the organizer.
            </p>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              Fixture and result data - whether entered manually by an organiser or sourced automatically through our fixture service - is provided on a best-efforts basis and may occasionally be delayed, incomplete, or incorrect. We do not guarantee the accuracy of this data and are not responsible for eliminations, outcomes, or other consequences resulting from inaccurate or mistimed fixture or result data.
            </p>

            <h2 className="mt-10 border-t border-ink/30 pt-6 font-display text-2xl uppercase tracking-[0.03em] text-ink">5. Weekly Challenge (Free Prize Competition)</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              The following terms apply specifically to our free Weekly Challenge competition with cash prizes:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-[17px] leading-relaxed text-ink marker:text-overprint">
              <li><strong>Eligibility:</strong> You must be 18 years or older and a UK resident to be eligible to win prizes.</li>
              <li><strong>Single Entry:</strong> Each person may only have one entry in the competition. Multiple entries are not permitted.</li>
              <li><strong>Multiple Entry Violation:</strong> If we discover that a participant has multiple entries, all entries associated with that person will be voided and they will be disqualified from current and future competitions.</li>
              <li><strong>Cancellation:</strong> We reserve the right to cancel, suspend, or modify the competition at any time without prior notice.</li>
              <li><strong>Draw Outcome:</strong> If the competition ends in a draw (multiple players remain at the end), no prize will be awarded for that competition period.</li>
              <li><strong>AI Challenger Outcome:</strong> If an AI challenger (Bot) is the last remaining participant, no prize will be awarded for that competition period.</li>
              <li><strong>Prize Payment:</strong> Winners will be contacted by email to arrange payment. You must have a valid email address registered to your account for the prize to be valid.</li>
            </ul>

            <h2 className="mt-10 border-t border-ink/30 pt-6 font-display text-2xl uppercase tracking-[0.03em] text-ink">6. Payment and Fees</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              LMSLocal is free to use up to a limit of 20 player places at any one time. There is no subscription. Additional player places are bought as one-off credit packs, and the fixture service is charged per competition. Current prices are shown on our pricing page. We may change our prices, or introduce new charges, with 30 days notice to existing customers.
            </p>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              <strong className="font-semibold">Credits.</strong> One credit provides one player place beyond your free allowance of 20. A credit is used at the point a player joins one of your competitions, and is not returned if that player subsequently leaves or is removed, except where the player is removed before the competition has started. A person joining two of your competitions uses one credit for each. Credits are valid for 12 months from the date of purchase, after which any unused balance may be withdrawn.
            </p>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              <strong className="font-semibold">Refunds.</strong> Credits are sold as a one-off purchase and are non-refundable once bought, including any unused balance. If we suspend or discontinue the Service, whether in whole or in part, we are not obliged to refund unused credits or any other amount paid. This does not affect your statutory rights as a consumer under UK law.
            </p>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              Competition organisers are responsible for collecting any entry fees directly from participants. LMSLocal does not process, hold or distribute entry fees or prize money at any point.
            </p>

            <h2 className="mt-10 border-t border-ink/30 pt-6 font-display text-2xl uppercase tracking-[0.03em] text-ink">7. Prohibited Use</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">You agree not to:</p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-[17px] leading-relaxed text-ink marker:text-overprint">
              <li>Use the Service for any unlawful purpose or to solicit unlawful activity</li>
              <li>Attempt to gain unauthorized access to the Service or its related systems</li>
              <li>Interfere with or disrupt the Service or servers or networks</li>
              <li>Use automated systems to access the Service without permission</li>
              <li>Create competitions for illegal gambling purposes</li>
            </ul>

            <h2 className="mt-10 border-t border-ink/30 pt-6 font-display text-2xl uppercase tracking-[0.03em] text-ink">8. Content and Data</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              You retain ownership of any content you submit. By using the Service, you grant us a license to use, display, and distribute your content as necessary to provide the Service.
            </p>

            <h2 id="data-retention" className="mt-10 border-t border-ink/30 pt-6 font-display text-2xl uppercase tracking-[0.03em] text-ink">9. Data Retention and Account Management</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              To maintain system performance and manage storage efficiently, we implement the following data retention policies:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-[17px] leading-relaxed text-ink marker:text-overprint">
              <li><strong>Competition Data:</strong> Completed competitions and their associated data will be automatically removed from our systems 60 days after completion. Unused competitions that remain in setup status may also be removed after 60 days of inactivity.</li>
              <li><strong>Inactive User Accounts:</strong> User accounts that remain inactive for 60 consecutive days will be automatically removed from our system. This policy does not apply to accounts holding unused credits, which will be preserved for as long as those credits remain valid.</li>
              <li><strong>Data Export:</strong> If you wish to preserve any competition data before it is removed, please contact us before the deletion date and we will assist you.</li>
              <li><strong>Discretionary Removal:</strong> We may also remove competitions or accounts at any time, without prior notice, where our staff judge them to be unused, unwanted, or otherwise not needed - or for any other reason at our discretion.</li>
            </ul>

            <h2 className="mt-10 border-t border-ink/30 pt-6 font-display text-2xl uppercase tracking-[0.03em] text-ink">10. Privacy</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              Your privacy is important to us. Please review our <Link href="/privacy" className="underline decoration-dotted underline-offset-4 hover:text-overprint">Privacy Policy</Link>, which also governs your use of the Service.
            </p>

            <h2 className="mt-10 border-t border-ink/30 pt-6 font-display text-2xl uppercase tracking-[0.03em] text-ink">11. Termination</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              We may terminate or suspend your account at any time for violation of these terms. You may delete your account at any time through your profile settings.
            </p>

            <h2 className="mt-10 border-t border-ink/30 pt-6 font-display text-2xl uppercase tracking-[0.03em] text-ink">12. Limitation of Liability</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              LMSLocal shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the Service. This includes, without limitation, damages or losses arising from incorrect, delayed, or corrupted fixture or result data, service interruptions, or data loss, regardless of whether caused by manual entry, automated processing, or system error.
            </p>

            <h2 className="mt-10 border-t border-ink/30 pt-6 font-display text-2xl uppercase tracking-[0.03em] text-ink">13. Changes to Terms</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              We reserve the right to modify these terms at any time. We will notify users of significant changes via email or through the Service.
            </p>

            <h2 className="mt-10 border-t border-ink/30 pt-6 font-display text-2xl uppercase tracking-[0.03em] text-ink">14. Contact Information</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              If you have any questions about these Terms of Service, please contact us at lmslocal8@gmail.com.
            </p>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              <strong>Noodev8 Ltd</strong><br />
              Company Number: 16222537<br />
              Registered Address: 3 Cumberland Place, Welshpool, SY21 7SB
            </p>

            <h2 className="mt-10 border-t border-ink/30 pt-6 font-display text-2xl uppercase tracking-[0.03em] text-ink">15. Governing Law</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              These terms shall be governed by and construed in accordance with the laws of England and Wales.
            </p>
          </div>
        </div>
        </main>
        <PublicFooter width="narrow" />
    </div>
  );
}