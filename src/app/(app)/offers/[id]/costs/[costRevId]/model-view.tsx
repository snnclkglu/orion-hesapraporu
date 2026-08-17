"use client";

// AĞIRLIKLAR VE HESAPLAR SAYFALARI.
//
// İKİSİ AYNI BİLEŞENDİR ve bu bilinçlidir: ikisi de aynı modelin çıktısını
// gösterir, aynı şekilde elle ezilir ve aynı şekilde asa düğmesiyle otomatiğe
// döner. İki ayrı bileşen yazılsaydı, birinde düzeltilen bir davranış ötekinde
// eksik kalırdı — ve "ezilen değer aşağıya akar" gibi bir kural yalnız bir
// sayfada çalışsaydı hata ancak maliyet tutmadığında fark edilirdi.
//
// EZİLEN DEĞER SOLGUN DEĞİL, İŞARETLİDİR: kutu dolu görünür ve yanında asa
// düğmesi belirir. Solgunlaştırmak "bu değer önemsiz" derdi; oysa elle girilen
// değer modelin önerdiğinden DAHA güvenilirdir (mühendis biliyordur).

import { Wand2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  CALC_SECTIONS,
  WEIGHT_SECTIONS,
  costFieldEditable,
  fmtCostField,
  type CostFieldSection,
} from "@/lib/offers/cost/labels";
import { CRANE_CLASSES, COST_PARAM_DEFS } from "@/lib/offers/cost/params";
import type { CostModelResult } from "@/lib/offers/cost/model";
import type { CostItem, CostPayload } from "@/lib/offers/cost/types";
import { Anahtar, Bolum, MiniDugme, SayiAlani, kutuMetni, sayiVeyaNull } from "./cost-parts";

// ————————————————————————————————————————————————————————— girdiler

/**
 * MÜHENDİSLİK GİRDİLERİ.
 *
 * Çoğu TEKLİFTEN OKUNUR (`inputsFromOfferItem`) ve "Tekliften Tazele"
 * düğmesiyle tazelenir; burada elle düzeltilebilirler. Düzeltilen değer bir
 * daha tekliften EZİLMEZ (tazeleme yalnız BOŞ alanı doldurur) — teklifte
 * "yaklaşık 20 m" yazan bir açıklığı burada 19,5 diye düzelten kullanıcı,
 * bir sonraki tazelemede onu geri almak zorunda kalmamalıdır.
 */
export function GirdiBolumu({
  item,
  onChange,
}: {
  item: CostItem;
  onChange: (next: CostItem) => void;
}) {
  const i = item.inputs;
  const set = (yama: Partial<typeof i>) => onChange({ ...item, inputs: { ...i, ...yama } });

  return (
    <Bolum
      baslik="GİRDİLER"
      aciklama="Kapasite, açıklık, yükseklik, hız ve sınıf teklifin teknik satırlarından okunur; burada düzeltilebilir."
    >
      <div className="flex flex-wrap gap-3">
        <SayiAlani etiket="Ana Kaldırma" birim="ton" value={i.capacityT} onChange={(v) => set({ capacityT: v })} />
        <SayiAlani etiket="Yardımcı Kaldırma" birim="ton" value={i.auxCapacityT} onChange={(v) => set({ auxCapacityT: v })} />
        <SayiAlani etiket="Açıklık" birim="m" value={i.spanM} onChange={(v) => set({ spanM: v })} />
        <SayiAlani etiket="Kaldırma Yüksekliği" birim="m" value={i.liftHeightM} onChange={(v) => set({ liftHeightM: v })} />
        <SayiAlani etiket="Kaldırma Hızı" birim="m/dk" value={i.liftSpeedMpm} onChange={(v) => set({ liftSpeedMpm: v })} />
        <SayiAlani etiket="Araba Hızı" birim="m/dk" value={i.trolleySpeedMpm} onChange={(v) => set({ trolleySpeedMpm: v })} />
        <SayiAlani etiket="Köprü / Portal Hızı" birim="m/dk" value={i.bridgeSpeedMpm} onChange={(v) => set({ bridgeSpeedMpm: v })} />
        <SayiAlani etiket="Ortam Sıcaklığı" birim="°C" value={i.ambientC} onChange={(v) => set({ ambientC: v ?? 40 })} />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid w-36 gap-1.5">
          <span className="text-xs">Vinç Sınıfı</span>
          <Select value={i.craneClass} onValueChange={(v) => set({ craneClass: v as typeof i.craneClass })}>
            <SelectTrigger className="h-9" aria-label="Vinç sınıfı">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CRANE_CLASSES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <SayiAlani etiket="Kiriş Adedi" value={i.girderCount} onChange={(v) => set({ girderCount: v ?? 2 })} genislik="7rem" />
        <SayiAlani etiket="Köprü Teker Adedi" value={i.bridgeWheelCount} onChange={(v) => set({ bridgeWheelCount: v ?? 4 })} genislik="9rem" />
        <SayiAlani etiket="Köprü Tahrik Adedi" value={i.bridgeDriveCount} onChange={(v) => set({ bridgeDriveCount: v ?? 2 })} genislik="9rem" />
        <SayiAlani etiket="Araba Tahrik Adedi" value={i.trolleyDriveCount} onChange={(v) => set({ trolleyDriveCount: v ?? 2 })} genislik="9rem" />
        <SayiAlani etiket="Portal Ayak Yüksekliği" birim="m" value={i.legHeightM} onChange={(v) => set({ legHeightM: v })} genislik="11rem" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Anahtar etiket="Portal (ayaklı)" value={i.gantry} onChange={(v) => set({ gantry: v })} />
        <Anahtar etiket="Operatör Kabini" value={i.cabin} onChange={(v) => set({ cabin: v })} />
        <Anahtar etiket="Hareketli Kabin" value={i.movingCabin} onChange={(v) => set({ movingCabin: v })} />
        <Anahtar etiket="Elektrik Odası" value={i.electricRoom} onChange={(v) => set({ electricRoom: v })} />
        <Anahtar etiket="Isı Kalkanı" value={i.heatShield} onChange={(v) => set({ heatShield: v })} />
      </div>
    </Bolum>
  );
}

