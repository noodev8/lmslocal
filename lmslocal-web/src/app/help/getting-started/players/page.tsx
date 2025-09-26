import Link from 'next/link';

export const metadata = {
  title: 'Getting Started for Players - LMSLocal Help',
  description: 'Learn how to join Last Man Standing competitions, make your first pick, and track your progress. Complete guide for new players.',
  keywords: 'last man standing player, join competition, make picks, football predictions',
  openGraph: {
    title: 'Getting Started for Players',
    description: 'Ready to test your football knowledge? Learn how to join and play Last Man Standing competitions.',
    type: 'article',
  }
};

export default function PlayersGettingStartedPage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero Section */}
      <div className="bg-slate-50 rounded-lg p-8 mb-8 border">
        <h1 className="text-4xl font-bold text-slate-900 mb-6">
          Getting Started for Players
        </h1>
        <p className="text-lg text-slate-700 mb-6">
          Ready to test your football knowledge? Here's how to join and play Last Man Standing competitions.
        </p>
        <div className="bg-white border rounded-lg p-4">
          <p className="font-semibold">⚽ Join a competition and start making winning predictions!</p>
        </div>
      </div>

      {/* Joining a Competition */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">🎯 Joining a Competition</h2>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-slate-50 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <span className="text-2xl mr-3">🔑</span>
              <h3 className="text-xl font-semibold text-slate-900">Option 1: Using an Invite Code</h3>
            </div>
            <div className="space-y-2 text-slate-700">
              <p>1. Get the 6-character code from your organizer</p>
              <p>2. Go to <Link href="/join" className="text-blue-600 hover:underline">Join Competition</Link></p>
              <p>3. Enter the code</p>
              <p>4. Create your player account</p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <span className="text-2xl mr-3">🔗</span>
              <h3 className="text-xl font-semibold text-slate-900">Option 2: Using a Direct Link</h3>
            </div>
            <div className="space-y-2 text-slate-700">
              <p>1. Click the link shared by your organizer</p>
              <p>2. You'll be taken directly to the competition</p>
              <p>3. Create your player account</p>
              <p>4. Start making picks!</p>
            </div>
          </div>
        </div>
      </div>

      {/* Making Your First Pick */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">🎲 Making Your First Pick</h2>

        <div className="space-y-6">
          <div className="flex items-start">
            <div className="w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold mr-4 mt-1">1</div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">View Available Fixtures</h3>
              <ul className="space-y-1 text-slate-700">
                <li>• Check the upcoming matches for the round</li>
                <li>• See kick-off times and venues</li>
                <li>• Note which teams are playing</li>
              </ul>
            </div>
          </div>

          <div className="flex items-start">
            <div className="w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold mr-4 mt-1">2</div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Choose Your Team</h3>
              <ul className="space-y-1 text-slate-700">
                <li>• Select ONE team you think will win</li>
                <li>• Remember: You can't pick the same team twice (in most competitions)</li>
                <li>• Consider saving strong teams for later rounds</li>
              </ul>
            </div>
          </div>

          <div className="flex items-start">
            <div className="w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold mr-4 mt-1">3</div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Confirm Your Pick</h3>
              <ul className="space-y-1 text-slate-700">
                <li>• Double-check your selection</li>
                <li>• Submit before the deadline</li>
                <li>• <strong>You CANNOT change picks once submitted</strong></li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Understanding the Rules */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">📋 Understanding the Rules</h2>

        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">⚽ Basic Rules</h3>
            <ul className="space-y-2 text-slate-700">
              <li>• <strong>One pick per round</strong> - Choose wisely</li>
              <li>• <strong>Win = Advance</strong> - Your team must win (not draw)</li>
              <li>• <strong>Deadline matters</strong> - Late picks aren't accepted</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">❤️ Lives System</h3>
            <div className="space-y-2 text-slate-700">
              <p>Your competition may have lives:</p>
              <ul className="space-y-1">
                <li>• <strong>0 lives:</strong> One wrong pick = eliminated</li>
                <li>• <strong>1+ lives:</strong> You can survive wrong picks</li>
              </ul>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">⏱️ Results</h3>
            <ul className="space-y-2 text-slate-700">
              <li>• Based on 90 minutes + stoppage time</li>
              <li>• Extra time/penalties don't count</li>
              <li>• Postponed matches may be void</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Tracking Your Progress */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">📊 Tracking Your Progress</h2>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">🎛️ Your Dashboard Shows</h3>
            <ul className="space-y-2 text-slate-700">
              <li>• Current round and your pick</li>
              <li>• Your remaining lives (if applicable)</li>
              <li>• Competition standings</li>
              <li>• Pick history</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">🔄 After Each Round</h3>
            <ul className="space-y-2 text-slate-700">
              <li>• Check if your team won</li>
              <li>• See if you're still active</li>
              <li>• View next round's fixtures</li>
              <li>• Plan your next pick</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Tips for Success */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">💡 Tips for Success</h2>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-green-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 text-green-800">✅ DO</h3>
            <ul className="space-y-2 text-slate-700">
              <li>✅ Check fixtures early each week</li>
              <li>✅ Make picks well before deadline</li>
              <li>✅ Track which teams you've used</li>
              <li>✅ Consider opponent strength</li>
              <li>✅ Save strong teams for difficult rounds</li>
            </ul>
          </div>

          <div className="bg-red-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 text-red-800">❌ DON'T</h3>
            <ul className="space-y-2 text-slate-700">
              <li>❌ Wait until the last minute</li>
              <li>❌ Use all strong teams early</li>
              <li>❌ Forget to make a pick</li>
              <li>❌ Pick teams playing away at difficult venues</li>
              <li>❌ Ignore team form and injuries</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Common Scenarios */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">🤔 Common Scenarios</h2>

        <div className="space-y-6">
          <div className="bg-slate-50 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 mb-2">❓ Missed the deadline?</h3>
            <p className="text-slate-700">Unfortunately, this counts as a loss. Set reminders for future rounds!</p>
          </div>

          <div className="bg-slate-50 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 mb-2">⏸️ Your team's match was postponed?</h3>
            <p className="text-slate-700">Usually void (no win/loss), but check with your organizer for specific rules.</p>
          </div>

          <div className="bg-slate-50 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 mb-2">💀 Down to your last life?</h3>
            <p className="text-slate-700">Play it safe - pick the strongest available team with the best odds of winning.</p>
          </div>

          <div className="bg-slate-50 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 mb-2">🏃‍♂️ Running out of teams?</h3>
            <p className="text-slate-700">Plan ahead - check future fixtures before making your current pick.</p>
          </div>
        </div>
      </div>

      {/* Need Help */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">❓ Need Help?</h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Link href="/help/guides/making-picks" className="block bg-slate-50 rounded-lg p-4 hover:bg-slate-100 transition-colors">
              <h3 className="font-semibold text-slate-900 mb-2">📝 Detailed Picking Guide</h3>
              <p className="text-slate-700 text-sm">Step-by-step guide to making winning picks</p>
            </Link>

            <Link href="/help/rules" className="block bg-slate-50 rounded-lg p-4 hover:bg-slate-100 transition-colors">
              <h3 className="font-semibold text-slate-900 mb-2">📋 Competition Rules</h3>
              <p className="text-slate-700 text-sm">Complete rules and scoring information</p>
            </Link>
          </div>

          <div className="space-y-4">
            <Link href="/help/faq" className="block bg-slate-50 rounded-lg p-4 hover:bg-slate-100 transition-colors">
              <h3 className="font-semibold text-slate-900 mb-2">❓ FAQ for Players</h3>
              <p className="text-slate-700 text-sm">Answers to frequently asked questions</p>
            </Link>

            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="font-semibold text-slate-900 mb-2">📞 Contact Organizer</h3>
              <p className="text-slate-700 text-sm">Reach out to your competition organizer for help</p>
            </div>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="bg-slate-900 text-white rounded-lg p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Ready to Start Playing?</h2>
        <p className="text-lg mb-4">
          Join a competition and put your football knowledge to the test!
        </p>
        <p className="text-slate-300">
          Good luck and may the best predictor win! ⚽
        </p>
      </div>
    </div>
  );
}