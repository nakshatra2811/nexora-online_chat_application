import { MetadataRoute } from "next";
import fs from "fs";
import path from "path";

export default function sitemap(): MetadataRoute.Sitemap {
  try {
    const configPath = path.join(process.cwd(), "src/config/seo.json");
    const seo = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const siteUrl = seo.siteUrl || "https://nexora31.vercel.app";

    return [
      {
        url: siteUrl,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 1.0,
      },
      {
        url: `${siteUrl}/auth`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.8,
      },
      {
        url: `${siteUrl}/blog`,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 0.9,
      },
    ];
  } catch {
    return [
      {
        url: "https://nexora31.vercel.app",
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 1.0,
      },
      {
        url: "https://nexora31.vercel.app/blog",
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 0.9,
      },
    ];
  }
}
