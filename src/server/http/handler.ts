import "server-only";
import { NextResponse } from "next/server";
import { getDb, type Db } from "../db/client";
import { consume, LIMITS, pruneRateLimits, type RateLimitRule } from "../security/rate-limit";
import { assertSameOriginJson, clientIpHash, readJsonBody, RequestRejected } from "../security/request";
import { clearSessionCookieHeader, pruneExpired, resolveSession, sessionCookieHeader, type SessionContext } from "../sessions/session";

export interface HandlerContext {
  db: Db;
  session: SessionContext;
  body: unknown;
  ipHash: string | null;
}

export interface HandlerResult {
  body: unknown;
  /** Encerra a sessão anônima atual (logout). */
  clearSession?: boolean;
}

const NO_STORE = { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" };

function errorResponse(status: number, message: string, retryAfter?: number) {
  const headers: Record<string, string> = { ...NO_STORE };
  if (retryAfter) headers["Retry-After"] = String(retryAfter);
  return NextResponse.json({ error: message }, { status, headers });
}

/**
 * Pipeline comum das APIs: origem → corpo limitado → limites por IP →
 * sessão → limites por sessão → ação. Erros inesperados nunca expõem
 * mensagens internas, consultas, variáveis de ambiente ou stack traces.
 */
export async function handleSessionRequest(
  req: Request,
  limits: { ip: RateLimitRule; session?: RateLimitRule },
  action: (ctx: HandlerContext) => Promise<HandlerResult>,
): Promise<Response> {
  try {
    assertSameOriginJson(req);
    const body = await readJsonBody(req);
    const db = await getDb();
    const ipHash = clientIpHash(req);
    if (ipHash) {
      const rl = await consume(db, limits.ip, ipHash);
      if (!rl.allowed) return errorResponse(429, "muitas requisições; aguarde um pouco", rl.retryAfterSeconds);
    }
    const session = await resolveSession(db, req, ipHash);
    if (limits.session) {
      const rl = await consume(db, limits.session, session.id);
      if (!rl.allowed) return errorResponse(429, "muitas requisições; aguarde um pouco", rl.retryAfterSeconds);
    }

    const result = await action({ db, session, body, ipHash });

    const res = NextResponse.json(result.body, { status: 200, headers: NO_STORE });
    if (result.clearSession) res.headers.append("Set-Cookie", clearSessionCookieHeader());
    else if (session.newToken) res.headers.append("Set-Cookie", sessionCookieHeader(session.newToken));

    if (Math.random() < 0.01) {
      // Manutenção oportunista; falhas aqui não afetam a resposta.
      void Promise.all([pruneExpired(db), pruneRateLimits(db)]).catch(() => undefined);
    }
    return res;
  } catch (error) {
    if (error instanceof RequestRejected) return errorResponse(error.status, error.publicMessage, error.retryAfter);
    // Registra apenas o tipo do erro: mensagens podem conter dados da requisição.
    console.error("[api] falha interna:", error instanceof Error ? error.name : typeof error);
    return errorResponse(500, "erro interno — tente novamente");
  }
}

export { LIMITS };
