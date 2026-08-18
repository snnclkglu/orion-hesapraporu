"use client";

// MALİYET KIRILIMI — paranın nereye gittiği ve kârın ne olduğu.
//
// Devralınan çalışma kitabının "MALİYET KIRILIMI" sayfasının karşılığıdır ve
// aynı soruyu sorar. İki şey ekler: dört ana başlığın toplamı (Excel'de o
// başlıklar hiç hesaplanmıyordu — `PARAMETRELER` C8/C9/C10'daki oranlara bir
// formül bile atıf yapmıyor) ve KÂR (Excel maliyette duruyor, fiyatı hiç
// görmüyordu).
//
// ARTIK AYRI BİR SAYFA DEĞİL, MALİYETLER SAYFASININ ALTIDIR (kullanıcı isteği
// 18.08.2026, md. 8). Bunun bir bedeli var ve karşılığı düzende ödendi: üç
// özet blok YAN YANA durur (`xl:grid-cols-3`), alt alta değil — birleştirme
// sayfayı üç ekran boyuna uzatsaydı kullanıcı kırılıma inmek için her
// seferinde bütün maliyet tablosunu geçmek zorunda kalırdı.
//
// PAY YÜZDESİ PROJE MALİYETİNE GÖREDİR, toplam maliyete değil: oranlı gruplar
// zaten proje maliyetinin bir katıdır ve onları paydaya katmak her grubun
// payını aynı oranda küçültüp hiçbir şey anlatmazdı.

import { fmtMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { fmtCostField } from "@/lib/offers/cost/labels";
import type { CostModelResult } from "@/lib/offers/cost/model";
import { costWeights } from "@/lib/offers/cost/payload";
import {
  costBreakdown,
  costMargin,
  costPerKg,
  costTotals,
  loadedCostByOfferItem,
} from "@/lib/offers/cost/totals";
import type { CostPayload } from "@/lib/offers/cost/types";
import { lineAmount } from "@/lib/offers/pricing";
import type { OfferPayload } from "@/lib/offers/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bolum, type Katlama } from "./cost-parts";

/** Bir teklif kalemine bağlı fiyat satırlarının toplamı. */
function teklifTutari(offer: OfferPayload, offerItemId: string | null): number | null {
  if (!offerItemId) return null;
  const satirlar = offer.pricing.lines.filter((l) => l.itemId === offerItemId && !l.hidden && l.inTotal);
  const tutarlar = satirlar.map(lineAmount).filter((n): n is number => n !== null);
  return tutarlar.length ? tutarlar.reduce((t, n) => t + n, 0) : null;
}

/**
 * ÖZET SATIRI — etiket · açıklama · tutar, TEK SIRADA.
 *
 * Açıklama etiketin ALTINDA değil YANINDADIR (md. 8: *"satırların altında
 * yazan yazıları satırların yanına kutuya yazalım, dikeyde yer
 * kaybetmeyelim"*). Kırpılır; tam metin `title`dadır.
 */
function OzetSatiri({
  etiket,
  deger,
  aciklama,
  kalin,
}: {
  etiket: string;
  deger: string;
  aciklama?: string;
  kalin?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline gap-2 border-b py-1.5 last:border-b-0",
        kalin && "border-t-2"
      )}
    >
      <span className={cn("shrink-0 text-sm", kalin && "font-semibold")}>{etiket}</span>
      {aciklama ? (
        <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground" title={aciklama}>
          {aciklama}
        </span>
      ) : (
        <span className="flex-1" />
      )}
      <span className={cn("shrink-0 font-mono text-sm", kalin && "text-base font-semibold")}>
        {deger}
      </span>
    </div>
  );
}

