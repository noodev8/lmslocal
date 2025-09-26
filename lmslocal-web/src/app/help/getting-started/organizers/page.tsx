import Link from 'next/link';

export const metadata = {
  title: 'Getting Started for Organizers - LMSLocal Help',
  description: 'Complete guide to setting up and managing your first Last Man Standing competition. Create competitions, invite players, and manage rounds in just 5 minutes.',
  keywords: 'last man standing organizer, create competition, manage LMS, pub competition, workplace competition',
  openGraph: {
    title: 'Getting Started for Organizers',
    description: 'Learn how to create and manage Last Man Standing competitions for your pub, workplace, or club.',
    type: 'article',
  }
};

export default function OrganizersGettingStartedPage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero Section */}
      <div className="bg-slate-50 rounded-lg p-8 mb-8 border">
        <h1 className="text-4xl font-bold text-slate-900 mb-6">
          Getting Started for Organizers
        </h1>
        <p className="text-lg text-slate-700 mb-6">
          Welcome! This guide will walk you through setting up your first Last Man Standing competition
          for your pub, workplace, or club in just 5 minutes.
        </p>
        <div className="bg-white border rounded-lg p-4">
          <p className="font-semibold">🚀 Quick Setup: Follow these 5 simple steps to get your competition running</p>
        </div>
      </div>

      {/* Quick Setup Steps */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">
          Quick Setup (5 Minutes)
        </h2>

        {/* Step 1 */}
        <div className="bg-white rounded-lg border p-6 mb-6">
          <div className="flex items-start">
            <div className="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold mr-4 mt-1">1</div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-slate-900 mb-3">Create Your Account</h3>
              <div className="space-y-2 text-slate-700">
                <p>1. Go to <Link href="/register" className="text-blue-600 hover:underline">Register</Link></p>
                <p>2. Enter your email and create a password</p>
                <p>3. Verify your email address</p>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="bg-white rounded-lg border p-6 mb-6">
          <div className="flex items-start">
            <div className="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold mr-4 mt-1">2</div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-slate-900 mb-3">Create a Competition</h3>
              <div className="space-y-2 text-slate-700 mb-4">
                <p>1. Click "Create Competition" from your dashboard</p>
                <p>2. Enter competition details:</p>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900 mb-2">Basic Details</h4>
                  <div className="text-slate-700 text-sm space-y-1">
                    <p><strong>Name:</strong> e.g., "The Red Lion LMS 2024"</p>
                    <p><strong>Description:</strong> Optional details about your competition</p>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900 mb-2">Rules Settings</h4>
                  <div className="text-slate-700 text-sm space-y-1">
                    <p><strong>Lives:</strong> How many wrong picks players can survive (0-3)</p>
                    <p><strong>No Team Twice:</strong> Recommended ON</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="bg-white rounded-lg border p-6 mb-6">
          <div className="flex items-start">
            <div className="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold mr-4 mt-1">3</div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-slate-900 mb-3">Add Teams</h3>
              <p className="text-slate-700 mb-4">Choose which teams players can pick from:</p>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-slate-50 rounded-lg p-4 text-center">
                  <h4 className="font-semibold text-slate-900 mb-2">Premier League</h4>
                  <p className="text-slate-700 text-sm">20 teams</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 text-center">
                  <h4 className="font-semibold text-slate-900 mb-2">Championship</h4>
                  <p className="text-slate-700 text-sm">24 teams</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 text-center">
                  <h4 className="font-semibold text-slate-900 mb-2">Custom Selection</h4>
                  <p className="text-slate-700 text-sm">Choose your own</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 4 */}
        <div className="bg-white rounded-lg border p-6 mb-6">
          <div className="flex items-start">
            <div className="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold mr-4 mt-1">4</div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-slate-900 mb-3">Invite Players</h3>
              <p className="text-slate-700 mb-4">Your competition generates:</p>
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center mb-2">
                    <span className="text-xl mr-2">🔑</span>
                    <h4 className="font-semibold text-slate-900">Invite Code</h4>
                  </div>
                  <p className="text-slate-700 text-sm">6-character code (e.g., ABC123)</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center mb-2">
                    <span className="text-xl mr-2">🔗</span>
                    <h4 className="font-semibold text-slate-900">Direct Link</h4>
                  </div>
                  <p className="text-slate-700 text-sm">Share via WhatsApp, email, or social media</p>
                </div>
              </div>
              <p className="text-slate-600 text-sm italic">Players use either method to join your competition.</p>
            </div>
          </div>
        </div>

        {/* Step 5 */}
        <div className="bg-white rounded-lg border p-6 mb-6">
          <div className="flex items-start">
            <div className="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold mr-4 mt-1">5</div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-slate-900 mb-3">Add Fixtures</h3>
              <div className="space-y-2 text-slate-700">
                <p>1. Navigate to "Manage Rounds"</p>
                <p>2. Click "Add Round"</p>
                <p>3. Select fixture dates</p>
                <p>4. Add matches for that gameweek</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Managing Competition */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">⚙️ Managing Your Competition</h2>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">📅 Before Each Round</h3>
            <ul className="space-y-2 text-slate-700">
              <li>• Add fixtures at least 2 days before matches</li>
              <li>• Remind players to make their picks</li>
              <li>• Set pick deadlines (default: 1 hour before kickoff)</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">🏆 After Matches</h3>
            <ul className="space-y-2 text-slate-700">
              <li>• Enter match results</li>
              <li>• System automatically eliminates players</li>
              <li>• View standings and statistics</li>
            </ul>
          </div>
        </div>

        <div className="bg-slate-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Key Features</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <ul className="space-y-2 text-slate-700">
              <li>• <strong>Override Picks:</strong> Help players who have issues</li>
              <li>• <strong>Manage Players:</strong> Add or remove players</li>
            </ul>
            <ul className="space-y-2 text-slate-700">
              <li>• <strong>Reset Competition:</strong> Start over if needed</li>
              <li>• <strong>Export Data:</strong> Download player information</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Best Practices */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">💡 Best Practices</h2>

        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">💬 Communication is Key</h3>
            <ul className="space-y-2 text-slate-700">
              <li>• Send weekly reminders</li>
              <li>• Share fixture lists early</li>
              <li>• Announce results promptly</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">⚖️ Fair Play</h3>
            <ul className="space-y-2 text-slate-700">
              <li>• Be consistent with deadlines</li>
              <li>• Enter results accurately</li>
              <li>• Handle disputes fairly</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">🎉 Keep It Fun</h3>
            <ul className="space-y-2 text-slate-700">
              <li>• Share weekly updates</li>
              <li>• Celebrate last players standing</li>
              <li>• Consider prizes for winners</li>
            </ul>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Common Questions</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-slate-900 mb-2">Q: How many players can join?</h3>
            <p className="text-slate-700">A: Unlimited! The system handles competitions of any size.</p>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 mb-2">Q: Can I run multiple competitions?</h3>
            <p className="text-slate-700">A: Yes, you can manage multiple competitions from one account.</p>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 mb-2">Q: What if I make a mistake?</h3>
            <p className="text-slate-700">A: You can edit fixtures, results, and even override player picks if needed.</p>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Next Steps</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <Link
            href="/help/rules"
            className="block bg-slate-50 rounded-lg border p-6 hover:bg-slate-100 transition-colors"
          >
            <div className="text-center">
              <div className="text-2xl mb-3">📋</div>
              <h3 className="font-semibold text-slate-900 mb-2">Competition Rules</h3>
              <p className="text-slate-700 text-sm">Learn about detailed competition rules</p>
            </div>
          </Link>

          <Link
            href="/help/guides/managing-rounds"
            className="block bg-slate-50 rounded-lg border p-6 hover:bg-slate-100 transition-colors"
          >
            <div className="text-center">
              <div className="text-2xl mb-3">⚙️</div>
              <h3 className="font-semibold text-slate-900 mb-2">Round Management</h3>
              <p className="text-slate-700 text-sm">Advanced round management tips</p>
            </div>
          </Link>

          <Link
            href="/help/guides/creating-competition"
            className="block bg-slate-50 rounded-lg border p-6 hover:bg-slate-100 transition-colors"
          >
            <div className="text-center">
              <div className="text-2xl mb-3">🚀</div>
              <h3 className="font-semibold text-slate-900 mb-2">Detailed Guides</h3>
              <p className="text-slate-700 text-sm">View comprehensive setup guides</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Support CTA */}
      <div className="bg-slate-50 rounded-lg p-8 text-center border">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Need Help?</h2>
        <p className="text-slate-700 mb-6">
          Check our <Link href="/help/faq" className="text-blue-600 hover:underline">FAQ</Link> or{' '}
          <Link href="/help/support" className="text-blue-600 hover:underline">contact support</Link>
          {' '}if you need assistance.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/help/faq"
            className="px-4 py-2 bg-white text-slate-800 border rounded-lg hover:bg-slate-100 transition-colors"
          >
            View FAQ
          </Link>
          <Link
            href="/help/support"
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}