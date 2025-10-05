'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PricingPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // Remove yearly toggle - now annual-only pricing

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
      router.push('/dashboard');
    } else {
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <button
                onClick={handleBackClick}
                className="flex items-center hover:opacity-80 transition-opacity"
              >
                <span className="text-xl mr-2">🏆</span>
                <span className="text-2xl font-bold text-slate-900">LMSLocal</span>
              </button>
            </div>
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors"
                >
                  Dashboard
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-slate-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-slate-900 mb-6">
            Less Than £1 Per Player
          </h1>
          <p className="text-xl text-slate-600 mb-8 max-w-3xl mx-auto">
            All features included. No subscriptions. One payment for the whole season.
          </p>

          {/* Value Props */}
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto mb-16">
            <div className="bg-white rounded-lg p-6 border border-slate-200">
              <div className="text-2xl font-bold text-slate-900 mb-2">💰 NO SUBSCRIPTIONS</div>
              <p className="text-slate-600 text-sm">One payment, no recurring charges</p>
            </div>
            <div className="bg-white rounded-lg p-6 border border-slate-200">
              <div className="text-2xl font-bold text-slate-900 mb-2">♾️ UNLIMITED</div>
              <p className="text-slate-600 text-sm">Run as many competitions as you want</p>
            </div>
            <div className="bg-white rounded-lg p-6 border border-slate-200">
              <div className="text-2xl font-bold text-slate-900 mb-2">🎯 20 FREE</div>
              <p className="text-slate-600 text-sm">Start free, upgrade when ready</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Simple, Transparent Pricing</h2>
            <p className="text-lg text-slate-600 mb-8">12 months access. All features. No subscriptions. No auto-renewal.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
            {/* Free Tier */}
            <div className="bg-white rounded-lg p-8 border-2 border-slate-200 relative">
              <div className="text-center">
                <div className="text-3xl mb-4">🎯</div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Free</h3>
                <div className="mb-2">
                  <span className="text-5xl font-bold text-slate-900">£0</span>
                  <span className="text-lg text-slate-500">/year</span>
                </div>
                <p className="text-sm text-slate-500 mb-6">Forever free</p>

                <div className="bg-slate-50 rounded-lg p-4 mb-6">
                  <div className="text-3xl font-bold text-slate-900 mb-1">20 players</div>
                  <p className="text-xs text-slate-600">Perfect for friend groups</p>
                </div>

                <ul className="space-y-3 mb-8 text-left">
                  <li className="flex items-center">
                    <span className="text-emerald-600 mr-2 text-lg">✓</span>
                    <span className="text-sm">All features included</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-emerald-600 mr-2 text-lg">✓</span>
                    <span className="text-sm">Unlimited competitions</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-emerald-600 mr-2 text-lg">✓</span>
                    <span className="text-sm">Custom branding & logos</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-emerald-600 mr-2 text-lg">✓</span>
                    <span className="text-sm">Marketing tools</span>
                  </li>
                </ul>

              </div>
            </div>

            {/* Club Tier */}
            <div className="bg-white rounded-lg p-8 border-2 border-slate-300 relative">
              <div className="text-center">
                <div className="text-3xl mb-4">🏆</div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Club</h3>
                <div className="mb-2">
                  <span className="text-5xl font-bold text-slate-900">£79</span>
                  <span className="text-lg text-slate-500">/year</span>
                </div>
                <p className="text-sm text-emerald-600 font-semibold mb-6">£1.58 per player per year</p>

                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6">
                  <div className="text-3xl font-bold text-slate-900 mb-1">50 players</div>
                  <p className="text-xs text-slate-600 mb-2">For clubs & workplaces</p>
                  <div className="pt-2 border-t border-emerald-200">
                    <p className="text-xs text-slate-700 font-medium">Split 10 ways = £7.90 each for the year</p>
                  </div>
                </div>

                <ul className="space-y-3 mb-8 text-left">
                  <li className="flex items-center">
                    <span className="text-emerald-600 mr-2 text-lg">✓</span>
                    <span className="text-sm">All features included</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-emerald-600 mr-2 text-lg">✓</span>
                    <span className="text-sm">Unlimited competitions</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-emerald-600 mr-2 text-lg">✓</span>
                    <span className="text-sm">Custom branding & logos</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-emerald-600 mr-2 text-lg">✓</span>
                    <span className="text-sm">Marketing tools</span>
                  </li>
                </ul>

              </div>
            </div>

            {/* Venue Tier - Highlighted */}
            <div className="bg-slate-900 text-white rounded-lg p-8 border-2 border-slate-700 relative transform scale-105 shadow-2xl">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-emerald-500 text-white px-4 py-1 rounded-full text-xs font-bold shadow-lg">
                  BEST VALUE
                </span>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-4">🍺</div>
                <h3 className="text-2xl font-bold mb-2">Venue</h3>
                <div className="mb-2">
                  <span className="text-5xl font-bold">£179</span>
                  <span className="text-lg text-slate-400">/year</span>
                </div>
                <p className="text-sm text-emerald-400 font-semibold mb-6">Just 90p per player per year</p>

                <div className="bg-white/10 backdrop-blur border border-white/20 rounded-lg p-4 mb-6">
                  <div className="text-3xl font-bold mb-1">200 players</div>
                  <p className="text-xs text-slate-300 mb-2">Perfect for pubs & busy venues</p>
                  <div className="pt-2 border-t border-white/20 space-y-1">
                    <p className="text-xs font-medium">Under £3.50/week for the whole year</p>
                    <p className="text-xs text-slate-400">Split 20 ways = £8.95 each</p>
                  </div>
                </div>

                <ul className="space-y-3 mb-8 text-left">
                  <li className="flex items-center">
                    <span className="text-emerald-400 mr-2 text-lg">✓</span>
                    <span className="text-sm">All features included</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-emerald-400 mr-2 text-lg">✓</span>
                    <span className="text-sm">Unlimited competitions</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-emerald-400 mr-2 text-lg">✓</span>
                    <span className="text-sm">Custom branding & logos</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-emerald-400 mr-2 text-lg">✓</span>
                    <span className="text-sm">Marketing tools</span>
                  </li>
                </ul>

              </div>
            </div>

          </div>

          {/* Value Proposition */}
          <div className="bg-gradient-to-br from-emerald-50 to-slate-50 rounded-xl p-8 max-w-4xl mx-auto border border-emerald-200">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Why Organizers Love This Pricing</h3>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl mb-2">💷</div>
                <p className="text-sm font-semibold text-slate-900 mb-1">Easy to Split</p>
                <p className="text-xs text-slate-600">Ask players to chip in £5-£10 each</p>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-2">📅</div>
                <p className="text-sm font-semibold text-slate-900 mb-1">One & Done</p>
                <p className="text-xs text-slate-600">No monthly admin or recurring bills</p>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-2">🎯</div>
                <p className="text-sm font-semibold text-slate-900 mb-1">Matches Your Season</p>
                <p className="text-xs text-slate-600">12 months covers a full football season</p>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-emerald-200 text-center">
              <p className="text-sm text-slate-700 mb-3">Need more than 200 players?</p>
              <Link
                href="mailto:hello@lmslocal.co.uk"
                className="inline-flex items-center px-6 py-2 bg-slate-800 text-white rounded-lg font-medium text-sm hover:bg-slate-900 transition-colors"
              >
                Contact us for custom pricing
              </Link>
            </div>
          </div>


        </div>
      </section>


      {/* FAQ Section */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-slate-600">Everything you need to know about our pricing</p>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg p-6 border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Is this really a one-time payment?</h3>
              <p className="text-slate-600">Yes! Pay once for 12 months of access. No subscriptions, no auto-renewal, no recurring charges. When your 12 months are up, your account reverts to the Free tier.</p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Can I try before I pay?</h3>
              <p className="text-slate-600">Absolutely! Start with the Free tier - it includes all features with up to 20 players. Test everything, run real competitions, then upgrade when you need more players.</p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">What happens if I get more players than my limit?</h3>
              <p className="text-slate-600">You can upgrade to the next tier anytime - we&apos;ll pro-rate the difference. Need more than 200 players? Contact us for custom enterprise pricing.</p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Can players help pay for it?</h3>
              <p className="text-slate-600">Many organizers ask players to chip in £5-£10 each, which easily covers the annual cost. With 20 players contributing £10 each, you&apos;ve covered the Venue tier with room to spare!</p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Do I get all features in every tier?</h3>
              <p className="text-slate-600">Yes! Free, Club, and Venue tiers all include the exact same features - unlimited competitions, custom branding, marketing tools. Only the player limits differ.</p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Can you manage my competition for me?</h3>
              <p className="text-slate-600">Yes! We offer full-service management including invites, fixtures, results tracking, and customer support. Contact us for pricing.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-slate-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            Join organizers running professional Last Man Standing competitions with LMSLocal
          </p>

          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 mb-8 max-w-2xl mx-auto">
            <p className="text-slate-800 font-semibold text-lg mb-2">
              🎯 Start Free with 20 Players
            </p>
            <p className="text-slate-600 text-sm">
              Test all features • No credit card • Upgrade anytime
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Link
              href="/register"
              className="bg-white text-slate-800 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-slate-100 transition-colors shadow-lg"
            >
              Start Free Today
            </Link>
            <Link
              href="/help/how-to-play"
              className="text-slate-300 hover:text-white px-8 py-4 rounded-lg font-semibold text-lg border-2 border-slate-600 hover:bg-slate-700 transition-all"
            >
              Learn How It Works
            </Link>
          </div>

          <p className="text-slate-400 text-sm">
            Free tier includes all features • 5 minute setup • Upgrade when you need more players
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12 border-t border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-6 lg:space-y-0">
            <div className="flex items-center">
              <span className="text-xl mr-2">🏆</span>
              <span className="text-xl font-bold">LMSLocal</span>
            </div>

            <div className="flex flex-col lg:flex-row items-start lg:items-center space-y-4 lg:space-y-0 lg:space-x-8">
              <div className="flex space-x-6">
                <Link href="/terms" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Terms of Service
                </Link>
                <Link href="/privacy" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Privacy Policy
                </Link>
                <Link href="/help" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Help Center
                </Link>
              </div>

              <div className="text-sm text-slate-400 space-y-1">
                <p>&copy; 2025 LMSLocal. All rights reserved.</p>
                <p>The admin-first Last Man Standing platform.</p>
                <p>Operated by Noodev8 Ltd • Company Number: 16222537</p>
                <p>3 Cumberland Place, Welshpool, SY21 7SB</p>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}