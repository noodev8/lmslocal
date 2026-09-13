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
import SiteSchema from "@/components/public/SiteSchema";
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

/*
  TITLE AND DESCRIPTION ARE TUNED FOR CLICK-THROUGH, NOT FOR US.

  Search Console, Sept 2026: the two highest-impression terms were "last man standing football"
  (648 impressions, average position 7.6) and "lms football" (306, position 5.5), converting at
  1.7% and 0.7%. At those positions 5-8% is normal. The old title led with "Run a Last Man
  Standing Competition That Raises Money" and never said "football" - people scan the results
  for their own words, did not see them, and scrolled past a result they were already ranking
  for. Impressions were never the problem; the snippet was.

  So the title leads with the phrase people type, not with the brand. LMSLocal means nothing to
  a stranger yet, and putting it first spends the most valuable characters on a word nobody is
  searching for.

  Keep "football" in the title. If you rewrite this, check the query report first
  (scripts/seo/gsc_client.py, property sc-domain:lmslocal.co.uk) rather than guessing.

  Two claims are deliberately worded to promise nothing about the future (Andreas, 2026-09-13).
  The free tier says "First twenty player places free" and NOT "free for good" - neither the
  twenty nor the free is fixed, and a snippet promising permanence is the one that gets quoted
  back at us. The fixture service is stated flat rather than hedged, because ~99% of new
  organisers take it and it is not currently charged for; it is still per-competition in the
  data model, so anything more specific than "handled for you" belongs on the pricing page,
  where it can change, and not in metadata.
*/
export const metadata: Metadata = {
  title: "Run a Last Man Standing Football Competition | LMSLocal",
  description: "Set up a Last Man Standing football competition for your pub, club or workplace. Fixtures and results handled for you. First twenty player places free.",
  keywords: "last man standing, last man standing football, last man standing app, run a last man standing competition, lms football, pub fundraiser, club fundraising, football competition, sweepstake alternative, competition management, elimination game",
  authors: [{ name: "LMSLocal" }],
  creator: "LMSLocal",
  publisher: "LMSLocal",
  metadataBase: new URL('https://lmslocal.co.uk'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    // Share cards, not search results: no "| LMSLocal" tail, and the description stays the
    // money one, because a link pasted into WhatsApp is read by someone who was sent it rather
    // than someone scanning ten competing snippets.
    title: "Run a Last Man Standing Football Competition",
    description: "Set up a Last Man Standing competition for your pub, club or workplace. You set the entry fee and the prize and keep what is left. Twenty player places free, for as long as you run it.",
    url: "https://lmslocal.co.uk",
    siteName: "LMSLocal",
    locale: "en_GB",
    type: "website",
    images: [{
      url: "/og-image.png",
      width: 1200,
      height: 630,
      alt: "LMSLocal - Run a Last Man Standing Football Competition"
    }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Run a Last Man Standing Football Competition",
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
        {/* Who we are, what the site is and what it costs, in one place - see the component. */}
        <SiteSchema />
        <ErrorBoundary>
          <GlobalErrorHandler />
          <AppDataProvider>
            {children}
          </AppDataProvider>
          <CookieConsent />
          {/*
            Vercel Web Analytics. Counts page views by path, which is what makes
            the mailshot measurable: /club-a, /club-b and /bar-a are reached
            only by scanning a leaflet, so their view counts are scan counts.
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
