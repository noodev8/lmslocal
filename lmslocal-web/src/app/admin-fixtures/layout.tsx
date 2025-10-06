/*
=======================================================================================================================================
Admin Fixtures Layout
=======================================================================================================================================
Purpose: Layout wrapper for admin fixtures page with search engine blocking metadata
=======================================================================================================================================
*/

import { Metadata } from 'next';

// Prevent search engine indexing of this admin page
export const metadata: Metadata = {
  title: 'Admin Fixtures | LMSLocal',
  description: 'Admin-only fixture management',
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

export default function AdminFixturesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
