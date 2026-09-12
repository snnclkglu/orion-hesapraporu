const safariCheck=process.argv.includes("--webkit");
if(safariCheck&&!process.env.PLAYWRIGHT_BROWSERS_PATH) process.env.PLAYWRIGHT_BROWSERS_PATH=require("node:path").resolve("tmp/playwright-browsers");
const {
  chromium,
  webkit,
  expect,
} = require("C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/test");
const fs = require("node:fs");
const path = require("node:path");
(async () => {
  const output = path.resolve(safariCheck?"artifacts/task-workflow-webkit":"artifacts/task-workflow");
  fs.mkdirSync(output, { recursive: true });
  const browser = safariCheck ? await webkit.launch({headless:true}) : await chromium.launch({ headless: true, channel: "msedge" });
  const checks = [];
  const errors = [];
  try {
    for (const width of safariCheck?[375,390,430]:[320, 390, 768, 1440])
      for (const theme of ["light", "dark"]) {
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          isMobile: width < 768,
          hasTouch: width < 1024,
        });
        const page = await context.newPage();
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("console", (m) => {
          if (m.type() === "error") errors.push(m.text());
        });
        await page.goto("http://localhost:3000/dev/panel-preview", {
          waitUntil: "networkidle",
        });
        // Üretimde bulunmayan geliştirme araçları dokunma hedeflerini örtmemeli.
        // Konsol ve sayfa hataları yukarıdaki dinleyicilerle hâlâ yakalanır.
        await page.addStyleTag({content:"nextjs-portal { display: none !important; }"});
        await page.evaluate((theme) => {
          document.documentElement.classList.remove("dark", "light");
          document.documentElement.classList.add(theme);
        }, theme);
        await page.screenshot({
          animations: "disabled",
          path: path.join(
            output,
            `list-${width}${theme === "dark" ? "-dark" : ""}.png`,
          ),
        });
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth,
          ),
        ).toBe(true);
        if (width < 768) {
          await page
            .getByRole("button", { name: "Görev filtreleri", exact: true })
            .click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await page.screenshot({
            animations: "disabled",
            path: path.join(
              output,
              `filters-${width}${theme === "dark" ? "-dark" : ""}.png`,
            ),
          });
          await page
            .getByRole("button", { name: "Görevleri göster", exact: true })
            .click();
        }
        await page
          .getByRole("button", { name: "Görünümler", exact: true })
          .click();
        await page
          .getByLabel("Görünüm adı", { exact: true })
          .fill("Günlük çalışma");
        await page.getByRole("button", { name: "Kaydet", exact: true }).click();
        await expect(
          page.getByRole("button", { name: "Günlük çalışma", exact: true }),
        ).toBeVisible();
        await page
          .getByRole("button", { name: "Günlük çalışma", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Bu hafta", exact: true })
          .click();
        await expect(page.locator(".tw-agenda-day")).toHaveCount(7);
        await page.screenshot({
          animations: "disabled",
          path: path.join(
            output,
            `week-${width}${theme === "dark" ? "-dark" : ""}.png`,
          ),
        });
        await page.getByRole("button", { name: "Tümü", exact: true }).click();
        await page.locator(".tw-task-body").first().click();
        await page
          .locator("summary")
          .filter({ hasText: "Kontrol listesi" })
          .click();
        await page
          .getByLabel("Yeni kontrol adımı", { exact: true })
          .fill("Mobil kontrol adımı");
        await page
          .getByRole("button", { name: "Kontrol adımını ekle", exact: true })
          .click();
        await expect(
          page.getByLabel("Mobil kontrol adımı", { exact: true }),
        ).toBeVisible();
        await page.getByLabel("Mobil kontrol adımı", { exact: true }).click();
        await expect(
          page.getByLabel("Mobil kontrol adımı", { exact: true }),
        ).toBeChecked();
        await page.locator("summary").filter({ hasText: "Tekrar" }).click();
        await page
          .getByLabel("Tekrar düzeni", { exact: true })
          .selectOption("monthly");
        await page
          .getByRole("button", { name: "Tekrarı kaydet", exact: true })
          .click();
        await page.screenshot({
          animations: "disabled",
          path: path.join(
            output,
            `workflow-${width}${theme === "dark" ? "-dark" : ""}.png`,
          ),
        });
        await page.getByRole("button", { name: /Yorumlara git/ }).click();
        await expect(page.locator("#task-discussion")).toBeInViewport();
        expect(
          await page
            .getByRole("dialog")
            .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
        ).toBe(true);
        await page.keyboard.press("Escape");
        checks.push({
          width,
          theme,
          filters: true,
          savedView: true,
          week: true,
          checklist: true,
          recurrence: true,
          comments: true,
          overflow: false,
        });
        await context.close();
      }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(
    path.join(output, "mobile-checks.json"),
    JSON.stringify({ checks, errors }, null, 2),
  );
  if (errors.length) throw Error(errors.join("\n"));
  console.log(JSON.stringify(checks));
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
