"use client";

// MALİYET EDİTÖRÜNÜN ORTAK PARÇALARI.
//
// Teklif editöründeki `Bolum` ve `MiniDugme` ile aynı işi yapan kardeşleri
// burada durur. Ortak bir dosyaya çekilmediler çünkü
// teklifinkiler o dosyanın YEREL parçaları; buraya taşımak teklif editöründe
// bir düzenleme yaparken maliyet ekranını da kırma riski demekti. Aynı şekil,
// ayrı sahip.

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { baslikDuzeni } from "@/lib/tr-text";
import { SayiKutusu } from "@/components/sayi-kutusu";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { costDeviationLevel } from "@/lib/offers/cost/compare";
import { costFieldDef, costFieldText, fmtCostField } from "@/lib/offers/cost/labels";
import type { CostModelResult, CostSection } from "@/lib/offers/cost/model";
import { COST_PARAM_DEFS, paramOf } from "@/lib/offers/cost/params";

// `SayiKutusu`, `sayiVeyaNull` ve `kutuMetni` ARTIK BURADA DEĞİL: üçü de
// `@/components/sayi-kutusu`e taşındı ve buradaki gövdeler onun KOPYASIYDI.
// Kopya, dosyanın başındaki "aynı şekil, ayrı sahip" notunun uyardığı
// ayrışmanın ta kendisiydi — virgül taslağı gibi ince bir kural ortak dosyada
// düzeltildiğinde maliyet ekranı eski davranışta kalırdı. Ortak kutu ayrıca
// binlik ayıracı da getirir (`binlik`); burada AÇILMAZ, çünkü bu dosyanın
// kutuları adet, oran ve ölçü taşır — tutar kutuları çağrı yerinde açar.

/**
 * KATLAMA DENETİMİ — bir bölümün açık/kapalı olması.
 *
 * Kullanıcı isteği (18.08.2026, md. 6): *"PROJE MALİYETİ gibi ana bölümler ve
 * YÜRÜTME VE TEKER gibi alt bölümler bir butonla daraltılabilsin."*
 *
 * DURUM BELGEDE DEĞİL EKRANDA YAŞAR. Bir bölümün kapalı olması bir GÖRÜNÜM
 * tercihidir; maliyet belgesinin içeriği değildir. Belgeye yazılsaydı iki şey
 * olurdu: yayımlanmış (kilitli) bir maliyette bölüm katlanamazdı, ve bir
 * kullanıcının katladığı bölüm ötekinin ekranında da kapalı açılırdı.
 */
export interface Katlama {
  kapali: (anahtar: string) => boolean;
  degistir: (anahtar: string) => void;
}

/** Katlama okunu çizen düğme — ana bölümde ve alt grupta aynı şekil. */
export function KatlaDugmesi({
  kapali,
  onClick,
  baslikMetni,
}: {
  kapali: boolean;
  onClick: () => void;
  baslikMetni: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={!kapali}
      title={kapali ? `${baslikMetni} — aç` : `${baslikMetni} — daralt`}
      aria-label={kapali ? `${baslikMetni} — aç` : `${baslikMetni} — daralt`}
      className="oc-tap-square inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <ChevronDown className={cn("size-4 transition-transform", kapali && "-rotate-90")} />
    </button>
  );
}

