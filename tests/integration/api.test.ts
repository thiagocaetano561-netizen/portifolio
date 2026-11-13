import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createTestDb } from "../helpers/db";
import type { Db } from "@/server/db/client";
import { POST as terminalPOST, GET as terminalGET } from "@/app/api/terminal/route";
import { POST as signalPOST } from "@/app/api/signal/route";
import { POST as uiPOST, GET as uiGET } from "@/app/api/ui/route";

/**
 * Testes da API sem nenhuma solução de enigma: cobrem origem, CSRF, schemas,
 * cookies, adulteração de sessão, limites e vazamento de erros.
 */

const ORIGIN = "http://localhost:3000";
let ipCounter = 0;

function req(body: unknown, opts: { headers?: Record<string, string>; raw?: string; path?: string } = {}) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    origin: ORIGIN,
    "x-tryggport-client": "1",
    "x-real-ip": `10.0.0.${++ipCounter % 250}`,
    ...opts.headers,
  };
  for (const [k, v] of Object.entries(headers)) if (v === "") delete headers[k];
  return new Request(`${ORIGIN}${opts.path ?? "/api/terminal"}`, {
    method: "POST",
    headers,
    body: opts.raw ?? JSON.stringify(body),
  });
}

function cookieFrom(res: Response) {
  const set = res.headers.get("set-cookie") ?? "";
  return set.split(";")[0] ?? "";
}

