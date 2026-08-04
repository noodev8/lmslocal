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
      <div className="border border-ink/30 bg-stock-lit p-8 mb-8">
        <h1 className="font-display text-5xl font-semibold uppercase leading-[0.9] text-ink sm:text-6xl mb-6">
          Getting Started for Organizers
        </h1>
        <p className="text-xl leading-relaxed text-ink mb-6">
          Welcome! This guide will walk you through setting up your first Last Man Standing competition
          for your pub, workplace, or club in just 5 minutes.
        </p>
        <div className="bg-stock-lit border rounded-none p-4">
          <p className="font-semibold">🚀 Quick Setup: Follow these 5 simple steps to get your competition running</p>
        </div>
      </div>

      {/* Quick Setup Steps */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-ink mb-8 text-center">
          Quick Setup (5 Minutes)
        </h2>

        {/* Step 1 */}
        <div className="bg-stock-lit rounded-none border p-6 mb-6">
          <div className="flex items-start">
            <div className="mr-4 mt-1 flex h-10 w-10 flex-none items-center justify-center bg-overprint font-display text-lg text-stock-lit">1</div>
            <div className="flex-1">
              <h3 className="mt-8 font-display text-2xl uppercase tracking-[0.03em] text-ink mb-3">Create Your Account</h3>
              <div className="space-y-2 text-[17px] leading-relaxed text-ink">
                <p>1. Go to <Link href="/register" className="text-blue-600 hover:underline">Register</Link></p>
                <p>2. Enter your email and create a password</p>
                <p>3. Verify your email address</p>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="bg-stock-lit rounded-none border p-6 mb-6">
          <div className="flex items-start">
            <div className="mr-4 mt-1 flex h-10 w-10 flex-none items-center justify-center bg-overprint font-display text-lg text-stock-lit">2</div>
            <div className="flex-1">
              <h3 className="mt-8 font-display text-2xl uppercase tracking-[0.03em] text-ink mb-3">Create a Competition</h3>
              <div className="space-y-2 text-ink mb-4">
                <p>1. Click &quot;Create Competition&quot; from your dashboard</p>
                <p>2. Enter competition details:</p>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="border border-ink/30 bg-stock-lit p-4">
                  <h4 className="font-semibold text-ink mb-2">Basic Details</h4>
                  <div className="space-y-1 text-[15px] text-ink">
                    <p><strong>Name:</strong> e.g., &quot;The Red Lion LMS 2024&quot;</p>
                    <p><strong>Description:</strong> Optional details about your competition</p>
                  </div>
                </div>
                <div className="border border-ink/30 bg-stock-lit p-4">
                  <h4 className="font-semibold text-ink mb-2">Rules Settings</h4>
                  <div className="space-y-1 text-[15px] text-ink">
                    <p><strong>Lives:</strong> How many wrong picks players can survive (0-2)</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="bg-stock-lit rounded-none border p-6 mb-6">
          <div className="flex items-start">
            <div className="mr-4 mt-1 flex h-10 w-10 flex-none items-center justify-center bg-overprint font-display text-lg text-stock-lit">3</div>
            <div className="flex-1">
              <h3 className="mt-8 font-display text-2xl uppercase tracking-[0.03em] text-ink mb-3">Add Teams</h3>
              <p className="text-[17px] leading-relaxed text-ink mb-4">Choose which teams players can pick from:</p>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="border border-ink/30 bg-stock-lit p-4 text-center">
                  <h4 className="font-semibold text-ink mb-2">Premier League</h4>
                  <p className="text-[15px] text-ink">20 teams</p>
                </div>
                <div className="bg-stock-lit rounded-none p-4 text-center border-2 border-ink/30">
                  <h4 className="font-semibold text-ink mb-2">Championship</h4>
                  <p className="text-[15px] italic text-ink-fade">Coming Soon</p>
                </div>
                <div className="bg-stock-lit rounded-none p-4 text-center border-2 border-ink/30">
                  <h4 className="font-semibold text-ink mb-2">Custom Teams</h4>
                  <p className="text-[15px] italic text-ink-fade">Coming Soon</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 4 */}
        <div className="bg-stock-lit rounded-none border p-6 mb-6">
          <div className="flex items-start">
            <div className="mr-4 mt-1 flex h-10 w-10 flex-none items-center justify-center bg-overprint font-display text-lg text-stock-lit">4</div>
            <div className="flex-1">
              <h3 className="mt-8 font-display text-2xl uppercase tracking-[0.03em] text-ink mb-3">Invite Players</h3>
              <p className="text-[17px] leading-relaxed text-ink mb-4">Your competition generates an invite code that players can use to join.</p>
              <div className="border border-ink/30 bg-stock-lit p-4">
                <div className="flex items-center mb-2">
                  <span className="text-xl mr-2">🔑</span>
                  <h4 className="font-semibold text-ink">Invite Code</h4>
                </div>
                <p className="text-[15px] text-ink">Share this code with your players so they can join your competition.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Step 5 */}
        <div className="bg-stock-lit rounded-none border p-6 mb-6">
          <div className="flex items-start">
            <div className="mr-4 mt-1 flex h-10 w-10 flex-none items-center justify-center bg-overprint font-display text-lg text-stock-lit">5</div>
            <div className="flex-1">
              <h3 className="mt-8 font-display text-2xl uppercase tracking-[0.03em] text-ink mb-3">Add Fixtures</h3>
              <div className="space-y-2 text-[17px] leading-relaxed text-ink">
                <p>After creating your competition, you&apos;ll be asked to enter your first set of fixtures:</p>
                <p>1. Set the lock date and time for the round (applies to the whole round)</p>
                <p>2. Add matches for that round</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Managing Competition */}
      <div className="bg-stock-lit rounded-none p-8 mb-8 border">
        <h2 className="font-display text-4xl font-semibold uppercase leading-[0.9] text-ink mb-6">⚙️ Managing Your Competition</h2>

        <div className="space-y-4 text-ink mb-6">
          <p>Once your competition is running, managing it is simple:</p>
          <ol className="space-y-3 ml-4 list-decimal">
            <li><strong>Enter fixtures</strong> for each round (click &quot;Fixtures&quot; to start a new round)</li>
            <li><strong>Update results</strong> after matches are played</li>
            <li><strong>Lives and eliminations are automatically calculated</strong> when the round is over</li>
            <li><strong>Start the next round</strong> by clicking &quot;Fixtures&quot; again</li>
          </ol>
        </div>

        <div className="border border-ink/30 bg-stock-lit p-6">
          <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-4">Key Features</h3>
          <ul className="space-y-2 text-ink list-disc ml-4">
            <li><strong>Override Picks:</strong> Help players who have issues</li>
            <li><strong>Manage Players:</strong> Add or remove players</li>
            <li><strong>View Standings:</strong> Track player progress and eliminations</li>
          </ul>
        </div>
      </div>

      {/* Best Practices */}
      <div className="bg-stock-lit rounded-none p-8 mb-8 border">
        <h2 className="font-display text-4xl font-semibold uppercase leading-[0.9] text-ink mb-6">💡 Best Practices</h2>

        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-4">💬 Communication is Key</h3>
            <ul className="space-y-2 text-[17px] leading-relaxed text-ink">
              <li>• Send weekly reminders</li>
              <li>• Share fixture lists early</li>
              <li>• Announce results promptly</li>
            </ul>
          </div>

          <div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-4">⚖️ Fair Play</h3>
            <ul className="space-y-2 text-[17px] leading-relaxed text-ink">
              <li>• Be consistent with deadlines</li>
              <li>• Enter results accurately</li>
              <li>• Handle disputes fairly</li>
            </ul>
          </div>

          <div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-4">🎉 Keep It Fun</h3>
            <ul className="space-y-2 text-[17px] leading-relaxed text-ink">
              <li>• Share weekly updates</li>
              <li>• Celebrate last players standing</li>
              <li>• Consider prizes for winners</li>
            </ul>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-stock-lit rounded-none p-8 mb-8 border">
        <h2 className="font-display text-4xl font-semibold uppercase leading-[0.9] text-ink mb-6">Common Questions</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-ink mb-2">Q: How many players can join?</h3>
            <p className="text-[17px] leading-relaxed text-ink">A: Unlimited! The system handles competitions of any size.</p>
          </div>
          <div>
            <h3 className="font-semibold text-ink mb-2">Q: Can I run multiple competitions?</h3>
            <p className="text-[17px] leading-relaxed text-ink">A: Yes, you can manage multiple competitions from one account.</p>
          </div>
        </div>
      </div>

      {/* Support CTA */}
      <div className="border border-ink/30 bg-stock-lit p-8 text-center">
        <h2 className="font-display text-4xl font-semibold uppercase leading-[0.9] text-ink mb-4">Need Help?</h2>
        <p className="text-[17px] leading-relaxed text-ink mb-6">
          If you need assistance, check our FAQ or contact support.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/help/faq"
            className="px-4 py-2 bg-stock-lit text-ink border rounded-none hover:bg-stock-lit transition-colors"
          >
            View FAQ
          </Link>
          <Link
            href="/help/support"
            className="px-4 py-2 rounded-sm bg-overprint font-display uppercase tracking-[0.06em] text-stock-lit transition-opacity hover:opacity-90"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}