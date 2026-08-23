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
// tablonun satırlarıdır; ayrımı bir işaret ve bir etiket söyler, ayrı bir
// bölüm değil. Sebebi kullanıcının kendi cümlesindedir: karar bütüne bakarak
// veriliyor ve bütün, iki tabloya bölünmüş hâlde toplanamıyordu.
//
// SAYFA ARTIK BİR GİRİŞ EKRANIDIR DA (kullanıcı isteği, 23.08.2026, md. 1):
// *"Maliyetlendirmeyi hızlıca basitçe bu özet tabloda bitirmiş olurum. Bu
// ekstra kalemler için çok detay istemiyorum."* Serbest fiyat satırlarının
// ÇELİK ve TOPLAM AĞIRLIĞI zaten elle giriliyordu; yanlarına beş başlık ve tek
// maliyet kutuları eklendi. Vinçlerde aynı hücreler HESAPLANIR ve kutu
// ÇİZİLMEZ — iki kaynak asla toplanmaz (MALIYET-4).
//
// EKRAN HESAP YAPMAZ. Bütün sayılar `costOverview`den gelir (saf çekirdek,
// `cost/totals.ts`); aynı yapıyı PDF ve Excel çıktısı da okur. İki yerde iki
// toplam dolaşsaydı MALIYET-24'ün anlattığı ayrışma kaçınılmazdı — ekranda
// 349.000, belgede 348.750 yazan bir teklif, hangisinin doğru olduğunu
// söyleyemez.
//
// TEK İSTİSNASI ELLE GİRİLEN ALANLARDIR (ağırlık, serbest satır maliyeti ve
// kâr yüzdesi): onlar bir HESAP değil bir GİRDİdir ve belgeye yazılırlar
// (`manualLineWeights`, `manualLineCosts`, `overviewMargins`). Tahmini satış
// fiyatı ise onlardan TÜRETİLİR ve hiçbir yere yazılmaz — bir ön çalışma
// aracıdır.

import { fmtMoney0 } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { SayiKutusu } from "@/components/sayi-kutusu";
import { fmtCostField } from "@/lib/offers/cost/labels";
import { DEFAULT_OVERVIEW_MARGIN_PERCENT, LOADED_COST_LABEL } from "@/lib/offers/cost/registry";
import { costAmountLevel, costAmountWeight, costLargestAmount } from "@/lib/offers/cost/heat";
import type { CostOverview, CostOverviewItem } from "@/lib/offers/cost/totals";
import { EMPTY_MANUAL_LINE_COST } from "@/lib/offers/cost/types";
import type { CostPayload, ManualLineCostSource } from "@/lib/offers/cost/types";
import { Bolum } from "./cost-parts";

