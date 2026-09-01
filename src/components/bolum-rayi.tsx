"use client";

// BÖLÜM RAYI — sayfanın sol kenarındaki ince şerit ve açılan bölüm listesi.
//
// Kullanıcı isteği (01.09.2026): "soldan açılan bir menü gibi bir şey…
// daralınca çok ince bir çizgi gibi görünse ama tıklayınca açılsa ve bölüm içi
// gezinmeleri sağlasa — hesap raporunda Anakiriş bölümüne, işletme bakım
// kitabında bir bölüme böyle kolayca gidebileyim."
//
// BU BİLEŞEN DÖRT KOPYANIN YERİNE GEÇER: hesap raporu editörünün gömülü rayı
// (dar/geniş kip + alt tabaka), teklif editörünün 13rem'lik sabit sütunu,
// maliyet editörünün 11rem'lik sütunu ve el kitabının belge haritası. Dördü de
// aynı işi yapıyordu ve İKİSİNDE DAR EKRANDA GEZİNME HİÇ YOKTU.
//
// ---------------------------------------------------------------------------
// DÖRT KARAR VE ÖLÇÜLMÜŞ GEREKÇELERİ
// ---------------------------------------------------------------------------
//
// 1. TEK SEVİYE. Kullanıcı kararı: "bölüm + alt başlık olmasın, sadece bölüm
//    olsun. çok alt başlık var, çok yer kaplıyor." Ray bir İÇİNDEKİLER değil,
//    sıçrama menüsüdür. Adım/alt başlık düzeyi KAYBOLMAZ, ARAMAYA taşınır:
//    arama sonucu DÜZ bir listedir, ikinci bir düzey değildir.
//
// 2. VARSAYILAN KAPALI, HER GENİŞLİKTE AYNI. Masaüstünde de kalıcı sütun
//    açılmaz. Tek davranış öğrenmesi kolaydır ve içerik hep tam genişliktir.
//
// 3. DURUM RENKLE DEĞİL GEOMETRİYLE ANLATILIR. `--primary` (oklch 0.467 0.17
//    27) ile `--destructive` (0.516 0.167 26) BİR DERECE arayla aynı kırmızıdır
//    (globals.css 66/74). 16px'lik bir çentikte ayırt edilemezler. Üç ayrı
//    geometri kullanılır: aktif = TAM GENİŞLİK + İKİ KAT BOY, uyarı = tam
//    genişlik, nötr = yarım genişlik. 16/8 px farkı ölçülebilir, 1° hue değil.
//
// 4. ŞERİT DAR EKRANDA `fixed`, GENİŞ EKRANDA `sticky`. Bu bir üslup tercihi
//    değil, ölçülmüş bir zorunluluktur:
//    - `revision-page-view.tsx:87` ve `offers/layout.tsx` editörü DOLGUSUZ bir
//      `overflow-x-hidden` kaba sarıyor. MOBIL-14'ün mekanizması: `overflow-x`
//      `overflow-y`yi de `auto` yapar, yani o kap bir KAYDIRMA KABIDIR. `lg`
//      altında yüksekliği `auto` olduğu için hiç kaymaz — içindeki `sticky`
//      çocuk da hiç yapışmaz. Bu yüzden dar ekranda şerit `fixed`tir.
//    - Aynı kapların dolgusu YOKTUR, yani padding kutusunun sol kenarı içerik
//      kenarıdır: NEGATİF KENAR BOŞLUĞU KIRPILIR. Ray bu yüzden `-ml-*`
//      TAŞIMAZ; dar ekranda ekranın gerçek kenarına `fixed` ile gider.
//    - `position: fixed` overflow tarafından kırpılmaz (kapsayıcı blok görünür
//      alandır) — ata zincirinde `transform`/`filter` YOKTUR, doğrulandı.
//
// 5. GENİŞ EKRANDA AKIŞTA DURUR, EKRANA SABİTLENMEZ. `fixed` olsaydı üçünün
//    üstüne binerdi: revizyon ekranlarında kabuk kenar çubuğu zaten 4,5rem'lik
//    dar bir menüdür (hesap.md), `sticky left-0` ile çivilenmiş tablo sütunları
//    var (yetki ızgarası, sarf analizi, worklog pivotu), ve sabit çerçeve
//    rotalarında `main` `lg:overflow-hidden`dır.

