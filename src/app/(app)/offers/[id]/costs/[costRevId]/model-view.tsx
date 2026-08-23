"use client";

// AĞIRLIKLAR VE HESAPLAR SAYFALARI.
//
// İKİSİ AYNI BİLEŞENDİR ve bu bilinçlidir: ikisi de aynı modelin çıktısını
// gösterir, aynı şekilde elle ezilir ve aynı şekilde asa düğmesiyle otomatiğe
// döner. İki ayrı bileşen yazılsaydı, birinde düzeltilen bir davranış ötekinde
// eksik kalırdı — ve "ezilen değer aşağıya akar" gibi bir kural yalnız bir
// sayfada çalışsaydı hata ancak maliyet tutmadığında fark edilirdi.
//
// SAYFA İKİ SÜTUNDUR (kullanıcı isteği 18.08.2026, md. 1: *"Hesaplar sayfasını
// yatayda ikiye böl. Sayfa gereksiz geniş yer kaplıyor."*). Izgara değil
// SÜTUN akışı (`xl:columns-2`) kullanılır: bölümlerin alan sayısı 2 ile 13
// arasında değişir ve iki sütunlu bir ızgarada kısa bölümün yanında dev bir
// boşluk kalırdı. Sütun akışı bölümleri yüksekliğe göre dengeler; her bölüm
// `break-inside-avoid` taşır ki bir bölüm ortasından ikiye BÖLÜNMESİN.
//
// SATIRIN İKİ TIKLAMA HEDEFİ VARDIR VE AYRI ŞEYLER YAPAR:
//   · ADA tıklamak "bu sayı NEREDEN geliyor" der (formül, ara değerler,
//     katsayılar — `Turetme`).
//   · SAYIYA tıklamak onu DÜZENLER (kullanıcı isteği md. 3: *"dinamik bir
//     şekilde hızlıca düzenlenen bir yapı"*).
// Tek hedef olsaydı ikisinden biri bir menünün arkasına düşerdi.
//
// EZİLEN DEĞER SOLGUN DEĞİL, İŞARETLİDİR: kutu dolu görünür ve yanında asa
// düğmesi belirir. Solgunlaştırmak "bu değer önemsiz" derdi; oysa elle girilen
// değer modelin önerdiğinden DAHA güvenilirdir (mühendis biliyordur).

