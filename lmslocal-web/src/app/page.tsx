'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircleIcon, TrophyIcon, UsersIcon, ClockIcon, StarIcon, SparklesIcon } from '@heroicons/react/24/outline';

export default function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Check if user is logged in (for showing Dashboard button)
  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    const userData = localStorage.getItem('user');

    if (token && userData && userData !== 'undefined' && userData !== 'null') {
      try {
        JSON.parse(userData);
        setIsLoggedIn(true);
      } catch {
        // Invalid user data, clear everything
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('user');
        setIsLoggedIn(false);
      }
    }
  }, []);
  const features = [
    {
      title: '5-Minute Setup',
      description: 'Get your Last Man Standing competition running in minutes, not hours.',
      icon: ClockIcon,
    },
    {
      title: 'Admin-First Design',
      description: 'Built for pub landlords and organisers who need simple, powerful management tools.',
      icon: TrophyIcon,
    },
    {
      title: 'Player Management',
      description: 'Add players who don\'t have smartphones. Perfect for pub customers and offline participants.',
      icon: UsersIcon,
    },
    {
      title: 'Clear Visual Displays',
      description: 'Beautiful standings and results that everyone can understand at a glance. Perfect for pub TV screens.',
      icon: CheckCircleIcon,
    },
  ];


  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-sm shadow-sm border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <TrophyIcon className="h-8 w-8 text-slate-700 mr-2" />
              <span className="text-2xl font-bold text-slate-900">LMSLocal</span>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Link
                href="/help"
                className="hidden sm:block text-slate-600 hover:text-slate-900 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"
              >
                Help
              </Link>
              {isLoggedIn ? (
                <Link
                  href="/dashboard"
                  className="bg-slate-800 hover:bg-slate-900 text-white px-4 sm:px-6 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
                >
                  Dashboard
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="bg-slate-800 hover:bg-slate-900 text-white px-4 sm:px-6 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Limited Time Onboarding Banner */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 py-3 border-b-4 border-emerald-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-center gap-3 text-center md:text-left">
            <div className="flex items-center">
              <SparklesIcon className="h-5 w-5 text-white mr-2" />
              <span className="text-white font-bold">Limited Offer:</span>
              <span className="text-emerald-100 ml-2">FREE Done-For-You Setup</span>
            </div>
            <Link
              href="/onboarding"
              className="bg-white text-emerald-700 px-6 py-2 rounded-lg font-bold text-sm hover:bg-emerald-50 transition-colors shadow-md inline-flex items-center"
            >
              Get Free Onboarding
              <span className="ml-2">→</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-slate-100 via-slate-50 to-stone-100 py-8 md:py-16 lg:py-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Splitdine-style Hero with Image */}
          <div className="mb-8 md:mb-12 lg:mb-16">
            {/* Headline First */}
            <div className="text-center lg:text-left mb-4 md:mb-6 lg:mb-8">
              <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold text-slate-900 mb-2 md:mb-3 lg:mb-4 leading-tight">
                Last Match <span className="text-emerald-600">Standing</span>
              </h1>
              <div className="inline-block bg-emerald-100 border-2 border-emerald-500 rounded-full px-4 py-2 mt-2">
                <p className="text-emerald-800 font-bold text-sm">Play FREE • No Credit Card • No Subscription</p>
              </div>
            </div>

            {/* Grid for Image and Content */}
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              {/* Left Side - Description and Buttons */}
              <div>
                <p className="text-lg md:text-xl lg:text-2xl text-slate-600 mb-2">
                  — For Pubs, Organisers & Groups of Friends
                </p>
                <p className="text-base md:text-lg text-slate-600 mb-6 max-w-xl">
                  Run your Last Man Standing competition with zero hassle. No spreadsheets, no manual tracking. Perfect for pub landlords, workplace organisers, and friend groups.
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                  <Link
                    href="/register"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-semibold text-base transition-colors shadow-sm text-center"
                  >
                    Start Free Competition
                  </Link>
                  <Link
                    href="/onboarding"
                    className="bg-white hover:bg-slate-50 text-emerald-700 px-6 py-3 rounded-xl font-semibold text-base border-2 border-emerald-600 hover:border-emerald-700 transition-all text-center inline-flex items-center justify-center"
                  >
                    <SparklesIcon className="h-5 w-5 mr-2" />
                    Get Free Setup Help
                  </Link>
                  <Link
                    href="/login"
                    className="text-slate-700 hover:text-slate-900 px-6 py-3 rounded-xl font-semibold text-base border-2 border-slate-300 hover:bg-slate-100 transition-all text-center"
                  >
                    Join Competition
                  </Link>
                </div>
                <p className="text-sm text-slate-500 italic">No credit card required • Up to 20 players completely free</p>
              </div>

              {/* Right Side - Dashboard Preview Image */}
              <div className="relative flex justify-center items-center">
                <div className="relative transform rotate-3 lg:rotate-6 hover:rotate-2 lg:hover:rotate-3 transition-transform duration-300">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-slate-600/20 rounded-3xl blur-2xl"></div>
                  <Image
                    src="/dashboard-preview.jpg"
                    alt="LMSLocal Dashboard Preview"
                    width={1200}
                    height={200}
                    className="relative w-full max-w-xs lg:max-w-md rounded-2xl shadow-2xl border-4 border-white"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Testimonials */}
          <div className="max-w-6xl mx-auto mt-16">
            <div className="grid md:grid-cols-3 gap-6">
              {/* Testimonial 1 */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <div className="flex space-x-1 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <StarIcon key={i} className="h-5 w-5 text-amber-400 fill-current" />
                  ))}
                </div>
                <p className="text-slate-700 mb-4 italic">
                  &quot;Perfect for our pub! Customers love it and it&apos;s completely free for small groups.&quot;
                </p>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mr-3">
                    <span className="text-emerald-700 font-bold text-sm">M</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">Mike J.</p>
                    <p className="text-slate-500 text-xs">Pub Landlord</p>
                  </div>
                </div>
              </div>

              {/* Testimonial 2 */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <div className="flex space-x-1 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <StarIcon key={i} className="h-5 w-5 text-amber-400 fill-current" />
                  ))}
                </div>
                <p className="text-slate-700 mb-4 italic">
                  &quot;Running our work competition has never been easier. Set up in minutes!&quot;
                </p>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mr-3">
                    <span className="text-slate-700 font-bold text-sm">S</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">Sarah M.</p>
                    <p className="text-slate-500 text-xs">Workplace Organiser</p>
                  </div>
                </div>
              </div>

              {/* Testimonial 3 */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <div className="flex space-x-1 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <StarIcon key={i} className="h-5 w-5 text-amber-400 fill-current" />
                  ))}
                </div>
                <p className="text-slate-700 mb-4 italic">
                  &quot;Me and my mates use this every season. Free, simple, no hassle.&quot;
                </p>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mr-3">
                    <span className="text-slate-700 font-bold text-sm">J</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">James R.</p>
                    <p className="text-slate-500 text-xs">Group of Friends</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What Makes Us Different */}
      <section className="py-20 bg-slate-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Perfect For Your Audience
            </h2>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Whether you&apos;re running a pub competition, workplace pool, or friendly bet
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Pubs */}
            <div className="bg-white bg-opacity-10 rounded-xl p-6 backdrop-blur">
              <h3 className="text-2xl font-bold text-center mb-4">🍺 Pubs & Bars</h3>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <CheckCircleIcon className="h-6 w-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-300">Free for up to 20 players</p>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircleIcon className="h-6 w-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-300">Add offline players (no smartphone needed)</p>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircleIcon className="h-6 w-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-300">Display on pub TV screens</p>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircleIcon className="h-6 w-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-300">Engage customers every matchday</p>
                </div>
              </div>
            </div>

            {/* Organisers */}
            <div className="bg-white bg-opacity-10 rounded-xl p-6 backdrop-blur">
              <h3 className="text-2xl font-bold text-center mb-4">💼 Organisers</h3>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <CheckCircleIcon className="h-6 w-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-300">No credit card to start</p>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircleIcon className="h-6 w-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-300">5-minute setup process</p>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircleIcon className="h-6 w-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-300">Automated fixtures & results</p>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircleIcon className="h-6 w-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-300">Handle 100s of players easily</p>
                </div>
              </div>
            </div>

            {/* Friends */}
            <div className="bg-white bg-opacity-10 rounded-xl p-6 backdrop-blur">
              <h3 className="text-2xl font-bold text-center mb-4">👥 Friend Groups</h3>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <CheckCircleIcon className="h-6 w-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-300">100% free for small groups</p>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircleIcon className="h-6 w-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-300">No subscriptions or hidden fees</p>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircleIcon className="h-6 w-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-300">Simple join code to share</p>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircleIcon className="h-6 w-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-300">Track who&apos;s top of the league</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Everything You Need, Nothing You Don&apos;t
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Simple, powerful tools that work for everyone - from small friend groups to busy pubs
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="text-center p-6 rounded-lg hover:shadow-lg transition-shadow duration-200 bg-slate-50 border border-slate-200">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-lg mb-4">
                    <Icon className="h-8 w-8 text-slate-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">{feature.title}</h3>
                  <p className="text-slate-600">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Simple, Fair Pricing
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Start free, pay only when you grow. One-time credits, no subscriptions.
            </p>
          </div>

          {/* Onboarding Services */}
          <div className="mb-16">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Onboarding Services</h3>
              <p className="text-slate-600">Need help getting started? We&apos;ve got you covered.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-8">
              {/* Free Launch Package (Limited) */}
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl p-8 shadow-lg border-2 border-emerald-500 relative">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-emerald-600 text-white text-sm font-bold px-6 py-2 rounded-full shadow-lg inline-flex items-center">
                    <SparklesIcon className="h-4 w-4 mr-2" />
                    LIMITED TIME
                  </span>
                </div>
                <div className="text-center mt-4">
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">Free Launch Package</h3>
                  <p className="text-slate-600 text-sm mb-6">Limited availability</p>
                  <div className="mb-6">
                    <span className="text-5xl font-bold text-slate-900">FREE</span>
                    <p className="text-slate-500 line-through text-lg mt-1">Normally £149</p>
                  </div>
                  <ul className="text-left space-y-3 mb-6">
                    <li className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700 text-sm">Complete competition setup</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700 text-sm">Support through first full competition</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700 text-sm">Weekly check-ins & direct support</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700 text-sm">Custom promotional materials (coming soon)</span>
                    </li>
                  </ul>
                  <Link
                    href="/onboarding"
                    className="block w-full bg-emerald-600 hover:bg-emerald-700 text-white text-center py-3 rounded-lg font-semibold transition-colors shadow-md"
                  >
                    Apply Now
                  </Link>
                </div>
              </div>

              {/* Paid Launch Package */}
              <div className="bg-white rounded-2xl p-8 shadow-lg border-2 border-slate-200">
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">Launch Package</h3>
                  <p className="text-slate-600 text-sm mb-6">After free slots fill</p>
                  <div className="mb-6">
                    <span className="text-5xl font-bold text-slate-900">£149</span>
                    <p className="text-slate-600 text-sm mt-1">One-time fee</p>
                  </div>
                  <ul className="text-left space-y-3 mb-6">
                    <li className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700 text-sm">Complete competition setup</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700 text-sm">Support through first full competition</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700 text-sm">Weekly check-ins & direct support</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700 text-sm">Custom promotional materials (coming soon)</span>
                    </li>
                  </ul>
                  <div className="block w-full bg-slate-100 text-slate-700 text-center py-3 rounded-lg font-semibold">
                    Coming Soon
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-6 max-w-3xl mx-auto border-2 border-slate-200">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center">
                    <UsersIcon className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-2">Prefer to do it yourself?</h4>
                  <p className="text-slate-700 text-sm">
                    No problem! You can always set up your competition yourself for free. The Launch Package is optional for those who want hands-on support and guidance.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t-2 border-slate-200 pt-16"></div>

          {/* Player Credits Section */}
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Player Credits</h3>
            <p className="text-slate-600">Pay only for what you need, when you need it</p>
          </div>

          {/* What is a Credit? */}
          <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-6 mb-12 max-w-3xl mx-auto">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center">
                  <UsersIcon className="h-6 w-6 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">What is a Credit?</h3>
                <p className="text-slate-700 mb-3">
                  <strong>1 credit = 1 player slot in your competition</strong>
                </p>
                <ul className="text-sm text-slate-600 space-y-1.5">
                  <li>• You always have <strong>20 player slots</strong> to use for free</li>
                  <li>• Each additional player slot costs <strong>1 credit</strong> when they join</li>
                  <li>• If the same person joins multiple competitions, each join uses 1 credit</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto mb-12">
            {/* Free Tier */}
            <div className="bg-white rounded-xl p-6 shadow-md border-2 border-slate-200">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Free Tier</h3>
              <p className="text-slate-600 text-sm mb-6">Perfect for small groups</p>
              <div className="mb-6">
                <span className="text-5xl font-bold text-slate-900">£0</span>
              </div>
              <p className="text-slate-600 mb-6">20 credits</p>
              <div className="bg-slate-100 text-slate-700 text-center py-3 rounded-lg font-semibold">
                Included
              </div>
            </div>

            {/* Starter Pack */}
            <div className="bg-white rounded-xl p-6 shadow-md border-2 border-slate-200">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Starter Pack</h3>
              <p className="text-slate-600 text-sm mb-6">Extra capacity as you grow</p>
              <div className="mb-6">
                <span className="text-5xl font-bold text-slate-900">£10</span>
              </div>
              <p className="text-slate-600 mb-6">+20 credits</p>
              <div className="bg-slate-100 text-slate-700 text-center py-3 rounded-lg font-semibold">
                Buy after signup
              </div>
            </div>

            {/* Popular Pack */}
            <div className="bg-white rounded-xl p-6 shadow-md border-2 border-blue-500 relative">
              <div className="absolute -top-3 right-4">
                <span className="bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  SAVE 20%
                </span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Popular Pack</h3>
              <p className="text-slate-600 text-sm mb-6">For regular competitions</p>
              <div className="mb-6">
                <span className="text-5xl font-bold text-slate-900">£20</span>
              </div>
              <p className="text-slate-600 mb-6">+50 credits</p>
              <div className="bg-slate-100 text-slate-700 text-center py-3 rounded-lg font-semibold">
                Buy after signup
              </div>
            </div>

            {/* Best Value Pack */}
            <div className="bg-white rounded-xl p-6 shadow-md border-2 border-emerald-500 relative">
              <div className="absolute -top-3 right-4">
                <span className="bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  SAVE 33%
                </span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Best Value Pack</h3>
              <p className="text-slate-600 text-sm mb-6">For venues & busy organizers</p>
              <div className="mb-6">
                <span className="text-5xl font-bold text-slate-900">£40</span>
              </div>
              <p className="text-slate-600 mb-6">+120 credits</p>
              <div className="bg-slate-100 text-slate-700 text-center py-3 rounded-lg font-semibold">
                Buy after signup
              </div>
            </div>
          </div>

          {/* Single CTA */}
          <div className="text-center">
            <Link
              href="/register"
              className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white px-12 py-4 rounded-xl text-lg font-semibold transition-colors shadow-lg"
            >
              Start Free - No Credit Card Needed
            </Link>
            <p className="text-slate-500 mt-4 text-sm">
              20 players free forever • Only pay if you need more
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-emerald-900 bg-opacity-20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Join Pubs, Organisers & Friend Groups
          </h2>
          <p className="text-xl text-emerald-100 mb-8 max-w-3xl mx-auto">
            Start your Last Man Standing competition today - completely free for up to 20 players
          </p>

          <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto mb-12">
            <div className="bg-white bg-opacity-20 rounded-lg p-6 backdrop-blur border border-emerald-400">
              <p className="text-3xl font-bold text-white mb-2">FREE</p>
              <p className="text-emerald-50 text-sm">No credit card needed</p>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-6 backdrop-blur border border-emerald-400">
              <p className="text-3xl font-bold text-white mb-2">£0</p>
              <p className="text-emerald-50 text-sm">No subscription fees</p>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-6 backdrop-blur border border-emerald-400">
              <p className="text-3xl font-bold text-white mb-2">20</p>
              <p className="text-emerald-50 text-sm">Free player slots</p>
            </div>
          </div>

          <Link
            href="/register"
            className="inline-block bg-white text-emerald-700 px-12 py-4 rounded-xl text-xl font-bold hover:bg-emerald-50 transform hover:scale-105 transition-all duration-200 shadow-2xl"
          >
            Create Free Competition Now
          </Link>
          <p className="text-emerald-100 mt-4 text-lg font-semibold">
            Perfect for pubs, workplaces & friend groups • No credit card required
          </p>

          <div className="mt-8 flex flex-col md:flex-row justify-center items-center gap-4 md:gap-8 text-emerald-100">
            <div className="flex items-center">
              <CheckCircleIcon className="h-5 w-5 mr-2" />
              <span>Start FREE today</span>
            </div>
            <div className="flex items-center">
              <CheckCircleIcon className="h-5 w-5 mr-2" />
              <span>No subscriptions</span>
            </div>
            <div className="flex items-center">
              <CheckCircleIcon className="h-5 w-5 mr-2" />
              <span>Pay only if you grow</span>
            </div>
          </div>
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
  );
}
