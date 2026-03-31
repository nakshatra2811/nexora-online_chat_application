import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

import fs from "fs";
import path from "path";

export const viewport: Metadata = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

// Next.js 14+ specific viewport config
export const viewportConfig = {
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
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
