"use client";

// MALİYET ÖZETİ — belgenin tamamına TEK LİSTEDEN bakış.
//
// Kullanıcı isteği (19.08.2026, md. 13): *"Şu an Maliyet bölümüm kalem kalem
// çalışıyor… Bunun yanında bir de EN GENEL maliyet olsun. Hem tüm vinçler
// görünsün (birden fazla kalem vinç olabilir) hem de fiyat kısmına yazdığım
// satırlar görünsün. Ayrıca vinç çelik ağırlığı ve vinç ağırlığı da yine bu
// özet görünümde olsun."*
//
// SAYFA ÜÇ BLOKTAN TEK LİSTEYE İNDİ (kullanıcı isteği, 22.08.2026, md. 7):
// *"Özet kısmında tek bir liste istiyorum. FİYAT SATIRLARINA YAZILAN
// MALİYETLER şeklinde ayırma."* Vinçler ile serbest fiyat satırları aynı
// tablonun satırlarıdır; ayrımı bir sütun (KAYNAK) ve satır zeminleri söyler,
// ayrı bir bölüm değil. Sebebi kullanıcının kendi cümlesindedir: karar bütüne
// bakarak veriliyor ve bütün, iki tabloya bölünmüş hâlde toplanamıyordu.
//
// EKRAN HESAP YAPMAZ. Bütün sayılar `costOverview`den gelir (saf çekirdek,
// `cost/totals.ts`); aynı yapıyı Excel çıktısı da okur. İki yerde iki toplam
// dolaşsaydı MALIYET-24'ün anlattığı ayrışma kaçınılmazdı — ekranda 349.000,
// belgede 348.750 yazan bir teklif, hangisinin doğru olduğunu söyleyemez.
//
// TEK İSTİSNASI ELLE GİRİLEN İKİ ALANDIR (ağırlık ve kâr yüzdesi): onlar bir
// HESAP değil bir GİRDİdir ve belgeye yazılırlar (`manualLineWeights`,
// `overviewMargins`). Tahmini satış fiyatı ise onlardan TÜRETİLİR ve hiçbir
// yere yazılmaz — bir ön çalışma aracıdır.

import { fmtMoney0 } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { SayiKutusu } from "@/components/sayi-kutusu";
import { fmtCostField } from "@/lib/offers/cost/labels";
import { DEFAULT_OVERVIEW_MARGIN_PERCENT, LOADED_COST_LABEL } from "@/lib/offers/cost/registry";
import { costAmountLevel, costAmountWeight, costLargestAmount } from "@/lib/offers/cost/heat";
import type { CostOverview, CostOverviewItem } from "@/lib/offers/cost/totals";
import type { CostPayload } from "@/lib/offers/cost/types";
import { Bolum } from "./cost-parts";

/** Sayı hücresi — tabular rakam, sağa yaslı; sütun kıyısı düz kalsın. */
function Sayi({
  children,
  kalin,
  className,
}: {
  children?: React.ReactNode;
  kalin?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-1.5 py-1.5 text-right font-mono text-xs tabular-nums",
        kalin && "font-semibold",
        className
      )}
    >
      {children}
    </td>
  );
}

function kg(v: number | null): string {
  return v === null ? "—" : `${fmtCostField(v, 0)} kg`;
}

/**
 * TAHMİNİ SATIŞ — maliyet ÷ (1 − kâr/100).
 *
 * SATIŞ ÜZERİNDEN yüzdedir (kullanıcı kararı, 22.08.2026): "%25 kâr" cümlesi
 * iki farklı sayı anlatabiliyordu ve fark ASTOR ölçeğinde 16.188 €'ydu.
 *
 * %100 ve üstü bir yüzde matematiksel olarak SONSUZ satış demektir; ekran
 * orada uydurma bir sayı basmaz, "—" gösterir (değişmez md. 4).
 */
function tahminiSatis(maliyet: number | null, yuzde: number): number | null {
  if (maliyet === null || !Number.isFinite(yuzde)) return null;
  const oran = 1 - yuzde / 100;
  if (oran <= 0) return null;
  return maliyet / oran;
}

