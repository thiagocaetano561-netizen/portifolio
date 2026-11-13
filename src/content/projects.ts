/**
 * Projetos públicos do portfólio.
 *
 * Para adicionar um projeto, acrescente um objeto a `projects`. Tudo aqui é
 * PÚBLICO e enviado ao navegador — nunca coloque segredos neste arquivo.
 *
 * Regras editoriais:
 * - `highlights` e `technologies` só listam o que foi verificado no projeto publicado.
 * - `publicUrl` só aponta para o endereço público de produção, nunca para painéis
 *   de configuração (ex.: páginas de settings da Vercel).
 * - `cover.kind = "capture"` é uma captura real da aplicação publicada (com data);
 *   `"concept"` é ilustração conceitual e a interface informa isso ao visitante.
 * - Elementos ficcionais do mistério do site NUNCA entram aqui.
 */

export type LinkStatus = "online" | "unavailable" | "pending";

export interface Project {
  slug: string;
  /** Aliases aceitos pelo comando `project <alias>` no terminal. */
  aliases: string[];
  name: string;
  tagline: string;
  description: string[];
  /** Recursos observados no projeto publicado. */
  highlights: string[];
  /** Tecnologias confirmadas. Lista vazia = ainda não informado. */
  technologies: string[];
  publicUrl: string | null;
  linkStatus: LinkStatus;
  /** Observação mostrada quando o link não está disponível. */
  linkNote?: string;
  cover: {
    kind: "concept" | "capture";
    src: string;
    srcSmall?: string;
    width: number;
    height: number;
    alt: string;
    /** Data da captura real (AAAA-MM-DD). */
    capturedAt?: string;
  };
  /** Vídeo curto opcional (MP4/WebM servidos pelo próprio site). */
  video?: { webm?: string; mp4?: string };
  accent: string;
  kind: string;
  tags: string[];
}

export const projects: Project[] = [
  {
    slug: "fendalume",
    aliases: ["fendalume", "fenda", "ecos"],
    name: "Fendalume: Ecos do Entrevéu",
    tagline: "Jogo de ação em pixel art, jogável direto no navegador.",
    description: [
      "Um jogo autoral em pixel art em que a protagonista, Suri — a Cartógrafa, parte em expedições a partir da Estação Aurora.",
      "O combate mistura ataques, habilidades, esquiva, troca de armas e o Véu. O progresso pode ser salvo no próprio navegador, sem conta.",
    ],
    highlights: [
      "Protagonista Suri, a Cartógrafa",
      "Combate com ataque, habilidade, especial e esquiva",
      "Troca de armas e mecânica de Véu",
      "Expedições, vitórias e estilhaços registrados",
      "Progresso salvo no navegador ou em conta",
      "Controles por teclado e mouse",
    ],
    technologies: ["HTML5 Canvas"],
    publicUrl: "https://fendalume.online/",
    linkStatus: "online",
    cover: {
      kind: "capture",
      src: "/projects/fendalume-preview-1440.webp",
      srcSmall: "/projects/fendalume-preview-720.webp",
      width: 1440,
      height: 900,
      alt: "Tela inicial do jogo Fendalume: Ecos do Entrevéu, com o emblema do jogo, a personagem Suri e os botões Jogar, Configurações e Créditos.",
      capturedAt: "2026-11-13",
    },
    accent: "#9b7bff",
    kind: "Jogo · pixel art",
    tags: ["jogo", "pixel art", "navegador", "projeto autoral"],
  },
  {
    slug: "fc26",
    aliases: ["fc26", "fc", "fc-26", "random", "random-match", "roleta"],
    name: "FC 26 Random Match",
    tagline: "Roleta de times para sortear o próximo confronto no EA SPORTS FC 26.",
    description: [
      "Sorteia dois times — mandante e visitante — para definir a próxima partida, com modos de sorteio e filtros por categoria, liga, país e nível.",
      "Projeto independente de fãs, sem afiliação com a Electronic Arts.",
    ],
    highlights: [
      "Sorteio de mandante × visitante",
      "7 modos: Clássico, Equilibrado, Caos, Gigantes, Azarões, Davi × Golias, Sem Fronteiras",
      "Filtros por categoria, liga, país, nível (OVR) e tipo de confronto",
      "Catálogo com 838 equipes, incluindo clubes e seleções",
      "Histórico de sorteios",
    ],
    technologies: [],
    publicUrl: "https://fc26randommatch-vert.vercel.app/",
    linkStatus: "online",
    cover: {
      kind: "capture",
      src: "/projects/fc26-preview-1440.webp",
      srcSmall: "/projects/fc26-preview-720.webp",
      width: 1440,
      height: 900,
      alt: "Tela inicial do FC 26 Random Match: título Roleta de Times, dois cartões de times aguardando sorteio e o botão Roletar Times.",
      capturedAt: "2026-11-13",
    },
    accent: "#c6f432",
    kind: "Aplicação web · utilitário",
    tags: ["sorteio", "futebol virtual", "EA SPORTS FC 26", "fan project"],
  },
];

export function findProject(alias: string): Project | undefined {
  const a = alias.toLowerCase();
  return projects.find((p) => p.slug === a || p.aliases.includes(a));
}

/** Somente URLs públicas de projetos online podem virar links clicáveis. */
export function projectLinkIsLive(p: Project): p is Project & { publicUrl: string } {
  return p.linkStatus === "online" && typeof p.publicUrl === "string" && p.publicUrl.startsWith("https://");
}
