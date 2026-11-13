import type { NextConfig } from "next";

/**
 * Headers aplicados a todas as respostas. A Content-Security-Policy das páginas
 * é gerada por requisição (com nonce) em `src/proxy.ts`; as APIs recebem uma
 * política própria, ainda mais restrita, definida abaixo.
 */
const baseSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), usb=(), serial=(), bluetooth=(), payment=(), interest-cohort=(), browsing-topics=()",
  },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Nunca publicar sourcemaps do navegador: eles reconstroem o código-fonte.
  productionBrowserSourceMaps: false,
  // Pacotes de banco de dados ficam fora do bundle e nunca chegam ao cliente.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // A pasta `narrative/` contém história e soluções. Ela só é lida pelo script de seed.
  outputFileTracingExcludes: {
    "*": ["./narrative/**", "./narrative.example/**", "./tests/**", "./docs/**", "./.data/**"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [],
  },
  async headers() {
    return [
      { source: "/:path*", headers: baseSecurityHeaders },
      {
        source: "/api/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'; base-uri 'none'" },
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
