import "server-only";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  SITE_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_DRIVER: z.enum(["pg", "pglite"]).default("pglite"),
  DATABASE_URL: z.string().optional(),
  PGLITE_DIR: z.string().default("./.data/pglite"),
  PUZZLE_HMAC_KEY: z.string().optional(),
  IP_HASH_KEY: z.string().optional(),
  TRUST_PROXY: z.enum(["true", "false"]).default("false"),
});

export type Env = z.infer<typeof schema> & { PUZZLE_HMAC_KEY: string; IP_HASH_KEY: string };

let cached: Env | null = null;

/**
 * Lê e valida o ambiente. Falha de forma fechada em produção:
 * sem chaves fortes ou sem PostgreSQL real, a aplicação não inicia.
 * As mensagens de erro nunca incluem os valores das variáveis.
 */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    SITE_URL: process.env.SITE_URL || undefined,
    DATABASE_DRIVER: process.env.DATABASE_DRIVER || undefined,
    DATABASE_URL: process.env.DATABASE_URL || undefined,
    PGLITE_DIR: process.env.PGLITE_DIR || undefined,
    PUZZLE_HMAC_KEY: process.env.PUZZLE_HMAC_KEY || undefined,
    IP_HASH_KEY: process.env.IP_HASH_KEY || undefined,
    TRUST_PROXY: process.env.TRUST_PROXY || undefined,
  });
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Configuração de ambiente inválida (${fields}).`);
  }
  const env = parsed.data;
  const problems: string[] = [];
  if (env.DATABASE_DRIVER === "pg" && !env.DATABASE_URL) {
    problems.push("DATABASE_URL está vazia — cole a connection string do Neon (DATABASE_URL_UNPOOLED) no arquivo de ambiente");
  }
  if (!env.PUZZLE_HMAC_KEY || Buffer.from(env.PUZZLE_HMAC_KEY, "base64").length < 32) {
    problems.push("PUZZLE_HMAC_KEY ausente ou com menos de 32 bytes (base64)");
  }
  if (!env.IP_HASH_KEY || env.IP_HASH_KEY.length < 16) {
    problems.push("IP_HASH_KEY ausente ou curta demais");
  }
  // Prévia local de produção usada SOMENTE pelos testes end-to-end (localhost, PGlite).
  // Nunca defina E2E_LOCAL_PREVIEW em um deploy real.
  const localPreview = process.env.E2E_LOCAL_PREVIEW === "true" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(env.SITE_URL);
  if (env.NODE_ENV === "production" && !localPreview) {
    if (env.DATABASE_DRIVER !== "pg") problems.push("DATABASE_DRIVER deve ser 'pg' em produção");
    if (!env.DATABASE_URL) problems.push("DATABASE_URL é obrigatória em produção");
    if (!env.SITE_URL.startsWith("https://")) problems.push("SITE_URL deve usar HTTPS em produção");
    if (env.TRUST_PROXY !== "true" && process.env.ALLOW_NO_PROXY !== "true") {
      problems.push("TRUST_PROXY=true é necessário em produção para limites por IP (ou ALLOW_NO_PROXY=true)");
    }
  }
  if (problems.length) {
    throw new Error(`Configuração de ambiente inválida: ${problems.join("; ")}. Veja .env.example.`);
  }
  cached = env as Env;
  return cached;
}

/** Apenas para testes. */
export function resetEnvCache() {
  cached = null;
}
