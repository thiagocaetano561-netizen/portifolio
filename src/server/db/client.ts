import "server-only";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import { getEnv } from "../env";
import { runMigrations } from "./migrate";
import { MIGRATIONS } from "./migrations";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

interface Holder {
  db: Promise<Db> | null;
  close: (() => Promise<void>) | null;
  /** Quantidade de migrações aplicadas por esta conexão (PGlite em dev). */
  migrations?: number;
}

// Sobrevive ao hot-reload do Next em desenvolvimento.
const g = globalThis as unknown as { __tryggportDb?: Holder };
const holder: Holder = (g.__tryggportDb ??= { db: null, close: null });

async function create(): Promise<Db> {
  const env = getEnv();
  if (env.DATABASE_DRIVER === "pg") {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      // Evita consultas presas indefinidamente.
      statement_timeout: 5_000,
    });
    // Erros de clientes ociosos não devem derrubar o processo nem vazar detalhes.
    pool.on("error", () => console.error("[db] erro em conexão ociosa do pool"));
    holder.close = () => pool.end();
    return drizzle(pool, { schema }) as unknown as Db;
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  let releaseLock = () => {};
  if (env.NODE_ENV !== "test") {
    const { mkdirSync } = await import("node:fs");
    mkdirSync(env.PGLITE_DIR, { recursive: true });
    releaseLock = await acquirePgliteLock(env.PGLITE_DIR);
  }
  const client = new PGlite(env.NODE_ENV === "test" ? undefined : env.PGLITE_DIR);
  await client.waitReady;
  const db = drizzle(client, { schema }) as unknown as Db;
  // PGlite é local: aplica as migrações automaticamente em desenvolvimento.
  await runMigrations(db);
  holder.migrations = MIGRATIONS.length;
  holder.close = async () => {
    await client.close();
    releaseLock();
  };
  return db;
}

/**
 * O PGlite não suporta dois processos no mesmo diretório (ex.: `npm run dev`
 * aberto enquanto `npm run db:seed` roda). Um arquivo de trava com o PID impede
 * isso e explica o que fazer, em vez de deixar o banco divergir em silêncio.
 */
async function acquirePgliteLock(dir: string): Promise<() => void> {
  const { readFileSync, writeFileSync, rmSync } = await import("node:fs");
  const lock = `${dir.replace(/[\\/]+$/, "")}.lock`;
  try {
    const pid = Number(readFileSync(lock, "utf8").trim());
    if (pid && pid !== process.pid) {
      let alive = false;
      try {
        process.kill(pid, 0);
        alive = true;
      } catch {
        alive = false;
      }
      if (alive) {
        throw new Error(
          `O banco de desenvolvimento (${dir}) já está aberto por outro processo (PID ${pid}). ` +
            "Pare o `npm run dev` antes de rodar seed/migrate, ou vice-versa.",
        );
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("O banco de desenvolvimento")) throw err;
    // sem trava anterior (ou trava ilegível): segue
  }
  writeFileSync(lock, String(process.pid));
  const release = () => {
    try {
      if (readFileSync(lock, "utf8").trim() === String(process.pid)) rmSync(lock);
    } catch {
      /* já removida */
    }
  };
  process.once("exit", release);
  return release;
}

export function getDb(): Promise<Db> {
  if (!holder.db) {
    holder.db = create().catch((err) => {
      holder.db = null;
      throw err;
    });
  } else if (holder.migrations !== undefined && holder.migrations !== MIGRATIONS.length) {
    // Em desenvolvimento a conexão sobrevive ao hot-reload: se o código trouxe
    // migrações novas, aplica-as antes de qualquer consulta.
    const current = holder.db;
    holder.migrations = MIGRATIONS.length;
    holder.db = current.then(async (db) => {
      await runMigrations(db);
      return db;
    });
  }
  return holder.db;
}

/** Testes e scripts. */
export async function closeDb() {
  const close = holder.close;
  holder.db = null;
  holder.close = null;
  if (close) await close();
}

/** Testes: injeta um banco já criado. */
export function setDbForTests(db: Db, close?: () => Promise<void>) {
  holder.db = Promise.resolve(db);
  holder.close = close ?? null;
}
