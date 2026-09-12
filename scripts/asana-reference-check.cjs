/* Herkese açık resmi sayfalarda salt okunur referans ve ekran kanıtı. */
const { chromium } = require("C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const fs = require("node:fs");
const path = require("node:path");
(async () => {
  const dir = path.resolve("artifacts/asana-reference-2026-09-12");
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const results = [];
  for (const [id, url] of [
    ["my-tasks", "https://asana.com/features/project-management/my-tasks"],
    ["tasks", "https://asana.com/features/project-management/tasks"],
    ["views", "https://asana.com/features/project-management/project-views"],
    ["android", "https://help.asana.com/s/article/android-basics?language=en_US"],
    ["ios", "https://help.asana.com/s/article/creating-tasks-and-projects-on-ios?language=en_US"],
    ["apps", "https://asana.com/features/project-management/mobile-desktop-apps"],
  ]) {
    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.locator("h1").first().waitFor({ timeout: 20000 });
      const images = await page.locator("img").evaluateAll(items => items.map(i => ({ alt: i.alt, src: i.currentSrc || i.src, width: i.naturalWidth, height: i.naturalHeight })));
      const item = { id, url, actualUrl: page.url(), title: await page.title(), capturedAt: new Date().toISOString(), images };
      await page.screenshot({ path: path.join(dir, `${id}-page.png`) });
      for (let n = 0; n < images.length; n++) {
        if (!/screenshot in Asana|My tasks screen|Home page android|Account page android|Offline android|iOS/i.test(images[n].alt)) continue;
        const img = page.getByAltText(images[n].alt, { exact: true }).first();
        await img.scrollIntoViewIfNeeded();
        await img.evaluate(i => i.decode().catch(() => {}));
        await img.screenshot({ path: path.join(dir, `${id}-image-${n}.png`) });
        images[n].capture = `${id}-image-${n}.png`;
        images[n].src = await img.evaluate(i => i.currentSrc || i.src);
      }
      results.push(item);
    } catch (e) { results.push({ id, url, error: e.message }); }
    await page.close();
    fs.writeFileSync(path.join(dir, "sources.json"), JSON.stringify(results, null, 2));
  }
  await browser.close();
  console.log(JSON.stringify(results.map(({id,title,images,error})=>({id,title,images:images?.filter(i=>i.width>400),error})), null, 2));
})().catch(e => { console.error(e.message); process.exitCode = 1; });
