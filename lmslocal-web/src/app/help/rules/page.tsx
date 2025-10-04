export const metadata = {
  title: 'Competition Rules - LMSLocal Help',
  description: 'Complete rules for Last Man Standing competitions including elimination rules, lives system, team selection, and match results.',
  keywords: 'last man standing rules, competition rules, elimination rules, lives system, LMS rules',
  openGraph: {
    title: 'Competition Rules',
    description: 'Learn the complete rules for Last Man Standing competitions on LMSLocal.',
    type: 'article',
  }
};

export default function RulesPage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-slate-50 rounded-lg p-8 mb-8 border">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">
          Competition Rules
        </h1>
        <p className="text-lg text-slate-700">
          Complete rules and regulations for Last Man Standing competitions.
          Understanding these rules will help you play effectively and fairly.
        </p>
      </div>

      {/* Core Rules */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">⚽</span>
          Core Rules
        </h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">🎯 The Objective</h3>
            <p className="text-slate-700">Be the last player remaining in the competition by correctly predicting match winners each round.</p>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">📝 Making Picks</h3>
            <ul className="space-y-2 text-slate-700">
              <li>• One team selection per round</li>
              <li>• Picks cannot be changed once submitted</li>
              <li>• Deadline: 1 hour before first kick-off (unless specified otherwise)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Elimination Rules */}
      <div className="bg-white rounded-lg p-8 mb-8 border" id="elimination">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">💀</span>
          Elimination Rules
        </h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">❌ When You&apos;re Eliminated</h3>
            <p className="text-slate-700 mb-3">You are eliminated when:</p>
            <ul className="space-y-2 text-slate-700">
              <li>• Your picked team loses</li>
              <li>• Your picked team draws</li>
              <li>• You fail to make a pick before the deadline</li>
              <li>• You run out of lives (if lives system is active)</li>
            </ul>
          </div>

          <div id="lives-system">
            <h3 className="text-xl font-semibold text-slate-900 mb-3">❤️ Lives System</h3>
            <p className="text-slate-700 mb-4">Competitions can have 0-2 lives:</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <div className="text-2xl mb-2">💀</div>
                <h4 className="font-semibold text-slate-900 mb-2">0 Lives (Knockout)</h4>
                <p className="text-slate-700 text-sm">One wrong pick = immediate elimination</p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                <div className="text-2xl mb-2">❤️</div>
                <h4 className="font-semibold text-slate-900 mb-2">1 Life</h4>
                <p className="text-slate-700 text-sm">Survive one wrong pick, eliminated on the second</p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <div className="text-2xl mb-2">❤️❤️</div>
                <h4 className="font-semibold text-slate-900 mb-2">2 Lives</h4>
                <p className="text-slate-700 text-sm">Survive two wrong picks, eliminated on the third</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Team Selection Rules */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">🏈</span>
          Team Selection Rules
        </h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">🚫 No Team Twice Rule</h3>
            <p className="text-slate-700 mb-3">When enabled (most competitions):</p>
            <ul className="space-y-2 text-slate-700">
              <li>• You cannot select the same team in multiple rounds</li>
              <li>• Keeps a record of all your previous picks</li>
              <li>• Teams become available again only when all players have used all teams</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">📋 Available Teams</h3>
            <ul className="space-y-2 text-slate-700">
              <li>• Determined by your competition organizer</li>
              <li>• Usually Premier League, Championship, or custom selection</li>
              <li>• Only teams with fixtures that round are pickable</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Match Result Rules */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">📊</span>
          Match Result Rules
        </h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">✅ What Counts as a Win</h3>
            <ul className="space-y-2 text-slate-700">
              <li>• Victory in 90 minutes + stoppage time</li>
              <li>• Extra time and penalties do NOT count</li>
              <li>• If the match goes to extra time, it counts as a draw for LMS</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">⏸️ Postponed Matches</h3>
            <ul className="space-y-2 text-slate-700">
              <li>• Usually treated as void (no result)</li>
              <li>• Players who picked affected teams typically get a free pass</li>
              <li>• Organizer has final discretion</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">🛑 Abandoned Matches</h3>
            <ul className="space-y-2 text-slate-700">
              <li>• If abandoned before completion: Usually void</li>
              <li>• If abandoned after 90 minutes: Result stands</li>
              <li>• Organizer makes final decision</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Special Situations */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">⚠️</span>
          Special Situations
        </h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">🔄 Running Out of Teams</h3>
            <p className="text-slate-700 mb-3">When all players have used all available teams:</p>
            <ul className="space-y-2 text-slate-700">
              <li>• Team selections reset for everyone</li>
              <li>• All teams become available again</li>
              <li>• Previous pick history is maintained</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">🏆 Tied Winners</h3>
            <p className="text-slate-700 mb-3">If multiple players are eliminated in the final round:</p>
            <ul className="space-y-2 text-slate-700">
              <li>• All remaining players share victory</li>
              <li>• Prize money (if any) is typically split equally</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">⚙️ Organizer Powers</h3>
            <p className="text-slate-700 mb-3">Competition organizers can:</p>
            <ul className="space-y-2 text-slate-700">
              <li>• Override picks in exceptional circumstances</li>
              <li>• Adjust results for errors</li>
              <li>• Reset or end competitions</li>
              <li>• Remove players for rule violations</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Fair Play */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">⚖️</span>
          Fair Play
        </h2>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">✅ Expected Conduct</h3>
            <ul className="space-y-2 text-slate-700">
              <li>• Make your own picks</li>
              <li>• Don&apos;t share insider information</li>
              <li>• Respect deadlines</li>
              <li>• Accept organizer decisions</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">❌ Violations</h3>
            <p className="text-slate-700 mb-3">Organizers may remove players for:</p>
            <ul className="space-y-2 text-slate-700">
              <li>• Creating multiple accounts</li>
              <li>• Attempting to manipulate results</li>
              <li>• Harassment of other players</li>
              <li>• Repeated rule violations</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Important Note */}
      <div className="bg-slate-50 rounded-lg p-8 text-center border">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Important Reminder</h2>
        <p className="text-lg text-slate-700 mb-4">
          Rules are subject to your competition organizer&apos;s discretion.
        </p>
        <p className="text-slate-600">
          When in doubt, check with them! 📞
        </p>
      </div>
    </div>
  );
}