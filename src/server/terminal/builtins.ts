import "server-only";
import { desc, eq } from "drizzle-orm";
import { findProject, projectLinkIsLive, projects } from "../../content/projects";
import { isAllowedExternalHref, site } from "../../content/site";
import { PUBLIC_COMMANDS, PUBLIC_MANUAL } from "../../lib/terminal/public-commands";
import type { Line, TerminalEvent } from "../../lib/terminal/protocol";
import type { ProtectedContent } from "../content/repository";
import { commandLog, discoveries } from "../db/schema";
import { baseName, displayPath, getNode, HOME, listChildren, resolvePath, toLines } from "./vfs";
import type { Tx } from "./types";
import { hintCommand } from "./hints";

export interface BuiltinContext {
  tx: Tx;
  sessionId: string;
  args: string[];
  cwd: string;
  flags: ReadonlySet<string>;
  content: ProtectedContent;
  sessionStartedAt: Date;
}

export interface BuiltinResult {
  lines: Line[];
  events?: TerminalEvent[];
  cwd?: string;
  entries?: string[];
  endSession?: boolean;
  /** Efeitos de leitura de arquivos protegidos. */
  setsFlags?: string[];
  eggId?: string | null;
}

type Builtin = (ctx: BuiltinContext) => Promise<BuiltinResult> | BuiltinResult;

const out = (t: string): Line => ({ k: "out", t });
const dim = (t: string): Line => ({ k: "dim", t });
const err = (t: string): Line => ({ k: "err", t });

function flagValue(args: string[], ...names: string[]) {
  return args.some((a) => names.includes(a));
}

const ls: Builtin = ({ args, cwd, content, flags }) => {
  const opts = args.filter((a) => a.startsWith("-"));
  const targets = args.filter((a) => !a.startsWith("-"));
  const showAll = opts.some((o) => o.includes("a"));
  const long = opts.some((o) => o.includes("l"));
  if (opts.some((o) => !/^-[al]+$/.test(o))) return { lines: [err(`ls: opção inválida — use -a ou -l`)] };
  if (targets.length > 1) return { lines: [err("ls: informe apenas um diretório")] };
  const path = resolvePath(cwd, targets[0] ?? ".");
  if (!path) return { lines: [err("ls: caminho inválido")] };
  const node = getNode(path, content, flags);
  if (!node) return { lines: [err(`ls: não foi possível acessar '${targets[0]}': arquivo ou diretório inexistente`)] };
  if (node.kind === "file") return { lines: [out(baseName(path))] };
  if (!node.readable) return { lines: [err(node.deniedMessage ?? `ls: não foi possível abrir '${targets[0] ?? path}': permissão negada`)] };
  const children = listChildren(path, content, flags).filter((c) => showAll || !baseName(c.path).startsWith("."));
  const names = children.map((c) => baseName(c.path) + (c.kind === "dir" ? "/" : ""));
  if (children.length === 0) return { lines: [dim("(vazio)")], entries: [] };
  if (long) {
    const lines = children.map((c) => {
      const perm = c.kind === "dir" ? (c.readable ? "drwxr-xr-x" : "d---------") : c.readable ? "-rw-r--r--" : "----------";
      const size = String(c.kind === "dir" ? 4096 : c.content.length).padStart(6, " ");
      return out(`${perm}  visitor  ${size}  ${baseName(c.path)}${c.kind === "dir" ? "/" : ""}`);
    });
    return { lines, entries: names };
  }
  return { lines: [out(names.join("   "))], entries: names };
};

const cd: Builtin = ({ args, cwd, content, flags }) => {
  if (args.length > 1) return { lines: [err("cd: argumentos demais")] };
  const target = args[0] ?? "~";
  const path = resolvePath(cwd, target === "-" ? "~" : target);
  if (!path) return { lines: [err("cd: caminho inválido")] };
  const node = getNode(path, content, flags);
  if (!node) return { lines: [err(`cd: ${target}: diretório inexistente`)] };
  if (node.kind !== "dir") return { lines: [err(`cd: ${target}: não é um diretório`)] };
  if (!node.readable) return { lines: [err(node.deniedMessage ?? `cd: ${target}: permissão negada`)] };
  return { lines: [], cwd: path };
};

const cat: Builtin = ({ args, cwd, content, flags }) => {
  if (args.length === 0) return { lines: [err("uso: cat <arquivo>")] };
  if (args.length > 1) return { lines: [err("cat: leia um arquivo por vez")] };
  const target = args[0] as string;
  const path = resolvePath(cwd, target);
  if (!path) return { lines: [err("cat: caminho inválido")] };
  const node = getNode(path, content, flags);
  if (!node) return { lines: [err(`cat: ${target}: arquivo ou diretório inexistente`)] };
  if (node.kind === "dir") return { lines: [err(`cat: ${target}: é um diretório`)] };
  if (!node.readable) return { lines: [err(node.deniedMessage ?? `cat: ${target}: permissão negada`)] };
  return { lines: toLines(node.content), setsFlags: node.setsFlags, eggId: node.eggId };
};

