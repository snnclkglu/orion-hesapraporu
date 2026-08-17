"use client";

// HAMMADDE HAVUZU TABLOSU — satınalmacının malzeme yüzeyi.
//
// ══════════════════════════════════════ NEDEN `DemandTable` İKİZLENMEDİ
//
// Ekipman havuzunun tablosu 1264 satırdır ve sütun düzeni İŞ HAZIRLAMA
// LİSTESİ'nin ALIŞKANLIĞIdır — orada birim ADETtir. Hammaddede birim
// değişiyor: sacda m² ve plaka, profilde metre ve BOY, doluda kilo. Aynı
// tabloya iki birim sığdırmaya çalışmak on iki boş sütun doğururdu.
//
// Bu yüzden KARDEŞ bir bileşendir ve ekipman tablosuyla üç şeyi paylaşır:
// `CokluSuzgec`, `FilterBar/SearchBox/SortableHead` ve sipariş/teklif
// pencereleri. Sipariş penceresi ORTAKTIR ve olmalıdır: bir sac plakası da
// bir rulman gibi sipariş edilir, aynı `match_key` uzayında yaşarlar.
//
// ══════════════════════════════════════════ TÜR BİR SÜZGEÇ DEĞİL, BİR KİP
//
// Beş kategori çoklu süzgeç değil TEK SEÇİMLİ bir kip seçicidir, çünkü SÜTUN
// DÜZENİNİ o belirler. "Tümü" görünümünde ölçü tek bir metin sütunudur; bir
// tür seçilince o türün gerçek ölçü sütunları açılır.
//
// SÜTUN SAYISI ELLE SAYILMAZ. Ekipman tablosunda `sutunSayisi` elle yazılmış
// bir sabittir (`canWrite ? 18 : 17`) ve bir sütun eklendiğinde açılır ayrıntı
// satırının `colSpan`ı sessizce kayar. Burada sütunlar bir DİZİDEN üretilir ve
// `colSpan` o dizinin uzunluğudur.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  FolderInput,
  Grid2x2,
  Loader2,
  Pencil,
  Plus,
  PlusCircle,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CokluSuzgec } from "../filters";
import { FilterBar, SearchBox, SortableHead } from "../../drawings/sortable-head";
import { OrderDialog, type SiparisKalemi } from "../order-dialog";
import { QuoteDialog } from "../quote-dialog";
import { BulkQuoteDialog, type TopluTeklifKalemi } from "../bulk-quote-dialog";
import type { TedarikciKaydi, TeklifSatiri } from "../data";
import type { GunlukKur } from "@/lib/purchasing/kur";
import { formatNum } from "@/lib/drawings/labels";
import {
  stokMiktari,
  type HammaddeHavuzu,
  type HammaddeSatiri,
} from "@/lib/purchasing/hammadde/havuz";
import {
  HAMMADDE_ADLARI,
  HAMMADDE_SINIFLARI,
  HAMMADDE_TONLARI,
  type HammaddeSinifi,
} from "@/lib/purchasing/hammadde/siniflar";
import { parcaOlcuAnahtari } from "@/lib/purchasing/hammadde/olcu-duzelt";
import { cn } from "@/lib/utils";
import { saveRawMeta } from "./actions";
import { FileOpenButton } from "../../drawings/[id]/file-open-button";
import { RawManualDialog, RawMetaDialog, RawPartDimsDialog } from "./raw-dialogs";

/** Ölçü penceresine giden parça — havuzdaki `KesimParcasi`nın gerekli yüzü. */
type OlcuDuzenlemesi = {
  anahtar: string;
  sinif: HammaddeSinifi;
  tanim: string;
  hamTanim: string;
  olcuElle: boolean;
  kalinlikMm: number | null;
  enMm: number | null;
  boyMm: number | null;
  disCapMm: number | null;
  icCapMm: number | null;
  resimDisCapMm: number | null;
  resimBoyMm: number | null;
};

// ═══════════════════════════════════════════════════════════════ durum

export type Durum = "bekliyor" | "teklifli" | "kismi" | "tamam";

const DURUM_ETIKET: Record<Durum, string> = {
  bekliyor: "Bekliyor",
  teklifli: "Teklif alındı",
  kismi: "Kısmi sipariş",
  tamam: "Sipariş edildi",
};

/** Satır zemini durumu söyler; renk `DurumCipi`den alınır (ekipman kuralı). */
const DURUM_SATIRI: Record<Durum, string> = {
  bekliyor: "",
  teklifli: "bg-sky-600/[0.05] hover:bg-sky-600/[0.08]",
  kismi: "bg-amber-500/[0.05] hover:bg-amber-500/[0.08]",
  tamam: "bg-emerald-600/[0.05] hover:bg-emerald-600/[0.08]",
};

interface Filtreler {
  query: string;
  tur: HammaddeSinifi | "";
  kaliteler: string[];
  /** KESİT/ÖLÇÜ süzgeci: sacda "15 mm", profilde "UPN 100", doluda "Ø90". */
  kesitler: string[];
  durumlar: string[];
  isler: string[];
}

const BOS: Filtreler = {
  query: "",
  tur: "",
  kaliteler: [],
  kesitler: [],
  durumlar: [],
  isler: [],
};

/**
 * AÇILIŞ SÜZGECİ EKİPMAN TARAFIYLA AYNI MANTIKTA (13.08.2026 kararı):
 * ekranın sorusu "bugün ne sipariş etmeliyim". "Temizle" yine HEPSİNİ gösterir.
 */
const ACILIS: Filtreler = { ...BOS, durumlar: ["bekliyor", "teklifli"] };

interface Gorunum {
  satir: HammaddeSatiri;
  siparisEdilen: number;
  kalan: number;
  teklifler: TeklifSatiri[];
  enIyi: TeklifSatiri | null;
  durum: Durum;
}

/**
 * Sipariş birimi ÇEKİRDEKTEN okunur (`stokMiktari`) — üç ekran tek kuralı
 * paylaşır. Buradaki sarmalayıcı yalnız eski alan adını (`adet`) koruyor.
 */
function siparisAdedi(s: HammaddeSatiri): { adet: number | null; birim: string } {
  const m = stokMiktari(s);
  return { adet: m.miktar, birim: m.birim };
}

function durumu(gereken: number | null, siparisEdilen: number, teklifSayisi: number): Durum {
  if (gereken != null && gereken > 0 && siparisEdilen >= gereken) return "tamam";
  if (siparisEdilen > 0) return "kismi";
  if (teklifSayisi > 0) return "teklifli";
  return "bekliyor";
}

function siparisKalemi(g: Gorunum): SiparisKalemi {
  return {
    matchKey: g.satir.key,
    tanim: g.satir.tanim,
    kalan: g.kalan || siparisAdedi(g.satir).adet || 1,
    birimFiyat: g.enIyi?.unitPrice ?? null,
    paraBirimi: g.enIyi?.currency ?? null,
    tedarikci: g.enIyi?.supplier ?? "",
    // PAY PARÇALARDAN KURULUR: hammadde satırının "payı" hangi işe ne kadar
    // malzeme gittiğidir ve paket işareti parçanın kendi anahtarına yazılır.
    paylar: g.satir.parcalar.map((p) => ({
      itemNo: p.itemNo,
      packageId: p.packageId,
      partKey: p.partKey,
      adet: p.adet ?? 0,
    })),
  };
}

// ═══════════════════════════════════════════════════════════ SÜTUN DÜZENİ

interface Sutun {
  key: string;
  baslik: string;
  /** Sağa yaslı sayısal sütun mu? */
  sag?: boolean;
  /** Görünürlük sınıfı — dar ekranda düşenler. */
  gizle?: string;
}

/**
 * Türe göre değişen ÖLÇÜ BLOĞU — sabit çerçevenin ortasına girer.
 *
 * TELEFONDA (sm altı) ÖLÇÜ SÜTUNLARININ TAMAMI GİZLİDİR (16.08.2026 — yatay
 * kaydırma yasağı): değerleri zaten açılır ayrıntıda parça parça var; telefonda
 * yalnız Stok Kalemi + Durum kalır ve özet birincil hücreye iner.
 */
