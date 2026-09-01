"use client";

// AĞIRLIK DÖKÜMÜ PENCERESİ.
//
// Teknik özelliklerde TASARIMDAN ÖNCE girilen tahmini ağırlığı, rapor
// ilerledikçe ortaya çıkan gerçek parçalarla yan yana koyar. Bir HESAP DEĞİL
// bir DOĞRULAMADIR (HESAP-35): hesap motoru bu pencereyi hiç görmez, hiçbir
// kontrol ondan beslenmez. Motora giden tek yol, mühendisin AÇIKÇA bastığı
// "Teknik özelliğe yaz" düğmesidir — ki o da kutuya elle yazmakla aynı şeydir.
//
// TABLO KULLANILMAZ, esnek satır kullanılır (`ModelSatiri` deseni): telefonda
// ana tablo yatay kaymaz (MOBIL-15) ve satır kendi içinde sarabilir.
//
// SATIRIN İKİ TIKLAMA HEDEFİ AYRIDIR: ADA tıklamak "bu sayı NEREDEN geliyor"
// der (kaynak · formül · gerekçe), SAYIYA tıklamak onu DÜZENLER.

import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { KatlaDugmesi } from "@/components/katlanir-bolum";
import { SayiKutusu } from "@/components/sayi-kutusu";
import { TAM_BOY_PENCERE } from "@/components/pencere";
import {
  AGIRLIK_KAYNAK_ETIKETLERI,
  AGIRLIK_KAYNAK_TONLARI,
  AGIRLIK_SAPMA_SINIRI,
  type AgirlikBandi,
  type AgirlikDokumu,
  type AgirlikDokumuDurumu,
  type AgirlikGrubu,
  type AgirlikKalemi,
  type AgirlikSpecAnahtari,
} from "@/lib/weights/types";

/**
 * Kilo — EN ÇOK BİR ONDALIK.
 *
 * Çekirdek zaten 0,1 kg'a yuvarlıyor; burada sıfır ondalık basmak "2 × 4.775 =
 * 9.549" gibi kendi kendini yalanlayan bir çarpım yazdırıyordu. Ondalık ancak
 * VARSA görünür.
 */
const kg = (v: number | null | undefined): string =>
  v === null || v === undefined || !Number.isFinite(v)
    ? "—"
    : v.toLocaleString("tr-TR", { maximumFractionDigits: 1 });

const ton = (v: number | null | undefined): string =>
  v === null || v === undefined || !Number.isFinite(v)
    ? "—"
    : (v / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 2 });

/**
 * Yüzde — GÖSTERİLEN BASAMAKTA SIFIRA DÜŞEN SAYI EKSİ İŞARETLİ BASILMAZ
 * (HESAP-23'ün "-0 %" dersi): okuyucu olmayan bir sapmayı varmış gibi okur.
 */
function yuzde(oran: number | null): string {
  if (oran === null || !Number.isFinite(oran)) return "—";
  const deger = oran * 100;
  const yazi = Math.abs(deger).toLocaleString("tr-TR", { maximumFractionDigits: 1 });
  if (yazi === "0") return "%0";
  // İŞARET YÜZDE İMİNİN SOLUNDA durur: "%-20,4" okunurken önce yüzde sonra eksi
  // görülür ve göz iki kez döner. Artı ve eksi de aynı biçimde yazılır.
  return `${deger > 0 ? "+" : "−"}%${yazi}`;
}

function KaynakRozeti({ kalem }: { kalem: AgirlikKalemi }) {
  return (
    <span
      className="oc-tag shrink-0 rounded-sm px-1.5 py-px text-[11px] leading-tight"
      style={{ "--oc-hue": `${AGIRLIK_KAYNAK_TONLARI[kalem.kaynak]}` } as React.CSSProperties}
      title={
        kalem.ezildi && kalem.kaynakOnce
          ? `Elle verildi (otomatik kaynak: ${AGIRLIK_KAYNAK_ETIKETLERI[kalem.kaynakOnce]})`
          : undefined
      }
    >
      {AGIRLIK_KAYNAK_ETIKETLERI[kalem.kaynak]}
    </span>
  );
}

