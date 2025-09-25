import Link from 'next/link';
import {
  PlayIcon,
  UserGroupIcon,
  QuestionMarkCircleIcon,
  ClipboardDocumentListIcon,
  AcademicCapIcon,
  RocketLaunchIcon,
  TrophyIcon,
  UsersIcon
} from '@heroicons/react/24/outline';

export const metadata = {
  title: 'Help Center - LMSLocal',
  description: 'Learn how to create and manage Last Man Standing competitions for your pub, workplace, or club.',
};

const quickLinks = [
  {
    title: 'How to Play',
    description: 'Learn the basics of Last Man Standing competitions',
    href: '/help/how-to-play',
    icon: PlayIcon,
    color: 'bg-blue-50 text-blue-700'
  },
  {
    title: 'For Organizers',
    description: 'Set up and manage your first competition',
    href: '/help/getting-started/organizers',
    icon: UserGroupIcon,
    color: 'bg-emerald-50 text-emerald-700'
  },
  {
    title: 'For Players',
    description: 'Join competitions and start making picks',
    href: '/help/getting-started/players',
    icon: UsersIcon,
    color: 'bg-purple-50 text-purple-700'
  },
  {
    title: 'FAQ',
    description: 'Answers to commonly asked questions',
    href: '/help/faq',
    icon: QuestionMarkCircleIcon,
    color: 'bg-amber-50 text-amber-700'
  },
  {
    title: 'Competition Rules',
    description: 'Detailed rules and scoring information',
    href: '/help/rules',
    icon: ClipboardDocumentListIcon,
    color: 'bg-slate-50 text-slate-700'
  },
  {
    title: 'Advanced Guides',
    description: 'In-depth tutorials and best practices',
    href: '/help/guides/creating-competition',
    icon: AcademicCapIcon,
    color: 'bg-indigo-50 text-indigo-700'
  }
];

const popularTopics = [
  { title: 'Creating your first competition', href: '/help/guides/creating-competition' },
  { title: 'How elimination works', href: '/help/rules#elimination' },
  { title: 'Managing multiple rounds', href: '/help/guides/managing-rounds' },
  { title: 'Inviting players to join', href: '/help/getting-started/organizers#inviting-players' },
  { title: 'Making your first pick', href: '/help/guides/making-picks' },
  { title: 'Understanding lives system', href: '/help/rules#lives-system' }
];

export default function HelpHomePage() {
  return (
    <div>
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl p-8 mb-8">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Welcome to LMSLocal Help Center
          </h1>
          <p className="text-lg text-slate-700 mb-6">
            Everything you need to know about running Last Man Standing competitions for your pub, workplace, or club.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/help/getting-started/organizers"
              className="inline-flex items-center px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors"
            >
              <RocketLaunchIcon className="h-5 w-5 mr-2" />
              Quick Start Guide
            </Link>
            <Link
              href="/help/how-to-play"
              className="inline-flex items-center px-4 py-2 bg-white text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <TrophyIcon className="h-5 w-5 mr-2" />
              Learn How to Play
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Links Grid */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Browse Help Topics</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group relative rounded-xl border border-slate-200 p-6 hover:shadow-lg hover:border-slate-300 transition-all"
            >
              <div className={`inline-flex p-3 rounded-lg ${link.color} mb-4`}>
                <link.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2 group-hover:text-slate-700">
                {link.title}
              </h3>
              <p className="text-slate-600 text-sm">
                {link.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Popular Topics */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Popular Topics</h2>
        <div className="bg-slate-50 rounded-xl p-6">
          <ul className="grid gap-3 md:grid-cols-2">
            {popularTopics.map((topic) => (
              <li key={topic.href}>
                <Link
                  href={topic.href}
                  className="text-slate-700 hover:text-slate-900 hover:underline flex items-center"
                >
                  <span className="mr-2">→</span>
                  {topic.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Contact Support */}
      <section className="bg-slate-100 rounded-xl p-8 text-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Still Need Help?</h2>
        <p className="text-slate-700 mb-6 max-w-2xl mx-auto">
          Can't find what you're looking for? Our support team is here to help you get the most out of LMSLocal.
        </p>
        <Link
          href="/help/support"
          className="inline-flex items-center px-6 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors"
        >
          Contact Support
        </Link>
      </section>
    </div>
  );
}