function olcuSutunlari(tur: HammaddeSinifi | ""): Sutun[] {
  switch (tur) {
    case "SAC":
      return [
        { key: "kalinlik", baslik: "Kalınlık", sag: true, gizle: "hidden sm:table-cell" },
        { key: "alan", baslik: "Toplam m²", sag: true, gizle: "hidden sm:table-cell" },
      ];
    case "PROFIL":
    case "RAY":
      return [
        { key: "kesit", baslik: "Kesit", gizle: "hidden lg:table-cell" },
        { key: "kgm", baslik: "kg/m", sag: true, gizle: "hidden xl:table-cell" },
        { key: "metre", baslik: "Toplam m", sag: true, gizle: "hidden sm:table-cell" },
        { key: "boy", baslik: "Kaç Boy", sag: true, gizle: "hidden sm:table-cell" },
      ];
    case "BORU":
      return [
        { key: "dis", baslik: "Ø Dış", sag: true, gizle: "hidden lg:table-cell" },
        { key: "ic", baslik: "Ø İç", sag: true, gizle: "hidden xl:table-cell" },
        { key: "metre", baslik: "Toplam m", sag: true, gizle: "hidden sm:table-cell" },
        { key: "boy", baslik: "Kaç Boy", sag: true, gizle: "hidden sm:table-cell" },
      ];
    case "DOLU":
      return [
        { key: "dis", baslik: "Ø", sag: true, gizle: "hidden lg:table-cell" },
        { key: "kgm", baslik: "kg/m", sag: true, gizle: "hidden xl:table-cell" },
        { key: "metre", baslik: "Toplam m", sag: true, gizle: "hidden sm:table-cell" },
      ];
    default:
      return [{ key: "olcu", baslik: "Ölçü", gizle: "hidden lg:table-cell" }];
  }
}

function sutunlariKur(tur: HammaddeSinifi | "", canWrite: boolean): Sutun[] {
  return [
    ...(canWrite ? [{ key: "sec", baslik: "" }] : []),
    { key: "ac", baslik: "" },
    { key: "is", baslik: "İş No", gizle: "hidden sm:table-cell" },
    ...(tur === "" ? [{ key: "tur", baslik: "Tür", gizle: "hidden sm:table-cell" }] : []),
    { key: "tanim", baslik: "Stok Kalemi" },
    { key: "kalite", baslik: "Kalite", gizle: "hidden lg:table-cell" },
    ...olcuSutunlari(tur),
    { key: "parca", baslik: "Parça", sag: true, gizle: "hidden md:table-cell" },
    { key: "agirlik", baslik: "Ağırlık kg", sag: true, gizle: "hidden sm:table-cell" },
    { key: "siparis", baslik: "Sipariş", sag: true, gizle: "hidden md:table-cell" },
    { key: "teklif", baslik: "Teklif", gizle: "hidden sm:table-cell" },
    { key: "durum", baslik: "Durum" },
  ];
}

type SortKey = "tur" | "tanim" | "agirlik" | "metre" | "parca";

// ═══════════════════════════════════════════════════════════════ BİLEŞEN

