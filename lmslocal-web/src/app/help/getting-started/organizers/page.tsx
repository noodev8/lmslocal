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
                <p>1. Click &quot;Create Competition&quot; from your dashboard</p>
                <p>2. Enter competition details:</p>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900 mb-2">Basic Details</h4>
                  <div className="text-slate-700 text-sm space-y-1">
                    <p><strong>Name:</strong> e.g., &quot;The Red Lion LMS 2024&quot;</p>
                    <p><strong>Description:</strong> Optional details about your competition</p>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900 mb-2">Rules Settings</h4>
                  <div className="text-slate-700 text-sm space-y-1">
                    <p><strong>Lives:</strong> How many wrong picks players can survive (0-2)</p>
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
                <div className="bg-slate-50 rounded-lg p-4 text-center border-2 border-slate-300">
                  <h4 className="font-semibold text-slate-900 mb-2">Championship</h4>
                  <p className="text-slate-600 text-sm italic">Coming Soon</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 text-center border-2 border-slate-300">
                  <h4 className="font-semibold text-slate-900 mb-2">Custom Teams</h4>
                  <p className="text-slate-600 text-sm italic">Coming Soon</p>
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
              <p className="text-slate-700 mb-4">Your competition generates an invite code that players can use to join.</p>
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <span className="text-xl mr-2">🔑</span>
                  <h4 className="font-semibold text-slate-900">Invite Code</h4>
                </div>
                <p className="text-slate-700 text-sm">Share this code with your players so they can join your competition.</p>
              </div>
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
                <p>After creating your competition, you&apos;ll be asked to enter your first set of fixtures:</p>
                <p>1. Set the lock date and time for the round (applies to the whole round)</p>
                <p>2. Add matches for that round</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Managing Competition */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">⚙️ Managing Your Competition</h2>

        <div className="space-y-4 text-slate-700 mb-6">
          <p>Once your competition is running, managing it is simple:</p>
          <ol className="space-y-3 ml-4 list-decimal">
            <li><strong>Enter fixtures</strong> for each round (click &quot;Fixtures&quot; to start a new round)</li>
            <li><strong>Update results</strong> after matches are played</li>
            <li><strong>Lives and eliminations are automatically calculated</strong> when the round is over</li>
            <li><strong>Start the next round</strong> by clicking &quot;Fixtures&quot; again</li>
          </ol>
        </div>

        <div className="bg-slate-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Key Features</h3>
          <ul className="space-y-2 text-slate-700 list-disc ml-4">
            <li><strong>Override Picks:</strong> Help players who have issues</li>
            <li><strong>Manage Players:</strong> Add or remove players</li>
            <li><strong>View Standings:</strong> Track player progress and eliminations</li>
          </ul>
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
        </div>
      </div>

      {/* Support CTA */}
      <div className="bg-slate-50 rounded-lg p-8 text-center border">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Need Help?</h2>
        <p className="text-slate-700 mb-6">
          If you need assistance, check our FAQ or contact support.
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