describe("API do terminal", () => {
  let db: Db;
  let close: () => Promise<void>;
  beforeAll(async () => {
    ({ db, close } = await createTestDb({ seed: false }));
  });
  afterAll(async () => close());

  it("aceita uma requisição legítima e emite cookie seguro", async () => {
    const res = await terminalPOST(req({ input: "help" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.lines[0].t).toBe("COMANDOS DISPONÍVEIS");
    const set = res.headers.get("set-cookie") ?? "";
    expect(set).toMatch(/HttpOnly/);
    expect(set).toMatch(/SameSite=Lax/);
    expect(set).toMatch(/Path=\//);
    expect(res.headers.get("cache-control")).toMatch(/no-store/);
  });

  it("rejeita origem ausente, outra origem e cabeçalho de cliente ausente (CSRF)", async () => {
    expect((await terminalPOST(req({ input: "help" }, { headers: { origin: "" } }))).status).toBe(403);
    expect((await terminalPOST(req({ input: "help" }, { headers: { origin: "https://evil.example" } }))).status).toBe(403);
    expect((await terminalPOST(req({ input: "help" }, { headers: { "x-tryggport-client": "" } }))).status).toBe(403);
    expect((await terminalPOST(req({ input: "help" }, { headers: { "sec-fetch-site": "cross-site" } }))).status).toBe(403);
    expect((await terminalPOST(req({ input: "help" }, { headers: { "content-type": "text/plain" } }))).status).toBe(415);
  });

  it("valida o corpo com schema e não devolve detalhes de validação", async () => {
    const bad = [
      req(null, { raw: "{not json" }),
      req({ input: 42 }),
      req({ input: "help", progress: { chapter: 6 } }),
      req({ input: "x".repeat(201) }),
      req({}),
    ];
    for (const r of bad) {
      const res = await terminalPOST(r);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "entrada inválida" });
    }
  });

  it("limita o tamanho do corpo", async () => {
    const res = await terminalPOST(req(null, { raw: JSON.stringify({ input: "a", pad: "x".repeat(5000) }) }));
    expect(res.status).toBe(413);
  });

  it("um cookie adulterado nunca recupera progresso: cria uma sessão vazia", async () => {
    const first = await terminalPOST(req({ input: "cd /etc" }));
    const cookie = cookieFrom(first);
    expect(cookie).toMatch(/^tp_sid=/);
    const same = await terminalPOST(req({ input: "pwd" }, { headers: { cookie } }));
    expect((await same.json()).lines[0].t).toBe("/etc");
    expect(same.headers.get("set-cookie")).toBeNull();

    const value = cookie.split("=")[1]!;
    const tampered = `tp_sid=${value.slice(0, -1)}${value.endsWith("A") ? "B" : "A"}`;
    const res = await terminalPOST(req({ input: "pwd" }, { headers: { cookie: tampered } }));
    expect((await res.json()).lines[0].t).toBe("/home/visitor");
    expect(res.headers.get("set-cookie")).toMatch(/tp_sid=/);

    for (const junk of ["tp_sid=../../etc", "tp_sid=' OR 1=1 --", `tp_sid=${"x".repeat(5000)}`]) {
      const r = await terminalPOST(req({ input: "pwd" }, { headers: { cookie: junk } }));
      expect(r.status).toBe(200);
      expect((await r.json()).lines[0].t).toBe("/home/visitor");
    }
  });

  it("aplica limite por sessão", async () => {
    const first = await terminalPOST(req({ input: "pwd" }));
    const cookie = cookieFrom(first);
    let limited = 0;
    for (let i = 0; i < 50; i++) {
      const r = await terminalPOST(req({ input: "pwd" }, { headers: { cookie } }));
      if (r.status === 429) {
        limited++;
        expect(r.headers.get("retry-after")).toMatch(/^\d+$/);
      }
    }
    expect(limited).toBeGreaterThan(0);
  });

  it("aplica limite por IP e de criação de sessões", async () => {
    let limited = false;
    for (let i = 0; i < 30 && !limited; i++) {
      const r = await terminalPOST(req({ input: "pwd" }, { headers: { "x-real-ip": "203.0.113.9" } }));
      if (r.status === 429) limited = true;
    }
    expect(limited).toBe(true);
  });

  it("logout apaga a sessão e o cookie", async () => {
    const first = await terminalPOST(req({ input: "pwd" }));
    const cookie = cookieFrom(first);
    const out = await terminalPOST(req({ input: "logout --confirm" }, { headers: { cookie } }));
    expect(out.headers.get("set-cookie")).toMatch(/Max-Age=0/);
    const after = await terminalPOST(req({ input: "pwd" }, { headers: { cookie } }));
    expect(after.headers.get("set-cookie")).toMatch(/tp_sid=/);
  });

  it("erros internos não vazam detalhes", async () => {
    await db.execute(sql`ALTER TABLE command_log RENAME TO command_log_off`);
    try {
      const res = await terminalPOST(req({ input: "pwd" }));
      expect(res.status).toBe(500);
      const body = await res.text();
      expect(body).toBe(JSON.stringify({ error: "erro interno — tente novamente" }));
      expect(body).not.toMatch(/command_log|relation|postgres|stack|HMAC|KEY/i);
    } finally {
      await db.execute(sql`ALTER TABLE command_log_off RENAME TO command_log`);
    }
  });

  it("GET não é aceito", async () => {
    expect(terminalGET().status).toBe(405);
  });

  it("sinais aceitam apenas tipos conhecidos", async () => {
    const ok = await signalPOST(req({ kind: "lost" }, { path: "/api/signal" }));
    expect(ok.status).toBe(200);
    const bad = await signalPOST(req({ kind: "unlock_everything" }, { path: "/api/signal" }));
    expect(bad.status).toBe(400);
  });

  it("estado da interface: sem sessão não cria sessão nem libera pistas", async () => {
    const res = await uiPOST(req({}, { path: "/api/ui" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ slots: {} });
    expect(res.headers.get("set-cookie")).toBeNull();
    expect((await uiPOST(req({ slot: "hero.glyphs" }, { path: "/api/ui" }))).status).toBe(400);
    expect((await uiPOST(req({}, { path: "/api/ui", headers: { origin: "https://evil.example" } }))).status).toBe(403);
    expect(uiGET().status).toBe(405);
  });

  it("hint funciona sem revelar enigmas inexistentes", async () => {
    const res = await terminalPOST(req({ input: "hint 99" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(JSON.stringify(json)).not.toMatch(/undefined|null/);
  });

  it("comandos de sistema nunca executam nada real", async () => {
    for (const input of ["curl https://example.com", "ssh root@localhost", "rm -rf node_modules", "cat /etc/passwd", "cat .env", "kill 1"]) {
      const res = await terminalPOST(req({ input }));
      const json = await res.json();
      const textOut = json.lines.map((l: { t: string }) => l.t).join("\n");
      expect(textOut).not.toMatch(/root:x:|DATABASE_URL|PUZZLE_HMAC_KEY|<html/i);
    }
  });
});
