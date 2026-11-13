/**
 * Cria `.env.production.local` (fora do git) com chaves NOVAS e fortes para produção.
 * Nunca sobrescreve um arquivo existente e não imprime os valores.
 *
 * Esse arquivo serve para:
 *  1. colar as variáveis no painel da Vercel (Settings → Environment Variables → Import .env);
 *  2. rodar `npm run db:seed:prod`, que precisa da MESMA PUZZLE_HMAC_KEY usada no site.
 */
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

const target = ".env.production.local";
if (existsSync(target)) {
  console.log(`${target} já existe — nada foi alterado.`);
  process.exit(0);
}
const siteUrl = process.argv[2] || "https://SEU-DOMINIO.vercel.app";
writeFileSync(
  target,
  [
    "# Variáveis de PRODUÇÃO — não publique este arquivo. Ele está no .gitignore.",
    `SITE_URL=${siteUrl}`,
    "DATABASE_DRIVER=pg",
    "# Cole aqui a connection string do Neon (com ?sslmode=require):",
    "DATABASE_URL=",
    `PUZZLE_HMAC_KEY=${randomBytes(32).toString("base64")}`,
    `IP_HASH_KEY=${randomBytes(24).toString("base64")}`,
    "TRUST_PROXY=true",
    "",
  ].join("\n"),
  { mode: 0o600 },
);
console.log(`${target} criado com chaves aleatórias novas (valores não exibidos).`);
