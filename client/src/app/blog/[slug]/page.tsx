import type { Metadata } from "next";
import BlogPostClient from "./BlogPostClient";
import { API_BASE_URL } from "@/lib/config";

// Fetch one blog post by slug
async function fetchPost(slug: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/blogs/slug/${encodeURIComponent(slug)}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.blog || null;
  } catch {
    return null;
  }
}

// ── Dynamic OG / Twitter card metadata per post ──
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchPost(slug);
  const siteUrl = "https://nexora-online-chat-application.vercel.app";

  if (!post) {
    return { title: "Blog | Nexora", description: "Nexora Blog" };
  }

  const title = `${post.title} | Nexora Blog`;
  const description = post.excerpt?.slice(0, 160) || "Read this article on Nexora Blog.";
  const image = post.image && !post.image.endsWith('.svg')
    ? post.image
    : `${siteUrl}/icon.png`;
  const url = `${siteUrl}/blog/${slug}`;

  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    openGraph: {
      type: "article",
      url,
      title,
      description,
      siteName: "Nexora",
      images: [
        {
          url: image.startsWith("http") ? image : `${siteUrl}${image.startsWith("/") ? "" : "/"}${image}`,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
      publishedTime: post.date,
      authors: [post.author],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.startsWith("http") ? image : `${siteUrl}${image.startsWith("/") ? "" : "/"}${image}`],
      creator: "@nexoraapp",
    },
    icons: {
      icon: "/icon.png",
      shortcut: "/icon.png",
      apple: "/icon.png",
    },
    alternates: { canonical: url },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await fetchPost(slug);
  return <BlogPostClient post={post} slug={slug} />;
}
