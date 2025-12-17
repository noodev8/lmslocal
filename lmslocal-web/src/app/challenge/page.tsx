'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  TrophyIcon,
  CheckCircleIcon,
  XCircleIcon,
  DevicePhoneMobileIcon,
  UserPlusIcon,
  HandThumbUpIcon,
  ArrowRightIcon,
  GiftIcon,
  CalendarDaysIcon,
  BoltIcon,
  ShieldCheckIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';

export default function ChallengeCompetitionPage() {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [hasDeadline, setHasDeadline] = useState(false);

  // Countdown timer to deadline set via NEXT_PUBLIC_CHALLENGE_DEADLINE env var
  // Format: "2025-12-14T12:00:00" (ISO format, local time)
  useEffect(() => {
    const deadlineStr = process.env.NEXT_PUBLIC_CHALLENGE_DEADLINE;

    const calculateTimeLeft = () => {
      if (!deadlineStr) {
        // No deadline set - hide timer
        setHasDeadline(false);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      setHasDeadline(true);

      const now = new Date();
      const deadline = new Date(deadlineStr);
      const difference = deadline.getTime() - now.getTime();

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        });
      } else {
        // Deadline passed
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Sticky Header */}
      <header className="fixed top-0 left-0 right-0 bg-slate-900/95 backdrop-blur-sm z-50 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="flex items-center">
              <TrophyIcon className="h-7 w-7 text-amber-400 mr-2" />
              <span className="text-xl font-bold text-white">LMS Local</span>
            </Link>
            <div className="flex items-center gap-3">
              <a
                href="#download"
                className="hidden sm:inline-flex items-center bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 px-5 py-2.5 rounded-full font-bold text-sm transition-all shadow-lg shadow-amber-500/25"
              >
                Play Free Now
                <ArrowRightIcon className="h-4 w-4 ml-2" />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section - Prize Focused */}
      <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900"></div>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500 rounded-full blur-[150px] opacity-20"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500 rounded-full blur-[150px] opacity-15"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            {/* Free Badge */}
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/50 rounded-full px-5 py-2 mb-6">
              <GiftIcon className="h-5 w-5 text-emerald-400" />
              <span className="text-emerald-400 font-bold text-sm uppercase tracking-wide">100% Free Entry</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-white mb-4 leading-tight">
              Win Up To <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-500">£250</span>
              <br />
              <span className="text-3xl sm:text-4xl md:text-5xl">Playing Football Predictions</span>
            </h1>

            {/* Prize Amounts */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 my-8">
              <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-2 border-amber-500/50 rounded-2xl px-6 py-5 backdrop-blur-sm w-full sm:w-auto">
                <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-1">New Game Every Week</p>
                <p className="text-4xl md:text-5xl font-black text-white">£20</p>
                <p className="text-slate-400 text-xs mt-1">Real players only</p>
              </div>
              <div className="text-slate-500 text-2xl font-bold">+</div>
              <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border-2 border-emerald-500/50 rounded-2xl px-6 py-5 backdrop-blur-sm w-full sm:w-auto">
                <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">New Game Every Month</p>
                <p className="text-4xl md:text-5xl font-black text-white">£250</p>
                <p className="text-slate-400 text-xs mt-1">Beat the AI challengers</p>
              </div>
            </div>

            <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-8">
              No entry fee. No catch. Pick a winning team and survive to the next round.
              <span className="block text-amber-400 font-semibold mt-2">The last player standing wins!</span>
            </p>

            {/* Countdown Timer - only shows when NEXT_PUBLIC_CHALLENGE_DEADLINE is set */}
            {hasDeadline && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 max-w-lg mx-auto mb-10">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <ClockIcon className="h-5 w-5 text-red-400" />
                  <p className="text-red-400 font-semibold text-sm uppercase tracking-wide">Next Round Starts In</p>
                </div>
                <div className="flex justify-center gap-3">
                  {[
                    { value: timeLeft.days, label: 'Days' },
                    { value: timeLeft.hours, label: 'Hrs' },
                    { value: timeLeft.minutes, label: 'Min' },
                    { value: timeLeft.seconds, label: 'Sec' }
                  ].map((item, i) => (
                    <div key={i} className="bg-slate-900 rounded-lg px-4 py-3 min-w-[60px]">
                      <p className="text-2xl md:text-3xl font-bold text-white">{String(item.value).padStart(2, '0')}</p>
                      <p className="text-xs text-slate-500 uppercase">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA Buttons */}
            <div id="download" className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="https://apps.apple.com/gb/app/lms-local/id6755344736"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto bg-black hover:bg-gray-900 text-white px-8 py-4 rounded-2xl font-semibold transition-all flex items-center justify-center gap-3 border border-slate-700"
              >
                <span className="text-3xl"></span>
                <div className="text-left">
                  <div className="text-xs opacity-70">Download on the</div>
                  <div className="text-lg font-bold">App Store</div>
                </div>
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=uk.co.lmslocal.lmslocal_flutter"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto bg-black hover:bg-gray-900 text-white px-8 py-4 rounded-2xl font-semibold transition-all flex items-center justify-center gap-3 border border-slate-700"
              >
                <span className="text-3xl">▶</span>
                <div className="text-left">
                  <div className="text-xs opacity-70">GET IT ON</div>
                  <div className="text-lg font-bold">Google Play</div>
                </div>
              </a>
            </div>

            <p className="text-slate-500 text-sm mt-4">
              Already have the app? Free games appear at the top of your dashboard
            </p>
          </div>
        </div>
      </section>

      {/* How It Works - Visual Steps */}
      <section className="py-20 bg-slate-800/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              How to Win in <span className="text-amber-400">3 Simple Steps</span>
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              It takes 2 minutes to join and make your first pick
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="relative">
              <div className="bg-gradient-to-br from-blue-600/20 to-blue-700/10 border border-blue-500/30 rounded-3xl p-8 h-full">
                <div className="absolute -top-4 -left-4 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-600/50">
                  1
                </div>
                <div className="pt-4">
                  <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-6">
                    <DevicePhoneMobileIcon className="h-8 w-8 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">Download the App</h3>
                  <p className="text-slate-400">
                    Get our free app from the App Store or Google Play. Takes 30 seconds.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="bg-gradient-to-br from-purple-600/20 to-purple-700/10 border border-purple-500/30 rounded-3xl p-8 h-full">
                <div className="absolute -top-4 -left-4 w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-black text-xl shadow-lg shadow-purple-600/50">
                  2
                </div>
                <div className="pt-4">
                  <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mb-6">
                    <UserPlusIcon className="h-8 w-8 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">Register & Join</h3>
                  <p className="text-slate-400">
                    Create your free account and join any game from your dashboard. New games start every week!
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-700/10 border border-emerald-500/30 rounded-3xl p-8 h-full">
                <div className="absolute -top-4 -left-4 w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-600/50">
                  3
                </div>
                <div className="pt-4">
                  <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-6">
                    <HandThumbUpIcon className="h-8 w-8 text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">Pick & Win</h3>
                  <p className="text-slate-400">
                    Pick one Premier League team each week. If they win, you survive. Last one standing wins!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Game Explanation - Visual */}
      <section className="py-20 bg-slate-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              The Rules Are <span className="text-emerald-400">Super Simple</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Visual Game Flow */}
            <div className="space-y-6">
              {/* Week Example */}
              <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
                <div className="flex items-center gap-3 mb-4">
                  <CalendarDaysIcon className="h-6 w-6 text-amber-400" />
                  <span className="text-amber-400 font-semibold">Each Week</span>
                </div>
                <p className="text-white text-lg mb-4">You pick <span className="font-bold text-amber-400">ONE</span> Premier League team to win their match.</p>

                {/* Example Pick */}
                <div className="bg-slate-900 rounded-xl p-4 border border-slate-600">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white font-bold text-sm">LIV</div>
                      <span className="text-white font-medium">Liverpool</span>
                    </div>
                    <div className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-sm font-semibold">
                      Your Pick
                    </div>
                  </div>
                </div>
              </div>

              {/* Outcomes */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-900/30 border border-emerald-500/30 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircleIcon className="h-6 w-6 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">WIN</span>
                  </div>
                  <p className="text-slate-300 text-sm">Your team wins? You survive to next week!</p>
                </div>
                <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircleIcon className="h-6 w-6 text-red-400" />
                    <span className="text-red-400 font-bold">DRAW / LOSE</span>
                  </div>
                  <p className="text-slate-300 text-sm">Your team doesn&apos;t win? You&apos;re eliminated.</p>
                </div>
              </div>

              {/* The Catch */}
              <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <BoltIcon className="h-6 w-6 text-amber-400" />
                  <span className="text-amber-400 font-bold">THE TWIST</span>
                </div>
                <p className="text-slate-300">
                  You <span className="text-white font-bold">can&apos;t pick the same team twice</span> in a game.
                  Choose wisely - the easy picks run out fast!
                </p>
                <p className="text-slate-400 text-sm mt-3">
                  In monthly games, AI challengers (Bots) may compete alongside real players and start with an extra life. Beat them to win!
                </p>
              </div>
            </div>

            {/* Leaderboard Visual */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-8 border border-slate-700">
              <div className="text-center mb-6">
                <TrophyIcon className="h-12 w-12 text-amber-400 mx-auto mb-3" />
                <h3 className="text-xl font-bold text-white">Last Player Standing Wins</h3>
                <p className="text-slate-400 text-sm mt-1">Monthly Jackpot example</p>
              </div>

              {/* Mock Leaderboard */}
              <div className="space-y-3">
                {[
                  { rank: 1, name: 'You?', status: 'alive', highlight: true },
                  { rank: 2, name: 'FootyFan_James', status: 'alive', highlight: false },
                  { rank: 3, name: 'Bot_Arsenal', status: 'alive', highlight: false },
                  { rank: 4, name: 'LuckyDave', status: 'eliminated', highlight: false },
                  { rank: 5, name: 'Bot_Chelsea', status: 'eliminated', highlight: false },
                ].map((player) => (
                  <div
                    key={player.rank}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      player.highlight
                        ? 'bg-amber-500/20 border border-amber-500/50'
                        : player.status === 'alive'
                          ? 'bg-slate-700/50'
                          : 'bg-slate-800/50 opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        player.rank === 1 ? 'bg-amber-500 text-slate-900' : 'bg-slate-600 text-slate-300'
                      }`}>
                        {player.rank}
                      </span>
                      <span className={`font-medium ${player.highlight ? 'text-amber-400' : 'text-slate-300'}`}>
                        {player.name}
                      </span>
                    </div>
                    <span className={`text-xs font-semibold uppercase ${
                      player.status === 'alive' ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {player.status}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 text-center">
                <p className="text-slate-400 text-sm">As players get eliminated, prize pool stays the same.</p>
                <p className="text-amber-400 font-bold mt-2">Fewer players = Better odds for YOU!</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="py-16 bg-slate-800/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { icon: GiftIcon, label: '100% Free Entry', sublabel: 'No credit card' },
              { icon: ShieldCheckIcon, label: 'Secure & Safe', sublabel: 'UK regulated' },
              { icon: TrophyIcon, label: 'Real Prizes', sublabel: '£20 weekly + £250 monthly' },
              { icon: DevicePhoneMobileIcon, label: 'Easy to Play', sublabel: 'Mobile app' },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <item.icon className="h-10 w-10 text-amber-400 mx-auto mb-3" />
                <p className="text-white font-semibold">{item.label}</p>
                <p className="text-slate-500 text-sm">{item.sublabel}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-16 bg-slate-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
              Join Thousands of Players
            </h2>
            <div className="flex items-center justify-center gap-1 mb-4">
              {[...Array(5)].map((_, i) => (
                <StarIcon key={i} className="h-6 w-6 text-amber-400" />
              ))}
            </div>
            <p className="text-slate-400">4.8/5 rating on the App Store</p>
          </div>

          {/* Testimonials */}
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { quote: "Won £20 in my second week! Easiest money ever.", name: "Jamie T.", location: "Manchester" },
              { quote: "Love the app - so simple to use. Made my picks in 30 seconds.", name: "Sarah M.", location: "London" },
              { quote: "Finally a free competition with actual prizes. Recommended!", name: "Chris P.", location: "Birmingham" },
            ].map((testimonial, i) => (
              <div key={i} className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <p className="text-slate-300 italic mb-4">&quot;{testimonial.quote}&quot;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center text-slate-900 font-bold">
                    {testimonial.name[0]}
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{testimonial.name}</p>
                    <p className="text-slate-500 text-xs">{testimonial.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-slate-800/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-12">
            Questions? We&apos;ve Got Answers
          </h2>

          <div className="space-y-4">
            {[
              {
                q: "Is it really free to enter?",
                a: "Yes! 100% free. No entry fee, no hidden costs, no credit card required. Just download the app and join."
              },
              {
                q: "What's the difference between £20 and £250 games?",
                a: "£20 games start every week and are real players only. The £250 monthly game starts at the beginning of each month and may include AI challengers to beat."
              },
              {
                q: "Who am I competing against?",
                a: "In £20 games, it's just real players. In the monthly game, you may also be competing against AI challengers (marked with 'Bot' in their name). Full transparency - you can see everyone on the leaderboard!"
              },
              {
                q: "How do I get paid if I win?",
                a: "Winners are contacted by email to arrange payment via bank transfer. Make sure your account has a valid email address!"
              },
              {
                q: "What happens if I forget to make a pick?",
                a: "If you don't make a pick before the deadline, you'll be eliminated. Set notifications on so you don't miss out!"
              },
              {
                q: "Can I pick any team?",
                a: "You can pick any Premier League team, but you can only use each team ONCE per game. Plan ahead!"
              },
            ].map((faq, i) => (
              <div key={i} className="bg-slate-900 rounded-xl p-6 border border-slate-700">
                <h3 className="text-white font-semibold mb-2">{faq.q}</h3>
                <p className="text-slate-400">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/50 rounded-full px-5 py-2 mb-6">
            <span className="text-emerald-400 font-bold text-sm">Limited Spots Available</span>
          </div>

          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Win <span className="text-amber-400">£20</span> Weekly or <span className="text-emerald-400">£250</span> Monthly
          </h2>
          <p className="text-xl text-slate-400 mb-8">
            Download now and start playing. New games every week.
          </p>

          {/* App Store Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <a
              href="https://apps.apple.com/gb/app/lms-local/id6755344736"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 px-8 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg shadow-amber-500/25"
            >
              <span className="text-2xl"></span>
              <span>Download for iOS</span>
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=uk.co.lmslocal.lmslocal_flutter"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 px-8 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg shadow-amber-500/25"
            >
              <span className="text-2xl">▶</span>
              <span>Download for Android</span>
            </a>
          </div>

          <p className="text-slate-500 text-sm">
            Free games appear at the top of your dashboard - no code needed
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 py-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center">
              <TrophyIcon className="h-5 w-5 text-slate-500 mr-2" />
              <span className="text-slate-500 text-sm">LMS Local - Last Man Standing Competitions</span>
            </div>
            <div className="flex gap-6">
              <Link href="/terms" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">Terms</Link>
              <Link href="/privacy" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">Privacy</Link>
              <Link href="/help" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">Help</Link>
              <Link href="/" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">Main Site</Link>
            </div>
          </div>
          <div className="text-center mt-6">
            <p className="text-slate-600 text-xs">
              &copy; 2025 LMSLocal. Operated by Noodev8 Ltd (Company No: 16222537)
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
