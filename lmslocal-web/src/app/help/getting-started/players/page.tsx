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
          Ready to test your football knowledge? Here&apos;s how to join and play Last Man Standing competitions.
        </p>
        <div className="bg-white border rounded-lg p-4">
          <p className="font-semibold">⚽ Join a competition and start making winning predictions!</p>
        </div>
      </div>

      {/* Joining a Competition */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">🎯 Joining a Competition</h2>

        <div className="bg-slate-50 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <span className="text-2xl mr-3">🔑</span>
            <h3 className="text-xl font-semibold text-slate-900">Using Your Invite Code</h3>
          </div>
          <div className="space-y-2 text-slate-700">
            <p>1. Get the invite code from your organiser</p>
            <p>2. Go to <Link href="/join" className="text-blue-600 hover:underline">Join Competition</Link></p>
            <p>3. Enter the code</p>
          </div>
        </div>
      </div>

      {/* Making Your First Pick */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">🎲 Making Your Pick</h2>

        <div className="bg-slate-50 rounded-lg p-6">
          <p className="text-slate-700 text-lg">
            Press <strong>PLAY</strong> and choose your team
          </p>
        </div>
      </div>

      {/* Understanding the Rules */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">📋 Understanding the Rules</h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">⚽ Basic Rules</h3>
            <ul className="space-y-2 text-slate-700">
              <li>• <strong>One pick per round</strong> - Choose wisely</li>
              <li>• <strong>Win = Advance</strong> - Your team must win (not draw)</li>
              <li>• <strong>Deadline matters</strong> - Late picks are penalised</li>
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
        </div>
      </div>

      {/* Tracking Your Progress */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">📊 Tracking Your Progress</h2>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">🎛️ Your Dashboard Shows</h3>
            <ul className="space-y-2 text-slate-700">
              <li>• Current round number</li>
              <li>• Your status (In/Out)</li>
              <li>• Lives remaining</li>
              <li>• Round results (Won/Lost)</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">📋 Standings Page</h3>
            <ul className="space-y-2 text-slate-700">
              <li>• See who has most lives</li>
              <li>• View latest picks</li>
              <li>• See who is eliminated</li>
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
              <li>✅ Consider opponent strength</li>
              <li>✅ Save strong teams for difficult rounds</li>
            </ul>
          </div>

          <div className="bg-red-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 text-red-800">❌ DON&apos;T</h3>
            <ul className="space-y-2 text-slate-700">
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
            <h3 className="font-semibold text-slate-900 mb-2">⏸️ Your team&apos;s match was postponed?</h3>
            <p className="text-slate-700">Usually void (no win/loss), but check with your organiser for specific rules.</p>
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