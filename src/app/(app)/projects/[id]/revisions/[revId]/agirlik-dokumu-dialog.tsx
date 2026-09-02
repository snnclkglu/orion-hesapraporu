"use client";

// AĞIRLIK DÖKÜMÜ PENCERESİ.
//
// Teknik özelliklerde TASARIMDAN ÖNCE girilen tahmini ağırlığı, rapor
// ilerledikçe ortaya çıkan gerçek parçalarla yan yana koyar. Bir HESAP DEĞİL
// bir DOĞRULAMADIR (HESAP-35): hesap motoru bu pencereyi hiç görmez, hiçbir
// kontrol ondan beslenmez. Motora giden tek yol, mühendisin AÇIKÇA bastığı
// "Teknik özelliğe yaz" düğmesidir — ki o da kutuya elle yazmakla aynı şeydir.
//
// ————————————————————————————————————————————————— SÜTUN DÜZENİ (02.09.2026)
//
// Kullanıcı isteği (md. 6): *"'2 kalem eksik' gibi yazılar ağırlığın yanında
// değil satır ortasında bir sütun gibi yazsın. Ağırlıklar hep en solda olsun."*
//
// Bunun için TEK BİR IZGARA TANIMI vardır (`IZGARA`) ve ÜÇ satır türü de
// (bant başlığı · grup başlığı · kalem) onu kullanır; sütunlar bu yüzden
// pencerenin tamamında hizalıdır:
//
//     [ AĞIRLIK ] [ AD ......... ] [ DURUM ] [ ROZET · EYLEM ]
//
// Eski esnek satır (`flex flex-wrap`) her satırda başka bir yere düşen bir
// sayı sütunu üretiyordu. Yine de TABLO KULLANILMAZ: ızgara telefonda
// daralır ve metin kırpılır, yatay kaydırma doğmaz (MOBIL-15).
//
// SATIRIN İKİ TIKLAMA HEDEFİ AYRIDIR: kalem satırında ADA tıklamak "bu sayı
// NEREDEN geliyor" der (kaynak · formül · gerekçe), SAYIYA tıklamak onu
// DÜZENLER. Başlık satırlarında ise (md. 5) HEDEF SATIRIN KENDİSİDİR, oku
// değil: 24 px'lik bir ikonu telefonda vurmak zor. Başlığın ilk üç sütunu tek
// bir `<button>`dur ve `grid-cols-subgrid` ile ana ızgaranın raylarına oturur;
// kendi hedefi olan düğmeler (satır ekle · teknik özelliğe yaz) o düğmenin
// DIŞINDA kardeş kalır — iç içe `<button>` HTML'de geçersizdir.
//
// ————————————————————————————————————————————————— RENK (md. 3)
//
// Üç kanal, ÜÇÜ DE AYRI SÜTUNDA yaşar ve hiçbiri tek taşıyıcı değildir:
//   · BANT BAŞLIĞI — bandın ton açısı (`BANT_TONLARI`), `.oc-fieldgroup`.
//   · AĞIRLIK SÜTUNU — kilonun ISISI (`.oc-amount`), en büyük KALEM tabanlı;
//     büyüklük ayrıca yazının kalınlığıyla da verilir (`costAmountWeight`).
//   · ROZET — kaynağın tonu (`AGIRLIK_KAYNAK_TONLARI`) ve kaynağın ADI.
// Sapma şeridi ayrıca yeşil/kırmızı zeminlidir ve yüzdeyi YAZIYLA söyler.

import { useMemo, useState } from "react";
import { Plus, RotateCcw, Trash2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SayiKutusu } from "@/components/sayi-kutusu";
import { TAM_BOY_PENCERE } from "@/components/pencere";
import { costAmountLevel, costAmountWeight } from "@/lib/offers/cost/heat";
import {
  AGIRLIK_KAYNAK_ETIKETLERI,
  AGIRLIK_KAYNAK_TONLARI,
  AGIRLIK_SAPMA_SINIRI,
  AGIRLIK_SERBEST_ON_EKI,
  AGIRLIK_SERBEST_SINIRI,
  type AgirlikBandi,
  type AgirlikDokumu,
  type AgirlikDokumuDurumu,
  type AgirlikGrubu,
  type AgirlikKalemi,
  type AgirlikSerbestKalem,
  type AgirlikSpecAnahtari,
} from "@/lib/weights/types";

