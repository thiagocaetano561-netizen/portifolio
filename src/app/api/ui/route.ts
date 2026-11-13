import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { consume, LIMITS } from "@/server/security/rate-limit";
import { assertSameOriginJson, clientIpHash, readJsonBody, RequestRejected } from "@/server/security/request";
import { findSession } from "@/server/sessions/session";
import { runUi } from "@/server/terminal/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const BodySchema = z.object({}).strict();

/**
 * Estado visual autorizado da sessão (pistas da interface). Nunca cria sessão:
 * um visitante sem sessão recebe slots vazios. O conteúdo de cada slot só existe
 * no banco e só é enviado depois que o servidor confirma as condições.
 */
export async function POST(req: Request) {
  try {
    assertSameOriginJson(req);
    const parsed = BodySchema.safeParse(await readJsonBody(req));
    if (!parsed.success) throw new RequestRejected(400, "entrada inválida");
    const db = await getDb();
    const ipHash = clientIpHash(req);
    if (ipHash) {
      const rl = await consume(db, LIMITS.signalIp, ipHash);
      if (!rl.allowed) throw new RequestRejected(429, "muitas requisições; aguarde um pouco", rl.retryAfterSeconds);
    }
    const sessionId = await findSession(db, req);
    return NextResponse.json(await runUi(db, sessionId), { headers: NO_STORE });
  } catch (error) {
    if (error instanceof RequestRejected) {
      const headers: Record<string, string> = { ...NO_STORE };
      if (error.retryAfter) headers["Retry-After"] = String(error.retryAfter);
      return NextResponse.json({ error: error.publicMessage }, { status: error.status, headers });
    }
    console.error("[api/ui] falha interna:", error instanceof Error ? error.name : typeof error);
    return NextResponse.json({ error: "erro interno — tente novamente" }, { status: 500, headers: NO_STORE });
  }
}

export function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } });
}
