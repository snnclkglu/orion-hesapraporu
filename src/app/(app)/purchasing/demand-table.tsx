"use client";

// Talep Havuzu tablosu — satınalmacının çalışma yüzeyi.
//
// ————————————————————————————————————————————————— DÖRT KARAR
//
// 1. SATIR BİR KALEMDİR, BİR PROJE SATIRI DEĞİL. Aynı somun beş projede
//    geçiyorsa tek satırdır ve adedi toplamdır; hangi projeden ne kadar
//    geldiği satırın AÇILIR ayrıntısındadır. Satınalmacı tedarikçiyle tek bir
//    sayı konuşur.
//
// 2. "GEREKEN" İLE "SİPARİŞ EDİLEN" YAN YANA DURUR. Üçüncü sütun ikisinin
//    farkıdır ve ekranın asıl sayısı odur: sıfırlanmış bir satır iş bitmiş
//    demektir. Tek bir "durum" çipi bu bilgiyi taşıyamazdı — kısmi sipariş
//    gerçektir (100 cıvatanın 60'ı).
//
// 3. TEKLİF BİR SÜTUNDUR, BİR EKRAN DEĞİL. Kullanıcı "Firma 1, Firma 2, Firma 3
//    gibi alınan teklif fiyatları BASİTÇE sisteme girilebilecek" dedi; ayrı bir
//    teklif ekranına gitmek o basitliği bitirirdi. Sütun en iyi (en ucuz) avro
//    fiyatı ve teklif sayısını gösterir, pencere tamamını.
//
// 4. SEÇİM ÇOK PROJELİDİR. Satınalmacı farklı işlerden kalemleri işaretler ve
//    TEK sipariş açar (md. 7) — yapışkan şerit seçili kalem sayısını ve
//    tahmini tutarı taşır.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, FileSpreadsheet, Loader2, Plus, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { CustomerTag } from "@/components/tags";
import { formatNum } from "@/lib/drawings/labels";
import { fmtMoney } from "@/lib/currency";
import type { TalepHavuzu, TalepSatiri } from "@/lib/purchasing/demand";
import { FilterBar, SearchBox, SortableHead } from "../drawings/sortable-head";
import type { TeklifSatiri } from "./data";
import { QuoteDialog } from "./quote-dialog";
import { OrderDialog } from "./order-dialog";

/** Süzgeç açılırlarının "Tümü" değeri — boş dizge Radix'te yasaktır. */
const ALL = "__all__";

type SortKey = "kategori" | "tanim" | "adet" | "kalan" | "is" | "teklif";

interface Filtreler {
  query: string;
  sinif: string;
  durum: string;
}

const BOS: Filtreler = { query: "", sinif: ALL, durum: ALL };

/** Satır + türetilmiş sipariş/teklif bilgisi. */
interface Gorunum {
  satir: TalepSatiri;
  siparisEdilen: number;
  kalan: number;
  teklifler: TeklifSatiri[];
  /** En ucuz AVRO teklifi; kuru olmayan teklifler yarışa girmez. */
  enIyi: TeklifSatiri | null;
}

function durumu(g: Gorunum): "bekliyor" | "teklifli" | "kismi" | "tamam" {
  if (g.satir.adet != null && g.siparisEdilen >= g.satir.adet && g.satir.adet > 0) return "tamam";
  if (g.siparisEdilen > 0) return "kismi";
  if (g.teklifler.length > 0) return "teklifli";
  return "bekliyor";
}

const DURUM_ETIKET: Record<ReturnType<typeof durumu>, string> = {
  bekliyor: "Bekliyor",
  teklifli: "Teklif alındı",
  kismi: "Kısmi sipariş",
  tamam: "Sipariş edildi",
};

