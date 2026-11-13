import "server-only";
import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { MIGRATIONS } from "./migrations";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = PgDatabase<PgQueryResultHKT, any>;

/**
 * Migrador mínimo e determinístico: aplica, em ordem e dentro de transações,
 * as migrações ainda não registradas em `schema_migrations`.
 */
export async function runMigrations(db: AnyDb): Promise<string[]> {
  await db.execute(
    sql`CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
  );
  const applied: string[] = [];
  for (const m of MIGRATIONS) {
    const done = await db.execute(sql`SELECT 1 FROM schema_migrations WHERE id = ${m.id}`);
    const rows = (done as unknown as { rows: unknown[] }).rows;
    if (rows.length > 0) continue;
    await db.transaction(async (tx) => {
      for (const statement of m.statements) {
        await tx.execute(sql.raw(statement));
      }
      await tx.execute(sql`INSERT INTO schema_migrations (id) VALUES (${m.id})`);
    });
    applied.push(m.id);
  }
  return applied;
}
