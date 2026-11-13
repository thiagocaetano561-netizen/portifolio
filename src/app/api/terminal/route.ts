import { z } from "zod";
import { MAX_INPUT_LENGTH } from "@/lib/terminal/protocol";
import { handleSessionRequest, LIMITS } from "@/server/http/handler";
import { RequestRejected } from "@/server/security/request";
import { destroySession } from "@/server/sessions/session";
import { runCommand } from "@/server/terminal/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({ input: z.string().max(MAX_INPUT_LENGTH) }).strict();

export async function POST(req: Request) {
  return handleSessionRequest(req, { ip: LIMITS.terminalIp, session: LIMITS.terminalSession }, async ({ db, session, body, ipHash }) => {
    const parsed = BodySchema.safeParse(body);
    // Nenhum detalhe de validação é devolvido ao cliente.
    if (!parsed.success) throw new RequestRejected(400, "entrada inválida");
    const result = await runCommand(db, session.id, parsed.data.input, ipHash);
    if (result.endSession) {
      await destroySession(db, session.id);
      const { endSession: _ignored, ...rest } = result;
      return { body: rest, clearSession: true };
    }
    return { body: result };
  });
}

export function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } });
}