import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Wand2 } from "lucide-react";
import { SayiKutusu } from "@/components/sayi-kutusu";
import { cn } from "@/lib/utils";
import {
  AGIRLIK_OZET_KEY,
  CALC_SECTIONS,
  WEIGHT_SECTIONS,
  costFieldEditable,
  costFieldText,
  fmtCostField,
  type CostFieldDef,
  type CostFieldSection,
} from "@/lib/offers/cost/labels";
import { RAILS } from "@/lib/calc/tables";
import { costCompareRows, costDeviationLevel, type CostCompareRow } from "@/lib/offers/cost/compare";
import { costAmountLevel, costAmountWeight, costLargestAmount } from "@/lib/offers/cost/heat";
import { CRANE_CLASSES, COST_PARAM_DEFS } from "@/lib/offers/cost/params";
import type { CostModelResult } from "@/lib/offers/cost/model";
import type { CostItem, CostPayload } from "@/lib/offers/cost/types";
import type { OfferItem, OfferPayload } from "@/lib/offers/types";
import {
  ALAN_IZGARASI,
  Anahtar,
  Bolum,
  KesitDugmesi,
  MiniDugme,
  SapmaRozeti,
  SayiAlani,
  SayiSecici,
  SecimAlani,
  Turetme,
} from "./cost-parts";
import { teklifleEsitle, type GirdiFarki } from "./input-sync";

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
  offerItem,
  onChange,
}: {
  item: CostItem;
  /** Bu maliyet kaleminin TEKLİFTEKİ karşılığı — eşitleme onu okur. */
  offerItem: OfferItem | undefined;
  onChange: (next: CostItem) => void;
}) {
  const i = item.inputs;
  const set = (yama: Partial<typeof i>) => onChange({ ...item, inputs: { ...i, ...yama } });

  // BEKLEYEN EŞİTLEME — uygulanmadan ÖNCE gösterilir.
  const [bekleyen, setBekleyen] = useState<GirdiFarki[] | null>(null);

  /**
   * TEKLİFLE EŞİTLEME İKİ ADIMDIR: önce SÖYLER, sonra uygular.
   *
   * Kullanıcı isteği (19.08.2026, md. 6): *"Teklifteki açıklık tonaj vs
   * değişebilir… Buna göre hem Ağırlıklar hem Hesaplar değişse iyi olur."*
   *
   * EKSİK OLAN "HESAP" DEĞİL EŞİTLEMEDİR: ağırlıklar ve hesaplar zaten her tuş
   * vuruşunda yeniden koşuyor (`cost-editor.tsx`in `costModels` useMemo'su).
   * Geride kalan tek şey GİRDİLERDİR — "Tekliften Tazele" yalnız BOŞ alanı
   * doldurur ve dolu olanı bilerek ezmez (MALIYET-9). O kural teklifteki
   * açıklık gerçekten değiştiğinde ters yönde ısırır; bu düğme onu AÇIK bir
   * eyleme çevirir.
   *
   * ONAY EKRANI SÜS DEĞİL: girdiyi ezmek, mühendisin elle düzelttiği bir
   * ölçüyü silmektir. Neyin neye döneceği ("Açıklık 30 → 28") önce yazılır;
   * "elle girilen değerler kaybolmamalı" isteğinin karşılığı budur.
   */
  function esitle() {
    if (!offerItem) return;
    const sonuc = teklifleEsitle(i, offerItem);
    if (sonuc.farklar.length === 0) {
      toast.info("Girdiler teklifle zaten aynı.");
      return;
    }
    setBekleyen(sonuc.farklar);
  }

  function uygula() {
    if (!offerItem) return;
    const sonuc = teklifleEsitle(i, offerItem);
    onChange({ ...item, inputs: sonuc.inputs });
    setBekleyen(null);
    toast.success(`${sonuc.farklar.length} girdi teklifle eşitlendi; ağırlıklar ve hesaplar yenilendi.`);
  }

  return (
    <Bolum
      baslik="GİRDİLER"
      aciklama="Kapasite, açıklık, yükseklik, hız ve sınıf teklifin teknik satırlarından okunur; burada düzeltilebilir."
      sag={
        offerItem ? (
          <button
            type="button"
            onClick={esitle}
            className="oc-tap inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted"
            title="Girdileri teklif belgesindeki ölçülerle eşitle ve yeniden hesapla"
          >
            <RefreshCw className="size-3.5" /> Teklifle Eşitle
          </button>
        ) : null
      }
    >
      {/* FARKLAR ÖNCE OKUNUR: uygulanmış bir ezme geri alınamaz. */}
      {bekleyen ? (
        <div className="grid gap-2 rounded-md border border-dashed border-primary p-3 text-sm">
          <p className="font-medium">Teklife göre {bekleyen.length} girdi değişecek:</p>
          <ul className="grid gap-0.5 text-xs">
            {bekleyen.map((f) => (
              <li key={String(f.key)} className="flex flex-wrap items-baseline gap-1.5">
                <span className="text-muted-foreground">
                  {f.etiket}
                  {f.birim ? ` [${f.birim}]` : ""}
                </span>
                <span className="font-mono tabular-nums">{f.eski}</span>
                <span aria-hidden className="text-muted-foreground">→</span>
                <span className="font-mono font-semibold tabular-nums">{f.yeni}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Model çıktısında elle ezdiğiniz değerler (ana kiriş ağırlığı, seçilen motor…)
            korunur; yalnız yukarıdaki girdiler değişir.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={uygula}
              className="oc-tap rounded-md border border-primary bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
            >
              Uygula ve Hesapla
            </button>
            <button
              type="button"
              onClick={() => setBekleyen(null)}
              className="oc-tap rounded-md border px-3 py-1 text-xs font-medium hover:bg-muted"
            >
              Vazgeç
            </button>
          </div>
        </div>
      ) : null}

      {/* IZGARA, ESNEK SARMA DEĞİL (kullanıcı bildirimi 19.08.2026, md. 7:
          kutular hizasız). `flex-wrap`ta her kutunun genişliği elle veriliyordu
          ("6.5rem", "9rem", "10rem") ve satır sonunda artan yer son kutuya
          düşüyordu: ilk satırda sekiz, ikincisinde altı alan vardı ve hiçbir
          sütun alt satırdakiyle hizalanmıyordu. `ALAN_IZGARASI` sütun sayısını
          pencereye göre seçer, BİR SATIRDAKİ BÜTÜN KUTULAR AYNI GENİŞLİKTEDİR
          ve `grid-rows-subgrid` etiket ile kutuyu iki ayrı raya oturtur —
          etiket iki satıra sarsa bile kutular aynı hizada kalır. */}
      <div className={ALAN_IZGARASI}>
        <SayiAlani etiket="Ana Kaldırma" birim="ton" value={i.capacityT} onChange={(v) => set({ capacityT: v })} />
        <SayiAlani etiket="Yardımcı Kaldırma" birim="ton" value={i.auxCapacityT} onChange={(v) => set({ auxCapacityT: v })} />
        <SayiAlani etiket="Açıklık" birim="m" value={i.spanM} onChange={(v) => set({ spanM: v })} />
        <SayiAlani etiket="Kaldırma Yüksekliği" birim="m" value={i.liftHeightM} onChange={(v) => set({ liftHeightM: v })} />
        <SayiAlani etiket="Kaldırma Hızı" birim="m/dk" value={i.liftSpeedMpm} onChange={(v) => set({ liftSpeedMpm: v })} />
        <SayiAlani etiket="Araba Hızı" birim="m/dk" value={i.trolleySpeedMpm} onChange={(v) => set({ trolleySpeedMpm: v })} />
        <SayiAlani etiket="Köprü / Portal Hızı" birim="m/dk" value={i.bridgeSpeedMpm} onChange={(v) => set({ bridgeSpeedMpm: v })} />
        <SayiAlani etiket="Ortam Sıcaklığı" birim="°C" value={i.ambientC} onChange={(v) => set({ ambientC: v ?? 40 })} />
        {/* SEÇİCİ DE IZGARANIN HÜCRESİDİR: kendi `grid w-24`i ile çizilseydi
            24 rem'lik sabit genişliği ızgaranın sütununa uymaz ve etiketi
            komşularının etiketiyle aynı raya oturmazdı. */}
        <SecimAlani
          etiket="Vinç Sınıfı"
          value={i.craneClass}
          secenekler={CRANE_CLASSES}
          onChange={(v) => set({ craneClass: v as typeof i.craneClass })}
        />
        <SayiAlani etiket="Kiriş Adedi" value={i.girderCount} onChange={(v) => set({ girderCount: v ?? 2 })} />
        <SayiAlani etiket="Köprü Teker Adedi" value={i.bridgeWheelCount} onChange={(v) => set({ bridgeWheelCount: v ?? 4 })} />
        <SayiAlani etiket="Köprü Tahrik Adedi" value={i.bridgeDriveCount} onChange={(v) => set({ bridgeDriveCount: v ?? 2 })} />
        <SayiAlani etiket="Araba Tahrik Adedi" value={i.trolleyDriveCount} onChange={(v) => set({ trolleyDriveCount: v ?? 2 })} />
        <SayiAlani etiket="Portal Ayak Yüksekliği" birim="m" value={i.legHeightM} onChange={(v) => set({ legHeightM: v })} />
        {/* RAY KODU HIZLI TEKER SEÇİMİNİN TEK YENİ GİRDİSİDİR (md. 12).
            Teklifin köprü rayı satırından okunur ve boş kalabilir — teklifteki
            yazım tanınmazsa uydurulmaz, listeden seçilir. Araba rayı açılışta
            aynısıdır ve farklıysa burada değiştirilir. */}
        <SecimAlani
          etiket="Köprü / Portal Rayı"
          value={i.bridgeRailCode || RAY_YOK}
          secenekler={RAY_SECENEKLERI}
          onChange={(v) => set({ bridgeRailCode: v === RAY_YOK ? "" : v })}
        />
        <SecimAlani
          etiket="Araba Rayı"
          value={i.trolleyRailCode || RAY_YOK}
          secenekler={RAY_SECENEKLERI}
          onChange={(v) => set({ trolleyRailCode: v === RAY_YOK ? "" : v })}
        />
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

// —————————————————————————————————————————————————— karşılaştırma

/**
 * TEKLİFTE İSTENEN ↔ HESAPLANAN ŞERİDİ.
 *
 * Kullanıcı isteği (18.08.2026, md. 2): *"Hesaplar sayfasının en üstüne çok
 * kısa yan yana vinç özellikleri gelsin. Teklifte istenen hızlar, teker
 * çapları, tonaj, motor güçleri vb. Bunların hemen yanına hesaplananlar ve
 * sapma kısaca yazsın. Sapma çoksa kırmızı, değer yakınsa yeşil."*
 *
 * ÇİP DEĞİL IZGARA: on iki satırın sarmalayan bir çip şeridinde sırası
 * pencere genişliğine göre değişirdi ve "kaldırma hızı nerede" diye her
 * seferinde aranırdı. Izgarada sıra sabittir (künye → hızlar → motorlar →
 * tekerler → donanım) ve göz aynı yerde bulur.
 *
 * SAPMASI OLMAYAN SATIR DA GÖSTERİLİR: teklifte yazmayan ama hesaplanan bir
 * motor gücü, tam da teklife yazılması gereken sayıdır. Rozet orada çıkmaz —
 * karşılaştıracak bir taraf yoktur — ama değer görünür.
 */
function OzellikCipi({ row }: { row: CostCompareRow }) {
  const hesap = row.calculated === null ? "—" : fmtCostField(row.calculated, row.decimals);
  return (
    <div className="flex items-baseline gap-1.5 rounded-md border px-2 py-1">
      <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground" title={row.label}>
        {row.label}
      </span>
      <span className="shrink-0 font-mono text-[11px] text-muted-foreground" title="Teklifte istenen">
        {row.requestedText ?? "—"}
      </span>
      <span aria-hidden className="shrink-0 text-[11px] text-muted-foreground">
        →
      </span>
      <span className="shrink-0 font-mono text-xs font-semibold tabular-nums" title="Hesaplanan">
        {row.prefix && hesap !== "—" ? `${row.prefix} ` : ""}
        {hesap}
      </span>
      <span className="shrink-0 text-[11px] text-muted-foreground">{row.unit}</span>
      <SapmaRozeti deviation={row.deviation} />
    </div>
  );
}

export function OzellikSeridi({
  offer,
  item,
  model,
}: {
  offer: OfferPayload;
  item: CostItem;
  model: CostModelResult | undefined;
}) {
  const rows = costCompareRows(offer, item.offerItemId, item.inputs, model);
  if (rows.length === 0) return null;
  // EŞİK TEK YERDEDİR (`COST_DEVIATION_LIMIT`). Başlıktaki sayaç eşiği elle
  // kopyalasaydı, eşik değiştiğinde "3 değer sapıyor" yazan bir başlığın
  // altında üç yeşil rozet durabilirdi.
  const sapan = rows.filter((r) => costDeviationLevel(r.deviation) === "sapma").length;

  return (
    <Bolum
      baslik="TEKLİFTE İSTENEN ↔ HESAPLANAN"
      aciklama="Solda teklif belgesinde yazan, sağda modelin çıkardığı değer. Rozet ikisinin farkıdır."
      sag={
        sapan > 0 ? (
          <span className="rounded-md border border-destructive/50 px-2 py-1 text-xs font-medium text-destructive">
            {sapan} değer sapıyor
          </span>
        ) : (
          <span className="rounded-md border border-success/40 px-2 py-1 text-xs font-medium text-success">
            Teklifle uyumlu
          </span>
        )
      }
    >
      <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {rows.map((r) => (
          <OzellikCipi key={r.key} row={r} />
        ))}
      </div>
    </Bolum>
  );
}

// ————————————————————————————————————————————————— model değerleri

/**
 * BİR MODEL SATIRI — ad + formül · değer · birim · asa.
 *
 * FORMÜL ADIN YANINDADIR, ALTINDA DEĞİL (kullanıcı isteği md. 1: *"her hesabın
 * satırına formülünü Hesap adının yanına kısaca yaz"*). Altına yazmak satır
 * yüksekliğini iki katına çıkarır ve iki sütunlu düzenin kazandırdığı yeri
 * geri alırdı. İkisi de kırpılır (`truncate`); tam metin `title`da ve adın
 * pop-up'ındadır.
 */
function ModelSatiri({
  f,
  item,
  model,
  params,
  readOnly,
  isiTabani,
  onEz,
}: {
  f: CostFieldDef;
  item: CostItem;
  model: CostModelResult | undefined;
  params: Record<string, number>;
  readOnly: boolean;
  /** Ağırlık ısısının tabanı — verilmezse satır renksizdir (bkz. `AGIRLIK_ISISI`). */
  isiTabani?: number;
  onEz: (key: string, v: number | null) => void;
}) {
  const deger = model?.values[f.key] ?? null;
  const elle = item.overrides[f.key] !== undefined;
  // AĞIRLIK ISISI (kullanıcı isteği 23.08.2026, md. 3) — tutar ısısının
  // (MALIYET-44) aynı rampası, aynı sözleşmesi: veri yalnız SEVİYE taşır
  // (`--oc-level`), ton/doygunluk/parlaklık `.oc-amount`ta ve tema başına.
  // YALNIZ KİLOGRAM ALANLARINDA: bir sehim milimetresinin ya da bir devir
  // sayısının "büyüklüğü" para gibi okunmaz, ölçek anlamsız olurdu.
  const isi =
    isiTabani === undefined || f.unit !== "kg" ? null : costAmountLevel(deger, isiTabani);
  const isiStili =
    isi === null
      ? undefined
      : ({ "--oc-level": `${isi}` } as React.CSSProperties);
  // RENK TEK TAŞIYICI DEĞİLDİR (WCAG 1.4.1): aynı büyüklük yazının
  // KALINLIĞIYLA da verilir — siyah beyaz bir çıktıda da okunur.
  const isiSinifi = isi === null ? "" : cn("oc-amount", costAmountWeight(isi));
  const duzenlenebilir = costFieldEditable(f) && !readOnly;
  // KATALOG BOYU HER ZAMAN AÇIK BİR SEÇİCİDİR (md. 1 ve 5): halat donanımı,
  // tambur çapı, teker çapı, motor ve sürücü listeden seçilir ve seçim
  // modelin ÜSTÜNE yazılır. Asa düğmesi burada "elle gir" değil "otomatiğe
  // dön" demektir — değer zaten görünür ve zaten değiştirilebilirdir.
  const secici = duzenlenebilir && f.choices !== undefined && f.choices.length > 0;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 border-b px-2 py-1 last:border-b-0",
        f.sum && "bg-muted/40"
      )}
    >
      <Turetme fieldKey={f.key} model={model} params={params} baslik={f.label} align="start">
        <button
          type="button"
          title={f.formula ? `${f.label} = ${f.formula}` : f.label}
          className="oc-tap flex min-w-0 flex-1 items-baseline gap-1.5 rounded-sm text-left hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {/* AD ÖNCELİKLİDİR: `shrink-0` ile kendi boyunu korur, formül kalan
              yere sığar ve gerekirse kırpılır. İkisi de kırpılabilir olsaydı
              dar bir pencerede satırın ADI da yarım kalırdı — oysa formül
              zaten `title`da ve pop-up'ta tam hâliyle durur. `max-w-[60%]`
              tersini engeller: çok uzun bir ad formülü sıfıra indirmesin. */}
          <span
            className={cn(
              "max-w-[60%] shrink-0 truncate text-sm",
              f.sum && "font-semibold"
            )}
          >
            {f.label}
          </span>
          {f.formula ? (
            <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
              = {f.formula}
            </span>
          ) : null}
        </button>
      </Turetme>

      {secici ? (
        <SayiSecici
          value={elle ? item.overrides[f.key] : deger}
          choices={f.choices ?? []}
          decimals={f.decimals}
          prefix={f.prefix}
          etiket={f.label}
          onChange={(v) => onEz(f.key, v)}
          className={cn("w-28", !elle && "border-input font-normal")}
        />
      ) : elle && duzenlenebilir ? (
        <SayiKutusu
          value={item.overrides[f.key] ?? null}
          autoFocus
          aria-label={`${f.label} — elle değer`}
          onChange={(v) => onEz(f.key, v)}
          className="h-8 w-28 border-primary text-right font-mono font-semibold"
        />
      ) : duzenlenebilir ? (
        // SAYIYA TIKLAMAK ONU DÜZENLER (md. 3: "hızlıca düzenlenen bir yapı").
        // Asa düğmesi de aynı işi yapar ve KALIR: dokunmatikte 28px'lik bir
        // sayı hedefi güvenilir değildir, ayrıca düğme "bu alan düzenlenebilir"
        // bilgisini bakışta verir.
        <button
          type="button"
          title="Elle gir"
          onClick={() => onEz(f.key, deger ?? 0)}
          style={isiStili}
          className={cn(
            "oc-tap h-8 w-28 rounded-md border border-transparent px-2 text-right font-mono text-sm tabular-nums transition-colors hover:border-input hover:bg-muted",
            isiSinifi
          )}
        >
          {costFieldText(f, deger)}
        </button>
      ) : (
        <span
          style={isiStili}
          className={cn("w-28 px-2 text-right font-mono text-sm tabular-nums", isiSinifi)}
        >
          {costFieldText(f, deger)}
        </span>
      )}

      <span className="w-9 shrink-0 truncate text-[11px] text-muted-foreground">{f.unit}</span>

      {duzenlenebilir ? (
        <MiniDugme
          baslik={elle ? "Otomatiğe döndür" : "Elle gir"}
          aktif={elle}
          disabled={!elle && secici}
          onClick={() => onEz(f.key, elle ? null : (deger ?? 0))}
        >
          <Wand2 className="size-3.5" />
        </MiniDugme>
      ) : (
        <span className="w-8" />
      )}
    </div>
  );
}

function ModelBolumu({
  section,
  item,
  model,
  params,
  readOnly,
  isiTabani,
  onChange,
  altSatir,
}: {
  section: CostFieldSection;
  item: CostItem;
  model: CostModelResult | undefined;
  params: Record<string, number>;
  readOnly: boolean;
  /** Ağırlık ısısının tabanı — yalnız Ağırlıklar sayfası verir. */
  isiTabani?: number;
  onChange: (next: CostItem) => void;
  /** Bölümün sonuna eklenen serbest satır — kiriş kesidi gibi sayı OLMAYAN değerler. */
  altSatir?: React.ReactNode;
}) {
  const dolu = section.fields.some((f) => (model?.values[f.key] ?? null) !== null);
  if (!dolu && !altSatir) return null;

  const ez = (key: string, v: number | null) => {
    const next = { ...item.overrides };
    if (v === null) delete next[key];
    else next[key] = v;
    onChange({ ...item, overrides: next });
  };

  return (
    <div className="mb-4 grid break-inside-avoid gap-1 last:mb-0">
      {/* BAŞLIK BOŞSA ÇİZİLMEZ: özet kartı başlığını sarmalayan `Bolum`dan
          alır ve aynı metni iki kez basmak kartı iki başlıklı gösterirdi. */}
      {section.title ? (
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">{section.title}</h3>
      ) : null}
      <div className="rounded-md border">
        {section.fields.map((f) => {
          const deger = model?.values[f.key] ?? null;
          if (deger === null && item.overrides[f.key] === undefined) return null;
          return (
            <ModelSatiri
              key={f.key}
              f={f}
              item={item}
              model={model}
              params={params}
              readOnly={readOnly}
              isiTabani={isiTabani}
              onEz={ez}
            />
          );
        })}
        {altSatir}
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
  params,
  readOnly,
  isiTabani,
  onChange,
}: {
  baslik: string;
  aciklama: string;
  sections: readonly CostFieldSection[];
  item: CostItem;
  model: CostModelResult | undefined;
  params: Record<string, number>;
  readOnly: boolean;
  /** Ağırlık ısısının tabanı — yalnız Ağırlıklar sayfası verir (md. 3). */
  isiTabani?: number;
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

      {/* İKİ SÜTUN — dosya başındaki gerekçe. `columns` akışı bölümleri
          yüksekliğe göre dengeler; `break-inside-avoid` bir bölümü ortasından
          bölünmekten korur. */}
      <div className="xl:columns-2 xl:gap-4">
        {sections.map((s) => (
          <ModelBolumu
            key={s.key}
            section={s}
            item={item}
            model={model}
            params={params}
            readOnly={readOnly}
            isiTabani={isiTabani}
            onChange={onChange}
            altSatir={
              // KESİT SATIRI SAYI DEĞİLDİR ama KİRİŞ VE SEHİM bölümünün
              // kararıdır: liste gerekli ataleti karşılayan ilk kesitte durur.
              // Adı bir düğmedir; ölçüler ve özellikler pop-up'ta açılır
              // (kullanıcı isteği md. 6).
              s.key === "girder" && model?.section ? (
                <div className="flex items-center gap-1.5 border-b px-2 py-1 last:border-b-0">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    Seçilen Kesit
                  </span>
                  <KesitDugmesi section={model.section} model={model} />
                  {model.deflectionOk === false ? (
                    <span className="shrink-0 text-[11px] font-semibold text-destructive">
                      SEHİM ×
                    </span>
                  ) : null}
                  <span className="w-8" />
                </div>
              ) : undefined
            }
          />
        ))}
      </div>

      {model?.camber ? (
        <p className="text-xs text-muted-foreground">
          Açıklık kamber eşiğinin üstünde — <span className="font-medium">kamber verilecek</span>.
        </p>
      ) : null}
    </Bolum>
  );
}

/**
 * AĞIRLIKLAR SAYFASI — üstte girdiler ve özet YAN YANA, altında kırılım.
 *
 * Kullanıcı isteği (18.08.2026): *"MALİYETE GİREN AĞIRLIKLAR bölümünü de en
 * üste alalım. Girdiler bölümünün sağına. Girdiler bölümünü de
 * daraltabiliriz."*
 *
 * Sebep okunduğunda açık: sayfanın SORUSU "bu vinç kaç kilo gelir"dir ve
 * cevabı üç satırdır. O üç satır listenin SONUNDA durduğu sürece, girdiyi
 * değiştiren kullanıcı etkisini görmek için her seferinde otuz satır aşağı
 * kaydırmak zorundaydı. Şimdi ikisi aynı ekranda: solda sebep, sağda sonuç.
 */
/**
 * RAY SEÇENEKLERİ — defterden, "seçilmedi" başta.
 *
 * BOŞ DEĞER BİR SEÇENEK OLMAK ZORUNDA: ray kodu bilinmeyebilir (teklifteki
 * yazım tanınmamış olabilir) ve Radix `Select` boş dizeye izin vermez —
 * `value=""` seçiciyi "denetimsiz" kipe düşürür. Bilinmeyen bir ray uydurma
 * bir genişlikle doldurulamaz (değişmez md. 4), o yüzden listede ADIYLA durur.
 */
const RAY_YOK = "— seçilmedi —";
const RAY_SECENEKLERI: readonly string[] = [RAY_YOK, ...Object.keys(RAILS)];

export function AgirlikSayfasi({
  offer,
  item,
  model,
  params,
  readOnly,
  onChange,
}: {
  /** Teklif belgesi — girdi eşitlemesi (md. 6) onu okur. */
  offer: OfferPayload;
  item: CostItem;
  model: CostModelResult | undefined;
  params: Record<string, number>;
  readOnly: boolean;
  onChange: (next: CostItem) => void;
}) {
  const ozet = WEIGHT_SECTIONS.find((s) => s.key === AGIRLIK_OZET_KEY);
  const kirilim = WEIGHT_SECTIONS.filter((s) => s.key !== AGIRLIK_OZET_KEY);

  /**
   * AĞIRLIK ISISININ TABANI — SAYFANIN EN AĞIR SATIRI.
   *
   * Kullanıcı isteği (23.08.2026, md. 3): *"renklendirmeyi Ağırlıklar
   * sayfasında ağırlığın büyüklüğüne göre de istiyorum. Anlaşılabilirliği
   * artsın."* Ölçek MALIYET-44'ün tutar ısısının aynısıdır ve tabanı da aynı
   * mantıkla seçilir: BELGENİN (burada: sayfanın) en büyüğü, bölüm içi bir
   * ölçek değil. Bölüm bazlı bir taban, 900 kg'lık merdivenleri 27.850 kg'lık
   * ana kirişle AYNI kırmızıda gösterirdi.
   *
   * TOPLAM SATIRLARI DA TABANA GİRER (`f.sum` süzülmez) ve bu bilinçlidir:
   * özet kartı ile kırılım AYNI ölçeği paylaşmalıdır, yoksa aynı sayı sayfanın
   * iki yerinde iki farklı renk alırdı. Toplamların en kırmızı görünmesi
   * doğrudur — onlar sayfanın en büyük sayılarıdır.
   *
   * BİR KEZ HESAPLANIR VE AŞAĞI GEÇİRİLİR (MALIYET-44 ile aynı kural).
   */
  const isiTabani = costLargestAmount(
    WEIGHT_SECTIONS.flatMap((s) =>
      s.fields.filter((f) => f.unit === "kg").map((f) => model?.values[f.key] ?? null)
    )
  );

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_27rem] xl:items-start">
        <GirdiBolumu
          item={item}
          offerItem={offer.items.find((o) => o.id === item.offerItemId)}
          onChange={onChange}
        />
        {ozet ? (
          <Bolum
            baslik={ozet.title}
            aciklama="Hammadde, kesim ve imalat işçiliği çelik ağırlığını; boya TOPLAM vinç ağırlığını okur."
          >
            <ModelBolumu
              section={{ ...ozet, title: "" }}
              item={item}
              model={model}
              params={params}
              readOnly={readOnly}
              isiTabani={isiTabani}
              onChange={onChange}
            />
          </Bolum>
        ) : null}
      </div>

      <ModelSayfasi
        baslik="AĞIRLIK KIRILIMI"
        aciklama="Alt montaj ağırlıkları modelden türer. Bildiğiniz bir ağırlığı yazarsanız yukarıdaki toplamlar ona göre yeniden hesaplanır. Sayının rengi AĞIRLIĞIN BÜYÜKLÜĞÜNÜ söyler: sarı hafif, kırmızı sayfanın en ağırı."
        sections={kirilim}
        item={item}
        model={model}
        params={params}
        readOnly={readOnly}
        isiTabani={isiTabani}
        onChange={onChange}
      />
    </>
  );
}