export function Bolum({
  baslik,
  aciklama,
  sag,
  katlama,
  katlamaAnahtari,
  children,
}: {
  baslik: string;
  aciklama?: string;
  /** Başlığın sağındaki eylem ya da özet. */
  sag?: React.ReactNode;
  /** Verilirse başlık katlanabilir olur. */
  katlama?: Katlama;
  katlamaAnahtari?: string;
  children: React.ReactNode;
}) {
  const anahtar = katlamaAnahtari ?? baslik;
  const katlanir = katlama !== undefined;
  const kapali = katlanir && katlama.kapali(anahtar);

  return (
    <section className="grid gap-3 rounded-lg border p-3">
      <header className="flex flex-wrap items-start gap-2">
        {katlanir ? (
          <KatlaDugmesi
            kapali={kapali}
            baslikMetni={baslik}
            onClick={() => katlama.degistir(anahtar)}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold tracking-wide">{baslik}</h2>
          {/* AÇIKLAMA KAPALIYKEN GİZLENİR: katlamanın amacı dikey yer
              kazanmaktı; iki satırlık bir açıklama kalsaydı kazanç yarıya
              inerdi. Başlık ve SAĞDAKİ ÖZET (tutar) kalır — kapalı bir
              bölümün tutarı görünmeseydi katlamak bilgi kaybı olurdu. */}
          {aciklama && !kapali ? (
            <p className="text-xs text-muted-foreground">{aciklama}</p>
          ) : null}
        </div>
        {sag}
      </header>
      {kapali ? null : children}
    </section>
  );
}

export function MiniDugme({
  children,
  baslik,
  aktif,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  baslik: string;
  aktif?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={baslik}
      aria-label={baslik}
      aria-pressed={aktif}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "oc-tap-square inline-flex h-8 min-w-8 items-center justify-center rounded-md px-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40",
        aktif && "bg-muted font-medium text-foreground"
      )}
    >
      {children}
    </button>
  );
}

/**
 * GİRDİ IZGARASI — kutular SABİT SÜTUNLARA oturur, genişlikleri içerikten
 * gelmez.
 *
 * Kullanıcı bildirimi (19.08.2026, md. 7): *"Ağırlıklar > GİRDİLER bölümündeki
 * kutular hizasız."* Üç ayrı sebebin üçü de burada kapanır ve üçü de ÖLÇÜLDÜ:
 *
 *   (a) HER KUTUYA ELLE GENİŞLİK veriliyordu (6…10 rem, `genislik` prop'u).
 *       İlk satır 8 alanla ~68 rem, ikincisi 6 alanla ~53 rem sürüyordu ve
 *       aradaki ~240 px'lik boşluk satır sonunu tırtıklı bırakıyordu; "Ana
 *       Kaldırma [ton]" 6,5 rem ile komşularının %30 altındaydı — kullanıcının
 *       gördüğü dar kutu tam olarak oydu.
 *   (b) ETİKET İKİ SATIRA SARINCA kutusunu aşağı itiyordu ("Portal Ayak
 *       Yüksekliği [m]"), komşusununki yerinde kalıyordu. `subgrid` bunu
 *       kapatır: etiket rayı ve kutu rayı BÜTÜN SATIR boyunca ortaktır, yani
 *       bir alanın uzun etiketi bütün satırın etiket rayını büyütür ve kutular
 *       yine aynı hizada başlar (aynı hata ve aynı çözüm hesap raporu
 *       editöründe de yaşandı — `revision-editor.tsx`teki subgrid notu).
 *   (c) "Vinç Sınıfı" ELLE YAZILMIŞ bir kutuydu (`div.grid.w-24` + düz `span`)
 *       ve `Label`ın `leading-none`unu taşımadığı için komşularından birkaç
 *       piksel aşağıda oturuyordu. `SecimAlani` onu da bu şekle sokar.
 *
 * `auto-fill` + `minmax(9.5rem,1fr)`: sütun sayısı pencereye göre değişir ama
 * bir satırdaki bütün kutular AYNI genişliktedir. Alt sınır 152 px'dir — 375
 * px'lik telefonda tek sütuna düşer (MOBIL-15).
 */
export const ALAN_IZGARASI =
  "grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-x-3 gap-y-1.5";

/**
 * IZGARANIN BİR HÜCRESİ — etiket üstte, denetim altta, TAM İKİ ÇOCUK.
 *
 * Üçüncü bir düğüm (ipucu, hata metni) `subgrid`in iki rayına sığmaz ve hizayı
 * yeni baştan bozar; bu yüzden `SayiAlani`nin hiçbir çağrı yerinin kullanmadığı
 * `ipucu` prop'u kaldırıldı — açıklama alanın `title`ına ya da bölümün
 * açıklamasına yazılır. Alt dolgu satırlar arası ayrımı verir: ızgaranın satır
 * boşluğu artık etiket ile denetim ARASINDAKİ boşluktur.
 */
