'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { XMarkIcon } from '@heroicons/react/24/outline';

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if user has already consented
    const hasConsented = localStorage.getItem('cookie-consent');
    if (!hasConsented) {
      setShowBanner(true);
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem('cookie-consent', 'accepted');
    setShowBanner(false);
  };

  const rejectCookies = () => {
    localStorage.setItem('cookie-consent', 'rejected');
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900 text-white p-4 shadow-lg border-t border-slate-700 z-50">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
        <div className="flex-1 pr-4">
          <p className="text-sm text-slate-300">
            We use essential cookies to provide our service and improve your experience.
            By continuing to use LMSLocal, you consent to our use of cookies.{' '}
            <Link href="/privacy" className="text-white underline hover:text-slate-200">
              Learn more
            </Link>
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={rejectCookies}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white border border-slate-600 rounded-lg hover:border-slate-500 transition-colors"
          >
            Reject
          </button>
          <button
            onClick={acceptCookies}
            className="px-4 py-2 text-sm font-medium bg-white text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Accept
          </button>
          <button
            onClick={rejectCookies}
            className="p-2 text-slate-400 hover:text-white transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}