const sharp = require("sharp");
const fs = require("node:fs");
const path = require("node:path");
const safari = process.argv.includes("--webkit");
if (safari) process.env.PLAYWRIGHT_BROWSERS_PATH = path.resolve("tmp/playwright-browsers");
const { chromium, webkit, expect } = require("C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/test");
(async () => {
  const base = process.env.QA_BASE_URL || "http://localhost:3000";
  const output = path.resolve(safari ? "artifacts/account-mobile-webkit" : "artifacts/account-mobile");
  fs.mkdirSync(output, { recursive: true });
  const browser = await (safari ? webkit : chromium).launch({ headless: true, ...(safari ? {} : { channel: "msedge" }) });
  const checks = [];
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  await page.goto(`${base}/dev/account-preview`, { waitUntil: "networkidle" });
  await page
    .getByLabel("Ad soyad", { exact: true })
    .fill("DENİZ UZUN SOYAD DOĞRULAMA");
  await page
    .getByRole("button", { name: "Bilgileri kaydet", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Önizleme");
  checks.push("Profil kaydetme önizlemesi");
  const bytes = await sharp({
    create: { width: 160, height: 80, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel("Fotoğraf seç", { exact: true })
    .setInputFiles({ name: "qa.png", mimeType: "image/png", buffer: bytes });
  await expect(page.getByAltText("Fotoğraf kırpma önizlemesi")).toBeVisible();
  await page.getByLabel("Yakınlaştır", { exact: true }).fill("2");
  await page.screenshot({
    path: path.join(output, "crop-390.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Fotoğrafı kullan", exact: true })
    .click();
  await expect(page.getByAltText("Fotoğraf kırpma önizlemesi")).toHaveCount(0);
  await page.waitForLoadState("networkidle");
  checks.push("Dosya seçme, kırpma ve kaydetme");
  await page.goto(`${base}/dev/teams-preview`, { waitUntil: "networkidle" });
  await page.getByLabel("Kullanıcı ara", { exact: true }).fill("ECE");
  await page.getByRole("checkbox").click();
  await expect(page.getByRole("checkbox")).toBeChecked();
  await page.getByLabel("Kullanıcı ara", { exact: true }).fill("SONUÇ YOK");
  await expect(
    page.getByRole("button", { name: "ECE DEMİR · Kaldır", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "1 kişiyi ekle", exact: true })
    .click();
  checks.push("Üye arama ve arama değişiminde seçimi koruma");
  await page.goto(`${base}/dev/feedback-preview`, { waitUntil: "networkidle" });
  await page
    .getByLabel("Geri bildirimin", { exact: true })
    .fill("Mobil form doğrulaması");
  await page
    .getByRole("button", { name: "Yönetime gönder", exact: true })
    .click();
  await expect(
    page.getByText("Önizleme: gönderi kaydedilmedi.", { exact: true }),
  ).toContainText("Önizleme");
  checks.push("Geri bildirim önizleme gönderimi");
  await page.goto(`${base}/dev/panel-preview`, { waitUntil: "networkidle" });
  await page
    .getByRole("button", { name: "Yeni görev oluştur", exact: true })
    .click();
  await page
    .getByLabel("Görev başlığı", { exact: true })
    .fill("Kişiye özel mobil doğrulama");
  await page.getByLabel("Görev paylaşımı", { exact: true }).selectOption("direct");
  await page
    .getByLabel("Görev atanacak kişi", { exact: true })
    .selectOption({ label: "ECE DEMİR" });
  await page.getByRole("button", { name: "Ekle", exact: true }).click();
  checks.push("Mobil kişiye özel görev oluşturma");
  await page
    .getByRole("button", { name: "Gönderdiklerim", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Kişiye özel mobil doğrulama/ }).first(),
  ).toBeVisible();
  checks.push("Gönderenin kişisel listesi");
  await page.screenshot({
    path: path.join(output, "direct-task-390.png"),
    fullPage: true,
  });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "32px";
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth + 1,
  );
  if (overflow) throw new Error("200% metin büyütmede taşma");
  checks.push("200% metin genişlik kontrolü");
  if (errors.length) throw new Error(errors.join("\n"));
  await browser.close();
  fs.writeFileSync(
    path.join(output, "interaction-report.json"),
    JSON.stringify({ base, engine: safari ? "Windows WebKit" : "Chromium", physicalDevice: false, checks, errors }, null, 2),
  );
  console.log(JSON.stringify({ checks }));
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
  process.exit(1);
});
