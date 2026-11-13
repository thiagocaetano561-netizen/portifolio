import { NextResponse, type NextRequest } from "next/server";

/**
 * Gera uma Content-Security-Policy estrita por requisição (nonce único).
 * Scripts só executam se vierem do próprio site com o nonce correto;
 * nenhum domínio externo é autorizado.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const httpsSite = (process.env.SITE_URL ?? "").startsWith("https://");

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    // atributos style= são usados por animações; não executam código.
    `style-src-attr 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    // vídeos cinematográficos são servidos pelo próprio site (nunca de terceiros)
    `media-src 'self'`,
    `object-src 'none'`,
    `frame-src 'none'`,
    `worker-src 'self'`,
    `manifest-src 'self'`,
    `base-uri 'none'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(httpsSite ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|brand|projects|media).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
