"use client";

// Talep Havuzu tablosu — satınalmacının çalışma yüzeyi.
//
// ═════════════════════════════ SÜTUN DÜZENİ SATIN ALMA EKİBİNİNDİR
//
// Kullanıcı kararı (12.08.2026, md. 2): tablo İŞ HAZIRLAMA LİSTESİ dosyasına
// benzemeli. O dosya ekibin bugün gerçekten kullandığı çalışma dosyasıdır ve
// sütun düzeni bir zevk değil bir ALIŞKANLIKtır; uydurulmuş bir düzen aracı
// kullanılmaz yapardı. Eşleme birebirdir:
//
//   İş Numarası → paylardaki kalem no · Resim Numarası → parça kodu
//   Kullanıldığı Yer → ana grup · Kategori · Tanımı · Kalite → malzeme
//   Miktar/Birimi → resimdeki adet · Ana Miktar → çarpılmış adet
//   İç/Dış Çap · Boy → tanımdan ayıklanır · Ağırlık · Not
//   Sipariş Verildi mi? → Durum
//
// Havuzun Excel'den FAZLASI da var ve o fazlalık modülün var oluş sebebidir:
// bir satır birden çok işe hizmet edebilir (Excel'de aynı kalem beş kez
// yazılıyordu), Teklif sütunu ve Kalan sütunu Excel'de hiç yok.
//
// ————————————————————————————————————————————————— DÖRT KARAR
//
// 1. SATIR BİR KALEMDİR, BİR PROJE SATIRI DEĞİL. Aynı somun beş projede
//    geçiyorsa tek satırdır; hangi projeden ne kadar geldiği satırın AÇILIR
//    ayrıntısındadır. Satınalmacı tedarikçiyle tek bir sayı konuşur.
//
// 2. "GEREKEN" İLE "SİPARİŞ EDİLEN" YAN YANA DURUR; üçüncü sütun farktır ve
//    ekranın asıl sayısı odur. Tek bir "durum" çipi kısmi siparişi taşıyamazdı.
//
// 3. DURUM ÇİPİ BİR DÜĞMEDİR (md. 4): "Bekliyor" ya da "Teklif alındı"
//    üzerine basınca o kalem için sipariş penceresi açılır. Satınalmacının en
//    sık yaptığı hareket budur ve önce kalemi seçip sonra şeritteki düğmeye
//    gitmek iki fazladan adımdı.
//
// 4. SÜZGEÇLER ÇOKLU SEÇİMLİDİR ve ÇIKTIYA GEÇER (md. 6-7): ekranda ne
//    görünüyorsa Excel ve PDF onu indirir; seçim varsa yalnız seçilenleri.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  FolderInput,
  Loader2,
  Plus,
  StickyNote,
  Tag,
} from "lucide-react";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CustomerTag } from "@/components/tags";
import { formatNum } from "@/lib/drawings/labels";
import { fmtMoney } from "@/lib/currency";
import type { TalepHavuzu, TalepSatiri } from "@/lib/purchasing/demand";
import { FilterBar, SearchBox, SortableHead } from "../drawings/sortable-head";
import { CokluSuzgec } from "./filters";
import type { TedarikciKaydi, TeklifSatiri } from "./data";
import type { GunlukKur } from "@/lib/purchasing/kur";
import { QuoteDialog } from "./quote-dialog";
import { BulkQuoteDialog, type TopluTeklifKalemi } from "./bulk-quote-dialog";
import { OrderDialog, type SiparisKalemi } from "./order-dialog";
import { saveItemMeta } from "./actions";

type SortKey =
  | "kategori"
  | "tanim"
  | "adet"
  | "kalan"
  | "is"
  | "teklif"
  | "agirlik"
  | "kod"
  | "yer";

export type Durum = "bekliyor" | "teklifli" | "kismi" | "tamam";

const DURUM_ETIKET: Record<Durum, string> = {
  bekliyor: "Bekliyor",
  teklifli: "Teklif alındı",
  kismi: "Kısmi sipariş",
  tamam: "Sipariş edildi",
};

/**
 * SATIR ZEMİNİ DURUMU SÖYLER — SÜTUN DEĞİL.
 *
 * İlk denemede Teklif ve Sipariş SÜTUNLARI boyanmıştı; kullanıcı düzeltti
 * (13.08.2026): *"Sipariş edildi ve teklif alındı sütunlarını değil
 * SATIRLARINI farklı renge boyamak istemiştim. Örneğin teklif alınan bir
 * ürünün satırı farklı arka plan olsun, kolay ayırt edilebilsin. Sütun olarak
 * renklendirmeye gerek yok."*
 *
 * Haklı ve sebebi tarama biçiminde: satınalmacı listeyi SATIR SATIR tarıyor,
 * "bu kalemin durumu ne" diye. Boyalı bir sütun o soruya cevap vermiyordu —
 * yalnız sütunun kendisini işaretliyordu, oysa aranan şey SATIRIN hâliydi.
 *
 * Renk UYDURULMAZ, `DurumCipi`den alınır: teklifli SKY, kısmi AMBER, sipariş
 * edildi EMERALD, bekleyen RENKSİZ. "Bekliyor" boyanmaz çünkü o bir kusur
 * değil başlangıç hâlidir ve her satırı boyamak hiçbir satırı boyamamakla
 * aynı şeydir.
 *
 * TON ÇOK SİLİK (%4–5): satırı AYIRIR, okunurluğu bozmaz. Seçili satırın
 * kendi zemini üstte kalır — seçim bir EYLEM hâlidir ve durumdan önce gelir.
 */
