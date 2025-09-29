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
              {!isAuthenticated && (
                <button
                  onClick={handleBackClick}
                  className="flex items-center text-slate-600 hover:text-slate-900 mr-4 transition-colors"
                >
                  <span className="mr-2">←</span>
                  Back
                </button>
              )}
              <span className="text-xl mr-2">🏆</span>
              <span className="text-2xl font-bold text-slate-900">LMSLocal</span>
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
            Start Free, Scale as You Grow
          </h1>
          <p className="text-xl text-slate-600 mb-8 max-w-3xl mx-auto">
            Simple player-based pricing for Last Man Standing competitions. All features included, only player limits differ.
          </p>

          {/* Beta Notice */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-12 max-w-2xl mx-auto">
            <div className="flex items-center justify-center">
              <span className="bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold mr-3">NEW</span>
              <p className="text-emerald-800 font-medium">
                All features available to everyone - pay only for more players as you grow
              </p>
            </div>
          </div>

          {/* Key Benefits */}
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto mb-16">
            <div className="bg-white rounded-lg p-6 border border-slate-200">
              <div className="text-2xl font-bold text-slate-900 mb-2">🎯 LITE TIER</div>
              <p className="text-slate-600 text-sm">Perfect for small groups</p>
            </div>
            <div className="bg-white rounded-lg p-6 border border-slate-200">
              <div className="text-2xl font-bold text-slate-900 mb-2">♾️ UNLIMITED</div>
              <p className="text-slate-600 text-sm">Competitions in all tiers</p>
            </div>
            <div className="bg-white rounded-lg p-6 border border-slate-200">
              <div className="text-2xl font-bold text-slate-900 mb-2">💳 NO CARD</div>
              <p className="text-slate-600 text-sm">Required to start</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Simple One-Time Pricing</h2>

            {/* One-Time Payment Notice */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-8 max-w-2xl mx-auto">
              <div className="flex items-center justify-center">
                <span className="text-2xl mr-3">💰</span>
                <p className="text-emerald-800 font-medium">
                  12 months access. All features. No subscriptions, no auto-renewal, no recurring charges
                </p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
            {/* Lite Plan */}
            <div className="bg-white rounded-lg p-8 border border-slate-200 relative">
              <div className="text-center">
                <div className="text-2xl mb-4">🎯</div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Lite</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-slate-900">£0</span>
                  <span className="text-sm text-slate-500">/year</span>
                </div>
                <p className="text-slate-600 mb-6">Perfect for friend groups</p>

                <ul className="space-y-3 mb-8 text-left">
                  <li className="flex items-center">
                    <span className="text-green-600 mr-2">✓</span>
                    <span className="text-sm font-medium">Up to 20 players</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-600 mr-2">✓</span>
                    <span className="text-sm">Full access to all features</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-600 mr-2">✓</span>
                    <span className="text-sm">Unlimited competitions</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-600 mr-2">✓</span>
                    <span className="text-sm">Custom branding & logos</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-600 mr-2">✓</span>
                    <span className="text-sm">Posts and marketing to your customers</span>
                  </li>
                </ul>

                <Link
                  href="/register"
                  className="block w-full py-3 px-4 bg-slate-800 text-white rounded-lg font-semibold text-center hover:bg-slate-900 transition-colors"
                >
                  Start Lite
                </Link>
              </div>
            </div>

            {/* Starter Plan - Highlighted */}
            <div className="bg-slate-900 text-white rounded-lg p-8 border border-slate-700 relative transform scale-105 shadow-xl">
              <div className="absolute top-4 right-4">
                <span className="bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                  MOST POPULAR
                </span>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-4">🚀</div>
                <h3 className="text-2xl font-bold mb-2">Starter</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold">£199</span>
                  <span className="text-sm text-slate-300">/year</span>
                </div>
                <p className="text-slate-300 mb-6">For bigger groups, pubs & workplaces</p>

                <ul className="space-y-3 mb-8 text-left">
                  <li className="flex items-center">
                    <span className="text-emerald-400 mr-2">✓</span>
                    <span className="text-sm font-medium">Up to 100 players</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-emerald-400 mr-2">✓</span>
                    <span className="text-sm">Full access to all features</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-emerald-400 mr-2">✓</span>
                    <span className="text-sm">Unlimited competitions</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-emerald-400 mr-2">✓</span>
                    <span className="text-sm">Custom branding & logos</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-emerald-400 mr-2">✓</span>
                    <span className="text-sm">Posts and marketing to your customers</span>
                  </li>
                </ul>

                <Link
                  href="/register"
                  className="block w-full py-3 px-4 bg-white text-slate-800 rounded-lg font-semibold text-center hover:bg-slate-100 transition-colors"
                >
                  Start Starter
                </Link>
              </div>
            </div>

            {/* Pro Plan */}
            <div className="bg-white rounded-lg p-8 border border-slate-200 relative">
              <div className="text-center">
                <div className="text-2xl mb-4">🏢</div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Pro</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-slate-900">£249</span>
                  <span className="text-sm text-slate-500">/year</span>
                </div>
                <p className="text-slate-600 mb-6">For large venues & organizations</p>

                <ul className="space-y-3 mb-8 text-left">
                  <li className="flex items-center">
                    <span className="text-green-600 mr-2">✓</span>
                    <span className="text-sm font-medium">Up to 300 players</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-600 mr-2">✓</span>
                    <span className="text-sm">Full access to all features</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-600 mr-2">✓</span>
                    <span className="text-sm">Unlimited competitions</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-600 mr-2">✓</span>
                    <span className="text-sm">Custom branding & logos</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-600 mr-2">✓</span>
                    <span className="text-sm">Posts and marketing to your customers</span>
                  </li>
                </ul>

                <Link
                  href="/register"
                  className="block w-full py-3 px-4 bg-slate-800 text-white rounded-lg font-semibold text-center hover:bg-slate-900 transition-colors"
                >
                  Start Pro
                </Link>
              </div>
            </div>

          </div>

          {/* Enterprise Section - Compact */}
          <div className="bg-slate-50 rounded-lg p-6 max-w-2xl mx-auto">
            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-900 mb-2">Need More Than 300 Players?</h3>
              <p className="text-slate-600 text-sm mb-4">Enterprise pricing available - contact us for custom solutions</p>
              <Link
                href="mailto:hello@lmslocal.co.uk"
                className="inline-flex items-center px-6 py-2 bg-purple-600 text-white rounded-lg font-medium text-sm hover:bg-purple-700 transition-colors"
              >
                Contact Sales
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
              <h3 className="text-lg font-semibold text-slate-900 mb-3">What happens when I hit my player limit?</h3>
              <p className="text-slate-600">You can upgrade to the next tier anytime, or contact us for custom pricing if you need more than 500 players.</p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Can I cancel anytime?</h3>
              <p className="text-slate-600">Yes! You can cancel your paid subscription at any time. Your competitions continue until the end of your billing period, then revert to Lite plan limits.</p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Can I try before I pay?</h3>
              <p className="text-slate-600">Yes! Start with our Lite plan to test all features with up to 10 players. When you&apos;re ready to scale, upgrade to a paid plan for more players.</p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">What&apos;s included in the marketing toolkit?</h3>
              <p className="text-slate-600">We currently offer custom branding and logos. We&apos;re planning to add QR codes for easy joining, social media sharing templates, and email invitation tools.</p>
            </div>


            <div className="bg-white rounded-lg p-6 border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Can I change plans later?</h3>
              <p className="text-slate-600">Absolutely! Upgrade anytime to unlock more features. Downgrades take effect at your next billing cycle.</p>
            </div>

            <div className="bg-white rounded-lg p-6 border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Can you manage the game for me?</h3>
              <p className="text-slate-600">Yes! Contact us for pricing and we will take care of the invites, fixtures, results and general management of a competition for you.</p>
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
            Join competition organisers who trust LMSLocal to run their Last Man Standing games
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Link
              href="/register"
              className="bg-white text-slate-800 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-slate-100 transition-colors"
            >
              Start Lite Today
            </Link>
            <Link
              href="/help/how-to-play"
              className="text-slate-300 hover:text-white px-8 py-4 rounded-lg font-semibold text-lg border-2 border-slate-600 hover:bg-slate-700 transition-all"
            >
              Learn the Rules
            </Link>
          </div>

          <p className="text-slate-400">
            Lite plan • No credit card required • 5 minute setup
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