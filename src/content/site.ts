/**
 * Informações públicas da Tryggport Dev. Edite este arquivo para atualizar o site.
 * Tudo aqui é PÚBLICO. Não invente dados: deixe listas vazias até ter a informação real.
 */

export interface ContactLink {
  label: string;
  /** Somente https: ou mailto:. Outros esquemas são ignorados. */
  href: string;
  handle?: string;
}

export interface Technology {
  name: string;
  role: string;
}

export const site = {
  name: "Tryggport Dev",
  title: "TRYGGPORT DEV — PORTFÓLIO",
  shortDescription:
    "Desenvolvimento de software e criação de experiências digitais — do código ao detalhe da interação.",
  about: [
    "A Tryggport Dev é uma marca de desenvolvimento dedicada a criar experiências digitais: aplicações web, interfaces interativas e projetos autorais.",
    "O nome une duas ideias: trygg, “seguro” em norueguês, e port, a porta por onde algo entra. Construir com cuidado, abrir só o que deve ser aberto.",
    "Este site é, ele mesmo, um projeto: um portfólio que também é um ambiente experimental. Explore pelos menus — ou pelo terminal.",
  ],
  principles: [
    { title: "Segurança desde a base", text: "Decisões de arquitetura pensadas antes da primeira tela." },
    { title: "Interação com propósito", text: "Animação e mistério a serviço da experiência, nunca no caminho dela." },
    { title: "Honestidade técnica", text: "Só mostro o que foi feito de verdade." },
  ],
  /**
   * Links profissionais. Ainda não configurados.
   * Exemplo: { label: "GitHub", href: "https://github.com/seu-usuario", handle: "@seu-usuario" }
   */
  contact: [] as ContactLink[],
  /**
   * Tecnologias efetivamente usadas na construção DESTE site (verificáveis no package.json).
   * Acrescente outras somente quando forem usadas em projetos reais.
   */
  technologies: [
    { name: "TypeScript", role: "linguagem de todo o projeto" },
    { name: "Next.js", role: "aplicação, rotas e servidor" },
    { name: "React", role: "interface" },
    { name: "Tailwind CSS", role: "sistema visual" },
    { name: "Motion", role: "animações" },
    { name: "PostgreSQL", role: "persistência" },
    { name: "Drizzle ORM", role: "consultas parametrizadas" },
    { name: "Zod", role: "validação de entradas" },
    { name: "Vitest", role: "testes unitários e de integração" },
    { name: "Playwright", role: "testes end-to-end" },
  ] as Technology[],
} as const;

/** Domínios externos que o site pode abrir. Derivado do conteúdo público. */
export function isAllowedExternalHref(href: string): boolean {
  if (href.startsWith("mailto:")) return /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(href);
  try {
    const url = new URL(href);
    return url.protocol === "https:" && url.username === "" && url.password === "";
  } catch {
    return false;
  }
}