const DURUM_SATIRI: Record<Durum, string> = {
  bekliyor: "",
  teklifli: "bg-sky-600/[0.05] hover:bg-sky-600/[0.08]",
  kismi: "bg-amber-500/[0.05] hover:bg-amber-500/[0.08]",
  tamam: "bg-emerald-600/[0.05] hover:bg-emerald-600/[0.08]",
};

interface Filtreler {
  query: string;
  siniflar: string[];
  durumlar: string[];
  isler: string[];
}

const BOS: Filtreler = { query: "", siniflar: [], durumlar: [], isler: [] };

/**
 * AÇILIŞ SÜZGECİ — "bugün ne sipariş etmeliyim?" sorusunun ta kendisi
 * (kullanıcı kararı, 13.08.2026: *"Durum ilk açıldığında Bekliyor ve Teklif
 * Alındı olanlar gelsin."*).
 *
 * Sipariş edilmiş kalemler ekranın varsayılan görüntüsünde YER KAPLIYORDU;
 * satınalmacının işi bitmiş satırlar arasında bitmemişleri aramak değil.
 * `BOS` ile AYRI durur: "Temizle" gerçekten HEPSİNİ gösterir — açılış bir
 * öneridir, bir hapis değil.
 */
const ACILIS: Filtreler = { ...BOS, durumlar: ["bekliyor", "teklifli"] };

/** Satır + türetilmiş sipariş/teklif bilgisi. */
export interface Gorunum {
  satir: TalepSatiri;
  siparisEdilen: number;
  kalan: number;
  teklifler: TeklifSatiri[];
  /** En ucuz AVRO teklifi; kuru olmayan teklifler yarışa girmez. */
  enIyi: TeklifSatiri | null;
  durum: Durum;
}

function durumu(
  satir: TalepSatiri,
  siparisEdilen: number,
  teklifSayisi: number
): Durum {
  if (satir.adet != null && satir.adet > 0 && siparisEdilen >= satir.adet) return "tamam";
  if (siparisEdilen > 0) return "kismi";
  if (teklifSayisi > 0) return "teklifli";
  return "bekliyor";
}

/** `Gorunum` → sipariş penceresinin beklediği kalem. Tek yerde kurulur. */
function siparisKalemi(g: Gorunum): SiparisKalemi {
  return {
    matchKey: g.satir.key,
    tanim: g.satir.tanim,
    kalan: g.kalan || g.satir.adet || 1,
    birimFiyat: g.enIyi?.unitPrice ?? null,
    paraBirimi: g.enIyi?.currency ?? null,
    tedarikci: g.enIyi?.supplier ?? "",
    paylar: g.satir.paylar.map((p) => ({
      itemNo: p.itemNo,
      packageId: p.packageId,
      partKey: p.partKey,
      adet: p.adet ?? 0,
    })),
  };
}

