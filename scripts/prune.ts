/** Remove sessões expiradas, tentativas antigas e janelas de rate limit vencidas. Ideal para um cron diário. */
import { loadEnvFiles } from "./load-env";
loadEnvFiles();

const { getDb, closeDb } = await import("../src/server/db/client");
const { pruneExpired } = await import("../src/server/sessions/session");
const { pruneRateLimits } = await import("../src/server/security/rate-limit");

const db = await getDb();
await pruneExpired(db);
await pruneRateLimits(db);
console.log("limpeza concluída.");
await closeDb();