function AlanHucresi({
  id,
  etiket,
  birim,
  children,
}: {
  id: string;
  etiket: string;
  birim?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="row-span-2 grid min-w-0 grid-rows-subgrid pb-1.5">
      {/* BİRİM ETİKETİN İÇİNDE SARAR: shadcn `Label` `flex items-center gap-2
          leading-none`tır ve `[ton]` orada bir flex ÖĞESİDİR — sarmaz, `ml-1`
          de gap'in üstüne binerdi. `flex-wrap` + `items-baseline` ile birim dar
          sütunda alt satıra iner ve etiketle aynı taban çizgisinde durur. */}
      <Label htmlFor={id} className="flex-wrap items-baseline gap-1 text-xs leading-tight">
        {etiket}
        {birim ? <span className="text-muted-foreground">[{birim}]</span> : null}
      </Label>
      {children}
    </div>
  );
}

/** Etiketli sayı kutusu — girdi bölümlerinin tek şekli. */
export function SayiAlani({
  etiket,
  birim,
  value,
  onChange,
  disabled,
}: {
  etiket: string;
  birim?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
}) {
  const id = `alan-${etiket.replace(/\s+/g, "-")}`;
  return (
    <AlanHucresi id={id} etiket={etiket} birim={birim}>
      <SayiKutusu
        id={id}
        value={value}
        disabled={disabled}
        onChange={onChange}
        className="h-9 self-start"
      />
    </AlanHucresi>
  );
}

