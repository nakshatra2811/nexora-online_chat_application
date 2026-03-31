import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { NavigationProgressBar } from "@/components/NavigationProgressBar";
import Script from "next/script";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

import fs from "fs";
import path from "path";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: 'resizes-content'
};

export async function generateMetadata(): Promise<Metadata> {
  try {
    const configPath = path.join(process.cwd(), "src/config/seo.json");
    const data = fs.readFileSync(configPath, "utf-8");
    const seo = JSON.parse(data);
    return {
      title: seo.title || "Nexora",
      description: seo.description || "Encrypted Communication Protocol.",
      keywords: seo.keywords || "nexora",
    };
  } catch (err) {
    return {
      title: "Nexora — The Privacy Protocol",
      description: "Secure and private real-time communication platform.",
    };
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <NavigationProgressBar />
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <SpeedInsights />
        <Analytics />
        {/* Umami Analytics */}
        <Script
          src={process.env.NEXT_PUBLIC_UMAMI_URL || "https://cloud.umami.is/script.js"}
          data-website-id={process.env.NEXT_PUBLIC_UMAMI_ID || "8d2fedf2-2c7d-4d48-9c83-de1260e2215b"}
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
