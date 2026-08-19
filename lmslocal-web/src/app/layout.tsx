import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Big_Shoulders,
  Instrument_Sans,
  Courier_Prime,
} from "next/font/google";
import "./globals.css";
import ErrorBoundary from "@/components/ErrorBoundary";
import GlobalErrorHandler from "@/components/GlobalErrorHandler";
import { AppDataProvider } from "@/contexts/AppDataContext";
import CookieConsent from "@/components/CookieConsent";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Landing page faces: signage display, form body, typewriter data.
const bigShoulders = Big_Shoulders({
  variable: "--font-big-shoulders",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
});

const courierPrime = Courier_Prime({
  variable: "--font-courier-prime",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LMSLocal - Run a Last Man Standing Competition That Raises Money",
  description: "Set up a Last Man Standing competition for your pub, club or workplace. You set the entry fee and the prize and keep what is left. Twenty player places free, for as long as you run it.",
  keywords: "last man standing, run a last man standing competition, pub fundraiser, club fundraising, football competition, sweepstake alternative, competition management, elimination game",
  authors: [{ name: "LMSLocal" }],
  creator: "LMSLocal",
  publisher: "LMSLocal",
  metadataBase: new URL('https://lmslocal.co.uk'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: "LMSLocal - Run a Last Man Standing Competition That Raises Money",
    description: "Set up a Last Man Standing competition for your pub, club or workplace. You set the entry fee and the prize and keep what is left. Twenty player places free, for as long as you run it.",
    url: "https://lmslocal.co.uk",
    siteName: "LMSLocal",
    locale: "en_GB",
    type: "website",
    images: [{
      url: "/og-image.png",
      width: 1200,
      height: 630,
      alt: "LMSLocal - Run a Last Man Standing Competition That Raises Money"
    }]
  },
  twitter: {
    card: "summary_large_image",
    title: "LMSLocal - Run a Last Man Standing Competition That Raises Money",
    description: "Set up a Last Man Standing competition for your pub, club or workplace. You set the entry fee and the prize and keep what is left. Twenty player places free, for as long as you run it.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${bigShoulders.variable} ${instrumentSans.variable} ${courierPrime.variable} antialiased`}
      >
        <ErrorBoundary>
          <GlobalErrorHandler />
          <AppDataProvider>
            {children}
          </AppDataProvider>
          <CookieConsent />
          {/*
            Vercel Web Analytics. Counts page views by path, which is what makes
            the mailshot measurable: /club-a and /club-b are reached only by
            scanning a leaflet, so their view counts are scan counts.
            See docs/marketing-mailshot.md §7.

            Cookieless and stores no personal data, so it sits outside
            CookieConsent deliberately rather than behind it.

            Page views are all the Hobby plan collects — custom events and UTM
            parameters are Pro features. Do not rewrite the leaflet tracking to
            use either without checking the plan first.
          */}
          <Analytics />
        </ErrorBoundary>
      </body>
    </html>
  );
}
