import { expect, test } from "@playwright/test";

test.describe("portfólio — modo visual", () => {
  test("primeira visita: boot cinematográfico, pular e chegar ao portfólio", async ({ page }) => {
    await page.goto("/");
    const terminal = page.getByRole("region", { name: "Terminal da Tryggport Dev" });
    await expect(terminal).toContainText("1 UNIDENTIFIED ARCHIVE DETECTED", { timeout: 10_000 });
    await page.getByRole("button", { name: /pular/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Tryggport");
    await expect(terminal).toContainText("Type 'help' to explore the system.");

    // segunda visita: a introdução completa não se repete
    await page.reload();
    await expect(page.getByRole("button", { name: /pular/ })).toHaveCount(0);
    await expect(terminal).toContainText("Welcome to Tryggport Dev.");
  });

  test("projetos reais, sem links quebrados nem endereços administrativos", async ({ page }) => {
    await page.goto("/#projetos");
    await expect(page.getByRole("heading", { name: "Fendalume: Ecos do Entrevéu" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "FC 26 Random Match" })).toBeVisible();
    for (const url of ["https://fendalume.online/", "https://fc26randommatch-vert.vercel.app/"]) {
      const link = page.locator(`a[href="${url}"]`).first();
      await expect(link).toHaveAttribute("rel", /noopener/);
      await expect(link).toHaveAttribute("target", "_blank");
    }
    // nunca o painel de configurações da Vercel
    await expect(page.locator('a[href*="vercel.com"]')).toHaveCount(0);
    await expect(page.getByText(/captura real · 13\/11\/2026/)).toHaveCount(2);

    const details = page.getByRole("button", { name: "Detalhes" }).first();
    await details.click();
    await expect(page.getByRole("button", { name: "Menos detalhes" })).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText(/tecnologias: HTML5 Canvas/)).toBeVisible();
  });

  test("pistas visuais públicas têm equivalente textual e são inertes", async ({ page, request }) => {
    await page.addInitScript(() => localStorage.setItem("tp_boot", "1"));
    await page.goto("/");
    const beacons = page.getByRole("img", { name: /sinal luminoso/ });
    await expect(beacons).toHaveCount(4);
    await expect(beacons.first()).toHaveAttribute("aria-label", /lampejos, forma de triângulo/);
    // sem sessão, o servidor não libera nenhuma variante secreta da interface
    const ui = await request.post("/api/ui", { data: {}, headers: { origin: "http://localhost:3100", "x-tryggport-client": "1" } });
    expect(await ui.json()).toEqual({ slots: {} });
  });

  test("vídeos cinematográficos: só do próprio site, pausados fora da tela e nunca com movimento reduzido", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const videos: string[] = [];
    page.on("request", (r) => /\.(webm|mp4)$/.test(new URL(r.url()).pathname) && videos.push(r.url()));
    await page.addInitScript(() => localStorage.setItem("tp_boot", "1"));
    await page.goto("/");
    await page.waitForTimeout(2500);
    expect(videos.length).toBeGreaterThan(0);
    for (const v of videos) expect(new URL(v).origin).toBe("http://localhost:3100");
    const heroPlaying = await page.evaluate(() => [...document.querySelectorAll("#inicio video")].some((v) => !(v as HTMLVideoElement).paused));
    expect(heroPlaying).toBe(true);
    await page.evaluate(() => document.querySelector("#contato")!.scrollIntoView());
    await page.waitForTimeout(800);
    const heroPausedAfterScroll = await page.evaluate(() => [...document.querySelectorAll("#inicio video")].every((v) => (v as HTMLVideoElement).paused));
    expect(heroPausedAfterScroll).toBe(true);
    await ctx.close();

    const reduced = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const p2 = await reduced.newPage();
    const v2: string[] = [];
    p2.on("request", (r) => /\.(webm|mp4)$/.test(new URL(r.url()).pathname) && v2.push(r.url()));
    await p2.addInitScript(() => localStorage.setItem("tp_boot", "1"));
    await p2.goto("/");
    await p2.waitForTimeout(2000);
    expect(v2).toEqual([]);
    await reduced.close();
  });

  test("o aviso discreto do hero leva ao registro de inicialização", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("tp_boot", "1"));
    await page.goto("/");
    await page.getByRole("button", { name: /Aviso do sistema/ }).click();
    await expect(page).toHaveURL(/\/terminal$/);
    await expect(page.getByRole("log")).toContainText("memory verification ........ WARNING");
  });

  test("cabeçalhos de segurança e CSP com nonce", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    const csp = h["content-security-policy"] ?? "";
    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).toMatch(/frame-ancestors 'none'/);
    expect(csp).toMatch(/object-src 'none'/);
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toMatch(/camera=\(\)/);
    expect(h["x-powered-by"]).toBeUndefined();

    const res2 = await request.get("/");
    const nonce1 = csp.match(/nonce-([^']+)/)?.[1];
    const nonce2 = (res2.headers()["content-security-policy"] ?? "").match(/nonce-([^']+)/)?.[1];
    expect(nonce1).not.toBe(nonce2);
  });

  test("sem violações de CSP nem erros no console", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await page.getByRole("button", { name: /pular/ }).click().catch(() => undefined);
    await page.waitForTimeout(800);
    expect(errors).toEqual([]);
  });

  test("arquivos internos não são servidos", async ({ request }) => {
    for (const path of ["/.env", "/.env.local", "/package.json", "/narrative/index.ts", "/src/server/env.ts", "/.data/pglite", "/_next/static/../../package.json"]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(404);
    }
    const api = await request.get("/api/terminal");
    expect(api.status()).toBe(405);
  });

  test("404 personalizada", async ({ page }) => {
    const res = await page.goto("/porta-que-nao-existe");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Porta não encontrada." })).toBeVisible();
  });
});

test.describe("sem JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("o portfólio público continua acessível", async ({ page }) => {
    await page.goto("/terminal");
    await expect(page.getByRole("heading", { name: "Fendalume: Ecos do Entrevéu" })).toBeVisible();
    await expect(page.getByText("Tecnologias efetivamente usadas")).toBeVisible();
    // mesmo em /terminal, sem JS o terminal não cobre o portfólio
    await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
    const covered = await page.evaluate(() => {
      const h1 = document.querySelector("h1")!.getBoundingClientRect();
      const el = document.elementFromPoint(h1.left + 10, h1.top + 10);
      return !!el?.closest(".terminal");
    });
    expect(covered).toBe(false);
    // aviso <noscript> presente no HTML (Chromium não o renderiza sob emulação de script desativado)
    expect(await page.content()).toContain("O terminal interativo precisa de JavaScript.");
  });
});
