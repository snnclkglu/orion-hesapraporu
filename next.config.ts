import type { NextConfig } from "next";

// Supabase kökeni CSP'ye ELLE YAZILMAZ, env'den türetilir. Adres iki yerde
// birden durduğunda (Vercel değişkeni + bu dosya) biri güncellenip diğeri
// unutuluyor ve tarayıcı bütün istekleri sessizce engelliyor — Frankfurt
// taşımasında bu tuzağa bir kez düşüldü. Tek kaynak: NEXT_PUBLIC_SUPABASE_URL.
const supabaseOrigin = (() => {
  const ham = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!ham) return "";
  try {
    return new URL(ham).origin;
  } catch {
    return "";
  }
})();

// Güvenlik başlıkları: şirket verisi barındıran dahili uygulama —
// iframe'e gömülme, MIME sniffing ve izinsiz tarayıcı API'leri kapalı.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js inline runtime + Tailwind style enjeksiyonu için gerekli
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      ["connect-src 'self'", supabaseOrigin, supabaseOrigin.replace(/^https:/, "wss:")]
        .filter(Boolean)
        .join(" "),
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

/**
 * PDF ÜRETEN HER BÖLÜM font ve logo dosyalarını TRACE'E ELLE EKLENMELİDİR.
 *
 * `pdf/brand.tsx` fontları ve logoyu `path.join(process.cwd(), …)` ile okur.
 * Bu yol ÇALIŞMA ANINDA kurulur, yani Next'in içe aktarma çözümleyicisi onu
 * göremez ve Vercel paketine dosyaları koymaz — belge yerelde üretilir,
 * canlıda ENOENT ile düşer. Yeni bir PDF ucu açan HER bölüm buraya bir satır
 * eklemek zorundadır.
 */
const PDF_ASSETS = [
  "./src/assets/fonts/**/*",
  "./public/brand/**/*",
  /**
   * EL KİTABININ ŞABLON GÖRSELLERİ — `lib/manual/asset-bytes.ts` bunları
   * `process.cwd()` ile diskten okur (KITAP-12: "varlık koddur, kodla
   * sürümlenir") ve yol çalışma anında kurulduğu için Next onları GÖREMEZ.
   *
   * Eksikti ve bedeli SESSİZDİ: canlıda `manualAssetBytes` null döner,
   * `pdf/manual.tsx` kaydı bulunmayan görsel bloğunu HİÇ BASMAZ (bilerek —
   * boş çerçeve okuyana olmayan bir şeyi vaat ederdi) ve DIN 15020 halat
   * hasar şekilleri ile uyarı piktogramları teslim edilen kılavuzdan
   * düşerdi. Yerelde çalıştığı için de fark edilmezdi.
   */
  "./public/manual-assets/**/*",
];

const nextConfig: NextConfig = {
  // EK-F katalog sayfalarını küçülten canvas yerel (native) ikili taşır.
  // Turbopack bunu ESM chunk'ına gömmeye kalkarsa "non-ecmascript
  // placeable asset" ile derleme düşer; Node çalışma zamanında paket olarak
  // yüklenmesi gerekir. Vercel kurulum sırasında Linux ikilisini seçer.
  serverExternalPackages: ["@napi-rs/canvas"],
  outputFileTracingIncludes: {
    // Hesap raporu + ekipman PDF'i (report / equipment/download route'ları)
    "/projects/**": PDF_ASSETS,
    // İş Emri PDF'i (jobs/[id]/work-order route'u)
    "/jobs/**": PDF_ASSETS,
    // Ücret pusulası (personnel/bordro route'u)
    "/personnel/**": PDF_ASSETS,
    // TEKLİF belgesi (offers/[id]/revisions/[revId]/pdf route'u + yayım
    // sırasında arşive yazan server action) VE MALİYET ÇALIŞMASI iç belgesi
    // (offers/[id]/costs/[costRevId]/pdf + `issueOfferCostRevision`). Kalıp
    // ikisini de kapsar; maliyet için ayrı bir satır GEREKMEZ ama bu not
    // gerekir — yeni ucu ekleyen biri kapsandığını bilmezse aynı satırı
    // ikinci kez yazmaya kalkar.
    "/offers/**": PDF_ASSETS,
    // Sipariş onayı, satın alma talebi ve kesim planı PDF'leri
    "/purchasing/**": PDF_ASSETS,
    // Güncel İş Listesi PDF'i (sales/is-listesi)
    "/sales/**": PDF_ASSETS,
    // Teknik resim türev çıktıları (üretim listesi PDF'i)
    "/drawings/**": PDF_ASSETS,
    // Yönetim kullanıcı/müşteri profil raporları
    "/admin/**": PDF_ASSETS,
    // Katalog sayfaları: üretici katalog sayfaları `public/` altında DEĞİLDİR
    // (kimlik doğrulamalı uçtan sunulur), bu yüzden trace'e elle eklenir.
    "/api/catalog-sheet/**": ["./catalog-sheets/**/*"],
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      // KENDİ BELGEMİZİ KENDİ ÇERÇEVEMİZDE GÖSTEREBİLMEK İÇİN TEK İSTİSNA.
      //
      // Üstteki taban `X-Frame-Options: DENY` + `frame-ancestors 'none'`
      // taşır; bu, uygulamanın başka bir siteye gömülmesini engeller ama
      // AYNI KÖKENDEN gömülmesini de engeller — teklif önizleme penceresindeki
      // `<iframe>` bu yüzden boş bir "belge açılamadı" ikonu gösteriyordu
      // (kullanıcı bildirimi, 17.08.2026).
      //
      // Gevşetme YALNIZ PDF UCUNDADIR ve yalnız `'self'`e kadardır: sayfaların
      // tamamı DENY olarak kalır. Genel başlığı `SAMEORIGIN`a çekmek daha kısa
      // olurdu ama bütün ekranları gömülebilir yapardı — tıklama hırsızlığına
      // karşı korumayı bir önizleme kolaylığı için bırakmaya değmez.
      {
        source: "/offers/:id/revisions/:revId/pdf",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Content-Security-Policy",
            value: ["default-src 'self'", "frame-ancestors 'self'", "base-uri 'self'"].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
