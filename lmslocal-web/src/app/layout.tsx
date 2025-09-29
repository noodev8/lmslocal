import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ErrorBoundary from "@/components/ErrorBoundary";
import GlobalErrorHandler from "@/components/GlobalErrorHandler";
import { AppDataProvider } from "@/contexts/AppDataContext";
import CookieConsent from "@/components/CookieConsent";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LMSLocal - Last Man Standing Competitions Made Simple",
  description: "The easiest way to run or join Last Man Standing competitions. Perfect for pubs, workplaces, and friend groups. Start with 20 free players.",
  keywords: "last man standing, football competition, pub games, premier league, competition management, football predictor, elimination game",
  authors: [{ name: "LMSLocal" }],
  creator: "LMSLocal",
  publisher: "LMSLocal",
  metadataBase: new URL('https://lmslocal.co.uk'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: "LMSLocal - Last Man Standing Competitions Made Simple",
    description: "The easiest way to run or join Last Man Standing competitions. Perfect for pubs, workplaces, and friend groups. Start with 20 free players.",
    url: "https://lmslocal.co.uk",
    siteName: "LMSLocal",
    locale: "en_GB",
    type: "website",
    images: [{
      url: "/og-image.png",
      width: 1200,
      height: 630,
      alt: "LMSLocal - Last Man Standing Competitions Made Simple"
    }]
  },
  twitter: {
    card: "summary_large_image",
    title: "LMSLocal - Last Man Standing Competitions Made Simple",
    description: "The easiest way to run or join Last Man Standing competitions. Perfect for pubs, workplaces, and friend groups.",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ErrorBoundary>
          <GlobalErrorHandler />
          <AppDataProvider>
            {children}
          </AppDataProvider>
          <CookieConsent />
        </ErrorBoundary>
      </body>
    </html>
  );
}
