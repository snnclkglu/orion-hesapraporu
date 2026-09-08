"use client";

// PANO EKRANININ ÜST BARI — beş bölüm, yapışkan şerit.
//
// Kullanıcının cümlesi (08.09.2026): "pano yerleşimi sayfasına bir üst bar
// yapalım, sayfa aşağı doğru gitmesin, daha çok sayfa içinde bölümler olsun."
// Sayfa sekiz yığılmış bölümdü ve şemalar yüzünden çok uzundu; artık bir
// seferde bir bölüm görünüyor.
//
// SEKME DURUMU ADRESE YAZILMAZ. `page.tsx` `searchParams` okuyor ve her sorgu
// değişikliği sunucu render'ını YENİDEN KOŞTURUR — dört Supabase turu artı 726
// aygıt satırının bütün yerleşim araması. Bir sekmeye basmak bir GÖRÜNÜM
// değişikliğidir; bunun bedeli yeniden çözüm olmamalı. Deneme ölçüleri ve
// ölçek adreste kalır (PANO-14: kaydedilmemiş deneme adreste yaşar), çünkü
// onlar gerçekten yeniden çözüm gerektirir.

import { Badge } from "@/components/ui/badge";

export type PanoBolumu = "ozet" | "dizilim" | "panolar" | "denetim" | "kuyruk";

export const PANO_BOLUMLERI: readonly { id: PanoBolumu; ad: string }[] = [
  { id: "ozet", ad: "Özet" },
  { id: "dizilim", ad: "Dizilim" },
  { id: "panolar", ad: "Panolar" },
  { id: "denetim", ad: "Denetim" },
  { id: "kuyruk", ad: "Aygıt kuyruğu" },
];

export function PanoBolumBari({
  bolum,
  onBolum,
  sayaclar,
}: {
  bolum: PanoBolumu;
  onBolum: (b: PanoBolumu) => void;
  /** Sekmenin yanında görünen sayı; `0` ise rozet çizilmez. */
  sayaclar: Partial<Record<PanoBolumu, number>>;
}) {
  return (
    // DAR EKRANDA IZGARA, GENİŞTE ŞERİT (MOBIL-21 · MOBIL-14): şeride
    // `overflow-x` VERİLMEZ — yatay kaydırma kutusu dikeyi de kaydırılabilir
    // yapar ve yapışkanlık sessizce ölür.
    <nav
      aria-label="Pano bölümleri"
      className="oc-scroll-none sticky top-[var(--app-header-h,48px)] z-20 -mx-4 border-b bg-background px-4 md:-mx-6 md:px-6"
    >
      <div className="grid grid-cols-3 gap-1 py-2 min-[560px]:flex min-[560px]:gap-0 min-[560px]:py-0">
        {PANO_BOLUMLERI.map((b) => {
          const secili = b.id === bolum;
          const n = sayaclar[b.id] ?? 0;
          return (
            <button
              key={b.id}
              type="button"
              aria-current={secili ? "page" : undefined}
              onClick={() => onBolum(b.id)}
              className={`oc-tap flex items-center justify-center gap-1.5 rounded-md px-3 text-sm min-[560px]:rounded-none min-[560px]:border-b-2 min-[560px]:py-2.5 ${
                secili
                  ? "bg-muted font-semibold min-[560px]:bg-transparent min-[560px]:border-foreground"
                  : "text-muted-foreground min-[560px]:border-transparent hover:text-foreground"
              }`}
            >
              {b.ad}
              {n > 0 && (
                <Badge variant="outline" className="px-1 py-0 font-mono text-[10px]">
                  {n.toLocaleString("tr-TR")}
                </Badge>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
