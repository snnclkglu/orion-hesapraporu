"use client";

// BÖLÜM RAYI — sayfanın sol kenarındaki ince şerit, açılan tabaka ve geniş
// ekrandaki SABİT SÜTUN.
//
// Kullanıcı isteği (01.09.2026): "soldan açılan bir menü gibi bir şey…
// daralınca çok ince bir çizgi gibi görünse ama tıklayınca açılsa ve bölüm içi
// gezinmeleri sağlasa."
//
// İKİNCİ TUR (01.09.2026, aynı gün): "masaüstünde bu versiyon çok iyi değil…
// daralınca böyle ince çizgi ama genişleyebilen eskisi gibi sabit ve alt
// bölümler de görünen şeklinde olsa iyi olur. mobilde alan dar ancak
// masaüstünde yerimiz var."
//
// BU BİLEŞEN DÖRT KOPYANIN YERİNE GEÇER: hesap raporu editörünün gömülü rayı,
// teklif editörünün 13rem'lik sütunu, maliyet editörünün 11rem'lik sütunu ve
// el kitabının belge haritası.
//
// ---------------------------------------------------------------------------
// ÜÇ KİP, TEK LİSTE
// ---------------------------------------------------------------------------
//
//   genişlik | kapalı        | açık
//   ---------|---------------|------------------------------------------------
//   <1440    | 1rem şerit    | TABAKA (absolute + örtü + useOverlay), modal
//   ≥1440    | 1rem şerit    | SABİT SÜTUN (akışta, 17,5rem, örtü YOK)
//
// Aynı liste iki kez MONTE EDİLMEZ (MOBIL-26): sabit sütun ile tabaka aynı
// düğümdür, yalnız konumu ve genişliği değişir. Kırılım JS'te sorulur
// (`useRaySabitlenebilir`), `hidden` sınıfıyla değil.
//
// ---------------------------------------------------------------------------
// KARARLAR VE ÖLÇÜLMÜŞ GEREKÇELERİ
// ---------------------------------------------------------------------------
//
// 1. ALT BAŞLIKLAR YALNIZ SABİT SÜTUNDA. Dar ekranda kullanıcının kararı
//    değişmedi: "bölüm + alt başlık olmasın, sadece bölüm olsun. çok alt
//    başlık var, çok yer kaplıyor." Şerit çentikleri ve tabaka listesi TEK
//    DÜZEYDİR; `cocuklar` yalnız sabit sütunda çizilir, çünkü orada yer var.
//
// 2. TERCİH "DARALTILDI" OLARAK SAKLANIR, "AÇIK" OLARAK DEĞİL. `useStoredFlag`
//    sunucuda ve ilk karede `false` döner; geniş ekran varsayılanı AÇIK olduğu
//    için bayrağın `false` hâli "açık"a denk gelmelidir. Tersi yazılsaydı ilk
//    kare her seferinde yanlış çizilirdi.
//
// 3. DURUM RENKLE DEĞİL GEOMETRİYLE ANLATILIR. `--primary` (oklch 0.467 0.17
//    27) ile `--destructive` (0.516 0.167 26) BİR DERECE arayla aynı kırmızıdır
//    (globals.css 66/74). 16px'lik bir çentikte ayırt edilemezler. Üç genişlik
//    kademesi kullanılır: aktif tam genişlik + İKİ KAT BOY, uyarı 2/3, nötr 1/3.
//
// 4. ŞERİT DAR EKRANDA `fixed`, GENİŞ EKRANDA `sticky`. `revision-page-view.tsx`
//    ve `offers/layout.tsx` gibi sayfa kabukları içeriği DOLGUSUZ bir
//    `overflow-x-*` kaba sarıyor. `overflow-x: hidden` `overflow-y`yi de `auto`
//    yapar (MOBIL-14) — kap kaydırma kabı olur, `lg` altında yüksekliği `auto`
//    olduğu için hiç kaymaz ve yapışkan çocuk HİÇ YAPIŞMAZ. Kabuklar bu turda
//    `overflow-x-clip`e geçirildi (MOBIL-30) ama şerit dar ekranda yine de
//    `fixed`tir: orada kabuk kenar çubuğu yoktur ve şerit ekranın gerçek
//    kenarına oturmalıdır.
//
// 5. YAPIŞKAN KUTUNUN SARMALAYICISI ESNEK SATIRDA `stretch` OLMALIDIR
//    (MOBIL-31). `items-start` sarmalayıcıyı yapışkan kutunun boyunda tutar,
//    yapışacak yol sıfır olur ve yapışma SESSİZCE ölür.

