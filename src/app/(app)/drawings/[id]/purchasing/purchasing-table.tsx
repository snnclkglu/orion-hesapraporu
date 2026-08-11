"use client";

// Satın Alma tablosu — sipariş, teslim tarihi ve kategori düzeltmesi.
//
// ASIL KULLANICI SATINALMACIDIR ve üç sorusu vardır: neyi sipariş etmeliyim,
// ne zaman gelecek, geldi mi? Ekran bu üçüne göre kurulmuştur.
//
// ————————————————————————————————————————————————— ÜÇ KARAR
//
// 1. YAZMA BİRİKTİRİLİR, EKRAN BEKLEMEZ. Her tıklamada bir sunucu eylemi + bir
//    `router.refresh()` çalışıyordu; 672 parçalık bir pakette refresh bütün
//    sunucu bileşenini yeniden koşturuyor ve çip saniyelerce kilitli kalıyordu.
//    Kullanıcının gördüğü şey "satın alındı tuşu çok geç geliyor" ve daha
//    kötüsü "geri alamıyorum"du — çünkü bekleyen geçiş bütün çipleri pasif
//    yapıyordu. Artık işaret ANINDA boyanır, yazma kuyruğa girer ve boşta
//    kalınca tek çağrıda gider. `router.refresh()` HİÇ çağrılmaz: ekranın
//    doğruluk kaynağı yerel durumdur, sunucu yalnız ilk yüklemede okunur.
//
// 2. SİPARİŞ İLE TESLİM AYRI HÂLLERDİR. "Satın alındı" siparişin verildiğini
//    söyler; malzeme altı hafta sonra gelebilir. Atölyenin beklediği şey
//    teslimdir, bu yüzden `teslim_alindi` ayrı bir aşamadır ve tarih sütunu
//    onun rengini taşır.
//
// 3. SÖZLÜK BİLEMEDİĞİNDE İNSAN SÖYLER. "Diğer" bir çöp kutusu olamaz: seçili
//    kalemler başka bir kategoriye taşınabilir, gerekirse yeni kategori
//    açılabilir ve düzeltme deftere yazılıp HATIRLANIR.
//
// SÜZGEÇ TANIMI BURADA DEĞİL `../../filters.ts`TE — parça defterindeki kuralın
// aynısı; iki yerde yazılan bir süzgeç zamanla ayrışır.

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, FileSpreadsheet, FileText, FolderInput, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { tagStyle } from "@/lib/tags";
import { formatNum } from "@/lib/drawings/labels";
import type { SatinAlmaSonucu } from "@/lib/drawings/derive";
import { PURCHASE_STAGE_SLUG, RECEIVED_STAGE_SLUG, type StageDef } from "@/lib/drawings/progress";
import {
  ALL,
  EMPTY_PURCHASE_FILTERS,
  matchesPurchase,
  purchaseOptions,
  sortPurchases,
  type PurchaseFilters,
  type PurchaseSortKey,
} from "../../filters";
import { FilterBar, SearchBox, SortableHead } from "../../sortable-head";
import { markStage, setPartStage } from "../progress/actions";
import { createPurchaseCategory, movePurchaseCategory } from "./actions";

/** Satın alma ekranının okuduğu ilerleme kaydı — `due_at` ile birlikte. */
export interface PurchaseMark {
  key: string;
  stage: string;
  qtyDone: number;
  doneAt?: string | null;
  /** TAHMİNİ teslim tarihi; sütun henüz yoksa `null` gelir. */
  dueAt?: string | null;
  note?: string;
  id?: string;
}

/** Kuyruğun boşta ne kadar bekleyeceği (ms) — kullanıcı tıklamayı bitirsin. */
const BEKLEME = 900;
/** İlk değişiklikten sonra en geç ne kadarda yazılacağı (ms). */
const EN_GEC = 4000;

/**
 * TESLİM TARİHİ RENGİ — eşikler.
 *
 * Kullanıcının istediği okuma şudur: "bugüne çok uzaksa kırmızı, çok yakınsa
 * sarı". Satınalmacı için hem GECİKMİŞ hem de ÇOK UZAK aynı şeyi söyler —
 * bu kalem takvimi tehdit ediyor — ve ikisi de kırmızıdır; ipucu metni
 * hangisi olduğunu yazar. Arada kalan aralık sakin bırakılır: her satırı
 * renklendirmek rengi anlamsız yapardı.
 */
const YAKIN_GUN = 14;
const UZAK_GUN = 42;

/** Pop-up'taki hızlı seçenekler; "Hemen" bugünü, kalanı N haftayı gösterir. */
const HAZIR_HAFTALAR = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Süzgece giren satır — defter satırı + ilerleme kaydının birleşimi. */
interface Satir {
  key: string;
  tanim: string;
  sinif: string;
  duzeltilmis: boolean;
  malzeme: string;
  malzemeler: string[];
  parcaKodu: string;
  adet: number | null;
  toplamAgirlikKg: number | null;
  sourceRows: number;
  kaynak: string;
  alindi: boolean;
  teslim: boolean;
  dueAt: string;
  tarih: string;
  not: string;
}

/** Bir kalemin yerel durumu — sunucudan gelen kayıtların düzleştirilmiş hâli. */
interface Durum {
  alindi: boolean;
  teslim: boolean;
  dueAt: string;
  doneAt: string;
  note: string;
}

function durumHaritasi(marks: readonly PurchaseMark[]): Map<string, Durum> {
  const h = new Map<string, Durum>();
  for (const m of marks) {
    const d = h.get(m.key) ?? { alindi: false, teslim: false, dueAt: "", doneAt: "", note: "" };
    if (m.stage === PURCHASE_STAGE_SLUG) {
      d.alindi = true;
      d.dueAt = m.dueAt ?? d.dueAt;
      d.doneAt = m.doneAt ?? d.doneAt;
      d.note = m.note || d.note;
    }
    if (m.stage === RECEIVED_STAGE_SLUG) d.teslim = true;
    h.set(m.key, d);
  }
  return h;
}

