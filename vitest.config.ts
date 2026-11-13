import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // Fora do bundler do Next, `server-only` é um marcador vazio.
      "server-only": path.resolve(import.meta.dirname, "node_modules/server-only/empty.js"),
    },
  },
  test: {
    // `narrative/*.test.ts` contém soluções e só existe na cópia privada do projeto.
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts", "narrative/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    pool: "forks",
  },
});
