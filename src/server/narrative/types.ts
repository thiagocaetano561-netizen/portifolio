import type { TerminalEvent } from "../../lib/terminal/protocol";
import type { Normalization } from "../security/normalize";

/**
 * Formato de autoria da narrativa. O conteúdo real fica em `narrative/`
 * (fora do controle de versão público) e é convertido pelo seed em linhas
 * do banco. Textos aceitam a marcação mínima `§tipo` no início da linha.
 */

export interface StoryChapter {
  id: number;
  slug: string;
  title: string;
  difficulty: string;
}

export interface StoryChallenge {
  id: string;
  chapter: number;
  command: string;
  normalization: Normalization;
  /** Respostas aceitas em texto puro. Apenas o seed as lê; o banco recebe só verificadores HMAC. */
  answers: string[];
  requires?: string[];
  forbids?: string[];
  requiredActions?: Array<{ command: string; args: string[] }>;
  maxFailures?: number | null;
  windowSeconds?: number;
  rewards?: string[];
  failureFlags?: string[];
  success: string;
  failure?: string;
  missingActions?: string;
  events?: TerminalEvent[];
  egg?: string;
  /** Nome curto mostrado pelo comando `hint` quando o enigma está aberto. */
  hintTitle?: string;
  /** Até 3 dicas: onde observar → mecanismo → explicação parcial. Nunca a resposta. */
  hints?: string[];
}

export interface StoryRule {
  command: string;
  /** Argumentos aceitos (normalizados no seed). Ausente = qualquer argumento. */
  args?: string[];
  mode?: "replace" | "append" | "prepend" | "complete";
  requires?: string[];
  forbids?: string[];
  priority?: number;
  output?: string;
  sets?: string[];
  events?: TerminalEvent[];
  egg?: string;
}

export interface StoryFile {
  path: string;
  kind?: "file" | "dir";
  content?: string;
  requires?: string[];
  forbids?: string[];
  readRequires?: string[];
  denied?: string;
  priority?: number;
  sets?: string[];
  egg?: string;
}

export interface StoryUnlock {
  when: string[];
  sets: string[];
  output?: string;
  events?: TerminalEvent[];
}

export interface StoryEgg {
  id: string;
  title: string;
  difficulty: "fácil" | "média" | "difícil" | "extrema";
  /** Texto exibido no comando de conquistas somente depois da descoberta. */
  reveal: string;
}

export interface Story {
  version: string;
  chapters: StoryChapter[];
  challenges: StoryChallenge[];
  rules: StoryRule[];
  files: StoryFile[];
  unlocks: StoryUnlock[];
  eggs: StoryEgg[];
}
