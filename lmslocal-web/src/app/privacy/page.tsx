import Link from 'next/link';
import { TrophyIcon } from '@heroicons/react/24/outline';

export default function PrivacyPolicy() {
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
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
          <p className="text-slate-600 mb-8">Last updated: September 22, 2025</p>

          <div className="prose prose-slate max-w-none">
            <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">1. Introduction</h2>
            <p className="text-slate-700 mb-4">
              LMSLocal (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service.
            </p>

            <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">2. Information We Collect</h2>

            <h3 className="text-lg font-medium text-slate-900 mt-6 mb-3">Information You Provide</h3>
            <ul className="list-disc pl-6 text-slate-700 mb-4">
              <li><strong>Account Information:</strong> Email address, display name, password</li>
              <li><strong>Competition Data:</strong> Competition names, team selections, results</li>
              <li><strong>Communication:</strong> Support requests, feedback</li>
            </ul>

            <h3 className="text-lg font-medium text-slate-900 mt-6 mb-3">Information Automatically Collected</h3>
            <ul className="list-disc pl-6 text-slate-700 mb-4">
              <li><strong>Usage Data:</strong> Pages visited, features used, time spent</li>
              <li><strong>Device Information:</strong> Browser type, operating system, IP address</li>
              <li><strong>Cookies:</strong> Essential cookies for authentication and preferences</li>
            </ul>

            <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">3. How We Use Your Information</h2>
            <p className="text-slate-700 mb-2">We use your information to:</p>
            <ul className="list-disc pl-6 text-slate-700 mb-4">
              <li>Provide and maintain the Service</li>
              <li>Authenticate your account and prevent fraud</li>
              <li>Send you important service notifications</li>
              <li>Process competition data and results</li>
              <li>Improve our Service and user experience</li>
              <li>Provide customer support</li>
              <li>Comply with legal obligations</li>
            </ul>

            <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">4. Information Sharing</h2>
            <p className="text-slate-700 mb-4">
              We do not sell, trade, or rent your personal information. We may share your information only in these circumstances:
            </p>
            <ul className="list-disc pl-6 text-slate-700 mb-4">
              <li><strong>Within Competitions:</strong> Your display name and competition activity are visible to other participants</li>
              <li><strong>Service Providers:</strong> Third-party services that help us operate (hosting, email delivery)</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
              <li><strong>Business Transfer:</strong> In case of merger, acquisition, or sale of assets</li>
            </ul>

            <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">5. Data Retention</h2>
            <p className="text-slate-700 mb-4">
              We retain your information for as long as your account is active or as needed to provide services. Competition data may be retained for historical purposes even after account deletion, but will be anonymized.
            </p>

            <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">6. Data Security</h2>
            <p className="text-slate-700 mb-4">
              We implement appropriate technical and organizational measures to protect your information, including:
            </p>
            <ul className="list-disc pl-6 text-slate-700 mb-4">
              <li>Encrypted data transmission (HTTPS)</li>
              <li>Secure password hashing</li>
              <li>Regular security assessments</li>
              <li>Limited access to personal data</li>
            </ul>

            <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">7. Your Rights (GDPR)</h2>
            <p className="text-slate-700 mb-2">If you are in the European Union, you have the right to:</p>
            <ul className="list-disc pl-6 text-slate-700 mb-4">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Rectification:</strong> Correct inaccurate information</li>
              <li><strong>Erasure:</strong> Request deletion of your data</li>
              <li><strong>Portability:</strong> Receive your data in a machine-readable format</li>
              <li><strong>Objection:</strong> Object to processing of your data</li>
              <li><strong>Restriction:</strong> Request limitation of processing</li>
            </ul>
            <p className="text-slate-700 mb-4">
              To exercise these rights, contact us at noodev8@gmail.com.
            </p>

            <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">8. Cookies</h2>
            <p className="text-slate-700 mb-4">
              We use essential cookies to provide the Service, including:
            </p>
            <ul className="list-disc pl-6 text-slate-700 mb-4">
              <li><strong>Authentication:</strong> To keep you logged in</li>
              <li><strong>Preferences:</strong> To remember your settings</li>
              <li><strong>Security:</strong> To prevent fraud and abuse</li>
            </ul>
            <p className="text-slate-700 mb-4">
              You can control cookies through your browser settings, but this may affect Service functionality.
            </p>

            <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">9. Third-Party Services</h2>
            <p className="text-slate-700 mb-4">
              We use the following third-party services:
            </p>
            <ul className="list-disc pl-6 text-slate-700 mb-4">
              <li><strong>Vercel:</strong> Website hosting and deployment</li>
              <li><strong>PostgreSQL:</strong> Database hosting</li>
              <li><strong>Resend:</strong> Email delivery service</li>
            </ul>
            <p className="text-slate-700 mb-4">
              These services have their own privacy policies and may collect additional information.
            </p>

            <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">10. Children&apos;s Privacy</h2>
            <p className="text-slate-700 mb-4">
              Our Service is not intended for children under 13. We do not knowingly collect personal information from children under 13. If you become aware that a child has provided us with personal information, please contact us.
            </p>

            <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">11. International Data Transfers</h2>
            <p className="text-slate-700 mb-4">
              Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place for such transfers.
            </p>

            <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">12. Changes to This Policy</h2>
            <p className="text-slate-700 mb-4">
              We may update this Privacy Policy from time to time. We will notify you of any changes by email or through the Service.
            </p>

            <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">13. Contact Us</h2>
            <p className="text-slate-700 mb-4">
              If you have any questions about this Privacy Policy, please contact us:
            </p>
            <ul className="list-none text-slate-700 mb-4">
              <li>Email: noodev8@gmail.com</li>
              <li>Support: noodev8@gmail.com</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}