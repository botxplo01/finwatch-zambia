import type { Metadata } from "next";
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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
