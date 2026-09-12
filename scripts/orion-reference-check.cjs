const { chromium } = require("C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const fs = require("node:fs");
const path = require("node:path");
(async () => {
  const dir = path.resolve("artifacts/asana-reference-2026-09-12");
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const captures = [];
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 768, hasTouch: width < 768 });
    const page = await context.newPage();
    await page.goto("http://localhost:3000/dev/panel-preview", { waitUntil: "networkidle" });
    await page.evaluate(() => { document.documentElement.classList.remove("dark"); document.documentElement.classList.add("light"); });
    const save = async (state) => {
      const file = `orion-${state}-${width}.png`;
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(dir, file), animations: "disabled" });
      captures.push({ file, url: page.url(), width, height: 900, state, capturedAt: new Date().toISOString(), fixture: true });
    };
    await save("list");
    await page.locator(".tw-task-body").first().click();
    await page.getByRole("dialog").waitFor();
    await save("detail");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: width < 768 ? "Yeni görev oluştur" : "Yeni görev", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    await save("create");
    await context.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(dir, "orion-sources.json"), JSON.stringify(captures, null, 2));
  console.log(JSON.stringify(captures));
})().catch(e=>{ console.error(e.message); process.exit(1); });