export function DemandTable({
  havuz,
  teklifler,
  siparisAdetleri,
  tedarikciler,
  kategoriler,
  isler,
  seciliIsler,
  canWrite,
}: {
  havuz: TalepHavuzu;
  teklifler: TeklifSatiri[];
  /** [matchKey, sipariş edilen adet] — sunucuda toplanır, burada bölünmez. */
  siparisAdetleri: [string, number][];
  tedarikciler: string[];
  kategoriler: string[];
  isler: { id: string; label: string }[];
  seciliIsler: string[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [calisiyor, basla] = useTransition();

  const [f, setF] = useState<Filtreler>(BOS);
  const [sortKey, setSortKey] = useState<SortKey>("kategori");
  const [desc, setDesc] = useState(false);
  const [secili, setSecili] = useState<Set<string>>(new Set());
  const [acik, setAcik] = useState<Set<string>>(new Set());
  const [teklifPenceresi, setTeklifPenceresi] = useState<Gorunum | null>(null);
  const [siparisPenceresi, setSiparisPenceresi] = useState(false);

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
      };
    });
  }, [havuz.satirlar, teklifler, siparisAdetleri]);

  const siniflar = useMemo(
    () => [...new Set(gorunumler.map((g) => g.satir.sinif))].sort(
      (a, b) => kategoriler.indexOf(a) - kategoriler.indexOf(b)
    ),
    [gorunumler, kategoriler]
  );

  const gorunen = useMemo(() => {
    const q = f.query.trim().toLocaleLowerCase("tr-TR");
    const suzulmus = gorunumler.filter((g) => {
      if (f.sinif !== ALL && g.satir.sinif !== f.sinif) return false;
      if (f.durum !== ALL && durumu(g) !== f.durum) return false;
      if (!q) return true;
      const havuzMetni = [
        g.satir.tanim,
        g.satir.malzeme,
        ...g.satir.anaGruplar,
        ...g.satir.paylar.map((p) => `${p.itemNo} ${p.jobTitle} ${p.customer}`),
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");
      return havuzMetni.includes(q);
    });

    const yon = desc ? -1 : 1;
    return [...suzulmus].sort((a, b) => {
      switch (sortKey) {
        case "tanim":
          return yon * a.satir.tanim.localeCompare(b.satir.tanim, "tr");
        case "adet":
          return yon * ((a.satir.adet ?? 0) - (b.satir.adet ?? 0));
        case "kalan":
          return yon * (a.kalan - b.kalan);
        case "is":
          return yon * (a.satir.isSayisi - b.satir.isSayisi);
        case "teklif":
          return yon * (a.teklifler.length - b.teklifler.length);
        default: {
          const fark = kategoriler.indexOf(a.satir.sinif) - kategoriler.indexOf(b.satir.sinif);
          return yon * (fark !== 0 ? fark : a.satir.tanim.localeCompare(b.satir.tanim, "tr"));
        }
      }
    });
  }, [gorunumler, f, sortKey, desc, kategoriler]);

  function sirala(k: SortKey) {
    if (k === sortKey) setDesc((d) => !d);
    else {
      setSortKey(k);
      setDesc(false);
    }
  }

  const temiz = JSON.stringify(f) === JSON.stringify(BOS);
  const seciliGorunumler = gorunen.filter((g) => secili.has(g.satir.key));

  function isSuzgeci(deger: string) {
    const adres = deger === ALL ? "/purchasing" : `/purchasing?is=${deger}`;
    basla(() => router.push(adres));
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
          placeholder="Tanım, Grup, İş, Müşteri Ara…"
          className="w-[min(20rem,calc(100vw-4rem))]"
        />
        <Suzgec
          value={f.sinif}
          onChange={(v) => setF((s) => ({ ...s, sinif: v }))}
          bos="Kategori"
          secenekler={siniflar.map((s) => ({ value: s, label: s }))}
        />
        <Suzgec
          value={f.durum}
          onChange={(v) => setF((s) => ({ ...s, durum: v }))}
          bos="Durum"
          secenekler={[
            { value: "bekliyor", label: "Bekliyor" },
            { value: "teklifli", label: "Teklif alındı" },
            { value: "kismi", label: "Kısmi sipariş" },
            { value: "tamam", label: "Sipariş edildi" },
          ]}
        />

        <span className="hidden h-5 w-px bg-border sm:block" />

        {/* İŞ SÜZGECİ ADRESİ DEĞİŞTİRİR: havuzun kapsamı sunucuda belirlenir,
            çünkü daraltmak yalnız görünümü değil OKUNAN VERİYİ de küçültür. */}
        <Select value={seciliIsler[0] ?? ALL} onValueChange={isSuzgeci}>
          <SelectTrigger size="sm" className="w-auto min-w-[10rem] text-base pointer-fine:text-sm">
            <SelectValue placeholder="İş" />
          </SelectTrigger>
          <SelectContent className="max-h-[min(24rem,60dvh)]">
            <SelectItem value={ALL}>İş: Tümü</SelectItem>
            {isler.map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <form method="POST" action="/purchasing/export">
          <input type="hidden" name="anahtarlar" value={gorunen.map((g) => g.satir.key).join("\n")} />
          <Button type="submit" variant="outline" size="xs" title="Ekrandaki süzgeçle aynı liste">
            <FileSpreadsheet className="size-3" />
            Excel
          </Button>
        </form>
      </FilterBar>

      {havuz.belirsizKalem > 0 && (
        <p className="border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-400">
          <strong>{formatNum(havuz.belirsizKalem)} kalemin adedi belirsiz.</strong> İş kaleminin
          sayısal adedi girilmediği için çarpan <strong>1</strong> kabul edildi. Doğru sipariş
          adedi için İşler → ilgili iş kalemi → “Adet” alanını doldurun.
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
        <div className="border bg-card">
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
                <SortableHead sortKey="kategori" current={sortKey} desc={desc} onSort={sirala}>
                  Kategori
                </SortableHead>
                <SortableHead sortKey="tanim" current={sortKey} desc={desc} onSort={sirala}>
                  Tanım
                </SortableHead>
                <SortableHead sortKey="is" current={sortKey} desc={desc} onSort={sirala}>
                  İşler
                </SortableHead>
                <SortableHead sortKey="adet" current={sortKey} desc={desc} onSort={sirala} align="right">
                  Gereken
                </SortableHead>
                <TableHead className="text-right">Sipariş</TableHead>
                <SortableHead sortKey="kalan" current={sortKey} desc={desc} onSort={sirala} align="right">
                  Kalan
                </SortableHead>
                <SortableHead sortKey="teklif" current={sortKey} desc={desc} onSort={sirala}>
                  Teklif
                </SortableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gorunen.map((g) => {
                const d = durumu(g);
                const genis = acik.has(g.satir.key);
                return (
                  <Satir
                    key={g.satir.key}
                    g={g}
                    durum={d}
                    genis={genis}
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
                  />
                );
              })}
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
            <Loader2 className="size-3 animate-spin" /> Yükleniyor
          </span>
        )}
      </p>

      {/* Yapışkan toplu şerit — seçim yapıp düğmeye ulaşmak için sayfanın
          dibine inmek gerekmemeli (paket ekranındaki kuralın aynısı). */}
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
            <Button
              type="button"
              size="xs"
              onClick={() => setSiparisPenceresi(true)}
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
          canWrite={canWrite}
          onClose={() => setTeklifPenceresi(null)}
        />
      )}

      {siparisPenceresi && (
        <OrderDialog
          kalemler={seciliGorunumler.map((g) => ({
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
          }))}
          tedarikciler={tedarikciler}
          onClose={() => setSiparisPenceresi(false)}
          onSaved={() => {
            setSiparisPenceresi(false);
            setSecili(new Set());
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
  durum,
  genis,
  secili,
  canWrite,
  onSec,
  onGenislet,
  onTeklif,
}: {
  g: Gorunum;
  durum: ReturnType<typeof durumu>;
  genis: boolean;
  secili: boolean;
  canWrite: boolean;
  onSec: () => void;
  onGenislet: () => void;
  onTeklif: () => void;
}) {
  const s = g.satir;
  return (
    <>
      <TableRow className={secili ? "bg-primary/[0.05]" : undefined}>
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

        <TableCell className="align-top text-[12px] whitespace-normal">{s.sinif}</TableCell>

        <TableCell className="max-w-[24rem] min-w-0 align-top whitespace-normal">
          <span className="block text-[13px] leading-snug">{s.tanim || "—"}</span>
          {/* ANA GRUP — kullanıcı bunu açıkça istedi (md. 9): "hangi grup
              içerisinde olduğunun bilinmesi gerekiyor". */}
          {s.anaGruplar.length > 0 && (
            <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
              {s.anaGruplar.join(" · ")}
            </span>
          )}
          {/* ÇELİŞKİ GİZLENMEZ: aynı kalem iki malzemeyle geçtiyse ikisi de yazılır. */}
          {s.malzemeler.length > 1 ? (
            <span
              className="mt-0.5 block font-mono text-[11px] font-semibold text-destructive"
              title="Kaynak satırlar farklı malzeme söylüyor"
            >
              {s.malzemeler.join(" / ")}
            </span>
          ) : (
            s.malzeme && (
              <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                {s.malzeme}
              </span>
            )
          )}
          {/* Normalleştirme gerçekten iş yaptıysa ham yazımlar görünür: sistem
              ne anladığını söyler, sessizce düzeltmez (md. 18/4). */}
          {s.hamTanimlar.length > 1 && (
            <span
              className="mt-0.5 block font-mono text-[11px] text-muted-foreground"
              title={s.hamTanimlar.join("\n")}
            >
              {formatNum(s.hamTanimlar.length)} farklı yazımdan birleşti
            </span>
          )}
        </TableCell>

        <TableCell className="align-top">
          <span className="flex flex-wrap items-center gap-1">
            {[...new Set(s.paylar.map((p) => p.customer))].filter(Boolean).slice(0, 3).map((c) => (
              <CustomerTag key={c} name={c} shortName={c} />
            ))}
            {s.isSayisi > 1 && (
              <span className="font-mono text-[11px] text-muted-foreground">
                {formatNum(s.isSayisi)} iş
              </span>
            )}
          </span>
        </TableCell>

        <TableCell className="align-top text-right font-mono text-sm tabular-nums">
          {s.adet == null ? "—" : formatNum(s.adet)}
          {s.carpanBelirsiz && (
            <span className="ml-1 text-amber-600 dark:text-amber-400" title="Adet belirsiz — çarpan 1 kabul edildi">
              ?
            </span>
          )}
        </TableCell>

        <TableCell className="align-top text-right font-mono text-sm tabular-nums text-muted-foreground">
          {g.siparisEdilen > 0 ? formatNum(g.siparisEdilen) : "—"}
        </TableCell>

        <TableCell className="align-top text-right font-mono text-sm font-medium tabular-nums">
          {g.kalan > 0 ? formatNum(g.kalan) : <span className="text-muted-foreground">0</span>}
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

        <TableCell className="align-top">
          <DurumCipi durum={durum} />
        </TableCell>
      </TableRow>

      {/* AYRINTI: hangi işten ne kadar. Satırın kendisi bir TOPLAMdır; bölünmüş
          hâli sipariş bölünürken ve fatura kesilirken gerekir. */}
      {genis && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={canWrite ? 10 : 9} className="whitespace-normal p-0">
            <div className="oc-scrollx px-3 py-2 [--oc-scroll-bg:var(--muted)]">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="py-1 pr-3 text-left font-normal">İş Kalemi</th>
                    <th className="py-1 pr-3 text-left font-normal">Paket</th>
                    <th className="py-1 pr-3 text-left font-normal">Ana Grup</th>
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

// ------------------------------------------------------------------ ufaklar

function DurumCipi({ durum }: { durum: ReturnType<typeof durumu> }) {
  const sinif =
    durum === "tamam"
      ? "border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
      : durum === "kismi"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : durum === "teklifli"
          ? "border-sky-600/40 bg-sky-600/10 text-sky-700 dark:text-sky-400"
          : "border-dashed border-border text-muted-foreground";
  return (
    <span
      className={`inline-flex min-h-7 items-center border px-1.5 text-[11px] whitespace-nowrap ${sinif}`}
    >
      {DURUM_ETIKET[durum]}
    </span>
  );
}

function SummaryStrip({
  havuz,
  gorunumler,
}: {
  havuz: TalepHavuzu;
  gorunumler: Gorunum[];
}) {
  const toplam = gorunumler.length;
  const tamam = gorunumler.filter((g) => durumu(g) === "tamam").length;
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

      {/* İKİ ÇUBUK İÇ İÇE: sipariş edilen her kalem zaten tekliflidir (ya da
          teklif alınmadan alınmıştır) — ayrı iki çubuk toplamı yüzü aşıyormuş
          gibi gösterirdi. */}
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

/** Süzgeç açılırı — "Tümü" seçeneği ALL sabitiyle taşınır (boş dizge yasak). */
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
 * Seçim kutusu — `components/ui`da Checkbox yok. Ham `<input type="checkbox">`
 * 13px'lik bir hedeftir; 44px'lik bir `label` içine sarmak dokunma hedefi
 * kuralını karşılamanın en ucuz yoludur (paket ekranıyla aynı bileşen).
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

/** Toast yardımcısı — action sonuçlarını tek yerde yorumlar. */
export function bildir(sonuc: { error?: string; ok?: number }, basarili: string) {
  if (sonuc.error) toast.error(sonuc.error);
  else toast.success(basarili);
}