function projectLines(alias: string | undefined): Line[] {
  if (!alias) return [err("uso: project <nome>"), dim(`disponíveis: ${projects.map((p) => p.slug).join(", ")}`)];
  const p = findProject(alias);
  if (!p) return [err(`project: '${alias}' não encontrado`), dim(`disponíveis: ${projects.map((x) => x.slug).join(", ")}`)];
  const lines: Line[] = [{ k: "accent", t: p.name }, dim(p.tagline), out("")];
  for (const d of p.description) lines.push(out(d));
  lines.push(out(""));
  lines.push({ k: "accent", t: "destaques" });
  for (const h of p.highlights) lines.push(out(`  · ${h}`));
  lines.push(out(""));
  lines.push(out(`tipo         ${p.kind}`));
  lines.push(out(`tecnologias  ${p.technologies.length ? p.technologies.join(" · ") : "a confirmar pelo autor"}`));
  if (projectLinkIsLive(p)) lines.push({ k: "link", t: `visitar → ${p.publicUrl}`, href: p.publicUrl });
  else lines.push(dim(`endereço     ${p.linkNote ?? "indisponível"}`));
  if (p.cover.kind === "concept") lines.push(dim("(a imagem no modo visual é uma ilustração conceitual)"));
  else if (p.cover.capturedAt) lines.push(dim(`(a imagem no modo visual é uma captura real de ${p.cover.capturedAt.split("-").reverse().join("/")})`));
  return lines;
}

function formatUptime(from: Date): string {
  const s = Math.max(0, Math.floor((Date.now() - from.getTime()) / 1000));
  const m = Math.floor(s / 60);
  return m < 1 ? `${s}s` : `${m}min`;
}

