import Link from 'next/link';

export const metadata = {
  title: 'Managing Rounds - LMSLocal Help',
  description: 'Learn how to efficiently manage rounds in your Last Man Standing competition. Add fixtures, set deadlines, enter results, and handle special situations.',
  keywords: 'manage LMS rounds, competition management, fixtures, results, deadlines, LMSLocal guide',
  openGraph: {
    title: 'Managing Rounds',
    description: 'Master the art of round management for smooth-running Last Man Standing competitions.',
    type: 'article',
  }
};

export default function ManagingRoundsGuidePage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-slate-50 rounded-lg p-8 mb-8 border">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">
          Managing Rounds
        </h1>
        <p className="text-lg text-slate-700">
          Learn how to efficiently manage rounds, fixtures, and results to keep your competition running smoothly.
        </p>
      </div>

      {/* Round Lifecycle */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">🔄</span>
          Round Lifecycle
        </h2>

        <div className="space-y-6">
          <p className="text-slate-700">Every round follows the same pattern. Understanding this flow helps you stay organized:</p>

          <div className="grid md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold mx-auto mb-3">1</div>
              <h3 className="font-semibold text-slate-900 mb-2">Plan</h3>
              <p className="text-slate-600 text-sm">Add fixtures and set deadlines</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-yellow-100 text-yellow-700 rounded-full flex items-center justify-center font-bold mx-auto mb-3">2</div>
              <h3 className="font-semibold text-slate-900 mb-2">Collect</h3>
              <p className="text-slate-600 text-sm">Players make their picks</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold mx-auto mb-3">3</div>
              <h3 className="font-semibold text-slate-900 mb-2">Play</h3>
              <p className="text-slate-600 text-sm">Matches are played</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-bold mx-auto mb-3">4</div>
              <h3 className="font-semibold text-slate-900 mb-2">Results</h3>
              <p className="text-slate-600 text-sm">Enter results and eliminate players</p>
            </div>
          </div>
        </div>
      </div>

      {/* Adding Fixtures */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">📅</span>
          Adding Fixtures
        </h2>

        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">⏰ Timing is Critical</h3>
            <p className="text-blue-800 text-sm">Add fixtures at least 2-3 days before matches to give players time to research and decide.</p>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-slate-900 mb-4">Manual Fixture Entry</h3>
              <div className="space-y-4">
                <div className="flex">
                  <div className="w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold mr-4 mt-1 shrink-0">1</div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-2">Navigate to Round Management</h4>
                    <p className="text-slate-700 text-sm">From your competition dashboard, click &quot;Manage Rounds&quot; to see all your rounds.</p>
                  </div>
                </div>

                <div className="flex">
                  <div className="w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold mr-4 mt-1 shrink-0">2</div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-2">Create New Round</h4>
                    <p className="text-slate-700 text-sm">Click &quot;Add Round&quot; and enter the round details (name, start date, pick deadline).</p>
                  </div>
                </div>

                <div className="flex">
                  <div className="w-8 h-8 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold mr-4 mt-1 shrink-0">3</div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-2">Add Individual Matches</h4>
                    <div className="text-slate-700 text-sm space-y-1">
                      <p>For each match in the round, enter:</p>
                      <ul className="ml-4 space-y-1">
                        <li>• Home team and away team</li>
                        <li>• Kick-off date and time</li>
                        <li>• Venue (optional)</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-slate-900 mb-4">Auto Fixture Import (Pro Feature)</h3>
              <div className="bg-slate-50 rounded-lg p-6">
                <div className="flex items-start">
                  <span className="text-2xl mr-3">🚀</span>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-2">Save Time with Automation</h4>
                    <div className="text-slate-700 text-sm space-y-2">
                      <p>Pro tier users can automatically import fixtures from:</p>
                      <ul className="ml-4 space-y-1">
                        <li>• Premier League (all gameweeks)</li>
                        <li>• Championship (all gameweeks)</li>
                        <li>• Custom date ranges</li>
                      </ul>
                      <p className="text-slate-600 mt-2">Simply select the gameweeks you want and fixtures are added instantly.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Setting Deadlines */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">⏰</span>
          Setting Pick Deadlines
        </h2>

        <div className="space-y-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-900 mb-2">🎯 Default: 1 Hour Before First Match</h3>
            <p className="text-yellow-800 text-sm">This gives players time to research while preventing last-minute changes based on team news.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="font-semibold text-slate-900 mb-2">Conservative (3+ hours)</h4>
              <div className="text-slate-700 text-sm space-y-1">
                <p><strong>Pros:</strong> More thinking time, less rushed decisions</p>
                <p><strong>Cons:</strong> Team news might change picks</p>
                <p><strong>Best for:</strong> Casual competitions</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="font-semibold text-slate-900 mb-2">Standard (1 hour)</h4>
              <div className="text-slate-700 text-sm space-y-1">
                <p><strong>Pros:</strong> Balanced, fair for all players</p>
                <p><strong>Cons:</strong> None significant</p>
                <p><strong>Best for:</strong> Most competitions</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="font-semibold text-slate-900 mb-2">Tight (30 minutes)</h4>
              <div className="text-slate-700 text-sm space-y-1">
                <p><strong>Pros:</strong> Latest team news available</p>
                <p><strong>Cons:</strong> Can be stressful for players</p>
                <p><strong>Best for:</strong> Expert competitions</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Deadline Best Practices</h3>
            <ul className="space-y-2 text-slate-700">
              <li>✅ Keep deadlines consistent across rounds</li>
              <li>✅ Consider your players&apos; schedules (work, time zones)</li>
              <li>✅ Send reminders 24 hours and 2 hours before deadline</li>
              <li>✅ Allow deadline extensions only in exceptional circumstances</li>
              <li>❌ Don&apos;t change deadlines without good reason</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Monitoring Picks */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">👀</span>
          Monitoring Pick Progress
        </h2>

        <div className="space-y-6">
          <p className="text-slate-700">Keep track of who has made their picks and who needs reminders:</p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-slate-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Pick Status Dashboard</h3>
              <div className="text-slate-700 text-sm space-y-2">
                <p>Your round management shows:</p>
                <ul className="ml-4 space-y-1">
                  <li>• Total players who have picked</li>
                  <li>• Players still missing picks</li>
                  <li>• Most popular team choices</li>
                  <li>• Time until deadline</li>
                </ul>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Reminder Strategy</h3>
              <div className="text-slate-700 text-sm space-y-2">
                <p>Send targeted reminders:</p>
                <ul className="ml-4 space-y-1">
                  <li>• 24 hours before: All players</li>
                  <li>• 2 hours before: Players who haven&apos;t picked</li>
                  <li>• 30 minutes before: Final warning</li>
                  <li>• After deadline: Summary of results</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">💡 Pro Tip: Communication Templates</h4>
            <p className="text-blue-800 text-sm">Create standard message templates for reminders to save time and ensure consistency.</p>
          </div>
        </div>
      </div>

      {/* Entering Results */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">🏆</span>
          Entering Results
        </h2>

        <div className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-2">⚡ Enter Results Quickly After Matches</h3>
            <p className="text-green-800 text-sm">Players are eager to know if they&apos;ve survived. Quick result updates keep engagement high.</p>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-slate-900 mb-4">Manual Result Entry</h3>
              <div className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <div className="text-2xl mb-2">✅</div>
                    <h4 className="font-semibold text-slate-900 mb-2">Home Win</h4>
                    <p className="text-slate-700 text-sm">Select when home team wins</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <div className="text-2xl mb-2">🤝</div>
                    <h4 className="font-semibold text-slate-900 mb-2">Draw</h4>
                    <p className="text-slate-700 text-sm">Match ends level</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <div className="text-2xl mb-2">✅</div>
                    <h4 className="font-semibold text-slate-900 mb-2">Away Win</h4>
                    <p className="text-slate-700 text-sm">Select when away team wins</p>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-900 mb-2">⚠️ Important Result Rules</h4>
                  <ul className="text-yellow-800 text-sm space-y-1">
                    <li>• Results are based on 90 minutes + stoppage time only</li>
                    <li>• Extra time and penalties don&apos;t count</li>
                    <li>• If a match goes to extra time, it counts as a draw for LMS</li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-slate-900 mb-4">Auto Results (Pro Feature)</h3>
              <div className="bg-slate-50 rounded-lg p-6">
                <div className="flex items-start">
                  <span className="text-2xl mr-3">🤖</span>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-2">Automatic Result Updates</h4>
                    <div className="text-slate-700 text-sm space-y-2">
                      <p>Pro tier users get automatic result updates from reliable sports data feeds.</p>
                      <ul className="ml-4 space-y-1">
                        <li>• Results update within minutes of full-time</li>
                        <li>• Player eliminations calculated automatically</li>
                        <li>• You can still override if needed</li>
                        <li>• Covers Premier League and Championship</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Special Situations */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">⚠️</span>
          Handling Special Situations
        </h2>

        <div className="space-y-6">
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="font-semibold text-slate-900 mb-2">⏸️ Postponed Matches</h3>
              <div className="text-slate-700 text-sm space-y-2">
                <p><strong>Options:</strong></p>
                <ul className="ml-4 space-y-1">
                  <li>• Mark as void (most common) - players get a free pass</li>
                  <li>• Reschedule if new date is soon</li>
                  <li>• Use organizer discretion</li>
                </ul>
                <p><strong>Best practice:</strong> Communicate your decision quickly and clearly to all players.</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="font-semibold text-slate-900 mb-2">🛑 Abandoned Matches</h3>
              <div className="text-slate-700 text-sm space-y-2">
                <p><strong>General rule:</strong></p>
                <ul className="ml-4 space-y-1">
                  <li>• If abandoned before 60 minutes: Usually void</li>
                  <li>• If abandoned after 60 minutes: Score at abandonment usually stands</li>
                  <li>• Check official league rules for guidance</li>
                </ul>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="font-semibold text-slate-900 mb-2">❌ Wrong Result Entered</h3>
              <div className="text-slate-700 text-sm space-y-2">
                <p><strong>Don&apos;t panic!</strong> You can edit results anytime:</p>
                <ul className="ml-4 space-y-1">
                  <li>• Go to the round and click &quot;Edit Results&quot;</li>
                  <li>• Change the result and save</li>
                  <li>• Player eliminations will recalculate automatically</li>
                  <li>• Send a message explaining the correction</li>
                </ul>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="font-semibold text-slate-900 mb-2">🤔 Player Disputes</h3>
              <div className="text-slate-700 text-sm space-y-2">
                <p><strong>You have full control to:</strong></p>
                <ul className="ml-4 space-y-1">
                  <li>• Override any player&apos;s pick (if they had technical issues)</li>
                  <li>• Adjust results for exceptional circumstances</li>
                  <li>• Reinstate eliminated players if justified</li>
                  <li>• Make final decisions on edge cases</li>
                </ul>
                <p><strong>Key:</strong> Be fair, consistent, and transparent in your decisions.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Round Analysis */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">📊</span>
          Round Analysis & Statistics
        </h2>

        <div className="space-y-6">
          <p className="text-slate-700">After each round, review the statistics to understand your competition:</p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-slate-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Key Metrics to Track</h3>
              <ul className="space-y-2 text-slate-700 text-sm">
                <li>• Number of players eliminated</li>
                <li>• Most popular team choices</li>
                <li>• Success rate of different picks</li>
                <li>• Players remaining vs. rounds played</li>
                <li>• Pick deadline compliance rate</li>
              </ul>
            </div>

            <div className="bg-slate-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Use Data to Improve</h3>
              <ul className="space-y-2 text-slate-700 text-sm">
                <li>• Adjust deadlines if many miss them</li>
                <li>• Add more fixture variety if needed</li>
                <li>• Communicate popular picks to create discussion</li>
                <li>• Plan for competition length based on elimination rate</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Reference */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
          <span className="text-2xl mr-3">📋</span>
          Quick Reference Checklist
        </h2>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Before Each Round</h3>
            <div className="space-y-2 text-slate-700">
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" />
                <span className="text-sm">Add fixtures 2-3 days early</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" />
                <span className="text-sm">Set appropriate deadline</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" />
                <span className="text-sm">Send round announcement</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" />
                <span className="text-sm">Monitor pick progress</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" />
                <span className="text-sm">Send deadline reminders</span>
              </label>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">After Each Round</h3>
            <div className="space-y-2 text-slate-700">
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" />
                <span className="text-sm">Enter results promptly</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" />
                <span className="text-sm">Review eliminations</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" />
                <span className="text-sm">Send result summary</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" />
                <span className="text-sm">Plan next round</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" />
                <span className="text-sm">Celebrate survivors!</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      <div className="bg-slate-50 rounded-lg p-8 text-center border">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Master Round Management</h2>
        <p className="text-lg text-slate-700 mb-6">
          With these techniques, you&apos;ll run smooth, engaging competitions that players love!
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/help/guides/creating-competition"
            className="px-6 py-3 bg-white text-slate-800 border rounded-lg hover:bg-slate-100 transition-colors"
          >
            Creating Competitions
          </Link>
          <Link
            href="/help/guides/making-picks"
            className="px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Player Pick Guide
          </Link>
        </div>
      </div>
    </div>
  );
}