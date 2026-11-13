/**
 * Provisiona o conteúdo protegido (capítulos, desafios, arquivos virtuais,
 * regras e easter eggs) a partir da pasta privada `narrative/`.
 *
 * As respostas dos enigmas são convertidas em verificadores HMAC com a chave
 * PUZZLE_HMAC_KEY: o texto das respostas nunca chega ao banco.
 * O progresso dos visitantes não é alterado.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnvFiles } from "./load-env";
loadEnvFiles();

const narrativePath = path.resolve(import.meta.dirname, "../narrative/index.ts");
if (!existsSync(narrativePath)) {
  console.error("Pasta `narrative/` não encontrada. Ela é privada e não faz parte do repositório público.");
  console.error("Restaure-a a partir do seu backup privado antes de executar o seed.");
  process.exit(1);
}

const { getEnv } = await import("../src/server/env");
const { getDb, closeDb } = await import("../src/server/db/client");
const { runMigrations } = await import("../src/server/db/migrate");
const { seedStory } = await import("../src/server/narrative/seed");
// Import dinâmico por caminho: a pasta privada não existe no repositório público
// e não pode fazer parte da checagem de tipos do build.
const { story } = (await import(pathToFileURL(narrativePath).href)) as { story: import("../src/server/narrative/types").Story };

const env = getEnv();
const db = await getDb();
await runMigrations(db);
await seedStory(db, story, env.PUZZLE_HMAC_KEY);
console.log(
  `narrativa ${story.version} provisionada: ${story.chapters.length} capítulos, ${story.challenges.length} desafios, ` +
    `${story.files.length} arquivos virtuais, ${story.rules.length} regras, ${story.eggs.length} easter eggs.`,
);
await closeDb();
