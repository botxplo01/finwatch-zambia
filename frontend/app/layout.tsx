/**
 * FinWatch Zambia - Root Layout
 */

import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { TutorialProvider } from "@/context/TutorialContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinWatch Zambia",
  description: "ML-Based Financial Distress Prediction for Zambian SMEs",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <ErrorBoundary>
          <TutorialProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="light"
              enableSystem={false}
              disableTransitionOnChange
            >
              {children}
            </ThemeProvider>
          </TutorialProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