export function HesapSayfasi({
  offer,
  ...props
}: {
  offer: OfferPayload;
  item: CostItem;
  model: CostModelResult | undefined;
  params: Record<string, number>;
  readOnly: boolean;
  onChange: (next: CostItem) => void;
}) {
  return (
    <>
      <OzellikSeridi offer={offer} item={props.item} model={props.model} />
      <ModelSayfasi
        baslik="HESAPLAR"
        aciklama="Mekanizma boyutlandırması: halat, tambur, moment, motor, teker ve kiriş kesiti. Bu bir TAHMİNDİR; hesap raporunun yerine geçmez."
        sections={CALC_SECTIONS}
        {...props}
      />
    </>
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
      <div className="xl:columns-2 xl:gap-4">
        {gruplar.map((g) => (
          <div key={g} className="mb-4 grid break-inside-avoid gap-1">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">{g}</h3>
            <div className="rounded-md border">
              {COST_PARAM_DEFS.filter((d) => d.group === g).map((d) => {
                const deger = payload.params[d.key] ?? d.value;
                const degisti = Math.abs(deger - d.value) > 1e-9;
                return (
                  <div
                    key={d.key}
                    className="flex items-center gap-1.5 border-b px-2 py-1 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm" title={d.hint ?? d.label}>
                        {d.label}
                      </div>
                    </div>
                    <SayiKutusu
                      value={deger}
                      disabled={readOnly}
                      aria-label={d.label}
                      onChange={(v) => set(d.key, v)}
                      className={cn(
                        "h-8 w-28 text-right font-mono",
                        degisti && "border-primary font-semibold"
                      )}
                    />
                    <span className="w-20 shrink-0 truncate text-[11px] text-muted-foreground">
                      {d.unit}
                    </span>
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
