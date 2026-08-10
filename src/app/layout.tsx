import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { APP_TAGLINE, APP_TITLE } from "@/lib/app";
import { Toaster } from "@/components/ui/sonner";

// Orion Cranes marka tipografisi (Marka Kimliği Kılavuzu REV 01):
// Archivo — display & metin; IBM Plex Mono — teknik etiket/veri.
// İkisi de Google Fonts'ta; Türkçe glifler için latin-ext şart.
const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: APP_TITLE,
  description: APP_TAGLINE,
};

/*
 * Mobil görünüm alanı.
 *
 * Ölçek ayarları Next'in varsayılanıyla AYNIDIR ve bilinçlidir: `maximumScale`
 * ya da `userScalable: false` YAZILMAZ — kullanıcının yakınlaştırmasını
 * kapatmak, teknik resim ve ölçü tablosu okuyan bir uygulamada erişilebilirliği
 * doğrudan kırar. Buradaki tek ek `themeColor`dır: Android Chrome adres çubuğu
 * ve iOS sekme şeridi sayfanın zeminiyle aynı rengi alır, böylece kabuğun üst
 * kenarı tarayıcı arayüzünde kesilmiş gibi durmaz. Değerler `globals.css`teki
 * `--background` tonlarının karşılığıdır.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#232220" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={cn("h-full", "antialiased", archivo.variable, plexMono.variable, "font-sans")}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/*
          Bildirim şeridi üstte ortalıdır. Telefonda kabuğun yapışkan üst şeridi
          de oradadır: varsayılan 16px'lik mobil payla bildirim hamburgerin ve
          bölüm başlığının üzerine oturuyor, kullanıcı bildirimi okurken menüye
          erişemiyordu. Pay şeridin altına indirilir.

          SABİT 60px DEĞİL: şerit `lg` altında bir ya da İKİ satırdır (sayfanın
          eylemi varsa eylem şeridi de çizilir) ve sabit pay o sayfalarda
          bildirimi Kaydet/Yayınla düğmelerinin üstüne bindiriyordu. Gerçek
          yüksekliği `AppShell` ölçüp `--app-header-h`ye yazar.

          `offset` DE verilir, yalnız `mobileOffset` YETMEZ: sonner'ın mobil
          kuralı `@media (max-width: 600px)` içindedir, yani 601–1023px'te
          (tam olarak iPad portre) masaüstünün varsayılan 24px'lik payı
          geçerliydi ve toaster'ın z-index'i şeridi örttüğü için bildirim
          hamburgerin üstüne oturuyordu. Bu, bugün de var olan bir hatadır.
        */}
        <Toaster
          richColors
          position="top-center"
          offset={{ top: "calc(var(--app-header-h, 48px) + 12px)" }}
          mobileOffset={{ top: "calc(var(--app-header-h, 48px) + 8px)" }}
        />
      </body>
    </html>
  );
}
