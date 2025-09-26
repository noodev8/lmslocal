import Link from 'next/link';

export const metadata = {
  title: 'Help Center - LMSLocal',
  description: 'Learn how to create and manage Last Man Standing competitions for your pub, workplace, or club.',
};

export default function HelpHomePage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero Section */}
      <div className="bg-slate-50 rounded-lg p-8 mb-8 border">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">
          Welcome to LMSLocal Help Center
        </h1>
        <p className="text-lg text-slate-700 mb-6">
          Everything you need to know about running Last Man Standing competitions for your pub, workplace, or club.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/help/getting-started/organizers"
            className="inline-flex items-center px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <span className="mr-2">🚀</span>
            Quick Start Guide
          </Link>
          <Link
            href="/help/how-to-play"
            className="inline-flex items-center px-4 py-2 bg-white text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <span className="mr-2">🏆</span>
            Learn How to Play
          </Link>
        </div>
      </div>

      {/* Quick Links Grid */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Browse Help Topics</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/help/how-to-play"
            className="bg-white rounded-lg border p-6 hover:bg-slate-50 transition-colors"
          >
            <div className="mb-4">
              <span className="text-2xl">▶️</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              How to Play
            </h3>
            <p className="text-slate-600 text-sm">
              Learn the basics of Last Man Standing competitions
            </p>
          </Link>

          <Link
            href="/help/getting-started/organizers"
            className="bg-white rounded-lg border p-6 hover:bg-slate-50 transition-colors"
          >
            <div className="mb-4">
              <span className="text-2xl">👥</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              For Organizers
            </h3>
            <p className="text-slate-600 text-sm">
              Set up and manage your first competition
            </p>
          </Link>

          <Link
            href="/help/getting-started/players"
            className="bg-white rounded-lg border p-6 hover:bg-slate-50 transition-colors"
          >
            <div className="mb-4">
              <span className="text-2xl">⚽</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              For Players
            </h3>
            <p className="text-slate-600 text-sm">
              Join competitions and start making picks
            </p>
          </Link>

          <Link
            href="/help/faq"
            className="bg-white rounded-lg border p-6 hover:bg-slate-50 transition-colors"
          >
            <div className="mb-4">
              <span className="text-2xl">❓</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              FAQ
            </h3>
            <p className="text-slate-600 text-sm">
              Answers to commonly asked questions
            </p>
          </Link>

          <Link
            href="/help/rules"
            className="bg-white rounded-lg border p-6 hover:bg-slate-50 transition-colors"
          >
            <div className="mb-4">
              <span className="text-2xl">📋</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Competition Rules
            </h3>
            <p className="text-slate-600 text-sm">
              Detailed rules and scoring information
            </p>
          </Link>

          <Link
            href="/help/guides/creating-competition"
            className="bg-white rounded-lg border p-6 hover:bg-slate-50 transition-colors"
          >
            <div className="mb-4">
              <span className="text-2xl">📚</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Advanced Guides
            </h3>
            <p className="text-slate-600 text-sm">
              In-depth tutorials and best practices
            </p>
          </Link>
        </div>
      </div>

      {/* Popular Topics */}
      <div className="bg-white rounded-lg p-8 mb-8 border">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Popular Topics</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Link
            href="/help/guides/creating-competition"
            className="text-slate-700 hover:text-slate-900 hover:underline flex items-center"
          >
            <span className="mr-2">→</span>
            Creating your first competition
          </Link>
          <Link
            href="/help/rules#elimination"
            className="text-slate-700 hover:text-slate-900 hover:underline flex items-center"
          >
            <span className="mr-2">→</span>
            How elimination works
          </Link>
          <Link
            href="/help/guides/managing-rounds"
            className="text-slate-700 hover:text-slate-900 hover:underline flex items-center"
          >
            <span className="mr-2">→</span>
            Managing multiple rounds
          </Link>
          <Link
            href="/help/getting-started/organizers"
            className="text-slate-700 hover:text-slate-900 hover:underline flex items-center"
          >
            <span className="mr-2">→</span>
            Inviting players to join
          </Link>
          <Link
            href="/help/guides/making-picks"
            className="text-slate-700 hover:text-slate-900 hover:underline flex items-center"
          >
            <span className="mr-2">→</span>
            Making your first pick
          </Link>
          <Link
            href="/help/rules#lives-system"
            className="text-slate-700 hover:text-slate-900 hover:underline flex items-center"
          >
            <span className="mr-2">→</span>
            Understanding lives system
          </Link>
        </div>
      </div>

      {/* Contact Support */}
      <div className="bg-slate-50 rounded-lg p-8 text-center border">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Still Need Help?</h2>
        <p className="text-slate-700 mb-6">
          Can&apos;t find what you&apos;re looking for? Our support team is here to help you get the most out of LMSLocal.
        </p>
        <Link
          href="/help/support"
          className="inline-flex items-center px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          Contact Support
        </Link>
      </div>
    </div>
  );
}