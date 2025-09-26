export const metadata = {
  title: 'How to Play Last Man Standing - LMSLocal Help',
  description: 'Learn how to play Last Man Standing competitions. Pick one team each week to win - if they lose or draw, you\'re out. Simple rules, exciting competition.',
  keywords: 'last man standing, how to play, football competition, premier league, elimination game',
  openGraph: {
    title: 'How to Play Last Man Standing',
    description: 'Pick one team each week to win. If they lose or draw, you\'re out. Learn the complete rules.',
    type: 'article',
  }
};

export default function HowToPlayPage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero Section */}
      <div className="bg-slate-50 rounded-lg p-8 mb-8 border">
        <h1 className="text-4xl font-bold text-slate-900 mb-6">
          How to Play Last Man Standing
        </h1>

        <div className="text-lg text-slate-700 mb-6 space-y-4">
          <p>
            <strong>Simple concept:</strong> Pick one Premier League team to WIN each week. If your team WINS, you advance.
            If they LOSE or DRAW, you&apos;re eliminated.
          </p>

          <div className="bg-white border border-slate-200 rounded p-4">
            <p className="font-semibold">🚫 Key Rule: You cannot pick the same team twice throughout the competition.</p>
          </div>

          <p>
            <strong>LMSLocal twist:</strong> Organizers can customize rules with multiple lives and flexible team selection options.
          </p>
        </div>
      </div>

      {/* Core Rules */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Core Rules</h2>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-xl font-semibold text-slate-900 mb-4">✅ How to Win</h3>
            <ul className="space-y-2 text-slate-700">
              <li>• Your selected team must <strong>WIN</strong> their match</li>
              <li>• Results based on 90 minutes + stoppage time only</li>
              <li>• Extra time and penalties don&apos;t count</li>
              <li>• You advance to the next round</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-slate-900 mb-4">❌ How to Lose a Life</h3>
            <ul className="space-y-2 text-slate-700">
              <li>• Your team <strong>LOSES</strong> their match</li>
              <li>• Your team <strong>DRAWS</strong> their match</li>
              <li>• You miss the pick deadline</li>
              <li>• You forget to make a pick</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Lives System */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Lives System</h2>
        <p className="text-slate-700 mb-6">Your organizer sets how many lives each player gets at the start:</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-50 border rounded-lg p-6 text-center">
            <div className="text-2xl mb-2">💀</div>
            <h3 className="font-semibold text-slate-900 mb-2">0 Lives</h3>
            <p className="text-sm text-slate-600">Knockout format</p>
          </div>

          <div className="bg-slate-50 border rounded-lg p-6 text-center">
            <div className="text-2xl mb-2">❤️</div>
            <h3 className="font-semibold text-slate-900 mb-2">1 Life</h3>
            <p className="text-sm text-slate-600">One second chance</p>
          </div>

          <div className="bg-slate-50 border rounded-lg p-6 text-center">
            <div className="text-2xl mb-2">❤️❤️</div>
            <h3 className="font-semibold text-slate-900 mb-2">2 Lives</h3>
            <p className="text-sm text-slate-600">Two second chances</p>
          </div>

          <div className="bg-slate-50 border rounded-lg p-6 text-center">
            <div className="text-2xl mb-2">❤️❤️❤️</div>
            <h3 className="font-semibold text-slate-900 mb-2">3 Lives</h3>
            <p className="text-sm text-slate-600">Maximum forgiveness</p>
          </div>
        </div>
      </div>

      {/* Team Selection Rules */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Team Selection Rules</h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">1. No Team Twice Rule</h3>
            <p className="text-slate-700">Once you pick a team, you cannot pick them again for the entire competition. This makes each round progressively more challenging.</p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">2. Organizer Flexibility</h3>
            <p className="text-slate-700">Your organizer can choose to disable this rule, allowing more strategic flexibility.</p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">3. Team Reset</h3>
            <p className="text-slate-700">If all players run out of available teams, restrictions reset and you can pick any team again.</p>
          </div>
        </div>
      </div>

      {/* Pick Deadlines */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">⏰ Pick Deadlines</h2>

        <div className="bg-slate-50 border rounded-lg p-4 mb-4">
          <p className="font-semibold">Default: 1 hour before the first match kicks off</p>
        </div>

        <div className="space-y-3 text-slate-700">
          <p><strong>Important:</strong> Once the deadline passes, you cannot change your pick.</p>
          <p>Missing the deadline counts as a loss and you&apos;ll lose a life.</p>
          <p>Your organizer can set earlier deadlines if they prefer.</p>
        </div>
      </div>

      {/* Strategy Tips */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">💡 Strategy Tips</h2>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Smart Team Management</h3>
            <ul className="space-y-2 text-slate-700">
              <li>• Don&apos;t use Manchester City or Arsenal in easy early rounds</li>
              <li>• Save the strongest teams for difficult fixtures later</li>
              <li>• Look ahead at upcoming fixtures before picking</li>
              <li>• Consider which teams others might avoid</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Tactical Considerations</h3>
            <ul className="space-y-2 text-slate-700">
              <li>• Home advantage matters - check venue</li>
              <li>• Consider recent team form and injuries</li>
              <li>• Derby matches can be unpredictable</li>
              <li>• Track what teams other players have used</li>
            </ul>
          </div>
        </div>
      </div>

      {/* How to Win */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">🏆 How to Win the Competition</h2>

        <p className="text-slate-700 mb-6">Be the <strong>last player standing</strong>! The competition continues until:</p>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-slate-50 rounded-lg p-4 text-center">
            <h3 className="font-semibold text-slate-900 mb-2">Solo Winner</h3>
            <p className="text-slate-600 text-sm">Only one player remains</p>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 text-center">
            <h3 className="font-semibold text-slate-900 mb-2">Joint Winners</h3>
            <p className="text-slate-600 text-sm">Multiple players eliminated in same round</p>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 text-center">
            <h3 className="font-semibold text-slate-900 mb-2">Organizer Decision</h3>
            <p className="text-slate-600 text-sm">Competition ended by organizer</p>
          </div>
        </div>
      </div>

      {/* Getting Started */}
      <div className="bg-slate-50 rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">🚀 Ready to Play?</h2>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg p-6 text-center border">
            <div className="w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold mx-auto mb-4">1</div>
            <h3 className="font-semibold text-slate-900 mb-2">Join a Competition</h3>
            <p className="text-slate-600 text-sm">Get an access code from your organizer</p>
          </div>

          <div className="bg-white rounded-lg p-6 text-center border">
            <div className="w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold mx-auto mb-4">2</div>
            <h3 className="font-semibold text-slate-900 mb-2">Make Your Pick</h3>
            <p className="text-slate-600 text-sm">Choose your team before the deadline</p>
          </div>

          <div className="bg-white rounded-lg p-6 text-center border">
            <div className="w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold mx-auto mb-4">3</div>
            <h3 className="font-semibold text-slate-900 mb-2">Track Results</h3>
            <p className="text-slate-600 text-sm">See if you advance to the next round</p>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="bg-slate-900 text-white rounded-lg p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Remember the Golden Rule</h2>
        <p className="text-lg mb-4">
          Once you make a pick, you <strong>cannot change it</strong>. Choose wisely!
        </p>
        <p className="text-slate-300">
          Good luck, and may the best strategist win! 🏆
        </p>
      </div>
    </div>
  );
}