/**
 * TEK IZGARA TANIMI — üç satır türü de bunu okur (md. 6).
 *
 * Telefonda ağırlık sütunu 6 rem'e, durum sütunu 5,5 rem'e iner ve metinler
 * kırpılır; sütun SAYISI değişmez, çünkü başlık düğmesi `col-span-3` ile
 * ızgaraya oturuyor ve kırılma noktasında sütun sayısı değişse ray sayısı
 * tutmazdı.
 */
const IZGARA =
  "grid items-center gap-x-1.5 sm:gap-x-3 " +
  // TELEFONDA DURUM SÜTUNU KAPANIR (`0px` ray) ve metni ADIN ALTINA iner:
  // 375 px'te dört gerçek sütun, adı "T…" hâline getiriyordu ve satırın
  // kimliği kayboluyordu. Ray SAYISI değişmez — başlık düğmesi `col-span-3`
  // ile ızgaraya oturuyor ve kırılma noktasında ray sayısı değişse hizalama
  // tutmazdı.
  // SON RAY TELEFONDA ÖLÇÜLÜDÜR, `auto` DEĞİL: `minmax(0,1fr)` komşusunun
  // yanında `auto` ray sıfıra çöküyor ve rozet satırın dışına taşıyordu
  // (ölçüldü: satır 324 px, içerik 354 px). Genişte ad rayı `fr` olmadığı için
  // sorun doğmuyor ve `auto` kalıyor.
  "grid-cols-[5rem_minmax(0,1fr)_0px_5.25rem] " +
  // GENİŞ EKRANDA AD SÜTUNU ESNEK DEĞİL SABİTTİR: esnek olsaydı durum sütunu
  // pencerenin sağ kenarına yapışırdı ve istenen "satır ortasında bir sütun"
  // olmazdı. Ad 22 rem'de kırpılır; tamamı adın kendi `title`ında durur.
  "sm:grid-cols-[9rem_minmax(0,22rem)_minmax(0,1fr)_auto]";

/** Orta sütun metni — geniş ekranda kendi rayında, telefonda adın altında. */
function DurumMetni({
  metin,
  uyari,
  baslik,
  className,
}: {
  metin: string;
  uyari: boolean;
  baslik?: string;
  className?: string;
}) {
  if (!metin) return null;
  return (
    <span
      className={cn(
        "min-w-0 truncate text-[11px]",
        uyari ? "text-destructive" : "text-muted-foreground",
        className
      )}
      title={baslik ?? metin}
    >
      {metin}
    </span>
  );
}

/** Başlıkların tıklanabilir gövdesi — ana ızgaranın ilk üç rayına oturur. */
const BASLIK_DUGMESI =
  "col-span-3 grid grid-cols-subgrid items-center gap-x-2 sm:gap-x-3 " +
  "min-h-9 rounded-sm text-left transition-colors hover:bg-muted/60 " +
  "pointer-coarse:min-h-11";

/**
 * BANT TON AÇILARI — hangi bantta olduğun bir bakışta okunsun.
 *
 * Rozet tonlarıyla (`AGIRLIK_KAYNAK_TONLARI`) sayı olarak kesişebilirler ama
 * karışmazlar: biri sayfada beş kez ve büyük bir başlık şeridinde, öteki her
 * satırda ve ADIYLA BİRLİKTE küçük bir çipte durur. Renk hiçbirinde tek
 * taşıyıcı değildir.
 */
const BANT_TONLARI: Readonly<Record<string, number>> = {
  bridge: 240,
  trolley: 150,
  auxTrolley: 65,
  mono1Trolley: 310,
  mono2Trolley: 25,
};

const ton = (hue: number | undefined): React.CSSProperties | undefined =>
  hue === undefined ? undefined : ({ "--oc-hue": `${hue}` } as React.CSSProperties);

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