/** Sayı hücresi — tabular rakam, sağa yaslı; sütun kıyısı düz kalsın. */
function Sayi({
  children,
  kalin,
  className,
  dataLabel,
}: {
  children?: React.ReactNode;
  kalin?: boolean;
  className?: string;
  dataLabel?: string;
}) {
  return (
    <td
      data-label={dataLabel}
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
 * BİR SAYININ TABANINA ORANI (%) — taban yoksa ya da sıfırsa `null`.
 *
 * Kullanıcı isteği (23.08.2026, md. 6): *"tabloda çelik, toplam, imalat, proje
 * ve genel gider kısımlarının değerlerinin yanına maliyet toplamlarına % oranı
 * da yazmanı istiyorum. Hem uygulamaya hem pdf excel raporlara."*
 *
 * İKİ FARKLI TABAN VARDIR ve fark bilinçlidir — bir kilogramın bir avroya
 * oranı diye bir şey yoktur:
 *
 *   · PARA sütunları (imalat · proje · genel gider) SATIRIN KENDİ MALİYETİNE
 *     oranlanır. Okunan cümle şudur: "bu vincin maliyetinin %65'i proje."
 *     MALİYET sütununun kendisinde yüzde YOKTUR — o tabandır ve %100 yazmak
 *     hiçbir şey söylemezdi; kullanıcının saydığı sütunlar arasında
 *     bulunmaması da bunu söylüyor.
 *   · AĞIRLIK sütunları BELGENİN DİP TOPLAMINA oranlanır: "bu kalem belgedeki
 *     çeliğin %75'i."
 */
function oran(pay: number | null, taban: number | null): number | null {
  if (pay === null || taban === null || taban === 0 || !Number.isFinite(taban)) return null;
  return (pay / taban) * 100;
}

/** Değerin altındaki küçük yüzde satırı — hesaplanamıyorsa hiç çizilmez. */
function Yuzde({ deger }: { deger: number | null }) {
  if (deger === null) return null;
  return (
    <span className="block text-[10px] leading-tight font-normal text-muted-foreground">
      %{fmtCostField(deger, 0)}
    </span>
  );
}

/**
 * SERBEST SATIRIN PARA HÜCRESİ — kutu; vinçte aynı hücre yazıdır.
 *
 * MODÜL DÜZEYİNDE DURUR, `OzetSayfasi`nın İÇİNDE DEĞİL: render gövdesinde
 * tanımlanan bir bileşen her boyamada YENİ bir tiptir ve React onu söküp
 * yeniden kurar — kutu her tuş vuruşunda odağını kaybederdi.
 */
function ParaKutusu({
  deger,
  taban,
  etiket,
  readOnly,
  onYaz,
}: {
  deger: number | null;
  /** Yüzdenin tabanı — satırın kendi maliyeti. */
  taban: number | null;
  etiket: string;
  readOnly: boolean;
  onYaz: (v: number | null) => void;
}) {
  return (
    <div className="grid justify-items-end gap-0.5">
      <SayiKutusu
        binlik
        value={deger}
        disabled={readOnly}
        aria-label={etiket}
        onChange={onYaz}
        className="h-8 w-24 text-right font-mono"
      />
      <Yuzde deger={oran(deger, taban)} />
    </div>
  );
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
  const oranPayi = 1 - yuzde / 100;
  if (oranPayi <= 0) return null;
  return maliyet / oranPayi;
}

/** Özet listesinin bir satırı — vinç ya da serbest fiyat satırı. */
interface OzetSatiri {
  id: string;
  baslik: string;
  vinc: boolean;
  qty: number | null;
  steelKg: number | null;
  totalKg: number | null;
  /** Beş başlık — vinçte hesaplanır, serbest satırda ELLE girilir. */
  fabrication: number | null;
  project: number | null;
  rates: { key: string; title: string; amount: number | null }[];
  /** Satırın toplam maliyeti (`LOADED_COST_LABEL` ya da elle yazılan tutar). */
  maliyet: number | null;
  /** Serbest satırda maliyetin KAYNAĞI; vinçte anlamsızdır. */
  kaynak: ManualLineCostSource | null;
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
    kaynak: null,
  };
}

export function OzetSayfasi({
  overview,
  payload,
  readOnly,
  onChange,
}: {
  overview: CostOverview;
  /** Elle girilen ağırlık, maliyet ve kâr yüzdesi BELGEDE yaşar; ekran onu yazar. */
  payload: CostPayload;
  readOnly: boolean;
  onChange: (next: CostPayload) => void;
}) {
  const currency = payload.currency;
  const { items, manualLines, margin, uncostedItems } = overview;
  const para = (v: number | null) => (v === null ? "—" : fmtMoney0(v, currency));

  // ORAN SÜTUNLARI DEFTERDEN GELİR, sayısı sabit yazılmaz: yarın dördüncü bir
  // oran grubu açılırsa (ör. "risk payı") tablo kendiliğinden bir sütun daha
  // çizer. Kalemi olmayan bir belgede liste serbest satırdan, o da yoksa
  // `payload.rates`ten okunur.
  const oranlar =
    items[0]?.headings.rates ??
    manualLines[0]?.headings.rates ??
    payload.rates.map((r) => ({ key: r.key, title: r.title, amount: null }));

  const satirlar: OzetSatiri[] = [
    ...items.map(vincSatiri),
    ...manualLines.map((l) => ({
      id: l.id,
      baslik: l.description || "—",
      vinc: false,
      qty: null,
      steelKg: l.steelKg,
      totalKg: l.totalKg,
      fabrication: l.headings.fabrication,
      project: l.headings.project,
      rates: l.headings.rates,
      maliyet: l.amount,
      kaynak: l.source,
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

  const maliyetKaydi = (id: string) => payload.manualLineCosts[id] ?? EMPTY_MANUAL_LINE_COST;

  const maliyetYaz = (id: string, alan: "total" | "fabrication" | "project", v: number | null) =>
    onChange({
      ...payload,
      manualLineCosts: { ...payload.manualLineCosts, [id]: { ...maliyetKaydi(id), [alan]: v } },
    });

  const oranYaz = (id: string, key: string, v: number | null) => {
    const onceki = maliyetKaydi(id);
    onChange({
      ...payload,
      manualLineCosts: {
        ...payload.manualLineCosts,
        [id]: { ...onceki, rates: { ...onceki.rates, [key]: v } },
      },
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

  // KIRILIMI GİRİLİP TOPLAMI DA YAZILMIŞ SATIR SESSİZ GEÇİLMEZ: o satırda tek
  // maliyet kutusu OKUNMAZ (`manualLineCost`) ve okunmadığı SÖYLENMELİDİR,
  // yoksa kullanıcı yazdığı sayının nereye gittiğini arar. Sessizce silmek de
  // seçenek değildir — girilen bir sayı kullanıcının kararıdır.
  const golgeliToplam = manualLines.filter(
    (l) => l.source === "breakdown" && (payload.manualLineCosts[l.id]?.total ?? null) !== null
  );

  return (
    <div className="grid gap-4">
      <Bolum
        baslik="MALİYET ÖZETİ"
        aciklama="Vinçler ve fiyat satırlarına yazılan maliyetler TEK LİSTEDE. Vinçlerin beş başlığı HESAPLANIR; fiyat satırlarınınki bu tabloda ELLE girilir ve teklifin Fiyat sayfasındaki kutuya göre önceliklidir. Yüzdeler para sütunlarında satırın kendi maliyetine, ağırlık sütunlarında belgenin dip toplamına orandır. Kâr yüzdesi SATIŞ üzerindendir ve tahmini satış fiyatı yalnız bu sayfadaki ön çalışma içindir — teklife yazılmaz."
      >
        <div className="oc-mobile-table-wrap min-w-0 overflow-x-hidden">
          <table className="oc-mobile-table w-full border-collapse text-sm">
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
                const kayit = r.vinc ? null : maliyetKaydi(r.id);
                return (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td data-label="Kalem" data-mobile-span="full" className="px-1.5 py-1.5">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {/* KAYNAK BİR SÜTUN DEĞİL, BİR İŞARET: tek listenin
                            amacı ayrımı kaldırmaktı, ama "bu satır nereden
                            geliyor" sorusunun cevabı yine de görünmeli.
                            İŞARET İKİ ŞEYLE AYRIŞIR (kullanıcı isteği
                            23.08.2026, md. 1: *"pin rengini değiştirip belirgin
                            hale getirsek"*): ŞEKİL (yuvarlak ↔ kare) ve RENK.
                            Yalnız renkle ayırmak WCAG 1.4.1'i kırardı; yazılı
                            "fiyat satırı" etiketi de bu yüzden yerinde durur.
                            Ton bir AÇIDIR (değişmez md. 6) ve `.oc-series-bg`
                            doygunluğu tema başına verir — elle hex yazılmaz. */}
                        {r.vinc ? (
                          <span
                            aria-hidden
                            className="inline-block size-1.5 shrink-0 rounded-full bg-foreground/50"
                          />
                        ) : (
                          <span
                            aria-hidden
                            className="oc-series-bg inline-block size-2 shrink-0 rounded-[2px]"
                            style={{ "--oc-hue": "255" } as React.CSSProperties}
                          />
                        )}
                        <span className="truncate" title={r.vinc ? r.baslik : `${r.baslik} — fiyat satırı`}>
                          {r.baslik}
                        </span>
                        {r.vinc ? null : (
                          <span className="shrink-0 text-[10px] text-muted-foreground">fiyat satırı</span>
                        )}
                      </div>
                    </td>
                    <Sayi dataLabel="Adet">{r.qty === null ? "—" : fmtCostField(r.qty, 0)}</Sayi>

                    {/* AĞIRLIK: vinçte MODELDEN gelir ve salt okunurdur;
                        serbest satırda ELLE girilir (md. 7). İki kaynak asla
                        toplanmaz — hücre ya kutu ya yazıdır, ikisi birden değil. */}
                    <td className="hidden px-1.5 py-1.5 text-right lg:table-cell">
                      {r.vinc ? (
                        <span className="block font-mono text-xs tabular-nums">
                          {kg(r.steelKg)}
                          <Yuzde deger={oran(r.steelKg, overview.steelKgAll)} />
                        </span>
                      ) : (
                        <div className="grid justify-items-end gap-0.5">
                          <SayiKutusu
                            binlik
                            value={r.steelKg}
                            disabled={readOnly}
                            aria-label={`${r.baslik} çelik ağırlığı`}
                            onChange={(v) => agirlikYaz(r.id, "steelKg", v)}
                            className="h-8 w-24 text-right font-mono"
                          />
                          <Yuzde deger={oran(r.steelKg, overview.steelKgAll)} />
                        </div>
                      )}
                    </td>
                    <td className="hidden px-1.5 py-1.5 text-right lg:table-cell">
                      {r.vinc ? (
                        <span className="block font-mono text-xs tabular-nums">
                          {kg(r.totalKg)}
                          <Yuzde deger={oran(r.totalKg, overview.weightKgAll)} />
                        </span>
                      ) : (
                        <div className="grid justify-items-end gap-0.5">
                          <SayiKutusu
                            binlik
                            value={r.totalKg}
                            disabled={readOnly}
                            aria-label={`${r.baslik} toplam ağırlığı`}
                            onChange={(v) => agirlikYaz(r.id, "totalKg", v)}
                            className="h-8 w-24 text-right font-mono"
                          />
                          <Yuzde deger={oran(r.totalKg, overview.weightKgAll)} />
                        </div>
                      )}
                    </td>

                    {/* BEŞ BAŞLIK: vinçte HESAPLANIR (yazı), serbest satırda
                        ELLE girilir (kutu) — md. 1. "Çok detay istemiyorum"
                        bir ölçüdür: burada satır–miktar–fiyat yoktur, tek kutu. */}
                    <td className="hidden px-1.5 py-1.5 text-right xl:table-cell">
                      {r.vinc ? (
                        <span className="block font-mono text-xs tabular-nums">
                          {para(r.fabrication)}
                          <Yuzde deger={oran(r.fabrication, r.maliyet)} />
                        </span>
                      ) : (
                        <ParaKutusu
                          deger={r.fabrication}
                          taban={r.maliyet}
                          etiket={`${r.baslik} imalat maliyeti`}
                          readOnly={readOnly}
                          onYaz={(v) => maliyetYaz(r.id, "fabrication", v)}
                        />
                      )}
                    </td>
                    <td className="hidden px-1.5 py-1.5 text-right xl:table-cell">
                      {r.vinc ? (
                        <span className="block font-mono text-xs tabular-nums">
                          {para(r.project)}
                          <Yuzde deger={oran(r.project, r.maliyet)} />
                        </span>
                      ) : (
                        <ParaKutusu
                          deger={r.project}
                          taban={r.maliyet}
                          etiket={`${r.baslik} proje maliyeti`}
                          readOnly={readOnly}
                          onYaz={(v) => maliyetYaz(r.id, "project", v)}
                        />
                      )}
                    </td>
                    {r.rates.map((x) => (
                      <td key={x.key} className="hidden px-1.5 py-1.5 text-right xl:table-cell">
                        {r.vinc ? (
                          <span className="block font-mono text-xs tabular-nums">
                            {para(x.amount)}
                            <Yuzde deger={oran(x.amount, r.maliyet)} />
                          </span>
                        ) : (
                          <ParaKutusu
                            deger={x.amount}
                            taban={r.maliyet}
                            etiket={`${r.baslik} — ${x.title}`}
                            readOnly={readOnly}
                            onYaz={(v) => oranYaz(r.id, x.key, v)}
                          />
                        )}
                      </td>
                    ))}

                    {/* MALİYET SÜTUNU ÜÇ HÂLDEDİR VE ÜÇÜ AYRI ŞEY SÖYLER:
                          · VİNÇ — hesaplanmış, salt okunur.
                          · SERBEST + KIRILIM GİRİLMİŞ — beş kutunun TOPLAMI.
                            Burada kutu çizmek, yazılan sayının hiçbir yere
                            gitmeyeceği bir kutu çizmek olurdu.
                          · SERBEST + KIRILIM BOŞ — tek maliyet kutusu; teklifin
                            Fiyat sayfasındaki kutuya göre ÖNCELİKLİDİR (md. 1).
                        TUTAR BÜYÜKLÜĞÜNE GÖRE RENKLİDİR (md. 14) — Maliyetler
                        sayfasındaki satır ölçeğinin kalem düzeyindeki ikizi. */}
                    {r.vinc || r.kaynak === "breakdown" ? (
                      <td
                        data-label="Maliyet"
                        className={cn(
                          "px-1.5 py-1.5 text-right font-mono text-xs tabular-nums",
                          isi !== null && "oc-amount",
                          costAmountWeight(isi) || "font-semibold"
                        )}
                        style={isi === null ? undefined : ({ "--oc-level": `${isi}` } as React.CSSProperties)}
                        title={
                          r.vinc
                            ? LOADED_COST_LABEL
                            : "Beş başlığa yazılan tutarların toplamı — kırılım girildiği için tek maliyet kutusu okunmaz."
                        }
                      >
                        {para(r.maliyet)}
                      </td>
                    ) : (
                      <td data-label="Maliyet" className="px-1.5 py-1.5 text-right">
                        <div className="grid justify-items-end gap-0.5">
                          <SayiKutusu
                            binlik
                            value={kayit?.total ?? null}
                            disabled={readOnly}
                            aria-label={`${r.baslik} maliyeti`}
                            title="Bu satırın maliyeti. Buraya yazılan sayı teklifin Fiyat sayfasındaki kutuya göre ÖNCELİKLİDİR."
                            onChange={(v) => maliyetYaz(r.id, "total", v)}
                            className={cn(
                              "h-8 w-28 text-right font-mono font-semibold",
                              (kayit?.total ?? null) !== null && "border-primary"
                            )}
                          />
                          {/* FİYAT SAYFASINDAN GELEN SAYI GÖRÜNÜR KALIR:
                              kutu boşken hücrenin boş görünmesi, o satırın
                              maliyetsiz olduğunu sanmanın en kısa yoluydu. */}
                          {r.kaynak === "price" && r.maliyet !== null ? (
                            <span className="block text-[10px] leading-tight text-muted-foreground">
                              fiyat sayfasından {para(r.maliyet)}
                            </span>
                          ) : null}
                        </div>
                      </td>
                    )}

                    <td data-label="Kâr %" className="px-1.5 py-1.5 text-right">
                      <SayiKutusu
                        value={payload.overviewMargins[r.id] ?? DEFAULT_OVERVIEW_MARGIN_PERCENT}
                        disabled={readOnly}
                        aria-label={`${r.baslik} kâr yüzdesi`}
                        onChange={(v) => yuzdeYaz(r.id, v)}
                        className="h-8 w-16 text-right font-mono"
                      />
                    </td>
                    <Sayi dataLabel="Tahmini Satış" kalin>{para(satis)}</Sayi>
                  </tr>
                );
              })}
            </tbody>
            {satirlar.length > 0 ? (
              <tfoot>
                <tr className="border-t-2" data-mobile-summary>
                  <td data-label="Özet" data-mobile-span="full" className="px-1.5 py-2 font-semibold">TOPLAM</td>
                  <Sayi dataLabel="Adet" />
                  {/* AĞIRLIK DİP TOPLAMINDA YÜZDE YOKTUR: o hücre zaten satır
                      yüzdelerinin TABANIDIR ve %100 yazmak hiçbir şey söylemez. */}
                  <td className="hidden px-1.5 py-2 text-right font-mono text-xs font-semibold tabular-nums lg:table-cell">
                    {kg(overview.steelKgAll)}
                  </td>
                  <td className="hidden px-1.5 py-2 text-right font-mono text-xs font-semibold tabular-nums lg:table-cell">
                    {kg(overview.weightKgAll)}
                  </td>
                  {/* PARA SÜTUNLARININ DİP YÜZDESİNİN TABANI BELGENİN TOPLAM
                      MALİYETİDİR: satırdaki cümlenin ("maliyetin %65'i proje")
                      belge düzeyindeki karşılığı. Yüzde serbest satırların elle
                      girilen başlıklarını da sayar — tutar sütunu yalnız
                      vinçleri toplarken yüzde bütünü anlatsaydı ikisi
                      birbirini tutmazdı, o yüzden ikisi de aynı listeden
                      okunur. */}
                  <Sayi kalin className="hidden xl:table-cell">
                    {para(sum(satirlar.map((x) => x.fabrication)))}
                    <Yuzde deger={oran(sum(satirlar.map((x) => x.fabrication)), margin.cost)} />
                  </Sayi>
                  <Sayi kalin className="hidden xl:table-cell">
                    {para(sum(satirlar.map((x) => x.project)))}
                    <Yuzde deger={oran(sum(satirlar.map((x) => x.project)), margin.cost)} />
                  </Sayi>
                  {oranlar.map((r, i) => (
                    <Sayi key={r.key} kalin className="hidden xl:table-cell">
                      {para(sum(satirlar.map((x) => x.rates[i]?.amount ?? null)))}
                      <Yuzde
                        deger={oran(sum(satirlar.map((x) => x.rates[i]?.amount ?? null)), margin.cost)}
                      />
                    </Sayi>
                  ))}
                  <Sayi dataLabel="Toplam Maliyet" kalin>{para(margin.cost)}</Sayi>
                  <Sayi dataLabel="Kâr %" />
                  <Sayi dataLabel="Tahmini Satış" kalin>{satisToplami === 0 ? "—" : fmtMoney0(satisToplami, currency)}</Sayi>
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

        {/* OKUNMAYAN BİR GİRDİ SESSİZ KALMAZ (değişmez md. 4'ün kardeşi). */}
        {golgeliToplam.length > 0 ? (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            {golgeliToplam.length} fiyat satırında hem beş başlık hem tek maliyet yazılı:{" "}
            <span className="font-medium">
              {golgeliToplam.map((l) => l.description || "—").join(", ")}
            </span>
            . Bu satırlarda BEŞ BAŞLIĞIN TOPLAMI geçerlidir; tek maliyet kutusu okunmaz. Tek
            maliyete dönmek için başlık kutularını boşaltın.
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
