'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CheckCircleIcon, TrophyIcon } from '@heroicons/react/24/outline';

export default function PricingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem('jwt_token'));
  }, []);

  return (
    <>
      {/* Simple print styles for pricing page */}
      <style jsx global>{`
        @media print {
          /* Hide navigation elements */
          .pricing-page header,
          .pricing-page footer,
          .print\\:hidden {
            display: none !important;
          }

          /* Clean page setup */
          @page {
            margin: 1cm;
            size: A4 portrait;
          }

          /* Clean background */
          .pricing-page {
            background: white !important;
          }

          /* Remove shadows */
          .pricing-page * {
            box-shadow: none !important;
          }
        }
      `}</style>

      <div className="pricing-page min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white/95 backdrop-blur-sm shadow-sm border-b border-slate-200/50 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <Link href="/" className="flex items-center">
              <TrophyIcon className="h-8 w-8 text-slate-700 mr-2" />
              <span className="text-2xl font-bold text-slate-900">LMSLocal</span>
            </Link>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Link
                href="/help"
                className="hidden sm:block text-slate-600 hover:text-slate-900 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"
              >
                Help
              </Link>
              <Link
                href={isLoggedIn ? "/dashboard" : "/login"}
                className="bg-slate-800 hover:bg-slate-900 text-white px-4 sm:px-6 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                {isLoggedIn ? "Dashboard" : "Sign In"}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="bg-white p-8 max-w-4xl mx-auto print:p-4">
        {/* Header - visible on screen and print */}
        <div className="text-center mb-8 print:mb-4">
          <h1 className="text-4xl font-bold text-slate-900 mb-2 print:text-2xl">Pricing</h1>
          <p className="text-lg text-slate-600 print:text-sm">Start free, pay only when you grow. One-time credits, no subscriptions.</p>
        </div>

        {/* Player Credits Pricing */}
        <div className="mb-8 print:mb-4">
          <h2 className="text-2xl font-bold text-slate-900 mb-4 print:text-lg print:mb-2">Player Credits</h2>
          <p className="text-slate-600 mb-4 print:text-xs print:mb-2">Pay only for what you need, when you need it. 1 credit = 1 player slot in your competition.</p>

          <div className="border-2 border-slate-300 rounded-lg overflow-hidden print:border">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-100">
                  <th className="text-left p-4 font-semibold text-slate-900 print:p-2 print:text-xs">Package</th>
                  <th className="text-left p-4 font-semibold text-slate-900 print:p-2 print:text-xs">Credits</th>
                  <th className="text-left p-4 font-semibold text-slate-900 print:p-2 print:text-xs">Price</th>
                  <th className="hidden md:table-cell text-left p-4 font-semibold text-slate-900 print:table-cell print:p-2 print:text-xs">Savings</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-200">
                  <td className="p-4 print:p-2">
                    <div className="font-bold text-slate-900 print:text-xs">Free Tier</div>
                    <div className="text-sm text-slate-600 print:text-xs">Perfect for small groups</div>
                  </td>
                  <td className="p-4 font-semibold print:p-2 print:text-xs">20 credits</td>
                  <td className="p-4 text-2xl font-bold text-emerald-600 print:p-2 print:text-base">£0</td>
                  <td className="hidden md:table-cell p-4 text-slate-600 print:table-cell print:p-2 print:text-xs">-</td>
                </tr>
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td className="p-4 print:p-2">
                    <div className="font-bold text-slate-900 print:text-xs">Starter Pack</div>
                    <div className="text-sm text-slate-600 print:text-xs">Extra capacity as you grow</div>
                  </td>
                  <td className="p-4 font-semibold print:p-2 print:text-xs">+20 credits</td>
                  <td className="p-4 text-2xl font-bold text-slate-900 print:p-2 print:text-base">£10</td>
                  <td className="hidden md:table-cell p-4 text-slate-600 print:table-cell print:p-2 print:text-xs">-</td>
                </tr>
                <tr className="border-t border-slate-200">
                  <td className="p-4 print:p-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 print:text-xs">Popular Pack</span>
                      <span className="md:hidden inline-block bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">SAVE 20%</span>
                    </div>
                    <div className="text-sm text-slate-600 print:text-xs">For regular competitions</div>
                  </td>
                  <td className="p-4 font-semibold print:p-2 print:text-xs">+50 credits</td>
                  <td className="p-4 text-2xl font-bold text-slate-900 print:p-2 print:text-base">£20</td>
                  <td className="hidden md:table-cell p-4 print:table-cell print:p-2">
                    <span className="inline-block bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded print:text-xs">SAVE 20%</span>
                  </td>
                </tr>
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td className="p-4 print:p-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 print:text-xs">Best Value Pack</span>
                      <span className="md:hidden inline-block bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded">SAVE 33%</span>
                    </div>
                    <div className="text-sm text-slate-600 print:text-xs">For venues & busy organizers</div>
                  </td>
                  <td className="p-4 font-semibold print:p-2 print:text-xs">+120 credits</td>
                  <td className="p-4 text-2xl font-bold text-slate-900 print:p-2 print:text-base">£40</td>
                  <td className="hidden md:table-cell p-4 print:table-cell print:p-2">
                    <span className="inline-block bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded print:text-xs">SAVE 33%</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200 print:mt-2 print:p-2">
            <p className="text-sm text-slate-700 print:text-xs">
              <strong>How credits work:</strong> You always have 20 player slots for free. Each additional player slot costs 1 credit when they join.
              If the same person joins multiple competitions, each join uses 1 credit.
            </p>
          </div>
        </div>

        {/* CTA Button */}
        <div className="text-center mb-8 print:mb-4">
          <Link
            href={isLoggedIn ? "/dashboard" : "/register"}
            className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white px-12 py-4 rounded-xl text-lg font-semibold transition-colors shadow-lg print:hidden"
          >
            {isLoggedIn ? "Go to Dashboard" : "Start Free - No Credit Card Needed"}
          </Link>
          <p className="text-slate-500 mt-4 text-sm print:text-xs">
            {isLoggedIn ? "Manage your competitions and players" : "20 players free forever • Only pay if you need more"}
          </p>
        </div>

        {/* Onboarding Services */}
        <div className="mb-8 print:mb-4 border-t-2 border-slate-200 pt-6 print:pt-3">
          <h2 className="text-2xl font-bold text-slate-900 mb-4 print:text-lg print:mb-2">Onboarding Services</h2>

          <div className="grid md:grid-cols-2 gap-4 print:gap-2">
            <div className="border-2 border-slate-300 rounded-lg p-4 bg-white print:p-2 print:border">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 print:text-sm">Free Launch Package</h3>
                  <p className="text-xs text-slate-600 mt-0.5 print:text-xs">For qualified customers</p>
                </div>
                <span className="bg-emerald-600 text-white text-xs font-bold px-2 py-1 rounded print:text-xs">LIMITED</span>
              </div>
              <p className="text-2xl font-bold text-slate-900 mb-2 print:text-base">FREE <span className="text-sm text-slate-500 line-through ml-2 print:text-xs">£149</span></p>
              <ul className="space-y-1 print:space-y-0 mb-4">
                <li className="flex items-start text-sm print:text-xs">
                  <CheckCircleIcon className="h-4 w-4 text-emerald-600 mr-2 flex-shrink-0 mt-0.5 print:h-3 print:w-3" />
                  Complete competition setup
                </li>
                <li className="flex items-start text-sm print:text-xs">
                  <CheckCircleIcon className="h-4 w-4 text-emerald-600 mr-2 flex-shrink-0 mt-0.5 print:h-3 print:w-3" />
                  Fully managed for you
                </li>
                <li className="flex items-start text-sm print:text-xs">
                  <CheckCircleIcon className="h-4 w-4 text-emerald-600 mr-2 flex-shrink-0 mt-0.5 print:h-3 print:w-3" />
                  Weekly check-ins & direct support
                </li>
              </ul>
              <Link
                href="/onboarding"
                className="block w-full bg-emerald-600 hover:bg-emerald-700 text-white text-center py-2 rounded-lg text-sm font-semibold transition-colors print:hidden"
              >
                Apply Now
              </Link>
            </div>

            <div className="border-2 border-slate-200 rounded-lg p-4 bg-slate-50 print:p-2 print:border">
              <h3 className="text-lg font-bold text-slate-900 mb-2 print:text-sm">DIY Setup</h3>
              <p className="text-2xl font-bold text-slate-900 mb-2 print:text-base">FREE</p>
              <p className="text-sm text-slate-600 print:text-xs">
                Prefer to do it yourself? No problem! Set up your competition yourself for free using our simple 5-minute setup wizard.
              </p>
            </div>
          </div>
        </div>

        {/* Key Features */}
        <div className="border-t-2 border-slate-200 pt-6 print:pt-3">
          <h2 className="text-2xl font-bold text-slate-900 mb-4 print:text-lg print:mb-2">What You Get</h2>
          <div className="grid md:grid-cols-2 gap-x-6 gap-y-2 print:gap-1">
              <div className="flex items-start">
                <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 flex-shrink-0 mt-0.5 print:h-3 print:w-3" />
                <span className="text-sm print:text-xs">No credit card to start</span>
              </div>
              <div className="flex items-start">
                <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 flex-shrink-0 mt-0.5 print:h-3 print:w-3" />
                <span className="text-sm print:text-xs">No subscription fees</span>
              </div>
              <div className="flex items-start">
                <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 flex-shrink-0 mt-0.5 print:h-3 print:w-3" />
                <span className="text-sm print:text-xs">5-minute setup process</span>
              </div>
              <div className="flex items-start">
                <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 flex-shrink-0 mt-0.5 print:h-3 print:w-3" />
                <span className="text-sm print:text-xs">Promotional templates (WhatsApp, social media)</span>
              </div>
              <div className="flex items-start">
                <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 flex-shrink-0 mt-0.5 print:h-3 print:w-3" />
                <span className="text-sm print:text-xs">Add players without smartphones</span>
              </div>
              <div className="flex items-start">
                <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 flex-shrink-0 mt-0.5 print:h-3 print:w-3" />
                <span className="text-sm print:text-xs">Pay only when you grow</span>
              </div>
            </div>
        </div>

        {/* Print footer - only visible in print */}
        <div className="hidden print:block mt-4 pt-2 border-t border-slate-300 text-center text-xs text-slate-600">
          <p>LMSLocal • www.lmslocal.co.uk • Operated by Noodev8 Ltd (Company No. 16222537)</p>
        </div>
      </div>

      {/* Footer - only visible on screen */}
      <footer className="bg-slate-900 text-white py-12 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-6 lg:space-y-0">
            <div className="flex items-center">
              <TrophyIcon className="h-6 w-6 text-slate-400 mr-2" />
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
                <p>The admin-first Last Match Standing platform.</p>
                <p>Operated by Noodev8 Ltd • Company Number: 16222537</p>
                <p>3 Cumberland Place, Welshpool, SY21 7SB</p>
              </div>
            </div>
          </div>
        </div>
      </footer>
      </div>
    </>
  );
}
