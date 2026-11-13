import { expect, test, type Page } from "@playwright/test";

async function openTerminal(page: Page) {
  await page.addInitScript(() => localStorage.setItem("tp_boot", "1"));
  await page.goto("/terminal");
  const input = page.getByLabel("Comando do terminal");
  await expect(input).toBeFocused();
  return input;
}

async function run(page: Page, command: string) {
  const input = page.getByLabel("Comando do terminal");
  await input.fill(command);
  const response = page.waitForResponse((r) => r.url().endsWith("/api/terminal"));
  await input.press("Enter");
  await response;
  await expect(input).not.toHaveAttribute("readonly", "");
}

const log = (page: Page) => page.getByRole("log");

test.describe("terminal", () => {
  test("comandos públicos, histórico e autocompletar", async ({ page }) => {
    const input = await openTerminal(page);
    await run(page, "help");
    await expect(log(page)).toContainText("COMANDOS DISPONÍVEIS");
    await run(page, "project fc26");
    await expect(log(page)).toContainText("FC 26 Random Match");
    await run(page, "skills");
    await expect(log(page)).toContainText("Drizzle ORM");

    await input.press("ArrowUp");
    await expect(input).toHaveValue("skills");
    await input.press("ArrowUp");
    await expect(input).toHaveValue("project fc26");

    await input.fill("whoa");
    await input.press("Tab");
    await expect(input).toHaveValue("whoami ");
    await input.fill("project fen");
    await input.press("Tab");
    await expect(input).toHaveValue("project fendalume");
  });

  test("navegação virtual e path traversal", async ({ page }) => {
    await openTerminal(page);
    await run(page, "ls");
    await expect(log(page)).toContainText("projetos/");
    await run(page, "cd projetos");
    await expect(page.getByText("visitor@tryggport:~/projetos$").last()).toBeVisible();
    await run(page, "cat ../../../../etc/passwd");
    await expect(log(page)).toContainText("arquivo ou diretório inexistente");
    await run(page, "cd ../../../../../..");
    await run(page, "pwd");
    await expect(log(page).locator("div").last()).toHaveText("/");
  });

  test("entradas com HTML são exibidas como texto (sem XSS)", async ({ page }) => {
    let dialog = false;
    page.on("dialog", (d) => {
      dialog = true;
      void d.dismiss();
    });
    await openTerminal(page);
    await run(page, `echo <img src=x onerror="alert(1)"><script>alert(2)</script>`);
    await expect(log(page)).toContainText("<img src=x");
    await expect(page.locator('[role="log"] img')).toHaveCount(0);
    await expect(page.locator('[role="log"] script')).toHaveCount(0);
    expect(dialog).toBe(false);
  });

  test("comandos ocultos não existem até serem merecidos", async ({ page }) => {
    await openTerminal(page);
    await run(page, "help");
    const help = await log(page).innerText();
    expect(help).not.toMatch(/mount|recall|protocol|connect/);
    await run(page, "mount qualquer");
    await expect(log(page)).toContainText("comando não encontrado: mount");
  });

  test("Esc volta ao modo visual e o modo terminal pode ser reaberto", async ({ page }) => {
    const input = await openTerminal(page);
    await input.press("Escape");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
    await page.getByRole("button", { name: "terminal", exact: true }).click();
    await expect(page).toHaveURL(/\/terminal$/);
    await expect(page.getByLabel("Comando do terminal")).toBeFocused();
  });

  test("dicas graduais no terminal", async ({ page }) => {
    await openTerminal(page);
    await run(page, "hint");
    await expect(log(page)).toContainText("DICA ·");
    await expect(log(page)).toContainText("dica 1 de 3");
    await run(page, "hint");
    await expect(log(page)).toContainText("próxima dica fica disponível");
  });

  test("clear e logout", async ({ page }) => {
    await openTerminal(page);
    await run(page, "about");
    await page.getByLabel("Comando do terminal").fill("clear");
    await page.getByLabel("Comando do terminal").press("Enter");
    await expect(log(page)).not.toContainText("Tryggport Dev é uma marca");
    await run(page, "logout");
    await expect(log(page)).toContainText("logout --confirm");
  });

  test("sinal visual: sequência clássica de teclas mostra um aviso", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("tp_boot", "1"));
    await page.goto("/");
    await page.locator("body").click({ position: { x: 5, y: 400 } });
    for (const k of ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"]) {
      await page.keyboard.press(k);
    }
    await expect(page.getByRole("status").filter({ hasText: "sinal" })).toBeVisible();
  });
});
