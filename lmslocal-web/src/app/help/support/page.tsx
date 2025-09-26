import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Support | LMSLocal Help',
  description: 'Get help with LMSLocal. Contact our support team for technical issues, account problems, and platform questions.',
  keywords: 'support, help, contact, technical issues, account problems, lmslocal'
};

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg p-8 border border-slate-200 mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-4">📞 Contact Support</h1>
          <p className="text-lg text-slate-600">
            Having trouble with LMSLocal? We&apos;re here to help you get back on track!
          </p>
        </div>

        {/* Main Support Contact */}
        <div className="bg-slate-900 rounded-lg p-8 text-white mb-8">
          <h2 className="text-2xl font-bold mb-4">📧 Get Direct Support</h2>
          <p className="text-slate-200 mb-6">
            For any technical issues or platform questions, email our support team:
          </p>

          <div className="text-center mb-6">
            <a
              href="mailto:noodev8@gmail.com"
              className="inline-flex items-center px-8 py-4 bg-white text-slate-900 rounded-lg hover:bg-slate-100 transition-colors font-semibold text-lg"
            >
              📧 noodev8@gmail.com
            </a>
          </div>

          <p className="text-center text-slate-300 text-sm">
            <strong>Response Time:</strong> Usually within 24-48 hours
          </p>
        </div>

        {/* Before Contacting */}
        <div className="bg-white rounded-lg p-8 border border-slate-200 mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">🔍 Check These First</h2>
          <p className="text-slate-600 mb-6">You might find your answer immediately in these resources:</p>

          <div className="space-y-4">
            <a href="/help/how-to-play" className="block bg-blue-50 border border-blue-200 rounded-lg p-4 hover:bg-blue-100 transition-colors">
              <div className="flex items-center">
                <span className="text-blue-600 text-2xl mr-4">🎯</span>
                <div>
                  <h3 className="font-semibold text-blue-900">How to Play Guide</h3>
                  <p className="text-blue-700 text-sm">Basic game rules and strategy tips</p>
                </div>
              </div>
            </a>

            <a href="/help/faq" className="block bg-green-50 border border-green-200 rounded-lg p-4 hover:bg-green-100 transition-colors">
              <div className="flex items-center">
                <span className="text-green-600 text-2xl mr-4">❓</span>
                <div>
                  <h3 className="font-semibold text-green-900">FAQ Section</h3>
                  <p className="text-green-700 text-sm">Common questions and answers</p>
                </div>
              </div>
            </a>

            <a href="/help/getting-started/organizers" className="block bg-purple-50 border border-purple-200 rounded-lg p-4 hover:bg-purple-100 transition-colors">
              <div className="flex items-center">
                <span className="text-purple-600 text-2xl mr-4">🚀</span>
                <div>
                  <h3 className="font-semibold text-purple-900">Getting Started</h3>
                  <p className="text-purple-700 text-sm">Setup and configuration help</p>
                </div>
              </div>
            </a>
          </div>
        </div>

        {/* Contact Organizer */}
        <div className="bg-white rounded-lg p-8 border border-slate-200 mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">👥 Try Your Organizer First</h2>
          <p className="text-slate-600 mb-4">For competition-specific questions, your organizer can help immediately:</p>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="space-y-2 text-yellow-800 text-sm">
              <p><strong>• Pick deadlines</strong> - When picks close for each round</p>
              <p><strong>• Entry fees</strong> - Payment details and refund policies</p>
              <p><strong>• Prize information</strong> - Winnings and payout schedules</p>
              <p><strong>• Competition rules</strong> - Any custom variations they&apos;ve set</p>
            </div>
          </div>
        </div>

        {/* When to Contact Support */}
        <div className="bg-white rounded-lg p-8 border border-slate-200 mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">🛠️ When to Contact Support</h2>
          <p className="text-slate-600 mb-6">We can help with these types of issues:</p>

          <div className="space-y-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-red-900 mb-4">🔒 Account Issues</h3>
              <div className="space-y-2 text-red-800 text-sm">
                <p>• Can&apos;t log in to your account</p>
                <p>• Magic link emails not arriving</p>
                <p>• Email verification problems</p>
                <p>• Need to delete your account</p>
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-orange-900 mb-4">⚙️ Technical Problems</h3>
              <div className="space-y-2 text-orange-800 text-sm">
                <p>• Pages not loading correctly</p>
                <p>• Picks not submitting properly</p>
                <p>• Results not displaying</p>
                <p>• Mobile or browser compatibility issues</p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">🏆 Competition Issues</h3>
              <div className="space-y-2 text-blue-800 text-sm">
                <p>• Can&apos;t join with invite code or slug</p>
                <p>• Missing from competition list</p>
                <p>• Pick history showing incorrectly</p>
                <p>• Platform-related result disputes</p>
              </div>
            </div>
          </div>
        </div>

        {/* What to Include */}
        <div className="bg-white rounded-lg p-8 border border-slate-200 mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">📋 What to Include in Your Email</h2>
          <p className="text-slate-600 mb-6">Help us help you faster by including:</p>

          <div className="space-y-3 text-slate-700">
            <div className="flex items-start">
              <span className="text-emerald-600 mr-3">✓</span>
              <p><strong>Your registered email address</strong> - So we can find your account</p>
            </div>
            <div className="flex items-start">
              <span className="text-emerald-600 mr-3">✓</span>
              <p><strong>Competition name</strong> - If the issue is competition-specific</p>
            </div>
            <div className="flex items-start">
              <span className="text-emerald-600 mr-3">✓</span>
              <p><strong>Clear description</strong> - What happened and what you expected</p>
            </div>
            <div className="flex items-start">
              <span className="text-emerald-600 mr-3">✓</span>
              <p><strong>Screenshots</strong> - If there&apos;s a visual problem</p>
            </div>
            <div className="flex items-start">
              <span className="text-emerald-600 mr-3">✓</span>
              <p><strong>Steps you&apos;ve tried</strong> - So we don&apos;t suggest things you&apos;ve already done</p>
            </div>
          </div>
        </div>

        {/* Feedback */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-emerald-900 mb-4">💡 Feedback &amp; Suggestions</h2>
          <p className="text-emerald-800 mb-6">
            Have ideas for new features or improvements? We&apos;d love to hear them!
          </p>
          <a
            href="mailto:noodev8@gmail.com?subject=LMSLocal Feedback"
            className="inline-flex items-center px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            💭 Send Feedback
          </a>
        </div>

        {/* Footer Note */}
        <div className="bg-slate-100 border border-slate-300 rounded-lg p-6 text-center">
          <p className="text-slate-600">
            <strong>💡 Remember:</strong> For urgent competition matters, always contact your organizer first - they can resolve most issues immediately.
          </p>
        </div>
      </div>
    </div>
  );
}