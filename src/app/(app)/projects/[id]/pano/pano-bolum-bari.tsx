"use client";

// PANO EKRANININ ÜST BARI — dört bölüm artı iç yerleşim bağı (Plan F6).
//
// Kullanıcının cümlesi (08.09.2026): "pano yerleşimi sayfasına bir üst bar
// yapalım, sayfa aşağı doğru gitmesin, daha çok sayfa içinde bölümler olsun."
// 12.09.2026: "sayfalar pek anlaşılır değil" — beş sekme (Özet · Dizilim ·
// Panolar · Denetim · Aygıt kuyruğu) bir iş akışı anlatmıyordu. Şimdi dört
// bölüm sırayla okunur: Girdi → Panolar → Kararlar → Onay ve çıktı.
//
// SEKME DURUMU ADRESE YAZILMAZ. `page.tsx` `searchParams` okuyor ve her sorgu
// değişikliği sunucu render'ını YENİDEN KOŞTURUR — dört Supabase turu artı
// bütün yerleşim araması. Bir sekmeye basmak bir GÖRÜNÜM değişikliğidir.
// Deneme ölçüleri ve ölçek adreste kalır (PANO-14), çünkü onlar gerçekten
// yeniden çözüm gerektirir.
//
// İÇ YERLEŞİM BİR SAYFADIR, BİR GÖRÜNÜM DEĞİL (kullanıcı kararı, 09.09.2026).
import Link from "next/link";
import { SectionBottomBar } from "@/components/section-bottom-bar";
import { Badge } from "@/components/ui/badge";

export type PanoBolumu = "girdi" | "panolar" | "kararlar" | "onay";

export const PANO_BOLUMLERI: readonly { id: PanoBolumu; ad: string; kisa: string }[] = [
  { id: "girdi", ad: "1 · Girdi", kisa: "Girdi" },
  { id: "panolar", ad: "2 · Panolar", kisa: "Panolar" },
  { id: "kararlar", ad: "3 · Kararlar", kisa: "Kararlar" },
  { id: "onay", ad: "4 · Onay ve çıktı", kisa: "Onay" },
];

/** İç yerleşim bağının adı. */
export const IC_YERLESIM_ADI = "İç yerleşim";

export function PanoBolumBari({
  bolum,
  onBolum,
  sayaclar,
  icHref,
}: {
  bolum: PanoBolumu;
  onBolum: (b: PanoBolumu) => void;
  /** Sekmenin yanında görünen sayı; `0` ise rozet çizilmez. */
  sayaclar: Partial<Record<PanoBolumu, number>>;
  /** İç yerleşim sayfasının adresi; `null` = gösterilecek pano yok. */
  icHref: string | null;
}) {
  const sekmeSinifi =
    "oc-tap flex items-center justify-center gap-1.5 rounded-md px-3 text-sm min-[560px]:rounded-none min-[560px]:border-b-2 min-[560px]:py-2.5";
  return (
    <>
      <SectionBottomBar
        label="Pano Yerleşimi"
        priority={35}
        items={[
          ...PANO_BOLUMLERI.slice(0, 3).map((b) => ({
            id: b.id,
            label: b.kisa,
            active: bolum === b.id,
            onSelect: () => onBolum(b.id),
            badge: sayaclar[b.id] || undefined,
          })),
          ...(icHref ? [{ id: "inner", label: IC_YERLESIM_ADI, icon: "grid" as const, href: icHref }] : []),
        ]}
        more={PANO_BOLUMLERI.slice(3).map((b) => ({
          id: b.id,
          label: b.kisa,
          active: bolum === b.id,
          onSelect: () => onBolum(b.id),
          badge: sayaclar[b.id] || undefined,
        }))}
      />
      <nav
        aria-label="Pano bölümleri"
        className="oc-section-desktop oc-scroll-none sticky top-[var(--app-header-h,48px)] z-20 -mx-4 border-b bg-background px-4 md:-mx-6 md:px-6"
      >
        <div className="grid grid-cols-2 gap-1 py-2 min-[560px]:flex min-[560px]:gap-0 min-[560px]:py-0">
          {PANO_BOLUMLERI.map((b) => {
            const secili = b.id === bolum;
            const n = sayaclar[b.id] ?? 0;
            // Girdi ve Onay sayaçları SORUN sayar (kırmızı); Panolar ve
            // Kararlar adet sayar (nötr).
            const sorun = b.id === "girdi" || b.id === "onay";
            return (
              <button
                key={b.id}
                type="button"
                aria-current={secili ? "page" : undefined}
                onClick={() => onBolum(b.id)}
                className={`${sekmeSinifi} ${
                  secili
                    ? "bg-muted font-semibold min-[560px]:bg-transparent min-[560px]:border-foreground"
                    : "text-muted-foreground min-[560px]:border-transparent hover:text-foreground"
                }`}
              >
                {b.ad}
                {n > 0 && (
                  <Badge
                    variant={sorun ? "destructive" : "outline"}
                    className="px-1 py-0 font-mono text-[10px]"
                  >
                    {n.toLocaleString("tr-TR")}
                  </Badge>
                )}
              </button>
            );
          })}
          {icHref && (
            <Link
              href={icHref}
              className={`${sekmeSinifi} text-muted-foreground min-[560px]:border-transparent hover:text-foreground`}
            >
              {IC_YERLESIM_ADI}
              <span aria-hidden className="text-xs">
                →
              </span>
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}
