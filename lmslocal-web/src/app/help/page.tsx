import Link from 'next/link';

export const metadata = {
  title: 'Help Center - LMSLocal',
  description: 'Learn how to create and manage Last Man Standing competitions for your pub, workplace, or club.',
};

export default function HelpHomePage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero Section */}
      <div className="border border-ink/30 bg-stock-lit p-8 mb-8">
        <h1 className="text-4xl font-bold text-ink mb-4">
          Welcome to LMSLocal Help Center
        </h1>
        <p className="text-xl leading-relaxed text-ink mb-6">
          Everything you need to know about running Last Man Standing competitions for your pub, workplace, or club.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/help/getting-started/organizers"
            className="inline-flex items-center px-4 py-2 rounded-sm bg-overprint font-display uppercase tracking-[0.06em] text-stock-lit transition-opacity hover:opacity-90"
          >
            <span className="mr-2">🚀</span>
            Quick Start Guide
          </Link>
          <Link
            href="/help/how-to-play"
            className="inline-flex items-center px-4 py-2 bg-stock-lit text-ink border border-ink/30 rounded-none hover:bg-stock-lit transition-colors"
          >
            <span className="mr-2">🏆</span>
            Learn How to Play
          </Link>
        </div>
      </div>

      {/* Quick Links Grid */}
      <div className="mb-8">
        <h2 className="font-display text-4xl font-semibold uppercase leading-[0.9] text-ink mb-6">Browse Help Topics</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/help/how-to-play"
            className="border border-ink/30 bg-stock-lit p-6 transition-colors hover:border-ink"
          >
            <div className="mb-4">
              <span className="text-2xl">▶️</span>
            </div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-2">
              How to Play
            </h3>
            <p className="text-[15px] text-ink-fade">
              Learn the basics of Last Man Standing competitions
            </p>
          </Link>

          <Link
            href="/help/getting-started/organizers"
            className="border border-ink/30 bg-stock-lit p-6 transition-colors hover:border-ink"
          >
            <div className="mb-4">
              <span className="text-2xl">👥</span>
            </div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-2">
              For Organizers
            </h3>
            <p className="text-[15px] text-ink-fade">
              Set up and manage your first competition
            </p>
          </Link>

          <Link
            href="/help/getting-started/players"
            className="border border-ink/30 bg-stock-lit p-6 transition-colors hover:border-ink"
          >
            <div className="mb-4">
              <span className="text-2xl">⚽</span>
            </div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-2">
              For Players
            </h3>
            <p className="text-[15px] text-ink-fade">
              Join competitions and start making picks
            </p>
          </Link>

          <Link
            href="/help/faq"
            className="border border-ink/30 bg-stock-lit p-6 transition-colors hover:border-ink"
          >
            <div className="mb-4">
              <span className="text-2xl">❓</span>
            </div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-2">
              FAQ
            </h3>
            <p className="text-[15px] text-ink-fade">
              Answers to commonly asked questions
            </p>
          </Link>

          <Link
            href="/help/support"
            className="border border-ink/30 bg-stock-lit p-6 transition-colors hover:border-ink"
          >
            <div className="mb-4">
              <span className="text-2xl">📞</span>
            </div>
            <h3 className="font-display text-xl uppercase tracking-[0.03em] text-ink mb-2">
              Contact Support
            </h3>
            <p className="text-[15px] text-ink-fade">
              Get in touch with our support team
            </p>
          </Link>
        </div>
      </div>

      {/* Popular Topics */}
      <div className="bg-stock-lit rounded-none p-8 mb-8 border">
        <h2 className="font-display text-4xl font-semibold uppercase leading-[0.9] text-ink mb-6">Popular Topics</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Link
            href="/help/getting-started/organizers"
            className="flex items-center text-ink underline decoration-dotted underline-offset-4 hover:text-overprint"
          >
            <span className="mr-2">→</span>
            Getting started as an organizer
          </Link>
          <Link
            href="/help/getting-started/players"
            className="flex items-center text-ink underline decoration-dotted underline-offset-4 hover:text-overprint"
          >
            <span className="mr-2">→</span>
            Getting started as a player
          </Link>
          <Link
            href="/help/how-to-play"
            className="flex items-center text-ink underline decoration-dotted underline-offset-4 hover:text-overprint"
          >
            <span className="mr-2">→</span>
            How to play Last Man Standing
          </Link>
          <Link
            href="/help/support"
            className="flex items-center text-ink underline decoration-dotted underline-offset-4 hover:text-overprint"
          >
            <span className="mr-2">→</span>
            Contact our support team
          </Link>
        </div>
      </div>

      {/* Contact Support */}
      <div className="border border-ink/30 bg-stock-lit p-8 text-center">
        <h2 className="font-display text-4xl font-semibold uppercase leading-[0.9] text-ink mb-4">Still Need Help?</h2>
        <p className="text-[17px] leading-relaxed text-ink mb-6">
          Can&apos;t find what you&apos;re looking for? Our support team is here to help you get the most out of LMSLocal.
        </p>
        <a
          href="mailto:noodev8@gmail.com"
          className="inline-flex items-center px-6 py-3 rounded-sm bg-overprint font-display uppercase tracking-[0.06em] text-stock-lit transition-opacity hover:opacity-90"
        >
          📧 noodev8@gmail.com
        </a>
      </div>
    </div>
  );
}