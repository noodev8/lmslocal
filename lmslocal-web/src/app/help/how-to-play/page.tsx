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
            <strong>Simple concept:</strong> Pick one team to WIN each round. If your team WINS, you advance.
            If they LOSE or DRAW, you&apos;re eliminated.
          </p>

          <div className="bg-white border border-slate-200 rounded p-4">
            <p className="font-semibold">🚫 Key Rule: You cannot pick the same team twice throughout the competition.</p>
            <p className="text-sm mt-2 text-slate-600">Note: Available teams get reset once all teams have been used.</p>
          </div>

          <p>
            <strong>LMS Local twist:</strong> Organisers can customize rules with multiple lives.
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
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-slate-900 mb-4">❌ How to Lose a Life</h3>
            <ul className="space-y-2 text-slate-700">
              <li>• Your team <strong>LOSES</strong> their match</li>
              <li>• Your team <strong>DRAWS</strong> their match</li>
              <li>• You miss the pick deadline</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Lives System */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Lives System</h2>
        <p className="text-slate-700 mb-6">Your organiser sets how many lives each player gets at the start:</p>

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
            <p className="text-sm text-slate-600">Maximum forgiveness</p>
          </div>
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

        <p className="text-slate-700 mb-6">Be the <strong>last player standing</strong>!</p>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-slate-50 rounded-lg p-4 text-center">
            <h3 className="font-semibold text-slate-900 mb-2">Winner</h3>
            <p className="text-slate-600 text-sm">Only one player remains</p>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 text-center">
            <h3 className="font-semibold text-slate-900 mb-2">Draw - No winner</h3>
            <p className="text-slate-600 text-sm">Multiple players eliminated in same round</p>
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
            <p className="text-slate-600 text-sm">Get an access code from your organiser</p>
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
        <h2 className="text-2xl font-bold mb-4">Important to Remember</h2>
        <p className="text-lg mb-4">
          You can change your pick at any time <strong className="text-white">until lock time</strong>. Choose wisely!
        </p>
        <p className="text-slate-300">
          Good luck, and may the best strategist win! 🏆
        </p>
      </div>
    </div>
  );
}