function Satir({
  kalem,
  readOnly,
  onEzme,
}: {
  kalem: AgirlikKalemi;
  readOnly?: boolean;
  onEzme: (key: string, deger: number | null) => void;
}) {
  const aralikli = kalem.kgUst !== undefined && kalem.kgUst !== kalem.kg;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 border-t px-2 py-1.5 text-sm",
        kalem.gizliBolumden && "opacity-60"
      )}
    >
      {/* AD — tıklanınca sayının NEREDEN geldiğini açar. */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="oc-tap min-w-0 flex-1 truncate text-left hover:text-primary"
            title={kalem.label}
          >
            {kalem.label}
            {kalem.gizliBolumden ? " · gizli bölüm" : ""}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(28rem,calc(100vw-2rem))]">
          <div className="mb-1.5 text-xs font-semibold">{kalem.label}</div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <dt>Kaynak</dt>
            <dd>{AGIRLIK_KAYNAK_ETIKETLERI[kalem.kaynak]}</dd>
            {kalem.formul ? (
              <>
                <dt>Formül</dt>
                <dd className="font-mono">{kalem.formul}</dd>
              </>
            ) : null}
            {kalem.adet !== null ? (
              <>
                <dt>Adet</dt>
                <dd className="font-mono tabular-nums">{kalem.adet}</dd>
              </>
            ) : null}
            {kalem.birimKg !== null ? (
              <>
                <dt>Birim</dt>
                <dd className="font-mono tabular-nums">
                  {kg(kalem.birimKg)}
                  {kalem.birimKgUst !== undefined && kalem.birimKgUst !== kalem.birimKg
                    ? ` – ${kg(kalem.birimKgUst)}`
                    : ""}{" "}
                  kg
                </dd>
              </>
            ) : null}
            {kalem.ezildi && kalem.otomatikKg !== null && kalem.otomatikKg !== undefined ? (
              <>
                <dt>Otomatik</dt>
                <dd className="font-mono tabular-nums">{kg(kalem.otomatikKg)} kg</dd>
              </>
            ) : null}
            {kalem.rowKey ? (
              <>
                <dt>Satır</dt>
                <dd className="font-mono">{kalem.rowKey}</dd>
              </>
            ) : null}
          </dl>
          {kalem.gerekce ? (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{kalem.gerekce}</p>
          ) : null}
        </PopoverContent>
      </Popover>

      {/* ÇARPIM AÇIKÇA YAZILIR: "2 ad │ 9.549" satırı, sayının birim mi toplam
          mı olduğunu söylemiyordu. Birim biliniyorsa çarpanı da görünür. */}
      <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
        {kalem.adet === null
          ? ""
          : kalem.adet === 1
            ? "" /* "1 × 2.400 =" bir çarpım değil gürültüdür */
            : kalem.birimKg === null
              ? `${kalem.adet} ad`
              : `${kalem.adet} × ${kg(kalem.birimKg)} =`}
      </span>

      {/* SAYI — tıklanınca DÜZENLENİR. Boş kutu `null` üretir, `0` değil. */}
      <SayiKutusu
        value={kalem.kg}
        onChange={(v) => onEzme(kalem.key, v)}
        disabled={readOnly}
        aria-label={`${kalem.label} ağırlığı [kg]`}
        className={cn(
          "h-8 w-24 shrink-0 text-right font-mono tabular-nums",
          kalem.ezildi && "border-primary/50 bg-primary/5"
        )}
      />
      <span className="w-6 shrink-0 text-[11px] text-muted-foreground">kg</span>
      {aralikli ? (
        <span className="shrink-0 text-[11px] text-muted-foreground">
          (üst sınır {kg(kalem.kgUst)})
        </span>
      ) : null}

      <KaynakRozeti kalem={kalem} />

      {kalem.ezildi && !readOnly ? (
        <button
          type="button"
          onClick={() => onEzme(kalem.key, null)}
          title="Elle girilen değeri geri al"
          aria-label={`${kalem.label} — elle girilen değeri geri al`}
          className="oc-tap-square inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <RotateCcw className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function Grup({
  grup,
  readOnly,
  onEzme,
}: {
  grup: AgirlikGrubu;
  readOnly?: boolean;
  onEzme: (key: string, deger: number | null) => void;
}) {
  const [kapali, setKapali] = useState(true);
  return (
    <section className="rounded-md border">
      <header className="flex flex-wrap items-center gap-2 px-2 py-1.5">
        <KatlaDugmesi kapali={kapali} baslikMetni={grup.label} onClick={() => setKapali((k) => !k)} />
        <h4 className="min-w-0 flex-1 truncate text-sm font-medium">{grup.label}</h4>
        {/* KAPALI BİR GRUP NE SAKLADIĞINI SÖYLER: toplam her zaman görünür. */}
        <span className="shrink-0 font-mono text-sm tabular-nums">
          {grup.eksikKalemSayisi > 0 && grup.kg !== null ? "≥ " : ""}
          {kg(grup.kg)} kg
        </span>
        {grup.eksikKalemSayisi > 0 ? (
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {grup.eksikKalemSayisi} kalem eksik
          </span>
        ) : null}
        {grup.gizliDusenSayisi > 0 ? (
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {grup.gizliDusenSayisi} satır gizli bölümde
          </span>
        ) : null}
        {grup.ezildi ? (
          <span className="shrink-0 text-[11px] text-primary">toplam elle verildi</span>
        ) : null}
      </header>
      {kapali ? null : (
        <div className={cn(grup.ezildi && "opacity-55")}>
          {grup.kalemler.map((kalem) => (
            <Satir key={kalem.key} kalem={kalem} readOnly={readOnly} onEzme={onEzme} />
          ))}
        </div>
      )}
    </section>
  );
}

