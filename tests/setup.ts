import { randomBytes } from "node:crypto";

// Chaves geradas por execução: nenhum segredo fixo vive nos testes.
(process.env as Record<string, string>).NODE_ENV = "test";
process.env.PUZZLE_HMAC_KEY = randomBytes(32).toString("base64");
process.env.IP_HASH_KEY = randomBytes(24).toString("base64");
process.env.DATABASE_DRIVER = "pglite";
process.env.SITE_URL = "http://localhost:3000";
process.env.TRUST_PROXY = "true";
