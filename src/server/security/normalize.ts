/**
 * Normalização de respostas. Cada desafio declara o tipo; a mesma função é
 * usada pelo seed (para gerar verificadores) e em tempo de execução, o que
 * garante consistência sem aceitar variações que mudem o significado.
 */
export type Normalization = "word" | "phrase" | "number" | "time" | "list" | "hex" | "choice";

const DIACRITICS = /[̀-ͯ]/g;

export function fold(value: string): string {
  return value.normalize("NFKD").replace(DIACRITICS, "").toLowerCase().trim();
}

/** Remove tudo que não é letra/dígito ASCII após remover acentos. */
function alnum(value: string): string {
  return fold(value).replace(/[^a-z0-9]/g, "");
}

/**
 * Retorna a forma canônica ou `null` quando a entrada não pode ser uma resposta
 * válida para o tipo (por exemplo, letras em uma resposta numérica).
 */
export function normalizeAnswer(kind: Normalization, raw: string): string | null {
  const input = raw.slice(0, 200);
  switch (kind) {
    case "word":
    case "phrase": {
      const v = alnum(input);
      return v.length > 0 && v.length <= 80 ? v : null;
    }
    case "choice": {
      const v = alnum(input);
      return /^[a-z0-9]{1,24}$/.test(v) ? v : null;
    }
    case "number": {
      const v = fold(input).replace(/\s+/g, "");
      if (!/^\d{1,12}$/.test(v)) return null;
      return v.replace(/^0+(?=\d)/, "");
    }
    case "time": {
      const m = fold(input).replace(/\s+/g, "").match(/^(\d{1,2})(?::|h)(\d{2})$/);
      if (!m) return null;
      const h = Number(m[1]);
      const min = Number(m[2]);
      if (h > 23 || min > 59) return null;
      return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    }
    case "hex": {
      const v = fold(input).replace(/\s+/g, "");
      const m = v.match(/^(?:0x)?([0-9a-f]{1,8})$/);
      if (!m || !m[1]) return null;
      return m[1].replace(/^0+(?=[0-9a-f])/, "");
    }
    case "list": {
      const parts = fold(input)
        .split(/[\s,;>]+/)
        .map((p) => p.replace(/[^a-z0-9.]/g, "").replace(/\.local$/, ""))
        .filter((p) => p.length > 0 && p !== "via" && p !== "por");
      if (parts.length === 0 || parts.length > 12) return null;
      return parts.join(",");
    }
  }
}

/** Forma usada para comparar argumentos de regras e registrar o histórico. */
export function normalizeArgs(args: readonly string[]): string {
  return fold(args.join(" ")).replace(/\s+/g, " ").slice(0, 120);
}
