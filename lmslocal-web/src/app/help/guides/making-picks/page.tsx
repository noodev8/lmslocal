import Link from 'next/link';

export const metadata = {
  title: 'Making Winning Picks - LMSLocal Help',
  description: 'Master the art of making winning picks in Last Man Standing competitions. Strategy guides, tips, and common mistakes to avoid.',
  keywords: 'LMS picks, last man standing strategy, football predictions, winning tips, LMSLocal guide',
  openGraph: {
    title: 'Making Winning Picks',
    description: 'Learn proven strategies for making winning picks in Last Man Standing competitions.',
    type: 'article',
  }
};

export default function MakingPicksGuidePage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-slate-50 rounded-lg p-8 mb-8 border">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">
          Making Winning Picks
        </h1>
        <p className="text-lg text-slate-700">
          Master the strategy and psychology of Last Man Standing competitions with proven techniques and insider tips.
        </p>
      </div>

      {/* The Golden Rules */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">👑</span>
          The Golden Rules
        </h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-yellow-900 mb-4">⚠️ Critical Rule</h3>
            <p className="text-yellow-800 font-medium mb-2">You cannot change your pick once submitted!</p>
            <p className="text-yellow-700 text-sm">Always double-check before hitting submit. This is the #1 cause of regret in LMS.</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-blue-900 mb-4">🎯 Core Strategy</h3>
            <p className="text-blue-800 font-medium mb-2">Think beyond just this week</p>
            <p className="text-blue-700 text-sm">Your pick should consider future rounds, not just the immediate fixtures.</p>
          </div>
        </div>
      </div>

      {/* Strategic Framework */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">🧠</span>
          Strategic Framework
        </h2>

        <div className="space-y-8">
          <div>
            <h3 className="text-xl font-semibold text-slate-900 mb-4">The Three-Tier Approach</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="text-center mb-4">
                  <div className="text-2xl mb-2">🛡️</div>
                  <h4 className="font-semibold text-green-900">Safe Picks</h4>
                </div>
                <div className="text-green-800 text-sm space-y-2">
                  <p><strong>When:</strong> You have limited lives left</p>
                  <p><strong>Teams:</strong> City, Arsenal, Liverpool at home vs bottom teams</p>
                  <p><strong>Risk:</strong> Low, but uses premium teams</p>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <div className="text-center mb-4">
                  <div className="text-2xl mb-2">⚖️</div>
                  <h4 className="font-semibold text-yellow-900">Balanced Picks</h4>
                </div>
                <div className="text-yellow-800 text-sm space-y-2">
                  <p><strong>When:</strong> Early-mid competition</p>
                  <p><strong>Teams:</strong> Mid-table teams with good home form</p>
                  <p><strong>Risk:</strong> Moderate, saves top teams</p>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <div className="text-center mb-4">
                  <div className="text-2xl mb-2">🎲</div>
                  <h4 className="font-semibold text-red-900">Risky Picks</h4>
                </div>
                <div className="text-red-800 text-sm space-y-2">
                  <p><strong>When:</strong> Many lives remaining</p>
                  <p><strong>Teams:</strong> Form teams vs struggling opponents</p>
                  <p><strong>Risk:</strong> High, but preserves elite teams</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-slate-900 mb-4">The Team Management Matrix</h3>
            <div className="bg-slate-50 rounded-lg p-6">
              <div className="grid grid-cols-4 gap-4 text-center text-sm">
                <div className="font-semibold text-slate-900">Team Tier</div>
                <div className="font-semibold text-slate-900">Early Rounds</div>
                <div className="font-semibold text-slate-900">Mid Rounds</div>
                <div className="font-semibold text-slate-900">Late Rounds</div>

                <div className="bg-green-100 p-2 rounded font-medium">Elite (City, Arsenal)</div>
                <div className="bg-red-100 p-2 rounded text-red-800">Avoid</div>
                <div className="bg-yellow-100 p-2 rounded text-yellow-800">Consider</div>
                <div className="bg-green-100 p-2 rounded text-green-800">Use</div>

                <div className="bg-blue-100 p-2 rounded font-medium">Strong (Newcastle, Spurs)</div>
                <div className="bg-yellow-100 p-2 rounded text-yellow-800">Sparingly</div>
                <div className="bg-green-100 p-2 rounded text-green-800">Good choice</div>
                <div className="bg-green-100 p-2 rounded text-green-800">Use</div>

                <div className="bg-purple-100 p-2 rounded font-medium">Mid (Brighton, Villa)</div>
                <div className="bg-green-100 p-2 rounded text-green-800">Perfect</div>
                <div className="bg-green-100 p-2 rounded text-green-800">Good choice</div>
                <div className="bg-yellow-100 p-2 rounded text-yellow-800">If needed</div>

                <div className="bg-orange-100 p-2 rounded font-medium">Weak (Bottom 6)</div>
                <div className="bg-red-100 p-2 rounded text-red-800">Never</div>
                <div className="bg-red-100 p-2 rounded text-red-800">Rarely</div>
                <div className="bg-yellow-100 p-2 rounded text-yellow-800">Desperation</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Research Methods */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">🔍</span>
          Research Methods
        </h2>

        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">📊 The 5-Factor Analysis</h3>
            <p className="text-blue-800 text-sm">For each potential pick, evaluate these five key factors before deciding.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 mb-2">1. 📈 Recent Form</h4>
                <ul className="text-slate-700 text-sm space-y-1">
                  <li>• Last 5 games record</li>
                  <li>• Goals scored vs conceded</li>
                  <li>• Home vs away form</li>
                  <li>• Trend direction (improving/declining)</li>
                </ul>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 mb-2">2. 🏥 Team News</h4>
                <ul className="text-slate-700 text-sm space-y-1">
                  <li>• Key player injuries</li>
                  <li>• Suspensions</li>
                  <li>• Rotation risk (Cup games, European fixtures)</li>
                  <li>• Manager comments</li>
                </ul>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 mb-2">3. 🆚 Head-to-Head</h4>
                <ul className="text-slate-700 text-sm space-y-1">
                  <li>• Historical record</li>
                  <li>• Recent meetings</li>
                  <li>• Stylistic matchups</li>
                  <li>• Psychological factors</li>
                </ul>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 mb-2">4. 🏟️ Context Factors</h4>
                <ul className="text-slate-700 text-sm space-y-1">
                  <li>• Home advantage strength</li>
                  <li>• Weather conditions</li>
                  <li>• Kick-off time impact</li>
                  <li>• Crowd/atmosphere</li>
                </ul>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 mb-2">5. 🎯 Motivation Levels</h4>
                <ul className="text-slate-700 text-sm space-y-1">
                  <li>• League position implications</li>
                  <li>• European qualification</li>
                  <li>• Relegation battle</li>
                  <li>• Derby/rivalry significance</li>
                </ul>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 mb-2">📱 Research Tools</h4>
                <ul className="text-slate-700 text-sm space-y-1">
                  <li>• BBC Sport team news</li>
                  <li>• Sky Sports predictions</li>
                  <li>• Football Twitter/X insights</li>
                  <li>• Betting odds comparison</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Psychology & Mindset */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">🧘</span>
          Psychology & Mindset
        </h2>

        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-green-900 mb-4">✅ Winning Mindset</h3>
              <ul className="space-y-2 text-green-800 text-sm">
                <li>✅ Accept that some losses are just bad luck</li>
                <li>✅ Focus on process, not just outcomes</li>
                <li>✅ Stay disciplined with your strategy</li>
                <li>✅ Learn from each round</li>
                <li>✅ Don&apos;t let emotions drive decisions</li>
                <li>✅ Remember it&apos;s meant to be fun!</li>
              </ul>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-red-900 mb-4">❌ Mental Traps</h3>
              <ul className="space-y-2 text-red-800 text-sm">
                <li>❌ Chasing losses with risky picks</li>
                <li>❌ Copying other players&apos; picks</li>
                <li>❌ Overthinking obvious choices</li>
                <li>❌ Being swayed by last-minute news</li>
                <li>❌ Letting pride influence team selection</li>
                <li>❌ Panic picking when time is running out</li>
              </ul>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="font-semibold text-yellow-900 mb-3">🎯 The &quot;Goldilocks Principle&quot;</h3>
            <div className="text-yellow-800 text-sm space-y-2">
              <p>Your pick should be <strong>not too safe, not too risky, but just right</strong> for your situation.</p>
              <div className="grid md:grid-cols-3 gap-4 mt-4">
                <div>
                  <p className="font-medium">Too Safe:</p>
                  <p>Using Man City vs Sheffield Wednesday when you have 3 lives</p>
                </div>
                <div>
                  <p className="font-medium">Too Risky:</p>
                  <p>Using Luton vs Man City when you have 0 lives</p>
                </div>
                <div>
                  <p className="font-medium">Just Right:</p>
                  <p>Using Newcastle at home vs mid-table team when you have 1 life</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Common Scenarios */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">🎭</span>
          Common Scenarios & Solutions
        </h2>

        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 mb-2">😰 &quot;I&apos;m down to my last life&quot;</h4>
                <div className="text-slate-700 text-sm space-y-1">
                  <p><strong>Strategy:</strong> Play it safe, use your best remaining team</p>
                  <p><strong>Mindset:</strong> Accept the risk, you&apos;re in survival mode</p>
                  <p><strong>Avoid:</strong> Trying to be clever or differentiate</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 mb-2">😵 &quot;I&apos;ve used all the good teams&quot;</h4>
                <div className="text-slate-700 text-sm space-y-1">
                  <p><strong>Strategy:</strong> Focus on favorable matchups over team quality</p>
                  <p><strong>Research:</strong> Look for home teams vs poor away travelers</p>
                  <p><strong>Example:</strong> Brighton at home vs Burnley away</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 mb-2">⏰ &quot;The deadline is in 10 minutes&quot;</h4>
                <div className="text-slate-700 text-sm space-y-1">
                  <p><strong>Don&apos;t panic:</strong> Go with your gut instinct</p>
                  <p><strong>Quick check:</strong> Team news for obvious issues</p>
                  <p><strong>Default:</strong> Home team with best recent form</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 mb-2">🤔 &quot;Everyone else picked the same team&quot;</h4>
                <div className="text-slate-700 text-sm space-y-1">
                  <p><strong>If it&apos;s obvious:</strong> Stick with the crowd</p>
                  <p><strong>If you disagree:</strong> Trust your research</p>
                  <p><strong>Remember:</strong> Being different doesn&apos;t mean being smart</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 mb-2">📰 &quot;Big news just broke&quot;</h4>
                <div className="text-slate-700 text-sm space-y-1">
                  <p><strong>Key player injured:</strong> Consider switching</p>
                  <p><strong>Manager comments:</strong> Usually not significant</p>
                  <p><strong>Weather/pitch:</strong> Rarely changes outcomes</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 mb-2">🏆 &quot;It&apos;s the final few players&quot;</h4>
                <div className="text-slate-700 text-sm space-y-1">
                  <p><strong>Strategy:</strong> Take calculated risks to differentiate</p>
                  <p><strong>Psychology:</strong> Others may play it safe</p>
                  <p><strong>Remember:</strong> You need to be different to win</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Strategies */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">🎓</span>
          Advanced Strategies
        </h2>

        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">🎯 The Contrarian Approach</h3>
              <div className="text-blue-800 text-sm space-y-2">
                <p><strong>When to use:</strong> Early rounds with many lives</p>
                <p><strong>Strategy:</strong> Avoid obvious picks if you have good reasoning</p>
                <p><strong>Example:</strong> Everyone picks City, you pick Arsenal with better fixtures</p>
                <p><strong>Risk:</strong> You could look silly, but also gain advantage</p>
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-purple-900 mb-4">📅 The Fixture Planning Method</h3>
              <div className="text-purple-800 text-sm space-y-2">
                <p><strong>Strategy:</strong> Plan 3-4 weeks ahead</p>
                <p><strong>Method:</strong> Map out when you&apos;ll use each top team</p>
                <p><strong>Benefit:</strong> Ensures you don&apos;t waste premium teams</p>
                <p><strong>Flexibility:</strong> Adjust plan as situations change</p>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-green-900 mb-4">📊 The Statistical Edge</h3>
              <div className="text-green-800 text-sm space-y-2">
                <p><strong>Home form:</strong> Some teams are much stronger at home</p>
                <p><strong>Away form:</strong> Some teams travel very poorly</p>
                <p><strong>Recent trends:</strong> 6-game form &gt; season-long form</p>
                <p><strong>Head-to-head:</strong> Some matchups have clear patterns</p>
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-orange-900 mb-4">⚡ The Lightning Round Strategy</h3>
              <div className="text-orange-800 text-sm space-y-2">
                <p><strong>When:</strong> Multiple games in short periods</p>
                <p><strong>Strategy:</strong> Use weaker teams early, save strength for later</p>
                <p><strong>Reasoning:</strong> Rotation and fatigue affect stronger teams more</p>
                <p><strong>Example:</strong> Christmas period fixture congestion</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Common Mistakes */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">⚠️</span>
          Common Mistakes to Avoid
        </h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">🚫 Strategic Errors</h3>
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <h4 className="font-medium text-red-900 text-sm mb-1">Using Top Teams Too Early</h4>
                <p className="text-red-800 text-xs">Saving City/Arsenal for tough weeks, not easy wins</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <h4 className="font-medium text-red-900 text-sm mb-1">Ignoring Fixture Difficulty</h4>
                <p className="text-red-800 text-xs">Not considering opponent strength and venue</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <h4 className="font-medium text-red-900 text-sm mb-1">Following the Crowd Blindly</h4>
                <p className="text-red-800 text-xs">Not thinking independently about picks</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">🕐 Timing Errors</h3>
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <h4 className="font-medium text-red-900 text-sm mb-1">Last-Minute Panic Changes</h4>
                <p className="text-red-800 text-xs">Switching picks based on late unimportant news</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <h4 className="font-medium text-red-900 text-sm mb-1">Not Researching Early</h4>
                <p className="text-red-800 text-xs">Waiting until deadline day to start thinking</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <h4 className="font-medium text-red-900 text-sm mb-1">Missing Deadlines</h4>
                <p className="text-red-800 text-xs">The ultimate mistake - always set reminders!</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Decision Framework */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">⚡</span>
          Quick Decision Framework
        </h2>

        <div className="bg-slate-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">When You&apos;re Stuck Between Two Teams</h3>
          <div className="space-y-3">
            <div className="flex items-center">
              <div className="w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3">1</div>
              <p className="text-slate-700">Which team do I need more for future rounds?</p>
            </div>
            <div className="flex items-center">
              <div className="w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3">2</div>
              <p className="text-slate-700">Which has the better recent form?</p>
            </div>
            <div className="flex items-center">
              <div className="w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3">3</div>
              <p className="text-slate-700">Which is playing at home?</p>
            </div>
            <div className="flex items-center">
              <div className="w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3">4</div>
              <p className="text-slate-700">Which has fewer injury concerns?</p>
            </div>
            <div className="flex items-center">
              <div className="w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3">5</div>
              <p className="text-slate-700">What does your gut tell you?</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-blue-800 text-sm font-medium">If still tied: Go with the team playing at home or the one you&apos;ll need less in future rounds.</p>
          </div>
        </div>
      </div>

      {/* Success Stories */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">🏆</span>
          Learning From Success Stories
        </h2>

        <div className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="font-semibold text-green-900 mb-3">💡 &quot;The Patient Winner&quot;</h3>
            <div className="text-green-800 text-sm space-y-2">
              <p><strong>Strategy:</strong> Never used a top-6 team until week 15 of a 20-week competition</p>
              <p><strong>Method:</strong> Found value in mid-table home teams with good form</p>
              <p><strong>Result:</strong> Won with Manchester City in the final after others had exhausted premium options</p>
              <p><strong>Lesson:</strong> Patience and planning beats reactive decision-making</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-blue-900 mb-3">💡 &quot;The Form Reader&quot;</h3>
            <div className="text-blue-800 text-sm space-y-2">
              <p><strong>Strategy:</strong> Focused entirely on last 5 games form, ignored team reputation</p>
              <p><strong>Method:</strong> Picked newly-promoted teams on winning streaks over underperforming big teams</p>
              <p><strong>Result:</strong> Survived longer than players who relied on &quot;name&quot; teams</p>
              <p><strong>Lesson:</strong> Current form trumps historical reputation</p>
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
            <h3 className="font-semibold text-purple-900 mb-3">💡 &quot;The Contrarian&quot;</h3>
            <div className="text-purple-800 text-sm space-y-2">
              <p><strong>Strategy:</strong> Deliberately avoided picks when 70%+ of players chose the same team</p>
              <p><strong>Method:</strong> Found alternative teams with nearly as good chances but better future value</p>
              <p><strong>Result:</strong> Eliminated many rounds later than the crowd</p>
              <p><strong>Lesson:</strong> Sometimes being different is worth the extra risk</p>
            </div>
          </div>
        </div>
      </div>

      {/* Final Tips */}
      <div className="bg-slate-50 rounded-lg p-8 text-center border">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Remember: It&apos;s About the Journey</h2>
        <div className="max-w-2xl mx-auto space-y-4 text-slate-700">
          <p>
            Last Man Standing is as much about enjoying the process as winning. The best players combine solid research
            with good instincts and a bit of luck.
          </p>
          <p className="font-medium">
            Study the game, trust your process, and remember that even the best picks sometimes lose.
            That&apos;s what makes it exciting!
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-6">
          <Link
            href="/help/rules"
            className="px-6 py-3 bg-white text-slate-800 border rounded-lg hover:bg-slate-100 transition-colors"
          >
            Review Competition Rules
          </Link>
          <Link
            href="/help/how-to-play"
            className="px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            How to Play Guide
          </Link>
        </div>
      </div>
    </div>
  );
}