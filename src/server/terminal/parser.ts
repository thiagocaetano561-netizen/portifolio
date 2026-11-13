import { MAX_INPUT_LENGTH } from "../../lib/terminal/protocol";

export interface ParsedCommand {
  command: string;
  args: string[];
}

export type ParseResult = { ok: true; value: ParsedCommand } | { ok: false; reason: "empty" | "too_long" | "syntax" };

const MAX_ARGS = 12;
const MAX_ARG_LENGTH = 120;
const COMMAND_PATTERN = /^[a-z0-9:._+\-!?]{1,32}$/;

/**
 * Tokenizador do interpretador. Não existe expansão de variáveis, subshell,
 * pipes, redirecionamento ou qualquer execução: apenas palavras e aspas.
 */
export function parseInput(input: string): ParseResult {
  if (typeof input !== "string") return { ok: false, reason: "syntax" };
  if (input.length > MAX_INPUT_LENGTH) return { ok: false, reason: "too_long" };
  // Remove caracteres de controle e invisíveis de direção de texto.
  // eslint-disable-next-line no-control-regex
  const clean = input.replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, " ").trim();
  if (!clean) return { ok: false, reason: "empty" };

  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let hasToken = false;
  for (const ch of clean) {
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      hasToken = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (hasToken) tokens.push(current);
      current = "";
      hasToken = false;
      continue;
    }
    current += ch;
    hasToken = true;
  }
  if (quote) return { ok: false, reason: "syntax" };
  if (hasToken) tokens.push(current);
  if (tokens.length === 0) return { ok: false, reason: "empty" };
  if (tokens.length > MAX_ARGS + 1) return { ok: false, reason: "too_long" };
  if (tokens.some((t) => t.length > MAX_ARG_LENGTH)) return { ok: false, reason: "too_long" };

  const [first, ...args] = tokens;
  const command = (first ?? "").toLowerCase();
  if (!COMMAND_PATTERN.test(command)) return { ok: false, reason: "syntax" };
  return { ok: true, value: { command, args } };
}