/** Etiketli seçici — girdi ızgarasında sayı OLMAYAN alanların şekli. */
export function SecimAlani({
  etiket,
  value,
  secenekler,
  onChange,
  disabled,
}: {
  etiket: string;
  value: string;
  secenekler: readonly string[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const id = `alan-${etiket.replace(/\s+/g, "-")}`;
  return (
    <AlanHucresi id={id} etiket={etiket}>
      <Select value={value} disabled={disabled} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-9 w-full self-start" aria-label={etiket}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {secenekler.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </AlanHucresi>
  );
}

/** Açık/kapalı seçici — kabin, elektrik odası gibi VAR/YOK kararları. */
export function Anahtar({
  etiket,
  value,
  onChange,
}: {
  etiket: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={cn(
        "oc-tap inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
        value ? "border-primary bg-muted font-medium" : "text-muted-foreground hover:bg-muted"
      )}
    >
      <span
        aria-hidden
        className={cn("size-2 rounded-full", value ? "bg-primary" : "bg-muted-foreground/40")}
      />
      {etiket}
    </button>
  );
}

// ————————————————————————————————————————————————————— türetme

/**
 * BİR SAYININ NEREDEN GELDİĞİ — formülü, ara değerleri, katsayıları.
 *
 * Kullanıcı isteği (18.08.2026, md. 9): *"Maliyetlerde miktar kısmının
 * nereden geldiğini pop-up olarak görebileyim. Sistem bunu zaten otomatik
 * hesaplıyor. Değerin nasıl oluştuğunu göstersin."*
 *
 * FORMÜL METİN, SAYILAR MODELDEN. Defterdeki `formula` okunur bir cümledir;
 * altındaki ara değerler ise `deps` anahtarlarıyla MODELİN O ANKİ
 * sonucundan basılır. Metin eskise bile ekrandaki sayılar hesabın kendisidir
 * (`labels.ts` başındaki gerekçe) — türetmeyi metinden koşturmak, okunur bir
 * cümleden vazgeçmek olurdu.
 */
export function TuretmeKutusu({
  fieldKey,
  model,
  params,
  baslik,
}: {
  fieldKey: string | undefined;
  model: CostModelResult | undefined;
  params: Record<string, number>;
  /** Üstteki başlık — maliyet satırında satırın adı, hesapta alanın adı. */
  baslik?: string;
}) {
  const def = fieldKey ? costFieldDef(fieldKey) : undefined;
  const deger = fieldKey ? (model?.values[fieldKey] ?? null) : null;

  if (!fieldKey || fieldKey === "c.one") {
    return (
      <div className="grid gap-1 text-sm">
        {baslik ? <p className="font-medium">{baslik}</p> : null}
        <p className="text-muted-foreground">
          {/* `c.one` "modelden gelmiyor" DEĞİLDİR: model onu sabit 1 olarak
              üretir ve kutu tam da bu yüzden salt okunur çizilir. Metin bir
              süre tersini söylüyordu ve kullanıcıyı boş yere kutuyu açmaya
              yönlendiriyordu. */}
          {fieldKey === "c.one"
            ? "Bu satır bir bütün olarak fiyatlanır: miktarı her zaman 1'dir. Tutar doğrudan birim fiyattır."
            : "Bu miktar modelden gelmez; elle girilir."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-2 text-sm">
      <div>
        {baslik ? <p className="font-medium">{baslik}</p> : null}
        <p className="text-xs text-muted-foreground">
          {def?.label ?? fieldKey}
          {def?.unit ? ` [${def.unit}]` : ""}
        </p>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-xs text-muted-foreground">Değer</span>
        <span className="ml-auto font-mono font-semibold tabular-nums">
          {def ? costFieldText(def, deger) : fmtCostField(deger, 0)}
        </span>
      </div>

      {def?.formula ? (
        <p className="rounded-md bg-muted px-2 py-1.5 text-xs">= {def.formula}</p>
      ) : null}

      {/* İPUCU SATIRDAN POP-UP'A TAŞINDI: satır altı metinleri kaldıran düzen
          (md. 8) onu da düşürüyordu. "Profil ve Ray miktarı modelden gelmez"
          gibi bir cümle kaybolunca boş miktar bir hata gibi okunur. */}
      {def?.hint ? <p className="text-xs text-muted-foreground">{def.hint}</p> : null}

      {def?.deps?.length ? (
        <div className="grid gap-0.5">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground">ARA DEĞERLER</p>
          {def.deps.map((k) => {
            const d = costFieldDef(k);
            return (
              <div key={k} className="flex items-baseline gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate">{d?.label ?? k}</span>
                <span className="font-mono tabular-nums">
                  {d ? costFieldText(d, model?.values[k] ?? null) : fmtCostField(model?.values[k] ?? null, 0)}
                </span>
                <span className="w-10 shrink-0 text-muted-foreground">{d?.unit ?? ""}</span>
              </div>
            );
          })}
        </div>
      ) : null}

      {def?.paramKeys?.length ? (
        <div className="grid gap-0.5">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground">KATSAYILAR</p>
          {def.paramKeys.map((k) => {
            const p = COST_PARAM_DEFS.find((x) => x.key === k);
            return (
              <div key={k} className="flex items-baseline gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate">{p?.label ?? k}</span>
                <span className="font-mono tabular-nums">{fmtCostField(paramOf(params, k), 3)}</span>
                <span className="w-10 shrink-0 text-muted-foreground">{p?.unit ?? ""}</span>
              </div>
            );
          })}
          <p className="text-[11px] text-muted-foreground">Katsayılar bölümünden değiştirilir.</p>
        </div>
      ) : null}
    </div>
  );
}

/** Türetme kutusunu açan sarmalayıcı — tetikleyici çağrı yerinde çizilir. */
export function Turetme({
  fieldKey,
  model,
  params,
  baslik,
  align = "end",
  children,
}: {
  fieldKey: string | undefined;
  model: CostModelResult | undefined;
  params: Record<string, number>;
  baslik?: string;
  /** Tetikleyici bir SÜTUN kutusuysa "end", satırın ADIYSA "start". */
  align?: "start" | "center" | "end";
  children: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      {/* Genişlik kelepçelidir (MOBIL-5): sabit bir `w-80` telefonda görünür
          alanı deler ve kutu ekranın dışına taşardı. */}
      <PopoverContent align={align} className="w-[min(22rem,calc(100vw-2rem))]">
        <TuretmeKutusu fieldKey={fieldKey} model={model} params={params} baslik={baslik} />
      </PopoverContent>
    </Popover>
  );
}

/**
 * SAPMA ROZETİ — istenen ile hesaplanan arasındaki fark.
 *
 * RENK TEK TAŞIYICI DEĞİLDİR (AGENTS.md md. 6'nın kardeş kuralı): rozet
 * yüzdeyi ve işaretini de yazar, yani renk körü bir okuyucu ya da gri
 * basılmış bir çıktı aynı bilgiyi okur. Renk HEX değil TOKEN'dır
 * (`--success` / `--destructive`).
 */
export function SapmaRozeti({ deviation }: { deviation: number | null }) {
  const seviye = costDeviationLevel(deviation);
  if (seviye === null || deviation === null) return null;
  const yuzde = deviation * 100;
  const isaret = yuzde > 0 ? "+" : "";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] tabular-nums",
        seviye === "uygun"
          ? "border-success/40 bg-success/10 text-success"
          : "border-destructive/50 bg-destructive/10 text-destructive"
      )}
      title={seviye === "uygun" ? "Teklifle uyumlu" : "Teklifte istenenden sapıyor"}
    >
      {seviye === "uygun" ? "✓ " : "! "}
      {isaret}
      {fmtCostField(yuzde, Math.abs(yuzde) < 10 ? 1 : 0)}%
    </span>
  );
}

