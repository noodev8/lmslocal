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
  UserGroupIcon,
  TicketIcon
} from '@heroicons/react/24/outline';
export default function BrookfieldSocialsChallengePage() {
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Sticky Header */}
      <header className="fixed top-0 left-0 right-0 bg-slate-900/95 backdrop-blur-sm z-50 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <TrophyIcon className="h-7 w-7 text-amber-400 mr-2" />
              <span className="text-xl font-bold text-white">LMS Local</span>
              <span className="text-slate-500 mx-2">×</span>
              <span className="text-lg font-semibold text-purple-400">Brookfield Socials</span>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="#how-to-join"
                className="hidden sm:inline-flex items-center bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white px-5 py-2.5 rounded-full font-bold text-sm transition-all shadow-lg shadow-purple-500/25"
              >
                Join Now
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
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500 rounded-full blur-[150px] opacity-20"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500 rounded-full blur-[150px] opacity-15"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            {/* Brookfield Socials Branding */}
            <div className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-purple-400 mb-2">Brookfield Socials</h2>
              <p className="text-slate-400">One of Shrewsbury&apos;s popular social groups &bull; Walks, dinners &amp; coffee mornings</p>
              <div className="flex items-center justify-center gap-4 mt-3">
                <a
                  href="https://www.meetup.com/brookfield-socials/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-purple-400 hover:text-purple-300 underline"
                >
                  Join on Meetup
                </a>
                <span className="text-slate-600">•</span>
                <a
                  href="https://www.facebook.com/groups/brookfieldsocials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-purple-400 hover:text-purple-300 underline"
                >
                  Join on Facebook
                </a>
              </div>
            </div>

            {/* Main Headline & Prize */}
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-white mb-6 leading-tight">
              Win <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-500">£50</span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-300 max-w-2xl mx-auto mb-2">
              Free football prediction game for our members
            </p>
            <p className="text-slate-400 text-sm mb-8">
              Pick winners, survive each round, last one standing wins &bull; Terms apply
              <span className="block text-purple-400 mt-2">- Andreas, Group Organiser</span>
            </p>

            {/* Join Code Box */}
            <div id="how-to-join" className="bg-slate-800/70 border-2 border-purple-500/50 rounded-2xl p-8 max-w-lg mx-auto mb-10">
              <div className="flex items-center justify-center gap-2 mb-4">
                <TicketIcon className="h-6 w-6 text-purple-400" />
                <p className="text-purple-400 font-bold text-lg uppercase tracking-wide">How to Join</p>
              </div>
              <ol className="text-left text-slate-300 space-y-3 mb-6">
                <li className="flex items-start gap-3">
                  <span className="bg-purple-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shrink-0">1</span>
                  <span>Download the LMS Local app (links below)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="bg-purple-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shrink-0">2</span>
                  <span>Create your free account</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="bg-purple-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shrink-0">3</span>
                  <span>Tap <strong className="text-white">&quot;Play Competition&quot;</strong> on the home screen</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="bg-purple-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shrink-0">4</span>
                  <span>Enter code: <strong className="text-amber-400 text-xl font-mono">4117</strong></span>
                </li>
              </ol>
              <div className="bg-slate-900 rounded-xl p-4 border border-slate-600">
                <p className="text-slate-400 text-sm">Your competition code</p>
                <p className="text-4xl font-mono font-black text-amber-400 tracking-wider">4117</p>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
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
                  <h3 className="text-xl font-bold text-white mb-3">Join with Code 4117</h3>
                  <p className="text-slate-400">
                    Create your account, tap &quot;Play Competition&quot; and enter code <strong className="text-amber-400">4117</strong>
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
                    Pick one Premier League team each round. If they win, you survive. Last one standing wins £50!
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
                  <span className="text-amber-400 font-semibold">Each Round</span>
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
                  <p className="text-slate-300 text-sm">Your team wins? You survive to the next round!</p>
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
                  You <span className="text-white font-bold">can&apos;t pick the same team twice</span>.
                  Choose wisely - the easy picks run out fast!
                </p>
                <p className="text-slate-400 text-sm mt-3">
                  AI challengers (Bots) may compete alongside real players and start with an extra life. Beat them to win!
                </p>
              </div>
            </div>

            {/* Leaderboard Visual */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-8 border border-slate-700">
              <div className="text-center mb-6">
                <TrophyIcon className="h-12 w-12 text-amber-400 mx-auto mb-3" />
                <h3 className="text-xl font-bold text-white">Last Player Standing Wins</h3>
                <p className="text-purple-400 text-sm mt-1">Brookfield Socials Competition</p>
              </div>

              {/* Mock Leaderboard */}
              <div className="space-y-3">
                {[
                  { rank: 1, name: 'You?', status: 'alive', highlight: true },
                  { rank: 2, name: 'MeetupMike', status: 'alive', highlight: false },
                  { rank: 3, name: 'Bot_Arsenal', status: 'alive', highlight: false },
                  { rank: 4, name: 'SocialSarah', status: 'eliminated', highlight: false },
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
                <p className="text-slate-400 text-sm">As players get eliminated, it gets easier!</p>
                <p className="text-amber-400 font-bold mt-2">Be the last one standing to win £50!</p>
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
              { icon: GiftIcon, label: 'Free to Enter', sublabel: 'No cost to play' },
              { icon: ShieldCheckIcon, label: 'Secure & Safe', sublabel: 'UK platform' },
              { icon: TrophyIcon, label: '£50 Prize', sublabel: 'Winner takes all' },
              { icon: UserGroupIcon, label: 'Members Only', sublabel: 'Brookfield Socials' },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <item.icon className="h-10 w-10 text-purple-400 mx-auto mb-3" />
                <p className="text-white font-semibold">{item.label}</p>
                <p className="text-slate-500 text-sm">{item.sublabel}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-slate-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-12">
            Questions? We&apos;ve Got Answers
          </h2>

          <div className="space-y-4">
            {[
              {
                q: "Is it free to enter?",
                a: "Yes! This competition is completely free for Brookfield Socials members. No entry fee."
              },
              {
                q: "Who can play?",
                a: "This competition is exclusive to paid members of the Brookfield Socials Meetup group. We need at least 10 players to run the competition. Not a member yet? Join us on Meetup!"
              },
              {
                q: "How do I join the competition?",
                a: "Download the LMS Local app, create an account, tap 'Play Competition' and enter code 4117."
              },
              {
                q: "How do I get paid if I win?",
                a: "The winner will be contacted by Andreas to arrange the £50 prize. Simple as that!"
              },
              {
                q: "What happens if I forget to make a pick?",
                a: "If you don't make a pick before the deadline, you'll be eliminated. Turn on notifications so you don't miss out!"
              },
              {
                q: "Can I pick any team?",
                a: "You can pick any Premier League team, but you can only use each team ONCE. Plan ahead!"
              },
            ].map((faq, i) => (
              <div key={i} className="bg-slate-800 rounded-xl p-6 border border-slate-700">
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
          <div className="inline-flex items-center gap-2 bg-purple-500/20 border border-purple-500/50 rounded-full px-5 py-2 mb-6">
            <UserGroupIcon className="h-5 w-5 text-purple-400" />
            <span className="text-purple-400 font-bold text-sm">Brookfield Socials Exclusive</span>
          </div>

          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Ready to Join the Fun?
          </h2>
          <p className="text-xl text-slate-400 mb-6">
            Download the app and use code <span className="text-amber-400 font-mono font-bold">4117</span> to play!
          </p>

          {/* App Store Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <a
              href="https://apps.apple.com/gb/app/lms-local/id6755344736"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white px-8 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg shadow-purple-500/25"
            >
              <span className="text-2xl"></span>
              <span>Download for iOS</span>
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=uk.co.lmslocal.lmslocal_flutter"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white px-8 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg shadow-purple-500/25"
            >
              <span className="text-2xl">▶</span>
              <span>Download for Android</span>
            </a>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-4 inline-block">
            <p className="text-slate-400 text-sm">Competition Code</p>
            <p className="text-3xl font-mono font-black text-amber-400">4117</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 py-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center">
              <TrophyIcon className="h-5 w-5 text-slate-500 mr-2" />
              <span className="text-slate-500 text-sm">LMS Local - Powered by Noodev8 Ltd</span>
            </div>
            <div className="flex gap-6">
              <Link href="/terms" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">Terms</Link>
              <Link href="/privacy" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">Privacy</Link>
              <Link href="/help" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">Help</Link>
            </div>
          </div>
          <div className="text-center mt-6">
            <p className="text-purple-400/70 text-sm mb-2">Competition run by Brookfield Socials</p>
            <div className="flex items-center justify-center gap-4 mb-3">
              <a
                href="https://www.meetup.com/brookfield-socials/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-500 hover:text-purple-400 text-sm transition-colors"
              >
                Meetup Group
              </a>
              <span className="text-slate-700">•</span>
              <a
                href="https://www.facebook.com/groups/brookfieldsocials"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-500 hover:text-purple-400 text-sm transition-colors"
              >
                Facebook Group
              </a>
            </div>
            <p className="text-slate-600 text-xs">
              &copy; 2025 LMSLocal. Platform operated by Noodev8 Ltd (Company No: 16222537)
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
