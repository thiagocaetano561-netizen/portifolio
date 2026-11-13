/**
 * Auditoria pós-build: procura conteúdo secreto em tudo que pode chegar ao
 * navegador (bundles, CSS, HTML/RSC pré-renderizados, manifests, public/).
 *
 * Os termos sensíveis são derivados da própria narrativa privada (respostas,
 * trechos de documentos, comandos ocultos), então a lista nunca fica desatualizada
 * e não precisa ser escrita em nenhum arquivo público.
 *
 * Uso: npm run build && npm run audit:bundle
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const TARGETS = [".next/static", ".next/server/app", "public"];
const failures: string[] = [];

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = TARGETS.flatMap((t) => walk(path.join(ROOT, t)));
// O servidor (.next/server) não é público, mas páginas pré-renderizadas e payloads RSC são.
const browserFacing = files.filter((f) => {
  const rel = path.relative(ROOT, f).replaceAll("\\", "/");
  if (rel.startsWith(".next/static/") || rel.startsWith("public/")) return true;
  return /\.(html|rsc|body|meta|segments)$/.test(rel) || rel.includes(".segments/");
});

// 1) sourcemaps publicados
for (const f of browserFacing) if (f.endsWith(".map")) failures.push(`sourcemap publicado: ${path.relative(ROOT, f)}`);

// 2) termos sensíveis vindos da narrativa privada
const terms = new Set<string>();
const narrative = path.join(ROOT, "narrative/index.ts");
if (existsSync(narrative)) {
  const { story } = (await import(pathToFileURL(narrative).href)) as { story: import("../src/server/narrative/types").Story };
  const common = new Set(["sim", "nao", "b", "init", "seal", "release", "keep", "s", "n", "no", "yes", "start", "memory", "mem", "7"]);
  for (const c of story.challenges) for (const a of c.answers) if (!common.has(a.toLowerCase()) && a.length >= 4) terms.add(a);
  const publicCommands = new Set(["help", "about", "projects", "project", "skills", "contact", "ls", "cd", "cat", "pwd", "clear", "history", "status", "whoami", "date", "ping", "scan", "echo", "man", "visual", "signal:konami", "signal:logo_burst", "signal:footer_glyph", "signal:idle", "signal:lost", "rm", "sudo", "exit", "theme", "lighthouse", "inspect"]);
  // Nomes de comandos que também são palavras comuns em código de frameworks
  // (React, roteador do Next, polyfills de URL) geram falsos positivos e são
  // cobertos pelas verificações de respostas e de conteúdo.
  const frameworkWords = new Set(["mount", "protocol", "restore", "connect", "reply", "respond", "strings", "assemble", "decrypt", "transmit", "recall", "finger", "uptime", "coffee", "fortune", "hello"]);
  for (const r of story.rules)
    if (!publicCommands.has(r.command) && !frameworkWords.has(r.command) && r.command.length >= 5 && !r.command.startsWith("signal:")) terms.add(`"${r.command}"`);
  for (const f of story.files) {
    const firstLine = (f.content ?? "").split("\n").find((l) => l.replace(/^§\w+ ?/, "").trim().length > 24);
    if (firstLine) terms.add(firstLine.replace(/^§\w+ ?/, "").trim().slice(0, 40));
    if (f.path.includes("/restrito") || f.path.includes("/mnt/archive")) terms.add(f.path);
  }
  for (const c of story.challenges) {
    const line = c.success.split("\n").find((l) => l.replace(/^§\w+ ?/, "").trim().length > 24);
    if (line) terms.add(line.replace(/^§\w+ ?/, "").trim().slice(0, 40));
  }
} else {
  console.warn("narrative/ ausente: auditando apenas padrões genéricos.");
}
// segredos de ambiente nunca podem aparecer
for (const key of ["PUZZLE_HMAC_KEY", "IP_HASH_KEY", "DATABASE_URL"]) {
  terms.add(key);
  const value = process.env[key];
  if (value && value.length >= 16) terms.add(value);
}

let scanned = 0;
for (const f of browserFacing) {
  if (/\.(png|jpe?g|webp|avif|ico|woff2?|gif|webm|mp4)$/i.test(f)) continue;
  const content = readFileSync(f, "utf8");
  scanned++;
  for (const t of terms) {
    if (content.includes(t)) failures.push(`termo sensível "${t.slice(0, 24)}…" em ${path.relative(ROOT, f)}`);
  }
}

console.log(`auditoria: ${scanned} arquivos públicos verificados contra ${terms.size} termos sensíveis.`);
if (failures.length) {
  console.error(`\n${failures.length} problema(s):\n- ${[...new Set(failures)].join("\n- ")}`);
  process.exit(1);
}
console.log("nenhum segredo encontrado em artefatos públicos. nenhum sourcemap publicado.");
