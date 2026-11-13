/**
 * Executado no build da Vercel (`vercel-build`), onde a URL do banco já existe
 * como variável secreta. Aplica as migrações e carrega a narrativa a partir do
 * pacote cifrado `narrative.pack`. Nenhum segredo é impresso.
 *
 * Sem NARRATIVE_KEY ou sem banco configurado, apenas pula (o build continua).
 */
import { existsSync, readFileSync } from "node:fs";

const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
const key = process.env.NARRATIVE_KEY;

if (!dbUrl || !key || !existsSync("narrative.pack")) {
  console.log("[deploy-seed] pulado: banco, NARRATIVE_KEY ou narrative.pack ausente.");
  process.exit(0);
}

const { Pool } = await import("pg");
const { drizzle } = await import("drizzle-orm/node-postgres");
const schema = await import("../src/server/db/schema");
const { runMigrations } = await import("../src/server/db/migrate");
const { writeSeedRows } = await import("../src/server/narrative/seed");
const { decryptRows } = await import("../src/server/narrative/pack");

const pool = new Pool({ connectionString: dbUrl, max: 1, connectionTimeoutMillis: 15_000 });
pool.on("error", () => console.error("[deploy-seed] erro em conexão ociosa"));
try {
  const db = drizzle(pool, { schema }) as never;
  const applied = await runMigrations(db);
  console.log(`[deploy-seed] migrações aplicadas: ${applied.length ? applied.join(", ") : "nenhuma (já atualizado)"}`);
  const rows = decryptRows(JSON.parse(readFileSync("narrative.pack", "utf8")), key);
  await writeSeedRows(db, rows);
  console.log(`[deploy-seed] narrativa ${rows.version} carregada: ${rows.challenges.length} desafios, ${rows.files.length} arquivos.`);
} catch (err) {
  // só o tipo/mensagem genérica: nada de URL ou chave nos logs
  console.error("[deploy-seed] falhou:", err instanceof Error ? `${err.name}: ${err.message.replace(/postgres(ql)?:\/\/\S+/g, "[url]")}` : "erro");
  process.exitCode = 1;
} finally {
  await pool.end();
}