export function RawTable({
  havuz,
  stokAdlari = [],
  teklifler,
  siparisAdetleri,
  tedarikciler,
  defter,
  siparisNolari,
  sonKur,
  qualities = [],
  defterVar,
  isler,
  canWrite,
}: {
  havuz: HammaddeHavuzu;
  /** Havuzdaki stok kalemi adları — "Yeni Talep" penceresinin öneri listesi. */
  stokAdlari?: string[];
  teklifler: TeklifSatiri[];
  siparisAdetleri: [string, number][];
  tedarikciler: string[];
  defter: TedarikciKaydi[];
  siparisNolari: string[];
  sonKur?: GunlukKur | null;
  qualities?: string[];
  /** Düzeltme defteri okunabildi mi? Okunamadıysa taşıma düğmeleri kapalıdır. */
  defterVar: boolean;
  /**
   * İŞ LİSTESİ — `jobNo` ZORUNLUDUR.
   *
   * Süzgeç bir süre `job_items.item_no` metniyle eşleşiyordu ve canlı veride
   * SESSİZCE YANLIŞ ÇALIŞIYORDU (kullanıcı bildirimi, 15.08.2026: *"iş
   * filtrelendiğinde tablo değişmiyor"*): `drawing_packages.item_no` her zaman
   * bir iş kalemi numarası DEĞİLDİR — MONORAY paketi `0057-00` taşıyor ve o
   * numarayla bir `job_items` satırı yok. O paketin 35 kalemi süzgece hiç
   * görünmüyordu. Bağ artık İŞ NUMARASINDAN kurulur; item_no yalnız yedektir.
   */
  isler: { id: string; jobNo: string; itemNos: string[]; label: string }[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [calisiyor, basla] = useTransition();

  const [f, setF] = useState<Filtreler>(ACILIS);
  const [sortKey, setSortKey] = useState<SortKey>("agirlik");
  const [desc, setDesc] = useState(true);
  const [secili, setSecili] = useState<Set<string>>(new Set());
  const [acik, setAcik] = useState<Set<string>>(new Set());
  const [duzenlenen, setDuzenlenen] = useState<HammaddeSatiri | null>(null);
  const [olcuParcasi, setOlcuParcasi] = useState<OlcuDuzenlemesi | null>(null);
  const [yeniTalep, setYeniTalep] = useState(false);
  const [teklifPenceresi, setTeklifPenceresi] = useState<Gorunum | null>(null);
  const [topluTeklif, setTopluTeklif] = useState<TopluTeklifKalemi[] | null>(null);
  const [siparisKalemleri, setSiparisKalemleri] = useState<SiparisKalemi[] | null>(null);

  const siparisHaritasi = useMemo(() => new Map(siparisAdetleri), [siparisAdetleri]);
  const teklifHaritasi = useMemo(() => {
    const m = new Map<string, TeklifSatiri[]>();
    for (const t of teklifler) {
      const liste = m.get(t.matchKey);
      if (liste) liste.push(t);
      else m.set(t.matchKey, [t]);
    }
    return m;
  }, [teklifler]);

  const gorunumler = useMemo<Gorunum[]>(
    () =>
      havuz.satirlar.map((satir) => {
        const siparisEdilen = siparisHaritasi.get(satir.key) ?? 0;
        const kendi = teklifHaritasi.get(satir.key) ?? [];
        // KURU OLMAYAN TEKLİF YARIŞA GİRMEZ (SATIN-21): `null` fiyat sıfır değildir.
        const enIyi =
          kendi
            .filter((t) => t.unitPriceEur != null)
            .sort((a, b) => (a.unitPriceEur ?? 0) - (b.unitPriceEur ?? 0))[0] ?? null;
        const gereken = siparisAdedi(satir).adet;
        return {
          satir,
          siparisEdilen,
          kalan: gereken == null ? 0 : Math.max(0, gereken - siparisEdilen),
          teklifler: kendi,
          enIyi,
          durum: durumu(gereken, siparisEdilen, kendi.length),
        };
      }),
    [havuz.satirlar, siparisHaritasi, teklifHaritasi]
  );

  /** İş kimliği → o işe ait iş numarası ve kalem numaraları. */
  const isEslesme = useMemo(
    () => new Map(isler.map((j) => [j.id, { jobNo: j.jobNo, kalemler: new Set(j.itemNos) }])),
    [isler]
  );
  /** Bir pay bu işe mi ait? Önce iş numarası, sonra kalem numarası. */
  const payIse = useMemo(
    () =>
      (pay: { jobNo: string; itemNo: string }, jobId: string): boolean => {
        const e = isEslesme.get(jobId);
        if (!e) return false;
        if (e.jobNo && pay.jobNo && e.jobNo === pay.jobNo) return true;
        return e.kalemler.has(pay.itemNo);
      },
    [isEslesme]
  );

  // SAYAÇLAR SÜZGEÇSİZ LİSTEDEN GELİR (ekipman tablosunun kasıtlı kuralı):
  // seçenek sayısı süzgeçle birlikte değişirse kullanıcı ne kaybettiğini
  // göremez.
  const secenekler = useMemo(() => {
    const say = (f: (g: Gorunum) => string | null) => {
      const m = new Map<string, number>();
      for (const g of gorunumler) {
        const v = f(g);
        if (v) m.set(v, (m.get(v) ?? 0) + 1);
      }
      return m;
    };
    const kaliteSay = say((g) => g.satir.kalite || null);
    const durumSay = say((g) => g.durum);
    const turSay = say((g) => g.satir.sinif);
    const kesitSay = say((g) => g.satir.kesitKodu || null);
    return {
      turler: HAMMADDE_SINIFLARI.map((s) => ({
        value: s,
        label: HAMMADDE_ADLARI[s],
        count: turSay.get(s) ?? 0,
      })),
      kaliteler: [...kaliteSay.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], "tr"))
        .map(([value, count]) => ({ value, label: value, count })),
      // KESİT SAYISAL SIRALANIR: "10 mm" ile "8 mm" alfabetik sıralandığında
      // 10 önce gelir ve kalınlık listesi okunmaz olur.
      kesitler: [...kesitSay.entries()]
        .sort((a, b) => {
          const sa = Number.parseFloat(a[0].replace(",", ".").replace(/[^\d.]/g, ""));
          const sb = Number.parseFloat(b[0].replace(",", ".").replace(/[^\d.]/g, ""));
          if (Number.isFinite(sa) && Number.isFinite(sb) && sa !== sb) return sa - sb;
          return a[0].localeCompare(b[0], "tr");
        })
        .map(([value, count]) => ({ value, label: value, count })),
      durumlar: (["bekliyor", "teklifli", "kismi", "tamam"] as Durum[])
        .filter((d) => durumSay.has(d))
        .map((d) => ({ value: d, label: DURUM_ETIKET[d], count: durumSay.get(d) ?? 0 })),
      // SAYAÇ GÖSTERİLİR: süzgecin gerçekten ne yaptığı ancak sayıyla görünür.
      // Sayısız bir listede kullanıcı "hiçbir şey değişmedi" der ve haklıdır —
      // değişip değişmediğini ölçebileceği bir şey yoktur.
      isler: isler
        .map((j) => ({
          value: j.id,
          label: j.label,
          count: gorunumler.filter((g) => g.satir.paylar.some((p) => payIse(p, j.id))).length,
        }))
        .filter((x) => x.count > 0),
    };
  }, [gorunumler, isler, payIse]);

  const gorunen = useMemo(() => {
    const q = f.query.trim().toLocaleLowerCase("tr-TR");
    const kaliteKumesi = new Set(f.kaliteler);
    const kesitKumesi = new Set(f.kesitler);
    const durumKumesi = new Set(f.durumlar);

    const liste = gorunumler.filter((g) => {
      if (f.tur && g.satir.sinif !== f.tur) return false;
      if (kaliteKumesi.size > 0 && !kaliteKumesi.has(g.satir.kalite)) return false;
      if (kesitKumesi.size > 0 && !kesitKumesi.has(g.satir.kesitKodu)) return false;
      if (durumKumesi.size > 0 && !durumKumesi.has(g.durum)) return false;
      if (f.isler.length > 0 && !g.satir.paylar.some((p) => f.isler.some((id) => payIse(p, id)))) {
        return false;
      }
      if (!q) return true;
      const metin = [
        g.satir.tanim,
        g.satir.kesitKodu,
        g.satir.kalite,
        g.satir.not,
        ...g.satir.parcalar.map((p) => p.tanim),
        ...g.satir.parcalar.map((p) => p.groupName),
        ...g.satir.paylar.map((p) => `${p.itemNo} ${p.customer}`),
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");
      return metin.includes(q);
    });

    const yon = desc ? -1 : 1;
    return [...liste].sort((a, b) => {
      switch (sortKey) {
        case "tur":
          return yon * a.satir.sinif.localeCompare(b.satir.sinif, "tr");
        case "tanim":
          return yon * a.satir.tanim.localeCompare(b.satir.tanim, "tr");
        case "metre":
          return yon * ((a.satir.toplamBoyMm ?? 0) - (b.satir.toplamBoyMm ?? 0));
        case "parca":
          return yon * (a.satir.parcaAdedi - b.satir.parcaAdedi);
        default:
          return yon * ((a.satir.toplamAgirlikKg ?? 0) - (b.satir.toplamAgirlikKg ?? 0));
      }
    });
  }, [gorunumler, f, sortKey, desc, payIse]);

  const temiz = JSON.stringify(f) === JSON.stringify(BOS);
  const seciliGorunumler = gorunen.filter((g) => secili.has(g.satir.key));
  const ciktiListesi = seciliGorunumler.length > 0 ? seciliGorunumler : gorunen;
  const sutunlar = sutunlariKur(f.tur, canWrite);

  function sirala(k: SortKey) {
    if (k === sortKey) setDesc((d) => !d);
    else {
      setSortKey(k);
      setDesc(k === "agirlik" || k === "metre" || k === "parca");
    }
  }

  function tureTasi(tur: HammaddeSinifi | "") {
    if (seciliGorunumler.length === 0) return;
    basla(async () => {
      const sonuc = await saveRawMeta({
        keys: seciliGorunumler.map((g) => g.satir.kaynakAnahtar),
        samples: seciliGorunumler.map((g) => g.satir.tanim),
        kind: tur,
        label: null,
        note: null,
        stockLengthMm: null,
        excluded: null,
      });
      if (sonuc.error) toast.error(sonuc.error);
      else {
        toast.success(
          tur
            ? `${formatNum(sonuc.ok ?? 0)} kalem “${HAMMADDE_ADLARI[tur]}” grubuna taşındı.`
            : `${formatNum(sonuc.ok ?? 0)} kalemin taşıması geri alındı.`
        );
        setSecili(new Set());
        router.refresh();
      }
    });
  }

  /** SAC seçimini yerleşim ekranına taşır — anahtarlar adreste gider. */
  function yerlesimeGonder() {
    const sac = seciliGorunumler.filter((g) => g.satir.sinif === "SAC");
    if (sac.length === 0) {
      toast.error("Yerleşim yalnız SAC kalemleri için yapılır.");
      return;
    }
    const p = new URLSearchParams();
    for (const g of sac) p.append("k", g.satir.key);
    router.push(`/purchasing/hammadde/yerlesim?${p.toString()}`);
  }

  return (
    <div className="grid gap-3">
      <OzetSeridi havuz={havuz} gorunumler={gorunumler} />

      <TurSeridi
        secili={f.tur}
        secenekler={secenekler.turler}
        onChange={(v) => setF((s) => ({ ...s, tur: v }))}
      />

      <FilterBar
        gorunen={gorunen.length}
        toplam={gorunumler.length}
        temiz={temiz}
        onTemizle={() => setF(BOS)}
      >
        <SearchBox
          value={f.query}
          onChange={(v) => setF((s) => ({ ...s, query: v }))}
          placeholder="Stok, Kesit, Parça, İş Ara…"
          className="w-[min(18rem,calc(100vw-4rem))]"
        />
        <CokluSuzgec
          baslik="İş"
          secenekler={secenekler.isler}
          secili={f.isler}
          onChange={(v) => setF((s) => ({ ...s, isler: v }))}
        />
        <CokluSuzgec
          baslik="Kalite"
          secenekler={secenekler.kaliteler}
          secili={f.kaliteler}
          onChange={(v) => setF((s) => ({ ...s, kaliteler: v }))}
        />
        {/* ÖLÇÜ SÜZGECİ (kullanıcı isteği): sacda kalınlık, profilde kesit.
            Başlık türle birlikte değişir — "Kalınlık" yazan bir süzgeç profil
            kipinde yalan söylerdi. */}
        <CokluSuzgec
          baslik={f.tur === "SAC" ? "Kalınlık" : f.tur === "DOLU" ? "Çap" : "Ölçü"}
          secenekler={secenekler.kesitler}
          secili={f.kesitler}
          onChange={(v) => setF((s) => ({ ...s, kesitler: v }))}
        />
        <CokluSuzgec
          baslik="Durum"
          secenekler={secenekler.durumlar}
          secili={f.durumlar}
          onChange={(v) => setF((s) => ({ ...s, durumlar: v }))}
        />

        <span className="hidden h-5 w-px bg-border sm:block" />

        <CiktiFormu
          anahtarlar={ciktiListesi.map((g) => g.satir.key)}
          secimVar={seciliGorunumler.length > 0}
          suzgecOzeti={suzgecOzeti(f, secenekler)}
        />

        {canWrite && (
          <Button type="button" size="xs" onClick={() => setYeniTalep(true)}>
            <PlusCircle className="size-3" />
            Yeni Talep
          </Button>
        )}
      </FilterBar>

      {!defterVar && (
        <p className="border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-400">
          Düzeltme defteri okunamadı (<code>purchase_raw_meta</code>). Taşıma ve düzeltme geçici
          olarak kapalı; havuz yine de türetiliyor.
        </p>
      )}

      {havuz.belirsizKalem > 0 && (
        <p className="border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-400">
          <strong>{formatNum(havuz.belirsizKalem)} kalemin adedi belirsiz.</strong> İş kaleminin
          sayısal adedi girilmediği için çarpan <strong>1</strong> kabul edildi.
        </p>
      )}

      {gorunen.length === 0 ? (
        <div className="border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {gorunumler.length === 0
              ? "Hammadde ihtiyacı yok. Teknik resim paketi yüklenip eşleştirildiğinde imalat satırlarının malzemesi buraya düşer."
              : "Bu süzgeçle eşleşen kalem yok. Süzgeci temizleyip yeniden deneyin."}
          </p>
        </div>
      ) : (
        <div className="oc-scrollx oc-table-clamp border bg-card [--oc-scroll-bg:var(--card)]">
          <Table>
            <TableHeader className="oc-sticky-head">
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {sutunlar.map((s) => {
                  if (s.key === "sec") {
                    const hepsi = gorunen.length > 0 && gorunen.every((g) => secili.has(g.satir.key));
                    return (
                      <TableHead key={s.key} className="w-10">
                        <SecimKutusu
                          isaretli={hepsi}
                          onChange={(v) =>
                            setSecili(v ? new Set(gorunen.map((g) => g.satir.key)) : new Set())
                          }
                          etiket="Görünen kalemleri seç"
                        />
                      </TableHead>
                    );
                  }
                  if (s.key === "ac") return <TableHead key={s.key} className="w-8" />;
                  const sortable: Partial<Record<string, SortKey>> = {
                    tur: "tur",
                    tanim: "tanim",
                    agirlik: "agirlik",
                    metre: "metre",
                    parca: "parca",
                  };
                  const sk = sortable[s.key];
                  if (sk) {
                    return (
                      <SortableHead
                        key={s.key}
                        sortKey={sk}
                        current={sortKey}
                        desc={desc}
                        onSort={() => sirala(sk)}
                        align={s.sag ? "right" : "left"}
                        className={s.gizle}
                      >
                        {s.baslik}
                      </SortableHead>
                    );
                  }
                  return (
                    <TableHead
                      key={s.key}
                      className={cn(s.gizle, s.sag && "text-right")}
                    >
                      {s.baslik}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              <ToplamSatiri gorunen={gorunen} sutunlar={sutunlar} />
              {gorunen.map((g) => (
                <Satir
                  key={g.satir.key}
                  g={g}
                  sutunlar={sutunlar}
                  tur={f.tur}
                  canWrite={canWrite}
                  secili={secili.has(g.satir.key)}
                  acik={acik.has(g.satir.key)}
                  onSec={(v) =>
                    setSecili((s) => {
                      const y = new Set(s);
                      if (v) y.add(g.satir.key);
                      else y.delete(g.satir.key);
                      return y;
                    })
                  }
                  onAc={() =>
                    setAcik((s) => {
                      const y = new Set(s);
                      if (y.has(g.satir.key)) y.delete(g.satir.key);
                      else y.add(g.satir.key);
                      return y;
                    })
                  }
                  onTeklif={() => setTeklifPenceresi(g)}
                  onSiparis={() =>
                    g.satir.sinif === "SAC"
                      ? router.push(
                          `/purchasing/hammadde/yerlesim?k=${encodeURIComponent(g.satir.key)}`
                        )
                      : setSiparisKalemleri([siparisKalemi(g)])
                  }
                  onDuzenle={() => setDuzenlenen(g.satir)}
                  onOlcu={setOlcuParcasi}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
        <span>
          {formatNum(gorunen.length)} / {formatNum(gorunumler.length)} stok kalemi
        </span>
        <span>{formatNum(havuz.kaynakSatiri)} imalat satırından türetildi</span>
        {calisiyor && (
          <span className="inline-flex items-center gap-1 text-foreground">
            <Loader2 className="size-3 animate-spin" /> Kaydediliyor
          </span>
        )}
      </p>

      {canWrite && secili.size > 0 && (
        <div className="sticky bottom-2 z-20 flex flex-wrap items-center gap-2 border bg-card p-2 shadow-lg">
          <span className="font-mono text-[12px] font-medium">
            {formatNum(secili.size)} Kalem Seçili
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {formatNum(
              Math.round(seciliGorunumler.reduce((t, g) => t + (g.satir.toplamAgirlikKg ?? 0), 0))
            )}{" "}
            kg
          </span>
          <Button type="button" size="xs" variant="ghost" onClick={() => setSecili(new Set())}>
            Seçimi bırak
          </Button>
          <span className="ml-auto flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={yerlesimeGonder}
              disabled={!seciliGorunumler.some((g) => g.satir.sinif === "SAC")}
              title="Seçili sac kalemlerini plaka yerleşimine gönder"
            >
              <Grid2x2 className="size-3" />
              Plakaya Yerleştir
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="xs" variant="outline" disabled={calisiyor || !defterVar}>
                  <FolderInput className="size-3" />
                  Türe Taşı
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[min(14rem,calc(100vw-1.5rem))]">
                <DropdownMenuLabel className="oc-kicker text-muted-foreground">
                  Seçili {formatNum(secili.size)} kalem
                </DropdownMenuLabel>
                {HAMMADDE_SINIFLARI.map((s) => (
                  <DropdownMenuItem key={s} onSelect={() => tureTasi(s)}>
                    {HAMMADDE_ADLARI[s]}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem onSelect={() => tureTasi("")}>
                  Taşımayı geri al (sözlüğe bırak)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() =>
                // MİKTAR PENCEREYE TAŞINIR (15.08.2026): teklif penceresi
                // neyin fiyatını sorduğunu göstermeli — "10 mm sactan 3.537
                // kg" ile "bir kalem sac" aynı soru değildir.
                setTopluTeklif(
                  seciliGorunumler.map((g) => {
                    const m = stokMiktari(g.satir);
                    return {
                      matchKey: g.satir.key,
                      tanim: g.satir.tanim,
                      miktar: m.miktar,
                      birim: m.birim,
                    };
                  })
                )
              }
            >
              <Tag className="size-3" />
              Teklif Aç
            </Button>
            {/* SAC SEÇİLİYSE SİPARİŞ BURADAN VERİLMEZ: plaka ölçüsü yerleşimden
                çıkar. Düğme pasifleşir ve sebebini söyler — sessizce kilo
                üzerinden bir sipariş açmak yanlış kalem yaratırdı. */}
            <Button
              type="button"
              size="xs"
              onClick={() => setSiparisKalemleri(seciliGorunumler.map(siparisKalemi))}
              disabled={seciliGorunumler.some((g) => g.satir.sinif === "SAC")}
              title={
                seciliGorunumler.some((g) => g.satir.sinif === "SAC")
                  ? "Sac siparişi plaka üzerinden verilir — “Plakaya Yerleştir” ile devam edin"
                  : undefined
              }
            >
              <Plus className="size-3" />
              Sipariş Aç
            </Button>
          </span>
        </div>
      )}

      {teklifPenceresi && (
        <QuoteDialog
          key={teklifPenceresi.satir.key}
          matchKey={teklifPenceresi.satir.key}
          tanim={teklifPenceresi.satir.tanim}
          teklifler={teklifPenceresi.teklifler}
          tedarikciler={tedarikciler}
          sonKur={sonKur}
          canWrite={canWrite}
          scope="hammadde"
          onClose={() => setTeklifPenceresi(null)}
          onChanged={() => router.refresh()}
        />
      )}
      {topluTeklif && (
        <BulkQuoteDialog
          kalemler={topluTeklif}
          tedarikciler={tedarikciler}
          sonKur={sonKur}
          scope="hammadde"
          onClose={() => setTopluTeklif(null)}
          onSaved={() => {
            setTopluTeklif(null);
            setSecili(new Set());
            router.refresh();
          }}
        />
      )}
      {siparisKalemleri && (
        <OrderDialog
          kalemler={siparisKalemleri}
          tedarikciler={tedarikciler}
          defter={defter}
          siparisNolari={siparisNolari}
          sonKur={sonKur}
          qualities={qualities}
          onClose={() => setSiparisKalemleri(null)}
          onSaved={() => {
            setSiparisKalemleri(null);
            setSecili(new Set());
            router.refresh();
          }}
        />
      )}
      {duzenlenen && (
        <RawMetaDialog
          satir={duzenlenen}
          qualities={qualities}
          onClose={() => setDuzenlenen(null)}
          onSaved={() => {
            setDuzenlenen(null);
            router.refresh();
          }}
        />
      )}
      {yeniTalep && (
        <RawManualDialog
          isler={isler}
          qualities={qualities}
          stokAdlari={stokAdlari}
          onClose={() => setYeniTalep(false)}
          onSaved={() => {
            setYeniTalep(false);
            router.refresh();
          }}
        />
      )}
      {olcuParcasi && (
        <RawPartDimsDialog
          key={olcuParcasi.anahtar}
          parca={olcuParcasi}
          sinif={olcuParcasi.sinif}
          onClose={() => setOlcuParcasi(null)}
          onSaved={() => {
            setOlcuParcasi(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════ SATIR

function Satir({
  g,
  sutunlar,
  tur,
  canWrite,
  secili,
  acik,
  onSec,
  onAc,
  onTeklif,
  onSiparis,
  onDuzenle,
  onOlcu,
}: {
  g: Gorunum;
  sutunlar: Sutun[];
  tur: HammaddeSinifi | "";
  canWrite: boolean;
  secili: boolean;
  acik: boolean;
  onSec: (v: boolean) => void;
  onAc: () => void;
  onTeklif: () => void;
  onSiparis: () => void;
  onDuzenle: () => void;
  onOlcu: (p: OlcuDuzenlemesi) => void;
}) {
  const s = g.satir;
  const sip = siparisAdedi(s);
  const metre = s.toplamBoyMm == null ? null : s.toplamBoyMm / 1000;

  // İş No özeti İKİ yerde okunur (kendi sütunu + telefon katmanı) — tek kez
  // kurulur, iki yazım ayrışamaz.
  const isOzeti =
    s.paylar.length === 0
      ? null
      : s.paylar.length === 1
        ? s.paylar[0].itemNo || null
        : `${s.paylar[0].itemNo} +${s.paylar.length - 1}`;
  const isIpucu = s.paylar.map((p) => p.itemNo).join(", ");

  // Teklif düğmesi de öyle: masaüstünde kendi sütununda, telefonda Stok
  // Kalemi'nin katmanında AYNI öğe.
  const teklifDugmesi = (
    <button type="button" onClick={onTeklif} className="oc-tap font-mono underline-offset-2 hover:underline">
      {g.enIyi?.unitPriceEur != null
        ? `${formatNum(g.enIyi.unitPriceEur, 2)} €`
        : g.teklifler.length > 0
          ? `${g.teklifler.length} teklif`
          : "—"}
    </button>
  );

  const hucre = (k: string) => {
    const sutun = sutunlar.find((x) => x.key === k);
    const cls = cn(
      "align-top text-[12px]",
      sutun?.sag && "text-right font-mono tabular-nums",
      sutun?.gizle
    );
    switch (k) {
      case "kalinlik":
        return (
          <TableCell key={k} className={cls}>
            {sayi(s.parcalar[0]?.kalinlikMm)}
          </TableCell>
        );
      case "alan":
        return (
          <TableCell key={k} className={cls}>
            {s.toplamAlanMm2 == null ? bos() : formatNum(s.toplamAlanMm2 / 1e6, 2)}
          </TableCell>
        );
      case "kesit":
        return (
          <TableCell key={k} className={cls}>
            {s.kesitKodu || bos()}
          </TableCell>
        );
      case "kgm":
        return (
          <TableCell key={k} className={cls}>
            {s.kgPerM == null ? (
              bos()
            ) : (
              <span title={s.agirlikKaynagi === "tablo" ? "Standart tablo" : "Geometriden hesaplandı"}>
                {formatNum(s.kgPerM, 2)}
                {s.agirlikKaynagi === "geometri" && (
                  <span className="ml-0.5 text-muted-foreground">*</span>
                )}
              </span>
            )}
          </TableCell>
        );
      case "metre":
        return (
          <TableCell key={k} className={cls}>
            {metre == null ? bos() : formatNum(metre, 1)}
          </TableCell>
        );
      case "boy":
        // BOY ADEDİ 0 AMA UZUN PARÇA VARSA "0" YAZILMAZ: sayı doğrudur (hiçbir
        // parça standart boya sığmıyor) ama okuyan onu "ihtiyaç yok" sanar.
        // Uzunluk bir eksiklik değil bir KARARdır — ekleme yapılacaktır.
        return (
          <TableCell key={k} className={cls}>
            {s.boyAdedi == null ? (
              bos()
            ) : s.boyAdedi === 0 && s.boyuAsanParca > 0 ? (
              <span
                className="text-amber-600"
                title={`${s.boyuAsanParca} parça ${formatNum(s.stokBoyuMm ?? 0)} mm boydan uzun — ekleme gerekir`}
              >
                ⚠ ekli
              </span>
            ) : (
              <span title={`${formatNum(s.stokBoyuMm ?? 0)} mm boydan`}>
                {formatNum(s.boyAdedi)}
                {s.boyuAsanParca > 0 && (
                  <span
                    className="ml-1 text-amber-600"
                    title={`Ayrıca ${s.boyuAsanParca} parça stok boyundan uzun — ekleme gerekir`}
                  >
                    ⚠
                  </span>
                )}
              </span>
            )}
          </TableCell>
        );
      case "dis":
        return (
          <TableCell key={k} className={cls}>
            {sayi(s.parcalar[0]?.disCapMm)}
          </TableCell>
        );
      case "ic":
        return (
          <TableCell key={k} className={cls}>
            {sayi(s.parcalar[0]?.icCapMm)}
          </TableCell>
        );
      case "olcu":
        return (
          <TableCell key={k} className={cls}>
            {s.kesitKodu || bos()}
          </TableCell>
        );
      case "parca":
        return (
          <TableCell key={k} className={cls} title={`${s.parcaSayisi} farklı parça`}>
            {formatNum(s.parcaAdedi)}
          </TableCell>
        );
      case "agirlik":
        return (
          <TableCell key={k} className={cls}>
            {s.toplamAgirlikKg == null ? bos() : formatNum(Math.round(s.toplamAgirlikKg))}
          </TableCell>
        );
      case "siparis":
        return (
          <TableCell key={k} className={cls}>
            {g.siparisEdilen > 0 ? `${formatNum(g.siparisEdilen)} ${sip.birim}` : bos()}
          </TableCell>
        );
      case "teklif":
        return (
          <TableCell key={k} className={cn(cls, "font-mono")}>
            {teklifDugmesi}
          </TableCell>
        );
      case "durum":
        // SAC SİPARİŞİ HAVUZDAN VERİLMEZ (kullanıcı kararı, 15.08.2026 —
        // DESSAN proforması örnek verildi): *"Sac siparişinde parçaların bir
        // önemi olmuyor; onların birleştiği plakaları sipariş ediyoruz."*
        // Plaka ölçüsü ancak YERLEŞİM yapılınca bilinir, o yüzden çip sipariş
        // penceresi yerine yerleşim ekranını açar.
        return (
          <TableCell key={k} className={cls}>
            <DurumCipi
              durum={g.durum}
              onClick={canWrite ? onSiparis : undefined}
              sac={s.sinif === "SAC"}
            />
          </TableCell>
        );
      default:
        return <TableCell key={k} className={cls} />;
    }
  };

  return (
    <>
      <TableRow className={cn(DURUM_SATIRI[g.durum], secili && "bg-primary/[0.07]")}>
        {canWrite && (
          <TableCell className="align-top">
            <SecimKutusu isaretli={secili} onChange={onSec} etiket={s.tanim} />
          </TableCell>
        )}
        <TableCell className="align-top">
          <button
            type="button"
            onClick={onAc}
            className="oc-tap-square grid size-6 place-items-center text-muted-foreground hover:text-foreground"
            aria-label={acik ? "Kapat" : "Parçaları göster"}
          >
            {acik ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
        </TableCell>
        {/* Telefonda İş No ve Tür sütunları gizlidir; bilgi Stok Kalemi'nin
            katmanına iner (yatay kaydırma yasağı). */}
        <TableCell className="hidden align-top font-mono text-[12px] whitespace-nowrap tabular-nums sm:table-cell">
          {isOzeti == null ? bos() : <span title={isIpucu}>{isOzeti}</span>}
        </TableCell>
        {tur === "" && (
          <TableCell className="hidden align-top sm:table-cell">
            <TurCipi sinif={s.sinif} elle={s.sinifElle} />
          </TableCell>
        )}
        <TableCell className="max-w-[12rem] align-top md:max-w-[20rem] xl:max-w-[28rem]">
          <div className="flex items-start gap-1.5">
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium" title={s.tanim}>
              {s.tanim}
            </span>
            {s.manualId && (
              <span className="oc-kicker shrink-0 border border-border px-1 text-[10px] text-muted-foreground">
                Manuel
              </span>
            )}
            {s.payUygulandi && (
              <span
                className="oc-kicker shrink-0 border border-sky-600/40 px-1 text-[10px] text-sky-700 dark:text-sky-400"
                title="Ressamın parantez içinde verdiği satın alma payı uygulandı"
              >
                Pay
              </span>
            )}
            {/* ÖLÇÜSÜ DEĞİŞTİRİLMİŞ PARÇA VARSA ROZET SATIRIN KENDİSİNDE: satır
                açılmadan da görünmeli, yoksa "bu kalemi biri değiştirmiş mi"
                sorusu ancak tek tek açarak cevaplanırdı. */}
            {s.parcalar.some((p) => p.olcuElle) && (
              <span
                className="oc-kicker shrink-0 border border-destructive/40 px-1 text-[10px] text-destructive"
                title="Bu kalemin bazı parçalarının ölçüsü elle değiştirildi"
              >
                Ölçü ✎
              </span>
            )}
            {canWrite && (
              <button
                type="button"
                onClick={onDuzenle}
                className="oc-tap-square grid size-6 shrink-0 place-items-center text-muted-foreground hover:text-foreground"
                aria-label="Düzenle"
                title="Düzenle · taşı · not"
              >
                <Pencil className="size-3" />
              </button>
            )}
          </div>
          {s.eksikler.length > 0 && (
            <p className="mt-0.5 text-[11px] text-amber-600 dark:text-amber-500">
              {s.eksikler.join(" · ")}
            </p>
          )}
          {s.not && <p className="mt-0.5 text-[11px] text-muted-foreground">{s.not}</p>}
          {/* TELEFON KATMANI (sm altı): gizlenen İş No · Tür · Ağırlık ·
              Sipariş · Teklif buraya iner — tablo listeye katlanır. */}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 sm:hidden">
            {isOzeti != null && (
              <span className="font-mono text-[11px] text-muted-foreground" title={isIpucu}>
                {isOzeti}
              </span>
            )}
            {tur === "" && <TurCipi sinif={s.sinif} elle={s.sinifElle} />}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[12px] tabular-nums sm:hidden">
            {s.toplamAgirlikKg != null && (
              <span>{formatNum(Math.round(s.toplamAgirlikKg))} kg</span>
            )}
            {g.siparisEdilen > 0 && (
              <span className="text-muted-foreground">
                {formatNum(g.siparisEdilen)} {sip.birim} sipariş
              </span>
            )}
            {teklifDugmesi}
          </div>
        </TableCell>
        <TableCell className="hidden align-top font-mono text-[12px] lg:table-cell">
          {s.kalite || bos()}
        </TableCell>
        {olcuSutunlari(tur).map((c) => hucre(c.key))}
        {hucre("parca")}
        {hucre("agirlik")}
        {hucre("siparis")}
        {hucre("teklif")}
        {hucre("durum")}
      </TableRow>

      {acik && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={sutunlar.length} className="bg-muted/30 p-0">
            <div className="oc-scrollx overflow-x-auto p-3 [--oc-scroll-bg:var(--muted)]">
              <table className="w-full text-[12px]">
                <thead>
                  {/* Telefonda Parça + Satın Alma Ölçüsü + Gereken kalır
                      (yatay kaydırma yasağı); kalanı geniş ekranın işidir. */}
                  <tr className="text-left text-muted-foreground">
                    <th className="pr-3 pb-1 font-normal">Parça</th>
                    <th className="hidden pr-3 pb-1 font-normal md:table-cell">İş Kalemi</th>
                    <th className="hidden pr-3 pb-1 font-normal md:table-cell">Kullanıldığı Yer</th>
                    <th className="hidden pr-3 pb-1 font-normal sm:table-cell">Resim Ölçüsü</th>
                    <th className="pr-3 pb-1 font-normal">Satın Alma Ölçüsü</th>
                    <th className="hidden pr-3 pb-1 text-right font-normal sm:table-cell">Resimde</th>
                    <th className="hidden pr-3 pb-1 text-right font-normal sm:table-cell">× Kalem</th>
                    <th className="pr-3 pb-1 text-right font-normal">Gereken</th>
                    <th className="hidden pr-3 pb-1 text-right font-normal sm:table-cell">Birim kg</th>
                    <th className="hidden pr-3 pb-1 font-normal sm:table-cell">Pafta</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {s.parcalar.map((p, i) => (
                    <tr
                      key={`${p.partKey}-${i}`}
                      className={cn(
                        "border-t border-border/50",
                        // ÖLÇÜSÜ DEĞİŞTİRİLMİŞ SATIR KIRMIZI (kullanıcı isteği,
                        // 15.08.2026): *"değiştirdiğim kırmızı renkli olsun,
                        // değiştirildi gibi göze çarpsın çünkü parçayı
                        // değiştirmiş oluyoruz."*
                        p.olcuElle && "bg-destructive/[0.06]"
                      )}
                    >
                      <td className="py-1 pr-3 font-sans">
                        <span className={cn(p.olcuElle && "font-medium text-destructive")}>
                          {p.tanim}
                        </span>
                        {p.olcuElle && (
                          <span
                            className="ml-1.5 border border-destructive/40 px-1 font-mono text-[10px] text-destructive"
                            title={`Ressamın yazdığı: ${p.hamTanim}`}
                          >
                            DEĞİŞTİRİLDİ
                          </span>
                        )}
                      </td>
                      <td className="hidden py-1 pr-3 md:table-cell">{p.itemNo || "—"}</td>
                      <td className="hidden py-1 pr-3 font-sans md:table-cell">{p.groupName || "—"}</td>
                      {/* İKİ ÖLÇÜ YAN YANA — kullanıcı isteği: "verilen paylar
                          satın almaya gösterilmeli". Payı olmayan satırda
                          ikinci hücre TİRE kalır; aynı sayıyı tekrarlamak
                          okuyanı bir pay olduğuna inandırırdı. */}
                      <td className="hidden py-1 pr-3 sm:table-cell">{olcuYazisi(p, false)}</td>
                      {/* SATIN ALMA ÖLÇÜSÜ DÜZENLENEBİLİR (kullanıcı isteği,
                          15.08.2026). Hücrenin kendisi düğmedir: satınalmacının
                          buradaki hareketi "ölçüyü düzelt"tir ve ayrı bir kalem
                          ikonu aramak onu üç tıka çıkarırdı (durum çipi
                          kuralının aynısı). */}
                      <td className="py-1 pr-3">
                        <SatinAlmaOlcusu
                          p={p}
                          sinif={s.sinif}
                          canWrite={canWrite}
                          onOlcu={onOlcu}
                        />
                      </td>
                      <td className="hidden py-1 pr-3 text-right sm:table-cell">{p.birimAdet ?? "—"}</td>
                      <td className="hidden py-1 pr-3 text-right sm:table-cell">{p.carpan}</td>
                      <td className="py-1 pr-3 text-right font-medium">{p.adet ?? "—"}</td>
                      <td className="hidden py-1 pr-3 text-right sm:table-cell">
                        {p.birimAgirlikKg == null ? "—" : formatNum(p.birimAgirlikKg, 2)}
                      </td>
                      <td className="hidden py-1 pr-3 sm:table-cell">
                        {/* PAFTA SATIRDA AÇILIR (kullanıcı isteği): "detay"
                            parçanın kendi resmi, ikincisi BİR ÜST MONTAJIN
                            paftası — ana grubun değil (kullanıcı düzeltmesi,
                            15.08.2026: *"ana pafta derken bir üst paftasını
                            demiştim … 11.1.1 için 11.1, 12.5 için 12"*).
                            Düğme hangi paftayı açtığını KODUYLA söyler.
                            OLMAYAN DÜĞME ÇİZİLMEZ — pasif bir düğme, dosyanın
                            var olup açılamadığını söylerdi. */}
                        <span className="flex items-center gap-1.5">
                          {p.detayPdf && (
                            <FileOpenButton
                              storagePath={p.detayPdf.yol}
                              fileName={p.detayPdf.ad}
                              label="Detay"
                              title={p.detayPdf.ad}
                              className="oc-tap inline-flex items-center border px-1.5 py-0.5 font-sans text-[11px] hover:border-foreground/40"
                            />
                          )}
                          {p.anaPdf && p.anaPdf.yol !== p.detayPdf?.yol && (
                            <FileOpenButton
                              storagePath={p.anaPdf.yol}
                              fileName={p.anaPdf.ad}
                              label={p.anaPdf.kod ? `Üst ${p.anaPdf.kod}` : "Üst pafta"}
                              title={`Bir üst montajın paftası: ${p.anaPdf.ad}`}
                              className="oc-tap inline-flex items-center border px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                            />
                          )}
                          {!p.detayPdf && !p.anaPdf && (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/**
 * SATIN ALMA ÖLÇÜSÜ HÜCRESİ — okunur ve DÜZENLENİR.
 *
 * Kullanıcı isteği (15.08.2026): *"Hammadde Havuzu sayfasında Satın Alma
 * Ölçüsü düzenlenebilir olsun."*
 *
 * PAYIN KAYNAĞI RENKTEN OKUNUR ve renk uydurulmaz: mavi ressamın kararı, yeşil
 * firma kuralı, gri "pay yok". Payı olmayan satır eskiden TİRE basıyordu ve
 * gerekçesi doğruydu (aynı sayıyı iki kez göstermek okuyanı bir pay olduğuna
 * inandırır); ölçü düzenlenebilir olunca tire tıklanacak bir şey bırakmıyordu.
 * Çözüm sayıyı SOLUK basmaktır: bilgi orada ama vurgusu yok.
 */
function SatinAlmaOlcusu({
  p,
  sinif,
  canWrite,
  onOlcu,
}: {
  p: HammaddeSatiri["parcalar"][number];
  sinif: HammaddeSinifi;
  canWrite: boolean;
  onOlcu: (x: OlcuDuzenlemesi) => void;
}) {
  const metin = olcuYazisi(p, true);
  const renk =
    p.payKaynagi === "ressam"
      ? "text-sky-700 dark:text-sky-400"
      : p.payKaynagi === "otomatik"
        ? "text-emerald-700 dark:text-emerald-400"
        : "text-muted-foreground";
  const ipucu =
    p.payKaynagi === "ressam"
      ? "Ressamın parantez içinde verdiği pay — düzeltmek için tıklayın"
      : p.payKaynagi === "otomatik"
        ? "Firma kuralı: %5 işleme payı, en az 2 mm — düzeltmek için tıklayın"
        : "Pay yok — ölçüyü düzeltmek için tıklayın";

  if (!canWrite || !p.partCode) {
    return (
      <span className={renk} title={ipucu}>
        {metin}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() =>
        onOlcu({
          anahtar: parcaOlcuAnahtari(p.itemNo, p.partCode),
          sinif,
          tanim: p.tanim,
          hamTanim: p.hamTanim,
          olcuElle: p.olcuElle,
          kalinlikMm: p.kalinlikMm,
          enMm: p.enMm,
          boyMm: p.boyMm,
          disCapMm: p.disCapMm,
          icCapMm: p.icCapMm,
          resimDisCapMm: p.resimDisCapMm,
          resimBoyMm: p.resimBoyMm,
        })
      }
      title={ipucu}
      className={cn(
        "oc-tap inline-flex items-center gap-1 underline-offset-2 hover:underline",
        renk,
        p.olcuElle && "font-medium text-destructive"
      )}
    >
      {metin}
      <Pencil className="size-2.5 opacity-50" aria-hidden />
    </button>
  );
}

// ══════════════════════════════════════════════════════════ TOPLAM SATIRI

/**
 * GÖRÜNEN LİSTENİN TOPLAMI — tablonun İLK SATIRININ ÜSTÜNDE.
 *
 * Kullanıcı isteği (15.08.2026): *"Hammadde havuzunda 10 mm sac
 * filtrelediğimde kaç kg gerektiğini bana üste toplamalı."*
 *
 * ALTA DEĞİL ÜSTE konur ve sebebi tarama biçimidir: satınalmacı süzgeci
 * daraltıp sayıyı okumak istiyor; iki yüz satırın dibine inmek zorunda kalmak
 * o hareketi kullanılamaz yapar. Satır YAPIŞKAN DEĞİLDİR — tablo zaten yatay
 * kayıyor ve iki eksende birden yapışan bir satır dar ekranda kayma yönünü
 * belirsizleştirirdi.
 *
 * TOPLAM SÜZGECİ İZLER: ekranda ne görünüyorsa onun toplamıdır. Havuzun
 * TAMAMININ toplamı ayrıca özet şeridinde durur; ikisi farklı sorulardır.
 */
function ToplamSatiri({ gorunen, sutunlar }: { gorunen: Gorunum[]; sutunlar: Sutun[] }) {
  if (gorunen.length === 0) return null;

  const topla = (f: (g: Gorunum) => number | null) => {
    let t = 0;
    let varMi = false;
    for (const g of gorunen) {
      const v = f(g);
      if (v != null) {
        t += v;
        varMi = true;
      }
    }
    return varMi ? t : null;
  };

  const agirlik = topla((g) => g.satir.toplamAgirlikKg);
  const metre = topla((g) => (g.satir.toplamBoyMm == null ? null : g.satir.toplamBoyMm / 1000));
  const alan = topla((g) => (g.satir.toplamAlanMm2 == null ? null : g.satir.toplamAlanMm2 / 1e6));
  const boy = topla((g) => g.satir.boyAdedi);
  const parca = topla((g) => g.satir.parcaAdedi);

  const deger = (k: string): string => {
    switch (k) {
      case "alan":
        return alan == null ? "" : formatNum(alan, 2);
      case "metre":
        return metre == null ? "" : formatNum(metre, 1);
      case "boy":
        return boy == null ? "" : formatNum(boy);
      case "parca":
        return parca == null ? "" : formatNum(parca);
      case "agirlik":
        return agirlik == null ? "" : formatNum(Math.round(agirlik));
      case "tanim":
        return `${formatNum(gorunen.length)} kalem`;
      default:
        return "";
    }
  };

  return (
    <TableRow className="border-b-2 border-foreground/20 bg-muted/60 hover:bg-muted/60">
      {sutunlar.map((c, i) => {
        const v = deger(c.key);
        return (
          <TableCell
            key={c.key}
            className={cn(
              "align-middle py-1.5 text-[12px] font-semibold",
              c.sag && "text-right font-mono tabular-nums",
              c.gizle
            )}
          >
            {i === 0 && !v ? (
              <span className="oc-kicker text-[10px] font-medium text-muted-foreground">Σ</span>
            ) : (
              v
            )}
          </TableCell>
        );
      })}
    </TableRow>
  );
}

// ═══════════════════════════════════════════════════════════════ UFAKLAR

function bos() {
  return <span className="text-muted-foreground">—</span>;
}

/**
 * Bir kesim parçasının ölçü yazısı — RESİM ya da SATIN ALMA hâli.
 *
 * Biçim sınıfa göre değişir: sacda `t×en×boy`, boruda `Ødış/Øiç×boy`, doluda
 * `Ø×boy`. Tek bir kalıp üçünü de yanlış anlatırdı.
 */
function olcuYazisi(
  p: {
    kalinlikMm: number | null;
    enMm: number | null;
    boyMm: number | null;
    disCapMm: number | null;
    icCapMm: number | null;
    resimDisCapMm: number | null;
    resimBoyMm: number | null;
  },
  satinAlma: boolean
): string {
  const n = (v: number | null) => (v == null ? "?" : formatNum(v, 1));
  const dis = satinAlma ? p.disCapMm : p.resimDisCapMm;
  const boy = satinAlma ? p.boyMm : p.resimBoyMm;
  if (p.kalinlikMm != null && p.enMm != null) {
    return `${n(p.kalinlikMm)}×${n(p.enMm)}×${n(p.boyMm)}`;
  }
  if (dis != null && p.icCapMm != null) return `Ø${n(dis)}/Ø${n(p.icCapMm)}×${n(boy)}`;
  if (dis != null) return `Ø${n(dis)}×${n(boy)}`;
  if (boy != null) return `L=${n(boy)}`;
  return "—";
}

function sayi(v: number | null | undefined) {
  return v == null ? bos() : formatNum(v, 1);
}

/**
 * Tür çipi — renk HEX DEĞİL OKLCH TON AÇISIDIR (IS-14).
 *
 * Doygunluk ve parlaklık `globals.css`teki `.oc-tag` kuralında ve TEMA BAŞINA
 * verilir; buradan yalnız `--oc-hue` gelir. Sınıfın kendi tonu
 * `siniflar.ts`te tanımlıdır — ekranda elle bir renk yazılmaz.
 */
function TurCipi({ sinif, elle }: { sinif: HammaddeSinifi; elle?: boolean }) {
  return (
    <span
      className="oc-tag px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap"
      style={{ ["--oc-hue" as string]: String(HAMMADDE_TONLARI[sinif]) }}
      title={elle ? "Bu tür elle taşındı" : undefined}
    >
      {HAMMADDE_ADLARI[sinif]}
      {elle && <span className="ml-1 opacity-70">✎</span>}
    </span>
  );
}

function TurSeridi({
  secili,
  secenekler,
  onChange,
}: {
  secili: HammaddeSinifi | "";
  secenekler: { value: HammaddeSinifi; label: string; count: number }[];
  onChange: (v: HammaddeSinifi | "") => void;
}) {
  const toplam = secenekler.reduce((t, s) => t + s.count, 0);
  // `.oc-tap` BU ŞERİTTE KULLANILMAZ: görünmez `::after` katmanı kutunun
  // dışına taşar ve `overflow-x` veren bir kapta dikey taşma bir DİKEY
  // KAYDIRMA ÇUBUĞU doğurur (dokunmatik MOBIL-14 — 11.08.2026'da proje sekme
  // rayında yaşandı). Dokunma payı `PurchasingNav`ın yolundan gelir: kutunun
  // KENDİSİ kaba işaretleyicide büyür.
  const cip = (aktif: boolean) =>
    cn(
      "shrink-0 border px-2.5 py-1.5 font-mono text-[12px] whitespace-nowrap transition-colors pointer-coarse:py-2.5",
      aktif
        ? "border-primary/60 bg-primary/[0.10] font-medium text-foreground"
        : "border-border text-muted-foreground hover:text-foreground"
    );
  return (
    // ŞERİT KAYMAZ, SARAR (16.08.2026 — rayın kuralı): altı çip telefonda
    // iki satıra iner, hepsi her an görünür.
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" onClick={() => onChange("")} className={cip(secili === "")}>
        Tümü <span className="ml-1 opacity-60">{formatNum(toplam)}</span>
      </button>
      {secenekler.map((s) => (
        <button
          key={s.value}
          type="button"
          onClick={() => onChange(s.value)}
          className={cip(secili === s.value)}
          disabled={s.count === 0}
        >
          {s.label} <span className="ml-1 opacity-60">{formatNum(s.count)}</span>
        </button>
      ))}
    </div>
  );
}

function OzetSeridi({
  havuz,
  gorunumler,
}: {
  havuz: HammaddeHavuzu;
  gorunumler: Gorunum[];
}) {
  const boy = havuz.satirlar.reduce((t, s) => t + (s.boyAdedi ?? 0), 0);
  const olcusuz = havuz.satirlar.filter((s) =>
    s.eksikler.some((e) => e !== "kalite yazılmamış")
  ).length;
  const bekleyen = gorunumler.filter((g) => g.durum === "bekliyor").length;

  const kutu = (baslik: string, deger: string, alt?: string) => (
    <div className="min-w-0 flex-1 border-l border-border/60 px-3 first:border-l-0 first:pl-0">
      <p className="oc-kicker text-[10px] text-muted-foreground">{baslik}</p>
      <p className="font-mono text-base font-medium tabular-nums">{deger}</p>
      {alt && <p className="text-[11px] text-muted-foreground">{alt}</p>}
    </div>
  );

  return (
    <section className="flex flex-wrap gap-y-2 border bg-card p-3">
      {kutu("Stok Kalemi", formatNum(havuz.toplamKalem), `${formatNum(bekleyen)} bekliyor`)}
      {kutu("Toplam Ağırlık", `${formatNum(Math.round(havuz.toplamAgirlikKg))} kg`)}
      {kutu("Standart Boy", formatNum(boy), "profil · ray · boru")}
      {kutu("Çok Projeli", formatNum(havuz.cokIsliKalem), `${formatNum(havuz.paketSayisi)} paket`)}
      {olcusuz > 0
        ? kutu("Ölçüsü Eksik", formatNum(olcusuz), "tanımdan okunamadı")
        : kutu("Kaynak Satır", formatNum(havuz.kaynakSatiri), "imalat parçası")}
    </section>
  );
}

function SecimKutusu({
  isaretli,
  onChange,
  etiket,
}: {
  isaretli: boolean;
  onChange: (v: boolean) => void;
  etiket: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={isaretli}
      aria-label={etiket}
      onClick={() => onChange(!isaretli)}
      className={cn(
        "oc-tap-square grid size-4 place-items-center border transition-colors",
        isaretli ? "border-primary bg-primary text-primary-foreground" : "border-border"
      )}
    >
      {isaretli && (
        <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
          <path
            d="M2.5 6.2 4.8 8.5 9.5 3.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="square"
          />
        </svg>
      )}
    </button>
  );
}

function DurumCipi({
  durum,
  onClick,
  sac,
}: {
  durum: Durum;
  onClick?: () => void;
  /** Sac satırında düğme sipariş değil YERLEŞİM açar. */
  sac?: boolean;
}) {
  const sinif =
    durum === "tamam"
      ? "border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
      : durum === "kismi"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : durum === "teklifli"
          ? "border-sky-600/40 bg-sky-600/10 text-sky-700 dark:text-sky-400"
          : "border-dashed border-border text-muted-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={onClick ? (sac ? "Plakaya yerleştir ve sipariş aç" : "Sipariş aç") : undefined}
      className={cn(
        "inline-flex min-h-7 items-center border px-1.5 text-[11px] whitespace-nowrap transition-colors pointer-coarse:min-h-9 disabled:cursor-default",
        sinif,
        onClick && "hover:border-foreground/40 hover:text-foreground"
      )}
    >
      {DURUM_ETIKET[durum]}
    </button>
  );
}

function suzgecOzeti(
  f: Filtreler,
  secenekler: {
    kaliteler: { value: string; label: string }[];
    durumlar: { value: string; label: string }[];
    isler: { value: string; label: string }[];
  }
): string {
  const parca: string[] = [];
  if (f.tur) parca.push(`tür: ${HAMMADDE_ADLARI[f.tur]}`);
  if (f.query.trim()) parca.push(`arama "${f.query.trim()}"`);
  const ad = (liste: { value: string; label: string }[], v: string[]) =>
    v.map((x) => liste.find((s) => s.value === x)?.label ?? x).join(", ");
  if (f.isler.length) parca.push(`iş: ${ad(secenekler.isler, f.isler)}`);
  if (f.kaliteler.length) parca.push(`kalite: ${f.kaliteler.join(", ")}`);
  if (f.durumlar.length) parca.push(`durum: ${ad(secenekler.durumlar, f.durumlar)}`);
  return parca.length ? parca.join(" · ") : "tümü";
}

/** Excel ve PDF — süzgeç ve seçim taşınır (ekipman tarafının kalıbı). */
function CiktiFormu({
  anahtarlar,
  secimVar,
  suzgecOzeti,
}: {
  anahtarlar: string[];
  secimVar: boolean;
  suzgecOzeti: string;
}) {
  const alanlar = (
    <>
      <input type="hidden" name="anahtarlar" value={anahtarlar.join("\n")} />
      <input type="hidden" name="suzgec" value={suzgecOzeti} />
    </>
  );
  const ipucu = secimVar
    ? `Yalnız seçili ${anahtarlar.length} kalem`
    : `Ekrandaki süzgeçle aynı ${anahtarlar.length} kalem`;

  return (
    <span className="flex items-center gap-2">
      <form method="POST" action="/purchasing/hammadde/export?bicim=xlsx">
        {alanlar}
        <Button type="submit" variant="outline" size="xs" title={ipucu}>
          <FileSpreadsheet className="size-3" />
          Excel
        </Button>
      </form>
      <form method="POST" action="/purchasing/hammadde/export?bicim=pdf">
        {alanlar}
        <Button type="submit" variant="outline" size="xs" title={`${ipucu} — hammadde talebi`}>
          <FileText className="size-3" />
          PDF
        </Button>
      </form>
    </span>
  );
}
