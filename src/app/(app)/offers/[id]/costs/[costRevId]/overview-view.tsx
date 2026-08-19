"use client";

// MALİYET ÖZETİ — belgenin tamamına tek bakış.
//
// Kullanıcı isteği (19.08.2026, md. 13): *"Şu an Maliyet bölümüm kalem kalem
// çalışıyor… Bunun yanında bir de EN GENEL maliyet olsun. Hem tüm vinçler
// görünsün (birden fazla kalem vinç olabilir) hem de fiyat kısmına yazdığım
// satırlar görünsün. Ayrıca vinç çelik ağırlığı ve vinç ağırlığı da yine bu
// özet görünümde olsun."*
//
// EKRAN HESAP YAPMAZ. Bütün sayılar `costOverview`den gelir (saf çekirdek,
// `cost/totals.ts`); aynı yapıyı Excel çıktısı da okur. İki yerde iki toplam
// dolaşsaydı MALIYET-24'ün anlattığı ayrışma kaçınılmazdı — ekranda 349.000,
// belgede 348.750 yazan bir teklif, hangisinin doğru olduğunu söyleyemez.
//
// ÜÇ SORUYU BİRLİKTE CEVAPLAR ve sırası bilinçlidir: (1) hangi vinç ne
// tutuyor, (2) vinç olmayan kalemlere ne yazdım, (3) sonuçta kâr ne. Kâr en
// sonda durur çünkü ötekiler onun gerekçesidir.

import { fmtMoney } from "@/lib/currency";
import { fmtCostField } from "@/lib/offers/cost/labels";
import type { CostOverview } from "@/lib/offers/cost/totals";
import { Bolum } from "./cost-parts";

/** Sayı hücresi — tabular rakam, sağa yaslı; sütun kıyısı düz kalsın. */
function Sayi({ children, kalin }: { children?: React.ReactNode; kalin?: boolean }) {
  return (
    <td className={`px-2 py-1.5 text-right font-mono text-xs tabular-nums ${kalin ? "font-semibold" : ""}`}>
      {children}
    </td>
  );
}

function kg(v: number | null): string {
  return v === null ? "—" : `${fmtCostField(v, 0)} kg`;
}

export function OzetSayfasi({
  overview,
  currency,
}: {
  overview: CostOverview;
  currency: string;
}) {
  const { items, manualLines, margin, uncostedItems } = overview;
  const para = (v: number | null) => (v === null ? "—" : fmtMoney(v, currency));

  return (
    <div className="grid gap-4">
      <Bolum
        baslik="VİNÇLER"
        aciklama="Maliyet çalışmasındaki her kalem: bir adedin ve paketin maliyeti, çelik ve toplam ağırlığı."
      >
        {items.length === 0 ? (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            Bu maliyet çalışmasında henüz kalem yok.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <thead>
                <tr className="border-b text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="px-2 py-1.5 text-left font-medium">Kalem</th>
                  <th className="px-2 py-1.5 text-right font-medium">Adet</th>
                  <th className="px-2 py-1.5 text-right font-medium">Çelik</th>
                  <th className="px-2 py-1.5 text-right font-medium">Toplam Ağırlık</th>
                  <th className="px-2 py-1.5 text-right font-medium">Birim Maliyet</th>
                  <th className="px-2 py-1.5 text-right font-medium">Paket Maliyet</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-b last:border-b-0">
                    <td className="px-2 py-1.5">{i.title || "—"}</td>
                    <Sayi>{i.qty === null ? "—" : fmtCostField(i.qty, 0)}</Sayi>
                    {/* AĞIRLIK PAKET HÂLİYLE YAZILIR: iki adet vinçte tek
                        adedin kilosu yanıltır — nakliye ve sac alımı paketin
                        kilosuyla planlanır. */}
                    <Sayi>{kg(i.steelPackageKg)}</Sayi>
                    <Sayi>{kg(i.weightPackageKg)}</Sayi>
                    <Sayi>{para(i.unit)}</Sayi>
                    <Sayi kalin>{para(i.package)}</Sayi>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2">
                  <td className="px-2 py-2 font-semibold">TOPLAM</td>
                  <Sayi />
                  <Sayi kalin>{kg(overview.steelKg)}</Sayi>
                  <Sayi kalin>{kg(overview.weightKg)}</Sayi>
                  <Sayi />
                  <Sayi kalin>{para(overview.documentTotal)}</Sayi>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* MALİYETİ AÇILMAMIŞ KALEM SESSİZ GEÇİLMEZ: fiyat toplamına girip
            maliyet toplamına girmeyen bir vinç, kârı olduğundan yüksek
            gösterir. */}
        {uncostedItems.length > 0 ? (
          <p className="rounded-md border border-dashed border-primary p-3 text-sm">
            Teklifte olup maliyeti açılmamış {uncostedItems.length} kalem var:{" "}
            <span className="font-medium">{uncostedItems.map((u) => u.title || "—").join(", ")}</span>.
            Bunların tutarı teklife giriyor ama maliyete girmiyor; aşağıdaki kâr olduğundan
            yüksek görünür.
          </p>
        ) : null}
      </Bolum>

      <Bolum
        baslik="FİYAT SATIRLARINA YAZILAN MALİYETLER"
        aciklama="Vinç olmayan kalemler (nakliye, bara, travers…): maliyeti teklifin fiyat sayfasında elle yazılır."
      >
        {manualLines.length === 0 ? (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            Fiyat sayfasında maliyeti yazılmış serbest satır yok.
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <tbody>
              {manualLines.map((l) => (
                <tr key={l.id} className="border-b last:border-b-0">
                  <td className="px-2 py-1.5">{l.description || "—"}</td>
                  <Sayi>{para(l.amount)}</Sayi>
                </tr>
              ))}
              <tr className="border-t-2">
                <td className="px-2 py-2 font-semibold">TOPLAM</td>
                <Sayi kalin>{para(overview.manualTotal)}</Sayi>
              </tr>
            </tbody>
          </table>
        )}
      </Bolum>

      <Bolum
        baslik="TEKLİF VE KÂR"
        aciklama="Maliyet belgesinin toplamı ile fiyat satırlarına yazılan maliyetlerin toplamı; karşısında teklif tutarı."
      >
        <dl className="grid gap-1.5 text-sm">
          <div className="flex items-baseline justify-between gap-4 border-b pb-1.5">
            <dt className="text-muted-foreground">Teklif Tutarı (müşterinin ödeyeceği)</dt>
            <dd className="font-mono tabular-nums">{para(margin.price)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-b pb-1.5">
            <dt className="text-muted-foreground">Toplam Maliyet (belge + elle yazılanlar)</dt>
            <dd className="font-mono tabular-nums">{para(margin.cost)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 pt-1">
            <dt className="font-semibold">KÂR</dt>
            <dd className="font-mono font-semibold tabular-nums">
              {para(margin.profit)}
              {margin.marginPercent === null ? null : (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  satış üzerinden %{fmtCostField(margin.marginPercent, 1)} · maliyet üzerinden %
                  {fmtCostField(margin.markupPercent, 1)}
                </span>
              )}
            </dd>
          </div>
        </dl>
      </Bolum>
    </div>
  );
}
