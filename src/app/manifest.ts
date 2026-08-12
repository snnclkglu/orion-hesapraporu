// Web uygulama künyesi (`/manifest.webmanifest`).
//
// Kullanıcı bildirimi (12.08.2026): *"telefonumda uygulama olarak kaydettim,
// şirket logosu yok."* Sebebi basitti — manifest HİÇ YOKTU. Manifest olmadan
// Android ana ekrana bir ekran görüntüsü koyar, adı adres çubuğundan uydurur
// ve kısayol tarayıcı sekmesi olarak açılır.
//
// ÜÇ ALAN ÜÇ AYRI SORUNU ÇÖZER:
//   `icons`             — ikonun kendisi. `maskable` AYRI bir dosyadır:
//                         launcher daire/squircle'a kırpar ve yalnız ortadaki
//                         %80'i garanti eder (bkz. scripts/make-icons.ts).
//   `display`           — "standalone": kısayol adres çubuğu olmadan açılır,
//                         yani atölyedeki telefonda gerçek bir uygulama gibi.
//   `background_color`  — AÇILIŞ EKRANI. Uygulamanın İLK BOYAMADAKİ zeminiyle
//                         aynı olmalıdır (`globals.css` `:root --background`),
//                         yoksa kısayol her açıldığında bir renk sıçraması
//                         görünür. İkonun kendi karosu kömürdür; açılış
//                         ekranının zemini uygulamanın zeminidir, ikonunki
//                         değil.
//   `theme_color`       — durum çubuğu. `layout.tsx`teki `viewport.themeColor`
//                         AÇIK tema değeriyle aynı; oradaki medya sorgusu
//                         çalışırken devralır, buradaki değer ilk açılışta ve
//                         görev değiştiricide kullanılır.
//
// KİMLİK TEK KAYNAKTAN gelir (`lib/app.ts`): sekme başlığı, giriş sayfası ve
// ana ekran kısayolu aynı adı taşımalı.

import type { MetadataRoute } from "next";
import { APP_SHORT_NAME, APP_TAGLINE, APP_TITLE } from "@/lib/app";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_TITLE,
    short_name: APP_SHORT_NAME,
    description: APP_TAGLINE,
    // Kısayol köke açılır; oturum yoksa `/login`e yönlendirmeyi middleware
    // zaten yapıyor ve kullanıcı kaydettiği andaki sayfaya çakılıp kalmaz.
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    lang: "tr",
    dir: "ltr",
    background_color: "#faf9f7",
    theme_color: "#faf9f7",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/brand/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
