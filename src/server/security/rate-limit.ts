import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "../db/client";

export interface RateLimitRule {
  /** Prefixo do bucket, ex.: "term:ip". */
  name: string;
  limit: number;
  windowSeconds: number;
}

export const LIMITS = {
  terminalIp: { name: "term:ip", limit: 90, windowSeconds: 60 },
  terminalSession: { name: "term:sid", limit: 45, windowSeconds: 60 },
  signalIp: { name: "sig:ip", limit: 30, windowSeconds: 60 },
  sessionCreateIp: { name: "new:ip", limit: 20, windowSeconds: 3600 },
} satisfies Record<string, RateLimitRule>;

/** Falhas de resposta somadas entre sessões do mesmo IP (impede trocar cookie para burlar limites). */
export const IP_FAILURE_LIMIT = { limit: 80, windowSeconds: 3600 };

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Janela fixa atômica no PostgreSQL (INSERT ... ON CONFLICT ... RETURNING).
 * Funciona com várias instâncias da aplicação sem depender de memória local.
 */
export async function consume(db: Db, rule: RateLimitRule, subject: string): Promise<RateLimitResult> {
  const nowMs = Date.now();
  const windowMs = rule.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(nowMs / windowMs) * windowMs);
  const key = `${rule.name}:${subject}`;
  const result = await db.execute(sql`
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (${key}, ${windowStart.toISOString()}::timestamptz, 1)
    ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
    RETURNING count
  `);
  const rows = (result as unknown as { rows: Array<{ count: number | string }> }).rows;
  const count = Number(rows[0]?.count ?? rule.limit + 1);
  const retryAfterSeconds = Math.max(1, Math.ceil((windowStart.getTime() + windowMs - nowMs) / 1000));
  return { allowed: count <= rule.limit, remaining: Math.max(0, rule.limit - count), retryAfterSeconds };
}

/** Limpeza oportunista de janelas antigas. */
export async function pruneRateLimits(db: Db) {
  await db.execute(sql`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`);
}
