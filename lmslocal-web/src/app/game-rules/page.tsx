'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircleIcon, TrophyIcon, ArrowLeftIcon, UserGroupIcon, ClockIcon, XCircleIcon, ExclamationTriangleIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

export default function GameRulesPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if user is authenticated on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('jwt_token');
      const userData = localStorage.getItem('user');
      setIsAuthenticated(!!(token && userData && userData !== 'undefined' && userData !== 'null'));
    }
  }, []);

  const handleBackClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isAuthenticated) {
      // If user is authenticated, go back to dashboard
      router.push('/dashboard');
    } else {
      // If not authenticated, go to landing page
      router.push('/');
    }
  };
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-sm shadow-sm border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <button
                onClick={handleBackClick}
                className="flex items-center text-slate-600 hover:text-slate-900 mr-4 transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5 mr-2" />
                Back
              </button>
              <TrophyIcon className="h-8 w-8 text-slate-700 mr-2" />
              <span className="text-2xl font-bold text-slate-900">LMSLocal</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/pricing"
                className="text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"
              >
                Pricing
              </Link>
              <Link
                href="/login"
                className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-slate-100 via-slate-50 to-stone-100 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-slate-900 mb-6">
            Game Rules
          </h1>
          <p className="text-xl text-slate-600 mb-12 max-w-3xl mx-auto">
            Everything you need to know about Last Man Standing competitions on LMSLocal. Simple rules, fair play, maximum excitement.
          </p>

          {/* Quick Summary */}
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-16">
            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50 shadow-sm">
              <TrophyIcon className="h-8 w-8 text-slate-700 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-900 mb-2">Pick to Win</h3>
              <p className="text-slate-600 text-sm">Choose one team per round. If they win, you survive to the next round.</p>
            </div>
            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50 shadow-sm">
              <XCircleIcon className="h-8 w-8 text-red-600 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-900 mb-2">Lose a Life</h3>
              <p className="text-slate-600 text-sm">Team loses or draws? You lose a life. No lives left means elimination.</p>
            </div>
            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50 shadow-sm">
              <UserGroupIcon className="h-8 w-8 text-emerald-600 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-900 mb-2">Last One Standing</h3>
              <p className="text-slate-600 text-sm">Keep surviving until you&apos;re the last player remaining and claim victory!</p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Rules */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              How Last Man Standing Works
            </h2>
            <p className="text-xl text-slate-600">The fundamental rules that govern every competition</p>
          </div>

          <div className="space-y-12">
            {/* Basic Gameplay */}
            <div className="bg-slate-50 rounded-xl p-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
                <TrophyIcon className="h-7 w-7 text-slate-700 mr-3" />
                Basic Gameplay
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">Round Structure</h4>
                  <ul className="space-y-2 text-slate-600">
                    <li className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                      Each round features real football fixtures
                    </li>
                    <li className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                      You pick ONE team to win their match
                    </li>
                    <li className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                      Picks lock before matches kick off
                    </li>
                    <li className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                      Results based on 90 minutes + stoppage time only
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">Winning & Losing</h4>
                  <ul className="space-y-2 text-slate-600">
                    <li className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                      <strong>Your team wins:</strong> You survive to the next round
                    </li>
                    <li className="flex items-start">
                      <XCircleIcon className="h-5 w-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                      <strong>Your team loses:</strong> You lose a life
                    </li>
                    <li className="flex items-start">
                      <XCircleIcon className="h-5 w-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                      <strong>Your team draws:</strong> You lose a life
                    </li>
                    <li className="flex items-start">
                      <XCircleIcon className="h-5 w-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                      <strong>No pick made:</strong> You lose a life
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Lives System */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
                <ShieldCheckIcon className="h-7 w-7 text-emerald-700 mr-3" />
                Lives System
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">How Lives Work</h4>
                  <ul className="space-y-2 text-slate-600">
                    <li className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                      Each player starts with 1 life (configurable by organizer)
                    </li>
                    <li className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                      Lives are lost when your team doesn&apos;t win
                    </li>
                    <li className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                      When you run out of lives, you&apos;re eliminated
                    </li>
                    <li className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                      Lives never regenerate during the competition
                    </li>
                  </ul>
                </div>
                <div className="bg-white rounded-lg p-6 border border-emerald-200">
                  <h4 className="font-semibold text-slate-900 mb-3">Example: Standard Competition</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Starting lives:</span>
                      <span className="font-semibold text-emerald-700">1 life</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Round 1 - Team loses:</span>
                      <span className="font-semibold text-red-600">0 lives (eliminated)</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-3">
                      💡 Most competitions use 1 life for maximum excitement, but organizers can set up to 3 lives for longer competitions.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Team Selection Rules */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
                <ExclamationTriangleIcon className="h-7 w-7 text-amber-700 mr-3" />
                Team Selection Rules
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">One Team Per Round</h4>
                  <ul className="space-y-2 text-slate-600">
                    <li className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                      Pick exactly one team each round
                    </li>
                    <li className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                      Your team must be playing in that round&apos;s fixtures
                    </li>
                    <li className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                      Must pick before the round lock time
                    </li>
                    <li className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                      Can change pick until round locks
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">No Team Twice Rule</h4>
                  <ul className="space-y-2 text-slate-600">
                    <li className="flex items-start">
                      <XCircleIcon className="h-5 w-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                      Cannot pick the same team twice (default rule)
                    </li>
                    <li className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                      Teams automatically removed after you pick them
                    </li>
                    <li className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                      Teams reset if you run out of options
                    </li>
                    <li className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                      Organizers can disable this rule if preferred
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Round Timing */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center">
                <ClockIcon className="h-7 w-7 text-blue-700 mr-3" />
                Round Timing & Locks
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">Lock Times</h4>
                  <ul className="space-y-2 text-slate-600">
                    <li className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                      Each round has a set lock time
                    </li>
                    <li className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                      Usually 1 hour before first kickoff
                    </li>
                    <li className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                      Rounds lock automatically when all players pick (Round 2+)
                    </li>
                    <li className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                      No picks can be made after lock time
                    </li>
                    <li className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                      Results processed after all matches finish
                    </li>
                  </ul>
                </div>
                <div className="bg-white rounded-lg p-6 border border-blue-200">
                  <h4 className="font-semibold text-slate-900 mb-3">Typical Timeline</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Round opens:</span>
                      <span className="font-semibold text-blue-700">Monday morning</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Lock time:</span>
                      <span className="font-semibold text-amber-700">Friday 6pm</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Matches:</span>
                      <span className="font-semibold text-slate-700">Weekend</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Results:</span>
                      <span className="font-semibold text-emerald-700">Sunday evening</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Competition Management */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Competition Management
            </h2>
            <p className="text-xl text-slate-600">How organizers run fair and smooth competitions</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Organizer Powers */}
            <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200">
              <h3 className="text-xl font-bold text-slate-900 mb-6">Organizer Powers</h3>
              <ul className="space-y-3 text-slate-600">
                <li className="flex items-start">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                  Set competition rules (lives, team reuse)
                </li>
                <li className="flex items-start">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                  Create rounds and set lock times
                </li>
                <li className="flex items-start">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                  Add fixtures and enter results
                </li>
                <li className="flex items-start">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                  Override picks for any player
                </li>
                <li className="flex items-start">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                  Adjust player lives and status
                </li>
                <li className="flex items-start">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                  Add guest players for non-smartphone users
                </li>
                <li className="flex items-start">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                  Full audit trail of all actions
                </li>
              </ul>
            </div>

            {/* Fair Play */}
            <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200">
              <h3 className="text-xl font-bold text-slate-900 mb-6">Fair Play Safeguards</h3>
              <ul className="space-y-3 text-slate-600">
                <li className="flex items-start">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                  All admin actions are logged and auditable
                </li>
                <li className="flex items-start">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                  Player picks are locked and timestamped
                </li>
                <li className="flex items-start">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                  Results based on official match outcomes
                </li>
                <li className="flex items-start">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                  Transparent competition standings
                </li>
                <li className="flex items-start">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                  Automated elimination processing
                </li>
                <li className="flex items-start">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                  Clear competition completion criteria
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Competition End */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              How Competitions End
            </h2>
            <p className="text-xl text-slate-600">Victory conditions and final outcomes</p>
          </div>

          <div className="bg-gradient-to-r from-emerald-50 to-blue-50 rounded-xl p-8 border border-emerald-200">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-4">Victory Conditions</h3>
                <ul className="space-y-3 text-slate-600">
                  <li className="flex items-start">
                    <TrophyIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                    <strong>Single Winner:</strong> Last active player remaining wins
                  </li>
                  <li className="flex items-start">
                    <XCircleIcon className="h-5 w-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                    <strong>All Eliminated:</strong> Competition ends with no winner
                  </li>
                  <li className="flex items-start">
                    <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                    Competition automatically marked as complete
                  </li>
                  <li className="flex items-start">
                    <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                    Final standings preserved permanently
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-4">After Competition</h3>
                <ul className="space-y-3 text-slate-600">
                  <li className="flex items-start">
                    <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                    View complete competition history
                  </li>
                  <li className="flex items-start">
                    <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                    Player performance statistics
                  </li>
                  <li className="flex items-start">
                    <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                    Round-by-round breakdown
                  </li>
                  <li className="flex items-start">
                    <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 mt-0.5 flex-shrink-0" />
                    Sharable final results
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-slate-600">Common questions about Last Man Standing rules</p>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">What happens if my team draws?</h3>
              <p className="text-slate-600">Draws count as losses in Last Man Standing. You lose a life just as if your team had lost the match. Only wins keep you in the competition.</p>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Can I change my pick after submitting?</h3>
              <p className="text-slate-600">Yes, you can change your pick as many times as you want until the round lock time. Once the round locks, picks are final and cannot be changed.</p>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">What happens when everyone has picked?</h3>
              <p className="text-slate-600">From Round 2 onwards, when all active players have made their picks, the round automatically locks - even before the scheduled deadline. This means you can see everyone&apos;s picks immediately without waiting for the official lock time!</p>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">What if I forget to make a pick?</h3>
              <p className="text-slate-600">Missing a pick counts as a loss and you&apos;ll lose a life. The system treats no-picks the same as picking a losing team to ensure fairness.</p>
            </div>


            <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Can the organizer change the rules mid-competition?</h3>
              <p className="text-slate-600">Organizers have override powers for managing disputes and edge cases, but core rules like lives and team reuse are typically set at the start. All admin actions are logged for transparency.</p>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">What happens if all players are eliminated?</h3>
              <p className="text-slate-600">If everyone loses their final life in the same round, the competition ends with no winner. This is rare but can happen in very competitive rounds!</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Start Playing?
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            Now you know the rules - time to put them into practice!
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Link
              href="/register"
              className="bg-white text-slate-800 px-8 py-4 rounded-xl font-semibold text-lg transition-colors shadow-sm hover:bg-slate-100"
            >
              Create Competition
            </Link>
            <Link
              href="/login"
              className="text-slate-300 hover:text-white px-8 py-4 rounded-xl font-semibold text-lg border-2 border-slate-600 hover:bg-slate-700 transition-all"
            >
              Join Competition
            </Link>
          </div>

          <p className="text-slate-400">
            Free during beta • Simple setup • Fair play guaranteed
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-6 lg:space-y-0">
            <div className="flex items-center">
              <TrophyIcon className="h-6 w-6 text-slate-400 mr-2" />
              <span className="text-xl font-bold">LMSLocal</span>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-8">
              <div className="flex space-x-6">
                <Link href="/terms" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Terms of Service
                </Link>
                <Link href="/privacy" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </div>

              <div className="text-sm text-slate-400">
                <p>&copy; 2025 LMSLocal. All rights reserved.</p>
                <p className="mt-1">The admin-first Last Man Standing platform.</p>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}