import { useCallback, useId, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { trKatla } from "@/lib/drawings/tr-text";
import { useRaySabitlenebilir } from "@/lib/use-breakpoint";
import { useOverlay } from "@/lib/use-overlay";
import { useStoredFlag } from "@/lib/use-stored-flag";
import { cn } from "@/lib/utils";

/** Rayda bir satır. `cocuklar` YALNIZ sabit sütunda çizilir. */
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
   * anahtarı, panonun gizle/katla ikilisi. Gezinme değildir ama gezinme
   * listesinden ayrı bir yere konulamaz: kapalı bir bölümü yalnız kendi
   * satırından geri açabilirsin.
   */
  sag?: React.ReactNode;
  /**
   * ALT SATIRLAR — yalnız SABİT SÜTUN kipinde çizilir (MOBIL-29).
   * Şeritte ve tabakada YOKTUR; dar ekranda ray tek düzeydir.
   */
  cocuklar?: readonly BolumOgesi[];
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
  depoAnahtari,
  className,
}: {
  /**
   * Şeridin çentikleri ve erişilebilir adı buradan okunur. `govde` verilse bile
   * ZORUNLUDUR.
   */
  ogeler: readonly BolumOgesi[];
  aktifId: string | null;
  onSec: (id: string) => void;
  /** `aria-label` ve tabaka/sütun başlığı: "Hesap bölümleri". */
  etiket: string;
  arama?: BolumRayiAramasi;
  /** Başlığın sağındaki özet — ör. "84/117 uygun". */
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
  /**
   * Sabitlenme tercihinin `localStorage` anahtarı —
   * `orion.<alan>.ray.daraltildi`. VERİLMEZSE ray hiçbir genişlikte
   * sabitlenmez, her yerde tabaka olarak açılır.
   *
   * Anahtar "DARALTILDI"dır, "açık" değil: `useStoredFlag`in sunucu değeri
   * `false`tur ve geniş ekran varsayılanı AÇIKtır.
   */
  depoAnahtari?: string;
  className?: string;
}) {
  const otoId = useId();
  const panelId = panelIdDisari ?? `bolum-rayi-${otoId}`;
  const [icAcik, setIcAcik] = useState(false);
  const tabakaAcik = acikDisari ?? icAcik;

  const genisEkran = useRaySabitlenebilir();
  // Kanca KOŞULSUZ çağrılır; `depoAnahtari` yoksa değeri kullanılmaz.
  const [daraltildi, daraltmayiDegistir] = useStoredFlag(
    depoAnahtari ?? "orion.ray.daraltildi"
  );
  /** Bu sayfa+genişlik sabitlenmeye izin veriyor mu (şerit ne yapacak?). */
  const sabitlenebilirSayfa = genisEkran && depoAnahtari !== undefined;
  /** Sabit sütun ŞU AN görünür mü. */
  const sabit = sabitlenebilirSayfa && !daraltildi;

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

  // SABİT SÜTUN MODAL DEĞİLDİR: örtü yok, gövde kilidi yok, Esc kapatmaz.
  useOverlay(tabakaAcik && !sabit, kapat, panelRef);

  const sorgu = arama ? trKatla(arama.deger) : "";
  /**
   * Listelenen satırlar. Arama boşken HER ZAMAN `ogeler`dir — liste bölüm
   * listesi olarak açılır ve tek düzey kararı korunur.
   */
  const listelenen = useMemo<readonly BolumOgesi[]>(() => {
    if (!arama || sorgu === "") return ogeler;
    if (arama.sonuclar) return arama.sonuclar;
    return ogeler.filter((o) => trKatla(o.baslik).includes(sorgu));
  }, [arama, ogeler, sorgu]);

  const aktifSira = ogeler.findIndex((o) => o.id === aktifId);
  const aktifOge = aktifSira >= 0 ? ogeler[aktifSira] : undefined;

  /** Şerit 1rem, sabit sütun 17,5rem — akıştaki sütunun ayırdığı yer. */
  const SUTUN_GENISLIGI = sabit ? "17.5rem" : "1rem";

  /**
   * Elle açılan gruplar. KALICI DEĞİL — eski raydaki `openGroups` da,
   * belge haritasının `kapali` kümesi de kalıcı değildi: hangi grubun açık
   * olduğu bir görünüm anıdır, belgeye ait bir bilgi değil.
   */
  const [elleAcilan, setElleAcilan] = useState<Record<string, boolean>>({});

  function sec(id: string) {
    onSec(id);
    // Sabit sütun kapanmaz — kullanıcı orada gezinmeye devam eder.
    if (!sabit) kapat();
  }

  // ————————————————————————————————————————————————— satır çizimi

  function satir(o: BolumOgesi, cocukMu: boolean) {
    const secili = o.id === aktifId;
    return (
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
              secili ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
            )}
          >
            {o.numara}
          </span>
        ) : null}
        <span
          className={cn("min-w-0 flex-1 truncate", o.gizli && "opacity-55", cocukMu && "text-[13px]")}
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
        {/* GİZLİ BÖLÜMÜN UYARISI YAKILMAZ. */}
        {!o.rozet && o.uyari && !o.gizli ? (
          <span
            aria-label="kontrolü kalan bölüm"
            title="kontrolü kalan bölüm"
            className="size-1.5 shrink-0 bg-destructive"
          />
        ) : null}
      </button>
    );
  }

  /**
   * Grup satırı — YALNIZ sabit sütunda. Eski raydan birebir gelen açıklık
   * kuralı: bulunduğun grup HER ZAMAN açıktır ve onu kapatmak etkisizdir;
   * arama varken bütün gruplar açılır.
   *
   * Ok ile ad AYRI düğmelerdir: ok grubu açar/kapatır, ada dokunmak modülün
   * kendisine (ilk adımına) götürür. Tek düğme olsaydı ikisinden biri
   * kaybolurdu.
   */
  function grup(o: BolumOgesi) {
    const cocuklar = o.cocuklar ?? [];
    const baslikEsleser = sorgu !== "" && trKatla(o.baslik).includes(sorgu);
    const gorunenCocuklar =
      sorgu === "" || baslikEsleser
        ? cocuklar
        : cocuklar.filter((c) => trKatla(c.baslik).includes(sorgu));

    if (sorgu !== "" && !baslikEsleser && gorunenCocuklar.length === 0) return null;

    const aktifBurada = cocuklar.some((c) => c.id === aktifId) || o.id === aktifId;
    const acikGrup = !o.gizli && (sorgu !== "" || aktifBurada || !!elleAcilan[o.id]);

    return (
      <li key={o.id}>
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            disabled={o.gizli}
            onClick={() => setElleAcilan((g) => ({ ...g, [o.id]: !acikGrup }))}
            aria-expanded={acikGrup}
            aria-label={acikGrup ? `${o.baslik} — alt bölümleri kapat` : `${o.baslik} — alt bölümleri aç`}
            title={acikGrup ? "Alt bölümleri kapat" : "Alt bölümleri aç"}
            className="oc-tap-square grid size-5 shrink-0 place-items-center font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-0"
          >
            <span aria-hidden className={cn("transition-transform", !acikGrup && "-rotate-90")}>
              ▾
            </span>
          </button>
          {satir(o, false)}
          {o.sag}
        </div>
        {acikGrup && gorunenCocuklar.length > 0 ? (
          <ol className="mt-0.5 ml-3.5 grid gap-0.5 border-l border-border/70 pl-2">
            {gorunenCocuklar.map((c) => (
              <li key={c.id} className="flex min-w-0 items-center gap-1">
                {satir(c, true)}
                {c.sag}
              </li>
            ))}
          </ol>
        ) : null}
      </li>
    );
  }

  // ————————————————————————————————————————————— panel/sütun gövdesi

  const ikiDuzey = sabit && listelenen.some((o) => (o.cocuklar?.length ?? 0) > 0);

  const icerik = (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b px-2 py-1.5">
        {sabit ? (
          <button
            type="button"
            onClick={daraltmayiDegistir}
            aria-pressed={false}
            aria-label="Bölüm sütununu daralt"
            title="Bölüm sütununu daralt"
            className="oc-tap-square grid size-6 shrink-0 place-items-center font-mono text-[11px] leading-none text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            «
          </button>
        ) : (
          <button
            type="button"
            onClick={kapat}
            aria-label="Bölüm listesini kapat"
            title="Bölüm listesini kapat"
            className="oc-tap-square grid size-6 shrink-0 place-items-center font-mono text-[11px] leading-none text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            ✕
          </button>
        )}
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
            // `text-sm` YAZILMAZ: taban `text-base pointer-fine:text-sm`tir ve
            // elle ezmek iOS Safari'nin odakta otomatik yakınlaştırmasını geri
            // getiriyor (MOBIL-2/28). `.oc-tap` girdide çalışmadığı için hedef
            // GERÇEK yüksekliktir.
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
            listelenen.map((o) =>
              ikiDuzey && (o.cocuklar?.length ?? 0) > 0 ? (
                grup(o)
              ) : (
                <li key={o.id} className="flex min-w-0 items-center gap-1">
                  {/* İki düzeyli listede çocuksuz satırlar ok sütunu kadar
                      içeri kaymalı, yoksa liste tırtıklı görünür. */}
                  {ikiDuzey ? <span aria-hidden className="size-5 shrink-0" /> : null}
                  {satir(o, false)}
                  {o.sag}
                </li>
              )
            )
          )}
        </ol>
      )}

      {altEk ? <div className="shrink-0 border-t p-1">{altEk}</div> : null}
    </>
  );

  // ————————————————————————————————————————————————————— yerleşim

  return (
    // AKIŞTA BİR SÜTUN. Dar ekranda şerit `fixed` olsa da bu kutu yerini korur:
    // içerik şeridin altına kaymaz. NEGATİF KENAR BOŞLUĞU YOKTUR (dolgusuz
    // `overflow-x-*` sarmalayıcılar onu kırpardı, MOBIL-29).
    //
    // SARMALAYICI ESNEK SATIRDA `stretch` OLMALIDIR (MOBIL-31): `items-start`
    // veriliyse yapışkan kutunun yapışacak yolu kalmaz.
    <div
      // GENİŞLİK SATIR İÇİNDE VE ÜÇ EKSENDE — kabuğun kenar çubuğunun kalıbı
      // (`app-shell.tsx`). İki sebebi var: (1) `globals.css` bütün kaplara
      // `min-width: 0` veriyor, tek `width` yetmez; (2) genişlik bir DEĞİŞKEN
      // ve Tailwind'in keyfi değeri (`w-[17.5rem]`) burada üretilmiyordu —
      // sınıf yazılıydı ama hesaplanan genişlik 16px kalıyordu (ölçüldü).
      style={{ width: SUTUN_GENISLIGI, minWidth: SUTUN_GENISLIGI, maxWidth: SUTUN_GENISLIGI }}
      // GENİŞLİK GEÇİŞİ YOKTUR ve bu ölçülmüş bir karardır: şerit ↔ sütun
      // AYRIK bir durum değişimidir, bir hareket anlatısı değil. Geçiş
      // denendi ve animasyon karesi ateşlemeyen bağlamlarda (arka plan
      // sekmesi, gizli panel) genişlik BAŞLANGIÇ değerinde ASILI KALIYOR —
      // sütun 16px olarak çiziliyor ve içeriğin üstüne biniyordu. Marka
      // dili de ekran yüzeylerinden animasyonu zaten sökmüştü.
      className={cn("relative shrink-0 print:hidden", className)}
    >
      {/*
        KONUMLANDIRAN KUTU — tabakanın kapsayıcı bloğu (MOBIL-18).
        `max-lg:fixed`: dar ekranda şerit ekranın gerçek kenarına oturur ve
        kabuk kenar çubuğu orada zaten yoktur. `--app-header-h` ÖLÇÜLMÜŞ
        değerdir, 48px varsayılmaz (başlık `lg` altında iki satır olabiliyor).
        `dvh` (`vh` DEĞİL, MOBIL-3); `lg:max-h-full` sabit çerçeve rotalarında
        (`lg:h-dvh lg:overflow-hidden`) kelepçedir.
      */}
      <div
        className={cn(
          "lg:sticky lg:top-[var(--app-header-h,48px)] lg:h-[calc(100dvh-var(--app-header-h,48px))] lg:max-h-full",
          sabit
            ? // SABİT SÜTUN AKIŞTADIR: `fixed` yok, `z-index` yok, örtü yok.
              "flex h-full flex-col border bg-card"
            : cn(
                "max-lg:fixed max-lg:bottom-0 max-lg:left-0 max-lg:top-[var(--app-header-h,48px)] max-lg:w-4",
                // Kapalıyken içeriğin üstünde ama yapışkan alt kumandanın
                // (z-20) altında; açıkken kabuğun kenar çubuğu (z-40) dâhil
                // her şeyin üstünde. Kutu tek bir yığın bağlamıdır: örtü ve
                // tabaka onun İÇİNDE sıralanır.
                tabakaAcik ? "z-40" : "z-10"
              )
        )}
      >
        {sabit ? (
          icerik
        ) : (
          <>
            {/* GENİŞ EKRANDA ŞERİT SÜTUNU GERİ AÇAR, tabaka açmaz: sabit kip
                orada zaten mümkün ve kullanıcı onu daraltmıştır. */}
            <button
              type="button"
              onClick={() => (sabitlenebilirSayfa ? daraltmayiDegistir() : setAcik(!tabakaAcik))}
              aria-haspopup={sabitlenebilirSayfa ? undefined : "dialog"}
              aria-expanded={sabitlenebilirSayfa ? false : tabakaAcik}
              aria-controls={sabitlenebilirSayfa ? undefined : panelId}
              aria-label={
                aktifOge
                  ? `${etiket} — ${aktifSira + 1}/${ogeler.length}: ${aktifOge.baslik}`
                  : sabitlenebilirSayfa
                    ? `${etiket} — sütunu genişlet`
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
                ÇENTİKLER BİLGİ TAŞIR: kaç bölüm var, kaçıncıdasın, hangisinde
                sorun kaldı. Ama AYRI DOKUNMA HEDEFİ DEĞİLDİR — 19 çentik
                600px'lik bir şeritte 30px'e denk gelir ve `.oc-tap` üst üste
                dizili kardeşlerde komşunun dokunuşunu yutar (MOBIL-28).
                Şeridin TAMAMI tek düğmedir; bilgi `aria-label`dadır.
                ÇENTİKLER TEK DÜZEYDİR — `cocuklar` burada hiç çizilmez.
              */}
              {ogeler.map((o) => {
                const secili = o.id === aktifId;
                return (
                  <span
                    key={o.id}
                    aria-hidden
                    className={cn(
                      "min-h-[2px] shrink transition-all",
                      // ÜÇ GENİŞLİK KADEMESİ (10 · 6 · 3 px) + aktifte iki kat
                      // boy. Aktifi renkten ayırmak İMKÂNSIZ (primary ve
                      // destructive bir derece arayla aynı kırmızı), ayırt
                      // edici GEOMETRİDİR.
                      secili
                        ? "w-full flex-[2] bg-primary"
                        : o.uyari && !o.gizli
                          ? "w-2/3 flex-1 bg-destructive"
                          : cn("w-1/3 flex-1", o.gizli ? "bg-border/50" : "bg-border"),
                      !secili && "group-hover/ray:w-full"
                    )}
                  />
                );
              })}
            </button>

            {/*
              TABAKA KAPALIYKEN HİÇ BASILMAZ. Eski hesap raporu rayı kapalı
              listeyi `translate-y-full` ile ayakta tutuyordu ve 117 görünmez
              düğmeyi Tab sırasından çıkarmak için `inert` yazmak zorundaydı.
            */}
            {tabakaAcik ? (
              <>
                <div className="fixed inset-0 bg-foreground/40" onClick={kapat} aria-hidden />
                <div
                  ref={panelRef}
                  id={panelId}
                  role="dialog"
                  aria-modal="true"
                  aria-label={etiket}
                  // TABAKA ŞERİDİN KUTUSUNA ASILIR, AKIŞTAKİ SÜTUNA DEĞİL:
                  // sütun belge boyunda olabilir ve `inset-y-0` orada tabakayı
                  // üç bin piksel yapardı.
                  className="absolute inset-y-0 left-0 flex w-[min(20rem,calc(100vw-3rem))] flex-col border-r border-border bg-card shadow-[8px_0_24px_-8px_rgb(0_0_0/0.28)]"
                >
                  {icerik}
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
