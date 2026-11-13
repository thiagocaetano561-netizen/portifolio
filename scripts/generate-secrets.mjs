/**
 * Cria `.env.local` com segredos fortes para desenvolvimento.
 * Nunca sobrescreve um arquivo existente. Os valores não são impressos.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const target = ".env.local";
if (existsSync(target)) {
  console.log(`${target} já existe — nada foi alterado.`);
  process.exit(0);
}
const template = readFileSync(".env.example", "utf8");
const filled = template
  .replace(/^PUZZLE_HMAC_KEY=.*$/m, `PUZZLE_HMAC_KEY=${randomBytes(32).toString("base64")}`)
  .replace(/^IP_HASH_KEY=.*$/m, `IP_HASH_KEY=${randomBytes(24).toString("base64")}`);
writeFileSync(target, filled, { mode: 0o600 });
console.log(`${target} criado com chaves aleatórias. Em produção, gere chaves diferentes no painel de variáveis do provedor.`);
