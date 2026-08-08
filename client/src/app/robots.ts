import { MetadataRoute } from "next";
import fs from "fs";
import path from "path";

export default function robots(): MetadataRoute.Robots {
  try {
    const configPath = path.join(process.cwd(), "src/config/seo.json");
    const seo = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const siteUrl = seo.siteUrl || "https://nexora-online-chat-application-liart.vercel.app";
    const indexing = seo.indexing !== false;

    if (!indexing) {
      return {
        rules: { userAgent: "*", disallow: "/" },
      };
    }

    return {
      rules: [
        {
          userAgent: "*",
          allow: ["/", "/auth"],
          disallow: ["/dashboard/", "/admin/", "/api/"],
        },
      ],
      sitemap: `${siteUrl}/sitemap.xml`,
      host: siteUrl,
    };
  } catch {
    return {
      rules: { userAgent: "*", allow: "/" },
      sitemap: "https://nexora-online-chat-application-liart.vercel.app/sitemap.xml",
    };
  }
}
