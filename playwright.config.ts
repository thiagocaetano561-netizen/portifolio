import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  // `narrative/*.spec.ts` (privado) cobre o fluxo narrativo e a busca de vazamentos.
  testDir: ".",
  testMatch: ["tests/e2e/**/*.spec.ts", "narrative/**/*.spec.ts"],
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /responsive\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: {
    // Build de produção servido localmente com um banco PGlite descartável.
    command: "npm run db:seed && npx next start -p 3100",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      SITE_URL: `http://localhost:${PORT}`,
      DATABASE_DRIVER: "pglite",
      PGLITE_DIR: "./.data/e2e",
      TRUST_PROXY: "false",
      E2E_LOCAL_PREVIEW: "true",
    },
  },
});