const tonKg = (v: number | null | undefined): string =>
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

/** Kalem satırının ORTA SÜTUNUNA basılan metin (md. 6). */
function kalemDurumu(kalem: AgirlikKalemi): { metin: string; uyari: boolean } {
  if (kalem.kapsandi) return { metin: "hat tahminine dâhil", uyari: false };
  if (kalem.kg === null) return { metin: kalem.kisaDurum ?? "ağırlık yok", uyari: true };
  if (kalem.ezildi) return { metin: "elle verildi", uyari: false };
  if (kalem.adet !== null && kalem.adet > 1 && kalem.birimKg !== null) {
    return { metin: `${kalem.adet} × ${kg(kalem.birimKg)} kg`, uyari: false };
  }
  if (kalem.adet !== null && kalem.adet > 1) return { metin: `${kalem.adet} adet`, uyari: false };
  return { metin: "", uyari: false };
}

/** Grup başlığının ORTA SÜTUNU — üç etiket TEK sütunda, ayraçla. */
function grupDurumu(grup: AgirlikGrubu): { metin: string; uyari: boolean } {
  const parcalar: string[] = [];
  if (grup.eksikKalemSayisi > 0) parcalar.push(`${grup.eksikKalemSayisi} kalem eksik`);
  if (grup.gizliDusenSayisi > 0) parcalar.push(`${grup.gizliDusenSayisi} satır gizli`);
  if (grup.ezildi) parcalar.push("toplam elle");
  return { metin: parcalar.join(" · "), uyari: grup.eksikKalemSayisi > 0 };
}

