import { expect, test } from "@playwright/test";

test("layout móvel sem rolagem horizontal e terminal utilizável", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("tp_boot", "1"));
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "terminal", exact: true }).click();
  const input = page.getByLabel("Comando do terminal");
  await input.fill("projects");
  await input.press("Enter");
  await expect(page.getByRole("log")).toContainText("fendalume");
  await page.screenshot({ path: "test-results/mobile-terminal.png" });
});
