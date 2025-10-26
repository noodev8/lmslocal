import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Support | LMSLocal Help',
  description: 'Get help with LMSLocal. Contact our support team for technical issues, account problems, and platform questions.',
  keywords: 'support, help, contact, technical issues, account problems, lmslocal'
};

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg p-8 border border-slate-200 mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-4">📞 Contact Support</h1>
          <p className="text-lg text-slate-600">
            Need help? Get in touch with us.
          </p>
        </div>

        {/* Contact Details */}
        <div className="bg-white rounded-lg p-8 border border-slate-200 mb-8">
          <div className="space-y-6">
            {/* Email */}
            <div>
              <h2 className="text-xl font-semibold text-slate-900 mb-3">📧 Email</h2>
              <a
                href="mailto:noodev8@gmail.com"
                className="text-blue-600 hover:text-blue-700 text-lg font-medium"
              >
                noodev8@gmail.com
              </a>
              <p className="text-slate-600 text-sm mt-2">
                Available 24/7 - Expect a reply within 24 hours
              </p>
            </div>

            {/* Phone */}
            <div className="border-t border-slate-200 pt-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-3">📱 Phone</h2>
              <p className="text-lg font-medium text-slate-900">Andreas: 07818 443886</p>
              <p className="text-slate-600 text-sm mt-2">
                Available 11am - 5pm
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}