export function KirilimSayfasi({
  payload,
  models,
  offer,
  katlama,
}: {
  payload: CostPayload;
  models: Record<string, CostModelResult>;
  offer: OfferPayload;
  katlama: Katlama;
}) {
  const cur = payload.currency;
  const totals = costTotals(payload, costWeights(models));
  const kirilim = costBreakdown(payload, totals).sort((a, b) => b.amount - a.amount);
  const yuklu = loadedCostByOfferItem(totals);
  const kar = costMargin(offer.pricing.total ?? null, totals.total);
  const enBuyuk = kirilim[0]?.amount ?? 0;

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-3 xl:items-start">
        <Bolum katlama={katlama} katlamaAnahtari="bolum:dortAna" baslik="BEŞ ANA BAŞLIK" aciklama="Oranlar doğrudan maliyet (imalat + proje) üzerinden hesaplanır.">
          <div>
            {/* İMALAT ÖNCE: kullanıcının sırası (md. 4) — "en üste yeni grup". */}
            <OzetSatiri
              etiket="İMALAT MALİYETİ"
              deger={fmtMoney(totals.fabrication, cur)}
              aciklama="çelik imalat işçiliği (fire dahil)"
            />
            <OzetSatiri
              etiket="PROJE MALİYETİ"
              deger={fmtMoney(totals.project, cur)}
              aciklama="kalem kalem + proje geneli"
            />
            {totals.rates.map((r) => (
              <OzetSatiri
                key={r.key}
                etiket={r.title}
                deger={fmtMoney(r.amount, cur)}
                // EK KULLANILMAZ ("%2'i" yanlış, "%2'si" doğru): Türkçe ünlü ve
                // ünsüz uyumu SAYININ OKUNUŞUNA bağlıdır ve virgüllü bir oranda
                // ("%25,0") okunuş da değişir. Çarpım biçimi hepsinde doğrudur.
                aciklama={
                  r.mode === "oran"
                    ? r.percent === null
                      ? "Oran girilmedi"
                      : `proje × %${fmtCostField(r.percent, 2).replace(",00", "")}`
                    : `${payload.rates.find((x) => x.key === r.key)?.lines.length ?? 0} kalem`
                }
              />
            ))}
            <OzetSatiri etiket="TOPLAM MALİYET" deger={fmtMoney(totals.total, cur)} kalin />
          </div>
        </Bolum>

        <Bolum
          katlama={katlama}
          katlamaAnahtari="bolum:kar"
          baslik="TEKLİF VE KÂR"
          aciklama="Teklif tutarı iskonto uygulanmış hâlidir — müşterinin gerçekten ödeyeceği rakam."
        >
          <div>
            <OzetSatiri etiket="Teklif Tutarı" deger={fmtMoney(kar.price, cur)} />
            <OzetSatiri etiket="Toplam Maliyet" deger={fmtMoney(kar.cost, cur)} />
            <OzetSatiri
              etiket="KÂR"
              deger={fmtMoney(kar.profit, cur)}
              kalin
              // EK KULLANILMAZ ("%2'i" yanlış, "%2'si" doğru): Türkçe uyum
              // sayının OKUNUŞUNA bağlıdır ve virgüllü bir oranda değişir.
              // "üzerinden" hepsinde doğrudur.
              aciklama={
                kar.marginPercent === null
                  ? "Teklif fiyatı ya da maliyet girilmemiş"
                  : `satış üzerinden %${fmtCostField(kar.marginPercent, 1)} · maliyet üzerinden %${fmtCostField(kar.markupPercent, 1)}`
              }
            />
          </div>
          {kar.profit !== null && kar.profit < 0 ? (
            <p className="rounded-md border border-destructive/60 p-2 text-xs font-medium text-destructive">
              Bu teklif maliyetin ALTINDA. Fiyatı ya da maliyet kalemlerini gözden geçirin.
            </p>
          ) : null}
        </Bolum>

        <Bolum katlama={katlama} katlamaAnahtari="bolum:kirilim" baslik="ANA KALEM KIRILIMI" aciklama="Bütün kalemler boyunca toplanır; pay proje maliyetine göredir.">
          <div className="grid gap-1">
            {kirilim.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz maliyet girilmemiş.</p>
            ) : (
              kirilim.map((r) => (
                <div key={r.key} className="grid gap-0.5">
                  <div className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm" title={r.title}>
                      {r.title}
                    </span>
                    <span className="shrink-0 font-mono text-sm">{fmtMoney(r.amount, cur)}</span>
                    <span className="w-14 shrink-0 text-right font-mono text-xs text-muted-foreground">
                      {r.share === null ? "—" : `%${fmtCostField(r.share * 100, 1)}`}
                    </span>
                  </div>
                  {/* Çubuk EN BÜYÜK KALEME göre ölçeklenir, toplama göre değil:
                      payların çoğu %5'in altındayken toplama göre çizilen bir
                      çubuk hepsini görünmez yapardı. Sayı zaten yanında yazıyor;
                      çubuk yalnız sıralamayı gözle okutur (renk TEK TAŞIYICI
                      değildir kuralının aynı ailesi). */}
                  <div className="h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: enBuyuk > 0 ? `${(r.amount / enBuyuk) * 100}%` : "0%" }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </Bolum>
      </div>

      <Bolum
        katlama={katlama}
        katlamaAnahtari="bolum:kalemBazinda"
        baslik="KALEM BAZINDA"
        aciklama="Yüklü maliyet, proje geneli ve oranlı grupların doğrudan maliyet payına göre dağıtılmış hâlidir."
      >
        {/* KENDİ KAYDIRMA KABINI SARMA (MOBIL-14): `Table` zaten
            `oc-scrollx overflow-x-auto` bir kap çiziyor. İkinci sargı iç içe
            iki kaydırıcı, üst üste iki kenar gölgesi ve — CSS bir ekseni
            `visible` bırakmadığı için — İKİ KEZ devrede bir `overflow-y: auto`
            demekti. Kullanıcının "sayfada çift scroll var" bildirimi
            (18.08.2026, md. 7) tam olarak buydu; yükseklik zinciri
            (TEKLIF-17 / MALIYET-15) ölçüldü ve SAĞLAMDI. */}
        <Table containerClassName="[--oc-scroll-bg:var(--background)]">
            <TableHeader>
              <TableRow>
                <TableHead className="px-1.5">Kalem</TableHead>
                <TableHead className="w-14 px-1.5 text-right">Adet</TableHead>
                <TableHead className="hidden w-24 px-1.5 text-right md:table-cell">Ağırlık</TableHead>
                <TableHead className="hidden w-20 px-1.5 text-right md:table-cell">Birim/kg</TableHead>
                <TableHead className="w-28 px-1.5 text-right">Birim Maliyet</TableHead>
                <TableHead className="w-28 px-1.5 text-right">Yüklü Maliyet</TableHead>
                <TableHead className="w-28 px-1.5 text-right">Teklif Fiyatı</TableHead>
                <TableHead className="w-28 px-1.5 text-right">Kâr</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {totals.items.map((i) => {
                const yukluTutar = i.offerItemId ? (yuklu[i.offerItemId] ?? null) : null;
                const fiyat = teklifTutari(offer, i.offerItemId);
                const m = costMargin(fiyat, yukluTutar);
                return (
                  <TableRow key={i.id}>
                    <TableCell className="max-w-[22rem] p-1.5">
                      <div className="truncate text-sm" title={i.title || undefined}>
                        {i.title || "—"}
                        {i.offerItemId ? null : (
                          <span className="ml-2 text-[11px] text-muted-foreground">
                            teklif kalemine bağlı değil
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="p-1.5 text-right font-mono text-sm">
                      {fmtCostField(i.qty, 0)}
                    </TableCell>
                    <TableCell className="hidden p-1.5 text-right font-mono text-sm md:table-cell">
                      {fmtCostField(i.weightKg, 0)}
                    </TableCell>
                    <TableCell className="hidden p-1.5 text-right font-mono text-sm md:table-cell">
                      {fmtCostField(costPerKg(i.unit, i.weightKg), 2)}
                    </TableCell>
                    <TableCell className="p-1.5 text-right font-mono text-sm">
                      {fmtMoney(i.unit, cur)}
                    </TableCell>
                    <TableCell className="p-1.5 text-right font-mono text-sm">
                      {fmtMoney(yukluTutar, cur)}
                    </TableCell>
                    <TableCell className="p-1.5 text-right font-mono text-sm">
                      {fmtMoney(fiyat, cur)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "p-1.5 text-right font-mono text-sm",
                        m.profit !== null && m.profit < 0 && "font-semibold text-destructive"
                      )}
                    >
                      {m.profit === null ? "—" : fmtMoney(m.profit, cur)}
                      {m.marginPercent === null ? null : (
                        <span className="ml-1 text-xs text-muted-foreground">
                          %{fmtCostField(m.marginPercent, 0)}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
        </Table>
      </Bolum>
    </div>
  );
}
