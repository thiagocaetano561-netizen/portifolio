/**
 * Recursos cinematográficos do site (vídeos servidos pelo próprio domínio).
 *
 * Gerados com Higgsfield (Cinema Studio Video 3.0, a partir de quadros-chave
 * GPT Image 2.6 usados como primeiro e último quadro → loop sem corte),
 * revisados e comprimidos com `node scripts/process-media.mjs`.
 * Todos são decorativos: nenhuma informação essencial ou pista depende deles.
 *
 * Para trocar um vídeo: coloque o MP4 original em assets/media/source/<nome>.mp4,
 * rode o script e mantenha os caminhos abaixo. Nunca aponte para URLs externas:
 * a CSP só permite mídia do próprio site.
 */

export interface MediaAsset {
  webm?: string;
  mp4?: string;
  poster: string;
  /** Descrição para leitores de tela (vídeos são decorativos, sem informação essencial). */
  label: string;
  /** Crédito/origem do recurso. */
  credit?: string;
  /** Reproduz também em telas pequenas (padrão: não, para poupar dados). */
  allowMobile?: boolean;
}

const HF = "Gerado com Higgsfield, 2026";

const asset = (name: string, label: string, extra: Partial<MediaAsset> = {}): MediaAsset => ({
  webm: `/media/${name}.webm`,
  mp4: `/media/${name}.mp4`,
  poster: `/media/${name}.webp`,
  label,
  credit: HF,
  ...extra,
});

export const media: Record<"hero" | "logoReveal" | "boot" | "void", MediaAsset | null> = {
  /** Vídeo 1 — ambiente tecnológico abstrato do hero (loop lento, sem texto). */
  hero: asset("hero", "Estruturas geométricas translúcidas em luz verde-esmeralda, girando devagar."),
  /** Vídeo 2 — filamentos de luz que emolduram a marca (o símbolo em si é SVG fiel ao logotipo). */
  logoReveal: asset("logo", "Filamentos de luz verde convergindo para o centro."),
  /** Vídeo 3 — complemento visual da inicialização do terminal. */
  boot: asset("boot", "Pulsos de luz percorrendo uma grade computacional escura."),
  /** Vídeo 5 — ambiente digital desconhecido para eventos narrativos. */
  void: asset("void", "Estruturas monolíticas escuras com luzes que falham na névoa.", { allowMobile: true }),
};

/** Vídeo 4 — luz ambiente conceitual dos projetos (nunca substitui a captura real). */
export const projectAmbience: Record<string, MediaAsset> = {
  fendalume: asset("fendalume", "Fenda de cristal luminosa em violeta e turquesa sob um céu estrelado."),
  fc26: asset("fc26", "Feixes de refletores verde-limão atravessando a névoa de um estádio vazio."),
};
