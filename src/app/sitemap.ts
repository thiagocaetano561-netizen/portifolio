import type { MetadataRoute } from "next";

/** Somente páginas públicas do portfólio. Nada da camada narrativa é listado. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.SITE_URL || "http://localhost:3000";
  return [
    { url: `${base}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/terminal`, changeFrequency: "monthly", priority: 0.5 },
  ];
}
