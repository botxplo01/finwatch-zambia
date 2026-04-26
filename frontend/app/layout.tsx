/**
 * FinWatch Zambia - Root Layout
 *
 * Root layout with Geist fonts and theme provider.
 * Sets up HTML structure and metadata for the entire application.
 */

import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinWatch Zambia",
  description: "ML-Based Financial Distress Prediction for Zambian SMEs",
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
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