// ————————————————————————————————————————————————— model değerleri

function ModelBolumu({
  section,
  item,
  model,
  readOnly,
  onChange,
}: {
  section: CostFieldSection;
  item: CostItem;
  model: CostModelResult | undefined;
  readOnly: boolean;
  onChange: (next: CostItem) => void;
}) {
  const dolu = section.fields.some((f) => (model?.values[f.key] ?? null) !== null);
  if (!dolu) return null;

  const ez = (key: string, v: number | null) => {
    const next = { ...item.overrides };
    if (v === null) delete next[key];
    else next[key] = v;
    onChange({ ...item, overrides: next });
  };

  return (
    <div className="grid gap-1">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">{section.title}</h3>
      <div className="rounded-md border">
        {section.fields.map((f) => {
          const deger = model?.values[f.key] ?? null;
          if (deger === null && item.overrides[f.key] === undefined) return null;
          const elle = item.overrides[f.key] !== undefined;
          const duzenlenebilir = costFieldEditable(f) && !readOnly;
          return (
            <div
              key={f.key}
              className={cn(
                "flex flex-wrap items-center gap-2 border-b px-3 py-1.5 last:border-b-0",
                f.sum && "bg-muted/40"
              )}
            >
              <div className="min-w-0 flex-1">
                <div className={cn("text-sm", f.sum && "font-semibold")}>{f.label}</div>
                {f.hint ? <div className="text-[11px] text-muted-foreground">{f.hint}</div> : null}
              </div>
              {/* DEĞER SAYFANIN İÇERİĞİDİR, bir ipucu değil.
                  Bir süre modelin sayısı kutunun `placeholder`ında duruyordu:
                  ekranda bütün ağırlıklar SOLUK GRİ görünüyor, sayfa "boş"
                  okunuyordu. Oysa o sayı tam olarak kullanılacak değerdir.
                  Şimdi düz metin basılır; asa düğmesi kutuyu AÇAR ve model
                  değerini içine yazar — maliyet satırındaki miktar kutusuyla
                  aynı desen. */}
              {elle && duzenlenebilir ? (
                <Input
                  value={kutuMetni(item.overrides[f.key])}
                  inputMode="decimal"
                  autoFocus
                  aria-label={`${f.label} — elle değer`}
                  onChange={(e) => ez(f.key, sayiVeyaNull(e.target.value))}
                  className="h-8 w-32 border-primary text-right font-mono text-base font-semibold pointer-fine:text-sm"
                />
              ) : (
                <span className="w-32 text-right font-mono text-sm tabular-nums">
                  {fmtCostField(deger, f.decimals)}
                </span>
              )}
              <span className="w-12 text-xs text-muted-foreground">{f.unit}</span>
              {duzenlenebilir ? (
                <MiniDugme
                  baslik={elle ? "Otomatiğe döndür" : "Elle gir"}
                  aktif={elle}
                  onClick={() => ez(f.key, elle ? null : (deger ?? 0))}
                >
                  <Wand2 className="size-3.5" />
                </MiniDugme>
              ) : (
                <span className="w-8" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ModelSayfasi({
  baslik,
  aciklama,
  sections,
  item,
  model,
  readOnly,
  onChange,
}: {
  baslik: string;
  aciklama: string;
  sections: readonly CostFieldSection[];
  item: CostItem;
  model: CostModelResult | undefined;
  readOnly: boolean;
  onChange: (next: CostItem) => void;
}) {
  const ezikSayisi = Object.keys(item.overrides).filter((k) =>
    sections.some((s) => s.fields.some((f) => f.key === k))
  ).length;

  return (
    <Bolum
      baslik={baslik}
      aciklama={aciklama}
      sag={
        ezikSayisi > 0 ? (
          <span className="rounded-md border border-primary px-2 py-1 text-xs font-medium">
            {ezikSayisi} değer elle girildi
          </span>
        ) : null
      }
    >
      {model?.eksik.length ? (
        <div className="rounded-md border border-dashed border-destructive/60 p-2 text-xs text-muted-foreground">
          {model.eksik.map((m) => (
            <p key={m}>{m}</p>
          ))}
        </div>
      ) : null}
      <div className="grid gap-4">
        {sections.map((s) => (
          <ModelBolumu
            key={s.key}
            section={s}
            item={item}
            model={model}
            readOnly={readOnly}
            onChange={onChange}
          />
        ))}
      </div>
      {model?.sectionName ? (
        <p className="text-xs text-muted-foreground">
          Seçilen kiriş kesiti: <span className="font-mono font-medium">{model.sectionName}</span>
          {model.deflectionOk === false ? (
            <span className="ml-2 font-semibold text-destructive">SEHİM ŞARTI SAĞLANMIYOR</span>
          ) : null}
          {model.camber ? <span className="ml-2">· Kamber verilecek</span> : null}
        </p>
      ) : null}
    </Bolum>
  );
}

export function AgirlikSayfasi(props: {
  item: CostItem;
  model: CostModelResult | undefined;
  readOnly: boolean;
  onChange: (next: CostItem) => void;
}) {
  return (
    <ModelSayfasi
      baslik="AĞIRLIKLAR"
      aciklama="Alt montaj ağırlıkları modelden türer. Bildiğiniz bir ağırlığı yazarsanız aşağıdaki bütün değerler ona göre yeniden hesaplanır."
      sections={WEIGHT_SECTIONS}
      {...props}
    />
  );
}

export function HesapSayfasi(props: {
  item: CostItem;
  model: CostModelResult | undefined;
  readOnly: boolean;
  onChange: (next: CostItem) => void;
}) {
  return (
    <ModelSayfasi
      baslik="HESAPLAR"
      aciklama="Mekanizma boyutlandırması: halat, tambur, moment, motor, teker ve kiriş kesiti. Bu bir TAHMİNDİR; hesap raporunun yerine geçmez."
      sections={CALC_SECTIONS}
      {...props}
    />
  );
}

// —————————————————————————————————————————————————————— katsayılar

/**
 * MODEL KATSAYILARI — belgeye aittir, koda değil.
 *
 * Açılışta koddaki varsayılanlardan kopyalanır ve o andan sonra BU maliyet
 * çalışmasının sayılarıdır. Devralınan çalışma kitabında her iş için kopya
 * alınıp katsayılar ayarlanıyordu ("ayaklar -%10", "başkiriş katsayısı iki
 * katına"); model bunu olduğu gibi taşır. Global bir defter olsaydı bugün
 * değiştirilen bir katsayı geçmiş bir maliyet çalışmasının rakamını da
 * değiştirirdi.
 */
export function KatsayiSayfasi({
  payload,
  readOnly,
  onChange,
}: {
  payload: CostPayload;
  readOnly: boolean;
  onChange: (next: CostPayload) => void;
}) {
  const gruplar = [...new Set(COST_PARAM_DEFS.map((d) => d.group))];
  const set = (key: string, v: number | null) =>
    onChange({
      ...payload,
      params: { ...payload.params, [key]: v ?? (COST_PARAM_DEFS.find((d) => d.key === key)?.value ?? 0) },
    });

  return (
    <Bolum
      baslik="MODEL KATSAYILARI"
      aciklama="Bu katsayılar yalnız BU maliyet çalışmasını etkiler. Sonradan değiştirilen bir varsayılan yayımlanmış bir maliyeti bozmaz."
    >
      <div className="grid gap-4">
        {gruplar.map((g) => (
          <div key={g} className="grid gap-1">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">{g}</h3>
            <div className="rounded-md border">
              {COST_PARAM_DEFS.filter((d) => d.group === g).map((d) => {
                const deger = payload.params[d.key] ?? d.value;
                const degisti = Math.abs(deger - d.value) > 1e-9;
                return (
                  <div
                    key={d.key}
                    className="flex flex-wrap items-center gap-2 border-b px-3 py-1.5 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm">{d.label}</div>
                      {d.hint ? <div className="text-[11px] text-muted-foreground">{d.hint}</div> : null}
                    </div>
                    <Input
                      value={kutuMetni(deger)}
                      inputMode="decimal"
                      disabled={readOnly}
                      aria-label={d.label}
                      onChange={(e) => set(d.key, sayiVeyaNull(e.target.value))}
                      className={cn(
                        "h-8 w-32 text-right font-mono text-base pointer-fine:text-sm",
                        degisti && "border-primary font-semibold"
                      )}
                    />
                    <span className="w-24 text-xs text-muted-foreground">{d.unit}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Bolum>
  );
}
