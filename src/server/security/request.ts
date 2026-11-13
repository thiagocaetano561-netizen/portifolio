import "server-only";
import { getEnv } from "../env";
import { hashIp } from "./crypto";

export const MAX_BODY_BYTES = 2048;
export const CLIENT_HEADER = "x-tryggport-client";

export class RequestRejected extends Error {
  constructor(
    public readonly status: number,
    public readonly publicMessage: string,
    public readonly retryAfter?: number,
  ) {
    super(publicMessage);
  }
}

/**
 * Proteção contra CSRF e chamadas de outros sites:
 * - exige Origin igual à origem do próprio site;
 * - rejeita Sec-Fetch-Site diferente de same-origin quando presente;
 * - exige um cabeçalho customizado (força preflight em requisições cross-site);
 * - exige JSON.
 * Os cookies de sessão também usam SameSite=Lax.
 */
export function assertSameOriginJson(req: Request) {
  const env = getEnv();
  const origin = req.headers.get("origin");
  const allowed = new Set<string>([new URL(env.SITE_URL).origin, new URL(req.url).origin]);
  if (!origin || !allowed.has(origin)) throw new RequestRejected(403, "origem não permitida");
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") throw new RequestRejected(403, "origem não permitida");
  if (req.headers.get(CLIENT_HEADER) !== "1") throw new RequestRejected(403, "cliente não reconhecido");
  const type = req.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) throw new RequestRejected(415, "tipo de conteúdo inválido");
}

export async function readJsonBody(req: Request): Promise<unknown> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) throw new RequestRejected(413, "requisição grande demais");
  const reader = req.body?.getReader();
  if (!reader) throw new RequestRejected(400, "entrada inválida");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new RequestRejected(413, "requisição grande demais");
    }
    chunks.push(value);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    throw new RequestRejected(400, "entrada inválida");
  }
}

/**
 * IP do cliente anonimizado (HMAC). Cabeçalhos de proxy só são aceitos quando
 * TRUST_PROXY=true (obrigatório em produção). Sem proxy confiável, retorna null
 * e os limites passam a ser aplicados apenas por sessão — nunca um bucket global
 * que permitiria a um visitante bloquear todos os outros.
 */
export function clientIpHash(req: Request): string | null {
  const env = getEnv();
  if (env.TRUST_PROXY !== "true") return null;
  const real = req.headers.get("x-real-ip");
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0];
  const ip = (real || fwd || "").trim().slice(0, 64);
  if (!ip) return null;
  return hashIp(env.IP_HASH_KEY, ip);
}
