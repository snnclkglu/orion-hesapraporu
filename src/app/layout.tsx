import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
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
  title: "ORION Hesap Raporu",
  description: "Vinç hesap raporu hazırlama ve arşiv sistemi",
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
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