// ————————————————————————————————————————————————— katalog boyu

/**
 * KATALOG BOYU SEÇİCİ — motor, sürücü, teker, tambur, halat donanımı.
 *
 * Kullanıcı isteği (18.08.2026, md. 1 ve 5): *"Halat donanımını otomatik
 * katsayılardan seçilsin ancak müşteri dropdown da değiştirebilsin … Teker
 * çaplarını vb özellikleri de isterse kullanıcı hesaplar kısmında
 * değiştirebilsin."*
 *
 * SERBEST KUTU DEĞİL LİSTEDİR ve bu bir görgü tercihi değildir: 23,4 kW'lık
 * motor ya da ⌀ 437 mm'lik teker satın alınamaz. Dahası, teker grubu ağırlığı
 * çapı TABLODA ARAYARAK bulur (`WHEEL_TABLE.find`) — listede olmayan bir çap
 * yazılsaydı ağırlık sessizce `null` düşer, kilo maliyetten kaybolurdu.
 *
 * BELGEDEKİ DEĞER LİSTEDE YOKSA LİSTEYE EKLENİR. Katalog serisi zamanla
 * değişir; bir yıl önce seçilmiş bir boy bugün listeden çıkmış olabilir ve
 * o belgeyi açan kullanıcı kendi seçtiği sayıyı görememezlik etmemelidir
 * (`COST_UNITS`in aynı kuralı).
 */
