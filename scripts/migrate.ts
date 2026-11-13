import { loadEnvFiles } from "./load-env";
loadEnvFiles();

const { getDb, closeDb } = await import("../src/server/db/client");
const { runMigrations } = await import("../src/server/db/migrate");

const db = await getDb();
const applied = await runMigrations(db);
console.log(applied.length ? `migrações aplicadas: ${applied.join(", ")}` : "banco já está atualizado.");
await closeDb();
