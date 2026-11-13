import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Token opaco de sessão: 32 bytes aleatórios (256 bits) em base64url. */
export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hmacHex(key: string, value: string): string {
  return createHmac("sha256", Buffer.from(key, "base64")).update(value, "utf8").digest("hex");
}

/**
 * Verificador de resposta. A identidade do desafio entra na mensagem para que
 * o mesmo texto produza verificadores diferentes em desafios diferentes.
 */
export function answerVerifier(key: string, challengeId: string, normalizedAnswer: string): string {
  return hmacHex(key, `tryggport/v1\u0000${challengeId}\u0000${normalizedAnswer}`);
}

/** Comparação em tempo constante entre dois hex de mesmo tamanho. */
export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ba.length !== bb.length || ba.length === 0) return false;
  return timingSafeEqual(ba, bb);
}

/** Verifica contra todos os verificadores aceitos sem interromper no primeiro acerto. */
export function matchesAnyVerifier(candidate: string, verifiers: readonly string[]): boolean {
  let ok = false;
  for (const v of verifiers) {
    if (safeEqualHex(candidate, v)) ok = true;
  }
  return ok;
}

export function hashIp(key: string, ip: string): string {
  return createHmac("sha256", key).update(`ip\u0000${ip}`, "utf8").digest("hex").slice(0, 32);
}
