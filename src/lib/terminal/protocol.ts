/**
 * Contrato público entre o terminal (navegador) e a API.
 * Este arquivo é enviado ao navegador: não pode conter nada secreto.
 */

export type LineKind =
  | "out" // saída comum
  | "dim" // texto secundário
  | "ok" // sucesso
  | "warn" // aviso narrativo
  | "err" // erro do comando
  | "sys" // mensagem do sistema fictício
  | "lys" // fala da entidade fictícia
  | "accent" // destaque
  | "link"; // link autorizado (validado no cliente contra a lista pública)

export interface Line {
  k: LineKind;
  t: string;
  /** Somente para k = "link". */
  href?: string;
}

export type TerminalEvent =
  | { type: "glitch"; intensity?: "low" | "high" }
  | { type: "theme"; value: "green" | "amber" | "ice" }
  | { type: "achievement"; title: string }
  | { type: "chapter"; title: string }
  | { type: "ending"; title: string }
  /** Arquivo fictício recuperado, conexão virtual ou descoberta importante. */
  | { type: "discovery"; title: string; tone?: "file" | "connection" | "memory" }
  /** Cena visual narrativa (ambiente misterioso). Sem pistas essenciais. */
  | { type: "scene"; value: "void"; title?: string }
  /** O servidor avisa que o estado visual (pistas da interface) mudou. */
  | { type: "ui" }
  | { type: "clear" };

/** Pistas da interface liberadas pelo servidor para a sessão atual. */
export interface UiStateResponse {
  slots: Partial<Record<UiSlot, Line[]>>;
}

export const UI_SLOTS = ["hero.indicator", "hero.glyphs", "footer.log", "beacons.state"] as const;
export type UiSlot = (typeof UI_SLOTS)[number];

export interface Prompt {
  user: string;
  host: string;
  cwd: string;
}

export interface TerminalResponse {
  lines: Line[];
  prompt: Prompt;
  events?: TerminalEvent[];
  /** Comandos desbloqueados nesta sessão (para autocompletar). */
  completions?: string[];
  /** Entradas do último diretório listado (para autocompletar caminhos). */
  entries?: string[];
}

export interface SignalResponse {
  lines: Line[];
  events?: TerminalEvent[];
}

export const MAX_INPUT_LENGTH = 200;

/** Sinais de interface aceitos pela API. O efeito de cada um é decidido no servidor. */
export const SIGNAL_KINDS = ["konami", "logo_burst", "footer_glyph", "idle", "lost", "hero_file"] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];
