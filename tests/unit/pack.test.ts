import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { decryptRows, encryptRows } from "@/server/narrative/pack";
import type { SeedRows } from "@/server/narrative/seed";

const rows: SeedRows = {
  version: "teste",
  chapters: [{ id: 1, slug: "a", title: "A", difficulty: "fácil", sort: 0 }],
  challenges: [],
  rules: [],
  files: [{ path: "/x", kind: "file", content: "conteúdo de teste", requires: [], forbids: [], readRequires: [], setsFlags: [] }],
  unlocks: [],
  eggs: [],
};

describe("pacote cifrado da narrativa", () => {
  const key = randomBytes(32).toString("base64");

  it("ida e volta preserva os dados e não deixa texto legível", () => {
    const pack = encryptRows(rows, key);
    expect(JSON.stringify(pack)).not.toContain("conteúdo de teste");
    expect(decryptRows(pack, key)).toEqual(rows);
  });

  it("chave errada ou dado adulterado falham (AES-GCM autenticado)", () => {
    const pack = encryptRows(rows, key);
    expect(() => decryptRows(pack, randomBytes(32).toString("base64"))).toThrow();
    const tampered = { ...pack, data: Buffer.from(Buffer.from(pack.data, "base64").map((b, i) => (i === 3 ? b ^ 1 : b))).toString("base64") };
    expect(() => decryptRows(tampered, key)).toThrow();
  });

  it("recusa chaves de tamanho errado", () => {
    expect(() => encryptRows(rows, randomBytes(16).toString("base64"))).toThrow(/32 bytes/);
  });
});