function KaynakRozeti({ kalem }: { kalem: AgirlikKalemi }) {
  return (
    <span
      className="oc-tag shrink-0 rounded-sm px-1.5 py-px text-[11px] leading-tight"
      style={ton(AGIRLIK_KAYNAK_TONLARI[kalem.kaynak])}
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

/**
 * ISI — ağırlık sütununun tek renk kanalı; YALNIZ KALEM SATIRLARINDA.
 *
 * Grup ve bant toplamları ısı ALMAZ: bir grup toplamı neredeyse her zaman en
 * ağır kalemden büyüktür, ölçek orada tavana yapışır ve bütün başlıklar aynı
 * kırmızıyı alırdı — yani hiçbir şey söylemezdi. Başlıkların kendi ayrımı
 * zaten var (bant tonu, kalın mono yazı).
 *
 * SEVİYE `null` İSE SINIF DA VERİLMEZ: `.oc-amount` tanımsız `--oc-level`i `0`
 * okur ve bilinmeyen bir kiloyu "en soğuk" renkle boyardı — bilinmeyeni küçük
 * göstermek (değişmez md. 4).
 */
function isi(deger: number | null, enBuyuk: number) {
  const seviye = costAmountLevel(deger, enBuyuk);
  if (seviye === null) return { sinif: "", stil: undefined, baslik: undefined };
  return {
    sinif: cn("oc-amount", costAmountWeight(seviye)),
    stil: { "--oc-level": `${seviye}` } as React.CSSProperties,
    baslik: `Dökümün en ağır kaleminin %${Math.round(((deger ?? 0) / enBuyuk) * 100)}'i`,
  };
}

function Satir({
  kalem,
  enBuyuk,
  readOnly,
  onEzme,
  onSerbestDegis,
  onSerbestSil,
}: {
  kalem: AgirlikKalemi;
  enBuyuk: number;
  readOnly?: boolean;
  onEzme: (key: string, deger: number | null) => void;
  onSerbestDegis: (id: string, yama: Partial<AgirlikSerbestKalem>) => void;
  onSerbestSil: (id: string) => void;
}) {
  const durum = kalemDurumu(kalem);
  const serbest = kalem.serbestId !== undefined;
  const s = isi(kalem.kg, enBuyuk);
  return (
    <div
      className={cn(
        IZGARA,
        "border-t px-2 py-1 text-sm",
        kalem.gizliBolumden && "opacity-60",
        // Eksik ağırlık RENKSİZ DEĞİL SOLUK ZEMİNLİDİR: ısı ölçeği "bilinmiyor"
        // için renk vermez (doğru), ama satırın kendisi taranırken kaybolmasın.
        kalem.kg === null && !kalem.kapsandi && "bg-muted/40"
      )}
    >
      {/* 1 · AĞIRLIK — EN SOLDA ve düzenlenebilir. */}
      <div className="flex min-w-0 items-center gap-1" style={s.stil}>
        <SayiKutusu
          value={kalem.kg}
          onChange={(v) =>
            serbest ? onSerbestDegis(kalem.serbestId!, { kg: v }) : onEzme(kalem.key, v)
          }
          disabled={readOnly}
          aria-label={`${kalem.label} ağırlığı [kg]`}
          title={s.baslik}
          className={cn(
            "h-8 w-full min-w-0 px-1.5 text-right font-mono tabular-nums sm:px-2",
            s.sinif,
            kalem.ezildi && "border-primary/50 bg-primary/5"
          )}
        />
        <span className="shrink-0 text-[10px] text-muted-foreground">kg</span>
      </div>

      {/* 2 · AD — otomatik satırda popover, serbest satırda düzenlenebilir.
          Telefonda durum metni de bu sütunda, adın ALTINDA durur. */}
      {serbest ? (
        <div className="grid min-w-0 gap-0.5">
          <Input
            value={kalem.label === "Adsız kalem" ? "" : kalem.label}
            onChange={(e) => onSerbestDegis(kalem.serbestId!, { ad: e.target.value })}
            disabled={readOnly}
            placeholder="Kalem adı"
            aria-label="Elle açılan kalemin adı"
            className="h-8 min-w-0 text-sm"
          />
          <DurumMetni {...durum} baslik={kalem.gerekce} className="sm:hidden" />
        </div>
      ) : (
        <div className="grid min-w-0 gap-0.5">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="oc-tap min-w-0 truncate text-left hover:text-primary"
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
              {kalem.kgUst !== undefined && kalem.kgUst !== kalem.kg ? (
                <>
                  <dt>Üst sınır</dt>
                  <dd className="font-mono tabular-nums">{kg(kalem.kgUst)} kg</dd>
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
        <DurumMetni {...durum} baslik={kalem.gerekce} className="sm:hidden" />
        </div>
      )}

      {/* 3 · DURUM — orta sütun; ağırlığın yanında değil kendi rayında. */}
      <DurumMetni {...durum} baslik={kalem.gerekce} className="max-sm:hidden" />

      {/* 4 · ROZET VE EYLEM */}
      <div className="flex shrink-0 items-center gap-1">
        <KaynakRozeti kalem={kalem} />
        {serbest && !readOnly ? (
          <button
            type="button"
            onClick={() => onSerbestSil(kalem.serbestId!)}
            title="Elle açılan satırı sil"
            aria-label={`${kalem.label} — elle açılan satırı sil`}
            className="oc-tap-square inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </button>
        ) : kalem.ezildi && !readOnly ? (
          <button
            type="button"
            onClick={() => onEzme(kalem.key, null)}
            title="Elle girilen değeri geri al"
            aria-label={`${kalem.label} — elle girilen değeri geri al`}
            className="oc-tap-square inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
          </button>
        ) : (
          // YUVA HER SATIRDA AYRILIR: eylemi olmayan satırda sütun daralsaydı
          // rozetler satırdan satıra kayardı.
          <span className="size-6" aria-hidden />
        )}
      </div>
    </div>
  );
}

function Grup({
  grup,
  enBuyuk,
  readOnly,
  ayakYuksekligiM,
  onAyakYuksekligi,
  onEzme,
  onSerbestEkle,
  onSerbestDegis,
  onSerbestSil,
}: {
  grup: AgirlikGrubu;
  enBuyuk: number;
  readOnly?: boolean;
  ayakYuksekligiM?: number;
  onAyakYuksekligi: (v: number | null) => void;
  onEzme: (key: string, deger: number | null) => void;
  onSerbestEkle: (grupKey: string) => void;
  onSerbestDegis: (id: string, yama: Partial<AgirlikSerbestKalem>) => void;
  onSerbestSil: (id: string) => void;
}) {
  const [kapali, setKapali] = useState(true);
  const durum = grupDurumu(grup);
  // AYAK YÜKSEKLİĞİ hiçbir hesap bölümünde sorulmuyor; portal grubunun kendi
  // girdisidir ve grup gövdesinin başında durur (bkz. `AgirlikDokumuDurumu`).
  const ayakGrubu = grup.key.endsWith(".legs");
  return (
    <section className="rounded-md border">
      <header className={cn(IZGARA, "px-2 py-1")}>
        <button
          type="button"
          onClick={() => setKapali((k) => !k)}
          aria-expanded={!kapali}
          title={kapali ? `${grup.label} — aç` : `${grup.label} — daralt`}
          className={BASLIK_DUGMESI}
        >
          <span className="flex min-w-0 items-center justify-end gap-1 font-mono text-sm font-medium tabular-nums">
            {grup.eksikKalemSayisi > 0 && grup.kg !== null ? "≥" : ""}
            {kg(grup.kg)}
            <span className="text-[10px] font-normal text-muted-foreground">kg</span>
          </span>
          <span className="grid min-w-0 gap-0.5">
            <span className="flex min-w-0 items-center gap-1.5">
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  kapali && "-rotate-90"
                )}
              />
              <span className="min-w-0 truncate text-sm font-medium">{grup.label}</span>
            </span>
            <DurumMetni {...durum} className="sm:hidden" />
          </span>
          <DurumMetni {...durum} className="max-sm:hidden" />
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {readOnly ? (
            <span className="size-6" aria-hidden />
          ) : (
            <button
              type="button"
              onClick={() => {
                setKapali(false);
                onSerbestEkle(grup.key);
              }}
              title={`${grup.label} grubuna elle satır ekle`}
              aria-label={`${grup.label} grubuna elle satır ekle`}
              className="oc-tap-square inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Plus className="size-3.5" />
            </button>
          )}
        </div>
      </header>
      {kapali ? null : (
        <div className={cn(grup.ezildi && "opacity-55")}>
          {ayakGrubu ? (
            <label className="flex flex-wrap items-center gap-2 border-t bg-muted/30 px-2 py-1.5 text-xs">
              <span className="text-muted-foreground">Ayak yüksekliği [m]</span>
              <SayiKutusu
                value={ayakYuksekligiM ?? null}
                onChange={onAyakYuksekligi}
                disabled={readOnly}
                aria-label="Portal ayak yüksekliği [m]"
                className="h-8 w-24 text-right font-mono tabular-nums"
              />
              <span className="text-[11px] text-muted-foreground">
                Ray üstünden ana kiriş alt başlığına. Hesap bölümlerinde sorulmuyor; ayak
                ve merdiven ağırlıkları bu ölçüden türer.
              </span>
            </label>
          ) : null}
          {grup.kalemler.map((kalem) => (
            <Satir
              key={kalem.key}
              kalem={kalem}
              enBuyuk={enBuyuk}
              readOnly={readOnly}
              onEzme={onEzme}
              onSerbestDegis={onSerbestDegis}
              onSerbestSil={onSerbestSil}
            />
          ))}
          {grup.kalemler.length === 0 ? (
            <p className="border-t px-2 py-2 text-[11px] text-muted-foreground">
              Bu grupta tartılan kalem yok.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

function Bant({
  bant,
  enBuyuk,
  acikBaslangic,
  readOnly,
  durum,
  onEzme,
  onSpecYaz,
  onAyakYuksekligi,
  onSerbestEkle,
  onSerbestDegis,
  onSerbestSil,
}: {
  bant: AgirlikBandi;
  enBuyuk: number;
  acikBaslangic: boolean;
  readOnly?: boolean;
  durum: AgirlikDokumuDurumu;
  onEzme: (key: string, deger: number | null) => void;
  onSpecYaz?: (specKey: AgirlikSpecAnahtari, kg: number) => void;
  onAyakYuksekligi: (v: number | null) => void;
  onSerbestEkle: (bantKey: string, grupKey: string) => void;
  onSerbestDegis: (id: string, yama: Partial<AgirlikSerbestKalem>) => void;
  onSerbestSil: (id: string) => void;
}) {
  const [kapali, setKapali] = useState(!acikBaslangic);
  const sapiyor = bant.farkOrani !== null && Math.abs(bant.farkOrani) > AGIRLIK_SAPMA_SINIRI;
  const tutuyor = bant.farkOrani !== null && !sapiyor;
  const bantTonu = ton(BANT_TONLARI[bant.key]);
  const ayakOzeti = {
    metin: bant.disKg !== null ? `+ ${kg(bant.disKg)} kg ayak` : "",
    uyari: false,
  };
  return (
    <section className="grid gap-2 rounded-lg border p-2 sm:p-3">
      <div
        className={cn(IZGARA, "oc-fieldgroup rounded-sm px-2 py-1.5")}
        style={bantTonu}
      >
        <button
          type="button"
          onClick={() => setKapali((k) => !k)}
          aria-expanded={!kapali}
          title={kapali ? `${bant.label} — aç` : `${bant.label} — daralt`}
          className={BASLIK_DUGMESI}
        >
          <span className="flex min-w-0 items-center justify-end gap-1 font-mono text-sm font-semibold tabular-nums">
            {bant.eksikKalemSayisi > 0 && bant.kg !== null ? "≥" : ""}
            {kg(bant.kg)}
            <span className="text-[10px] font-normal text-muted-foreground">kg</span>
          </span>
          <span className="grid min-w-0 gap-0.5">
            <span className="flex min-w-0 items-center gap-1.5">
              <ChevronDown
                className={cn("size-4 shrink-0 transition-transform", kapali && "-rotate-90")}
              />
              <span className="oc-kicker oc-fieldgroup-title min-w-0 truncate" style={bantTonu}>
                {bant.label}
              </span>
            </span>
            <DurumMetni {...ayakOzeti} className="sm:hidden" />
          </span>
          <DurumMetni {...ayakOzeti} className="max-sm:hidden" />
        </button>
        <span className="size-6 shrink-0" aria-hidden />
      </div>

      {bant.specKey ? (
        <div
          className={cn(
            "flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md px-2 py-1.5 text-xs",
            // Sapma ŞERİDİ RENKLENİR: tutuyorsa yeşil, aşıyorsa kırmızı, veri
            // yoksa nötr. Renk tek taşıyıcı değil — yüzde zaten yazıyla duruyor.
            sapiyor
              ? "bg-destructive/10"
              : tutuyor
                ? "bg-success/10"
                : "bg-muted/50"
          )}
        >
          <span className="text-muted-foreground">
            Tahmini <span className="font-mono tabular-nums">{tonKg(bant.tahminiKg)} t</span>
          </span>
          <span className="text-muted-foreground">
            Dökümden <span className="font-mono tabular-nums">{tonKg(bant.kg)} t</span>
          </span>
          <span
            className={cn(
              "font-mono tabular-nums",
              sapiyor ? "font-semibold text-destructive" : "text-muted-foreground"
            )}
          >
            {yuzde(bant.farkOrani)}
            {sapiyor ? " · sapma sınırının üstünde" : ""}
          </span>
          {bant.tahminIcerir ? <span className="text-muted-foreground">· tahmin içerir</span> : null}
          {/* AYAKLAR KUTUYA GİRMEZ ve bu ŞERİTTE yazılır: aksi hâlde mühendis
              "dökümden" sayısını vincin köprü tarafının tamamı sanardı. */}
          {bant.disKg !== null ? (
            <span className="text-muted-foreground">
              · ayaklar <span className="font-mono tabular-nums">{tonKg(bant.disKg)} t</span> kutuya
              girmez
            </span>
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
            <Grup
              key={grup.key}
              grup={grup}
              enBuyuk={enBuyuk}
              readOnly={readOnly}
              ayakYuksekligiM={durum.ayakYuksekligiM}
              onAyakYuksekligi={onAyakYuksekligi}
              onEzme={onEzme}
              onSerbestEkle={(grupKey) => onSerbestEkle(bant.key, grupKey)}
              onSerbestDegis={onSerbestDegis}
              onSerbestSil={onSerbestSil}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** Bir sonraki serbest satır kimliği — `serbest-1`, `serbest-2`… */
function sonrakiSerbestId(mevcut: readonly AgirlikSerbestKalem[]): string {
  let enBuyuk = 0;
  for (const s of mevcut) {
    const n = Number.parseInt(s.id.slice(AGIRLIK_SERBEST_ON_EKI.length), 10);
    if (Number.isFinite(n) && n > enBuyuk) enBuyuk = n;
  }
  return `${AGIRLIK_SERBEST_ON_EKI}${enBuyuk + 1}`;
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
  /** Hangi bant öne gelsin — verilmezse hepsi açık gelir. */
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

  const serbestler = durum.serbest ?? [];
  const onSerbestEkle = (bantKey: string, grupKey: string) => {
    if (serbestler.length >= AGIRLIK_SERBEST_SINIRI) return;
    // Grup anahtarı `<bant>.<grup>` biçimindedir; defterin grup adı son parçadır.
    const grup = grupKey.slice(bantKey.length + 1);
    onDurum({
      ...durum,
      serbest: [
        ...serbestler,
        { id: sonrakiSerbestId(serbestler), bant: bantKey, grup, ad: "", adet: 1, kg: null },
      ],
    });
  };
  const onSerbestDegis = (id: string, yama: Partial<AgirlikSerbestKalem>) => {
    onDurum({
      ...durum,
      serbest: serbestler.map((s) => (s.id === id ? { ...s, ...yama } : s)),
    });
  };
  const onSerbestSil = (id: string) => {
    onDurum({ ...durum, serbest: serbestler.filter((s) => s.id !== id) });
  };
  const onAyakYuksekligi = (v: number | null) => {
    const next = { ...durum };
    if (v === null || !Number.isFinite(v) || v <= 0) delete next.ayakYuksekligiM;
    else next.ayakYuksekligiM = v;
    onDurum(next);
  };

  const ezmeSayisi = useMemo(() => Object.keys(durum.overrides ?? {}).length, [durum.overrides]);

  /**
   * ISI TABANI: dökümün EN AĞIR KALEMİ, bir kez hesaplanır ve aşağı geçirilir.
   *
   * Grup içi bir taban, 500 kg'lık bir grubun en büyük satırını 9 tonluk ana
   * kirişle aynı kırmızıda gösterirdi (`heat.ts`in kendi gerekçesi).
   */
  const enBuyuk = useMemo(() => {
    let en = 0;
    for (const b of dokum.bantlar) {
      for (const g of b.gruplar) {
        for (const k of g.kalemler) if (k.kg !== null && k.kg > en) en = k.kg;
      }
    }
    return en;
  }, [dokum]);

  return (
    <Dialog open={acik} onOpenChange={onOpenChange}>
      <DialogContent className={`${TAM_BOY_PENCERE} sm:max-w-[min(64rem,calc(100%-2rem))]`}>
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
            {tonKg(dokum.kg)} t
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
              enBuyuk={enBuyuk}
              acikBaslangic={acilanBant === undefined || acilanBant === bant.key}
              readOnly={readOnly}
              durum={durum}
              onEzme={onEzme}
              onSpecYaz={onSpecYaz}
              onAyakYuksekligi={onAyakYuksekligi}
              onSerbestEkle={onSerbestEkle}
              onSerbestDegis={onSerbestDegis}
              onSerbestSil={onSerbestSil}
            />
          ))}
        </div>

        {dokum.notlar.length > 0 || ezmeSayisi > 0 || serbestler.length > 0 ? (
          <ul className="grid gap-1 border-t pt-2 text-[11px] text-muted-foreground">
            {dokum.notlar.map((not) => (
              <li key={not}>{not}</li>
            ))}
            {ezmeSayisi > 0 ? <li>{ezmeSayisi} kalem elle verildi.</li> : null}
            {serbestler.length > 0 ? (
              <li>{serbestler.length} satır elle açıldı; revizyonla birlikte saklanır.</li>
            ) : null}
          </ul>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
