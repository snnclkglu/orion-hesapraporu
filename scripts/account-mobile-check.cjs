/* Önizlemelerde gerçek bileşenlerle telefon/tablet/masaüstü kabul kontrolü. */
const fs = require("node:fs");
const path = require("node:path");
const safari = process.argv.includes("--webkit");
if (safari) process.env.PLAYWRIGHT_BROWSERS_PATH = path.resolve("tmp/playwright-browsers");
const { chromium, webkit } = require("C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
(async () => {
  const output = path.resolve(safari ? "artifacts/account-mobile-webkit" : "artifacts/account-mobile");
  fs.mkdirSync(output, { recursive: true });
  const browser = await (safari ? webkit : chromium).launch({ headless: true, ...(safari ? {} : { channel: "msedge" }) });
  const results = [];
  const errors = [];
  for (const width of (safari ? [375, 390, 430, 844] : [320, 360, 390, 430, 768, 820, 1440])) {
    const context = await browser.newContext({
      viewport: { width, height: width === 844 ? 390 : 900 },
      deviceScaleFactor: 1,
      isMobile: width < 768,
      hasTouch: width < 1024,
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(String(e)));
    for (const route of [
      "account-preview",
      "feedback-preview",
      "teams-preview",
      "panel-preview",
    ]) {
      await page.goto(`http://localhost:3000/dev/${route}`, {
        waitUntil: "networkidle",
        timeout: 60000,
      });
      await page.addStyleTag({ content: "nextjs-portal { display:none!important }" });
      for (const theme of ["light", "dark"]) {
        await page.evaluate((theme) => {
          document.documentElement.classList.remove("light", "dark");
          document.documentElement.classList.add(theme);
        }, theme);
        const metrics = await page.evaluate(() => ({
          width: innerWidth,
          scroll: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
          title: document.querySelector("h1")?.textContent,
        }));
        if (metrics.scroll > width + 1 || metrics.body > width + 1)
          errors.push(
            `Taşma ${route} ${width} ${theme}: ${JSON.stringify(metrics)}`,
          );
        results.push({ route, width, theme, ...metrics });
        if ([360, 390, 1440].includes(width))
          await page.screenshot({
            path: path.join(output, `${route}-${width}-${theme}.png`),
            fullPage: true,
          });
      }
    }
    await context.close();
  }
  await browser.close();
  fs.writeFileSync(
    path.join(output, "report.json"),
    JSON.stringify({ results, errors }, null, 2),
  );
  console.log(JSON.stringify({ checks: results.length, errors, output }));
  if (errors.length) process.exitCode = 1;
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
