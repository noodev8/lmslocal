import Link from 'next/link';

export const metadata = {
  title: 'Creating Your First Competition - LMSLocal Help',
  description: 'Complete step-by-step guide to setting up your first Last Man Standing competition. From basic setup to inviting players and managing rounds.',
  keywords: 'create LMS competition, setup last man standing, competition organizer guide, LMSLocal tutorial',
  openGraph: {
    title: 'Creating Your First Competition',
    description: 'Learn how to set up and manage Last Man Standing competitions from start to finish.',
    type: 'article',
  }
};

export default function CreatingCompetitionGuidePage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-slate-50 rounded-lg p-8 mb-8 border">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">
          Creating Your First Competition
        </h1>
        <p className="text-lg text-slate-700">
          Complete step-by-step guide to setting up and running a successful Last Man Standing competition.
        </p>
      </div>

      {/* Quick Overview */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">⚡</span>
          Quick Overview
        </h2>
        <div className="grid md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-slate-50 rounded-lg">
            <div className="text-2xl mb-2">⏱️</div>
            <h3 className="font-semibold text-slate-900 mb-1">Setup Time</h3>
            <p className="text-slate-600 text-sm">5-10 minutes</p>
          </div>
          <div className="text-center p-4 bg-slate-50 rounded-lg">
            <div className="text-2xl mb-2">👥</div>
            <h3 className="font-semibold text-slate-900 mb-1">Players</h3>
            <p className="text-slate-600 text-sm">2 to unlimited</p>
          </div>
          <div className="text-center p-4 bg-slate-50 rounded-lg">
            <div className="text-2xl mb-2">⚽</div>
            <h3 className="font-semibold text-slate-900 mb-1">Teams</h3>
            <p className="text-slate-600 text-sm">Premier League or custom</p>
          </div>
          <div className="text-center p-4 bg-slate-50 rounded-lg">
            <div className="text-2xl mb-2">📅</div>
            <h3 className="font-semibold text-slate-900 mb-1">Duration</h3>
            <p className="text-slate-600 text-sm">Season long or custom</p>
          </div>
        </div>
      </div>

      {/* Step-by-Step Guide */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">📝</span>
          Step-by-Step Setup
        </h2>

        <div className="space-y-8">
          {/* Step 1 */}
          <div className="flex">
            <div className="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold mr-4 mt-1 shrink-0">1</div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-slate-900 mb-3">Create Your Account</h3>
              <div className="space-y-3 text-slate-700">
                <p>First, you&apos;ll need an organizer account:</p>
                <ul className="space-y-2 ml-4">
                  <li>• Go to the <Link href="/register" className="text-blue-600 hover:underline">registration page</Link></li>
                  <li>• Enter your email address and create a secure password</li>
                  <li>• Verify your email address when prompted</li>
                  <li>• You&apos;re now ready to create competitions!</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex">
            <div className="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold mr-4 mt-1 shrink-0">2</div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-slate-900 mb-3">Set Competition Details</h3>
              <div className="space-y-4">
                <p className="text-slate-700">Configure your competition&apos;s basic information:</p>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h4 className="font-semibold text-slate-900 mb-2">Essential Details</h4>
                    <div className="text-slate-700 text-sm space-y-1">
                      <p><strong>Name:</strong> Make it memorable (e.g., &quot;The Crown LMS 2024&quot;)</p>
                      <p><strong>Description:</strong> Brief explanation for players</p>
                      <p><strong>Start Date:</strong> When the first round begins</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-4">
                    <h4 className="font-semibold text-slate-900 mb-2">Access Settings</h4>
                    <div className="text-slate-700 text-sm space-y-1">
                      <p><strong>Privacy:</strong> Public or invite-only</p>
                      <p><strong>Custom URL:</strong> Easy-to-share link (optional)</p>
                      <p><strong>Entry Fee:</strong> If charging players (optional)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex">
            <div className="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold mr-4 mt-1 shrink-0">3</div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-slate-900 mb-3">Configure Game Rules</h3>
              <div className="space-y-4">
                <p className="text-slate-700">Set the rules that will determine how your competition works:</p>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-800 font-medium">⚠️ Important: Some rules cannot be changed after the first round starts!</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-2">Lives System</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-slate-50 rounded p-3 text-center">
                        <div className="text-lg mb-1">💀</div>
                        <div className="font-medium text-slate-900 text-sm">0 Lives</div>
                        <div className="text-slate-600 text-xs">Knockout</div>
                      </div>
                      <div className="bg-slate-50 rounded p-3 text-center">
                        <div className="text-lg mb-1">❤️</div>
                        <div className="font-medium text-slate-900 text-sm">1 Life</div>
                        <div className="text-slate-600 text-xs">One mistake</div>
                      </div>
                      <div className="bg-slate-50 rounded p-3 text-center">
                        <div className="text-lg mb-1">❤️❤️</div>
                        <div className="font-medium text-slate-900 text-sm">2 Lives</div>
                        <div className="text-slate-600 text-xs">More forgiving</div>
                      </div>
                      <div className="bg-slate-50 rounded p-3 text-center">
                        <div className="text-lg mb-1">❤️❤️❤️</div>
                        <div className="font-medium text-slate-900 text-sm">3 Lives</div>
                        <div className="text-slate-600 text-xs">Very forgiving</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-900 mb-2">Team Selection Rules</h4>
                    <div className="space-y-2 text-slate-700">
                      <div className="flex items-center">
                        <input type="checkbox" className="mr-2" checked readOnly />
                        <span><strong>No Team Twice:</strong> Players cannot reuse teams (recommended)</span>
                      </div>
                      <div className="flex items-center">
                        <input type="checkbox" className="mr-2" />
                        <span><strong>Hide Other Picks:</strong> Keep picks secret until deadline</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex">
            <div className="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold mr-4 mt-1 shrink-0">4</div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-slate-900 mb-3">Choose Available Teams</h3>
              <div className="space-y-4">
                <p className="text-slate-700">Select which teams players can choose from:</p>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <div className="text-2xl mb-2">🏆</div>
                    <h4 className="font-semibold text-slate-900 mb-2">Premier League</h4>
                    <p className="text-slate-700 text-sm">All 20 Premier League teams</p>
                    <p className="text-slate-600 text-xs mt-1">Most popular choice</p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <div className="text-2xl mb-2">⚽</div>
                    <h4 className="font-semibold text-slate-900 mb-2">Championship</h4>
                    <p className="text-slate-700 text-sm">All 24 Championship teams</p>
                    <p className="text-slate-600 text-xs mt-1">More unpredictable</p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <div className="text-2xl mb-2">🎯</div>
                    <h4 className="font-semibold text-slate-900 mb-2">Custom Selection</h4>
                    <p className="text-slate-700 text-sm">Pick specific teams</p>
                    <p className="text-slate-600 text-xs mt-1">Ultimate control</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Inviting Players */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">👥</span>
          Inviting Players
        </h2>

        <div className="space-y-6">
          <p className="text-slate-700">Once your competition is created, you&apos;ll get two ways to invite players:</p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-slate-50 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <span className="text-2xl mr-3">🔑</span>
                <h3 className="text-xl font-semibold text-slate-900">Invite Code</h3>
              </div>
              <div className="space-y-3 text-slate-700">
                <p>A unique 6-character code like <code className="bg-slate-200 px-2 py-1 rounded">ABC123</code></p>
                <p>Players enter this code at the join page</p>
                <p>Perfect for verbal sharing or quick messages</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <span className="text-2xl mr-3">🔗</span>
                <h3 className="text-xl font-semibold text-slate-900">Direct Link</h3>
              </div>
              <div className="space-y-3 text-slate-700">
                <p>A full URL link to your competition</p>
                <p>One-click joining for players</p>
                <p>Great for WhatsApp, email, or social media</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">💡 Pro Tips for Player Recruitment</h4>
            <ul className="space-y-1 text-blue-800 text-sm">
              <li>• Share the link in your WhatsApp group for instant joining</li>
              <li>• Post on social media with the competition description</li>
              <li>• Email the link to your mailing list</li>
              <li>• Print QR codes (coming soon) for physical locations</li>
            </ul>
          </div>
        </div>
      </div>

      {/* First Round Setup */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">🏁</span>
          Setting Up Your First Round
        </h2>

        <div className="space-y-6">
          <p className="text-slate-700">Before players can make picks, you need to add fixtures:</p>

          <div className="bg-slate-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Adding Fixtures</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-slate-900 mb-2">Manual Entry</h4>
                <ul className="space-y-1 text-slate-700 text-sm">
                  <li>• Go to &quot;Manage Rounds&quot; in your dashboard</li>
                  <li>• Click &quot;Add Round&quot; for the gameweek</li>
                  <li>• Enter match details and kick-off times</li>
                  <li>• Set the pick deadline (default: 1hr before first match)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-slate-900 mb-2">Auto Import (Pro Feature)</h4>
                <ul className="space-y-1 text-slate-700 text-sm">
                  <li>• Automatically pulls fixtures from Premier League</li>
                  <li>• Select which gameweeks to include</li>
                  <li>• Fixtures update automatically</li>
                  <li>• Available in Pro tier</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-900 mb-2">⏰ Timing Recommendations</h4>
            <ul className="space-y-1 text-yellow-800 text-sm">
              <li>• Add fixtures at least 2-3 days before matches</li>
              <li>• Give players time to research and decide</li>
              <li>• Send reminders as the deadline approaches</li>
              <li>• Consider time zones if you have international players</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Best Practices */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">💡</span>
          Best Practices for Success
        </h2>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4 text-green-800">✅ Do These Things</h3>
            <ul className="space-y-2 text-slate-700">
              <li>✅ Communicate rules clearly upfront</li>
              <li>✅ Send weekly fixture reminders</li>
              <li>✅ Update results promptly after matches</li>
              <li>✅ Be consistent with deadlines</li>
              <li>✅ Have a plan for disputed results</li>
              <li>✅ Celebrate milestones and winners</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4 text-red-800">❌ Avoid These Mistakes</h3>
            <ul className="space-y-2 text-slate-700">
              <li>❌ Changing rules mid-competition</li>
              <li>❌ Inconsistent result updates</li>
              <li>❌ Not communicating with players</li>
              <li>❌ Setting unrealistic deadlines</li>
              <li>❌ Forgetting to add new fixtures</li>
              <li>❌ Not having backup plans for postponed matches</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Troubleshooting */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">🔧</span>
          Common Issues & Solutions
        </h2>

        <div className="space-y-6">
          <div className="bg-slate-50 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 mb-2">❓ Players can&apos;t join my competition</h3>
            <div className="text-slate-700 text-sm space-y-1">
              <p><strong>Check:</strong> Is the invite code correct? Is the competition set to public?</p>
              <p><strong>Solution:</strong> Verify the code in your dashboard and check privacy settings.</p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 mb-2">❓ I entered the wrong result</h3>
            <div className="text-slate-700 text-sm space-y-1">
              <p><strong>Solution:</strong> You can edit results anytime. Go to the round and click &quot;Edit Results&quot;.</p>
              <p><strong>Note:</strong> The system will automatically recalculate player eliminations.</p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4">
            <h3 className="font-semibold text-slate-900 mb-2">❓ A match was postponed</h3>
            <div className="text-slate-700 text-sm space-y-1">
              <p><strong>Options:</strong> Mark as void, reschedule, or use organizer discretion.</p>
              <p><strong>Recommendation:</strong> Communicate your decision clearly to all players.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      <div className="bg-slate-50 rounded-lg p-8 text-center border">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Ready to Create Your Competition?</h2>
        <p className="text-lg text-slate-700 mb-6">
          You now have everything you need to set up a successful Last Man Standing competition!
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/register"
            className="px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Create Account & Start
          </Link>
          <Link
            href="/help/guides/managing-rounds"
            className="px-6 py-3 bg-white text-slate-800 border rounded-lg hover:bg-slate-100 transition-colors"
          >
            Learn Round Management
          </Link>
        </div>
      </div>
    </div>
  );
}