/** Özet listesinin bir satırı — vinç ya da serbest fiyat satırı. */
interface OzetSatiri {
  id: string;
  baslik: string;
  vinc: boolean;
  qty: number | null;
  steelKg: number | null;
  totalKg: number | null;
  /** Beş başlık — serbest satırda hepsi `null`. */
  fabrication: number | null;
  project: number | null;
  rates: { key: string; title: string; amount: number | null }[];
  /** Satırın toplam maliyeti (`LOADED_COST_LABEL` ya da elle yazılan tutar). */
  maliyet: number | null;
}

function vincSatiri(i: CostOverviewItem): OzetSatiri {
  return {
    id: i.id,
    baslik: i.title || "—",
    vinc: true,
    qty: i.qty,
    steelKg: i.steelPackageKg,
    totalKg: i.weightPackageKg,
    fabrication: i.headings.fabrication,
    project: i.headings.project,
    rates: i.headings.rates,
    maliyet: i.headings.loaded,
  };
}

export function OzetSayfasi({
  overview,
  payload,
  readOnly,
  onChange,
}: {
  overview: CostOverview;
  /** Elle girilen ağırlık ve kâr yüzdesi BELGEDE yaşar; ekran onu yazar. */
  payload: CostPayload;
  readOnly: boolean;
  onChange: (next: CostPayload) => void;
}) {
  const currency = payload.currency;
  const { items, manualLines, margin, uncostedItems } = overview;
  const para = (v: number | null) => (v === null ? "—" : fmtMoney0(v, currency));

  // ORAN SÜTUNLARI DEFTERDEN GELİR, sayısı sabit yazılmaz: yarın dördüncü bir
  // oran grubu açılırsa (ör. "risk payı") tablo kendiliğinden bir sütun daha
  // çizer. Kalemi olmayan bir belgede oran listesi boş kalır — o zaman da
  // sütunlar `payload.rates`ten okunur.
  const oranlar =
    items[0]?.headings.rates ?? payload.rates.map((r) => ({ key: r.key, title: r.title, amount: null }));

  const satirlar: OzetSatiri[] = [
    ...items.map(vincSatiri),
    ...manualLines.map((l) => ({
      id: l.id,
      baslik: l.description || "—",
      vinc: false,
      qty: null,
      steelKg: l.steelKg,
      totalKg: l.totalKg,
      // SERBEST SATIRIN BEŞ BAŞLIĞI YOKTUR ve uydurulmaz: bir nakliyenin
      // "imalat payı" diye bir şey yok (değişmez md. 4). Hücreler "—" kalır.
      fabrication: null,
      project: null,
      rates: oranlar.map((r) => ({ ...r, amount: null })),
      maliyet: l.amount,
    })),
  ];

  const yuzdeOku = (id: string): number =>
    payload.overviewMargins[id] ?? DEFAULT_OVERVIEW_MARGIN_PERCENT;

  const yuzdeYaz = (id: string, v: number | null) =>
    onChange({ ...payload, overviewMargins: { ...payload.overviewMargins, [id]: v } });

  const agirlikYaz = (id: string, alan: "steelKg" | "totalKg", v: number | null) => {
    const onceki = payload.manualLineWeights[id] ?? { steelKg: null, totalKg: null };
    onChange({
      ...payload,
      manualLineWeights: { ...payload.manualLineWeights, [id]: { ...onceki, [alan]: v } },
    });
  };

  const satisToplami = satirlar
    .map((r) => tahminiSatis(r.maliyet, yuzdeOku(r.id)))
    .filter((n): n is number => n !== null)
    .reduce((t, n) => t + n, 0);

  // ISI ÖLÇEĞİ TABANI listenin KENDİ en büyük satırıdır: bu tablo bir belge
  // özetidir ve satırları birbiriyle karşılaştırılır (Maliyetler sayfasındaki
  // ölçek satır düzeyindeydi, bu kalem düzeyinde).
  const enBuyuk = costLargestAmount(satirlar.map((r) => r.maliyet));

  return (
    <div className="grid gap-4">
      <Bolum
        baslik="MALİYET ÖZETİ"
        aciklama="Vinçler ve fiyat satırlarına yazılan maliyetler TEK LİSTEDE; beş ana başlık kalem bazında dağıtılmıştır. Kâr yüzdesi SATIŞ üzerindendir ve tahmini satış fiyatı yalnız bu sayfadaki ön çalışma içindir — teklife yazılmaz."
      >
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-[10px] leading-tight tracking-wide text-muted-foreground uppercase">
                <th className="px-1.5 py-1.5 text-left font-medium">Kalem</th>
                <th className="px-1.5 py-1.5 text-right font-medium">Adet</th>
                <th className="hidden px-1.5 py-1.5 text-right font-medium lg:table-cell">Çelik</th>
                <th className="hidden px-1.5 py-1.5 text-right font-medium lg:table-cell">
                  Toplam Ağırlık
                </th>
                {/* BEŞ ANA BAŞLIK (md. 7) — dar ekranda gizlenir, çünkü asıl
                    soru "bu kalem ne tutuyor"dur ve o sütun her zaman durur. */}
                <th className="hidden px-1.5 py-1.5 text-right font-medium xl:table-cell">İmalat</th>
                <th className="hidden px-1.5 py-1.5 text-right font-medium xl:table-cell">Proje</th>
                {oranlar.map((r) => (
                  <th
                    key={r.key}
                    className="hidden px-1.5 py-1.5 text-right font-medium xl:table-cell"
                    title={r.title}
                  >
                    {r.title.split(" ")[0]}
                  </th>
                ))}
                <th className="px-1.5 py-1.5 text-right font-medium" title={LOADED_COST_LABEL}>
                  Maliyet
                </th>
                <th className="px-1.5 py-1.5 text-right font-medium">Kâr %</th>
                <th className="px-1.5 py-1.5 text-right font-medium">Tahmini Satış</th>
              </tr>
            </thead>
            <tbody>
              {satirlar.length === 0 ? (
                <tr>
                  <td colSpan={7 + oranlar.length} className="px-1.5 py-3 text-sm text-muted-foreground">
                    Bu maliyet çalışmasında henüz kalem yok.
                  </td>
                </tr>
              ) : null}
              {satirlar.map((r) => {
                const yuzde = yuzdeOku(r.id);
                const satis = tahminiSatis(r.maliyet, yuzde);
                const isi = costAmountLevel(r.maliyet, enBuyuk);
                return (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td className="px-1.5 py-1.5">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {/* KAYNAK BİR SÜTUN DEĞİL, BİR İŞARET: tek listenin
                            amacı ayrımı kaldırmaktı, ama "bu satır nereden
                            geliyor" sorusunun cevabı yine de görünmeli. */}
                        <span
                          aria-hidden
                          className={cn(
                            "inline-block size-1.5 shrink-0 rounded-full",
                            r.vinc ? "bg-foreground/50" : "bg-muted-foreground/40"
                          )}
                        />
                        <span className="truncate" title={r.vinc ? r.baslik : `${r.baslik} — fiyat satırı`}>
                          {r.baslik}
                        </span>
                        {r.vinc ? null : (
                          <span className="shrink-0 text-[10px] text-muted-foreground">fiyat satırı</span>
                        )}
                      </div>
                    </td>
                    <Sayi>{r.qty === null ? "—" : fmtCostField(r.qty, 0)}</Sayi>

                    {/* AĞIRLIK: vinçte MODELDEN gelir ve salt okunurdur;
                        serbest satırda ELLE girilir (md. 7). İki kaynak asla
                        toplanmaz — hücre ya kutu ya yazıdır, ikisi birden değil. */}
                    <td className="hidden px-1.5 py-1.5 text-right lg:table-cell">
                      {r.vinc ? (
                        <span className="font-mono text-xs tabular-nums">{kg(r.steelKg)}</span>
                      ) : (
                        <SayiKutusu
                          binlik
                          value={r.steelKg}
                          disabled={readOnly}
                          aria-label={`${r.baslik} çelik ağırlığı`}
                          onChange={(v) => agirlikYaz(r.id, "steelKg", v)}
                          className="h-8 w-24 text-right font-mono"
                        />
                      )}
                    </td>
                    <td className="hidden px-1.5 py-1.5 text-right lg:table-cell">
                      {r.vinc ? (
                        <span className="font-mono text-xs tabular-nums">{kg(r.totalKg)}</span>
                      ) : (
                        <SayiKutusu
                          binlik
                          value={r.totalKg}
                          disabled={readOnly}
                          aria-label={`${r.baslik} toplam ağırlığı`}
                          onChange={(v) => agirlikYaz(r.id, "totalKg", v)}
                          className="h-8 w-24 text-right font-mono"
                        />
                      )}
                    </td>

                    <Sayi className="hidden xl:table-cell">{para(r.fabrication)}</Sayi>
                    <Sayi className="hidden xl:table-cell">{para(r.project)}</Sayi>
                    {r.rates.map((x) => (
                      <Sayi key={x.key} className="hidden xl:table-cell">
                        {para(x.amount)}
                      </Sayi>
                    ))}

                    {/* TUTAR BÜYÜKLÜĞÜNE GÖRE RENKLİDİR (md. 14) — Maliyetler
                        sayfasındaki satır ölçeğinin kalem düzeyindeki ikizi. */}
                    <td
                      className={cn(
                        "px-1.5 py-1.5 text-right font-mono text-xs tabular-nums",
                        isi !== null && "oc-amount",
                        costAmountWeight(isi) || "font-semibold"
                      )}
                      style={isi === null ? undefined : ({ "--oc-level": `${isi}` } as React.CSSProperties)}
                    >
                      {para(r.maliyet)}
                    </td>

                    <td className="px-1.5 py-1.5 text-right">
                      <SayiKutusu
                        value={payload.overviewMargins[r.id] ?? DEFAULT_OVERVIEW_MARGIN_PERCENT}
                        disabled={readOnly}
                        aria-label={`${r.baslik} kâr yüzdesi`}
                        onChange={(v) => yuzdeYaz(r.id, v)}
                        className="h-8 w-16 text-right font-mono"
                      />
                    </td>
                    <Sayi kalin>{para(satis)}</Sayi>
                  </tr>
                );
              })}
            </tbody>
            {satirlar.length > 0 ? (
              <tfoot>
                <tr className="border-t-2">
                  <td className="px-1.5 py-2 font-semibold">TOPLAM</td>
                  <Sayi />
                  <td className="hidden px-1.5 py-2 text-right font-mono text-xs font-semibold tabular-nums lg:table-cell">
                    {kg(overview.steelKgAll)}
                  </td>
                  <td className="hidden px-1.5 py-2 text-right font-mono text-xs font-semibold tabular-nums lg:table-cell">
                    {kg(overview.weightKgAll)}
                  </td>
                  <Sayi kalin className="hidden xl:table-cell">
                    {para(overview.items.length ? sum(items.map((i) => i.headings.fabrication)) : null)}
                  </Sayi>
                  <Sayi kalin className="hidden xl:table-cell">
                    {para(overview.items.length ? sum(items.map((i) => i.headings.project)) : null)}
                  </Sayi>
                  {oranlar.map((r, i) => (
                    <Sayi key={r.key} kalin className="hidden xl:table-cell">
                      {para(sum(items.map((x) => x.headings.rates[i]?.amount ?? null)))}
                    </Sayi>
                  ))}
                  <Sayi kalin>{para(margin.cost)}</Sayi>
                  <Sayi />
                  <Sayi kalin>{satisToplami === 0 ? "—" : fmtMoney0(satisToplami, currency)}</Sayi>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>

        {/* AĞIRLIK TOPLAMI İKİ FARKLI ŞEY OLABİLİR ve fark söylenir: €/kg
            metriği VİNÇLERİN kilosunu okur; listenin dip toplamı serbest
            satırların elle girilen kilolarını da içerir. */}
        {overview.steelKgAll !== overview.steelKg || overview.weightKgAll !== overview.weightKg ? (
          <p className="text-xs text-muted-foreground">
            Dip toplam serbest satırların elle girilen ağırlıklarını da içerir. Yalnız vinçler:{" "}
            <span className="font-mono">{kg(overview.steelKg)}</span> çelik ·{" "}
            <span className="font-mono">{kg(overview.weightKg)}</span> toplam — €/kg bu sayıları okur.
          </p>
        ) : null}

        {/* DAĞITILAMAYAN YÜK SESSİZ GEÇİLMEZ: fiyatı hiç girilmemiş kalemlerde
            proje geneli ve oranların bir kısmı hiçbir satıra düşemez ve sütun
            toplamı belge toplamını tutturamaz. */}
        {Math.abs(overview.unallocated) > 0 ? (
          <p className="rounded-md border border-dashed border-primary p-3 text-sm">
            Proje geneli ve oranlı giderlerin{" "}
            <span className="font-mono font-medium">{fmtMoney0(overview.unallocated, currency)}</span>{" "}
            kadarı hiçbir kaleme dağıtılamadı — dağıtım kalemlerin paket maliyetine göre yapılır ve
            fiyatı henüz girilmemiş bir kalemin payı sıfırdır. Satır maliyetleri girildikçe kapanır.
          </p>
        ) : null}

        {/* MALİYETİ AÇILMAMIŞ KALEM SESSİZ GEÇİLMEZ: fiyat toplamına girip
            maliyet toplamına girmeyen bir vinç, kârı olduğundan yüksek
            gösterir. */}
        {uncostedItems.length > 0 ? (
          <p className="rounded-md border border-dashed border-primary p-3 text-sm">
            Teklifte olup maliyeti açılmamış {uncostedItems.length} kalem var:{" "}
            <span className="font-medium">{uncostedItems.map((u) => u.title || "—").join(", ")}</span>.
            Bunların tutarı teklife giriyor ama maliyete girmiyor; aşağıdaki kâr olduğundan yüksek
            görünür.
          </p>
        ) : null}

        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Tahmini satış teklife YAZILMAZ.</span> Teklifin fiyatı Fiyat
          sayfasında yaşar; bu sütun yalnız ön çalışma içindir.
        </p>
      </Bolum>

      <Bolum
        baslik="TEKLİF VE KÂR"
        aciklama="Maliyet belgesinin toplamı ile fiyat satırlarına yazılan maliyetlerin toplamı; karşısında GERÇEK teklif tutarı (iskonto uygulanmış)."
      >
        <dl className="grid gap-1.5 text-sm">
          <div className="flex items-baseline justify-between gap-4 border-b pb-1.5">
            <dt className="text-muted-foreground">Teklif Tutarı</dt>
            <dd className="font-mono tabular-nums">{para(margin.price)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-b pb-1.5">
            <dt className="text-muted-foreground">Toplam Maliyet</dt>
            <dd className="font-mono tabular-nums">{para(margin.cost)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 pt-1">
            <dt className="font-semibold">KÂR</dt>
            <dd className="font-mono font-semibold tabular-nums">
              {para(margin.profit)}
              {margin.marginPercent === null ? null : (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  satış üzerinden %{fmtCostField(margin.marginPercent, 0)} · maliyet üzerinden %
                  {fmtCostField(margin.markupPercent, 0)}
                </span>
              )}
            </dd>
          </div>
        </dl>
      </Bolum>
    </div>
  );
}

/** Boş değeri SIFIR SAYMAYAN toplam — hiç sayı yoksa `null` (değişmez md. 4). */
function sum(list: readonly (number | null)[]): number | null {
  const dolu = list.filter((n): n is number => n !== null);
  return dolu.length ? dolu.reduce((t, n) => t + n, 0) : null;
}
