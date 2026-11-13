import "server-only";
import { projects } from "../../content/projects";
import { site } from "../../content/site";
import type { Line } from "../../lib/terminal/protocol";
import { satisfied, type FileRow, type ProtectedContent } from "../content/repository";

export const HOME = "/home/visitor";
const MAX_PATH = 200;
const PATH_PATTERN = /^[A-Za-z0-9._\-/~+]+$/;

export interface VNode {
  path: string;
  kind: "file" | "dir";
  content: string;
  readable: boolean;
  deniedMessage?: string | null;
  setsFlags: string[];
  eggId: string | null;
}

/**
 * Resolve um caminho virtual em forma absoluta e canônica.
 * Não existe acesso ao disco: o resultado é apenas uma chave de busca em um
 * mapa em memória. `..` nunca sobe acima de `/` e caracteres fora da lista
 * permitida são rejeitados.
 */
export function resolvePath(cwd: string, input: string): string | null {
  if (!input || input.length > MAX_PATH || !PATH_PATTERN.test(input)) return null;
  let raw = input;
  if (raw === "~" || raw.startsWith("~/")) raw = HOME + raw.slice(1);
  const base = raw.startsWith("/") ? [] : cwd.split("/").filter(Boolean);
  for (const seg of raw.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") base.pop();
    else if (seg.startsWith("~")) return null;
    else base.push(seg);
  }
  if (base.length > 16) return null;
  return "/" + base.join("/");
}

export function displayPath(path: string): string {
  if (path === HOME) return "~";
  if (path.startsWith(HOME + "/")) return "~" + path.slice(HOME.length);
  return path;
}

export function parentOf(path: string): string {
  if (path === "/") return "/";
  const idx = path.lastIndexOf("/");
  return idx <= 0 ? "/" : path.slice(0, idx);
}

export function baseName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/* ------------------------------------------------------------------------- */
/* Arquivos públicos (derivados do conteúdo público do portfólio)             */
/* ------------------------------------------------------------------------- */

function publicNodes(): Map<string, VNode> {
  const nodes = new Map<string, VNode>();
  const dir = (path: string) => nodes.set(path, { path, kind: "dir", content: "", readable: true, setsFlags: [], eggId: null });
  const file = (path: string, content: string) =>
    nodes.set(path, { path, kind: "file", content, readable: true, setsFlags: [], eggId: null });

  for (const d of ["/", "/home", HOME, `${HOME}/projetos`, "/etc", "/var", "/var/log", "/tmp", "/mnt", "/usr", "/usr/share"])
    dir(d);

  file(
    `${HOME}/leia-me.txt`,
    [
      "Bem-vindo ao ambiente da Tryggport Dev.",
      "",
      "Este terminal é uma interface para o portfólio. Comece por:",
      "  about       quem somos",
      "  projects    projetos publicados",
      "  help        todos os comandos",
      "",
      "Nada aqui executa comandos reais. Tudo é virtual.",
    ].join("\n"),
  );
  file(`${HOME}/sobre.txt`, site.about.join("\n\n"));
  file(
    `${HOME}/contato.txt`,
    site.contact.length
      ? site.contact.map((c) => `${c.label}: ${c.handle ?? c.href}`).join("\n")
      : "Os canais de contato serão publicados em breve.",
  );
  for (const p of projects) {
    file(
      `${HOME}/projetos/${p.slug}.txt`,
      [
        p.name,
        "=".repeat(Math.min(p.name.length, 48)),
        "",
        ...p.description,
        "",
        "destaques:",
        ...p.highlights.map((h) => `  · ${h}`),
        "",
        `tecnologias: ${p.technologies.length ? p.technologies.join(", ") : "a confirmar"}`,
        `endereço: ${p.linkStatus === "online" && p.publicUrl ? p.publicUrl : (p.linkNote ?? "indisponível")}`,
      ].join("\n"),
    );
  }
  file(
    `${HOME}/.profile`,
    ["# perfil do visitante", "export PS1='visitor@tryggport:\\w$ '", "alias ll='ls -la'", "# lembrete: nem todo arquivo aparece no ls."].join(
      "\n",
    ),
  );
  file("/etc/hostname", "tryggport");
  file(
    "/var/log/boot.log",
    [
      "[0.000] TRYGGPORT DEV — development environment",
      "[0.112] loading portfolio .......... OK",
      "[0.240] loading projects ........... OK",
      "[0.391] checking dependencies ...... OK",
      "[0.502] establishing session ....... OK",
      "[0.777] memory verification ........ WARNING",
      "[0.778]   sector 0x7A: checksum mismatch (origin unknown)",
      "[0.779]   1 unidentified archive detected",
      "[0.900] ready.",
    ].join("\n"),
  );
  file(
    "/usr/share/tryggport.txt",
    "Tryggport: do norueguês trygg (seguro) + port (porta).\nUma porta segura só abre para quem deve passar.",
  );
  return nodes;
}

const PUBLIC = publicNodes();

function pickRow(rows: FileRow[] | undefined, flags: ReadonlySet<string>): FileRow | undefined {
  // As linhas já vêm ordenadas por prioridade decrescente.
  return rows?.find((r) => satisfied(flags, r.requires, r.forbids));
}

/** Nó visível para a sessão: conteúdo protegido sobrepõe o público. */
export function getNode(path: string, content: ProtectedContent, flags: ReadonlySet<string>): VNode | null {
  const row = pickRow(content.filesByPath.get(path), flags);
  if (row) {
    return {
      path,
      kind: row.kind,
      content: row.content,
      readable: satisfied(flags, row.readRequires, []),
      deniedMessage: row.deniedMessage,
      setsFlags: row.setsFlags,
      eggId: row.eggId,
    };
  }
  return PUBLIC.get(path) ?? null;
}

export function listChildren(dir: string, content: ProtectedContent, flags: ReadonlySet<string>): VNode[] {
  const prefix = dir === "/" ? "/" : dir + "/";
  const candidates = new Set<string>();
  for (const p of PUBLIC.keys()) if (p !== dir && p.startsWith(prefix) && !p.slice(prefix.length).includes("/")) candidates.add(p);
  for (const p of content.filesByPath.keys())
    if (p !== dir && p.startsWith(prefix) && !p.slice(prefix.length).includes("/")) candidates.add(p);
  const out: VNode[] = [];
  for (const p of candidates) {
    const n = getNode(p, content, flags);
    if (n) out.push(n);
  }
  return out.sort((a, b) => baseName(a.path).localeCompare(baseName(b.path)));
}

/** Converte conteúdo com marcação mínima (§tipo no início da linha) em linhas tipadas. */
export function toLines(content: string): Line[] {
  return content.split("\n").map((raw) => {
    const m = raw.match(/^§(lys|warn|dim|err|ok|accent|sys) ?(.*)$/);
    if (m) return { k: m[1] as Line["k"], t: m[2] ?? "" };
    return { k: "out", t: raw };
  });
}
