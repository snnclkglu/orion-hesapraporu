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
// PAY YÜZDESİ TOPLAM MALİYETE GÖREDİR. Böylece vinç grupları, oranlı giderler
// ve elle girilen fiyat satırlarının payları birlikte %100 eder; üst özetle
// alt kırılım aynı maliyet evrenini gösterir.

import { fmtMoney0 } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { fmtCostField } from "@/lib/offers/cost/labels";
import {
  costSummaryBreakdown,
  costSummaryHeadings,
  type CostOverview,
  type CostTotals,
} from "@/lib/offers/cost/totals";
import type { CostPayload } from "@/lib/offers/cost/types";
import { Bolum, type Katlama } from "./cost-parts";

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
  totals,
  overview,
  katlama,
}: {
  payload: CostPayload;
  totals: CostTotals;
  overview: CostOverview;
  katlama: Katlama;
}) {
  const cur = payload.currency;
  const basliklar = costSummaryHeadings(totals, overview);
  const kirilim = costSummaryBreakdown(payload, totals, overview).sort((a, b) => b.amount - a.amount);
  const enBuyuk = kirilim[0]?.amount ?? 0;

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-3 xl:items-start">
        <Bolum katlama={katlama} katlamaAnahtari="bolum:dortAna" baslik="BEŞ ANA BAŞLIK" aciklama="Vinçler ve fiyat satırları birlikte toplanır; sınıflandırılmayan satır maliyeti ayrıca gösterilir.">
          <div>
            {/* İMALAT ÖNCE: kullanıcının sırası (md. 4) — "en üste yeni grup". */}
            <OzetSatiri
              etiket="İMALAT MALİYETİ"
              deger={fmtMoney0(basliklar.fabrication, cur)}
              aciklama="çelik imalat işçiliği (fire dahil)"
            />
            <OzetSatiri
              etiket="PROJE MALİYETİ"
              deger={fmtMoney0(basliklar.project, cur)}
              aciklama="kalem kalem + proje geneli"
            />
            {basliklar.rates.map((r) => {
              const tanim = payload.rates.find((x) => x.key === r.key);
              return (
              <OzetSatiri
                key={r.key}
                etiket={r.title}
                deger={fmtMoney0(r.amount, cur)}
                // EK KULLANILMAZ ("%2'i" yanlış, "%2'si" doğru): Türkçe ünlü ve
                // ünsüz uyumu SAYININ OKUNUŞUNA bağlıdır ve virgüllü bir oranda
                // ("%25,0") okunuş da değişir. Çarpım biçimi hepsinde doğrudur.
                aciklama={
                  tanim?.mode === "oran"
                    ? tanim.percent === null
                      ? "Oran girilmedi"
                      : `proje × %${fmtCostField(tanim.percent, 0)}`
                    : `${payload.rates.find((x) => x.key === r.key)?.lines.length ?? 0} kalem`
                }
              />
              );
            })}
            {basliklar.unclassified === null ? null : (
              <OzetSatiri
                etiket="DİĞER SATIR MALİYETLERİ"
                deger={fmtMoney0(basliklar.unclassified, cur)}
                aciklama="beş başlığa ayrılmadan girilen fiyat satırları"
              />
            )}
            <OzetSatiri etiket="TOPLAM MALİYET" deger={fmtMoney0(basliklar.total, cur)} kalin />
          </div>
        </Bolum>

        {/*
          "TEKLİF VE KÂR" BLOĞU BURADAN KALDIRILDI ve bu bir DÜZELTMEDİR.

          Kırılım artık Özet bölümünün altında duruyor (kullanıcı isteği,
          22.08.2026, md. 8) ve orada zaten bir "TEKLİF VE KÂR" bloğu var. İki
          blok yan yana düşünce fark görünür hâle geldi: buradaki kâr
          `offer.pricing.total` (İSKONTOSUZ) üzerinden hesaplanıyor ve serbest
          fiyat satırlarına elle yazılmış maliyetleri hiç saymıyordu; Özet'teki
          ise `effectiveTotal` (iskontolu) ile ve elle maliyetleri de ekleyerek
          hesaplıyor. Doğrusu Özet'inkidir — MALIYET-11 kârın İSKONTOLU
          toplamdan hesaplandığını söyler, çünkü pazarlıkta konuşulan tutar
          odur.

          İkisini bırakmak, aynı belgede iki farklı kâr rakamı dolaştırmak
          olurdu (MALIYET-29'un kaçındığı ayrışma).
        */}

        <Bolum katlama={katlama} katlamaAnahtari="bolum:kirilim" baslik="ANA KALEM KIRILIMI" aciklama="Vinç grupları, oranlı giderler ve fiyat satırları birlikte toplanır; pay toplam maliyete göredir.">
          <div className="grid gap-1">
            {kirilim.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz maliyet girilmemiş.</p>
            ) : (
              <>
                {kirilim.map((r) => (
                  <div key={r.key} className="grid gap-0.5">
                    <div className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm" title={r.title}>
                        {r.title}
                      </span>
                      <span className="shrink-0 font-mono text-sm">{fmtMoney0(r.amount, cur)}</span>
                      <span className="w-14 shrink-0 text-right font-mono text-xs text-muted-foreground">
                        {r.share === null ? "—" : `%${fmtCostField(r.share * 100, 0)}`}
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
                ))}
                <div className="mt-2 flex items-baseline gap-2 border-t-2 pt-2 font-semibold">
                  <span className="min-w-0 flex-1">TOPLAM MALİYET</span>
                  <span className="shrink-0 font-mono text-base">{fmtMoney0(basliklar.total, cur)}</span>
                  <span className="w-14 shrink-0 text-right font-mono text-xs">%100</span>
                </div>
              </>
            )}
          </div>
        </Bolum>
      </div>

      {/*
        "KALEM BAZINDA" TABLOSU BURADAN KALKTI: Özet sayfasının TEK LİSTESİ
        (md. 7) aynı soruya daha fazlasıyla cevap veriyor — orada beş ana
        başlık kalem bazında dağıtılmış, ağırlıklar ve tahmini satış da aynı
        satırda. İki tabloyu yan yana bırakmak, kullanıcının "tek bir liste
        istiyorum" cümlesinin tam tersi olurdu.
      */}
    </div>
  );
}
