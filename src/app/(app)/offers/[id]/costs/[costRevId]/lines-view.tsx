"use client";

// MALİYETLER SAYFASI — dört ana başlık + kırılım, TEK SAYFADA.
//
// Kullanıcı tarifi (17.08.2026): *"maliyet kalemlerini Proje Maliyet, Sabit
// Maliyetler, Sarf Maliyetler, Finansman Maliyetleri olarak 4 ana başlıkta
// giriş yapacağım. Sarf Finansman ve Sabit Maliyetleri oransal olarak
// gireceğim."* Ekran o cümlenin şeklidir: üstte hammadde birim fiyatları,
// sonra kalem kalem girilen proje maliyeti, altında oranla hesaplanan üç
// başlık, en altta toplam — ve onun altında KIRILIM.
//
// KIRILIM AYRI BİR SAYFA DEĞİLDİR (kullanıcı isteği 18.08.2026, md. 8:
// *"Maliyetler ve Kırılım sayfasını birleştirelim"*). İkisi aynı soruyu iki
// ucundan sorar — "ne girdim" ve "ne çıktı" — ve arada sekme değiştirmek,
// bir birim fiyatı düzeltip etkisini görmek için her seferinde iki tık
// demekti.
//
// SATIR = MİKTAR × BİRİM FİYAT. Miktar MODELDEN gelir ve kutusu salt okunur
// çizilir; tıklanınca nereden geldiğini söyler (md. 9). Birim fiyat HAMMADDE
// ŞERİDİNDEN ya da elden gelir (md. 12) — fiyat aramalı bir tablo bu fazda
// bilerek yoktur (kullanıcı kararı).
//
// SATIR ALTI METİN YOKTUR (md. 8: *"satırların altında yazan yazıları
// satırların yanına kutuya yazalım. dikeyde yer kaybetmeyelim"*). Teklifteki
// karşılık kendi SÜTUNUNA taşındı; miktarın kaynağı pop-up'a girdi. İkisi
// satırın altındayken bir satır üç sıra yer kaplıyordu.

import { useMemo } from "react";
import { Eye, EyeOff, Plus, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CURRENCY_SYMBOLS, currencyOf, fmtMoney0 } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { costAmountLevel, costAmountWeight, costLargestAmount } from "@/lib/offers/cost/heat";
import { fmtCostField } from "@/lib/offers/cost/labels";
import type { CostModelResult } from "@/lib/offers/cost/model";
import { freeCostLine, lineQty, linePrice, withLumpMode } from "@/lib/offers/cost/payload";
import {
  COST_UNITS,
  FABRICATION_GROUP_KEY,
  GENERAL_GROUP_KEY,
  MATERIAL_PRICE_DEFS,
  costGroupHue,
  costLineDef,
  costRateHue,
  materialPriceDef,
  offerRefValue,
} from "@/lib/offers/cost/registry";
import { COST_RATE_MODES, costGroupLines, isLumpLine } from "@/lib/offers/cost/types";
import {
  costGroupTotal,
  costItemSplit,
  costLineAmount,
  costRateAmount,
  costTotals,
} from "@/lib/offers/cost/totals";
import type { CostGroup, CostItem, CostLine, CostPayload, CostRateGroup } from "@/lib/offers/cost/types";
import type { OfferPayload } from "@/lib/offers/types";
import { SayiKutusu } from "@/components/sayi-kutusu";
import {
  BirimSecici,
  Bolum,
  KatlaDugmesi,
  MiniDugme,
  Turetme,
  type Katlama,
} from "./cost-parts";

// ————————————————————————————————————————————— hammadde şeridi

/**
 * HAMMADDE BİRİM FİYATLARI — proje maliyetinin en üstünde, yan yana.
 *
 * Kullanıcı isteği (18.08.2026, md. 12): *"Proje maliyetlerinin en üstünde
 * Hammadde birim fiyatlarını girebileceğim yer olsun. Sac Profil Ray Kesim
 * Boya İş. Boya Çelik İmalat İşçiliği fiyatlarını en üste yanyana sırala ben
 * buraya gireyim. buradan alt bölümler değişsin."*
 *
 * SEKİZ KUTU TEK SIRADIR ve sarar: her biri 8,5 rem, sekizi 68 rem — geniş bir
 * masaüstünde tek satır, dar ekranda ikiye/üçe katlanır. Dikey bir liste
 * yapılsaydı sayfanın ilk ekranı yalnız fiyatlarla dolardı; oysa bunlar bir
 * kez yazılıp bir daha bakılmayan sayılardır.
 *
 * GÖRÜNEN VE HESAPLANAN FİYAT BELGEDE YAŞAR (`payload.materialPrices`). Yeni
 * çalışma global defterin anlık kopyasını alır; bu şerit o kopyayı değiştirir,
 * global defteri değil. Böylece sac bugün yükseldi diye geçen ayın belgesi
 * değişmez (MALIYET-33).
 */
