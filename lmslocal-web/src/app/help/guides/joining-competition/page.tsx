import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'How to Join a Competition | LMSLocal Help',
  description: 'Step-by-step guide on joining Last Man Standing competitions. Learn how to use access codes, slugs, and get started with your first picks.',
  keywords: 'join competition, access code, slug, last man standing, getting started'
};

export default function JoiningCompetitionGuidePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg p-8 border border-slate-200 mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-4">🚪 How to Join a Competition</h1>
          <p className="text-lg text-slate-600">
            Ready to test your football knowledge? Here&apos;s everything you need to know about joining a Last Man Standing competition.
          </p>
        </div>

        <div className="space-y-8">
          {/* Getting an Invitation */}
          <div className="bg-white rounded-lg p-8 border border-slate-200">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">📨 Getting an Invitation</h2>

            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-4">📱 From the Organizer</h3>
                <div className="text-blue-800 text-sm space-y-2">
                  <p><strong>Access Code:</strong> A 6-digit code like &quot;ABC123&quot;</p>
                  <p><strong>Competition Slug:</strong> A custom URL like &quot;pub-league-2024&quot;</p>
                  <p><strong>Direct Link:</strong> A full URL to join instantly</p>
                  <p><strong>QR Code:</strong> Scan with your phone camera</p>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-yellow-900 mb-4">💡 Pro Tip</h3>
                <p className="text-yellow-800 text-sm">
                  Ask the organizer which method they&apos;re using. Most competitions use either an access code or a custom slug for easy sharing.
                </p>
              </div>
            </div>
          </div>

          {/* Step-by-Step Joining Process */}
          <div className="bg-white rounded-lg p-8 border border-slate-200">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">🎯 Step-by-Step Joining Process</h2>

            <div className="space-y-6">
              {/* Step 1 */}
              <div className="flex gap-4">
                <div className="bg-emerald-100 text-emerald-800 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0">
                  1
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Go to the Join Page</h3>
                  <div className="text-slate-600 text-sm space-y-2">
                    <p><strong>Option A:</strong> Visit the main website and click &quot;Join Competition&quot;</p>
                    <p><strong>Option B:</strong> Use the direct link provided by the organizer</p>
                    <p><strong>Option C:</strong> Scan the QR code with your phone</p>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-4">
                <div className="bg-emerald-100 text-emerald-800 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0">
                  2
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Enter Your Details</h3>
                  <div className="text-slate-600 text-sm space-y-2">
                    <p><strong>Email:</strong> For authentication and notifications</p>
                    <p><strong>Display Name:</strong> How you&apos;ll appear in the competition</p>
                    <p><strong>Access Code/Slug:</strong> If not already filled in</p>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-4">
                <div className="bg-emerald-100 text-emerald-800 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0">
                  3
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Verify Your Email</h3>
                  <div className="text-slate-600 text-sm space-y-2">
                    <p>Check your inbox for a magic link email</p>
                    <p>Click the link to verify and complete registration</p>
                    <p>You&apos;ll be automatically logged in</p>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex gap-4">
                <div className="bg-emerald-100 text-emerald-800 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0">
                  4
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Welcome to the Competition!</h3>
                  <div className="text-slate-600 text-sm space-y-2">
                    <p>You&apos;ll see the competition dashboard</p>
                    <p>Review the rules and available teams</p>
                    <p>Check when the first round begins</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Different Access Methods */}
          <div className="bg-white rounded-lg p-8 border border-slate-200">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">🔑 Access Methods Explained</h2>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-purple-900 mb-4">🎫 Access Code</h3>
                <div className="text-purple-800 text-sm space-y-2">
                  <p><strong>Format:</strong> 6 characters (ABC123)</p>
                  <p><strong>Use case:</strong> Quick sharing in person</p>
                  <p><strong>Example:</strong> &quot;The code is PUB024&quot;</p>
                  <p><strong>Benefits:</strong> Easy to remember and share</p>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-green-900 mb-4">🏷️ Competition Slug</h3>
                <div className="text-green-800 text-sm space-y-2">
                  <p><strong>Format:</strong> Custom URL (pub-league-2024)</p>
                  <p><strong>Use case:</strong> Branded, memorable links</p>
                  <p><strong>Example:</strong> &quot;Join at /play/office-premier&quot;</p>
                  <p><strong>Benefits:</strong> Professional and descriptive</p>
                </div>
              </div>
            </div>
          </div>

          {/* After Joining */}
          <div className="bg-white rounded-lg p-8 border border-slate-200">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">🎉 What Happens After Joining</h2>

            <div className="space-y-6">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">📋 Your Competition Dashboard</h3>
                <div className="text-slate-600 text-sm space-y-2">
                  <p><strong>Competition Details:</strong> Rules, prize info, and schedule</p>
                  <p><strong>Your Status:</strong> Lives remaining and pick history</p>
                  <p><strong>Leaderboard:</strong> See how you&apos;re doing vs others</p>
                  <p><strong>Current Round:</strong> Make your pick or see results</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-4">📧 Email Notifications</h3>
                <div className="text-blue-800 text-sm space-y-2">
                  <p><strong>Round Reminders:</strong> Don&apos;t forget to pick</p>
                  <p><strong>Result Updates:</strong> See if your team won</p>
                  <p><strong>Competition News:</strong> Important announcements</p>
                  <p><strong>Magic Links:</strong> Quick login without passwords</p>
                </div>
              </div>
            </div>
          </div>

          {/* Troubleshooting */}
          <div className="bg-white rounded-lg p-8 border border-slate-200">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">🔧 Troubleshooting</h2>

            <div className="space-y-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-red-900 mb-4">❌ Common Issues</h3>
                <div className="text-red-800 text-sm space-y-3">
                  <div>
                    <p className="font-medium">&quot;Competition not found&quot;</p>
                    <p>• Double-check the access code or slug</p>
                    <p>• Confirm the competition is still active</p>
                    <p>• Contact the organizer for the correct details</p>
                  </div>
                  <div>
                    <p className="font-medium">&quot;Email not arriving&quot;</p>
                    <p>• Check your spam/junk folder</p>
                    <p>• Verify you entered the correct email</p>
                    <p>• Try requesting another magic link</p>
                  </div>
                  <div>
                    <p className="font-medium">&quot;Competition is full&quot;</p>
                    <p>• Contact the organizer about capacity</p>
                    <p>• Ask to be added to a waiting list</p>
                    <p>• Check if there are other similar competitions</p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-yellow-900 mb-4">💡 Pro Tips</h3>
                <div className="text-yellow-800 text-sm space-y-2">
                  <p><strong>Bookmark the page:</strong> Easy access to your competition</p>
                  <p><strong>Add to calendar:</strong> Set reminders for pick deadlines</p>
                  <p><strong>Read the rules:</strong> Each competition may have variations</p>
                  <p><strong>Check team lists:</strong> See which teams you can pick</p>
                </div>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <div className="bg-gradient-to-r from-emerald-500 to-blue-600 rounded-lg p-8 text-white">
            <h2 className="text-2xl font-bold mb-4">🚀 Ready to Play?</h2>
            <p className="text-emerald-100 mb-6">
              You&apos;re all set! Now it&apos;s time to make your first pick and start your Last Man Standing journey.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white/10 rounded-lg p-4">
                <h3 className="font-semibold mb-2">📚 Learn Strategy</h3>
                <p className="text-sm text-emerald-100">Read our making picks guide for winning tips</p>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <h3 className="font-semibold mb-2">🎯 How to Play</h3>
                <p className="text-sm text-emerald-100">Review the complete rules and gameplay</p>
              </div>
            </div>
          </div>

          {/* Support */}
          <div className="bg-white rounded-lg p-8 border border-slate-200 text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Need More Help?</h2>
            <p className="text-slate-600 mb-6">
              Still having trouble joining? Our support team is ready to help you get started.
            </p>
            <a
              href="mailto:noodev8@gmail.com"
              className="inline-flex items-center px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              📧 noodev8@gmail.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}