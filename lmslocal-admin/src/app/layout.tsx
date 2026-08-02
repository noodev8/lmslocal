import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LMSLocal Admin',
  description: 'Internal administration tool',
  // Internal tool - never index. next.config.js sets the matching X-Robots-Tag header.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
