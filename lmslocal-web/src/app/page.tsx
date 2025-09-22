'use client';

import Link from 'next/link';
import { CheckCircleIcon, TrophyIcon, UsersIcon, ClockIcon, UserGroupIcon, StarIcon } from '@heroicons/react/24/outline';

export default function LandingPage() {
  // Simple chart component for visual data representation
  const SimpleChart = ({ data, title, color = "slate" }: { data: number[], title: string, color?: string }) => {
    const max = Math.max(...data);
    return (
      <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
        <h4 className="text-sm font-medium text-slate-600 mb-3">{title}</h4>
        <div className="flex items-end space-x-1 h-16">
          {data.map((value, i) => (
            <div
              key={i}
              className={`bg-${color}-500 rounded-sm flex-1`}
              style={{ height: `${(value / max) * 100}%` }}
            />
          ))}
        </div>
      </div>
    );
  };

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
        'Custom branding (coming soon)',
        'Analytics dashboard (coming soon)',
        'Export competition data',
        'Multiple competitions',
        'Remove LMSLocal branding',
      ],
      cta: 'Coming Soon',
      highlighted: true,
      savings: 'Save £89 with annual plan (£139/year)',
      comingSoon: true,
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
            <div className="flex items-center space-x-4">
              <Link 
                href="/login" 
                className="text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"
              >
                Sign In
              </Link>
              <Link 
                href="/register" 
                className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                Get Started
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
          
          {/* Competition Stats with Charts */}
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16">
            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-8 border border-slate-200/50 shadow-sm">
              <div className="flex items-center mb-4">
                <UserGroupIcon className="h-6 w-6 text-slate-600 mr-3" />
                <h3 className="text-lg font-semibold text-slate-900">Active Players</h3>
              </div>
              <div className="text-3xl font-bold text-slate-800 mb-2">2,847</div>
              <p className="text-slate-600 text-sm mb-4">Players this season</p>
              <SimpleChart data={[1200, 1650, 2100, 2400, 2847, 2750]} title="Player Growth" color="emerald" />
            </div>

            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-8 border border-slate-200/50 shadow-sm">
              <div className="flex items-center mb-4">
                <TrophyIcon className="h-6 w-6 text-slate-600 mr-3" />
                <h3 className="text-lg font-semibold text-slate-900">Competitions</h3>
              </div>
              <div className="text-3xl font-bold text-slate-800 mb-2">156</div>
              <p className="text-slate-600 text-sm mb-4">Running this week</p>
              <SimpleChart data={[45, 78, 112, 134, 156, 148]} title="Active Competitions" color="blue" />
            </div>

            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-8 border border-slate-200/50 shadow-sm">
              <div className="flex items-center mb-4">
                <StarIcon className="h-6 w-6 text-slate-600 mr-3" />
                <h3 className="text-lg font-semibold text-slate-900">Satisfaction</h3>
              </div>
              <div className="text-3xl font-bold text-slate-800 mb-2">4.8★</div>
              <p className="text-slate-600 text-sm mb-4">Average rating</p>
              <SimpleChart data={[4.1, 4.3, 4.5, 4.6, 4.8, 4.7]} title="User Rating" color="amber" />
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
            Join thousands of players and organizers who&apos;ve made LMSLocal their go-to competition platform
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
            Free during beta • Professional plan coming soon at £19/month
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

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Simple, Fair Pricing
            </h2>
            <p className="text-xl text-slate-600">Start free and only pay for what you need as your competition grows.</p>
          </div>
          
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

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-slate-800 via-slate-700 to-stone-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-slate-900 bg-opacity-20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Start Your Competition?
          </h2>
          <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto">
            Join thousands of organizers and players who&apos;ve made LMSLocal their favorite competition platform.
          </p>
          
          <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto mb-12">
            <div className="bg-white bg-opacity-10 rounded-lg p-4 backdrop-blur border border-slate-600">
              <p className="text-2xl font-bold text-white">2,847</p>
              <p className="text-slate-300 text-sm">Active players this season</p>
            </div>
            <div className="bg-white bg-opacity-10 rounded-lg p-4 backdrop-blur border border-slate-600">
              <p className="text-2xl font-bold text-white">4.8★</p>
              <p className="text-slate-300 text-sm">User satisfaction rating</p>
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
            Free during beta • Unlimited players • No credit card required
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
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <TrophyIcon className="h-6 w-6 text-slate-400 mr-2" />
              <span className="text-xl font-bold">LMSLocal</span>
            </div>
            <div className="text-sm text-slate-400 text-center md:text-right">
              <p>&copy; 2024 LMSLocal. All rights reserved.</p>
              <p className="mt-1">The admin-first Last Man Standing platform.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
