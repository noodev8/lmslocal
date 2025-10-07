/*
=======================================================================================================================================
Admin Results Layout
=======================================================================================================================================
Purpose: Layout wrapper for admin results page with search engine blocking metadata
=======================================================================================================================================
*/

import { Metadata } from 'next';

// Prevent search engine indexing of this admin page
export const metadata: Metadata = {
  title: 'Admin Results | LMSLocal',
  description: 'Admin-only result entry',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function AdminResultsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