export function DemandTable({
  havuz,
  teklifler,
  siparisAdetleri,
  tedarikciler,
  defter,
  siparisNolari,
  sonKur,
  qualities = [],
  kategoriler,
  isler,
  canWrite,
}: {
  havuz: TalepHavuzu;
  teklifler: TeklifSatiri[];
  /** [matchKey, sipariş edilen adet] — sunucuda toplanır, burada bölünmez. */
  siparisAdetleri: [string, number][];
  tedarikciler: string[];
  /** Firma defteri (ad + kod) — sipariş numarası önerisi kodlardan türer. */
  defter: TedarikciKaydi[];
  /** Kullanılmış bütün sipariş numaraları; öneri ve çakışma denetimi için. */
  siparisNolari: string[];
  /** En son yayımlanmış günlük kur; teklif ve sipariş pencerelerine iner. */
  sonKur?: GunlukKur | null;
  /** Marka/Kalite öneri listesi (md. 16). */
  qualities?: string[];
  kategoriler: string[];
  isler: { id: string; itemNos: string[]; label: string }[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [calisiyor, basla] = useTransition();

  const [f, setF] = useState<Filtreler>(ACILIS);
  const [sortKey, setSortKey] = useState<SortKey>("kategori");
  const [desc, setDesc] = useState(false);
  const [secili, setSecili] = useState<Set<string>>(new Set());
  const [acik, setAcik] = useState<Set<string>>(new Set());
  const [teklifPenceresi, setTeklifPenceresi] = useState<Gorunum | null>(null);
  const [topluTeklif, setTopluTeklif] = useState<TopluTeklifKalemi[] | null>(null);
  const [siparisKalemleri, setSiparisKalemleri] = useState<SiparisKalemi[] | null>(null);
  const [notPenceresi, setNotPenceresi] = useState<Gorunum | null>(null);

  // ————————————————————————————————————————————————————— türetilmiş satırlar
  const gorunumler: Gorunum[] = useMemo(() => {
    const siparisHaritasi = new Map(siparisAdetleri);
    const teklifHaritasi = new Map<string, TeklifSatiri[]>();
    for (const t of teklifler) {
      const liste = teklifHaritasi.get(t.matchKey) ?? [];
      liste.push(t);
      teklifHaritasi.set(t.matchKey, liste);
    }
    return havuz.satirlar.map((satir) => {
      const kendi = teklifHaritasi.get(satir.key) ?? [];
      // SEÇİLMİŞ teklif varsa o kazanır; yoksa en ucuz AVRO fiyatı. Kuru
      // girilmemiş teklif yarışa GİRMEZ — karşılaştırılamaz bir sayıdır ve
      // sıfır sayılsaydı hep o kazanırdı.
      const secilmis = kendi.find((t) => t.chosen);
      const yarisanlar = kendi.filter((t) => t.unitPriceEur != null);
      const enUcuz = yarisanlar.length
        ? yarisanlar.reduce((a, b) => ((a.unitPriceEur ?? 0) <= (b.unitPriceEur ?? 0) ? a : b))
        : null;
      const siparisEdilen = siparisHaritasi.get(satir.key) ?? 0;
      return {
        satir,
        siparisEdilen,
        kalan: satir.adet == null ? 0 : Math.max(0, satir.adet - siparisEdilen),
        teklifler: kendi,
        enIyi: secilmis ?? enUcuz,
        durum: durumu(satir, siparisEdilen, kendi.length),
      };
    });
  }, [havuz.satirlar, teklifler, siparisAdetleri]);

  // ————————————————————————————————————————————————————— süzgeç seçenekleri
  //
  // SAYAÇLAR SÜZGEÇSİZ LİSTEDEN gelir: seçenek listesi kendi süzgecine göre
  // daralırsa kullanıcı bir kategoriyi seçtiği anda diğerleri kaybolur ve
  // ikinci bir kategori ekleyemez.
  const secenekler = useMemo(() => {
    const say = (fn: (g: Gorunum) => string[]) => {
      const m = new Map<string, number>();
      for (const g of gorunumler) for (const v of fn(g)) m.set(v, (m.get(v) ?? 0) + 1);
      return m;
    };
    const sinifSayaci = say((g) => [g.satir.sinif]);
    const durumSayaci = say((g) => [g.durum]);
    const isSayaci = say((g) => [...new Set(g.satir.paylar.map((p) => p.itemNo).filter(Boolean))]);

    return {
      siniflar: [...sinifSayaci.keys()]
        .sort((a, b) => kategoriler.indexOf(a) - kategoriler.indexOf(b))
        .map((s) => ({ value: s, label: s, count: sinifSayaci.get(s) })),
      durumlar: (["bekliyor", "teklifli", "kismi", "tamam"] as Durum[])
        .filter((d) => durumSayaci.has(d))
        .map((d) => ({ value: d, label: DURUM_ETIKET[d], count: durumSayaci.get(d) })),
      isler: isler
        .map((i) => ({
          value: i.id,
          label: i.label,
          count: i.itemNos.reduce((t, n) => t + (isSayaci.get(n) ?? 0), 0),
        }))
        .filter((i) => i.count > 0),
    };
  }, [gorunumler, kategoriler, isler]);

  /** İş kimliği → o işin kalem numaraları; süzgeç eşleşmesi bununla yapılır. */
  const isKalemleri = useMemo(() => new Map(isler.map((i) => [i.id, new Set(i.itemNos)])), [isler]);

  const gorunen = useMemo(() => {
    const q = f.query.trim().toLocaleLowerCase("tr-TR");
    const sinifKume = new Set(f.siniflar);
    const durumKume = new Set(f.durumlar);
    const isKume = new Set(f.isler.flatMap((id) => [...(isKalemleri.get(id) ?? [])]));

    const suzulmus = gorunumler.filter((g) => {
      if (sinifKume.size > 0 && !sinifKume.has(g.satir.sinif)) return false;
      if (durumKume.size > 0 && !durumKume.has(g.durum)) return false;
      if (isKume.size > 0 && !g.satir.paylar.some((p) => isKume.has(p.itemNo))) return false;
      if (!q) return true;
      const havuzMetni = [
        g.satir.tanim,
        g.satir.malzeme,
        g.satir.not,
        ...g.satir.parcaKodlari,
        ...g.satir.anaGruplar,
        ...g.satir.paylar.map((p) => `${p.itemNo} ${p.jobTitle} ${p.customer}`),
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");
      return havuzMetni.includes(q);
    });

    const yon = desc ? -1 : 1;
    const metin = (a: string, b: string) => a.localeCompare(b, "tr");
    return [...suzulmus].sort((a, b) => {
      switch (sortKey) {
        case "tanim":
          return yon * metin(a.satir.tanim, b.satir.tanim);
        case "adet":
          return yon * ((a.satir.adet ?? 0) - (b.satir.adet ?? 0));
        case "kalan":
          return yon * (a.kalan - b.kalan);
        case "is":
          return yon * (a.satir.isSayisi - b.satir.isSayisi);
        case "teklif":
          return yon * (a.teklifler.length - b.teklifler.length);
        case "agirlik":
          return yon * ((a.satir.toplamAgirlikKg ?? 0) - (b.satir.toplamAgirlikKg ?? 0));
        case "kod":
          return yon * metin(a.satir.parcaKodlari[0] ?? "", b.satir.parcaKodlari[0] ?? "");
        case "yer":
          return yon * metin(a.satir.anaGruplar[0] ?? "", b.satir.anaGruplar[0] ?? "");
        default: {
          const fark = kategoriler.indexOf(a.satir.sinif) - kategoriler.indexOf(b.satir.sinif);
          return yon * (fark !== 0 ? fark : metin(a.satir.tanim, b.satir.tanim));
        }
      }
    });
  }, [gorunumler, f, sortKey, desc, kategoriler, isKalemleri]);

  function sirala(k: SortKey) {
    if (k === sortKey) setDesc((d) => !d);
    else {
      setSortKey(k);
      setDesc(false);
    }
  }

  const temiz = JSON.stringify(f) === JSON.stringify(BOS);
  const seciliGorunumler = gorunen.filter((g) => secili.has(g.satir.key));
  /** ÇIKTIYA GİDEN LİSTE: seçim varsa o, yoksa ekrandaki süzgeçli liste. */
  const ciktiListesi = seciliGorunumler.length > 0 ? seciliGorunumler : gorunen;

  function kategoriyeTasi(kategori: string) {
    if (seciliGorunumler.length === 0) return;
    basla(async () => {
      const sonuc = await saveItemMeta({
        keys: seciliGorunumler.map((g) => g.satir.key),
        samples: seciliGorunumler.map((g) => g.satir.tanim),
        category: kategori,
        note: null,
      });
      if (sonuc.error) toast.error(sonuc.error);
      else {
        toast.success(`${formatNum(sonuc.ok ?? 0)} kalem “${kategori}” kategorisine taşındı.`);
        setSecili(new Set());
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-3">
      <SummaryStrip havuz={havuz} gorunumler={gorunumler} />

      <FilterBar
        gorunen={gorunen.length}
        toplam={gorunumler.length}
        temiz={temiz}
        onTemizle={() => setF(BOS)}
      >
        <SearchBox
          value={f.query}
          onChange={(v) => setF((s) => ({ ...s, query: v }))}
          placeholder="Tanım, Kod, Grup, İş, Not Ara…"
          className="w-[min(18rem,calc(100vw-4rem))]"
        />
        <CokluSuzgec
          baslik="İş"
          secenekler={secenekler.isler}
          secili={f.isler}
          onChange={(v) => setF((s) => ({ ...s, isler: v }))}
        />
        <CokluSuzgec
          baslik="Kategori"
          secenekler={secenekler.siniflar}
          secili={f.siniflar}
          onChange={(v) => setF((s) => ({ ...s, siniflar: v }))}
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
      </FilterBar>

      {havuz.belirsizKalem > 0 && (
        <p className="border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-400">
          <strong>{formatNum(havuz.belirsizKalem)} kalemin adedi belirsiz.</strong> İş kaleminin
          sayısal adedi girilmediği için çarpan <strong>1</strong> kabul edildi. Doğru sipariş
          adedi için İşler → ilgili iş → “Resim Çarpanı” kartından adedi doldurun.
        </p>
      )}

      {gorunen.length === 0 ? (
        <div className="border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {gorunumler.length === 0
              ? "Havuzda kalem yok. Teknik resim paketi yüklenip eşleştirildiğinde satın alma satırları buraya düşer."
              : "Bu süzgeçle eşleşen kalem yok. Süzgeci temizleyip yeniden deneyin."}
          </p>
        </div>
      ) : (
        <div className="oc-scrollx border bg-card [--oc-scroll-bg:var(--card)]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {canWrite && (
                  <TableHead className="w-10 p-0">
                    <SecimKutusu
                      checked={gorunen.length > 0 && gorunen.every((g) => secili.has(g.satir.key))}
                      onChange={(v) =>
                        setSecili((o) => {
                          const y = new Set(o);
                          for (const g of gorunen) {
                            if (v) y.add(g.satir.key);
                            else y.delete(g.satir.key);
                          }
                          return y;
                        })
                      }
                      label="Görünen kalemlerin tamamını seç"
                    />
                  </TableHead>
                )}
                <TableHead className="w-8 p-0" />
                {/* SÜTUN ÖNCELİKLENDİRME: on dört sütun telefona sığmaz.
                    Düşük öncelikliler `hidden …:table-cell` ile çekilir ve
                    kritik olanı birincil hücrenin altına iner (kabuk kuralı 7). */}
                <SortableHead sortKey="is" current={sortKey} desc={desc} onSort={sirala}>
                  İş No
                </SortableHead>
                <SortableHead
                  sortKey="kod"
                  current={sortKey}
                  desc={desc}
                  onSort={sirala}
                  className="hidden 2xl:table-cell"
                >
                  Resim No
                </SortableHead>
                <SortableHead
                  sortKey="yer"
                  current={sortKey}
                  desc={desc}
                  onSort={sirala}
                  className="hidden xl:table-cell"
                >
                  Kullanıldığı Yer
                </SortableHead>
                <SortableHead sortKey="kategori" current={sortKey} desc={desc} onSort={sirala}>
                  Kategori
                </SortableHead>
                <SortableHead sortKey="tanim" current={sortKey} desc={desc} onSort={sirala}>
                  Tanımı
                </SortableHead>
                <TableHead className="hidden lg:table-cell">Kalite</TableHead>
                <TableHead className="hidden text-right 2xl:table-cell">Ø İç</TableHead>
                <TableHead className="hidden text-right 2xl:table-cell">Ø Dış</TableHead>
                <TableHead className="hidden text-right 2xl:table-cell">Boy</TableHead>
                <SortableHead
                  sortKey="adet"
                  current={sortKey}
                  desc={desc}
                  onSort={sirala}
                  align="right"
                >
                  Miktar
                </SortableHead>
                <TableHead className="text-right">Sipariş</TableHead>
                <SortableHead
                  sortKey="kalan"
                  current={sortKey}
                  desc={desc}
                  onSort={sirala}
                  align="right"
                >
                  Kalan
                </SortableHead>
                <SortableHead
                  sortKey="agirlik"
                  current={sortKey}
                  desc={desc}
                  onSort={sirala}
                  align="right"
                  className="hidden xl:table-cell"
                >
                  Ağırlık
                </SortableHead>
                <SortableHead sortKey="teklif" current={sortKey} desc={desc} onSort={sirala}>
                  Teklif
                </SortableHead>
                <TableHead className="hidden lg:table-cell">Not</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gorunen.map((g) => (
                <Satir
                  key={g.satir.key}
                  g={g}
                  genis={acik.has(g.satir.key)}
                  secili={secili.has(g.satir.key)}
                  canWrite={canWrite}
                  onSec={() =>
                    setSecili((o) => {
                      const y = new Set(o);
                      if (y.has(g.satir.key)) y.delete(g.satir.key);
                      else y.add(g.satir.key);
                      return y;
                    })
                  }
                  onGenislet={() =>
                    setAcik((o) => {
                      const y = new Set(o);
                      if (y.has(g.satir.key)) y.delete(g.satir.key);
                      else y.add(g.satir.key);
                      return y;
                    })
                  }
                  onTeklif={() => setTeklifPenceresi(g)}
                  onSiparis={() => setSiparisKalemleri([siparisKalemi(g)])}
                  onNot={() => setNotPenceresi(g)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-muted-foreground">
        <span>
          {formatNum(gorunen.length)} Kalem · {formatNum(gorunen.reduce((t, g) => t + g.kalan, 0))}{" "}
          Adet Sipariş Bekliyor
        </span>
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
            {formatNum(seciliGorunumler.reduce((t, g) => t + g.kalan, 0))} adet
          </span>
          <Button type="button" size="xs" variant="ghost" onClick={() => setSecili(new Set())}>
            Seçimi bırak
          </Button>
          <span className="ml-auto flex flex-wrap items-center gap-1.5">
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
                  <DropdownMenuItem key={k} onSelect={() => kategoriyeTasi(k)}>
                    {k}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() =>
                setTopluTeklif(
                  seciliGorunumler.map((g) => ({ matchKey: g.satir.key, tanim: g.satir.tanim }))
                )
              }
              disabled={seciliGorunumler.length === 0}
            >
              <Tag className="size-3" />
              Teklif Aç
            </Button>
            <Button
              type="button"
              size="xs"
              onClick={() => setSiparisKalemleri(seciliGorunumler.map(siparisKalemi))}
              disabled={seciliGorunumler.length === 0}
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
          onClose={() => setTeklifPenceresi(null)}
          onChanged={() => router.refresh()}
        />
      )}

      {topluTeklif && (
        <BulkQuoteDialog
          kalemler={topluTeklif}
          tedarikciler={tedarikciler}
          sonKur={sonKur}
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

      {notPenceresi && (
        <NotDialog
          key={`not-${notPenceresi.satir.key}`}
          g={notPenceresi}
          onClose={() => setNotPenceresi(null)}
          onSaved={() => {
            setNotPenceresi(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------- satır

function Satir({
  g,
  genis,
  secili,
  canWrite,
  onSec,
  onGenislet,
  onTeklif,
  onSiparis,
  onNot,
}: {
  g: Gorunum;
  genis: boolean;
  secili: boolean;
  canWrite: boolean;
  onSec: () => void;
  onGenislet: () => void;
  onTeklif: () => void;
  onSiparis: () => void;
  onNot: () => void;
}) {
  const s = g.satir;
  const isler = [...new Set(s.paylar.map((p) => p.itemNo).filter(Boolean))];
  const musteriler = [...new Set(s.paylar.map((p) => p.customer))].filter(Boolean);
  const sutunSayisi = canWrite ? 18 : 17;

  return (
    <>
      <TableRow
        className={
          // SEÇİM DURUMDAN ÖNCE GELİR: seçili satır bir eylemin içindedir ve
          // onu durum rengiyle boyamak "hangi satırları seçtim" sorusunu
          // cevapsız bırakırdı.
          secili ? "bg-primary/[0.05] hover:bg-primary/[0.08]" : DURUM_SATIRI[g.durum] || undefined
        }
      >
        {canWrite && (
          <TableCell className="p-0 align-top">
            <SecimKutusu checked={secili} onChange={onSec} label={`${s.tanim} kalemini seç`} />
          </TableCell>
        )}
        <TableCell className="p-0 align-top">
          <button
            type="button"
            onClick={onGenislet}
            aria-expanded={genis}
            aria-label={genis ? "Ayrıntıyı kapat" : "Hangi işlere gittiğini göster"}
            className="flex min-h-10 w-8 items-center justify-center text-muted-foreground transition-colors pointer-coarse:min-h-11 hover:text-foreground"
          >
            {genis ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
        </TableCell>

        {/* İŞ NO — birden çok iş varsa hepsi; müşteri etiketi altta. */}
        <TableCell className="align-top font-mono text-[12px] whitespace-normal">
          {isler.length > 0 ? isler.join(", ") : <span className="text-muted-foreground">—</span>}
          {musteriler.length > 0 && (
            <span className="mt-0.5 flex flex-wrap gap-1">
              {musteriler.slice(0, 2).map((c) => (
                <CustomerTag key={c} name={c} shortName={c} />
              ))}
            </span>
          )}
        </TableCell>

        <TableCell className="hidden align-top font-mono text-[12px] whitespace-normal 2xl:table-cell">
          {s.parcaKodlari.length > 0 ? (
            s.parcaKodlari.join(", ")
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>

        <TableCell className="hidden max-w-[12rem] align-top text-[12px] whitespace-normal xl:table-cell">
          {s.anaGruplar.join(" · ") || <span className="text-muted-foreground">—</span>}
        </TableCell>

        <TableCell className="align-top text-[12px] whitespace-normal">{s.sinif}</TableCell>

        <TableCell className="max-w-[22rem] min-w-0 align-top whitespace-normal">
          <span className="block text-[13px] leading-snug">{s.tanim || "—"}</span>
          {/* Dar ekranda gizlenen sütunların karşılığı — kritik olanlar. */}
          <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground lg:hidden">
            {[s.malzeme, ...s.anaGruplar].filter(Boolean).join(" · ") || "—"}
          </span>
          {s.hamTanimlar.length > 1 && (
            <span
              className="mt-0.5 block font-mono text-[11px] text-muted-foreground"
              title={s.hamTanimlar.join("\n")}
            >
              {formatNum(s.hamTanimlar.length)} farklı yazımdan birleşti
            </span>
          )}
        </TableCell>

        {/* KALİTE — İŞ HAZIRLAMA'daki sütun. Çelişki gizlenmez. */}
        <TableCell className="hidden align-top font-mono text-[12px] whitespace-normal lg:table-cell">
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

        <Olcu v={s.olculer.icCapMm} />
        <Olcu v={s.olculer.disCapMm} />
        <Olcu v={s.olculer.boyMm} />

        {/* MİKTAR — çarpılmış toplam; altında ham adet × çarpan. */}
        <TableCell className="align-top text-right font-mono text-sm tabular-nums">
          {s.adet == null ? "—" : formatNum(s.adet)}
          <span className="block text-[11px] font-normal text-muted-foreground">{s.birim}</span>
          {s.carpanBelirsiz && (
            <span
              className="block text-[11px] text-amber-600 dark:text-amber-400"
              title="İş kalemi adedi girilmemiş — çarpan 1 kabul edildi"
            >
              belirsiz
            </span>
          )}
        </TableCell>

        <TableCell className="align-top text-right font-mono text-sm tabular-nums text-muted-foreground">
          {g.siparisEdilen > 0 ? formatNum(g.siparisEdilen) : "—"}
        </TableCell>

        <TableCell className="align-top text-right font-mono text-sm font-medium tabular-nums">
          {g.kalan > 0 ? formatNum(g.kalan) : <span className="text-muted-foreground">0</span>}
        </TableCell>

        <TableCell className="hidden align-top text-right font-mono text-[12px] tabular-nums xl:table-cell">
          {s.toplamAgirlikKg == null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            formatNum(s.toplamAgirlikKg, 1)
          )}
        </TableCell>

        <TableCell className="align-top">
          <button
            type="button"
            onClick={onTeklif}
            title={
              g.teklifler.length === 0
                ? "Teklif gir — firma ve fiyat"
                : `${g.teklifler.length} teklif · en iyi ${fmtMoney(g.enIyi?.unitPriceEur, "EUR")}`
            }
            className="inline-flex min-h-8 items-center gap-1 border border-dashed px-1.5 text-[11px] whitespace-nowrap transition-colors pointer-coarse:min-h-10 hover:border-foreground/40 hover:text-foreground"
          >
            <Tag className="size-3" />
            {g.teklifler.length === 0 ? (
              <span className="text-muted-foreground">Teklif Gir</span>
            ) : (
              <>
                <span className="font-mono">{formatNum(g.teklifler.length)}</span>
                {g.enIyi?.unitPriceEur != null && (
                  <span className="font-mono">{fmtMoney(g.enIyi.unitPriceEur, "EUR")}</span>
                )}
              </>
            )}
          </button>
        </TableCell>

        {/* NOT — İŞ HAZIRLAMA'daki sütun; tıklanınca düzenlenir. */}
        <TableCell className="hidden max-w-[12rem] align-top whitespace-normal lg:table-cell">
          <button
            type="button"
            onClick={onNot}
            disabled={!canWrite}
            title={s.not || "Not ekle"}
            className="inline-flex min-h-7 max-w-full items-center gap-1 text-left text-[12px] transition-colors disabled:cursor-default hover:text-foreground"
          >
            <StickyNote className="size-3 shrink-0 text-muted-foreground" />
            <span className={s.not ? "" : "text-muted-foreground"}>{s.not || "—"}</span>
          </button>
        </TableCell>

        {/* DURUM BİR DÜĞMEDİR (md. 4): bekliyor/teklifli iken basınca sipariş
            penceresi açılır — satınalmacının en sık yaptığı hareket budur. */}
        <TableCell className="align-top">
          <DurumCipi
            durum={g.durum}
            onClick={canWrite && (g.durum === "bekliyor" || g.durum === "teklifli") ? onSiparis : undefined}
          />
        </TableCell>
      </TableRow>

      {genis && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={sutunSayisi} className="whitespace-normal p-0">
            <div className="oc-scrollx px-3 py-2 [--oc-scroll-bg:var(--muted)]">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="py-1 pr-3 text-left font-normal">İş Kalemi</th>
                    <th className="py-1 pr-3 text-left font-normal">Paket</th>
                    <th className="py-1 pr-3 text-left font-normal">Kullanıldığı Yer</th>
                    <th className="py-1 pr-3 text-right font-normal">Resimde</th>
                    <th className="py-1 pr-3 text-right font-normal">× Adet</th>
                    <th className="py-1 text-right font-normal">Gereken</th>
                  </tr>
                </thead>
                <tbody>
                  {s.paylar.map((p, i) => (
                    <tr key={`${p.packageId}-${p.partKey}-${i}`} className="border-t border-border/50">
                      <td className="py-1 pr-3 font-mono">{p.itemNo || "—"}</td>
                      <td className="py-1 pr-3">{p.packageLabel}</td>
                      <td className="py-1 pr-3 text-muted-foreground">{p.groupName || "—"}</td>
                      <td className="py-1 pr-3 text-right font-mono tabular-nums">
                        {p.birimAdet == null ? "—" : formatNum(p.birimAdet)}
                      </td>
                      <td className="py-1 pr-3 text-right font-mono tabular-nums">
                        {formatNum(p.carpan)}
                        {p.carpanBelirsiz && (
                          <span className="ml-0.5 text-amber-600 dark:text-amber-400" title="Adet belirsiz">
                            ?
                          </span>
                        )}
                      </td>
                      <td className="py-1 text-right font-mono font-medium tabular-nums">
                        {p.adet == null ? "—" : formatNum(p.adet)}
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

/** Ölçü hücresi — boş değer TİRE gösterir, sıfır göstermez. */
function Olcu({ v }: { v: number | null }) {
  return (
    <TableCell className="hidden align-top text-right font-mono text-[12px] tabular-nums 2xl:table-cell">
      {v == null ? <span className="text-muted-foreground">—</span> : formatNum(v, 1)}
    </TableCell>
  );
}

// ------------------------------------------------------------------ ufaklar

function DurumCipi({ durum, onClick }: { durum: Durum; onClick?: () => void }) {
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
      title={onClick ? "Sipariş aç" : undefined}
      className={
        "inline-flex min-h-7 items-center border px-1.5 text-[11px] whitespace-nowrap transition-colors pointer-coarse:min-h-9 disabled:cursor-default " +
        sinif +
        (onClick ? " hover:border-foreground/40 hover:text-foreground" : "")
      }
    >
      {DURUM_ETIKET[durum]}
    </button>
  );
}

/** Süzgecin insan okunur özeti — PDF'in künyesine yazılır. */
function suzgecOzeti(
  f: Filtreler,
  secenekler: { siniflar: { value: string; label: string }[]; durumlar: { value: string; label: string }[]; isler: { value: string; label: string }[] }
): string {
  const parca: string[] = [];
  if (f.query.trim()) parca.push(`arama "${f.query.trim()}"`);
  const ad = (liste: { value: string; label: string }[], v: string[]) =>
    v.map((x) => liste.find((s) => s.value === x)?.label ?? x).join(", ");
  if (f.isler.length) parca.push(`iş: ${ad(secenekler.isler, f.isler)}`);
  if (f.siniflar.length) parca.push(`kategori: ${ad(secenekler.siniflar, f.siniflar)}`);
  if (f.durumlar.length) parca.push(`durum: ${ad(secenekler.durumlar, f.durumlar)}`);
  return parca.length ? parca.join(" · ") : "tümü";
}

/**
 * Excel ve PDF — SÜZGEÇ VE SEÇİM TAŞINIR (md. 7).
 *
 * `POST` kullanılır, `GET` değil: havuz anahtarı normalleştirilmiş TANIMDIR
 * ("CIVATA M16X120 DIN 931 GALVANİZLİ") ve iki yüz kalem adres çubuğuna
 * sığmaz. Aynı gerekçe paket içi indirmede de yazılıydı.
 */
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
      <form method="POST" action="/purchasing/export?bicim=xlsx">
        {alanlar}
        <Button type="submit" variant="outline" size="xs" title={ipucu}>
          <FileSpreadsheet className="size-3" />
          Excel
        </Button>
      </form>
      <form method="POST" action="/purchasing/export?bicim=pdf">
        {alanlar}
        <Button type="submit" variant="outline" size="xs" title={`${ipucu} — satın alma talebi`}>
          <FileText className="size-3" />
          PDF
        </Button>
      </form>
    </span>
  );
}

function NotDialog({
  g,
  onClose,
  onSaved,
}: {
  g: Gorunum;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [calisiyor, basla] = useTransition();
  const [not, setNot] = useState(g.satir.not);

  function kaydet() {
    basla(async () => {
      const sonuc = await saveItemMeta({
        keys: [g.satir.key],
        samples: [g.satir.tanim],
        category: null,
        note: not,
      });
      if (sonuc.error) toast.error(sonuc.error);
      else {
        toast.success("Not kaydedildi.");
        onSaved();
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[min(28rem,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle className="text-base">Not</DialogTitle>
          <DialogDescription className="text-[12px]">{g.satir.tanim}</DialogDescription>
        </DialogHeader>
        <Input
          value={not}
          onChange={(e) => setNot(e.target.value)}
          maxLength={500}
          className="h-10 w-full text-base pointer-fine:text-sm"
          aria-label="Not"
          onKeyDown={(e) => {
            if (e.key === "Enter") kaydet();
          }}
        />
        <p className="text-[11px] text-muted-foreground">
          Not kaleme bağlıdır, projeye değil: aynı kalem her projede aynı notu taşır.
        </p>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={calisiyor}>
            Vazgeç
          </Button>
          <Button type="button" onClick={kaydet} disabled={calisiyor}>
            {calisiyor && <Loader2 className="size-4 animate-spin" />}
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryStrip({ havuz, gorunumler }: { havuz: TalepHavuzu; gorunumler: Gorunum[] }) {
  const toplam = gorunumler.length;
  const tamam = gorunumler.filter((g) => g.durum === "tamam").length;
  const teklifli = gorunumler.filter((g) => g.teklifler.length > 0).length;
  const oran = toplam > 0 ? Math.round((tamam / toplam) * 100) : 0;
  const teklifOran = toplam > 0 ? Math.round((teklifli / toplam) * 100) : 0;

  return (
    <section className="border bg-card p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">Talep Durumu</h2>
        <p className="font-mono text-[11px] text-muted-foreground">
          {formatNum(tamam)}/{formatNum(toplam)} Sipariş Edildi · {formatNum(teklifli)} Teklifli
        </p>
      </div>

      <span className="relative mt-2 block h-1.5 w-full bg-muted" aria-hidden>
        <span className="absolute inset-y-0 left-0 bg-primary/40" style={{ width: `${teklifOran}%` }} />
        <span className="absolute inset-y-0 left-0 bg-primary" style={{ width: `${oran}%` }} />
      </span>

      <ul className="oc-scrollx mt-2 flex flex-wrap items-center gap-1.5 [--oc-scroll-bg:var(--card)]">
        {havuz.siniflar.map((s) => (
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
        {formatNum(havuz.paketSayisi)} paketin {formatNum(havuz.kaynakSatiri)} satırı{" "}
        {formatNum(havuz.toplamKalem)} kaleme indi
        {havuz.cokIsliKalem > 0 &&
          ` · ${formatNum(havuz.cokIsliKalem)} kalem birden çok işe gidiyor`}
        {" · "}
        {formatNum(havuz.toplamAdet)} adet.
      </p>
    </section>
  );
}

/**
 * Seçim kutusu — `components/ui`da Checkbox yok. Ham `<input type="checkbox">`
 * 13px'lik bir hedeftir; 44px'lik bir `label` içine sarmak dokunma hedefi
 * kuralını karşılamanın en ucuz yoludur.
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
