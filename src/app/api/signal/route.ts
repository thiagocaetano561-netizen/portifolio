import { z } from "zod";
import { SIGNAL_KINDS } from "@/lib/terminal/protocol";
import { handleSessionRequest, LIMITS } from "@/server/http/handler";
import { RequestRejected } from "@/server/security/request";
import { runSignal } from "@/server/terminal/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({ kind: z.enum(SIGNAL_KINDS) }).strict();

/**
 * Recebe sinais genéricos da interface visual. O navegador só sabe que um
 * gesto aconteceu; se ele significa algo, quem decide é o servidor.
 */
export async function POST(req: Request) {
  return handleSessionRequest(req, { ip: LIMITS.signalIp, session: LIMITS.terminalSession }, async ({ db, session, body }) => {
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) throw new RequestRejected(400, "entrada inválida");
    return { body: await runSignal(db, session.id, parsed.data.kind) };
  });
}

export function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } });
}
