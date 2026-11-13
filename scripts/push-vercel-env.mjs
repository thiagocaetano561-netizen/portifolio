/**
 * Envia para a Vercel (ambiente Production) as variáveis do site guardadas em
 * .env.production.local, exceto DATABASE_URL (que já vem do Neon).
 * Os valores vão por stdin direto para a CLI oficial — nunca são impressos.
 * Requer `vercel login` e `vercel link` já feitos.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const NAMES = ["SITE_URL", "DATABASE_DRIVER", "TRUST_PROXY", "PUZZLE_HMAC_KEY", "IP_HASH_KEY", "NARRATIVE_KEY"];
const env = new Map();
for (const line of readFileSync(".env.production.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env.set(m[1], m[2].trim());
}

const run = (args, input) =>
  spawnSync("npx", ["--yes", "vercel@latest", ...args, "--scope", "trygg-port-dev"], {
    input,
    stdio: input === undefined ? ["ignore", "ignore", "pipe"] : ["pipe", "ignore", "pipe"],
    shell: true,
    encoding: "utf8",
  });

let failed = 0;
for (const name of NAMES) {
  const value = env.get(name);
  if (!value) {
    console.log(`  ✗ ${name}: ausente em .env.production.local`);
    failed++;
    continue;
  }
  run(["env", "rm", name, "production", "--yes"]); // ignora se não existir
  const r = run(["env", "add", name, "production"], value);
  if (r.status === 0) console.log(`  ✓ ${name}`);
  else {
    failed++;
    // mostra só a última linha de erro da CLI (sem o valor, que nunca é ecoado)
    console.log(`  ✗ ${name}: ${(r.stderr || "").trim().split(/\r?\n/).filter(Boolean).pop() ?? "erro"}`);
  }
}
process.exit(failed ? 1 : 0);
