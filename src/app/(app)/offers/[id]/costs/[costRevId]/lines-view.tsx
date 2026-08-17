"use client";

// MALİYETLER SAYFASI — dört ana başlık.
//
// Kullanıcı tarifi (17.08.2026): *"maliyet kalemlerini Proje Maliyet, Sabit
// Maliyetler, Sarf Maliyetler, Finansman Maliyetleri olarak 4 ana başlıkta
// giriş yapacağım. Sarf Finansman ve Sabit Maliyetleri oransal olarak
// gireceğim."* Ekran o cümlenin şeklidir: üstte kalem kalem girilen proje
// maliyeti, altında oranla hesaplanan üç başlık, en altta toplam.
//
// SATIR = MİKTAR × BİRİM FİYAT. Miktar MODELDEN gelir ve kutusu salt okunur
// çizilir; "elle" düğmesi onu serbest bırakır. Birim fiyat HER ZAMAN elledir —
// fiyat aramalı bir tablo bu fazda bilerek yoktur (kullanıcı kararı).

import { Eye, EyeOff, Plus, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { fmtCostField, qtySourceLabel } from "@/lib/offers/cost/labels";
import type { CostModelResult } from "@/lib/offers/cost/model";
import { freeCostLine, lineQty } from "@/lib/offers/cost/payload";
import { offerRefValue } from "@/lib/offers/cost/registry";
import { COST_RATE_MODES } from "@/lib/offers/cost/types";
import { costGroupTotal, costLineAmount, costRateAmount, costTotals } from "@/lib/offers/cost/totals";
import type { CostGroup, CostItem, CostLine, CostPayload, CostRateGroup } from "@/lib/offers/cost/types";
import type { OfferPayload } from "@/lib/offers/types";
import { Bolum, MiniDugme, kutuMetni, sayiVeyaNull } from "./cost-parts";

function SatirTablosu({
  lines,
  groupKey,
  currency,
  model,
  offer,
  offerItemId,
  readOnly,
  onChange,
  onEkle,
}: {
  lines: CostLine[];
  /** Defterdeki grup anahtarı — teklif karşılığı ondan çözülür. */
  groupKey: string;
  currency: string;
  model?: CostModelResult;
  offer: OfferPayload;
  offerItemId: string | null;
  readOnly: boolean;
  onChange: (lines: CostLine[]) => void;
  onEkle: () => void;
}) {
  const set = (index: number, next: CostLine | null) =>
    onChange(next ? lines.map((l, i) => (i === index ? next : l)) : lines.filter((_, i) => i !== index));

  return (
    <div className="grid gap-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kalem</TableHead>
            <TableHead className="w-28">Miktar</TableHead>
            <TableHead className="w-20">Birim</TableHead>
            <TableHead className="w-28">Birim Fiyat</TableHead>
            <TableHead className="w-32 text-right">Tutar</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line, i) => {
            const miktar = lineQty(line, model);
            const modelden = !line.qtyManual && !!line.qtySource;
            const kaynak = qtySourceLabel(line.qtySource);
            const teklifte = offerRefValue(offer, offerItemId, groupKey, line.key);
            return (
              <TableRow key={line.id} className={cn(line.hidden && "opacity-55")}>
                <TableCell>
                  <Input
                    value={line.label}
                    onChange={(e) => set(i, { ...line, label: e.target.value })}
                    aria-label="Kalem adı"
                    className="h-9 text-base pointer-fine:text-sm"
                  />
                  {/* TEKLİFTEN GELEN SATIR: hangi ekipmanı fiyatladığın burada
                      yazar. Depolanmaz — teklif değişirse bu satır da değişir
                      ve iki belge ayrışamaz (TEKLIF-20'nin tek okuma noktası). */}
                  {teklifte ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Teklifte: {teklifte}</p>
                  ) : null}
                  {kaynak && modelden ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Miktar: {kaynak}</p>
                  ) : null}
                </TableCell>
                <TableCell>
                  {modelden ? (
                    <div className="flex items-center gap-1">
                      <span className="flex h-9 flex-1 items-center justify-end rounded-md border bg-muted/40 px-2 font-mono text-sm">
                        {fmtCostField(miktar, 0)}
                      </span>
                      <MiniDugme
                        baslik="Miktarı elle gir"
                        onClick={() => set(i, { ...line, qtyManual: true, qty: miktar })}
                      >
                        <Wand2 className="size-3.5" />
                      </MiniDugme>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Input
                        value={kutuMetni(line.qty)}
                        inputMode="decimal"
                        aria-label="Miktar"
                        onChange={(e) => set(i, { ...line, qty: sayiVeyaNull(e.target.value) })}
                        className="h-9 text-right font-mono text-base pointer-fine:text-sm"
                      />
                      {line.qtySource ? (
                        <MiniDugme
                          baslik="Modele döndür"
                          aktif
                          onClick={() => set(i, { ...line, qtyManual: false })}
                        >
                          <Wand2 className="size-3.5" />
                        </MiniDugme>
                      ) : null}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Input
                    value={line.unit}
                    onChange={(e) => set(i, { ...line, unit: e.target.value })}
                    aria-label="Birim"
                    className="h-9 text-base pointer-fine:text-sm"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={kutuMetni(line.unitPrice)}
                    inputMode="decimal"
                    aria-label="Birim fiyat"
                    onChange={(e) => set(i, { ...line, unitPrice: sayiVeyaNull(e.target.value) })}
                    className="h-9 text-right font-mono text-base pointer-fine:text-sm"
                  />
                </TableCell>
                <TableCell className="text-right font-mono">
                  {fmtMoney(costLineAmount({ ...line, qty: miktar }), currency)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <MiniDugme
                      baslik={line.hidden ? "Toplama katılmıyor" : "Toplamdan çıkar"}
                      aktif={line.hidden === true}
                      onClick={() => set(i, { ...line, hidden: !line.hidden })}
                    >
                      {line.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </MiniDugme>
                    <MiniDugme baslik="Satırı sil" onClick={() => set(i, null)}>
                      <Trash2 className="size-3.5" />
                    </MiniDugme>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {readOnly ? null : (
        <Button type="button" variant="outline" size="sm" className="oc-tap justify-self-start" onClick={onEkle}>
          <Plus className="size-3.5" /> Satır Ekle
        </Button>
      )}
    </div>
  );
}

function GrupBlogu({
  group,
  currency,
  model,
  offer,
  offerItemId,
  readOnly,
  onChange,
}: {
  group: CostGroup;
  currency: string;
  model?: CostModelResult;
  offer: OfferPayload;
  offerItemId: string | null;
  readOnly: boolean;
  onChange: (next: CostGroup) => void;
}) {
  // Grup toplamı MODEL MİKTARLARIYLA hesaplanır: kaydetmeden önce satırlarda
  // henüz yazılı olmayabilirler (`withModelQuantities` kaydetme yolunda çalışır)
  // ve ekranın belgeden farklı bir sayı göstermesi kabul edilemez.
  const miktarli = { ...group, lines: group.lines.map((l) => ({ ...l, qty: lineQty(l, model) })) };
  const toplam = costGroupTotal(miktarli);

  return (
    <div className="grid gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex-1 text-xs font-semibold tracking-wide">{group.title}</h3>
        <span className="font-mono text-sm font-semibold">{fmtMoney(toplam, currency)}</span>
      </div>
      <SatirTablosu
        lines={group.lines}
        groupKey={group.key}
        currency={currency}
        model={model}
        offer={offer}
        offerItemId={offerItemId}
        readOnly={readOnly}
        onChange={(lines) => onChange({ ...group, lines })}
        onEkle={() => onChange({ ...group, lines: [...group.lines, freeCostLine()] })}
      />
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
  offer,
  readOnly,
  onChange,
}: {
  rate: CostRateGroup;
  base: number | null;
  currency: string;
  offer: OfferPayload;
  readOnly: boolean;
  onChange: (next: CostRateGroup) => void;
}) {
  const tutar = costRateAmount(rate, base);
  return (
    <div className="grid gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-semibold tracking-wide">{rate.title}</h3>
        <div className="ml-auto flex items-center gap-2">
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

      {rate.mode === "oran" ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Proje maliyetinin</span>
          <div className="flex items-center gap-1">
            <span className="text-sm">%</span>
            <Input
              value={kutuMetni(rate.percent)}
              inputMode="decimal"
              disabled={readOnly}
              aria-label={`${rate.title} oranı`}
              onChange={(e) => onChange({ ...rate, percent: sayiVeyaNull(e.target.value) })}
              className="h-9 w-24 text-right font-mono text-base pointer-fine:text-sm"
            />
          </div>
          <span className="text-sm text-muted-foreground">
            kadarı · taban {fmtMoney(base, currency)}
          </span>
        </div>
      ) : (
        <SatirTablosu
          lines={rate.lines}
          groupKey={rate.key}
          currency={currency}
          offer={offer}
          offerItemId={null}
          readOnly={readOnly}
          onChange={(lines) => onChange({ ...rate, lines })}
          onEkle={() => onChange({ ...rate, lines: [...rate.lines, freeCostLine()] })}
        />
      )}
    </div>
  );
}

export function MaliyetSayfasi({
  payload,
  item,
  model,
  offer,
  readOnly,
  onItemChange,
  onChange,
}: {
  payload: CostPayload;
  item: CostItem | undefined;
  model: CostModelResult | undefined;
  offer: OfferPayload;
  readOnly: boolean;
  onItemChange: (next: CostItem) => void;
  onChange: (next: CostPayload) => void;
}) {
  const cur = payload.currency;
  const totals = costTotals(payload);

  return (
    <div className="grid gap-4">
      <Bolum
        baslik="PROJE MALİYETİ"
        aciklama="Kalem kalem girilen doğrudan maliyet. Miktarlar ağırlık ve hesap modelinden gelir; birim fiyatı siz yazarsınız."
        sag={<span className="font-mono text-sm font-semibold">{fmtMoney(totals.direct, cur)}</span>}
      >
        {item ? (
          <div className="grid gap-3">
            {item.groups.map((g, gi) => (
              <GrupBlogu
                key={g.id}
                group={g}
                currency={cur}
                model={model}
                offer={offer}
                offerItemId={item.offerItemId}
                readOnly={readOnly}
                onChange={(next) =>
                  onItemChange({ ...item, groups: item.groups.map((x, i) => (i === gi ? next : x)) })
                }
              />
            ))}
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
          offer={offer}
          offerItemId={null}
          readOnly={readOnly}
          onChange={(next) => onChange({ ...payload, general: next })}
        />
      </Bolum>

      <Bolum
        baslik="ORANLI MALİYETLER"
        aciklama="Sabit, sarf ve finansman giderleri PROJE MALİYETİ üzerinden hesaplanır; toplam = proje × (1 + oranların toplamı)."
        sag={<span className="font-mono text-sm font-semibold">{fmtMoney(totals.rateTotal, cur)}</span>}
      >
        <div className="grid gap-3">
          {payload.rates.map((r, i) => (
            <OranBlogu
              key={r.key}
              rate={r}
              base={totals.direct}
              currency={cur}
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
    </div>
  );
}
