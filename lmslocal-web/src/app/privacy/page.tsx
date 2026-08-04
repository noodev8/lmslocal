import Link from 'next/link';
import PublicHeader from '@/components/public/PublicHeader';
import PublicFooter from '@/components/public/PublicFooter';

export default function PrivacyPolicy() {
  return (
    <div className="flex min-h-screen flex-col bg-stock font-body text-ink">
      <PublicHeader width="narrow" />

      {/* Content */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <div>
          <h1 className="font-display text-5xl font-semibold uppercase leading-[0.9] text-ink sm:text-6xl">Privacy Policy</h1>
          <p className="mt-4 font-body text-xs font-semibold uppercase tracking-[0.12em] text-ink-fade">Last updated: September 22, 2025</p>

          <div className="mt-10">
            <h2 className="mt-10 border-t border-ink/30 pt-6 font-display text-2xl uppercase tracking-[0.03em] text-ink">1. Introduction</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              LMSLocal (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;), operated by Noodev8 Ltd (Company Number: 16222537), is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service.
            </p>

            <h2 className="mt-10 border-t border-ink/30 pt-6 font-display text-2xl uppercase tracking-[0.03em] text-ink">2. Information We Collect</h2>

            <h3 className="mt-7 font-display text-xl uppercase tracking-[0.03em] text-ink">Information You Provide</h3>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-[17px] leading-relaxed text-ink marker:text-overprint">
              <li><strong>Account Information:</strong> Email address, display name, password</li>
              <li><strong>Competition Data:</strong> Competition names, team selections, results</li>
              <li><strong>Communication:</strong> Support requests, feedback</li>
            </ul>

            <h3 className="mt-7 font-display text-xl uppercase tracking-[0.03em] text-ink">Information Automatically Collected</h3>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-[17px] leading-relaxed text-ink marker:text-overprint">
              <li><strong>Usage Data:</strong> Pages visited, features used, time spent</li>
              <li><strong>Device Information:</strong> Browser type, operating system, IP address</li>
              <li><strong>Cookies:</strong> Essential cookies for authentication and preferences</li>
            </ul>

            <h2 className="mt-10 border-t border-ink/30 pt-6 font-display text-2xl uppercase tracking-[0.03em] text-ink">3. How We Use Your Information</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">We use your information to:</p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-[17px] leading-relaxed text-ink marker:text-overprint">
              <li>Provide and maintain the Service</li>
              <li>Authenticate your account and prevent fraud</li>
              <li>Send you important service notifications</li>
              <li>Process competition data and results</li>
              <li>Improve our Service and user experience</li>
              <li>Provide customer support</li>
              <li>Comply with legal obligations</li>
            </ul>

            <h2 className="mt-10 border-t border-ink/30 pt-6 font-display text-2xl uppercase tracking-[0.03em] text-ink">4. Information Sharing</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              We do not sell, trade, or rent your personal information. We may share your information only in these circumstances:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-[17px] leading-relaxed text-ink marker:text-overprint">
              <li><strong>Within Competitions:</strong> Your display name and competition activity are visible to other participants</li>
              <li><strong>Service Providers:</strong> Third-party services that help us operate (hosting, email delivery)</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
              <li><strong>Business Transfer:</strong> In case of merger, acquisition, or sale of assets</li>
            </ul>

            <h2 className="mt-10 border-t border-ink/30 pt-6 font-display text-2xl uppercase tracking-[0.03em] text-ink">5. Data Retention</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              We retain your information for as long as your account is active or as needed to provide services. For how long we keep competition and account data, and the circumstances in which it may be removed, see <Link href="/terms#data-retention" className="underline decoration-dotted underline-offset-4 hover:text-overprint">Section 9 of our Terms of Service</Link>.
            </p>

            <h2 className="mt-10 border-t border-ink/30 pt-6 font-display text-2xl uppercase tracking-[0.03em] text-ink">6. Data Security</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              We implement appropriate technical and organizational measures to protect your information, including:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-[17px] leading-relaxed text-ink marker:text-overprint">
              <li>Encrypted data transmission (HTTPS)</li>
              <li>Secure password hashing</li>
              <li>Regular security assessments</li>
              <li>Limited access to personal data</li>
            </ul>

            <h2 className="mt-10 border-t border-ink/30 pt-6 font-display text-2xl uppercase tracking-[0.03em] text-ink">7. Your Rights (GDPR)</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">If you are in the European Union, you have the right to:</p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-[17px] leading-relaxed text-ink marker:text-overprint">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Rectification:</strong> Correct inaccurate information</li>
              <li><strong>Erasure:</strong> Request deletion of your data</li>
              <li><strong>Portability:</strong> Receive your data in a machine-readable format</li>
              <li><strong>Objection:</strong> Object to processing of your data</li>
              <li><strong>Restriction:</strong> Request limitation of processing</li>
            </ul>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              To exercise these rights, contact us at noodev8@gmail.com.
            </p>

            <h2 className="mt-10 border-t border-ink/30 pt-6 font-display text-2xl uppercase tracking-[0.03em] text-ink">8. Cookies</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              We use essential cookies to provide the Service, including:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-[17px] leading-relaxed text-ink marker:text-overprint">
              <li><strong>Authentication:</strong> To keep you logged in</li>
              <li><strong>Preferences:</strong> To remember your settings</li>
              <li><strong>Security:</strong> To prevent fraud and abuse</li>
            </ul>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              You can control cookies through your browser settings, but this may affect Service functionality.
            </p>

            <h2 className="mt-10 border-t border-ink/30 pt-6 font-display text-2xl uppercase tracking-[0.03em] text-ink">9. Third-Party Services</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              We use the following third-party services:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-[17px] leading-relaxed text-ink marker:text-overprint">
              <li><strong>Vercel:</strong> Website hosting and deployment</li>
              <li><strong>PostgreSQL:</strong> Database hosting</li>
              <li><strong>Resend:</strong> Email delivery service</li>
            </ul>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              These services have their own privacy policies and may collect additional information.
            </p>

            <h2 className="mt-10 border-t border-ink/30 pt-6 font-display text-2xl uppercase tracking-[0.03em] text-ink">10. Children&apos;s Privacy</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              Our Service is not intended for children under 13. We do not knowingly collect personal information from children under 13. If you become aware that a child has provided us with personal information, please contact us.
            </p>

            <h2 className="mt-10 border-t border-ink/30 pt-6 font-display text-2xl uppercase tracking-[0.03em] text-ink">11. International Data Transfers</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place for such transfers.
            </p>

            <h2 className="mt-10 border-t border-ink/30 pt-6 font-display text-2xl uppercase tracking-[0.03em] text-ink">12. Changes to This Policy</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              We may update this Privacy Policy from time to time. We will notify you of any changes by email or through the Service.
            </p>

            <h2 className="mt-10 border-t border-ink/30 pt-6 font-display text-2xl uppercase tracking-[0.03em] text-ink">13. Contact Us</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              If you have any questions about this Privacy Policy, please contact us:
            </p>
            <ul className="mt-4 space-y-1 font-data text-[15px] text-ink">
              <li>Email: noodev8@gmail.com</li>
              <li>Support: noodev8@gmail.com</li>
            </ul>
            <p className="mt-4 text-[17px] leading-relaxed text-ink">
              <strong>Noodev8 Ltd</strong><br />
              Company Number: 16222537<br />
              Registered Address: 3 Cumberland Place, Welshpool, SY21 7SB
            </p>
          </div>
        </div>
        </main>
        <PublicFooter width="narrow" />
    </div>
  );
}