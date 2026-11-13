import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { sessions } from "../db/schema";
import { randomToken, sha256, TOKEN_PATTERN } from "../security/crypto";
import { consume, LIMITS } from "../security/rate-limit";
import { RequestRejected } from "../security/request";
import { getEnv } from "../env";

export const SESSION_TTL_DAYS = 30;

export function sessionCookieName(): string {
  // O prefixo __Host- exige Secure, Path=/ e ausência de Domain: impede que
  // subdomínios ou conexões HTTP sobrescrevam o cookie.
  return getEnv().NODE_ENV === "production" ? "__Host-tp_sid" : "tp_sid";
}

export interface SessionContext {
  id: string;
  /** Presente apenas quando uma nova sessão foi criada e o cookie precisa ser emitido. */
  newToken?: string;
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header || header.length > 4096) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return null;
}

/**
 * Resolve a sessão anônima do visitante. Um token ausente, malformado,
 * desconhecido ou expirado nunca é "consertado": uma nova sessão vazia é criada.
 * Assim, alterar o cookie jamais concede progresso.
 */
export async function resolveSession(db: Db, req: Request, ipHash: string | null): Promise<SessionContext> {
  const token = readCookie(req, sessionCookieName());
  if (token && TOKEN_PATTERN.test(token)) {
    const rows = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date())))
      .limit(1);
    const found = rows[0];
    if (found) {
      await db
        .update(sessions)
        .set({ lastSeenAt: new Date() })
        .where(eq(sessions.id, found.id));
      return { id: found.id };
    }
  }

  if (ipHash) {
    const rl = await consume(db, LIMITS.sessionCreateIp, ipHash);
    if (!rl.allowed) throw new RequestRejected(429, "muitas sessões novas; aguarde", rl.retryAfterSeconds);
  }
  const newToken = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  const inserted = await db
    .insert(sessions)
    .values({ tokenHash: sha256(newToken), ipHash, expiresAt })
    .returning({ id: sessions.id });
  const row = inserted[0];
  if (!row) throw new Error("falha ao criar sessão");
  return { id: row.id, newToken };
}

/** Localiza uma sessão existente sem criar outra (leituras que não devem gerar sessões). */
export async function findSession(db: Db, req: Request): Promise<string | null> {
  const token = readCookie(req, sessionCookieName());
  if (!token || !TOKEN_PATTERN.test(token)) return null;
  const rows = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0]?.id ?? null;
}

export function sessionCookieHeader(token: string): string {
  const secure = getEnv().NODE_ENV === "production";
  const maxAge = SESSION_TTL_DAYS * 86_400;
  return [
    `${sessionCookieName()}=${token}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

export function clearSessionCookieHeader(): string {
  const secure = getEnv().NODE_ENV === "production";
  return [`${sessionCookieName()}=`, "Path=/", "Max-Age=0", "HttpOnly", "SameSite=Lax", ...(secure ? ["Secure"] : [])].join(
    "; ",
  );
}

export async function destroySession(db: Db, sessionId: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/** Remove sessões expiradas e dados antigos (cascata nas tabelas de progresso). */
export async function pruneExpired(db: Db) {
  await db.delete(sessions).where(sql`${sessions.expiresAt} < now()`);
  await db.execute(sql`DELETE FROM attempts WHERE created_at < now() - interval '7 days'`);
}