import { useCallback, useId, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { trKatla } from "@/lib/drawings/tr-text";
import { useOverlay } from "@/lib/use-overlay";
import { cn } from "@/lib/utils";

/** Rayda tek bir satır. ALT ÖĞE YOKTUR — ray tek seviyelidir. */
export interface BolumOgesi {
  /** Kararlı kimlik: adım anahtarı, bölüm id'si, panel anahtarı. */
  id: string;
  /** "07", "2.1", "EK-C" — mono çip. Verilmezse çip basılmaz. */
  numara?: string;
  baslik: string;
  /**
   * Bölüm belgeye girmiyor: teklifte gizlenmiş bölüm, hesapta kapatılmış modül.
   * Soluk çizilir ve UYARISI YAKILMAZ — rapora hiç girmeyen bir bölümün kalan
   * kontrolü sorun değildir.
   */
  gizli?: boolean;
  /** Kontrolü kalan ya da eksik alan taşıyan bölüm. */
  uyari?: boolean;
  /** Satır sonundaki serbest rozet — "8/9", "kapalı". */
  rozet?: string;
  /**
   * Satır sonundaki İKİNCİL EYLEM — teklifin göz düğmesi, modülün ＋/－
   * anahtarı. Gezinme değildir ama gezinme listesinden ayrı bir yere konulamaz:
   * kapalı bir modül yalnız kendi satırından tekrar açılabilir.
   */
  sag?: React.ReactNode;
}

export interface BolumRayiAramasi {
  deger: string;
  onDegisti: (q: string) => void;
  ipucu?: string;
  /**
   * Arama sonucu — verilirse `ogeler` yerine BU basılır. Sonuçları ÇAĞIRAN
   * hesaplar: hesap raporunda arama 117 ADIMA bakar, el kitabında ağaca; ikisi
   * de bu bileşenin bilmediği şeylerdir. Verilmezse `ogeler` ada göre süzülür.
   */
  sonuclar?: readonly BolumOgesi[];
}

export function BolumRayi({
  ogeler,
  aktifId,
  onSec,
  etiket,
  arama,
  ozet,
  govde,
  altEk,
  acik: acikDisari,
  onAcikDegisti,
  panelId: panelIdDisari,
  className,
}: {
  /**
   * Şeridin çentikleri ve erişilebilir adı buradan okunur. `govde` verilse bile
   * ZORUNLUDUR.
   */
  ogeler: readonly BolumOgesi[];
  aktifId: string | null;
  onSec: (id: string) => void;
  /** `aria-label` ve tabaka başlığı: "Hesap bölümleri", "Teklif bölümleri". */
  etiket: string;
  arama?: BolumRayiAramasi;
  /** Tabaka başlığının sağındaki özet — ör. "84/117 uygun". */
  ozet?: React.ReactNode;
  /**
   * VARSAYILAN LİSTENİN YERİNE geçen gövde — el kitabının `DocumentMap` ağacı.
   * KITAP-19 "ağacı kısaltmak değil SÜZMEK" der ve 30.08.2026'da tam bunun
   * tersi bir arayüz geri alınmıştır; ray şeridi tek düzeydir ama panelin
   * gövdesi ağacın tamamı kalabilir.
   */
  govde?: React.ReactNode;
  /** Listenin altındaki serbest alan — ör. "Kalem Ekle". */
  altEk?: React.ReactNode;
  /** Dışarıdan denetim: başka bir düğme de (alt kumanda çubuğu) tabakayı açar. */
  acik?: boolean;
  onAcikDegisti?: (acik: boolean) => void;
  /** Dışarıdaki açıcının `aria-controls` verebilmesi için sabit kimlik. */
  panelId?: string;
  className?: string;
}) {
  const otoId = useId();
  const panelId = panelIdDisari ?? `bolum-rayi-${otoId}`;
  const [icAcik, setIcAcik] = useState(false);
  const acik = acikDisari ?? icAcik;

  const panelRef = useRef<HTMLDivElement | null>(null);

  const setAcik = useCallback(
    (deger: boolean) => {
      setIcAcik(deger);
      onAcikDegisti?.(deger);
    },
    [onAcikDegisti]
  );

  const aramaDegisti = arama?.onDegisti;
  const kapat = useCallback(() => {
    setAcik(false);
    // Kapanırken arama sıfırlanır: aksi hâlde tabaka bir dahaki açılışta
    // süzülmüş gelir ve kullanıcı bölümlerin "kaybolduğunu" sanır.
    aramaDegisti?.("");
  }, [setAcik, aramaDegisti]);

  useOverlay(acik, kapat, panelRef);

  const sorgu = arama ? trKatla(arama.deger) : "";
  /**
   * Listelenen satırlar. Arama boşken HER ZAMAN `ogeler`dir — tabaka bölüm
   * listesi olarak açılır ve tek seviye kararı korunur.
   */
  const listelenen = useMemo<readonly BolumOgesi[]>(() => {
    if (!arama || sorgu === "") return ogeler;
    if (arama.sonuclar) return arama.sonuclar;
    return ogeler.filter((o) => trKatla(o.baslik).includes(sorgu));
  }, [arama, ogeler, sorgu]);

  const aktifSira = ogeler.findIndex((o) => o.id === aktifId);
  const aktifOge = aktifSira >= 0 ? ogeler[aktifSira] : undefined;

  function sec(id: string) {
    onSec(id);
    kapat();
  }

  return (
    // AKIŞTA DAR BİR SÜTUN. Dar ekranda şerit `fixed` olsa da bu kutu yerini
    // korur: içerik şeridin altına kaymaz. NEGATİF KENAR BOŞLUĞU YOKTUR
    // (dolgusuz `overflow-x-hidden` sarmalayıcılar onu kırpardı).
    <div className={cn("relative w-4 shrink-0 print:hidden", className)}>
      {/*
        KONUMLANDIRAN KUTU — tabakanın kapsayıcı bloğu (MOBIL-18).
        `max-lg:fixed`: dar ekranda `sticky` ÇALIŞMAZ (bkz. dosya başlığı, 4.
        madde). Şerit başlığın altından ekranın dibine kadar iner; `--app-header-h`
        ÖLÇÜLMÜŞ değerdir, 48px varsayılmaz (başlık `lg` altında iki satır olur).
        `lg:sticky` + `dvh` (`vh` DEĞİL, MOBIL-3); `lg:max-h-full` sabit çerçeve
        rotalarında (`lg:h-dvh lg:overflow-hidden`) kelepçedir.
      */}
      <div
        className={cn(
          "max-lg:fixed max-lg:bottom-0 max-lg:left-0 max-lg:top-[var(--app-header-h,48px)] max-lg:w-4",
          "lg:sticky lg:top-[var(--app-header-h,48px)] lg:h-[calc(100dvh-var(--app-header-h,48px))] lg:max-h-full",
          // Kapalıyken içeriğin üstünde ama yapışkan alt kumandanın (z-20)
          // altında; açıkken kabuğun kenar çubuğu (z-40) dâhil her şeyin üstünde.
          // Kutu tek bir yığın bağlamıdır: örtü ve tabaka onun İÇİNDE sıralanır.
          acik ? "z-40" : "z-10"
        )}
      >
        <button
          type="button"
          onClick={() => setAcik(!acik)}
          aria-haspopup="dialog"
          aria-expanded={acik}
          aria-controls={panelId}
          aria-label={
            aktifOge
              ? `${etiket} — ${aktifSira + 1}/${ogeler.length}: ${aktifOge.baslik}`
              : `${etiket} — listeyi aç`
          }
          title={
            aktifOge
              ? `${etiket} · ${aktifSira + 1}/${ogeler.length} · ${aktifOge.baslik}`
              : `${etiket} — listeyi aç`
          }
          className="oc-tap-square group/ray flex h-full w-full flex-col items-center justify-center gap-px border-r border-border bg-card/60 px-[3px] py-2 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        >
          {/*
            ÇENTİKLER BİLGİ TAŞIR: kaç bölüm var, kaçıncıdasın, hangisinde sorun
            kaldı. Ama AYRI DOKUNMA HEDEFİ DEĞİLDİR — 19 çentik 600px'lik bir
            şeritte 30px'e denk gelir ve `.oc-tap` üst üste dizili kardeşlerde
            komşunun dokunuşunu yutar (MOBIL-28). Şeridin TAMAMI tek düğmedir ve
            bilgi düğmenin `aria-label`ındadır; çentikler `aria-hidden`dır.
          */}
          {ogeler.map((o) => {
            const secili = o.id === aktifId;
            return (
              <span
                key={o.id}
                aria-hidden
                className={cn(
                  "min-h-[2px] shrink transition-all",
                  // ÜÇ AYRI GENİŞLİK KADEMESİ (10 · 6 · 3 px) + aktifte iki kat
                  // boy. Aktifi renkten ayırmak İMKÂNSIZ olduğu için (primary ve
                  // destructive bir derece arayla aynı kırmızı) ayırt edici
                  // GEOMETRİDİR; renk yalnız uyarıyı griden ayırır.
                  secili
                    ? "w-full flex-[2] bg-primary"
                    : o.uyari && !o.gizli
                      ? "w-2/3 flex-1 bg-destructive"
                      : cn("w-1/3 flex-1", o.gizli ? "bg-border/50" : "bg-border"),
                  // Fareyle üstüne gelince bütün çentikler tam genişler:
                  // gri çizgiler yığını böylece "ben bir denetimim" der.
                  !secili && "group-hover/ray:w-full"
                )}
              />
            );
          })}
        </button>

        {/*
          TABAKA KAPALIYKEN HİÇ BASILMAZ. Eski hesap raporu rayı kapalı listeyi
          `translate-y-full` ile ayakta tutuyordu ve 117 görünmez düğmeyi Tab
          sırasından çıkarmak için `inert` yazmak zorundaydı. Basmamak o sorunu
          tamamen kaldırır.
        */}
        {acik ? (
          <>
            <div className="fixed inset-0 bg-foreground/40" onClick={kapat} aria-hidden />
            <div
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-modal="true"
              aria-label={etiket}
              // TABAKA ŞERİDİN KUTUSUNA ASILIR, AKIŞTAKİ SÜTUNA DEĞİL: sütun
              // belge boyunda olabilir ve `inset-y-0` orada tabakayı üç bin
              // piksel yapardı.
              className="absolute inset-y-0 left-0 flex w-[min(20rem,calc(100vw-3rem))] flex-col border-r border-border bg-card shadow-[8px_0_24px_-8px_rgb(0_0_0/0.28)]"
            >
              <div className="flex shrink-0 items-center gap-2 border-b px-2 py-1.5">
                <button
                  type="button"
                  onClick={kapat}
                  aria-label="Bölüm listesini kapat"
                  title="Bölüm listesini kapat"
                  className="oc-tap-square grid size-6 shrink-0 place-items-center font-mono text-[11px] leading-none text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  ✕
                </button>
                <span className="oc-kicker min-w-0 truncate text-muted-foreground">{etiket}</span>
                {ozet ? <span className="ml-auto shrink-0">{ozet}</span> : null}
              </div>

              {arama ? (
                <div className="shrink-0 border-b px-2 py-2">
                  <Input
                    value={arama.deger}
                    onChange={(e) => arama.onDegisti(e.target.value)}
                    placeholder={arama.ipucu ?? "ARA · Bölüm Adı"}
                    aria-label="Bölüm ara"
                    aria-controls={`${panelId}-liste`}
                    // `text-sm` YAZILMAZ: taban `text-base pointer-fine:text-sm`tir
                    // ve elle ezmek iOS Safari'nin odakta otomatik
                    // yakınlaştırmasını geri getiriyor (MOBIL-2/28). `.oc-tap`
                    // girdide çalışmadığı için hedef GERÇEK yüksekliktir.
                    className="h-9 bg-background placeholder:font-mono placeholder:text-xs pointer-coarse:h-10"
                  />
                </div>
              ) : null}

              {govde ? (
                // MOBIL-18: kırpan kap aynı zamanda kapsayıcı bloktur.
                <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-1">
                  {govde}
                </div>
              ) : (
                <ol
                  id={`${panelId}-liste`}
                  className="relative grid min-h-0 flex-1 auto-rows-max gap-0.5 overflow-y-auto overscroll-y-contain p-1 text-sm"
                >
                  {listelenen.length === 0 ? (
                    <li className="px-2 py-3 text-xs text-muted-foreground">Eşleşen bölüm yok.</li>
                  ) : (
                    listelenen.map((o) => {
                      const secili = o.id === aktifId;
                      return (
                        <li key={o.id} className="flex min-w-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => sec(o.id)}
                            aria-current={secili ? "step" : undefined}
                            className={cn(
                              // Telefonda bölüm listesi ANA dokunma hedefidir.
                              "oc-tap flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left transition-colors",
                              secili
                                ? "bg-primary/10 font-medium text-primary"
                                : "text-foreground/80 hover:bg-muted hover:text-foreground"
                            )}
                          >
                            {o.numara ? (
                              <span
                                className={cn(
                                  "inline-flex h-5 min-w-8 shrink-0 items-center justify-center px-1 font-mono text-[11px] tabular-nums",
                                  secili
                                    ? "bg-primary/15 text-primary"
                                    : "bg-muted text-muted-foreground"
                                )}
                              >
                                {o.numara}
                              </span>
                            ) : null}
                            <span
                              className={cn("min-w-0 flex-1 truncate", o.gizli && "opacity-55")}
                              title={o.gizli ? `${o.baslik} (gizli)` : o.baslik}
                            >
                              {o.baslik}
                            </span>
                            {o.rozet ? (
                              <span
                                className={cn(
                                  "shrink-0 font-mono text-[11px] tabular-nums",
                                  o.uyari && !o.gizli ? "text-destructive" : "text-muted-foreground"
                                )}
                              >
                                {o.rozet}
                              </span>
                            ) : null}
                            {/* GİZLİ BÖLÜMÜN UYARISI YAKILMAZ: rapora hiç
                                girmeyen bir bölümün kalan kontrolü sorun değil. */}
                            {!o.rozet && o.uyari && !o.gizli ? (
                              <span
                                aria-label="kontrolü kalan bölüm"
                                title="kontrolü kalan bölüm"
                                className="size-1.5 shrink-0 bg-destructive"
                              />
                            ) : null}
                          </button>
                          {o.sag}
                        </li>
                      );
                    })
                  )}
                </ol>
              )}

              {altEk ? <div className="shrink-0 border-t p-1">{altEk}</div> : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
