/**
 * Verifica `narrative.pack` localmente, sem rede: decifra com NARRATIVE_KEY,
 * grava num PostgreSQL em memória (PGlite) e resolve o primeiro enigma usando
 * a PUZZLE_HMAC_KEY de produção. Não imprime chaves.
 * Uso: npm run narrative:verify
 */
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

const env = new Map<string, string>();
for (const line of readFileSync(".env.production.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env.set(m[1]!, m[2]!.trim());
}
// o motor lê a chave do ambiente; usa a de produção só neste processo
process.env.PUZZLE_HMAC_KEY = env.get("PUZZLE_HMAC_KEY");
process.env.IP_HASH_KEY = env.get("IP_HASH_KEY");
process.env.DATABASE_DRIVER = "pglite";
(process.env as Record<string, string>).NODE_ENV = "test";

const schema = await import("../src/server/db/schema");
const { runMigrations } = await import("../src/server/db/migrate");
const { setDbForTests } = await import("../src/server/db/client");
const { writeSeedRows } = await import("../src/server/narrative/seed");
const { decryptRows } = await import("../src/server/narrative/pack");
const { runCommand } = await import("../src/server/terminal/engine");

const client = new PGlite();
const db = drizzle(client, { schema }) as never;
setDbForTests(db, () => client.close());
await runMigrations(db);
const rows = decryptRows(JSON.parse(readFileSync("narrative.pack", "utf8")), env.get("NARRATIVE_KEY")!);
await writeSeedRows(db, rows);

const { sessions } = schema;
const [s] = await (db as unknown as { insert: Function }).insert(sessions).values({ tokenHash: "verify", expiresAt: new Date(Date.now() + 60_000) }).returning({ id: sessions.id });
const r = await runCommand(db, s.id, "scan memory", null);
const ok = r.lines.some((l) => /ASSINATURA DESCONHECIDA/.test(l.t));
console.log(ok ? "OK: pacote decifrado, gravado e primeiro enigma resolvido com a chave de produção." : "FALHA: o enigma não foi aceito.");
await client.close();
process.exit(ok ? 0 : 1);
