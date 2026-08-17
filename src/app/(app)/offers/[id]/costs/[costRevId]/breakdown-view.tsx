"use client";

// MALİYET KIRILIMI — paranın nereye gittiği ve kârın ne olduğu.
//
// Devralınan çalışma kitabının "MALİYET KIRILIMI" sayfasının karşılığıdır ve
// aynı soruyu sorar. İki şey ekler: dört ana başlığın toplamı (Excel'de o
// başlıklar hiç hesaplanmıyordu — `PARAMETRELER` C8/C9/C10'daki oranlara bir
// formül bile atıf yapmıyor) ve KÂR (Excel maliyette duruyor, fiyatı hiç
// görmüyordu).
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
import { Bolum } from "./cost-parts";

/** Bir teklif kalemine bağlı fiyat satırlarının toplamı. */
function teklifTutari(offer: OfferPayload, offerItemId: string | null): number | null {
  if (!offerItemId) return null;
  const satirlar = offer.pricing.lines.filter((l) => l.itemId === offerItemId && !l.hidden && l.inTotal);
  const tutarlar = satirlar.map(lineAmount).filter((n): n is number => n !== null);
  return tutarlar.length ? tutarlar.reduce((t, n) => t + n, 0) : null;
}

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
    <div className={cn("flex flex-wrap items-baseline gap-2 border-b py-2 last:border-b-0", kalin && "border-t-2")}>
      <div className="min-w-0 flex-1">
        <div className={cn("text-sm", kalin && "font-semibold")}>{etiket}</div>
        {aciklama ? <div className="text-[11px] text-muted-foreground">{aciklama}</div> : null}
      </div>
      <span className={cn("font-mono text-sm", kalin && "text-base font-semibold")}>{deger}</span>
    </div>
  );
}

export function KirilimSayfasi({
  payload,
  models,
  offer,
}: {
  payload: CostPayload;
  models: Record<string, CostModelResult>;
  offer: OfferPayload;
}) {
  const cur = payload.currency;
  const totals = costTotals(payload, costWeights(models));
  const kirilim = costBreakdown(payload, totals).sort((a, b) => b.amount - a.amount);
  const yuklu = loadedCostByOfferItem(totals);
  const kar = costMargin(offer.pricing.total ?? null, totals.total);
  const enBuyuk = kirilim[0]?.amount ?? 0;

  return (
    <div className="grid gap-4">
      <Bolum baslik="DÖRT ANA BAŞLIK" aciklama="Oranlar proje maliyeti üzerinden hesaplanır.">
        <div>
          <OzetSatiri
            etiket="PROJE MALİYETİ"
            deger={fmtMoney(totals.direct, cur)}
            aciklama="Kalem kalem girilen doğrudan maliyet + proje geneli"
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
                    : `Proje maliyeti × %${fmtCostField(r.percent, 2).replace(",00", "")}`
                  : `${payload.rates.find((x) => x.key === r.key)?.lines.length ?? 0} kalem`
              }
            />
          ))}
          <OzetSatiri etiket="TOPLAM MALİYET" deger={fmtMoney(totals.total, cur)} kalin />
        </div>
      </Bolum>

      <Bolum
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
            aciklama={
              kar.marginPercent === null
                ? "Teklif fiyatı ya da maliyet girilmemiş"
                : `Satış üzerinden %${fmtCostField(kar.marginPercent, 1)} · maliyet üzerinden %${fmtCostField(kar.markupPercent, 1)}`
            }
          />
        </div>
        {kar.profit !== null && kar.profit < 0 ? (
          <p className="rounded-md border border-destructive/60 p-2 text-xs font-medium text-destructive">
            Bu teklif maliyetin ALTINDA. Fiyatı ya da maliyet kalemlerini gözden geçirin.
          </p>
        ) : null}
      </Bolum>

      <Bolum baslik="ANA KALEM KIRILIMI" aciklama="Bütün kalemler boyunca toplanır; pay proje maliyetine göredir.">
        <div className="grid gap-1.5">
          {kirilim.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz maliyet girilmemiş.</p>
          ) : (
            kirilim.map((r) => (
              <div key={r.key} className="grid gap-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="min-w-0 flex-1 text-sm">{r.title}</span>
                  <span className="font-mono text-sm">{fmtMoney(r.amount, cur)}</span>
                  <span className="w-16 text-right font-mono text-xs text-muted-foreground">
                    {r.share === null ? "—" : `%${fmtCostField(r.share * 100, 1)}`}
                  </span>
                </div>
                {/* Çubuk EN BÜYÜK KALEME göre ölçeklenir, toplama göre değil:
                    payların çoğu %5'in altındayken toplama göre çizilen bir
                    çubuk hepsini görünmez yapardı. Sayı zaten yanında yazıyor;
                    çubuk yalnız sıralamayı gözle okutur (renk TEK TAŞIYICI
                    değildir kuralının aynı ailesi). */}
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
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

      <Bolum
        baslik="KALEM BAZINDA"
        aciklama="Yüklü maliyet, proje geneli ve oranlı grupların doğrudan maliyet payına göre dağıtılmış hâlidir."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kalem</TableHead>
              <TableHead className="w-16 text-right">Adet</TableHead>
              <TableHead className="w-24 text-right">Ağırlık</TableHead>
              <TableHead className="w-20 text-right">Birim/kg</TableHead>
              <TableHead className="w-28 text-right">Birim Maliyet</TableHead>
              <TableHead className="w-28 text-right">Yüklü Maliyet</TableHead>
              <TableHead className="w-28 text-right">Teklif Fiyatı</TableHead>
              <TableHead className="w-28 text-right">Kâr</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {totals.items.map((i) => {
              const yukluTutar = i.offerItemId ? (yuklu[i.offerItemId] ?? null) : null;
              const fiyat = teklifTutari(offer, i.offerItemId);
              const m = costMargin(fiyat, yukluTutar);
              return (
                <TableRow key={i.id}>
                  <TableCell>
                    <div className="text-sm">{i.title || "—"}</div>
                    {i.offerItemId ? null : (
                      <div className="text-[11px] text-muted-foreground">Teklif kalemine bağlı değil</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">{fmtCostField(i.qty, 0)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtCostField(i.weightKg, 0)}</TableCell>
                  <TableCell className="text-right font-mono">
                    {fmtCostField(costPerKg(i.unit, i.weightKg), 2)}
                  </TableCell>
                  <TableCell className="text-right font-mono">{fmtMoney(i.unit, cur)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtMoney(yukluTutar, cur)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtMoney(fiyat, cur)}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono",
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
