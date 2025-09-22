import Link from 'next/link';
import { TrophyIcon } from '@heroicons/react/24/outline';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <Link href="/" className="flex items-center">
              <TrophyIcon className="h-8 w-8 text-slate-700 mr-2" />
              <span className="text-2xl font-bold text-slate-900">LMSLocal</span>
            </Link>
            <Link
              href="/"
              className="text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 lg:p-12">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Terms of Service</h1>
          <p className="text-slate-600 mb-8">Last updated: September 22, 2025</p>

          <div className="prose prose-slate max-w-none">
            <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">1. Acceptance of Terms</h2>
            <p className="text-slate-700 mb-4">
              By accessing and using LMSLocal (&quot;the Service&quot;), you accept and agree to be bound by the terms and provision of this agreement.
            </p>

            <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">2. Beta Service</h2>
            <p className="text-slate-700 mb-4">
              LMSLocal is currently in beta testing. The Service is provided &quot;as is&quot; and may contain bugs, errors, or limitations. We make no warranties about the reliability, availability, or performance of the Service during this beta period.
            </p>

            <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">3. User Accounts</h2>
            <p className="text-slate-700 mb-4">
              You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.
            </p>

            <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">4. Competition Rules</h2>
            <p className="text-slate-700 mb-4">
              Competition organizers are responsible for setting and enforcing their own rules. LMSLocal provides the platform but does not mediate disputes between participants. All competition results are final as determined by the organizer.
            </p>

            <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">5. Payment and Fees</h2>
            <p className="text-slate-700 mb-4">
              During the beta period, LMSLocal is free to use. Future pricing will be communicated in advance. Competition organizers are responsible for collecting any entry fees directly from participants.
            </p>

            <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">6. Prohibited Use</h2>
            <p className="text-slate-700 mb-4">You agree not to:</p>
            <ul className="list-disc pl-6 text-slate-700 mb-4">
              <li>Use the Service for any unlawful purpose or to solicit unlawful activity</li>
              <li>Attempt to gain unauthorized access to the Service or its related systems</li>
              <li>Interfere with or disrupt the Service or servers or networks</li>
              <li>Use automated systems to access the Service without permission</li>
              <li>Create competitions for illegal gambling purposes</li>
            </ul>

            <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">7. Content and Data</h2>
            <p className="text-slate-700 mb-4">
              You retain ownership of any content you submit. By using the Service, you grant us a license to use, display, and distribute your content as necessary to provide the Service.
            </p>

            <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">8. Privacy</h2>
            <p className="text-slate-700 mb-4">
              Your privacy is important to us. Please review our <Link href="/privacy" className="text-slate-800 underline hover:text-slate-900">Privacy Policy</Link>, which also governs your use of the Service.
            </p>

            <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">9. Termination</h2>
            <p className="text-slate-700 mb-4">
              We may terminate or suspend your account at any time for violation of these terms. You may delete your account at any time through your profile settings.
            </p>

            <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">10. Limitation of Liability</h2>
            <p className="text-slate-700 mb-4">
              LMSLocal shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the Service.
            </p>

            <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">11. Changes to Terms</h2>
            <p className="text-slate-700 mb-4">
              We reserve the right to modify these terms at any time. We will notify users of significant changes via email or through the Service.
            </p>

            <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">12. Contact Information</h2>
            <p className="text-slate-700 mb-4">
              If you have any questions about these Terms of Service, please contact us at noodev8@gmail.com.
            </p>

            <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">13. Governing Law</h2>
            <p className="text-slate-700 mb-4">
              These terms shall be governed by and construed in accordance with the laws of England and Wales.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}