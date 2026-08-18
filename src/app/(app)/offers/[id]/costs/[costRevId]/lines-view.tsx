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

import { Eye, EyeOff, Plus, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CURRENCY_SYMBOLS, currencyOf, fmtMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { fmtCostField } from "@/lib/offers/cost/labels";
import type { CostModelResult } from "@/lib/offers/cost/model";
import { freeCostLine, lineQty, linePrice, withLumpMode } from "@/lib/offers/cost/payload";
import {
  COST_UNITS,
  FABRICATION_GROUP_KEY,
  MATERIAL_PRICE_DEFS,
  costLineDef,
  materialPriceDef,
  offerRefValue,
} from "@/lib/offers/cost/registry";
import { COST_RATE_MODES, costGroupLines, isLumpLine } from "@/lib/offers/cost/types";
import {
  costGroupTotal,
  costLineAmount,
  costRateAmount,
  costTotals,
} from "@/lib/offers/cost/totals";
import type { CostGroup, CostItem, CostLine, CostPayload, CostRateGroup } from "@/lib/offers/cost/types";
import type { OfferPayload } from "@/lib/offers/types";
import {
  BirimSecici,
  Bolum,
  KatlaDugmesi,
  MiniDugme,
  SayiKutusu,
  Turetme,
  type Katlama,
} from "./cost-parts";
import { KirilimSayfasi } from "./breakdown-view";

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
 * FİYAT BELGEDE YAŞAR (`payload.materialPrices`), global bir defterde değil:
 * sac bugün 0,80 €'ya çıktı diye geçen ayın maliyet çalışması başka bir rakam
 * göstermemelidir (MALIYET-6'nın gerekçesi).
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
  /** Satırı KİMLİĞİYLE değiştirir; `null` siler. Dizin KULLANILMAZ — görünen
      liste süzülmüştür ve dizinler tam listeninkiyle örtüşmez. */
  onLine: (id: string, next: CostLine | null) => void;
  onEkle: (() => void) | null;
}) {
  const simge = CURRENCY_SYMBOLS[currencyOf(currency)];

  return (
    <div className="grid gap-2">
      {/* KENDİ KAYDIRMA KABINI SARMA: `Table` zaten `.oc-scrollx overflow-x-auto`
          bir kap çiziyor (`components/ui/table.tsx`). İkinci bir sargı iç içe
          iki yatay kaydırıcı ve üst üste iki kenar gölgesi demekti; ayrıca
          `overflow-x` veren kap `overflow-y`yi de kaybeder ve tek piksellik
          bir taşmada gerçek bir dikey çubuk doğar (MOBIL-14). */}
      <Table containerClassName="[--oc-scroll-bg:var(--background)]">
          <TableHeader>
            <TableRow>
              {/* UZUNLUĞU VERİDEN GELEN SÜTUN KELEPÇELENİR ve kelepçe `th` ile
                  `td`de AYNIDIR (MOBIL-7): tablo düzeni `auto`dur ve tek bir
                  uzun kalem adı bütün tabloyu ekranın dışına iter. */}
              <TableHead className="min-w-[12rem] px-1.5 2xl:min-w-[18rem]">Kalem</TableHead>
              <TableHead className="hidden w-56 max-w-56 px-1.5 xl:table-cell">Teklifte</TableHead>
              <TableHead className="w-24 px-1.5">Miktar</TableHead>
              <TableHead className="w-24 px-1.5">Birim</TableHead>
              <TableHead className="w-28 px-1.5">Birim Fiyat</TableHead>
              <TableHead className="w-28 px-1.5 text-right">Tutar</TableHead>
              <TableHead className="w-[4.5rem] px-1.5" />
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
              return (
                <TableRow key={line.id} className={cn(line.hidden && "opacity-55")}>
                  <TableCell className="p-1.5">
                    <Input
                      value={line.label}
                      disabled={readOnly}
                      title={ipucu}
                      onChange={(e) => onLine(line.id, { ...line, label: e.target.value })}
                      aria-label="Kalem adı"
                      className="h-9 text-base pointer-fine:text-sm"
                    />
                  </TableCell>

                  {/* TEKLİFTEKİ KARŞILIK KENDİ SÜTUNUNDADIR (md. 8). Depolanmaz —
                      teklif değişirse bu sütun da değişir ve iki belge ayrışamaz
                      (TEKLIF-20'nin tek okuma noktası). */}
                  <TableCell className="hidden max-w-56 p-1.5 xl:table-cell">
                    <span
                      className="block truncate text-xs text-muted-foreground"
                      title={teklifte ?? undefined}
                    >
                      {teklifte ?? "—"}
                    </span>
                  </TableCell>

                  <TableCell className="p-1.5">
                    {modelden ? (
                      <div className="flex items-center gap-1">
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
                      <div className="flex items-center gap-1">
                        <SayiKutusu
                          value={line.qty}
                          disabled={readOnly}
                          aria-label="Miktar"
                          onChange={(v) => onLine(line.id, { ...line, qty: v })}
                          className="h-9 text-right font-mono"
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

                  <TableCell className="p-1.5">
                    <BirimSecici
                      value={line.unit}
                      units={COST_UNITS}
                      disabled={readOnly}
                      onChange={(v) => onLine(line.id, { ...line, unit: v })}
                      className="h-9"
                    />
                  </TableCell>

                  <TableCell className="p-1.5">
                    {seritten ? (
                      // ŞERİTTEN GELEN FİYAT SALT OKUNURDUR — miktarın model
                      // kutusuyla aynı desen. İKİ KAYNAK ASLA TOPLANMAZ: asa
                      // düğmesi bu satırı şeritten KOPARIR ve fiyatı insana
                      // bırakır (`linePrice`).
                      <div className="flex items-center gap-1">
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
                      <div className="flex items-center gap-1">
                        <SayiKutusu
                          value={line.unitPrice}
                          disabled={readOnly}
                          aria-label="Birim fiyat"
                          onChange={(v) => onLine(line.id, { ...line, unitPrice: v })}
                          className="h-9 text-right font-mono"
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

                  <TableCell className="p-1.5 text-right font-mono text-sm">
                    {fmtMoney(costLineAmount({ ...line, qty: miktar, unitPrice: fiyat }), currency)}
                  </TableCell>

                  <TableCell className="p-1.5">
                    <div className="flex items-center gap-0.5">
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
 * KALEM ARA TOPLAMI — "bu vinç bir adet kaç eder".
 *
 * Kullanıcı bildirimi (18.08.2026): *"Proje maliyetini hatalı topluyor. Alt
 * grupların toplamından farklı."* Aritmetik doğruydu, EKRAN yanıltıyordu:
 * başlıktaki tutar BELGENİN tamamıdır (bütün kalemler × adet + proje geneli),
 * gövdede ise yalnız SEÇİLİ kalemin grupları ve onlar da BİRİM fiyattır.
 * İki kalemli, ikincisi 2 adetlik bir belgede ölçüldü:
 *
 *     33.135 (kalem 1 × 1) + 23.590 × 2 (kalem 2) = 80.315 = başlıktaki sayı
 *     ekranda görünen gruplar ise 23.590 — yani "yanlış toplama" gibi okunuyor
 *
 * Ara toplam o boşluğu kapatır: kalemin birimi, adedi ve çarpımı yazılı durur,
 * böylece başlıktaki sayı gövdeden TÜRETİLEBİLİR olur.
 */
/** Başlıktaki tutar — BELGENİN tamamı; birden çok kalem varsa öyle yazar. */
function BelgeToplami({
  tutar,
  currency,
  coklu,
}: {
  tutar: number | null;
  currency: string;
  coklu: boolean;
}) {
  return (
    <div className="text-right">
      <div className="font-mono text-sm font-semibold">{fmtMoney(tutar, currency)}</div>
      {coklu ? (
        <div className="text-[11px] text-muted-foreground">bütün kalemler · adet dahil</div>
      ) : null}
    </div>
  );
}

function AraToplam({
  baslik,
  birim,
  adet,
  currency,
}: {
  baslik: string;
  birim: number | null;
  adet: number | null;
  currency: string;
}) {
  const katsayi = adet === null || !Number.isFinite(adet) ? 1 : adet;
  const paket = birim === null ? null : birim * katsayi;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed px-2.5 py-1.5">
      <span className="min-w-0 flex-1 truncate text-xs font-medium" title={baslik}>
        {baslik} — ARA TOPLAM
      </span>
      {katsayi !== 1 ? (
        <span className="font-mono text-[11px] text-muted-foreground">
          {fmtMoney(birim, currency)} × {fmtCostField(katsayi, 0)} adet
        </span>
      ) : null}
      <span className="font-mono text-sm font-semibold">{fmtMoney(paket, currency)}</span>
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

  return (
    <div className="grid gap-2 rounded-md border p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <KatlaDugmesi
          kapali={kapali}
          baslikMetni={group.title}
          onClick={() => katlama.degistir(group.id)}
        />
        <h3 className="flex-1 text-xs font-semibold tracking-wide">{group.title}</h3>
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
        <span className="w-32 text-right font-mono text-sm font-semibold">{fmtMoney(toplam, currency)}</span>
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
  onChange,
}: {
  rate: CostRateGroup;
  base: number | null;
  currency: string;
  prices: Record<string, number | null>;
  params: Record<string, number>;
  offer: OfferPayload;
  readOnly: boolean;
  onChange: (next: CostRateGroup) => void;
}) {
  const tutar = costRateAmount(rate, base);
  const setLine = (id: string, next: CostLine | null) =>
    onChange({
      ...rate,
      lines: next ? rate.lines.map((l) => (l.id === id ? next : l)) : rate.lines.filter((l) => l.id !== id),
    });

  return (
    <div className="grid gap-2 rounded-md border p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-semibold tracking-wide">{rate.title}</h3>
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
              kadarı · taban {fmtMoney(base, currency)}
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
          <span className="w-32 text-right font-mono text-sm font-semibold">{fmtMoney(tutar, currency)}</span>
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
  models,
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
  /** Kırılım BÜTÜN kalemleri toplar — seçili kalemin modeli yetmez. */
  models: Record<string, CostModelResult>;
  offer: OfferPayload;
  readOnly: boolean;
  onItemChange: (next: CostItem) => void;
  onChange: (next: CostPayload) => void;
}) {
  const cur = payload.currency;
  const prices = payload.materialPrices;
  const params = payload.params;
  const totals = costTotals(payload);

  // ARA TOPLAM YALNIZ GEREKTİĞİNDE ÇİZİLİR: tek kalemli ve tek adetli bir
  // belgede başlıktaki sayı zaten gövdenin toplamıdır ve ikinci bir satır
  // gürültü olurdu.
  const cokluKalem =
    payload.items.length > 1 ||
    payload.items.some((i) => (i.qty ?? 1) !== 1) ||
    (costGroupTotal(payload.general) ?? 0) !== 0;

  const kalemProjeBirimi = item
    ? item.groups
        .filter((g) => g.key !== FABRICATION_GROUP_KEY)
        .map((g) => costGroupTotal(g))
        .filter((n): n is number => n !== null)
        .reduce((t, n) => t + n, 0)
    : null;

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
        aciklama="Çelik imalat işçiliği — miktarı vincin fireli çelik ağırlığıdır, birim fiyatı hammadde şeridinden gelir."
        sag={<BelgeToplami tutar={totals.fabrication} currency={cur} coklu={cokluKalem} />}
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
                  onChange={(next) =>
                    onItemChange({ ...item, groups: item.groups.map((x, i) => (i === gi ? next : x)) })
                  }
                />
              ))}
            {cokluKalem ? (
              <AraToplam
                baslik={item.title || "Kalem"}
                birim={costGroupTotal(item.groups.find((g) => g.key === FABRICATION_GROUP_KEY))}
                adet={item.qty}
                currency={cur}
              />
            ) : null}
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
        aciklama="Kalem kalem girilen doğrudan maliyet. Miktarlar ağırlık ve hesap modelinden gelir; miktara tıklayınca nereden geldiği açılır."
        sag={<BelgeToplami tutar={totals.project} currency={cur} coklu={cokluKalem} />}
      >
        {item ? (
          <div className="grid gap-2.5">
            {item.groups
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
                  onChange={(next) =>
                    onItemChange({ ...item, groups: item.groups.map((x, i) => (i === gi ? next : x)) })
                  }
                />
              ))}
            {cokluKalem ? (
              <AraToplam
                baslik={item.title || "Kalem"}
                birim={kalemProjeBirimi}
                adet={item.qty}
                currency={cur}
              />
            ) : null}
          </div>
        ) : (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            Bu maliyet çalışmasında henüz kalem yok. Teklifte kalem açıp
            <span className="font-medium"> Tekliften Tazele</span> düğmesine basın.
          </p>
        )}

        {/* PROJE GENELİ kaleme değil BELGEYE aittir: üç vinçlik bir teklifte
            dokümantasyon bir kez yapılır. Kalem seçicisinin dışında durması
            bunun görünür hâlidir. */}
        <GrupBlogu
          group={payload.general}
          currency={cur}
          prices={prices}
          params={params}
          offer={offer}
          offerItemId={null}
          readOnly={readOnly}
          katlama={katlama}
          onChange={(next) => onChange({ ...payload, general: next })}
        />
      </Bolum>

      <Bolum
        katlama={katlama}
        katlamaAnahtari="bolum:oran"
        baslik="ORANLI MALİYETLER"
        aciklama="Sabit, sarf ve finansman giderleri DOĞRUDAN MALİYET (imalat + proje) üzerinden hesaplanır."
        sag={<span className="font-mono text-sm font-semibold">{fmtMoney(totals.rateTotal, cur)}</span>}
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
              onChange={(next) =>
                onChange({ ...payload, rates: payload.rates.map((x, j) => (j === i ? next : x)) })
              }
            />
          ))}
        </div>
      </Bolum>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
        <span className="text-sm font-semibold tracking-wide">TOPLAM MALİYET</span>
        <span className="ml-auto font-mono text-lg font-semibold">{fmtMoney(totals.total, cur)}</span>
      </div>

      {/* ——— KIRILIM: ayrı sekme değil, aynı sayfanın altı (md. 8) ——— */}
      <KirilimSayfasi payload={payload} models={models} offer={offer} katlama={katlama} />
    </div>
  );
}
