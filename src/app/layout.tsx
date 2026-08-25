import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { APP_SHORT_NAME, APP_TAGLINE, APP_TITLE } from "@/lib/app";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";

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

/*
 * Sekme ve ana ekran kimliği.
 *
 * İKONLAR BURADA YAZILMAZ: Next `app/icon.svg`, `app/favicon.ico` ve
 * `app/apple-icon.png` dosyalarını METADATA DOSYASI olarak tanır ve `<link>`
 * etiketlerini kendisi basar; `app/manifest.ts` de öyle. Üçünü de
 * `scripts/make-icons.ts` marka sembolünden üretir — elle düzenlenmezler.
 *
 * `appleWebApp` iOS'un ana ekrana eklenen kısayolu için gerekir: onsuz kısayol
 * Safari sekmesi olarak açılır ve üst şeritte adres çubuğu kalır. Başlık
 * ayrıca verilir çünkü iOS `short_name`i okumaz.
 */
export const metadata: Metadata = {
  title: APP_TITLE,
  description: APP_TAGLINE,
  applicationName: APP_TITLE,
  appleWebApp: {
    capable: true,
    title: APP_SHORT_NAME,
    // "default": durum çubuğu yazıları koyu, zemin sayfanın kendi rengi.
    // "black-translucent" içeriği çentiğin altına iter ve kabuğun yapışkan
    // üst şeridi oraya sıkışırdı.
    statusBarStyle: "default",
  },
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
    // KOYU TEMA (kullanıcı onayı, 16.08.2026): palet CSS'i ilk günden hazırdı
    // (globals.css .dark bloku), eksik olan tek şey `.dark` sınıfını yazan bir
    // sağlayıcıydı. `suppressHydrationWarning` ZORUNLU: next-themes sınıfı
    // ilk boyamadan önce script ile yazar ve React bunu uyuşmazlık sanır.
    <html
      lang="tr"
      suppressHydrationWarning
      className={cn("h-full", "antialiased", archivo.variable, plexMono.variable, "font-sans")}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
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
          closeButton
          position="top-center"
          offset={{ top: "calc(var(--app-header-h, 48px) + 12px)" }}
          mobileOffset={{ top: "calc(var(--app-header-h, 48px) + 8px)" }}
          toastOptions={{
            closeButtonAriaLabel: "Bildirimi kapat",
            classNames: {
              closeButton: "!top-2 !right-2 !left-auto !translate-x-0 !translate-y-0",
            },
          }}
        />
        </ThemeProvider>
      </body>
    </html>
  );
}