function Bant({
  bant,
  acikBaslangic,
  readOnly,
  onEzme,
  onSpecYaz,
}: {
  bant: AgirlikBandi;
  acikBaslangic: boolean;
  readOnly?: boolean;
  onEzme: (key: string, deger: number | null) => void;
  onSpecYaz?: (specKey: AgirlikSpecAnahtari, kg: number) => void;
}) {
  const [kapali, setKapali] = useState(!acikBaslangic);
  const sapiyor =
    bant.farkOrani !== null && Math.abs(bant.farkOrani) > AGIRLIK_SAPMA_SINIRI;
  return (
    <section className="grid gap-2 rounded-lg border p-2 sm:p-3">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <KatlaDugmesi kapali={kapali} baslikMetni={bant.label} onClick={() => setKapali((k) => !k)} />
        <h3 className="oc-kicker min-w-0 flex-1 truncate">{bant.label}</h3>
        <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
          {bant.eksikKalemSayisi > 0 && bant.kg !== null ? "≥ " : ""}
          {kg(bant.kg)} kg
        </span>
      </header>

      {bant.specKey ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md bg-muted/50 px-2 py-1.5 text-xs">
          <span className="text-muted-foreground">
            Tahmini <span className="font-mono tabular-nums">{ton(bant.tahminiKg)} t</span>
          </span>
          <span className="text-muted-foreground">
            Dökümden <span className="font-mono tabular-nums">{ton(bant.kg)} t</span>
          </span>
          {/* Renk TEK TAŞIYICI DEĞİLDİR: sapma yüzdesi zaten yazıyla durur. */}
          <span
            className={cn(
              "font-mono tabular-nums",
              sapiyor ? "font-semibold text-destructive" : "text-muted-foreground"
            )}
          >
            {yuzde(bant.farkOrani)}
            {sapiyor ? " · sapma sınırının üstünde" : ""}
          </span>
          {bant.tahminIcerir ? (
            <span className="text-muted-foreground">· tahmin içerir</span>
          ) : null}
          {onSpecYaz && !readOnly && bant.kg !== null ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => onSpecYaz(bant.specKey!, bant.kg as number)}
              title="Dökümden çıkan toplamı teknik özellikteki tahmini ağırlık kutusuna yazar"
            >
              Teknik özelliğe yaz
            </Button>
          ) : null}
        </div>
      ) : null}

      {kapali ? null : (
        <div className="grid gap-1.5">
          {bant.gruplar.map((grup) => (
            <Grup key={grup.key} grup={grup} readOnly={readOnly} onEzme={onEzme} />
          ))}
        </div>
      )}
    </section>
  );
}