function HammaddeSeridi({
  prices,
  currency,
  readOnly,
  onChange,
}: {
  prices: Record<string, number | null>;
  currency: string;
  readOnly: boolean;
  onChange: (next: Record<string, number | null>) => void;
}) {
  const simge = CURRENCY_SYMBOLS[currencyOf(currency)];
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-2">
      {MATERIAL_PRICE_DEFS.map((d) => {
        const id = `hammadde-${d.key}`;
        const deger = prices[d.key] ?? null;
        return (
          <div key={d.key} className="grid w-[8.5rem] gap-1">
            <label htmlFor={id} className="truncate text-xs" title={d.hint ?? d.label}>
              {d.label}
              <span className="ml-1 text-muted-foreground">
                [{simge}/{d.unit}]
              </span>
            </label>
            <SayiKutusu
              id={id}
              disabled={readOnly}
              value={deger}
              onChange={(v) => onChange({ ...prices, [d.key]: v })}
              className="h-9 text-right font-mono"
            />
          </div>
        );
      })}
    </div>
  );
}

// ————————————————————————————————————————————————— satır tablosu

function SatirTablosu({
  lines,
  groupKey,
  currency,
  prices,
  model,
  params,
  offer,
  offerItemId,
  readOnly,
  enBuyukTutar,
  onLine,
  onEkle,
}: {
  /** GÖRÜNEN satırlar — kipe göre süzülmüş (`costGroupLines`). */
  lines: CostLine[];
  /** Defterdeki grup anahtarı — teklif karşılığı ondan çözülür. */
  groupKey: string;
  currency: string;
  prices: Record<string, number | null>;
  model?: CostModelResult;
  params: Record<string, number>;
  offer: OfferPayload;
  offerItemId: string | null;
  readOnly: boolean;
  /**
   * ISI ÖLÇEĞİNİN TABANI — belgenin EN BÜYÜK satır tutarı (md. 14).
   *
   * DIŞARIDAN GELİR ve bu zorunludur: her tablo kendi tabanını bulsaydı
   * ölçek grup içi olurdu ve 500 €'luk bir grubun en büyük satırı, 70.000
   * €'luk grubunkiyle aynı kırmızıyı alırdı (`cost/heat.ts`in gerekçesi).
   */
  enBuyukTutar: number;
  /** Satırı KİMLİĞİYLE değiştirir; `null` siler. Dizin KULLANILMAZ — görünen
      liste süzülmüştür ve dizinler tam listeninkiyle örtüşmez. */
  onLine: (id: string, next: CostLine | null) => void;
  onEkle: (() => void) | null;
}) {
  const simge = CURRENCY_SYMBOLS[currencyOf(currency)];

  return (
    <div className="grid gap-2">
      {/* MASAÜSTÜNDE ÇİZELGE, TELEFONDA DÜZENLENEBİLİR KART: aynı hücreler
          `data-label` başlıklarıyla katlanır. Ayrı mobil işaretleme yoktur;
          miktar/fiyat değişikliği iki görünümde ayrışamaz ve yatay kaydırma
          açılmaz. */}
      <Table
        className="oc-mobile-table w-full table-fixed"
        containerClassName="oc-mobile-table-wrap !overflow-x-hidden [--oc-scroll-bg:var(--background)]"
      >
          <TableHeader>
            <TableRow>
              {/* UZUNLUĞU VERİDEN GELEN SÜTUN KELEPÇELENİR ve kelepçe `th` ile
                  `td`de AYNIDIR (MOBIL-7): tablo düzeni `auto`dur ve tek bir
                  uzun kalem adı bütün tabloyu ekranın dışına iter. */}
              {/* TABAN 12 REM, GENİŞ EKRANDA AYRICA BÜYÜTÜLMEZ. `min-w` bir TABANDIR,
                  genişlik değil: artan yeri bu sütun zaten kendiliğinden alır.
                  Eskiden `2xl`de taban 18 rem'e çıkarılıyordu ve bu, sayfa iki
                  sütuna bölününce (md. 2) tablonun en küçük genişliğini 781 px'e
                  itip her öbekte yatay kaydırma açıyordu — geniş ekranda daha
                  ferah dursun diye konan kural, geniş ekranda okunurluğu bozan
                  kural hâline gelmişti. */}
              <TableHead className="w-[26%] px-1.5">Kalem</TableHead>
              <TableHead className="hidden w-[18%] px-1.5 text-[10px] xl:table-cell">Teklifte</TableHead>
              <TableHead className="w-[13%] px-1.5">Miktar</TableHead>
              <TableHead className="w-[10%] px-1.5">Birim</TableHead>
              <TableHead className="w-[14%] px-1.5">Birim Fiyat</TableHead>
              <TableHead className="w-[12%] px-1.5 text-right">Tutar</TableHead>
              <TableHead className="w-[7%] px-1" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => {
              const miktar = lineQty(line, model);
              const fiyat = linePrice(line, prices);
              const modelden = !line.qtyManual && !!line.qtySource;
              const seritten = !line.priceManual && !!line.priceSource;
              const hammadde = materialPriceDef(line.priceSource);
              const teklifte = offerRefValue(offer, offerItemId, groupKey, line.key);
              // DEFTERİN İPUCU KAYBOLMASIN: satır altı metinleri kaldıran düzen
              // (md. 8) onu da götürüyordu. "Profil ve Ray miktarı modelden
              // gelmez" bilgisi ekrandan düşünce boş bir miktar hata gibi
              // okunur. Yeni dikey sıra AÇMADAN adın `title`ında durur;
              // modelden gelen satırlarda zaten pop-up da anlatır.
              const ipucu = costLineDef(groupKey, line.key)?.hint;
              const tutar = costLineAmount({ ...line, qty: miktar, unitPrice: fiyat });
              const isi = costAmountLevel(tutar, enBuyukTutar);
              return (
                <TableRow key={line.id} className={cn(line.hidden && "opacity-55")}>
                  <TableCell data-label="Kalem" data-mobile-span="full" className="p-1.5">
                    <Input
                      value={line.label}
                      disabled={readOnly}
                      title={ipucu}
                      onChange={(e) => onLine(line.id, { ...line, label: e.target.value })}
                      aria-label="Kalem adı"
                      className="h-9 min-w-0 text-base pointer-fine:text-sm"
                    />
                  </TableCell>

                  {/* TEKLİFTEKİ KARŞILIK KENDİ SÜTUNUNDADIR (md. 8). Depolanmaz —
                      teklif değişirse bu sütun da değişir ve iki belge ayrışamaz
                      (TEKLIF-20'nin tek okuma noktası). */}
                  <TableCell data-mobile-hidden className="hidden max-w-56 p-1.5 xl:table-cell">
                    <span
                      className="line-clamp-2 block whitespace-normal break-words text-[10px] leading-tight text-muted-foreground"
                      title={teklifte ?? undefined}
                    >
                      {teklifte ?? "—"}
                    </span>
                  </TableCell>

                  <TableCell data-label="Miktar" className="p-1.5">
                    {modelden ? (
                      <div className="flex min-w-0 items-center gap-1">
                        {/* MİKTARIN KAYNAĞI POP-UP'TADIR (md. 9): formül, ara
                            değerler ve katsayılar. Kutunun kendisi tetikleyicidir
                            — satırın altında duran "Miktar: …" metni bir sıra yer
                            kaplıyordu ve zaten yalnız alanın ADINI söylüyordu. */}
                        <Turetme
                          fieldKey={line.qtySource}
                          model={model}
                          params={params}
                          baslik={line.label || "Satır"}
                        >
                          <button
                            type="button"
                            title="Miktar nereden geliyor?"
                            className="oc-tap flex h-9 min-w-0 flex-1 items-center justify-end rounded-md border bg-muted/40 px-2 font-mono text-sm transition-colors hover:bg-muted"
                          >
                            {fmtCostField(miktar, 0)}
                          </button>
                        </Turetme>
                        <MiniDugme
                          baslik="Miktarı elle gir"
                          disabled={readOnly}
                          onClick={() => onLine(line.id, { ...line, qtyManual: true, qty: miktar })}
                        >
                          <Wand2 className="size-3.5" />
                        </MiniDugme>
                      </div>
                    ) : (
                      <div className="flex min-w-0 items-center gap-1">
                        <SayiKutusu
                          value={line.qty}
                          disabled={readOnly}
                          aria-label="Miktar"
                          onChange={(v) => onLine(line.id, { ...line, qty: v })}
                          className="h-9 min-w-0 text-right font-mono"
                        />
                        {line.qtySource ? (
                          <MiniDugme
                            baslik="Modele döndür"
                            aktif
                            disabled={readOnly}
                            onClick={() => onLine(line.id, { ...line, qtyManual: false })}
                          >
                            <Wand2 className="size-3.5" />
                          </MiniDugme>
                        ) : null}
                      </div>
                    )}
                  </TableCell>

                  <TableCell data-label="Birim" className="p-1.5">
                    <BirimSecici
                      value={line.unit}
                      units={COST_UNITS}
                      disabled={readOnly}
                      onChange={(v) => onLine(line.id, { ...line, unit: v })}
                      className="h-9"
                    />
                  </TableCell>

                  <TableCell data-label="Birim Fiyat" className="p-1.5">
                    {seritten ? (
                      // ŞERİTTEN GELEN FİYAT SALT OKUNURDUR — miktarın model
                      // kutusuyla aynı desen. İKİ KAYNAK ASLA TOPLANMAZ: asa
                      // düğmesi bu satırı şeritten KOPARIR ve fiyatı insana
                      // bırakır (`linePrice`).
                      <div className="flex min-w-0 items-center gap-1">
                        <span
                          title={`${hammadde?.label ?? "Hammadde"} şeridinden — üstteki kutudan değişir`}
                          className="flex h-9 min-w-0 flex-1 items-center justify-end rounded-md border bg-muted/40 px-2 font-mono text-sm"
                        >
                          {fiyat === null ? "—" : fmtCostField(fiyat, 2)}
                        </span>
                        <MiniDugme
                          baslik="Fiyatı bu satırda elle gir"
                          disabled={readOnly}
                          onClick={() => onLine(line.id, { ...line, priceManual: true, unitPrice: fiyat })}
                        >
                          <Wand2 className="size-3.5" />
                        </MiniDugme>
                      </div>
                    ) : (
                      <div className="flex min-w-0 items-center gap-1">
                        <SayiKutusu
                          binlik
                          value={line.unitPrice}
                          disabled={readOnly}
                          aria-label="Birim fiyat"
                          onChange={(v) => onLine(line.id, { ...line, unitPrice: v })}
                          className="h-9 min-w-0 text-right font-mono"
                        />
                        {line.priceSource ? (
                          <MiniDugme
                            baslik={`${hammadde?.label ?? "Hammadde"} şeridine döndür`}
                            aktif
                            disabled={readOnly}
                            onClick={() => onLine(line.id, { ...line, priceManual: false })}
                          >
                            <Wand2 className="size-3.5" />
                          </MiniDugme>
                        ) : null}
                      </div>
                    )}
                  </TableCell>

                  {/* TUTAR BÜYÜKLÜĞÜNE GÖRE RENKLİDİR (md. 14): küçük sarı,
                      büyük kırmızı. Seviyeyi saf çekirdek üretir
                      (`costAmountLevel`), rengi `globals.css` verir. Renk TEK
                      TAŞIYICI DEĞİLDİR: aynı büyüklük yazının KALINLIĞIYLA da
                      söylenir ve `title` oranı yazıyla verir — renk körlüğünde
                      ve siyah beyaz çıktıda da okunur (WCAG 1.4.1). */}
                  <TableCell
                    data-label="Tutar"
                    className={cn(
                      "p-1 text-right font-mono text-xs leading-tight",
                      isi !== null && "oc-amount",
                      costAmountWeight(isi)
                    )}
                    style={isi === null ? undefined : ({ "--oc-level": `${isi}` } as React.CSSProperties)}
                    title={
                      isi === null
                        ? undefined
                        : `Belgenin en büyük kaleminin %${fmtCostField((tutar ?? 0) / enBuyukTutar * 100, 0)}'i`
                    }
                  >
                    {fmtMoney0(tutar, currency)}
                  </TableCell>

                  <TableCell data-label="İşlemler" data-mobile-span="full" className="p-1.5">
                    <div className="flex flex-wrap items-center justify-end gap-0.5" data-mobile-actions>
                      <MiniDugme
                        baslik={line.hidden ? "Toplama katılmıyor" : "Toplamdan çıkar"}
                        aktif={line.hidden === true}
                        disabled={readOnly}
                        onClick={() => onLine(line.id, { ...line, hidden: !line.hidden })}
                      >
                        {line.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </MiniDugme>
                      {/* GÖTÜRÜ SATIR SİLİNEMEZ: kipin taşıyıcısıdır ve silinseydi
                          götürüye geri dönüldüğünde girilmiş fiyat kaybolurdu. */}
                      {isLumpLine(line) ? (
                        <span className="w-8" />
                      ) : (
                        <MiniDugme
                          baslik="Satırı sil"
                          disabled={readOnly}
                          onClick={() => onLine(line.id, null)}
                        >
                          <Trash2 className="size-3.5" />
                        </MiniDugme>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
      </Table>
      {onEkle ? (
        <Button type="button" variant="outline" size="sm" className="oc-tap justify-self-start" onClick={onEkle}>
          <Plus className="size-3.5" /> Satır Ekle
        </Button>
      ) : null}
      <span className="sr-only">Birim fiyatlar {simge} cinsindendir.</span>
    </div>
  );
}

/**
 * BÖLÜM BAŞLIĞINDAKİ TUTAR — SEÇİLİ KALEMİN, belgenin değil.
 *
 * Kullanıcı isteği (22.08.2026, md. 10): *"Bir vinci maliyetlendirirken ana
 * başlıkta örneğin İmalat Maliyeti kısmında diğer kalemin de maliyetini
 * toplamasın karışıyor. Her vinci tek tek o sayfada inceleyeceğiz. En son
 * Özet kısmında genel göreceğiz."*
 *
 * ESKİDEN BELGE TOPLAMIYDI (`BelgeToplami`) ve altına "bütün kalemler · adet
 * dahil" yazıyordu — yani ekran yanılttığını kendisi itiraf ediyordu. İki
 * vinçli bir teklifte birinci vincin çipi seçiliyken başlıkta ikincinin
 * imalatı da toplanıyor, gövdede ise yalnız seçilinin grupları duruyordu.
 *
 * ARA TOPLAM DA BUNUNLA BİRLİKTE ÖLDÜ. O satır (kesikli çerçeveli "… — ARA
 * TOPLAM") 18.08.2026'da bu boşluğu kapatmak için eklenmiş bir YAMAYDI:
 * başlıktaki sayı gövdeden türetilemiyordu, ara toplam aradaki farkı yazıyla
 * anlatıyordu. Başlık kalem düzeyine indiğinde şart kendiliğinden sağlanır ve
 * ayrı bir satır yalnız dikey borç olurdu (MALIYET-25).
 *
 * BAŞLIKTA BİRİM DURUR, PAKET İKİNCİ SATIRDA. Üç gerekçe:
 *
 * 1. Gövdedeki grup başlıkları BİRİM basar (`costGroupTotal`); bölüm başlığı
 *    paket olsaydı kullanıcı grupları toplayıp başlığı yine tutturamazdı —
 *    18.08.2026'da bildirilen hatanın birebir tekrarı.
 * 2. Firmanın kendi dili böyle ayırıyor: Excel kalem sayfası "KALEM BİRİM
 *    MALİYETİ" ve "PAKET MALİYET (BİRİM × ADET)" satırlarını alt alta basar.
 * 3. Adet birse ikinci satır hiç çizilmez — aynı sayıyı iki kez yazmak bilgi
 *    değil gürültüdür.
 */
function KalemToplami({
  birim,
  adet,
  currency,
}: {
  birim: number | null;
  adet: number;
  currency: string;
}) {
  const paket = birim === null ? null : birim * adet;
  return (
    <div className="text-right">
      <div className="font-mono text-sm font-semibold">{fmtMoney0(birim, currency)}</div>
      {adet !== 1 ? (
        <div className="font-mono text-[11px] text-muted-foreground">
          × {fmtCostField(adet, 0)} Adet = {fmtMoney0(paket, currency)}
        </div>
      ) : null}
    </div>
  );
}

// —————————————————————————————————————————————————————— grup

function GrupBlogu({
  group,
  currency,
  prices,
  model,
  params,
  offer,
  offerItemId,
  readOnly,
  katlama,
  enBuyukTutar,
  onChange,
}: {
  group: CostGroup;
  currency: string;
  prices: Record<string, number | null>;
  model?: CostModelResult;
  params: Record<string, number>;
  offer: OfferPayload;
  offerItemId: string | null;
  readOnly: boolean;
  katlama: Katlama;
  /** Isı ölçeğinin tabanı — belgenin en büyük satır tutarı (md. 14). */
  enBuyukTutar: number;
  onChange: (next: CostGroup) => void;
}) {
  // Grup toplamı MODEL MİKTARLARI VE ŞERİT FİYATLARIYLA hesaplanır: kaydetmeden
  // önce satırlarda henüz yazılı olmayabilirler (`withCostDerived` kaydetme
  // yolunda çalışır) ve ekranın belgeden farklı bir sayı göstermesi kabul
  // edilemez.
  const dolu = {
    ...group,
    lines: group.lines.map((l) => ({ ...l, qty: lineQty(l, model), unitPrice: linePrice(l, prices) })),
  };
  const toplam = costGroupTotal(dolu);
  const gorunen = costGroupLines(group);

  const setLine = (id: string, next: CostLine | null) =>
    onChange({
      ...group,
      lines: next ? group.lines.map((l) => (l.id === id ? next : l)) : group.lines.filter((l) => l.id !== id),
    });

  // ALT BÖLÜM DE KATLANIR (md. 6). Anahtar grubun KİMLİĞİDİR, başlığı değil:
  // iki kalemde aynı adlı grup (ÇELİK YAPI) bulunur ve başlıkla anahtarlansaydı
  // birini katlamak ötekini de katlardı.
  const kapali = katlama.kapali(group.id);

  // ALT GRUBUN RENGİ DEFTERDEN GELİR (md. 13) ve `key`den çözülür — belgeye
  // yazılmaz, yani yayımlanmış bir maliyet revizyonu da bugünkü renkte açılır.
  const ton = costGroupHue(group.key, group.title);
  const tonStili = { "--oc-hue": `${ton}` } as React.CSSProperties;

  return (
    <div className="grid gap-2 rounded-md border p-2.5">
      {/* RENK YALNIZ BAŞLIK ŞERİDİNDE: grubun gövdesi bir tablodur ve zeminini
          boyamak satır zeminleriyle çakışırdı ("az da olsa", md. 13). */}
      <div className="oc-fieldgroup -mx-1 flex flex-wrap items-center gap-2 rounded-sm py-1 pr-1 pl-2" style={tonStili}>
        <KatlaDugmesi
          kapali={kapali}
          baslikMetni={group.title}
          onClick={() => katlama.degistir(group.id)}
        />
        <h3 className="oc-fieldgroup-title flex-1 text-xs font-semibold tracking-wide" style={tonStili}>
          {group.title}
        </h3>
        {/* GÖTÜRÜ KİP HER GRUPTA AÇIKTIR, yalnız elektrikte değil (kullanıcı
            örneği elektrikti ama sebep genel): tedarikçi yürütme grubunu da
            tek kalemde fiyatlayabilir. Kipi bir gruba kapatmak, aynı soruyu
            ikinci kez sordurmaktan başka bir şey yapmazdı.
            KİP TEKTİR VE İKİ KAYNAK TOPLANMAZ (`costGroupLines`). */}
        {readOnly ? null : (
          <div className="flex items-center gap-1">
            <MiniDugme
              baslik="Kalem kalem gir"
              aktif={group.lump !== true}
              onClick={() => onChange(withLumpMode(group, false))}
            >
              Kalem
            </MiniDugme>
            <MiniDugme
              baslik="Grubu tek bir götürü fiyata indir"
              aktif={group.lump === true}
              onClick={() => onChange(withLumpMode(group, true))}
            >
              Tek Fiyat
            </MiniDugme>
          </div>
        )}
        <span className="w-32 text-right font-mono text-sm font-semibold">{fmtMoney0(toplam, currency)}</span>
      </div>
      {kapali ? null : (
      <SatirTablosu
        lines={gorunen}
        groupKey={group.key}
        currency={currency}
        prices={prices}
        model={model}
        params={params}
        offer={offer}
        offerItemId={offerItemId}
        readOnly={readOnly}
        enBuyukTutar={enBuyukTutar}
        onLine={setLine}
        onEkle={
          readOnly || group.lump
            ? null
            : () => onChange({ ...group, lines: [...group.lines, freeCostLine()] })
        }
      />
      )}
      {group.lump && !kapali ? (
        <p className="text-[11px] text-muted-foreground">
          Götürü kip: grubun kalem satırları toplama girmez ama SİLİNMEZ — kaleme
          döndüğünüzde girilmiş bütün fiyatlar yerindedir.
        </p>
      ) : null}
    </div>
  );
}

/**
 * ORANLI GRUP — sabit, sarf, finansman.
 *
 * KİP TEKTİR VE İKİ KAYNAK TOPLANMAZ: `oran` kipinde tutar yüzdeden türer ve
 * satırlar yalnız not olarak durur; `kalem` kipinde satırların toplamıdır ve
 * yüzde hiç okunmaz. Ekran hangi kipte olduğunu yazıyla söyler — bir grubun
 * tutarının nereden geldiği tek soruyla anlaşılmalıdır.
 */
function OranBlogu({
  rate,
  base,
  currency,
  prices,
  params,
  offer,
  readOnly,
  enBuyukTutar,
  onChange,
}: {
  rate: CostRateGroup;
  base: number | null;
  currency: string;
  prices: Record<string, number | null>;
  params: Record<string, number>;
  offer: OfferPayload;
  readOnly: boolean;
  /** Isı ölçeğinin tabanı — belgenin en büyük satır tutarı (md. 14). */
  enBuyukTutar: number;
  onChange: (next: CostRateGroup) => void;
}) {
  const tutar = costRateAmount(rate, base);
  // ORANLI GRUBUN TONU AYRI BİR DEFTERDEDİR: bunlar bir vincin parçası değil,
  // belgenin giderleridir ve renkleri vinç bölümlerinin arasına karışmamalıdır.
  const ton = costRateHue(rate.key, rate.title);
  const tonStili = { "--oc-hue": `${ton}` } as React.CSSProperties;
  const setLine = (id: string, next: CostLine | null) =>
    onChange({
      ...rate,
      lines: next ? rate.lines.map((l) => (l.id === id ? next : l)) : rate.lines.filter((l) => l.id !== id),
    });

  return (
    <div className="grid gap-2 rounded-md border p-2.5">
      <div className="oc-fieldgroup -mx-1 flex flex-wrap items-center gap-2 rounded-sm py-1 pr-1 pl-2" style={tonStili}>
        <h3 className="oc-fieldgroup-title text-xs font-semibold tracking-wide" style={tonStili}>
          {rate.title}
        </h3>
        {rate.mode === "oran" ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Proje maliyetinin %</span>
            <SayiKutusu
              value={rate.percent}
              disabled={readOnly}
              aria-label={`${rate.title} oranı`}
              onChange={(v) => onChange({ ...rate, percent: v })}
              className="h-9 w-20 text-right font-mono"
            />
            <span className="text-xs text-muted-foreground">
              kadarı · taban {fmtMoney0(base, currency)}
            </span>
          </div>
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          {COST_RATE_MODES.map((m) => (
            <MiniDugme
              key={m}
              baslik={m === "oran" ? "Oranla hesapla" : "Kalem kalem gir"}
              aktif={rate.mode === m}
              disabled={readOnly}
              onClick={() => onChange({ ...rate, mode: m })}
            >
              {m === "oran" ? "Oran" : "Kalem"}
            </MiniDugme>
          ))}
          <span className="w-32 text-right font-mono text-sm font-semibold">{fmtMoney0(tutar, currency)}</span>
        </div>
      </div>

      {rate.mode === "kalem" ? (
        <SatirTablosu
          lines={rate.lines}
          groupKey={rate.key}
          currency={currency}
          prices={prices}
          params={params}
          offer={offer}
          offerItemId={null}
          readOnly={readOnly}
          enBuyukTutar={enBuyukTutar}
          onLine={setLine}
          onEkle={readOnly ? null : () => onChange({ ...rate, lines: [...rate.lines, freeCostLine()] })}
        />
      ) : null}
    </div>
  );
}

// ————————————————————————————————————————————————————— sayfa

export function MaliyetSayfasi({
  payload,
  item,
  model,
  offer,
  readOnly,
  katlama,
  onItemChange,
  onChange,
}: {
  katlama: Katlama;
  payload: CostPayload;
  item: CostItem | undefined;
  model: CostModelResult | undefined;
  offer: OfferPayload;
  readOnly: boolean;
  onItemChange: (next: CostItem) => void;
  onChange: (next: CostPayload) => void;
}) {
  const cur = payload.currency;
  const prices = payload.materialPrices;
  const params = payload.params;
  const totals = costTotals(payload);

  /**
   * SEÇİLİ KALEMİN BÖLMESİ — bölüm başlıklarındaki tutarların kaynağı (md. 10).
   *
   * SAF ÇEKİRDEKTEN GELİR (`costItemSplit`), ekranda hesaplanmaz. Bir süre
   * proje tarafı burada elle toplanıyordu (`kalemProjeBirimi`) ve o kopya
   * yalnız ikinci bir tanım değildi, YANLIŞTI da: `null`ları atlayıp sıfır
   * tabanlı bir `reduce`a giriyor, yani hiç maliyeti girilmemiş bir vinci
   * `null` yerine 0 € gösteriyordu.
   */
  const bolme = item ? costItemSplit(item) : null;

  /**
   * ISI ÖLÇEĞİNİN TABANI — belgenin EN BÜYÜK satır tutarı (md. 14).
   *
   * BİR KEZ, BURADA hesaplanır ve aşağı geçirilir. Her tablonun kendi tabanını
   * bulması "grup içi ölçek" demekti ve aynı sayı belgenin iki yerinde iki
   * farklı renk alırdı (`cost/heat.ts`in gerekçesi).
   *
   * TABAN BÜTÜN BELGEYİ TARAR, yalnız seçili kalemi değil: sayfa vinç vinç
   * çalışsa da ölçek belgenin tamamına aittir; yoksa aynı 5.000 €'luk satır,
   * yandaki kalem seçildiğinde renk değiştirirdi.
   *
   * MİKTAR MODELDEN OKUNMAZ (`lineQty(l, undefined)`): model kalem başınadır
   * ve burada bütün kalemler taranır. Türetilmiş miktarlar zaten satıra
   * YAZILIDIR (`withCostDerived`, MALIYET-24) — okunan sayı belgedeki sayıdır.
   */
  const enBuyukTutar = useMemo(() => {
    const tutarlar: (number | null)[] = [];
    const grubuTara = (g: CostGroup) => {
      for (const l of costGroupLines(g)) {
        tutarlar.push(costLineAmount({ ...l, unitPrice: linePrice(l, prices) }));
      }
    };
    for (const it of payload.items) for (const g of it.groups) grubuTara(g);
    grubuTara(payload.general);
    for (const r of payload.rates) {
      if (r.mode !== "kalem") continue;
      for (const l of r.lines) tutarlar.push(costLineAmount(l));
    }
    return costLargestAmount(tutarlar);
  }, [payload, prices]);

  return (
    <div className="grid gap-4">
      <Bolum
        katlama={katlama}
        katlamaAnahtari="bolum:hammadde"
        baslik="HAMMADDE BİRİM FİYATLARI"
        aciklama="Bu fiyatlar aşağıdaki sac, profil, ray, kesim, boya ve imalat işçiliği satırlarını birden besler. Bir satırda ayrı fiyat gerekiyorsa o satırın asa düğmesiyle şeritten koparın."
      >
        <HammaddeSeridi
          prices={prices}
          currency={cur}
          readOnly={readOnly}
          onChange={(next) => onChange({ ...payload, materialPrices: next })}
        />
      </Bolum>

      {/* İMALAT MALİYETİ — BEŞİNCİ ANA BAŞLIK, proje maliyetinin ÜSTÜNDE
          (kullanıcı isteği 18.08.2026, md. 4). Miktarı vincin fireli çelik
          ağırlığından gelir; oranlı grupların tabanına DAHİLDİR (bir satırı
          başlık değiştirmek toplamı kaydırmamalıdır — `costTotals` gerekçesi). */}
      <Bolum
        katlama={katlama}
        katlamaAnahtari="bolum:imalat"
        baslik="İMALAT MALİYETİ"
        ton={costGroupHue(FABRICATION_GROUP_KEY, "İMALAT MALİYETİ")}
        aciklama="Bu VİNCİN çelik imalat işçiliği — miktarı fireli çelik ağırlığıdır, birim fiyatı hammadde şeridinden gelir."
        sag={
          bolme ? (
            <KalemToplami birim={bolme.fabricationUnit} adet={bolme.qty} currency={cur} />
          ) : undefined
        }
      >
        {item ? (
          <div className="grid gap-2.5">
            {item.groups
              .map((g, gi) => ({ g, gi }))
              .filter(({ g }) => g.key === FABRICATION_GROUP_KEY)
              .map(({ g, gi }) => (
                <GrupBlogu
                  key={g.id}
                  group={g}
                  currency={cur}
                  prices={prices}
                  model={model}
                  params={params}
                  offer={offer}
                  offerItemId={item.offerItemId}
                  readOnly={readOnly}
                  katlama={katlama}
                  enBuyukTutar={enBuyukTutar}
                  onChange={(next) =>
                    onItemChange({ ...item, groups: item.groups.map((x, i) => (i === gi ? next : x)) })
                  }
                />
              ))}
          </div>
        ) : (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            Kalem açıldığında imalat maliyeti burada görünür.
          </p>
        )}
      </Bolum>

      <Bolum
        katlama={katlama}
        katlamaAnahtari="bolum:proje"
        baslik="PROJE MALİYETİ"
        ton={costGroupHue("steel", "PROJE MALİYETİ")}
        aciklama="Bu VİNCİN kalem kalem girilen doğrudan maliyeti. Miktarlar ağırlık ve hesap modelinden gelir; miktara tıklayınca nereden geldiği açılır."
        sag={
          bolme ? <KalemToplami birim={bolme.projectUnit} adet={bolme.qty} currency={cur} /> : undefined
        }
      >
        {/* TABLOLAR SABİT IZGARADIR ve kendi içinde yatay kaymaz; bu yüzden iki
            sütun eşiği gerçek içerik genişliğine göre 1500 px'tir. */}
        <div className="grid gap-2.5 min-[1500px]:grid-cols-2 min-[1500px]:items-start">
          {item ? (
            item.groups
              .map((g, gi) => ({ g, gi }))
              .filter(({ g }) => g.key !== FABRICATION_GROUP_KEY)
              .map(({ g, gi }) => (
                <GrupBlogu
                  key={g.id}
                  group={g}
                  currency={cur}
                  prices={prices}
                  model={model}
                  params={params}
                  offer={offer}
                  offerItemId={item.offerItemId}
                  readOnly={readOnly}
                  katlama={katlama}
                  enBuyukTutar={enBuyukTutar}
                  onChange={(next) =>
                    onItemChange({ ...item, groups: item.groups.map((x, i) => (i === gi ? next : x)) })
                  }
                />
              ))
          ) : (
            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              Bu maliyet çalışmasında henüz kalem yok. Teklifte kalem açıp
              <span className="font-medium"> Tekliften Tazele</span> düğmesine basın.
            </p>
          )}
        </div>
      </Bolum>

      {/*
        ——————————————————————————————————————————————— BELGE GENELİ

        BU İKİ BLOK BİR VİNCE AİT DEĞİLDİR ve artık öyle görünüyor.

        Kullanıcı isteği (22.08.2026, md. 10): *"Her vinci tek tek o sayfada
        inceleyeceğiz."* Yukarıdaki iki bölüm artık SEÇİLİ kalemin sayfasıdır;
        PROJE GENELİ (üç vinçlik bir teklifte dokümantasyon bir kez yapılır) ve
        ORANLI MALİYETLER (tabanı belgenin doğrudan maliyetidir) ise kalem
        çipiyle hiç değişmez.

        AYRI BİR SEKMEYE TAŞINMADI, AYRI BİR ÇERÇEVEYE ALINDI (kullanıcı
        kararı, 22.08.2026): düzenleme yeri aynı sayfada kalsın, yalnız hangi
        sayının vince hangisinin belgeye ait olduğu GÖZLE ayrılsın. Sekmeye
        taşımak, bir birim fiyatı düzeltip oranın etkisini görmek için her
        seferinde iki tık demekti — kırılımı ayrı sayfadan alan kararın (md. 8,
        18.08.2026) kendi gerekçesi.
      */}
      <section className="grid gap-3 rounded-lg border border-dashed p-3">
        <header className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">BELGE GENELİ</h2>
          <p className="min-w-0 flex-1 text-xs text-muted-foreground">
            Vince değil <span className="font-medium">bütün teklife</span> ait giderler; kalem
            değiştirdiğinizde bu iki blok değişmez.
          </p>
        </header>

        <Bolum
          katlama={katlama}
          katlamaAnahtari="bolum:genel"
          baslik="PROJE GENELİ"
          ton={costGroupHue(GENERAL_GROUP_KEY, "PROJE GENELİ")}
          aciklama="Tek bir vince atfedilemeyen götürü giderler: dokümantasyon, devreye alma, fabrika testleri, paketleme."
          sag={
            <span className="font-mono text-sm font-semibold">
              {fmtMoney0(costGroupTotal(payload.general), cur)}
            </span>
          }
        >
          <GrupBlogu
            group={payload.general}
            currency={cur}
            prices={prices}
            params={params}
            offer={offer}
            offerItemId={null}
            readOnly={readOnly}
            katlama={katlama}
            enBuyukTutar={enBuyukTutar}
            onChange={(next) => onChange({ ...payload, general: next })}
          />
        </Bolum>

        <Bolum
          katlama={katlama}
          katlamaAnahtari="bolum:oran"
          baslik="ORANLI MALİYETLER"
          ton={costRateHue("fixed", "ORANLI MALİYETLER")}
          aciklama="Sabit, sarf ve finansman giderleri DOĞRUDAN MALİYET (imalat + proje, bütün kalemler) üzerinden hesaplanır."
          sag={<span className="font-mono text-sm font-semibold">{fmtMoney0(totals.rateTotal, cur)}</span>}
        >
          <div className="grid gap-2.5">
            {payload.rates.map((r, i) => (
              <OranBlogu
                key={r.key}
                rate={r}
                base={totals.direct}
                currency={cur}
                prices={prices}
                params={params}
                offer={offer}
                readOnly={readOnly}
                enBuyukTutar={enBuyukTutar}
                onChange={(next) =>
                  onChange({ ...payload, rates: payload.rates.map((x, j) => (j === i ? next : x)) })
                }
              />
            ))}
          </div>
        </Bolum>
      </section>

      {/*
        TOPLAM MALİYET ŞERİDİ VE KIRILIM BURADAN KALKTI (kullanıcı isteği,
        22.08.2026, md. 8: *"Maliyetler sayfasında da altta toplam maliyet
        olmasın vinç vinç bakabileyim. Genele Özet sayfasından bakacağım."*).

        İkisi de BELGE düzeyindeydi ve bu sayfanın sorusu artık "bu vinç ne
        tutuyor". Genel bakış ÖZET bölümündedir; kırılım da oraya taşındı, yani
        kaybolmadı — yalnız ait olduğu sayfaya gitti.
      */}
    </div>
  );
}
