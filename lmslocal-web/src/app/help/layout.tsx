'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isAuthenticated as checkAuth } from '@/lib/auth';
import {
  Bars3Icon,
  XMarkIcon,
  ChevronRightIcon,
  HomeIcon,
  BookOpenIcon,
  PlayIcon,
  UserGroupIcon,
  QuestionMarkCircleIcon,
  ClipboardDocumentListIcon,
  AcademicCapIcon,
  PhoneIcon
} from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Help Home', href: '/help', icon: HomeIcon },
  { name: 'How to Play', href: '/help/how-to-play', icon: PlayIcon },
  {
    name: 'Getting Started',
    icon: BookOpenIcon,
    children: [
      { name: 'For Organizers', href: '/help/getting-started/organizers' },
      { name: 'For Players', href: '/help/getting-started/players' },
    ]
  },
  { name: 'Rules', href: '/help/rules', icon: ClipboardDocumentListIcon },
  { name: 'FAQ', href: '/help/faq', icon: QuestionMarkCircleIcon },
  {
    name: 'Guides',
    icon: AcademicCapIcon,
    children: [
      { name: 'Creating a Competition', href: '/help/guides/creating-competition' },
      { name: 'Managing Rounds', href: '/help/guides/managing-rounds' },
      { name: 'Joining a Competition', href: '/help/guides/joining-competition' },
      { name: 'Making Picks', href: '/help/guides/making-picks' },
    ]
  },
  { name: 'Support', href: '/help/support', icon: PhoneIcon },
];

export default function HelpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(['Getting Started', 'Guides']);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Check authentication status and validate token
  useEffect(() => {
    setMounted(true);

    const validateAuth = async () => {
      if (typeof window !== 'undefined') {
        // First check if tokens exist
        const hasAuth = checkAuth();

        if (hasAuth) {
          // If tokens exist, validate them by making a simple API call
          try {
            // Import the API dynamically to avoid server-side issues
            const { userApi } = await import('@/lib/api');
            // This will trigger 401 interceptor if token is invalid
            await userApi.getCurrentUser();
            setIsAuthenticated(true);
          } catch (error) {
            // Token is invalid or expired
            setIsAuthenticated(false);
            // The interceptor will have already cleared localStorage
          }
        } else {
          // No tokens found
          setIsAuthenticated(false);
        }
      }
    };

    // Validate auth on mount
    validateAuth();

    // Listen for storage changes (when auth state changes in other tabs/pages)
    const handleStorageChange = () => {
      validateAuth();
    };

    // Listen for auth-expired events from API interceptor
    const handleAuthExpired = () => {
      setIsAuthenticated(false);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth-expired', handleAuthExpired);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-expired', handleAuthExpired);
    };
  }, []);

  // Also re-check auth when the pathname changes (navigating to help from dashboard)
  useEffect(() => {
    if (mounted && typeof window !== 'undefined') {
      const hasAuth = checkAuth();
      if (hasAuth !== isAuthenticated) {
        setIsAuthenticated(hasAuth);
      }
    }
  }, [pathname, mounted]);

  const toggleSection = (sectionName: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionName)
        ? prev.filter(name => name !== sectionName)
        : [...prev, sectionName]
    );
  };

  const isActive = (href: string) => pathname === href;
  const isParentActive = (item: any) => {
    if (item.children) {
      return item.children.some((child: any) => pathname === child.href);
    }
    return false;
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link
                href={mounted && isAuthenticated ? "/dashboard" : "/"}
                className="text-lg font-bold text-slate-900"
              >
                LMSLocal
              </Link>
              <span className="mx-3 text-slate-300">/</span>
              <span className="text-lg font-medium text-slate-700">Help Center</span>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center space-x-6">
              {mounted && isAuthenticated ? (
                <Link href="/dashboard" className="text-sm text-slate-600 hover:text-slate-900">
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">
                    Home
                  </Link>
                  <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900">
                    Login
                  </Link>
                </>
              )}
            </nav>

            {/* Mobile menu button */}
            <button
              type="button"
              className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <XMarkIcon className="h-6 w-6" />
              ) : (
                <Bars3Icon className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row gap-8 py-8">
          {/* Sidebar - Desktop */}
          <aside className="hidden md:block w-64 flex-shrink-0">
            <nav className="sticky top-24 space-y-1">
              {navigation.map((item) => (
                <div key={item.name}>
                  {item.children ? (
                    <>
                      <button
                        onClick={() => toggleSection(item.name)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                          isParentActive(item)
                            ? 'bg-slate-100 text-slate-900'
                            : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <div className="flex items-center">
                          {item.icon && <item.icon className="h-5 w-5 mr-2" />}
                          {item.name}
                        </div>
                        <ChevronRightIcon
                          className={`h-4 w-4 transition-transform ${
                            expandedSections.includes(item.name) ? 'rotate-90' : ''
                          }`}
                        />
                      </button>
                      {expandedSections.includes(item.name) && (
                        <div className="ml-7 mt-1 space-y-1">
                          {item.children.map((child) => (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={`block px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                isActive(child.href)
                                  ? 'bg-slate-100 text-slate-900 font-medium'
                                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                              }`}
                            >
                              {child.name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      href={item.href}
                      className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        isActive(item.href)
                          ? 'bg-slate-100 text-slate-900'
                          : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      {item.icon && <item.icon className="h-5 w-5 mr-2" />}
                      {item.name}
                    </Link>
                  )}
                </div>
              ))}
            </nav>
          </aside>

          {/* Mobile Navigation Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden fixed inset-0 z-50 bg-white">
              <div className="flex items-center justify-between p-4 border-b border-slate-200">
                <span className="text-lg font-medium text-slate-900">Help Menu</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <nav className="p-4 space-y-1">
                {navigation.map((item) => (
                  <div key={item.name}>
                    {item.children ? (
                      <>
                        <button
                          onClick={() => toggleSection(item.name)}
                          className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg ${
                            isParentActive(item)
                              ? 'bg-slate-100 text-slate-900'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center">
                            {item.icon && <item.icon className="h-5 w-5 mr-2" />}
                            {item.name}
                          </div>
                          <ChevronRightIcon
                            className={`h-4 w-4 transition-transform ${
                              expandedSections.includes(item.name) ? 'rotate-90' : ''
                            }`}
                          />
                        </button>
                        {expandedSections.includes(item.name) && (
                          <div className="ml-7 mt-1 space-y-1">
                            {item.children.map((child) => (
                              <Link
                                key={child.href}
                                href={child.href}
                                onClick={() => setMobileMenuOpen(false)}
                                className={`block px-3 py-1.5 text-sm rounded-lg ${
                                  isActive(child.href)
                                    ? 'bg-slate-100 text-slate-900 font-medium'
                                    : 'text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                {child.name}
                              </Link>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <Link
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
                          isActive(item.href)
                            ? 'bg-slate-100 text-slate-900'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {item.icon && <item.icon className="h-5 w-5 mr-2" />}
                        {item.name}
                      </Link>
                    )}
                  </div>
                ))}
              </nav>
            </div>
          )}

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <article className="prose prose-slate max-w-none">
              {children}
            </article>
          </main>
        </div>
      </div>
    </div>
  );
}