export function SayiSecici({
  value,
  choices,
  decimals,
  prefix,
  etiket,
  onChange,
  disabled,
  className,
}: {
  value: number | null;
  choices: readonly number[];
  decimals: number;
  prefix?: string;
  etiket: string;
  onChange: (v: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  const liste =
    value !== null && Number.isFinite(value) && !choices.includes(value)
      ? [...choices, value].sort((a, b) => a - b)
      : choices;
  const yaz = (n: number) => `${prefix ? `${prefix} ` : ""}${fmtCostField(n, decimals)}`;

  return (
    <Select
      value={value === null ? "" : String(value)}
      disabled={disabled}
      onValueChange={(v) => {
        const n = Number(v);
        if (Number.isFinite(n)) onChange(n);
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label={`${etiket} — katalog boyu`}
        className={cn(
          "w-full justify-between border-primary font-mono text-sm font-semibold *:data-[slot=select-value]:justify-end",
          className
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {liste.map((n) => (
          <SelectItem key={n} value={String(n)} className="font-mono">
            {yaz(n)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * BİRİM SEÇİCİ — maliyet satırının birimi.
 *
 * Kullanıcı isteği (18.08.2026, md. 11): *"Birimler dropdown gelsin. kg adet
 * takım metre seçebileyim."* Serbest metin kutusu "adet", "Adet" ve "ad."
 * üretiyordu; üçü de aynı şeydi ama hiçbiri ötekiyle eşleşmiyordu.
 *
 * LİSTE KAPALI DEĞİLDİR: belgede yazılı olup listede olmayan bir birim
 * seçeneklere EKLENİR (`SayiSecici`nin aynı kuralı) — eski bir belgenin birimi
 * listeyi daralttık diye kaybolmamalıdır.
 */
export function BirimSecici({
  value,
  units,
  onChange,
  disabled,
  className,
}: {
  value: string;
  units: readonly string[];
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const liste = value && !units.includes(value) ? [...units, value] : units;
  return (
    <Select value={value || undefined} disabled={disabled} onValueChange={onChange}>
      <SelectTrigger size="sm" aria-label="Birim" className={cn("w-full", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {liste.map((u) => (
          <SelectItem key={u} value={u}>
            {baslikDuzeni(u)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ———————————————————————————————————————————————————————— kesit

/**
 * KESİT ŞEMASI — seçilen kutu kesidin oranlı çizimi.
 *
 * ŞEMATİKTİR VE ÖYLE YAZAR: perde (diyafram), ray ve aşınma levhası
 * ÇİZİLMEZ çünkü kesit tablosunda yokturlar — onlar ağırlığa `girderExtraRatio`
 * ile girer, kesit dayanımına değil (`sectionProps`in gerekçesi). Var
 * olmayan bir parçayı çizmek, ölçüsü bilinmeyen bir şeyi biliyormuş gibi
 * göstermek olurdu (değişmez md. 4).
 *
 * PERDE SACLARI BAŞLIKLARIN KENARINA HİZALIDIR. Aradaki açıklık kesit
 * tablosunda YOKTUR ve ataleti de etkilemez (perdeler kendi güçlü eksenlerinde
 * çalışır); kenara hizalamak kutu kirişin olağan hâlidir ve uydurma bir ölçü
 * üretmez.
 *
 * RENK TOKEN'DIR, hex değil (değişmez md. 6): sac `fill-muted-foreground/25`,
 * kenar `stroke-foreground`.
 */
function KesitSemasi({ section }: { section: CostSection }) {
  const { topMm, webMm, botMm, tMm } = section;
  const enBuyukEn = Math.max(topMm, botMm);
  const toplamYukseklik = webMm + 2 * tMm;

  // Tuval ÖLÇEKLENİR, kırpılmaz: 250×500'lük bir kesit de 1200×3000'lik bir
  // kesit de aynı kutuya oranını koruyarak sığar.
  const pay = 8;
  const olcek = Math.min(150 / enBuyukEn, 120 / toplamYukseklik);
  const w = enBuyukEn * olcek;
  const h = toplamYukseklik * olcek;
  const t = tMm * olcek;
  const ust = topMm * olcek;
  const alt = botMm * olcek;
  const orta = pay + w / 2;

  return (
    <svg
      viewBox={`0 0 ${w + pay * 2} ${h + pay * 2}`}
      width={w + pay * 2}
      height={h + pay * 2}
      role="img"
      aria-label={`${section.name} kutu kesit şeması`}
      className="shrink-0"
    >
      <g className="fill-muted-foreground/25 stroke-foreground" strokeWidth={0.7}>
        {/* üst başlık */}
        <rect x={orta - ust / 2} y={pay} width={ust} height={t} />
        {/* iki perde — başlıkların dar olanının kenarına hizalı */}
        <rect x={orta - Math.min(ust, alt) / 2} y={pay + t} width={t} height={h - 2 * t} />
        <rect x={orta + Math.min(ust, alt) / 2 - t} y={pay + t} width={t} height={h - 2 * t} />
        {/* alt başlık */}
        <rect x={orta - alt / 2} y={pay + h - t} width={alt} height={t} />
      </g>
    </svg>
  );
}

/**
 * KESİT POP-UP'I — "hangi kesit seçildi ve neden".
 *
 * Kullanıcı isteği (18.08.2026, md. 6): *"kiriş seçiminde seçilen kesit ve
 * kesit özelliklerini tıkladığımda pop-up gibi görebileyim."*
 *
 * SEHİM DE BURADADIR çünkü kesidi SEÇEN ŞARTTIR: liste gerekli ataleti
 * karşılayan ilk kesitte durur. Ataleti gösterip sehimi göstermemek, kararın
 * yarısını anlatmak olurdu.
 */
export function KesitKutusu({
  section,
  model,
}: {
  section: CostSection;
  model: CostModelResult | undefined;
}) {
  const olcu = (etiket: string, deger: string) => (
    <div className="flex items-baseline gap-2 text-xs">
      <span className="min-w-0 flex-1 truncate">{etiket}</span>
      <span className="font-mono tabular-nums">{deger}</span>
    </div>
  );
  const v = (k: string) => model?.values[k] ?? null;

  return (
    <div className="grid gap-2 text-sm">
      <div>
        <p className="font-medium">Seçilen Kiriş Kesiti</p>
        <p className="font-mono text-xs text-muted-foreground">{section.name}</p>
      </div>

      <div className="flex items-start gap-3">
        <KesitSemasi section={section} />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground">ÖLÇÜLER</p>
          {olcu("Üst Başlık", `${fmtCostField(section.topMm, 0)} mm`)}
          {olcu("Perde Yüksekliği", `${fmtCostField(section.webMm, 0)} mm`)}
          {olcu("Alt Başlık", `${fmtCostField(section.botMm, 0)} mm`)}
          {olcu("Et Kalınlığı", `${fmtCostField(section.tMm, 0)} mm`)}
          {olcu("Toplam Yükseklik", `${fmtCostField(section.webMm + 2 * section.tMm, 0)} mm`)}
        </div>
      </div>

      <div className="grid gap-0.5">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground">ÖZELLİKLER</p>
        {olcu("Kesit Alanı", `${fmtCostField(section.areaCm2, 1)} cm²`)}
        {olcu("Atalet Momenti", `${fmtCostField(section.inertiaCm4, 0)} cm⁴`)}
        {olcu("Gerekli Atalet", `${fmtCostField(v("c.requiredInertiaCm4"), 0)} cm⁴`)}
        {olcu("Sac Metre Ağırlığı", `${fmtCostField(section.kgPerM, 1)} kg/m`)}
        {olcu("Kiriş Metre Ağırlığı", `${fmtCostField(v("c.girderKgPerM"), 1)} kg/m`)}
      </div>

      <div className="grid gap-0.5 border-t pt-1.5">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground">SEHİM</p>
        {olcu("Hesaplanan Sehim", `${fmtCostField(v("c.deflectionMm"), 1)} mm`)}
        {olcu("Sehim Oranı", `L / ${fmtCostField(v("c.deflectionRatio"), 0)}`)}
        {olcu("Sınıf Limiti", `L / ${fmtCostField(v("c.deflectionLimit"), 0)}`)}
        {model?.deflectionOk === false ? (
          <p className="font-semibold text-destructive">SEHİM ŞARTI SAĞLANMIYOR</p>
        ) : null}
        {model?.camber ? <p className="text-muted-foreground">Kamber verilecek.</p> : null}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Şema oranlıdır; perde, ray ve aşınma levhası gösterilmez — kesit tablosunda
        yokturlar, ağırlığa ayrı bir payla girerler.
      </p>
    </div>
  );
}

/** Kesit pop-up'ını açan düğme — kesidin adını basar. */
export function KesitDugmesi({
  section,
  model,
  className,
}: {
  section: CostSection;
  model: CostModelResult | undefined;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Kesit ölçüleri ve özellikleri"
          className={cn(
            "oc-tap inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-0.5 font-mono text-sm font-medium transition-colors hover:bg-muted",
            className
          )}
        >
          {section.name}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(24rem,calc(100vw-2rem))]">
        <KesitKutusu section={section} model={model} />
      </PopoverContent>
    </Popover>
  );
}
