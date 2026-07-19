import type { NextConfig } from "next";

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
      "connect-src 'self' https://xizhqgussaojthmjzzeu.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // PDF raporu (report route'u + issueRevision server action'ı) DejaVu
  // fontlarını dosya sisteminden okur; Vercel trace'ine dahil edilmeleri gerekir.
  outputFileTracingIncludes: {
    "/projects/**": ["./src/assets/fonts/**/*"],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
