import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** Verificação automática WCAG 2.x A/AA (não substitui revisão manual). */
for (const path of ["/", "/terminal"]) {
  test(`acessibilidade automática (WCAG A/AA) em ${path}`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("tp_boot", "1"));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path);
    await page.waitForTimeout(800);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.length} nó(s) — ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });
}