export const BUILTINS: Record<string, Builtin> = {
  help: () => {
    const lines: Line[] = [{ k: "accent", t: "COMANDOS DISPONÍVEIS" }];
    for (const c of PUBLIC_COMMANDS) lines.push(out(`  ${c.usage.padEnd(18, " ")} ${c.summary}`));
    lines.push(dim("Tab completa · ↑/↓ histórico · Ctrl+L limpa · Esc volta ao modo visual"));
    return { lines };
  },
  about: () => ({
    lines: [{ k: "accent", t: site.name }, dim(site.shortDescription), out(""), ...site.about.map(out)],
  }),
  projects: () => ({
    lines: [
      { k: "accent", t: "PROJETOS" },
      ...projects.map((p, i) => out(`  0${i + 1}  ${p.slug.padEnd(11, " ")} ${p.name}`)),
      dim("use: project <nome>"),
    ],
  }),
  project: ({ args }) => ({ lines: projectLines(args[0]) }),
  skills: () => ({
    lines: [
      { k: "accent", t: "TECNOLOGIAS USADAS NESTE SITE" },
      ...site.technologies.map((t) => out(`  ${t.name.padEnd(14, " ")} ${t.role}`)),
    ],
  }),
  contact: () => {
    const valid = site.contact.filter((c) => isAllowedExternalHref(c.href));
    if (valid.length === 0) return { lines: [dim("Os canais de contato serão publicados em breve.")] };
    return {
      lines: [{ k: "accent", t: "CONTATO" }, ...valid.map((c) => ({ k: "link" as const, t: `${c.label}  ${c.handle ?? c.href}`, href: c.href }))],
    };
  },
  ls,
  cd,
  cat,
  pwd: ({ cwd }) => ({ lines: [out(cwd)] }),
  clear: () => ({ lines: [], events: [{ type: "clear" }] }),
  echo: ({ args }) => ({ lines: [out(args.join(" ").slice(0, 200))] }),
  whoami: () => ({ lines: [out("visitor")] }),
  date: () => {
    const fmt = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "full",
      timeStyle: "medium",
      timeZone: "America/Sao_Paulo",
    });
    return { lines: [out(fmt.format(new Date()))] };
  },
  status: ({ sessionStartedAt }) => ({
    lines: [
      { k: "accent", t: "TRYGGPORT DEV — STATUS" },
      out(`  ambiente     development (portfólio)`),
      out(`  projetos     ${projects.length} publicados`),
      out(`  sessão       ativa há ${formatUptime(sessionStartedAt)}`),
      out(`  uptime       7d 07:07:07`),
      out(`  memória      99.7% verificada — 1 setor pendente (0x7A)`),
      out(`  processos    1 registrado`),
    ],
  }),
  ping: ({ args }) => {
    const host = (args[0] ?? "").toLowerCase();
    if (!host) return { lines: [err("uso: ping <destino>")] };
    if (!/^[a-z0-9.-]{1,64}$/.test(host)) return { lines: [err("ping: destino inválido")] };
    if (["localhost", "127.0.0.1", "tryggport", "tryggport.local", "::1"].includes(host)) {
      return {
        lines: [
          out(`PING ${host}: 56 bytes de dados`),
          ...[0, 1, 2].map((i) => out(`64 bytes de ${host}: seq=${i} ttl=64 tempo=0.0${4 + i} ms`)),
          dim("3 pacotes enviados, 3 recebidos, 0% de perda"),
        ],
      };
    }
    return {
      lines: [err(`ping: ${host}: destino desconhecido`), dim("(simulação: este terminal não acessa a rede real)")],
    };
  },
  scan: ({ args }) => {
    const target = (args[0] ?? "").toLowerCase();
    if (!target) return { lines: [err("uso: scan <system|memory|network>")] };
    if (target === "system")
      return { lines: [out("scan: sistema íntegro."), out("  portfólio ........ OK"), out("  projetos ......... OK"), out("  sessão ........... OK")] };
    if (target === "memory")
      return { lines: [out("scan: memória"), { k: "warn", t: "  setor 0x7A ....... ilegível" }] };
    if (target === "network") return { lines: [out("scan: interfaces"), out("  lo ............... 127.0.0.1"), dim("  nenhum host externo")] };
    return { lines: [err(`scan: alvo desconhecido '${target}'`)] };
  },
  man: ({ args }) => {
    const name = (args[0] ?? "").toLowerCase();
    if (!name) return { lines: [err("uso: man <comando>")] };
    const page = PUBLIC_MANUAL[name];
    if (!page) return { lines: [err(`man: sem entrada de manual para ${name}`)] };
    return { lines: page.map((t, i) => (i === 0 ? { k: "accent" as const, t } : out(t))) };
  },
  history: async ({ tx, sessionId }) => {
    const rows = await tx
      .select({ command: commandLog.command, args: commandLog.args })
      .from(commandLog)
      .where(eq(commandLog.sessionId, sessionId))
      .orderBy(desc(commandLog.id))
      .limit(20);
    const lines = rows
      .reverse()
      .map((r, i) => out(`  ${String(i + 1).padStart(3, " ")}  ${r.command}${r.args ? " " + r.args : ""}`));
    return { lines };
  },
  hint: (ctx) => hintCommand(ctx),
  dica: (ctx) => hintCommand(ctx),
  conquistas: async (ctx) => achievements(ctx),
  achievements: async (ctx) => achievements(ctx),
  logout: ({ args }) => {
    if (args[0] !== "--confirm")
      return {
        lines: [
          { k: "warn", t: "logout encerra esta sessão anônima e apaga todo o progresso associado a ela." },
          dim("para confirmar: logout --confirm"),
        ],
      };
    return { lines: [{ k: "sys", t: "sessão encerrada. uma nova sessão será criada no próximo comando." }], endSession: true, events: [{ type: "clear" }] };
  },
  // Comandos de sistema reais NÃO existem aqui. Estas respostas são fictícias.
  rm: () => ({ lines: [err("rm: sistema de arquivos virtual somente leitura")] }),
  sudo: () => ({ lines: [err("sudo: permissão negada")] }),
  curl: () => ({ lines: [err("curl: acesso à rede real desativado — este terminal é uma simulação")] }),
  wget: () => ({ lines: [err("wget: acesso à rede real desativado — este terminal é uma simulação")] }),
  ssh: () => ({ lines: [err("ssh: acesso à rede real desativado — este terminal é uma simulação")] }),
  nc: () => ({ lines: [err("nc: acesso à rede real desativado — este terminal é uma simulação")] }),
  telnet: () => ({ lines: [err("telnet: acesso à rede real desativado — este terminal é uma simulação")] }),
  kill: () => ({ lines: [err("kill: nenhum processo real é acessível daqui")] }),
  chmod: () => ({ lines: [err("chmod: sistema de arquivos virtual somente leitura")] }),
  touch: () => ({ lines: [err("touch: sistema de arquivos virtual somente leitura")] }),
  mkdir: () => ({ lines: [err("mkdir: sistema de arquivos virtual somente leitura")] }),
};

async function achievements({ tx, sessionId, content }: BuiltinContext): Promise<BuiltinResult> {
  const rows = await tx
    .select({ eggId: discoveries.eggId, at: discoveries.createdAt })
    .from(discoveries)
    .where(eq(discoveries.sessionId, sessionId))
    .orderBy(discoveries.createdAt);
  // Comando oculto: sem descobertas, ele simplesmente "não existe".
  if (rows.length === 0) return { lines: [err("comando não encontrado: conquistas")] };
  const lines: Line[] = [{ k: "accent", t: `CONQUISTAS — ${rows.length} de ${content.eggs.size}` }];
  for (const r of rows) {
    const egg = content.eggs.get(r.eggId);
    if (egg) lines.push(out(`  ✦ ${egg.title}`), dim(`    ${egg.reveal}`));
  }
  if (rows.length < content.eggs.size) lines.push(dim("  ..."));
  return { lines };
}

export { HOME, displayPath };
