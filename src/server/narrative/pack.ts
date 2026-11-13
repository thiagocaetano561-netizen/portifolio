import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import type { SeedRows } from "./seed";

/**
 * Pacote cifrado da narrativa para o deploy.
 *
 * Contém apenas as linhas já compiladas para o banco (documentos e verificadores
 * HMAC — nunca as respostas em texto). É cifrado com AES-256-GCM (autenticado)
 * usando NARRATIVE_KEY, que só existe no seu computador e nas variáveis secretas
 * da Vercel. Sem a chave, o arquivo no repositório público é ilegível.
 */
const AAD = Buffer.from("tryggport-narrative/v1");

export interface NarrativePack {
  v: 1;
  alg: "aes-256-gcm";
  iv: string;
  tag: string;
  data: string;
}

function keyFrom(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) throw new Error("NARRATIVE_KEY deve ter 32 bytes (base64).");
  return key;
}

export function encryptRows(rows: SeedRows, base64Key: string): NarrativePack {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(base64Key), iv);
  cipher.setAAD(AAD);
  const data = Buffer.concat([cipher.update(gzipSync(Buffer.from(JSON.stringify(rows), "utf8"))), cipher.final()]);
  return { v: 1, alg: "aes-256-gcm", iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
}

export function decryptRows(pack: NarrativePack, base64Key: string): SeedRows {
  if (pack.v !== 1 || pack.alg !== "aes-256-gcm") throw new Error("formato de pacote desconhecido");
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(base64Key), Buffer.from(pack.iv, "base64"));
  decipher.setAAD(AAD);
  decipher.setAuthTag(Buffer.from(pack.tag, "base64"));
  const plain = Buffer.concat([decipher.update(Buffer.from(pack.data, "base64")), decipher.final()]);
  return JSON.parse(gunzipSync(plain).toString("utf8")) as SeedRows;
}
