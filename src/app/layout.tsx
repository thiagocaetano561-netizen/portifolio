import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { site } from "@/content/site";
import "@/styles/globals.css";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display-face", display: "swap", weight: ["400", "500", "600", "700"] });
const body = Inter({ subsets: ["latin"], variable: "--font-body-face", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-face", display: "swap" });

const siteUrl = process.env.SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: site.title, template: `%s · ${site.name}` },
  description: site.shortDescription,
  applicationName: site.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: site.name,
    title: site.title,
    description: site.shortDescription,
    url: "/",
  },
  twitter: { card: "summary_large_image", title: site.title, description: site.shortDescription },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: "#080D0D",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

/** Marca o documento antes da primeira pintura (revelações e boot sem "piscar"). */
const PRE_PAINT = `try{var d=document.documentElement;d.classList.add('js-ready');if(localStorage.getItem('tp_boot')==='1'||location.hash)d.classList.add('boot-seen')}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: PRE_PAINT }} />
      </head>
      <body>
        <div hidden dangerouslySetInnerHTML={{ __html: "<!-- para quem lê o código-fonte: você merece uma luz. tente 'lighthouse' no terminal. -->" }} />
        {children}
      </body>
    </html>
  );
}
