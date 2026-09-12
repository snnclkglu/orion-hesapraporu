/* Gerçek klavyeyi taklit ettiği iddia edilmez: görünür alan küçülmesi ayrı sınanır. */
const fs = require("node:fs");
const path = require("node:path");
const safari = process.argv.includes("--webkit");
if (safari)
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.resolve(
    "tmp/playwright-browsers",
  );
const {
  chromium,
  webkit,
  expect,
} = require("C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/test");
(async () => {
  const output = path.resolve(
    "artifacts/panel-revision-" + (safari ? "webkit" : "chromium"),
  );
  fs.mkdirSync(output, { recursive: true });
  const browser = await (safari ? webkit : chromium).launch({
    headless: true,
    ...(safari ? {} : { channel: "msedge" }),
  });
  const checks = [],
    errors = [];
  for (const width of [320, 360, 375, 390, 430, 768, 820, 844, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 844 ? 390 : 900 },
      isMobile: width < 768,
      hasTouch: width < 1024,
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    for (const route of [
      "panel-preview",
      "account-preview",
      "feedback-preview",
      "teams-preview",
    ]) {
      await page.goto("http://localhost:3000/dev/" + route, {
        waitUntil: "networkidle",
      });
      await page.addStyleTag({
        content: "nextjs-portal{display:none!important}",
      });
      for (const theme of ["light", "dark"]) {
        await page.evaluate((t) => {
          document.documentElement.classList.remove("light", "dark");
          document.documentElement.classList.add(t);
        }, theme);
        const overflow = await page.evaluate(() => {
          const findings = [];
          for (const el of document.querySelectorAll(
            ".tw-periods,.ac-filters,.ac-filters label,.ac-filters input,.ac-filters select,.ac-filter-actions,.tw-task,.tw-form-grid,.ac-card",
          )) {
            const r = el.getBoundingClientRect();
            if (!r.width || !r.height) continue;
            const parent = el.parentElement.getBoundingClientRect();
            if (
              r.left < -1 ||
              r.right > innerWidth + 1 ||
              (el.matches("input,select") &&
                (r.right > parent.right + 1 || r.left < parent.left - 1)) ||
              el.scrollWidth > el.clientWidth + 1
            )
              findings.push(el.className || el.tagName);
          }
          if (document.documentElement.scrollWidth > innerWidth + 1)
            findings.push("document");
          return findings;
        });
        expect(overflow, `${width} ${route} ${theme}`).toEqual([]);
        checks.push({ width, route, theme, overflow });
        if (width === 390 || width === 1440)
          await page.screenshot({
            path: path.join(output, `${route}-${width}-${theme}.png`),
            fullPage: true,
          });
      }
    }
    if (width < 768) {
      await page.goto("http://localhost:3000/dev/panel-preview", {
        waitUntil: "networkidle",
      });
      if (width === 390) {
        await page.goto(
          "http://localhost:3000/dev/panel-preview?view=menu&period=upcoming",
          { waitUntil: "networkidle" },
        );
        await expect(
          page.getByRole("heading", { name: "Görevlerim", exact: true }),
        ).toBeVisible();
        expect(new URL(page.url()).searchParams.get("view")).toBe("mine");
        expect(new URL(page.url()).searchParams.get("period")).toBe("upcoming");
        await expect(page.locator(".tw-active-period")).toContainText(
          "Yaklaşan",
        );
        await page.getByRole("button", { name: "Filtreyi temizle" }).click();
      }
      await expect(
        page
          .getByRole("navigation", { name: "Panel gezinme" })
          .getByRole("button"),
      ).toHaveCount(4);
      await expect(
        page.getByRole("button", { name: "Yaklaşan", exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Görev filtreleri", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("combobox", { name: "Dönem filtresi" })
        .selectOption("archived");
      await page.getByRole("button", { name: "Görevleri göster" }).click();
      await expect(
        page.getByRole("button", { name: "Filtreyi temizle" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Filtreyi temizle" }).click();
      await page
        .getByRole("button", { name: "Yeni görev oluştur", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      expect(
        await page.evaluate(() =>
          document.activeElement?.matches("input,textarea"),
        ),
      ).toBe(false);
      await page.evaluate(() => {
        Object.defineProperty(visualViewport, "height", {
          configurable: true,
          get: () => 340,
        });
        Object.defineProperty(visualViewport, "offsetTop", {
          configurable: true,
          get: () => 20,
        });
        visualViewport.dispatchEvent(new Event("resize"));
      });
      await expect
        .poll(async () =>
          dialog.evaluate((el) =>
            Math.round(el.getBoundingClientRect().bottom),
          ),
        )
        .toBeLessThanOrEqual(360);
      const title = page.getByRole("textbox", {
        name: "Görev başlığı",
        exact: true,
      });
      await title.fill("Klavye görünür alan kontrolü");
      await expect(title).toHaveValue("Klavye görünür alan kontrolü");
      const bounds = await title.boundingBox();
      expect(bounds.y).toBeGreaterThanOrEqual(20);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(360);
      if (width === 390)
        await page.screenshot({
          path: path.join(output, "new-task-visible-viewport.png"),
        });
      await page.evaluate(() => {
        delete visualViewport.height;
        delete visualViewport.offsetTop;
        visualViewport.dispatchEvent(new Event("resize"));
      });
      await expect(title).toHaveValue("Klavye görünür alan kontrolü");
      await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
      if (width === 390) {
        await page.locator(".tw-task-body").first().click();
        const comment = page.getByRole("textbox", {
          name: "Yorum",
          exact: true,
        });
        await comment.fill("Görünür alan daralırken taslak korunuyor.");
        await page.evaluate(() => {
          Object.defineProperty(visualViewport, "height", {
            configurable: true,
            get: () => 340,
          });
          Object.defineProperty(visualViewport, "offsetTop", {
            configurable: true,
            get: () => 20,
          });
          visualViewport.dispatchEvent(new Event("resize"));
        });
        await expect
          .poll(async () =>
            comment.evaluate((el) =>
              Math.round(el.getBoundingClientRect().bottom),
            ),
          )
          .toBeLessThanOrEqual(360);
        await expect(comment).toHaveValue(
          "Görünür alan daralırken taslak korunuyor.",
        );
        await page.screenshot({
          path: path.join(output, "comment-visible-viewport.png"),
        });
        await page.evaluate(() => {
          delete visualViewport.height;
          delete visualViewport.offsetTop;
          visualViewport.dispatchEvent(new Event("resize"));
        });
        await dialog
          .getByRole("button", { name: "Kapat", exact: true })
          .click();
        await page
          .getByRole("button", { name: /: sorumlu/ })
          .first()
          .click();
        await expect(dialog).toBeVisible();
        expect(
          await page.evaluate(() =>
            document.activeElement?.matches("input,textarea"),
          ),
        ).toBe(false);
        await dialog
          .getByRole("textbox", { name: "Kişi ara", exact: true })
          .fill("ECE");
        await expect(
          dialog.getByRole("button", { name: "ECE DEMİR", exact: true }),
        ).toBeVisible();
        await dialog
          .getByRole("button", { name: "Kapat", exact: true })
          .click();
      }
      await page.goto("http://localhost:3000/dev/account-preview", {
        waitUntil: "networkidle",
      });
      const phone = page.getByRole("textbox", {
        name: "Telefon (+90)",
        exact: true,
      });
      await phone.fill("+90 (212) 123 45 67");
      await phone.blur();
      await expect(phone).toHaveValue("(212) 123 45 67");
      await phone.fill("212123456789");
      await phone.blur();
      await expect(phone).toHaveAttribute("aria-invalid", "true");
      await page.getByRole("button", { name: "Bilgileri kaydet" }).click();
      await expect(page.locator(".ac-status[role=alert]")).toContainText(
        "10 rakam",
      );
      await phone.fill("");
      await phone.blur();
      await expect(phone).toHaveValue("");
      checks.push({
        width,
        flows:
          "Dört sekme, arşiv erişimi, daralan görünür alan, taslak korunması, telefon",
      });
    }
    await context.close();
  }
  await browser.close();
  fs.writeFileSync(
    path.join(output, "report.json"),
    JSON.stringify(
      {
        checks,
        errors,
        physicalKeyboard: "Doğrulanmadı; gerçek iPhone kabulü ayrıca gerekli",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ checks: checks.length, errors, output }));
  if (errors.length) process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
