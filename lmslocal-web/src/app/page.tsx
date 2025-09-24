'use client';

import Link from 'next/link';
import { CheckCircleIcon, TrophyIcon, UsersIcon, ClockIcon, UserGroupIcon, StarIcon } from '@heroicons/react/24/outline';

export default function LandingPage() {
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
      description: 'Handle customers without smartphones or email. Add guest players effortlessly.',
      icon: UsersIcon,
    },
    {
      title: 'Complete Control',
      description: 'Override results, handle disputes, and manage everything with full audit trails.',
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
                href="/game-rules"
                className="hidden sm:block text-slate-600 hover:text-slate-900 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"
              >
                Game Rules
              </Link>
              <Link
                href="/pricing"
                className="hidden sm:block text-slate-600 hover:text-slate-900 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"
              >
                Pricing
              </Link>
              <Link
                href="/login"
                className="bg-slate-800 hover:bg-slate-900 text-white px-4 sm:px-6 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-slate-100 via-slate-50 to-stone-100 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-bold text-slate-900 mb-6">
              Last Man Standing
              <span className="block text-slate-700">Made Simple</span>
            </h1>
            <p className="text-xl text-slate-600 mb-12 max-w-3xl mx-auto">
              The easiest way to run or join a Last Man Standing competition. Perfect for pubs, workplaces, and friend groups.
            </p>
            
            {/* Single Sign In/Get Started */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Link 
                href="/register" 
                className="bg-slate-800 hover:bg-slate-900 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-colors shadow-sm"
              >
                Create Competition
              </Link>
              <Link 
                href="/login" 
                className="text-slate-700 hover:text-slate-900 px-8 py-4 rounded-xl font-semibold text-lg border-2 border-slate-300 hover:bg-slate-100 transition-all"
              >
                Join Competition
              </Link>
            </div>
          </div>
          
          {/* Beta Launch Stats */}
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16">
            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-8 border border-slate-200/50 shadow-sm">
              <div className="flex items-center mb-4">
                <ClockIcon className="h-6 w-6 text-slate-600 mr-3" />
                <h3 className="text-lg font-semibold text-slate-900">Quick Setup</h3>
              </div>
              <div className="text-3xl font-bold text-slate-800 mb-2">5 mins</div>
              <p className="text-slate-600 text-sm">To launch your competition</p>
            </div>

            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-8 border border-slate-200/50 shadow-sm">
              <div className="flex items-center mb-4">
                <UserGroupIcon className="h-6 w-6 text-slate-600 mr-3" />
                <h3 className="text-lg font-semibold text-slate-900">Beta Access</h3>
              </div>
              <div className="text-3xl font-bold text-emerald-600 mb-2">FREE</div>
              <p className="text-slate-600 text-sm">Unlimited players during beta</p>
            </div>

            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-8 border border-slate-200/50 shadow-sm">
              <div className="flex items-center mb-4">
                <TrophyIcon className="h-6 w-6 text-slate-600 mr-3" />
                <h3 className="text-lg font-semibold text-slate-900">Ready Now</h3>
              </div>
              <div className="text-3xl font-bold text-slate-800 mb-2">EPL</div>
              <p className="text-slate-600 text-sm">Premier League teams included</p>
            </div>
          </div>

          {/* Competition Preview Dashboard */}
          <div className="max-w-4xl mx-auto bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/50 p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">See How It Works</h2>
              <p className="text-slate-600">Simple for players to join, easy for organizers to manage</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              {/* Player Experience */}
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                <div className="flex items-center mb-4">
                  <UserGroupIcon className="h-6 w-6 text-slate-700 mr-3" />
                  <h3 className="font-semibold text-slate-900">Player Experience</h3>
                </div>
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg p-4">
                    <p className="font-semibold text-sm mb-1">Premier League LMS</p>
                    <p className="text-xs opacity-90">The Crown & Anchor • Round 12</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-slate-200">
                    <p className="text-sm font-medium text-slate-700 mb-3">Your Status: ✅ Still In</p>
                    <p className="text-xs text-slate-600 mb-2">Round 12 - Pick a team to win:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button className="p-2 bg-emerald-100 hover:bg-emerald-200 rounded text-xs font-medium text-emerald-700 transition-colors">
                        ✓ Arsenal
                      </button>
                      <button className="p-2 bg-slate-100 hover:bg-slate-200 rounded text-xs font-medium text-slate-700 transition-colors">
                        Chelsea
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">Pick locks in 2h 34m</p>
                  </div>
                </div>
              </div>

              {/* Organizer View */}
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                <div className="flex items-center mb-4">
                  <TrophyIcon className="h-6 w-6 text-slate-700 mr-3" />
                  <h3 className="font-semibold text-slate-900">Organizer Control</h3>
                </div>
                <div className="space-y-4">
                  <div className="bg-white rounded-lg p-4 border border-slate-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-slate-700">Players Remaining</span>
                      <span className="text-lg font-bold text-emerald-600">24</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 mb-3">
                      <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '60%' }}></div>
                    </div>
                    <p className="text-xs text-slate-500">Started with 40 players</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-slate-200">
                    <p className="text-sm text-slate-600 mb-2">Quick Actions</p>
                    <div className="space-y-1">
                      <button className="w-full text-left p-2 bg-slate-50 hover:bg-slate-100 rounded text-xs text-slate-700 transition-colors">
                        📝 Update Results
                      </button>
                      <button className="w-full text-left p-2 bg-slate-50 hover:bg-slate-100 rounded text-xs text-slate-700 transition-colors">
                        👥 Manage Players
                      </button>
                    </div>
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
              Why Choose LMSLocal?
            </h2>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Built by competition enthusiasts, for competition enthusiasts
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 max-w-4xl mx-auto">
            {/* Player Benefits */}
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-center">Great for Players</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <CheckCircleIcon className="h-6 w-6 text-emerald-400 flex-shrink-0" />
                  <p className="text-slate-300">Simple, clear interface - make picks in seconds</p>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircleIcon className="h-6 w-6 text-emerald-400 flex-shrink-0" />
                  <p className="text-slate-300">Real-time updates and notifications</p>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircleIcon className="h-6 w-6 text-emerald-400 flex-shrink-0" />
                  <p className="text-slate-300">Track your progress and see standings</p>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircleIcon className="h-6 w-6 text-emerald-400 flex-shrink-0" />
                  <p className="text-slate-300">Join with just a competition code</p>
                </div>
              </div>
            </div>

            {/* Organizer Benefits */}
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-center">Easy for Organizers</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <CheckCircleIcon className="h-6 w-6 text-emerald-400 flex-shrink-0" />
                  <p className="text-slate-300">Set up competitions in 5 minutes</p>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircleIcon className="h-6 w-6 text-emerald-400 flex-shrink-0" />
                  <p className="text-slate-300">Handle all the admin work automatically</p>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircleIcon className="h-6 w-6 text-emerald-400 flex-shrink-0" />
                  <p className="text-slate-300">Override results if needed</p>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircleIcon className="h-6 w-6 text-emerald-400 flex-shrink-0" />
                  <p className="text-slate-300">Add guest players for non-smartphone users</p>
                </div>
              </div>
            </div>
          </div>

          {/* Simple testimonial */}
          <div className="mt-16 max-w-2xl mx-auto">
            <div className="bg-white bg-opacity-10 rounded-xl p-8 backdrop-blur text-center">
              <div className="flex items-center justify-center mb-6">
                <div className="w-12 h-12 bg-slate-600 rounded-full flex items-center justify-center mr-4">
                  <span className="text-white font-bold text-lg">S</span>
                </div>
                <div>
                  <p className="font-bold">Sarah Mitchell</p>
                  <p className="text-slate-300 text-sm">Player & Organizer</p>
                </div>
              </div>
              <p className="text-slate-300 mb-4">
                &quot;I&apos;ve been both a player and organizer on LMSLocal. It&apos;s the easiest system I&apos;ve used - players love how simple it is, and managing the competition takes no time at all.&quot;
              </p>
              <div className="flex space-x-1 justify-center">
                {[...Array(5)].map((_, i) => (
                  <StarIcon key={i} className="h-5 w-5 text-amber-400 fill-current" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Ready to Get Started */}
      <section className="py-20 bg-stone-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-slate-600 mb-12">
            Join our beta and help shape the future of Last Man Standing competitions
          </p>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200">
              <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-6">
                <TrophyIcon className="h-8 w-8 text-slate-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-4">Create a Competition</h3>
              <p className="text-slate-600 mb-6">
                Set up your Last Man Standing competition in minutes. Perfect for pubs, workplaces, or friend groups.
              </p>
              <Link 
                href="/register" 
                className="inline-block bg-slate-800 hover:bg-slate-900 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Get Started Free
              </Link>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200">
              <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-6">
                <UserGroupIcon className="h-8 w-8 text-slate-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-4">Join a Competition</h3>
              <p className="text-slate-600 mb-6">
                Have a competition code? Join in seconds and start making your picks right away.
              </p>
              <Link 
                href="/login" 
                className="inline-block text-slate-700 hover:text-slate-900 px-6 py-3 rounded-lg font-semibold border-2 border-slate-300 hover:bg-slate-100 transition-all"
              >
                Join Now
              </Link>
            </div>
          </div>

          <p className="text-slate-500">
            Free during beta • <Link href="/pricing" className="text-slate-600 hover:text-slate-900 underline">View pricing plans</Link>
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Built for Busy Organisers
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Stop spending hours managing competitions. Focus on your business while we handle the complexity.
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

      {/* How It Works */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-slate-600">Three simple steps to running professional competitions</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center bg-white rounded-xl p-8 shadow-sm border border-slate-200">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-800 text-white rounded-full text-2xl font-bold mb-4">1</div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Quick Setup</h3>
              <p className="text-slate-600">Name your competition, choose your teams (EPL included), set basic rules. Takes 5 minutes.</p>
            </div>
            <div className="text-center bg-white rounded-xl p-8 shadow-sm border border-slate-200">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-700 text-white rounded-full text-2xl font-bold mb-4">2</div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Invite Players</h3>
              <p className="text-slate-600">Share a simple link or access code. Add guest players for customers without smartphones.</p>
            </div>
            <div className="text-center bg-white rounded-xl p-8 shadow-sm border border-slate-200">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-600 text-white rounded-full text-2xl font-bold mb-4">3</div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Manage & Win</h3>
              <p className="text-slate-600">Track picks in real-time, handle disputes with override powers, let the system eliminate players automatically.</p>
            </div>
          </div>
        </div>
      </section>


      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-slate-800 via-slate-700 to-stone-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-slate-900 bg-opacity-20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Start Your Competition?
          </h2>
          <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto">
            Be among the first to experience the simplest way to run Last Man Standing competitions.
          </p>
          
          <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto mb-12">
            <div className="bg-white bg-opacity-10 rounded-lg p-4 backdrop-blur border border-slate-600">
              <p className="text-2xl font-bold text-white">BETA</p>
              <p className="text-slate-300 text-sm">Early access available</p>
            </div>
            <div className="bg-white bg-opacity-10 rounded-lg p-4 backdrop-blur border border-slate-600">
              <p className="text-2xl font-bold text-white">FREE</p>
              <p className="text-slate-300 text-sm">No credit card required</p>
            </div>
            <div className="bg-white bg-opacity-10 rounded-lg p-4 backdrop-blur border border-slate-600">
              <p className="text-2xl font-bold text-white">5 min</p>
              <p className="text-slate-300 text-sm">Setup time</p>
            </div>
          </div>
          
          <Link 
            href="/register" 
            className="inline-block bg-white text-slate-800 px-12 py-4 rounded-xl text-xl font-bold hover:bg-slate-100 transform hover:scale-105 transition-all duration-200 shadow-2xl"
          >
            Create Free Competition
          </Link>
          <p className="text-slate-400 mt-4 text-lg">
            Free during beta • Unlimited players • <Link href="/pricing" className="text-slate-300 hover:text-white underline">View pricing</Link>
          </p>
          
          <div className="mt-8 flex justify-center items-center space-x-8 text-slate-300">
            <div className="flex items-center">
              <CheckCircleIcon className="h-5 w-5 mr-2" />
              <span>No long-term contracts</span>
            </div>
            <div className="flex items-center">
              <CheckCircleIcon className="h-5 w-5 mr-2" />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center">
              <CheckCircleIcon className="h-5 w-5 mr-2" />
              <span>UK support team</span>
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
