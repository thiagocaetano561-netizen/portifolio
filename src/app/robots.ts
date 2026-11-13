import type { MetadataRoute } from "next";

/** robots.txt é apenas uma cortesia para buscadores — nunca um mecanismo de proteção. */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.SITE_URL || "http://localhost:3000";
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: "/api/" }],
    sitemap: `${base}/sitemap.xml`,
  };
}
