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
  description: "The easiest way to run or join Last Man Standing competitions. Perfect for pubs, workplaces, and friend groups. Free during beta.",
  keywords: "last man standing, football competition, pub games, premier league, competition management",
  openGraph: {
    title: "LMSLocal - Last Man Standing Competitions Made Simple",
    description: "The easiest way to run or join Last Man Standing competitions. Perfect for pubs, workplaces, and friend groups.",
    type: "website",
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
