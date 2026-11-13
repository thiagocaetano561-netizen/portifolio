import { findProject, projectLinkIsLive, projects } from "@/content/projects";
import { isAllowedExternalHref, site } from "@/content/site";
import { PUBLIC_COMMANDS } from "./public-commands";
import type { Line } from "./protocol";

/**
 * Respostas públicas usadas quando o servidor está inacessível. Usa apenas
 * conteúdo que já é público no portfólio — nada narrativo existe aqui.
 */
export function offlineResponse(command: string, args: string[]): Line[] | null {
  const out = (t: string): Line => ({ k: "out", t });
  switch (command) {
    case "help":
      return [
        { k: "accent", t: "COMANDOS DISPONÍVEIS (offline)" },
        ...PUBLIC_COMMANDS.map((c) => out(`  ${c.usage.padEnd(18, " ")} ${c.summary}`)),
      ];
    case "about":
      return [{ k: "accent", t: site.name }, ...site.about.map(out)];
    case "projects":
      return [{ k: "accent", t: "PROJETOS" }, ...projects.map((p, i) => out(`  0${i + 1}  ${p.slug.padEnd(11, " ")} ${p.name}`))];
    case "project": {
      const p = args[0] ? findProject(args[0]) : undefined;
      if (!p) return [{ k: "err", t: "uso: project <nome>" }];
      const lines: Line[] = [{ k: "accent", t: p.name }, ...p.description.map(out)];
      if (projectLinkIsLive(p)) lines.push({ k: "link", t: `visitar → ${p.publicUrl}`, href: p.publicUrl });
      return lines;
    }
    case "skills":
      return site.technologies.map((t) => out(`  ${t.name.padEnd(14, " ")} ${t.role}`));
    case "contact": {
      const valid = site.contact.filter((c) => isAllowedExternalHref(c.href));
      return valid.length
        ? valid.map((c) => ({ k: "link" as const, t: `${c.label}  ${c.handle ?? c.href}`, href: c.href }))
        : [{ k: "dim", t: "Os canais de contato serão publicados em breve." }];
    }
    case "echo":
      return [out(args.join(" ").slice(0, 200))];
    default:
      return null;
  }
}

/** Links que o terminal pode tornar clicáveis: somente destinos públicos configurados. */
export function allowedLinkSet(): Set<string> {
  const set = new Set<string>();
  for (const p of projects) if (projectLinkIsLive(p)) set.add(p.publicUrl);
  for (const c of site.contact) if (isAllowedExternalHref(c.href)) set.add(c.href);
  return set;
}
