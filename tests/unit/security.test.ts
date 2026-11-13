import { describe, expect, it } from "vitest";
import { normalizeAnswer, normalizeArgs } from "@/server/security/normalize";
import { answerVerifier, matchesAnyVerifier, safeEqualHex, TOKEN_PATTERN, randomToken } from "@/server/security/crypto";
import { parseInput } from "@/server/terminal/parser";
import { resolvePath } from "@/server/terminal/vfs";
import { isAllowedExternalHref } from "@/content/site";

describe("normalização de respostas", () => {
  it("palavras ignoram acentos, caixa e pontuação", () => {
    expect(normalizeAnswer("word", "  Coração! ")).toBe("coracao");
    expect(normalizeAnswer("phrase", "Pão de AÇÚCAR.")).toBe("paodeacucar");
  });
  it("números rejeitam letras e normalizam zeros", () => {
    expect(normalizeAnswer("number", "0042")).toBe("42");
    expect(normalizeAnswer("number", "42a")).toBeNull();
    expect(normalizeAnswer("number", "4 2")).toBe("42");
  });
  it("horários aceitam formatos comuns e rejeitam inválidos", () => {
    expect(normalizeAnswer("time", "9:05")).toBe("09:05");
    expect(normalizeAnswer("time", "09h05")).toBe("09:05");
    expect(normalizeAnswer("time", "25:00")).toBeNull();
    expect(normalizeAnswer("time", "0905")).toBeNull();
  });
  it("hexadecimais aceitam prefixo 0x", () => {
    expect(normalizeAnswer("hex", "0x1F")).toBe("1f");
    expect(normalizeAnswer("hex", "001f")).toBe("1f");
    expect(normalizeAnswer("hex", "0xZZ")).toBeNull();
  });
  it("listas preservam a ordem (ordem faz parte da resposta)", () => {
    expect(normalizeAnswer("list", "rio via pôr, sol.local")).toBe("rio,sol");
    expect(normalizeAnswer("list", "rio via sol,lua")).toBe("rio,sol,lua");
  });
  it("argumentos de regras são normalizados de forma estável", () => {
    expect(normalizeArgs(["-RF", "/"])).toBe("-rf /");
  });
});

describe("verificadores HMAC", () => {
  const key = Buffer.alloc(32, 1).toString("base64");
  it("mesma resposta em desafios diferentes gera verificadores diferentes", () => {
    expect(answerVerifier(key, "a", "x")).not.toBe(answerVerifier(key, "b", "x"));
  });
  it("comparação em tempo constante", () => {
    const v = answerVerifier(key, "a", "x");
    expect(matchesAnyVerifier(v, ["00".repeat(32), v])).toBe(true);
    expect(matchesAnyVerifier(v, ["00".repeat(32)])).toBe(false);
    expect(safeEqualHex("", "")).toBe(false);
    expect(safeEqualHex("abcd", "abcdef")).toBe(false);
  });
  it("tokens de sessão têm 256 bits", () => {
    expect(randomToken()).toMatch(TOKEN_PATTERN);
    expect(TOKEN_PATTERN.test("a".repeat(42))).toBe(false);
  });
});

describe("parser do terminal", () => {
  it("separa comando e argumentos com aspas", () => {
    expect(parseInput(`echo "olá mundo" 'x y'`)).toEqual({ ok: true, value: { command: "echo", args: ["olá mundo", "x y"] } });
  });
  it("rejeita entradas longas, aspas abertas e caracteres de controle no nome", () => {
    expect(parseInput("a".repeat(201))).toEqual({ ok: false, reason: "too_long" });
    expect(parseInput(`echo "aberta`)).toEqual({ ok: false, reason: "syntax" });
    expect(parseInput("<script>")).toEqual({ ok: false, reason: "syntax" });
    expect(parseInput("   ")).toEqual({ ok: false, reason: "empty" });
  });
  it("não interpreta metacaracteres de shell", () => {
    const r = parseInput("ls; rm -rf / | cat && $(id)");
    expect(r.ok).toBe(false); // "ls;" não é um nome de comando válido
    const r2 = parseInput("echo $(id) `x` | y");
    expect(r2).toEqual({ ok: true, value: { command: "echo", args: ["$(id)", "`x`", "|", "y"] } });
  });
});

describe("caminhos virtuais", () => {
  it("normaliza e nunca sobe acima da raiz", () => {
    expect(resolvePath("/home/visitor", "../../../../etc")).toBe("/etc");
    expect(resolvePath("/home/visitor", "~/projetos")).toBe("/home/visitor/projetos");
    expect(resolvePath("/", "./a/./b/../c")).toBe("/a/c");
  });
  it("rejeita caracteres fora da lista permitida", () => {
    expect(resolvePath("/", "..\\..\\windows")).toBeNull();
    expect(resolvePath("/", "%2e%2e")).toBeNull();
    expect(resolvePath("/", "a\u0000b")).toBeNull();
    expect(resolvePath("/", "~root")).toBeNull();
  });
});

describe("links externos", () => {
  it("aceita apenas https e mailto válidos", () => {
    expect(isAllowedExternalHref("https://fendalume.vercel.app/")).toBe(true);
    expect(isAllowedExternalHref("javascript:alert(1)")).toBe(false);
    expect(isAllowedExternalHref("http://exemplo.com")).toBe(false);
    expect(isAllowedExternalHref("https://user:pass@exemplo.com")).toBe(false);
    expect(isAllowedExternalHref("data:text/html,x")).toBe(false);
  });
});
