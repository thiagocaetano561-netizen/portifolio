/**
 * Gera `narrative.pack` (cifrado) a partir da pasta privada `narrative/`,
 * com as chaves de PRODUÇÃO de `.env.production.local`.
 * Se NARRATIVE_KEY ainda não existir nesse arquivo, ela é criada (32 bytes aleatórios).
 * Nenhuma chave é exibida.
 *
 * Uso: npm run narrative:pack   (rode de novo sempre que a narrativa mudar)
 */
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Story } from "../src/server/narrative/types";

const ENV_FILE = ".env.production.local";
const OUT = "narrative.pack";

function readEnv(): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) map.set(m[1]!, m[2]!.trim());
  }
  return map;
}

if (!existsSync(ENV_FILE)) throw new Error(`${ENV_FILE} não encontrado (rode npm run env:prod).`);
let env = readEnv();
if (!env.get("NARRATIVE_KEY")) {
  appendFileSync(ENV_FILE, `NARRATIVE_KEY=${randomBytes(32).toString("base64")}\n`, { mode: 0o600 });
  env = readEnv();
  console.log("NARRATIVE_KEY criada em .env.production.local (valor não exibido).");
}
const hmacKey = env.get("PUZZLE_HMAC_KEY");
const narrativeKey = env.get("NARRATIVE_KEY")!;
if (!hmacKey) throw new Error("PUZZLE_HMAC_KEY ausente em .env.production.local.");

const narrativePath = path.resolve(import.meta.dirname, "../narrative/index.ts");
if (!existsSync(narrativePath)) throw new Error("Pasta privada narrative/ não encontrada.");
const { story } = (await import(pathToFileURL(narrativePath).href)) as { story: Story };

const { compileStory } = await import("../src/server/narrative/seed");
const { encryptRows, decryptRows } = await import("../src/server/narrative/pack");

const rows = compileStory(story, hmacKey);
const pack = encryptRows(rows, narrativeKey);
// prova de ida e volta antes de gravar
const back = decryptRows(pack, narrativeKey);
if (JSON.stringify(back) !== JSON.stringify(rows)) throw new Error("falha na verificação do pacote");
// o pacote nunca pode conter respostas em texto
// (argumentos de regras de outros comandos — ex.: nomes de nós no `ping` — são dados de
// jogo legítimos; a checagem olha só o campo de verificadores e os textos de sucesso/dica)
const leaked = story.challenges.filter((c) => {
  const row = rows.challenges.find((r) => r.id === c.id);
  const own = JSON.stringify([row?.verifiers, row?.hints]).toLowerCase();
  return c.answers.some((a) => a.length >= 6 && own.includes(a.toLowerCase()));
});
if (leaked.length) throw new Error(`respostas em texto em: ${leaked.map((c) => c.id).join(", ")} — abortado`);
for (const c of rows.challenges) for (const v of c.verifiers as string[]) if (!/^[0-9a-f]{64}$/.test(v)) throw new Error(`verificador inválido em ${c.id}`);

writeFileSync(OUT, JSON.stringify(pack) + "\n");
console.log(
  `${OUT} gerado: narrativa ${rows.version}, ${rows.challenges.length} desafios, ${rows.files.length} arquivos, ` +
    `${Math.round(Buffer.byteLength(JSON.stringify(pack)) / 1024)} KB cifrados.`,
);
