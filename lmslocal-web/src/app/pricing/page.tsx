'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircleIcon, TrophyIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function PricingPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const pricing = [
    {
      name: 'Free',
      price: '£0',
      period: 'Beta Access',
      description: 'Perfect for getting started',
      features: [
        'Unlimited players during beta',
        'Full competition management',
        'Real-time updates',
        'Premier League teams included',
        'Email support',
      ],
      cta: 'Start Free',
      highlighted: false,
      badge: 'BETA',
    },
    {
      name: 'Professional',
      price: '£19',
      period: 'per month',
      description: 'Everything you need to run competitions',
      features: [
        'Everything in Free',
        'Priority support',
        'Advanced player management',
        'Custom competition branding',
        'Your venue/company logo',
        'Analytics dashboard (coming soon)',
        'Export competition data',
        'Run unlimited competitions',
        'Custom competition URL slug',
      ],
      cta: 'Coming Soon',
      highlighted: true,
      savings: 'Save £89 with annual plan (£139/year)',
      comingSoon: true,
    },
  ];

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
                href="/help/how-to-play"
                className="text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"
              >
                Game Rules
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
            Simple, Fair Pricing
          </h1>
          <p className="text-xl text-slate-600 mb-12 max-w-3xl mx-auto">
            Start free and only pay for what you need as your competition grows. No hidden fees, no surprises.
          </p>

          {/* Beta Launch Benefits */}
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto mb-16">
            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50 shadow-sm">
              <div className="text-2xl font-bold text-emerald-600 mb-2">FREE</div>
              <p className="text-slate-600 text-sm">During beta period</p>
            </div>
            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50 shadow-sm">
              <div className="text-2xl font-bold text-slate-800 mb-2">UNLIMITED</div>
              <p className="text-slate-600 text-sm">Players per competition</p>
            </div>
            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50 shadow-sm">
              <div className="text-2xl font-bold text-slate-800 mb-2">NO CARD</div>
              <p className="text-slate-600 text-sm">Required to start</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {pricing.map((plan, index) => (
              <div
                key={index}
                className={`relative rounded-xl p-8 border ${
                  plan.highlighted
                    ? 'bg-slate-800 text-white border-slate-700 shadow-xl transform scale-105'
                    : 'bg-white text-slate-900 border-slate-200 shadow-sm'
                }`}
              >
                {plan.badge && (
                  <div className="absolute top-4 right-4">
                    <span className="bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                      {plan.badge}
                    </span>
                  </div>
                )}
                {plan.comingSoon && (
                  <div className="absolute top-4 right-4">
                    <span className="bg-amber-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                      COMING SOON
                    </span>
                  </div>
                )}
                <div className="text-center">
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className={`text-sm ${plan.highlighted ? 'text-slate-300' : 'text-slate-500'}`}>
                      /{plan.period}
                    </span>
                  </div>
                  <p className={`mb-6 ${plan.highlighted ? 'text-slate-300' : 'text-slate-600'}`}>
                    {plan.description}
                  </p>

                  {plan.savings && (
                    <div className={`mb-6 p-3 rounded-lg ${plan.highlighted ? 'bg-slate-700' : 'bg-emerald-50 border border-emerald-200'}`}>
                      <p className={`text-sm font-medium ${plan.highlighted ? 'text-slate-300' : 'text-emerald-700'}`}>
                        💰 {plan.savings}
                      </p>
                    </div>
                  )}

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center">
                        <CheckCircleIcon className={`h-5 w-5 mr-2 flex-shrink-0 ${plan.highlighted ? 'text-emerald-400' : 'text-emerald-600'}`} />
                        <span className="text-sm text-left">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {plan.comingSoon ? (
                    <div className={`block w-full py-3 px-4 rounded-lg font-semibold text-center ${
                      plan.highlighted
                        ? 'bg-slate-700 text-slate-300 cursor-not-allowed'
                        : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                    }`}>
                      {plan.cta}
                    </div>
                  ) : (
                    <Link
                      href="/register"
                      className={`block w-full py-3 px-4 rounded-lg font-semibold text-center transition-all duration-200 ${
                        plan.highlighted
                          ? 'bg-white text-slate-800 hover:bg-slate-100'
                          : 'bg-slate-800 text-white hover:bg-slate-900'
                      }`}
                    >
                      {plan.cta}
                    </Link>
                  )}
                </div>
              </div>
            ))}
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

          <div className="space-y-8">
            <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">How long is the beta period?</h3>
              <p className="text-slate-600">The beta period will run until we launch our Professional plan features. We&apos;ll give all beta users at least 30 days notice before any charges begin.</p>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">What happens when I upgrade to Professional?</h3>
              <p className="text-slate-600">You&apos;ll keep all your existing competitions and data. Professional features will be added to your account, and you&apos;ll be charged monthly from your upgrade date.</p>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Can I cancel anytime?</h3>
              <p className="text-slate-600">Yes! You can cancel your Professional subscription at any time. Your competitions will continue to run until the end of your billing period, then revert to Free plan limits.</p>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Do you offer refunds?</h3>
              <p className="text-slate-600">We offer a 14-day money-back guarantee for Professional subscriptions. If you&apos;re not happy, we&apos;ll refund your payment, no questions asked.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            Join thousands of competition organizers who trust LMSLocal
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Link
              href="/register"
              className="bg-white text-slate-800 px-8 py-4 rounded-xl font-semibold text-lg transition-colors shadow-sm hover:bg-slate-100"
            >
              Start Free Today
            </Link>
            <Link
              href="/game-rules"
              className="text-slate-300 hover:text-white px-8 py-4 rounded-xl font-semibold text-lg border-2 border-slate-600 hover:bg-slate-700 transition-all"
            >
              Learn the Rules
            </Link>
          </div>

          <p className="text-slate-400">
            Free during beta • No credit card required • 5 minute setup
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