export function AgirlikDokumuDialog({
  acik,
  onOpenChange,
  dokum,
  acilanBant,
  durum,
  onDurum,
  onSpecYaz,
  readOnly,
}: {
  acik: boolean;
  onOpenChange: (v: boolean) => void;
  dokum: AgirlikDokumu;
  /** Hangi bant öne gelsin — düğmesine basılan ağırlık kutusunun bandı. */
  acilanBant?: string;
  durum: AgirlikDokumuDurumu;
  onDurum: (next: AgirlikDokumuDurumu) => void;
  onSpecYaz?: (specKey: AgirlikSpecAnahtari, kg: number) => void;
  readOnly?: boolean;
}) {
  const onEzme = (key: string, deger: number | null) => {
    const overrides = { ...(durum.overrides ?? {}) };
    if (deger === null || !Number.isFinite(deger) || deger <= 0) delete overrides[key];
    else overrides[key] = deger;
    onDurum({ ...durum, overrides });
  };

  const ezmeSayisi = useMemo(
    () => Object.keys(durum.overrides ?? {}).length,
    [durum.overrides]
  );

  return (
    <Dialog open={acik} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${TAM_BOY_PENCERE} sm:max-w-[min(64rem,calc(100%-2rem))]`}
      >
        <DialogHeader>
          <DialogTitle>Ağırlık Dökümü</DialogTitle>
          <DialogDescription>
            Teknik özelliklerde girilen tahmini ağırlıkları, seçilen ekipman ve hesaplanan
            kesitlerle karşılaştırır. <strong>Hesap motoruna girmez</strong>; bir değer ancak
            &quot;Teknik özelliğe yaz&quot; ile kutuya taşınır.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-y py-2 text-sm">
          <span className="oc-kicker">Toplam Vinç Ağırlığı</span>
          <span className="font-mono text-base font-semibold tabular-nums">
            {dokum.eksikKalemSayisi > 0 && dokum.kg !== null ? "≥ " : ""}
            {ton(dokum.kg)} t
          </span>
          <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-xs pointer-coarse:min-h-10">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={durum.gizliBolumleriSay === true}
              onChange={(e) => onDurum({ ...durum, gizliBolumleriSay: e.target.checked })}
            />
            Gizli bölümleri de say
          </label>
        </div>

        <div className="grid gap-2">
          {dokum.bantlar.map((bant) => (
            <Bant
              key={bant.key}
              bant={bant}
              acikBaslangic={acilanBant === undefined || acilanBant === bant.key}
              readOnly={readOnly}
              onEzme={onEzme}
              onSpecYaz={onSpecYaz}
            />
          ))}
        </div>

        {dokum.notlar.length > 0 || ezmeSayisi > 0 ? (
          <ul className="grid gap-1 border-t pt-2 text-[11px] text-muted-foreground">
            {dokum.notlar.map((not) => (
              <li key={not}>{not}</li>
            ))}
            {ezmeSayisi > 0 ? <li>{ezmeSayisi} kalem elle verildi.</li> : null}
          </ul>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
