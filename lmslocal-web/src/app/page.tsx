'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircleIcon, TrophyIcon, UsersIcon, ClockIcon, StarIcon, SparklesIcon } from '@heroicons/react/24/outline';

export default function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');

  // Check if user is logged in (for showing Dashboard button)
  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    const userData = localStorage.getItem('user');

    if (token && userData && userData !== 'undefined' && userData !== 'null') {
      try {
        const user = JSON.parse(userData);
        setIsLoggedIn(true);
        setUserName(user.display_name || '');
      } catch {
        // Invalid user data, clear everything
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('user');
        setIsLoggedIn(false);
        setUserName('');
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
                href="/pricing"
                className="text-slate-600 hover:text-slate-900 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"
              >
                Pricing
              </Link>
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

      {/* Welcome Banner for Logged In Users / Onboarding Banner for Visitors */}
      {isLoggedIn ? (
        <div className="bg-gradient-to-r from-slate-700 to-slate-800 py-4 border-b-4 border-slate-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-center justify-center gap-3 text-center md:text-left">
              <div className="flex items-center">
                <TrophyIcon className="h-6 w-6 text-emerald-400 mr-3" />
                <span className="text-white font-bold text-lg">Welcome back, {userName}!</span>
              </div>
              <Link
                href="/dashboard"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-bold text-sm transition-colors shadow-md inline-flex items-center"
              >
                Go to Dashboard
                <span className="ml-2">→</span>
              </Link>
            </div>
          </div>
        </div>
      ) : (
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
      )}

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-slate-100 via-slate-50 to-stone-100 py-8 md:py-16 lg:py-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Headline First */}
          <div className="text-center mb-8 md:mb-12">
            <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold text-slate-900 mb-2 md:mb-3 lg:mb-4 leading-tight">
              Last Match <span className="text-emerald-600">Standing</span>
            </h1>
            <div className="inline-block bg-emerald-100 border-2 border-emerald-500 rounded-full px-4 py-2 mt-2">
              <p className="text-emerald-800 font-bold text-sm">Play FREE • No Credit Card • No Subscription</p>
            </div>
          </div>

          {/* Split Path: Player vs Organizer */}
          {isLoggedIn ? (
            // Logged in: Show split info for Players (App) and Organizers (Web)
            <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto mb-12">
              {/* Mobile App Promotion */}
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 md:p-8 text-white shadow-xl border-2 border-blue-500">
                <div className="text-center mb-6">
                  <div className="inline-block bg-white/20 rounded-full px-4 py-2 mb-3">
                    <p className="text-sm font-bold">📱 MOBILE APP</p>
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold mb-2">
                    Players: Use the App
                  </h3>
                  <p className="text-blue-100 text-base">
                    Download our mobile app for easier picks, instant notifications, and on-the-go access
                  </p>
                </div>

                {/* App Store Badges */}
                <div className="flex flex-col gap-3 max-w-xs mx-auto">
                  <div className="relative">
                    <div className="bg-gray-600 text-white px-6 py-3 rounded-xl font-semibold text-sm text-center flex items-center justify-center gap-2 opacity-60 cursor-not-allowed">
                      <span className="text-2xl"></span>
                      <div className="text-left">
                        <div className="text-xs opacity-80">Download on the</div>
                        <div className="text-base font-bold">App Store (iOS)</div>
                      </div>
                    </div>
                    <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      Coming Soon
                    </div>
                  </div>
                  <a
                    href="https://play.google.com/store/apps/details?id=uk.co.lmslocal.lmslocal_flutter"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-black hover:bg-gray-900 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all text-center flex items-center justify-center gap-2"
                  >
                    <span className="text-2xl">▶</span>
                    <div className="text-left">
                      <div className="text-xs opacity-80">GET IT ON</div>
                      <div className="text-base font-bold">Google Play (Android)</div>
                    </div>
                  </a>
                </div>
              </div>

              {/* Organizer Web Management */}
              <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-6 md:p-8 text-white shadow-xl border-2 border-emerald-500">
                <div className="text-center mb-6">
                  <div className="inline-block bg-white/20 rounded-full px-4 py-2 mb-3">
                    <p className="text-sm font-bold">💻 WEB PLATFORM</p>
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold mb-2">
                    Organizers: Use the Web
                  </h3>
                  <p className="text-emerald-100 text-base">
                    Manage your competitions, add players, and view detailed analytics from your dashboard
                  </p>
                </div>

                {/* Features */}
                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-emerald-50 text-sm">
                    <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
                    <span>Full competition management</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-50 text-sm">
                    <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
                    <span>Add players without smartphones</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-50 text-sm">
                    <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
                    <span>Display on pub TV screens</span>
                  </div>
                </div>

                {/* Dashboard Button */}
                <Link
                  href="/dashboard"
                  className="block bg-white hover:bg-emerald-50 text-emerald-700 px-8 py-3 rounded-xl font-bold text-base transition-all shadow-lg text-center"
                >
                  Go to Dashboard
                </Link>
              </div>
            </div>
          ) : (
            // Not logged in: Show split path
            <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto mb-12">
              {/* LEFT SIDE - PLAYERS (Mobile App) */}
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl p-8 md:p-10 text-white shadow-2xl border-4 border-blue-500 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full blur-3xl opacity-20 -mr-32 -mt-32"></div>
                <div className="relative z-10">
                  <div className="text-center mb-6">
                    <div className="inline-block bg-white/20 rounded-full px-4 py-2 mb-4">
                      <p className="text-sm font-bold">📱 FOR PLAYERS</p>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold mb-3">
                      Join a Competition
                    </h2>
                    <p className="text-blue-100 text-lg mb-6">
                      Download our mobile app to make your picks, track results, and compete with friends
                    </p>
                  </div>

                  {/* App Store Badges */}
                  <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                    <div className="relative">
                      <div className="bg-gray-600 text-white px-6 py-3 rounded-xl font-semibold text-sm text-center flex items-center justify-center gap-2 opacity-60 cursor-not-allowed">
                        <span className="text-2xl"></span>
                        <div className="text-left">
                          <div className="text-xs opacity-80">Download on the</div>
                          <div className="text-base font-bold">App Store (iOS)</div>
                        </div>
                      </div>
                      <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                        Coming Soon
                      </div>
                    </div>
                    <a
                      href="https://play.google.com/store/apps/details?id=uk.co.lmslocal.lmslocal_flutter"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-black hover:bg-gray-900 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all text-center flex items-center justify-center gap-2"
                    >
                      <span className="text-2xl">▶</span>
                      <div className="text-left">
                        <div className="text-xs opacity-80">GET IT ON</div>
                        <div className="text-base font-bold">Google Play (Android)</div>
                      </div>
                    </a>
                  </div>

                  {/* QR Codes */}
                  <div className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/20">
                    <p className="text-center text-sm font-semibold mb-4">Or scan to download:</p>
                    <div className="flex justify-center gap-6">
                      {/* Apple App Store QR */}
                      <div className="text-center">
                        <div className="bg-white p-3 rounded-xl mb-2 w-32 h-32 flex items-center justify-center">
                          <div className="text-slate-400 text-xs">
                            [QR: App Store]
                          </div>
                        </div>
                        <p className="text-xs font-medium">iOS</p>
                      </div>
                      {/* Google Play QR */}
                      <div className="text-center">
                        <div className="bg-white p-3 rounded-xl mb-2 w-32 h-32 flex items-center justify-center">
                          <div className="text-slate-400 text-xs">
                            [QR: Play Store]
                          </div>
                        </div>
                        <p className="text-xs font-medium">Android</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 text-center">
                    <p className="text-blue-100 text-sm">
                      ✓ Make picks on the go • ✓ Get notifications • ✓ Track your progress
                    </p>
                  </div>
                </div>
              </div>

              {/* RIGHT SIDE - ORGANIZERS (Web Platform) */}
              <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-3xl p-8 md:p-10 text-white shadow-2xl border-4 border-emerald-500 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 rounded-full blur-3xl opacity-20 -mr-32 -mt-32"></div>
                <div className="relative z-10">
                  <div className="text-center mb-6">
                    <div className="inline-block bg-white/20 rounded-full px-4 py-2 mb-4">
                      <p className="text-sm font-bold">🏆 FOR ORGANIZERS</p>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold mb-3">
                      Run a Competition
                    </h2>
                    <p className="text-emerald-100 text-lg mb-6">
                      Perfect for pubs, workplaces & friend groups. Set up and manage everything from the web
                    </p>
                  </div>

                  {/* Features List */}
                  <div className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/20 mb-6">
                    <div className="space-y-3">
                      <div className="flex items-start space-x-3">
                        <CheckCircleIcon className="h-6 w-6 text-emerald-300 flex-shrink-0 mt-0.5" />
                        <p className="text-emerald-50">5-minute setup - get running today</p>
                      </div>
                      <div className="flex items-start space-x-3">
                        <CheckCircleIcon className="h-6 w-6 text-emerald-300 flex-shrink-0 mt-0.5" />
                        <p className="text-emerald-50">Free for up to 20 players</p>
                      </div>
                      <div className="flex items-start space-x-3">
                        <CheckCircleIcon className="h-6 w-6 text-emerald-300 flex-shrink-0 mt-0.5" />
                        <p className="text-emerald-50">Add players without smartphones</p>
                      </div>
                      <div className="flex items-start space-x-3">
                        <CheckCircleIcon className="h-6 w-6 text-emerald-300 flex-shrink-0 mt-0.5" />
                        <p className="text-emerald-50">Automated fixtures & results</p>
                      </div>
                      <div className="flex items-start space-x-3">
                        <CheckCircleIcon className="h-6 w-6 text-emerald-300 flex-shrink-0 mt-0.5" />
                        <p className="text-emerald-50">Display on pub TV screens</p>
                      </div>
                    </div>
                  </div>

                  {/* CTA Buttons */}
                  <div className="flex flex-col gap-3">
                    <Link
                      href="/competition/create"
                      className="bg-white hover:bg-emerald-50 text-emerald-700 px-8 py-4 rounded-xl font-bold text-lg transition-colors shadow-lg text-center"
                    >
                      Create Free Competition
                    </Link>
                    <Link
                      href="/onboarding"
                      className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-xl font-semibold text-base border-2 border-white/40 transition-all text-center inline-flex items-center justify-center"
                    >
                      <SparklesIcon className="h-5 w-5 mr-2" />
                      Get Free Setup Help
                    </Link>
                  </div>

                  <div className="mt-6 text-center">
                    <p className="text-emerald-100 text-sm">
                      No credit card required • Cancel anytime
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

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

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-slate-900 bg-opacity-20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-slate-300 max-w-3xl mx-auto">
              Choose your path - play on mobile or organize on the web
            </p>
          </div>

          {/* Split CTA */}
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Players - Mobile App */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-8 text-white text-center">
              <h3 className="text-2xl font-bold mb-3">📱 Players</h3>
              <p className="text-blue-100 mb-6">Download the mobile app to join competitions</p>
              <div className="flex flex-col gap-3 mb-4">
                <div className="relative">
                  <div className="bg-gray-600 text-white px-6 py-3 rounded-xl font-semibold text-sm text-center flex items-center justify-center gap-2 opacity-60 cursor-not-allowed">
                    <span className="text-xl"></span>
                    <div className="text-left">
                      <div className="text-xs opacity-80">Download on the</div>
                      <div className="text-sm font-bold">App Store (iOS)</div>
                    </div>
                  </div>
                  <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    Coming Soon
                  </div>
                </div>
                <a
                  href="https://play.google.com/store/apps/details?id=uk.co.lmslocal.lmslocal_flutter"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-black hover:bg-gray-900 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all text-center flex items-center justify-center gap-2"
                >
                  <span className="text-xl">▶</span>
                  <div className="text-left">
                    <div className="text-xs opacity-80">GET IT ON</div>
                    <div className="text-sm font-bold">Google Play (Android)</div>
                  </div>
                </a>
              </div>
              <p className="text-blue-200 text-sm">100% Free • Make picks anywhere</p>
            </div>

            {/* Organizers - Web Platform */}
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-8 text-white text-center">
              <h3 className="text-2xl font-bold mb-3">🏆 Organizers</h3>
              <p className="text-emerald-100 mb-6">Create and manage competitions on the web</p>
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-center gap-2 text-emerald-50">
                  <CheckCircleIcon className="h-5 w-5" />
                  <span className="text-sm">FREE for up to 20 players</span>
                </div>
                <div className="flex items-center justify-center gap-2 text-emerald-50">
                  <CheckCircleIcon className="h-5 w-5" />
                  <span className="text-sm">No credit card required</span>
                </div>
                <div className="flex items-center justify-center gap-2 text-emerald-50">
                  <CheckCircleIcon className="h-5 w-5" />
                  <span className="text-sm">5-minute setup</span>
                </div>
              </div>
              <Link
                href="/competition/create"
                className="inline-block bg-white hover:bg-emerald-50 text-emerald-700 px-8 py-3 rounded-xl text-base font-bold transition-all shadow-lg w-full"
              >
                Create Free Competition
              </Link>
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
