import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import { Suspense } from "react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { NavigationProgressBar } from "@/components/NavigationProgressBar";
import { ToastProvider } from "@/components/ToastProvider";
import Script from "next/script";
import fs from "fs";
import path from "path";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#6c5ce7" },
    { media: "(prefers-color-scheme: light)", color: "#6c5ce7" },
  ],
};

function loadSeo() {
  try {
    const configPath = path.join(process.cwd(), "src/config/seo.json");
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch {
    return {};
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const seo = loadSeo();

  const title = seo.title || "Nexora — The Privacy Protocol";
  const description =
    seo.description ||
    "Nexora is a military-grade encrypted private chat platform with real-time secure tunnels and zero-knowledge end-to-end encryption.";
  const keywords =
    seo.keywords ||
    "nexora, private chat, encrypted messaging, secure messenger, e2e encryption, privacy chat";
  const siteUrl = seo.siteUrl || "https://nexora31.vercel.app";
  const ogImage =
    seo.ogImage ||
    "https://res.cloudinary.com/dzpci7b5j/image/upload/v1774956459/logo_zsgzf2.svg";
  const twitterHandle = seo.twitterHandle || "@nexoraapp";
  const indexing = seo.indexing !== false; // default: index
  const robots = indexing
    ? seo.robots || "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
    : "noindex, nofollow";

  return {
    title: {
      default: title,
      template: seo.titleTemplate || `%s | Nexora`,
    },
    description,
    keywords: keywords.split(",").map((k: string) => k.trim()),
    authors: [{ name: seo.author || "Nexora Systems", url: siteUrl }],
    creator: seo.author || "Nexora Systems",
    publisher: "Nexora Systems",
    category: seo.category || "Technology",

    // ── Indexing / Robots ──
    robots: {
      index: indexing,
      follow: indexing,
      nocache: !indexing,
      googleBot: {
        index: indexing,
        follow: indexing,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },

    // ── Canonical ──
    alternates: {
      canonical: seo.canonicalUrl || siteUrl,
    },

    // ── Open Graph ──
    openGraph: {
      type: "website",
      locale: "en_US",
      url: siteUrl,
      siteName: "Nexora",
      title,
      description,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: "Nexora — The Privacy Protocol",
        },
      ],
    },

    // ── Twitter Card ──
    twitter: {
      card: "summary_large_image",
      site: twitterHandle,
      creator: twitterHandle,
      title,
      description,
      images: [ogImage],
    },

    // ── App / PWA ──
    manifest: "/manifest.json",
    icons: {
      icon: "/logo.svg",
      shortcut: "/logo.svg",
      apple: "/logo.svg",
    },

    // ── Verification (add if needed) ──
    // verification: { google: "your-token", yandex: "..." },

    // ── Meta extras ──
    other: {
      "msapplication-TileColor": seo.themeColor || "#6c5ce7",
      "application-name": "Nexora",
    },
  };
}

import { CallWrapper } from "@/components/Call/CallWrapper";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const seo = loadSeo();
  const siteUrl = seo.siteUrl || "https://nexora31.vercel.app";

  // JSON-LD Structured Data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Nexora",
    url: siteUrl,
    description: seo.description || "Military-grade encrypted private chat platform.",
    applicationCategory: "CommunicationApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    author: {
      "@type": "Organization",
      name: "Nexora Systems",
      url: siteUrl,
    },
    keywords: seo.keywords || "nexora, private chat, encrypted messaging",
  };

  return (
    <html lang={seo.language || "en"} className={`${inter.variable} h-full antialiased`}>
      <head>
        {/* Structured Data (JSON-LD) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* Theme color */}
        <meta name="theme-color" content={seo.themeColor || "#6c5ce7"} />
        {/* Mobile web app capable */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Nexora" />
        {/* Prevent phone number detection */}
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className="min-h-full flex flex-col">
        <Suspense fallback={null}>
          <NavigationProgressBar />
        </Suspense>
        <ToastProvider />
        <ThemeProvider>
          <CallWrapper>{children}</CallWrapper>
        </ThemeProvider>
        <SpeedInsights />
        <Analytics />
        {/* Umami Analytics */}
        <Script
          src={process.env.NEXT_PUBLIC_UMAMI_URL || "https://cloud.umami.is/script.js"}
          data-website-id={
            process.env.NEXT_PUBLIC_UMAMI_ID || "8d2fedf2-2c7d-4d48-9c83-de1260e2215b"
          }
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
