'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PricingPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isYearly, setIsYearly] = useState(false);

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
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Simple Player-Based Pricing</h2>
            <p className="text-xl text-slate-600 mb-8">Everyone gets full access to all features - only player limits differ</p>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center mb-8">
              <span className={`mr-3 ${!isYearly ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>Monthly</span>
              <button
                onClick={() => setIsYearly(!isYearly)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isYearly ? 'bg-slate-900' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isYearly ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`ml-3 ${isYearly ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>
                Yearly
                <span className="ml-1 text-emerald-600 font-bold text-sm">(4 months free)</span>
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Lite Plan */}
            <div className="bg-white rounded-lg p-8 border border-slate-200 relative">
              <div className="text-center">
                <div className="text-2xl mb-4">🎯</div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Lite</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-slate-900">£0</span>
                  <span className="text-sm text-slate-500">/{isYearly ? 'year' : 'month'}</span>
                </div>
                <p className="text-slate-600 mb-6">Perfect for friend groups</p>

                <ul className="space-y-3 mb-8 text-left">
                  <li className="flex items-center">
                    <span className="text-green-600 mr-2">✓</span>
                    <span className="text-sm font-medium">Up to 10 players</span>
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
                  <span className="text-4xl font-bold">£{isYearly ? '232' : '29'}</span>
                  <span className="text-sm text-slate-300">/{isYearly ? 'year' : 'month'}</span>
                  {isYearly && (
                    <div className="text-sm text-emerald-400 mt-1">
                      £19.33/month
                    </div>
                  )}
                </div>
                <p className="text-slate-300 mb-6">For bigger groups, pubs & workplaces</p>

                <ul className="space-y-3 mb-8 text-left">
                  <li className="flex items-center">
                    <span className="text-emerald-400 mr-2">✓</span>
                    <span className="text-sm font-medium">Up to 50 players</span>
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
                  <span className="text-4xl font-bold text-slate-900">£{isYearly ? '632' : '79'}</span>
                  <span className="text-sm text-slate-500">/{isYearly ? 'year' : 'month'}</span>
                  {isYearly && (
                    <div className="text-sm text-emerald-600 mt-1">
                      £52.67/month
                    </div>
                  )}
                </div>
                <p className="text-slate-600 mb-6">For large venues & organizations</p>

                <ul className="space-y-3 mb-8 text-left">
                  <li className="flex items-center">
                    <span className="text-green-600 mr-2">✓</span>
                    <span className="text-sm font-medium">Up to 500 players</span>
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

          {/* Value Comparison Section */}
          <div className="bg-slate-50 rounded-xl p-8 mt-16 mb-12">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4">More Cost-Effective Than Traditional Marketing</h3>
              <p className="text-slate-600">For pubs, sports groups and organisations - compare the cost per person reached with LMSLocal vs paid advertising</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* 50 People Starter */}
              <div className="bg-white rounded-lg p-6 border border-slate-200">
                <h4 className="text-lg font-semibold text-slate-900 mb-4">Small Venues (50 People)</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">LMSLocal (Starter Annual)</span>
                    <span className="font-semibold text-emerald-600">£4.64 per person/year</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Facebook Ads (annual)</span>
                    <span className="font-semibold text-slate-500">£20-40 per person</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Google Ads (annual)</span>
                    <span className="font-semibold text-slate-500">£30-60 per person</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-sm text-emerald-700 font-medium">Save £15-55 per person vs PPC!</p>
                  <p className="text-xs text-slate-500 mt-1">Total savings: £750-2,750 annually</p>
                </div>
              </div>

              {/* 500 People Pro */}
              <div className="bg-white rounded-lg p-6 border border-slate-200">
                <h4 className="text-lg font-semibold text-slate-900 mb-4">Large Venues (500 People)</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">LMSLocal (Pro Annual)</span>
                    <span className="font-semibold text-emerald-600">£1.26 per person/year</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Facebook Ads (annual)</span>
                    <span className="font-semibold text-slate-500">£15-35 per person</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Google Ads (annual)</span>
                    <span className="font-semibold text-slate-500">£25-50 per person</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-sm text-emerald-700 font-medium">Save £13-49 per person vs PPC!</p>
                  <p className="text-xs text-slate-500 mt-1">Total savings: £6,500-24,500 annually</p>
                </div>
              </div>
            </div>

            <div className="text-center mt-8">
              <p className="text-sm text-slate-600">
                <strong>Plus:</strong> Unlike ads that disappear, your competition creates lasting engagement and word-of-mouth marketing
              </p>
            </div>
          </div>

          {/* Combined Future & Custom Pricing */}
          <div className="bg-white rounded-lg p-8 border border-slate-200 mb-12 max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-semibold text-slate-900 mb-3">Shaping the Future Together</h3>
              <p className="text-slate-600 mb-6">
                Additional features are developed based on customer feedback to enhance marketing and user engagement.
                Your input drives our roadmap.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-8">
              {/* Feature Requests */}
              <div className="text-center">
                <h4 className="text-lg font-semibold text-slate-900 mb-3">💡 Got Ideas?</h4>
                <p className="text-slate-600">
                  Help us build features that enhance your competitions and marketing efforts.
                </p>
              </div>

              {/* Custom Pricing */}
              <div className="text-center">
                <h4 className="text-lg font-semibold text-slate-900 mb-3">🚀 Need More?</h4>
                <p className="text-slate-600">
                  <strong>Need more than 500 players, or have any questions?</strong>
                </p>
              </div>
            </div>

            <div className="text-center">
              <Link
                href="mailto:noodev8@gmail.com?subject=Let's discuss your needs"
                className="inline-flex items-center px-8 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium mb-3"
              >
                Get in touch via email
              </Link>
              <p className="text-slate-600 text-sm">
                Or contact Andreas directly on <a href="tel:+447818443886" className="text-slate-900 font-medium hover:underline">07818 443886</a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Business Opportunity Section */}
      <section className="py-20 bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Turn Your Passion Into Purpose
            </h2>
            <p className="text-xl text-slate-300 max-w-3xl mx-auto">
              Create sustainable revenue streams while supporting good causes. LMSLocal isn&apos;t just a platform - it&apos;s a business opportunity.
            </p>
          </div>

          <div className="bg-white rounded-xl p-8 mb-12 max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4">The Numbers That Matter</h3>
              <p className="text-slate-600 mb-6">
                Example: £10 entry fee • 50% to charity • 50% to winners
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* 100 Players */}
              <div className="text-center p-6 bg-slate-50 rounded-lg">
                <div className="text-3xl font-bold text-slate-900 mb-2">100 Players</div>
                <div className="space-y-2 text-sm">
                  <p className="text-slate-600">Total Revenue: <span className="font-semibold text-slate-900">£1,000</span></p>
                  <p className="text-emerald-600">Charity Impact: <span className="font-semibold">£500</span></p>
                  <p className="text-slate-600">Prize Pool: <span className="font-semibold text-slate-900">£500</span></p>
                </div>
              </div>

              {/* 500 Players */}
              <div className="text-center p-6 bg-slate-50 rounded-lg border-2 border-slate-900">
                <div className="text-3xl font-bold text-slate-900 mb-2">500 Players</div>
                <div className="space-y-2 text-sm">
                  <p className="text-slate-600">Total Revenue: <span className="font-semibold text-slate-900">£5,000</span></p>
                  <p className="text-emerald-600">Charity Impact: <span className="font-semibold">£2,500</span></p>
                  <p className="text-slate-600">Prize Pool: <span className="font-semibold text-slate-900">£2,500</span></p>
                </div>
              </div>

              {/* 1000 Players */}
              <div className="text-center p-6 bg-slate-50 rounded-lg">
                <div className="text-3xl font-bold text-slate-900 mb-2">1,000 Players</div>
                <div className="space-y-2 text-sm">
                  <p className="text-slate-600">Total Revenue: <span className="font-semibold text-slate-900">£10,000</span></p>
                  <p className="text-emerald-600">Charity Impact: <span className="font-semibold">£5,000</span></p>
                  <p className="text-slate-600">Prize Pool: <span className="font-semibold text-slate-900">£5,000</span></p>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center">
              <p className="text-slate-600 mb-4">
                <strong>Scale this across multiple competitions per year...</strong> The potential is enormous.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 max-w-3xl mx-auto">
                <p className="text-amber-800 text-sm">
                  <strong>Important:</strong> Depending on your specific model and jurisdiction, you may need a gambling license.
                  Always consult legal advice for compliance. However, many charity and prize-based models operate within existing frameworks.
                </p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto">
            {/* Fundraising */}
            <div className="text-center">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-2xl font-bold text-white mb-4">Fundraising Powerhouse</h3>
              <p className="text-slate-300 mb-6">
                Transform traditional fundraising with engaging competitions. Higher participation rates,
                recurring revenue, and genuine community engagement.
              </p>
              <ul className="text-left text-slate-300 space-y-2">
                <li>• Corporate sponsorship opportunities</li>
                <li>• Monthly recurring competitions</li>
                <li>• Built-in social sharing and growth</li>
                <li>• Transparent, automated prize distribution</li>
              </ul>
            </div>

            {/* Business Building */}
            <div className="text-center">
              <div className="text-4xl mb-4">🚀</div>
              <h3 className="text-2xl font-bold text-white mb-4">Build Your Business</h3>
              <p className="text-slate-300 mb-6">
                Create sustainable income streams with scalable competition formats.
                Perfect for entrepreneurs, venues, and organizations looking to grow.
              </p>
              <ul className="text-left text-slate-300 space-y-2">
                <li>• Multiple revenue models supported</li>
                <li>• Minimal operational overhead</li>
                <li>• Built-in customer retention</li>
                <li>• Professional branding and management tools</li>
              </ul>
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