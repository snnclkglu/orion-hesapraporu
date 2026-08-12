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

const nextConfig: NextConfig = {
  // PDF raporu (report route'u + issueRevision server action'ı) DejaVu
  // fontlarını ve Orion Cranes logosunu (public/brand) dosya sisteminden okur;
  // Vercel trace'ine dahil edilmeleri gerekir.
  outputFileTracingIncludes: {
    // Hesap raporu + ekipman PDF'i (report / equipment/download route'ları)
    "/projects/**": ["./src/assets/fonts/**/*", "./public/brand/**/*"],
    // İş Emri PDF'i (jobs/[id]/work-order route'u) aynı font+logo dosyalarını okur
    "/jobs/**": ["./src/assets/fonts/**/*", "./public/brand/**/*"],
    // Ücret pusulası (finance/bordro route'u) aynı font+logo dosyalarını okur
    "/personnel/**": ["./src/assets/fonts/**/*", "./public/brand/**/*"],
    // Katalog sayfaları: üretici katalog sayfaları `public/` altında DEĞİLDİR
    // (kimlik doğrulamalı uçtan sunulur), bu yüzden trace'e elle eklenir.
    "/api/catalog-sheet/**": ["./catalog-sheets/**/*"],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
