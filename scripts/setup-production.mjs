/**
 * Configura a produção na Vercel sem que nenhum segredo apareça na tela:
 *  1. login na Vercel (você confirma no navegador) e vínculo com o projeto;
 *  2. baixa as variáveis do Neon e copia a URL do banco para .env.production.local;
 *  3. envia as 5 variáveis do site (.env.vercel-import.local) para a Vercel;
 *  4. cria as tabelas e carrega a narrativa no banco de produção (db:seed:prod).
 * Depois disso basta um novo deploy (o push para o GitHub dispara).
 *
 * Uso: node scripts/setup-production.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const PROJECT = "tryggport-dev";
const SCOPE = "trygg-port-dev";
const PROD_FILE = ".env.production.local";
const IMPORT_FILE = ".env.vercel-import.local";
const PULLED = ".env.vercel-pulled.local";
const VERCEL = ["--yes", "vercel@latest"];

function step(title) {
  console.log(`\n── ${title}`);
}

function vercel(args, { input, allowFail = false, scoped = true } = {}) {
  const r = spawnSync("npx", [...VERCEL, ...args, ...(scoped ? ["--scope", SCOPE] : [])], {
    stdio: input === undefined ? "inherit" : ["pipe", "inherit", "inherit"],
    input,
    shell: true,
  });
  if (r.status !== 0 && !allowFail) throw new Error(`vercel ${args[0]} falhou (código ${r.status}).`);
  return r.status === 0;
}

function parseEnv(text) {
  const out = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out.set(m[1], v);
  }
  return out;
}

async function main() {
  for (const f of [PROD_FILE, IMPORT_FILE]) {
    if (!existsSync(f)) throw new Error(`${f} não encontrado. Rode antes: npm run env:prod`);
  }

  step("1/4 · Login na Vercel (confirme no navegador que abrir)");
  vercel(["whoami"], { allowFail: true, scoped: false }) || vercel(["login"], { scoped: false });
  vercel(["link", "--yes", "--project", PROJECT]);

  step("2/4 · Copiando a URL do banco Neon para " + PROD_FILE + " (valor não exibido)");
  vercel(["env", "pull", PULLED, "--environment=production", "--yes"]);
  const pulled = parseEnv(readFileSync(PULLED, "utf8"));
  rmSync(PULLED, { force: true });
  const dbUrl = pulled.get("DATABASE_URL_UNPOOLED") || pulled.get("POSTGRES_URL_NON_POOLING") || pulled.get("DATABASE_URL") || "";
  if (!dbUrl.startsWith("postgres")) {
    throw new Error(
      "A Vercel não devolveu a URL do banco (variáveis marcadas como sensíveis não podem ser baixadas). " +
        "Copie DATABASE_URL_UNPOOLED em Storage → neon-sky-park → .env.local e cole em " + PROD_FILE + ".",
    );
  }
  const prodText = readFileSync(PROD_FILE, "utf8").replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${dbUrl}`);
  writeFileSync(PROD_FILE, prodText, { mode: 0o600 });
  console.log("URL do banco gravada.");

  step("3/4 · Enviando as variáveis do site para a Vercel (valores não exibidos)");
  const vars = parseEnv(readFileSync(IMPORT_FILE, "utf8"));
  for (const [name, value] of vars) {
    // substitui caso já exista (ignora erro se não existir)
    vercel(["env", "rm", name, "production", "--yes"], { allowFail: true });
    vercel(["env", "add", name, "production"], { input: value });
    console.log(`  ✓ ${name}`);
  }

  step("4/4 · Criando tabelas e carregando a narrativa no banco de produção");
  const seed = spawnSync("npm", ["run", "db:seed:prod"], { stdio: "inherit", shell: true });
  if (seed.status !== 0) throw new Error("db:seed:prod falhou.");

  console.log("\nProdução configurada. Falta só um novo deploy (o Claude dispara pelo GitHub).");
}

main().catch((err) => {
  console.error(`\nERRO: ${err.message}`);
  process.exit(1);
});