/** `YYYY-MM-DD` — yerel gün, UTC değil (bir günlük kayma teslim tarihini bozar). */
function bugunISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function haftaSonrasi(hafta: number): string {
  const d = new Date();
  d.setDate(d.getDate() + hafta * 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** İki ISO gün arasındaki fark (gün). Geçersiz tarihte `null`. */
function gunFarki(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const hedef = new Date(`${iso}T00:00:00`);
  const bugun = new Date(`${bugunISO()}T00:00:00`);
  if (Number.isNaN(hedef.getTime())) return null;
  return Math.round((hedef.getTime() - bugun.getTime()) / 86_400_000);
}

function tarihGoster(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("tr-TR");
}

/** Teslim tarihi hücresinin rengi ve ipucu. */
function teslimGorunumu(s: Satir): { sinif: string; ipucu: string } {
  if (s.teslim) {
    return {
      sinif: "border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
      ipucu: "Teslim alındı.",
    };
  }
  const fark = s.dueAt ? gunFarki(s.dueAt) : null;
  if (fark == null) return { sinif: "text-muted-foreground", ipucu: "Teslim tarihi girilmemiş." };
  if (fark < 0) {
    return {
      sinif: "border-destructive/40 bg-destructive/10 text-destructive",
      ipucu: `${Math.abs(fark)} gün gecikti.`,
    };
  }
  if (fark <= YAKIN_GUN) {
    return {
      sinif: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
      ipucu: `${fark} gün kaldı.`,
    };
  }
  if (fark > UZAK_GUN) {
    return {
      sinif: "border-destructive/40 bg-destructive/10 text-destructive",
      ipucu: `${fark} gün var — takvimi tehdit ediyor.`,
    };
  }
  return { sinif: "text-foreground", ipucu: `${fark} gün var.` };
}

export function PurchasingTable({
  packageId,
  liste,
  stages,
  marks,
  kategoriler,
  canWrite,
  canEditCategories,
  ledgerMissing,
  carpan,
  carpanBelirsiz,
  carpanKalemleri,
}: {
  packageId: string;
  liste: SatinAlmaSonucu;
  /** Satın alma aşamaları, zincir sırasında: satın alındı → teslim alındı. */
  stages: StageDef[];
  marks: PurchaseMark[];
  /** Sözlük + kullanıcı kategorileri, gösterim sırasında. */
  kategoriler: string[];
  canWrite: boolean;
  /** Kategori defteri kurulmuş mu (migration uygulandı mı)? */
  canEditCategories: boolean;
  ledgerMissing: boolean;
  /**
   * RESİM ÇARPANI (md. 6) — iş kalemi adedi. Ressam bire göre çizer; listedeki
   * adetler bununla çarpılarak gösterilir.
   */
  carpan: number;
  /** Çarpan bir VARSAYIM mı? Ekran bunu açıkça yazar, sessizce 1 saymaz. */
  carpanBelirsiz: boolean;
  /** Çarpana katılan iş kalemi numaraları — ipucunda gösterilir. */
  carpanKalemleri: string[];
}) {
  const siparis = stages.find((s) => s.slug === PURCHASE_STAGE_SLUG) ?? null;
  const teslimAsamasi = stages.find((s) => s.slug === RECEIVED_STAGE_SLUG) ?? null;

  const [durumlar, setDurumlar] = useState<Map<string, Durum>>(() => durumHaritasi(marks));
  const [bekleyenSayisi, setBekleyenSayisi] = useState(0);
  const [calisiyor, basla] = useTransition();

  // ————————————————————————————————————————————————————— yazma kuyruğu
  //
  // Anahtar `aşama|mod`, değeri anahtar kümesidir. Aynı kalem art arda açılıp
  // kapatılırsa TERS moddan düşürülür: kuyruk kullanıcının SON kararını taşır,
  // aradaki gidiş gelişleri değil.
  const kuyruk = useRef(new Map<string, Set<string>>());
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ilkDegisiklik = useRef(0);

  const bosalt = useCallback(() => {
    if (zamanlayici.current) {
      clearTimeout(zamanlayici.current);
      zamanlayici.current = null;
    }
    ilkDegisiklik.current = 0;
    const isler = [...kuyruk.current.entries()].filter(([, k]) => k.size > 0);
    kuyruk.current.clear();
    setBekleyenSayisi(0);
    if (isler.length === 0) return;

    basla(async () => {
      for (const [anahtar, anahtarlar] of isler) {
        const [stage, mode] = anahtar.split("|") as [string, "isaretle" | "kaldir"];
        const sonuc = await markStage({ packageId, stage, keys: [...anahtarlar], mode });
        // HATA SESSİZ KALMAZ ama ekran da geri sarılmaz: kullanıcı o arada
        // başka kalemleri işaretlemiş olabilir ve hepsini geri almak, bir
        // satırın hatasını yirmi satırın kaybına çevirirdi. Sayfa yenilendiğinde
        // sunucunun gerçeği zaten görünür.
        if (sonuc.error) toast.error(`Kaydedilemedi: ${sonuc.error}`);
      }
    });
  }, [packageId]);

  const planla = useCallback(() => {
    const simdi = Date.now();
    if (!ilkDegisiklik.current) ilkDegisiklik.current = simdi;
    if (zamanlayici.current) clearTimeout(zamanlayici.current);
    // EN GEÇ SINIRI: kullanıcı hiç durmadan tıklarsa boşta bekleme hiç
    // gelmez ve yazma sonsuza ertelenirdi.
    const kalan = Math.max(0, EN_GEC - (simdi - ilkDegisiklik.current));
    zamanlayici.current = setTimeout(bosalt, Math.min(BEKLEME, kalan));
  }, [bosalt]);

  const kuyrukla = useCallback(
    (anahtarlar: string[], stage: string, mode: "isaretle" | "kaldir") => {
      const ters = `${stage}|${mode === "isaretle" ? "kaldir" : "isaretle"}`;
      const kendi = `${stage}|${mode}`;
      const hedef = kuyruk.current.get(kendi) ?? new Set<string>();
      for (const k of anahtarlar) {
        kuyruk.current.get(ters)?.delete(k);
        hedef.add(k);
      }
      kuyruk.current.set(kendi, hedef);
      setBekleyenSayisi([...kuyruk.current.values()].reduce((t, s) => t + s.size, 0));
      planla();
    },
    [planla]
  );

  // Sayfadan ayrılırken kuyruk boşaltılır; tarayıcı da uyarır. `beforeunload`
  // sunucu eylemini bekleyemez — uyarı, kullanıcının kalıp kaydetmesi içindir.
  useEffect(() => {
    const uyar = (e: BeforeUnloadEvent) => {
      if (kuyruk.current.size > 0) e.preventDefault();
    };
    window.addEventListener("beforeunload", uyar);
    return () => {
      window.removeEventListener("beforeunload", uyar);
      bosalt();
    };
  }, [bosalt]);

  function isaretle(anahtarlar: string[], stage: string, isaretli: boolean) {
    if (!canWrite || anahtarlar.length === 0) return;
    const alan = stage === RECEIVED_STAGE_SLUG ? "teslim" : "alindi";
    setDurumlar((o) => {
      const y = new Map(o);
      for (const k of anahtarlar) {
        const d = { ...(y.get(k) ?? { alindi: false, teslim: false, dueAt: "", doneAt: "", note: "" }) };
        d[alan] = isaretli;
        // TESLİM ALINDIYSA SATIN DA ALINMIŞTIR. Tersi doğru değildir; sipariş
        // verilmemiş bir malın teslim alınması bir veri hatasıdır ve ekranın
        // onu sessizce üretmesi yanlış olurdu.
        if (alan === "teslim" && isaretli) d.alindi = true;
        y.set(k, d);
      }
      return y;
    });
    kuyrukla(anahtarlar, stage, isaretli ? "isaretle" : "kaldir");
    if (alan === "teslim" && isaretli) {
      const eksik = anahtarlar.filter((k) => !durumlar.get(k)?.alindi);
      if (eksik.length > 0) kuyrukla(eksik, PURCHASE_STAGE_SLUG, "isaretle");
    }
  }

  // ————————————————————————————————————————————————————— satırlar
  const satirlar: Satir[] = useMemo(
    () =>
      liste.satirlar.map((s) => {
        const d = durumlar.get(s.key);
        return {
          key: s.key,
          tanim: s.tanim,
          sinif: s.sinif,
          duzeltilmis: s.duzeltilmis,
          malzeme: s.malzeme,
          malzemeler: s.malzemeler,
          parcaKodu: s.parcaKodu,
          adet: s.adet,
          toplamAgirlikKg: s.toplamAgirlikKg,
          sourceRows: s.sourceRows,
          kaynak: s.kaynak,
          alindi: d?.alindi ?? false,
          teslim: d?.teslim ?? false,
          dueAt: d?.dueAt ?? "",
          tarih: d?.doneAt ?? "",
          not: d?.note ?? "",
        };
      }),
    [liste.satirlar, durumlar]
  );

  const [f, setF] = useState<PurchaseFilters>(EMPTY_PURCHASE_FILTERS);
  const [sortKey, setSortKey] = useState<PurchaseSortKey>("kategori");
  const [desc, setDesc] = useState(false);
  const [secili, setSecili] = useState<Set<string>>(new Set());

  const secenekler = useMemo(() => purchaseOptions(satirlar, kategoriler), [satirlar, kategoriler]);

  const gorunen = useMemo(
    () =>
      sortPurchases(satirlar.filter((s) => matchesPurchase(s, f)), sortKey, desc, kategoriler),
    [satirlar, f, sortKey, desc, kategoriler]
  );

  function sirala(key: PurchaseSortKey) {
    if (key === sortKey) setDesc((d) => !d);
    else {
      setSortKey(key);
      setDesc(false);
    }
  }

  const temiz = JSON.stringify(f) === JSON.stringify(EMPTY_PURCHASE_FILTERS);
  const alinan = satirlar.filter((s) => s.alindi).length;
  const teslimAlinan = satirlar.filter((s) => s.teslim).length;
  const gorunenAgirlik = gorunen.reduce((t, s) => t + (s.toplamAgirlikKg ?? 0), 0);

  const [pencere, setPencere] = useState<Satir | null>(null);
  const [yeniKategori, setYeniKategori] = useState(false);
  const seciliListe = [...secili];

  // ————————————————————————————————————————————————————— kategori taşıma
  function tasi(kategori: string) {
    if (!canEditCategories || seciliListe.length === 0) return;
    basla(async () => {
      const sonuc = await movePurchaseCategory({ packageId, keys: seciliListe, category: kategori });
      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      toast.success(`${sonuc.ok ?? 0} kalem “${kategori}” kategorisine taşındı.`);
      setSecili(new Set());
      // KATEGORİ SUNUCUDAN GELİR (defterden okunup listeye uygulanıyor), bu
      // yüzden burada sayfa yenilenir — işaretlerin aksine bunun yerel bir
      // karşılığı yok ve düzeltme kalıcıdır, sık yapılmaz.
      window.location.reload();
    });
  }

  return (
    <div className="grid gap-3">
      {ledgerMissing && (
        <p className="border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-400">
          Aşama defteri henüz kurulmamış — ekran yedek sözlükle çalışıyor.
          İşaretler kaydedilir; migration uygulandığında defterdeki ad ve renk
          devreye girer.
        </p>
      )}
      {canWrite && !canEditCategories && (
        <p className="border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-400">
          Kategori düzeltme defteri henüz kurulmamış. Liste ve işaretler
          çalışıyor; kalem taşıma ve yeni kategori, migration uygulandığında
          açılır.
        </p>
      )}

      {/* RESİM ÇARPANI ŞERİDİ — sayının neden defterdekinden farklı olduğunu
          ekranın kendisi söyler. Sessiz bir çarpma, satınalmacının listeye
          güvenini bitirirdi. */}
      {carpan > 1 && (
        <p className="border border-primary/30 bg-primary/[0.04] px-3 py-2 text-[12px]">
          Adetler <strong>×{formatNum(carpan)}</strong> ile gösteriliyor — ressam bir adede
          göre çizer, iş emrinde{" "}
          {carpanKalemleri.length > 1
            ? `${carpanKalemleri.join(" + ")} kalemleri bu resimleri paylaşıyor`
            : "bu kalemden birden fazla var"}
          .
        </p>
      )}
      {carpanBelirsiz && (
        <p className="border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-400">
          İş kaleminin sayısal adedi girilmemiş; çarpan <strong>1</strong> kabul edildi.
          Doğru sipariş adedi için İşler → ilgili iş → <strong>Resim Çarpanı</strong> kartından
          adedi doldurun.
        </p>
      )}

      <SummaryStrip liste={liste} alinan={alinan} teslim={teslimAlinan} />

      <FilterBar
        gorunen={gorunen.length}
        toplam={satirlar.length}
        temiz={temiz}
        onTemizle={() => setF(EMPTY_PURCHASE_FILTERS)}
      >
        <SearchBox
          value={f.query}
          onChange={(v) => setF((s) => ({ ...s, query: v }))}
          placeholder="Tanım, Kod, Malzeme Ara…"
          className="w-[min(20rem,calc(100vw-4rem))]"
        />
        <Suzgec
          value={f.sinif}
          onChange={(v) => setF((s) => ({ ...s, sinif: v }))}
          bos="Kategori"
          secenekler={secenekler.siniflar.map((s) => ({ value: s, label: s }))}
        />
        <Suzgec
          value={f.malzeme}
          onChange={(v) => setF((s) => ({ ...s, malzeme: v }))}
          bos="Malzeme"
          secenekler={secenekler.materials.map((m) => ({ value: m, label: m }))}
        />
        <Suzgec
          value={f.durum}
          onChange={(v) => setF((s) => ({ ...s, durum: v }))}
          bos="Durum"
          secenekler={[
            { value: "bekliyor", label: "Bekliyor" },
            { value: "alindi", label: "Satın alındı" },
            { value: "yolda", label: "Yolda (alındı, gelmedi)" },
            { value: "teslim", label: "Teslim alındı" },
          ]}
        />

        <span className="hidden h-5 w-px bg-border sm:block" />

        <CiktiFormu packageId={packageId} filtre={f} sortKey={sortKey} desc={desc} keys={seciliListe} />
      </FilterBar>

      {gorunen.length === 0 ? (
        <div className="border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Bu süzgeçle eşleşen kalem yok. Süzgeci temizleyip yeniden deneyin.
          </p>
        </div>
      ) : (
        <div className="border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {canWrite && (
                  <TableHead className="w-10 p-0">
                    <SecimKutusu
                      checked={gorunen.every((s) => secili.has(s.key))}
                      onChange={(v) =>
                        setSecili((o) => {
                          const y = new Set(o);
                          for (const s of gorunen) {
                            if (v) y.add(s.key);
                            else y.delete(s.key);
                          }
                          return y;
                        })
                      }
                      label="Görünen kalemlerin tamamını seç"
                    />
                  </TableHead>
                )}
                <SortableHead sortKey="kategori" current={sortKey} desc={desc} onSort={sirala}>
                  Kategori
                </SortableHead>
                <SortableHead sortKey="tanim" current={sortKey} desc={desc} onSort={sirala}>
                  Tanım
                </SortableHead>
                <SortableHead
                  sortKey="adet"
                  current={sortKey}
                  desc={desc}
                  onSort={sirala}
                  align="right"
                >
                  Adet
                </SortableHead>
                <SortableHead sortKey="teslim" current={sortKey} desc={desc} onSort={sirala}>
                  Tahmini Teslim
                </SortableHead>
                <SortableHead
                  sortKey="kod"
                  current={sortKey}
                  desc={desc}
                  onSort={sirala}
                  className="hidden xl:table-cell"
                >
                  Parça Kodu
                </SortableHead>
                <TableHead className="hidden lg:table-cell">Malzeme</TableHead>
                <SortableHead sortKey="durum" current={sortKey} desc={desc} onSort={sirala}>
                  Durum
                </SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gorunen.map((s) => {
                const teslim = teslimGorunumu(s);
                return (
                  <TableRow
                    key={s.key}
                    className={secili.has(s.key) ? "bg-primary/[0.05]" : undefined}
                  >
                    {canWrite && (
                      <TableCell className="p-0 align-top">
                        <SecimKutusu
                          checked={secili.has(s.key)}
                          onChange={() =>
                            setSecili((o) => {
                              const y = new Set(o);
                              if (y.has(s.key)) y.delete(s.key);
                              else y.add(s.key);
                              return y;
                            })
                          }
                          label={`${s.tanim} kalemini seç`}
                        />
                      </TableCell>
                    )}

                    <TableCell className="align-top text-[12px] whitespace-normal">
                      {s.sinif}
                      {s.duzeltilmis && (
                        <span
                          className="ml-1 text-muted-foreground"
                          title="Kategori sözlükten değil, elle düzeltildi."
                        >
                          ✎
                        </span>
                      )}
                    </TableCell>

                    {/* TANIM SÜTUNU DARALTILDI ve iki satıra sarar: eskiden
                        bütün genişliği yiyor, teslim tarihi sütununa yer
                        kalmıyordu. Kırpılmaz — kırpılmış bir tanım sipariş
                        edilemez. */}
                    <TableCell className="max-w-[22rem] min-w-0 align-top whitespace-normal">
                      <span className="block text-[13px] leading-snug">{s.tanim || "—"}</span>
                      <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground lg:hidden">
                        {[s.malzeme, s.parcaKodu].filter(Boolean).join(" · ") || "—"}
                      </span>
                      {s.sourceRows > 1 && (
                        <span
                          className="mt-0.5 block font-mono text-[11px] text-muted-foreground"
                          title={s.kaynak}
                        >
                          {formatNum(s.sourceRows)} defter satırından birleşti
                        </span>
                      )}
                    </TableCell>

                    {/* ADET ÇARPILMIŞ GÖSTERİLİR (md. 6) ama HAM DEĞER GİZLENMEZ:
                        çarpan 1'den büyükse hücre "144" yazar ve altında
                        "48 × 3" durur. Yalnız çarpımı göstermek, defterdeki
                        sayıyla ekrandaki sayının neden tutmadığını
                        açıklanamaz yapardı. */}
                    <TableCell className="align-top text-right font-mono text-sm">
                      {s.adet == null ? "—" : formatNum(s.adet * carpan)}
                      {s.adet != null && carpan > 1 && (
                        <span className="block text-[11px] text-muted-foreground">
                          {formatNum(s.adet)} × {formatNum(carpan)}
                        </span>
                      )}
                    </TableCell>

                    {/* TAHMİNİ TESLİM — renk bir durum ölçüsüdür: gecikmiş ya da
                        çok uzak kırmızı, yaklaşan sarı, teslim alınmış yeşil. */}
                    <TableCell className="align-top whitespace-nowrap">
                      <span className="flex flex-wrap items-center gap-1">
                        <span
                          className={
                            "inline-flex min-h-7 items-center border px-1.5 font-mono text-[11px] " +
                            (teslim.sinif.includes("text-muted") ? "border-dashed " : "") +
                            teslim.sinif
                          }
                          title={teslim.ipucu}
                        >
                          {s.teslim ? "Teslim alındı" : s.dueAt ? tarihGoster(s.dueAt) : "—"}
                        </span>
                        {canWrite && teslimAsamasi && (
                          <button
                            type="button"
                            onClick={() => isaretle([s.key], RECEIVED_STAGE_SLUG, !s.teslim)}
                            aria-pressed={s.teslim}
                            title={
                              s.teslim
                                ? "Teslim işaretini kaldır"
                                : "Malzeme elimize geçti — teslim alındı işaretle"
                            }
                            className="inline-flex min-h-7 items-center border border-dashed px-1.5 text-[11px] text-muted-foreground transition-colors pointer-coarse:min-h-9 hover:border-foreground/40 hover:text-foreground"
                          >
                            {s.teslim ? "Geri al" : "Teslim Alındı"}
                          </button>
                        )}
                      </span>
                    </TableCell>

                    <TableCell className="hidden align-top font-mono text-[12px] whitespace-normal xl:table-cell">
                      {s.parcaKodu || <span className="text-muted-foreground">—</span>}
                    </TableCell>

                    <TableCell className="hidden align-top font-mono text-[12px] whitespace-normal lg:table-cell">
                      {/* ÇELİŞKİ GİZLENMEZ: aynı kalem iki malzemeyle geçtiyse
                          ikisi de yazılır — Excel'deki kuralın aynısı. */}
                      {s.malzemeler.length > 1 ? (
                        <span
                          className="font-semibold text-destructive"
                          title="Kaynak satırlar farklı malzeme söylüyor"
                        >
                          {s.malzemeler.join(" / ")}
                        </span>
                      ) : (
                        s.malzeme || <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell className="align-top">
                      {siparis ? (
                        <span className="inline-flex">
                          <button
                            type="button"
                            disabled={!canWrite}
                            onClick={() => isaretle([s.key], PURCHASE_STAGE_SLUG, !s.alindi)}
                            aria-pressed={s.alindi}
                            title={
                              s.alindi
                                ? "Dokunmak işareti kaldırır"
                                : `${siparis.name} olarak işaretle`
                            }
                            style={s.alindi ? tagStyle(siparis.colorHue) : undefined}
                            className={
                              "inline-flex min-h-8 items-center gap-1 px-1.5 text-[11px] whitespace-nowrap transition-colors pointer-coarse:min-h-10 pointer-coarse:px-2 disabled:cursor-default " +
                              (s.alindi
                                ? "oc-tag"
                                : "border border-dashed border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground")
                            }
                          >
                            {s.alindi ? (
                              <Check className="size-3" aria-hidden />
                            ) : (
                              <span
                                className="oc-tag-dot opacity-40"
                                style={tagStyle(siparis.colorHue)}
                                aria-hidden
                              />
                            )}
                            {s.alindi ? siparis.name : "Bekliyor"}
                          </button>
                          {canWrite && s.alindi && (
                            <button
                              type="button"
                              onClick={() => setPencere(s)}
                              aria-label="Sipariş ayrıntısı"
                              title={
                                [s.tarih && `sipariş ${tarihGoster(s.tarih)}`, s.not]
                                  .filter(Boolean)
                                  .join(" · ") || "Teslim tarihi, adet ve not"
                              }
                              className={
                                "inline-flex min-h-8 items-center border border-l-0 px-1 text-[11px] transition-colors pointer-coarse:min-h-10 hover:text-foreground " +
                                (s.tarih || s.not ? "text-foreground" : "text-muted-foreground")
                              }
                            >
                              {s.tarih || s.not ? "•" : "…"}
                            </button>
                          )}
                        </span>
                      ) : (
                        <span className="font-mono text-[11px] text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-muted-foreground">
        <span>
          {formatNum(gorunen.length)} Kalem Görünüyor ·{" "}
          {formatNum(gorunen.filter((s) => s.alindi).length)} Alındı ·{" "}
          {formatNum(gorunen.filter((s) => s.teslim).length)} Teslim
          {gorunenAgirlik > 0 && ` · ${formatNum(gorunenAgirlik, 1)} kg`}
        </span>
        {/* YAZMA DURUMU GÖRÜNÜR AMA ENGELLEMEZ. Eskiden bekleyen geçiş bütün
            çipleri pasif yapıyordu ve kullanıcı "geri alamıyorum" diyordu. */}
        {(bekleyenSayisi > 0 || calisiyor) && (
          <span className="inline-flex items-center gap-1 text-foreground">
            <Loader2 className="size-3 animate-spin" />
            {bekleyenSayisi > 0 ? `${formatNum(bekleyenSayisi)} değişiklik kaydediliyor` : "Kaydediliyor"}
          </span>
        )}
      </p>

      {/* Yapışkan toplu şerit — 72 kalemlik bir listede seçim yapıp düğmeye
          ulaşmak için sayfanın dibine inmek gerekmemeli. */}
      {canWrite && secili.size > 0 && (
        <div className="sticky bottom-2 z-20 flex flex-wrap items-center gap-2 border bg-card p-2 shadow-lg">
          <span className="font-mono text-[12px] font-medium">
            {formatNum(secili.size)} Kalem Seçili
          </span>
          <Button type="button" size="xs" variant="ghost" onClick={() => setSecili(new Set())}>
            Seçimi bırak
          </Button>

          <span className="ml-auto flex flex-wrap items-center gap-1.5">
            {canEditCategories && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="xs" variant="outline" disabled={calisiyor}>
                    <FolderInput className="size-3" />
                    Kategoriye Taşı
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="max-h-[min(24rem,60dvh)] min-w-[min(16rem,calc(100vw-1.5rem))] overflow-y-auto"
                >
                  <DropdownMenuLabel className="oc-kicker text-muted-foreground">
                    Seçili {formatNum(secili.size)} kalem
                  </DropdownMenuLabel>
                  {kategoriler.map((k) => (
                    <DropdownMenuItem key={k} onSelect={() => tasi(k)}>
                      {k}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setYeniKategori(true)}>
                    <Plus className="size-3.5" />
                    Yeni kategori…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {siparis && (
              <button
                type="button"
                onClick={() => isaretle(seciliListe, PURCHASE_STAGE_SLUG, true)}
                style={tagStyle(siparis.colorHue)}
                className="oc-tag min-h-9 px-2 py-1 text-[12px] transition-opacity pointer-coarse:min-h-11"
              >
                {siparis.name} İşaretle
              </button>
            )}
            {teslimAsamasi && (
              <button
                type="button"
                onClick={() => isaretle(seciliListe, RECEIVED_STAGE_SLUG, true)}
                style={tagStyle(teslimAsamasi.colorHue)}
                className="oc-tag min-h-9 px-2 py-1 text-[12px] transition-opacity pointer-coarse:min-h-11"
              >
                {teslimAsamasi.name} İşaretle
              </button>
            )}
            {/* "−Satın alındı" ANLAŞILMIYORDU: eksi işareti bir kısayoldu ama
                düğmenin ne yaptığını söylemiyordu. Etiket artık eylemi yazar. */}
            <Button
              type="button"
              size="xs"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                isaretle(seciliListe, PURCHASE_STAGE_SLUG, false);
                if (teslimAsamasi) isaretle(seciliListe, RECEIVED_STAGE_SLUG, false);
              }}
              title="Seçili kalemleri yeniden “bekliyor” yapar; sipariş ve teslim işaretlerini kaldırır."
            >
              İşareti Kaldır
            </Button>
          </span>
        </div>
      )}

      {pencere && siparis && (
        <DetailDialog
          key={pencere.key}
          packageId={packageId}
          satir={pencere}
          stage={siparis}
          onClose={() => setPencere(null)}
          onSaved={(d) => {
            setDurumlar((o) => {
              const y = new Map(o);
              const eski = y.get(pencere.key) ?? {
                alindi: true,
                teslim: false,
                dueAt: "",
                doneAt: "",
                note: "",
              };
              y.set(pencere.key, { ...eski, ...d, alindi: true });
              return y;
            });
            setPencere(null);
          }}
          onCleared={() => {
            isaretle([pencere.key], PURCHASE_STAGE_SLUG, false);
            setPencere(null);
          }}
        />
      )}

      {yeniKategori && (
        <NewCategoryDialog
          onClose={() => setYeniKategori(false)}
          onCreated={(ad) => {
            setYeniKategori(false);
            tasi(ad);
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ çıktı

/**
 * Excel ve PDF — SÜZGEÇ VE SEÇİM TAŞINIR.
 *
 * `GET` bağlantısı yerine FORM kullanılır: seçili kalemlerin anahtarları
 * (satın alma kalemlerinde katlanmış tanım, yani uzun metin) adres çubuğuna
 * sığmaz — 2000 kalemlik bir seçim onlarca KB eder ve sunucu isteği reddeder.
 * `POST` gövdesi bu sınırı hiç görmez ve tarayıcı yanıtı yine indirir.
 */
function CiktiFormu({
  packageId,
  filtre,
  sortKey,
  desc,
  keys,
}: {
  packageId: string;
  filtre: PurchaseFilters;
  sortKey: PurchaseSortKey;
  desc: boolean;
  keys: string[];
}) {
  const alanlar = (
    <>
      <input type="hidden" name="q" value={filtre.query} />
      <input type="hidden" name="kategori" value={filtre.sinif} />
      <input type="hidden" name="malzeme" value={filtre.malzeme} />
      <input type="hidden" name="durum" value={filtre.durum} />
      <input type="hidden" name="sira" value={sortKey} />
      <input type="hidden" name="ters" value={desc ? "1" : ""} />
      <input type="hidden" name="secim" value={keys.join("\n")} />
    </>
  );
  const ipucu =
    keys.length > 0
      ? `Yalnız seçili ${keys.length} kalem`
      : "Ekrandaki süzgeçle aynı liste";

  return (
    <span className="flex items-center gap-2">
      <form method="POST" action={`/drawings/${packageId}/purchasing/download?bicim=xlsx`}>
        {alanlar}
        <Button type="submit" variant="outline" size="xs" title={ipucu}>
          <FileSpreadsheet className="size-3" />
          Excel
        </Button>
      </form>
      <form method="POST" action={`/drawings/${packageId}/purchasing/download?bicim=pdf`}>
        {alanlar}
        <Button type="submit" variant="outline" size="xs" title={`${ipucu} — satın alma talebi`}>
          <FileText className="size-3" />
          PDF
        </Button>
      </form>
    </span>
  );
}

// ------------------------------------------------------------------ özet

function SummaryStrip({
  liste,
  alinan,
  teslim,
}: {
  liste: SatinAlmaSonucu;
  alinan: number;
  teslim: number;
}) {
  const toplam = liste.satirlar.length;
  const oran = toplam > 0 ? Math.round((alinan / toplam) * 100) : 0;
  const teslimOran = toplam > 0 ? Math.round((teslim / toplam) * 100) : 0;
  return (
    <section className="border bg-card p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">Sipariş Durumu</h2>
        <p className="font-mono text-[11px] text-muted-foreground">
          {formatNum(alinan)}/{formatNum(toplam)} Sipariş · {formatNum(teslim)} Teslim
        </p>
      </div>

      {/* İKİ ÇUBUK ÜST ÜSTE DEĞİL İÇ İÇE: teslim her zaman siparişin bir alt
          kümesidir ve ayrı iki çubuk toplamı yüzü aşıyormuş gibi görünürdü. */}
      <span className="relative mt-2 block h-1.5 w-full bg-muted" aria-hidden>
        <span className="absolute inset-y-0 left-0 bg-primary/40" style={{ width: `${oran}%` }} />
        <span className="absolute inset-y-0 left-0 bg-primary" style={{ width: `${teslimOran}%` }} />
      </span>

      <ul className="oc-scrollx mt-2 flex flex-wrap items-center gap-1.5 [--oc-scroll-bg:var(--card)]">
        {liste.siniflar.map((s) => (
          <li
            key={s.sinif}
            className="inline-flex items-center gap-1 border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
            title={`${s.sinif}: ${formatNum(s.satirSayisi)} kalem · ${formatNum(s.adet)} adet`}
          >
            {s.sinif}
            <span className="font-semibold text-foreground">{formatNum(s.satirSayisi)}</span>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-[12px] text-muted-foreground">
        {formatNum(liste.kaynakSatiri)} defter satırı {formatNum(toplam)} kaleme indi
        {liste.birlesenKalem > 0 && ` (${formatNum(liste.birlesenKalem)} kalem birleşti)`} ·{" "}
        {formatNum(liste.toplamAdet)} adet
        {liste.toplamAgirlikKg != null && ` · ${formatNum(liste.toplamAgirlikKg, 1)} kg`}.
        {liste.duzeltilmisKalem > 0 &&
          ` ${formatNum(liste.duzeltilmisKalem)} kalemin kategorisi elle düzeltilmiş.`}
        {liste.malzemeCeliskisi > 0 &&
          ` ${formatNum(liste.malzemeCeliskisi)} kalemde kaynak satırlar farklı malzeme söylüyor.`}
      </p>
    </section>
  );
}

// ------------------------------------------------------------------ pencere

function DetailDialog({
  packageId,
  satir,
  stage,
  onClose,
  onSaved,
  onCleared,
}: {
  packageId: string;
  satir: Satir;
  stage: StageDef;
  onClose: () => void;
  onSaved: (d: { dueAt: string; doneAt: string; note: string }) => void;
  onCleared: () => void;
}) {
  const [calisiyor, basla] = useTransition();
  // TABAN 1'DİR: sıfır "alındı ama hiç alınmadı" gibi belirsiz bir hâl
  // üretirdi. 1'in altına inmek işareti KALDIRIR (Üretim tahtasıyla aynı kural).
  const [adet, setAdet] = useState(String(satir.adet ?? 1));
  const [siparisGunu, setSiparisGunu] = useState(satir.tarih);
  const [teslimGunu, setTeslimGunu] = useState(satir.dueAt);
  const [not, setNot] = useState(satir.not);

  const sayi = Number(adet.replace(/[^\d]/g, "")) || 0;
  const kalanGun = teslimGunu ? gunFarki(teslimGunu) : null;

  function kaydet() {
    if (sayi < 1) {
      onCleared();
      return;
    }
    basla(async () => {
      const sonuc = await setPartStage({
        packageId,
        stage: stage.slug,
        key: satir.key,
        qtyDone: sayi,
        doneAt: siparisGunu,
        dueAt: teslimGunu,
        note: not,
      });
      if (sonuc.error) toast.error(sonuc.error);
      else {
        toast.success("Kaydedildi.");
        onSaved({ dueAt: teslimGunu, doneAt: siparisGunu, note: not });
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[min(30rem,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle className="text-base">{stage.name}</DialogTitle>
          <DialogDescription className="text-[12px]">{satir.tanim}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div>
            <span className="oc-kicker block text-muted-foreground">
              Alınan adet {satir.adet != null && `(gereken ${formatNum(satir.adet)})`}
            </span>
            <Input
              value={adet}
              onChange={(e) => setAdet(e.target.value)}
              inputMode="numeric"
              className="mt-1 h-10 w-full text-center font-mono text-base tabular-nums"
              aria-label="Alınan adet"
            />
            {sayi < 1 && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Sıfıra inmek işareti kaldırır.
              </p>
            )}
          </div>

          {/* TEDARİK SÜRESİ HAFTA İLE KONUŞULUR. Tedarikçi "altı hafta" der,
              takvimden gün saymaz; ekranın onu tarihe çevirmesi gerekir.
              Kullanıcı yine de kesin tarihi elle girebilir — hızlı seçim bir
              KISAYOLDUR, bir kısıt değil. */}
          <div>
            <span className="oc-kicker block text-muted-foreground">Tahmini teslim</span>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Select
                value=""
                onValueChange={(v) => setTeslimGunu(haftaSonrasi(Number(v)))}
              >
                <SelectTrigger size="sm" className="w-auto min-w-[9rem] text-base pointer-fine:text-sm">
                  <SelectValue placeholder="Termin" />
                </SelectTrigger>
                <SelectContent>
                  {HAZIR_HAFTALAR.map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {h === 0 ? "Hemen teslim" : `${h} hafta`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={teslimGunu}
                onChange={(e) => setTeslimGunu(e.target.value)}
                className="h-10 min-w-[10rem] flex-1 font-mono text-base pointer-fine:text-sm"
                aria-label="Tahmini teslim tarihi"
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {kalanGun == null
                ? "On haftadan uzun bir süre için tarihi doğrudan yazabilirsiniz."
                : kalanGun < 0
                  ? `${Math.abs(kalanGun)} gün gecikmiş görünüyor.`
                  : `Bugünden ${kalanGun} gün sonra (${tarihGoster(teslimGunu)}).`}
            </p>
          </div>

          <div>
            <span className="oc-kicker block text-muted-foreground">
              Sipariş tarihi (isteğe bağlı)
            </span>
            <Input
              type="date"
              value={siparisGunu}
              onChange={(e) => setSiparisGunu(e.target.value)}
              className="mt-1 h-10 w-full font-mono text-base pointer-fine:text-sm"
            />
          </div>

          <div>
            <span className="oc-kicker block text-muted-foreground">Not (isteğe bağlı)</span>
            <Input
              value={not}
              onChange={(e) => setNot(e.target.value)}
              maxLength={500}
              placeholder="Not"
              className="mt-1 h-10 w-full text-base pointer-fine:text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={calisiyor}>
            Vazgeç
          </Button>
          <Button type="button" onClick={kaydet} disabled={calisiyor}>
            {calisiyor && <Loader2 className="size-4 animate-spin" />}
            {sayi < 1 ? "İşareti kaldır" : "Kaydet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewCategoryDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (ad: string) => void;
}) {
  const [calisiyor, basla] = useTransition();
  const [ad, setAd] = useState("");

  function kaydet() {
    const temiz = ad.trim();
    if (!temiz) return;
    basla(async () => {
      const sonuc = await createPurchaseCategory({ name: temiz });
      if (sonuc.error) toast.error(sonuc.error);
      else onCreated(temiz);
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[min(26rem,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle className="text-base">Yeni Kategori</DialogTitle>
          <DialogDescription className="text-[12px]">
            Kategori bütün paketlerde kullanılabilir olur; seçili kalemler
            kaydedildiği anda buraya taşınır.
          </DialogDescription>
        </DialogHeader>

        <Input
          value={ad}
          onChange={(e) => setAd(e.target.value)}
          maxLength={60}
          placeholder="Kategori"
          className="h-10 w-full text-base pointer-fine:text-sm"
          aria-label="Kategori adı"
          onKeyDown={(e) => {
            if (e.key === "Enter") kaydet();
          }}
        />

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={calisiyor}>
            Vazgeç
          </Button>
          <Button type="button" onClick={kaydet} disabled={calisiyor || !ad.trim()}>
            {calisiyor && <Loader2 className="size-4 animate-spin" />}
            Oluştur ve Taşı
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ ufaklar

/** Süzgeç açılırı — "Tümü" seçeneği ALL sabitiyle taşınır (boş string yasak). */
function Suzgec({
  value,
  onChange,
  bos,
  secenekler,
}: {
  value: string;
  onChange: (v: string) => void;
  bos: string;
  secenekler: { value: string; label: string }[];
}) {
  if (secenekler.length === 0) return null;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className="w-auto min-w-[7.5rem] text-base pointer-fine:text-sm">
        <SelectValue placeholder={bos} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{bos}: Tümü</SelectItem>
        {secenekler.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Seçim kutusu — `components/ui`da Checkbox yok (paylaşılan dizin, bu faz onu
 * eklemez). Ham `<input type="checkbox">` 13px'lik bir hedeftir; 44px'lik bir
 * `label` içine sarmak dokunma hedefi kuralını karşılamanın en ucuz yoludur.
 */
function SecimKutusu({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label
      className="flex min-h-10 w-10 shrink-0 cursor-pointer items-center justify-center pointer-coarse:min-h-11 pointer-coarse:w-11"
      title={label}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-[var(--primary)]"
        aria-label={label}
      />
    </label>
  );
}
