"use client";

// ÖLÇÜ DEFTERİ EKRANI — arama, süzgeç ve satır içi ölçü girişi.
//
// SIRA ETKİYE GÖREDİR, alfabetik değil: defteri doldurmak 122 ürünlük bir iştir
// ve hepsi eşit değildir. 970 adet geçen bir klemensin 1 mm'lik hatası panoyu
// bir metre büyütür; tek adet geçen bir sinyal lambasının 10 mm'si hiçbir şeyi
// değiştirmez. Ekran işe en çok yer kazandıran satırı en üste koyar.
//
// Süzgeç ve arama `lib/switchboard/book.ts` içindeki SAF fonksiyondan geçer;
// ekranda ikinci bir kopyası yoktur (ELEKTRIK-11 ile aynı ilke).

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, BookOpen, Check, LayoutGrid, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SayiKutusu } from "@/components/sayi-kutusu";
import { FilterBar, SearchBox, SortableHead } from "@/app/(app)/drawings/sortable-head";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  EMPTY_BOOK_FILTER,
  bookCounts,
  bookFilterIsEmpty,
  bookSourceBucket,
  filterBook,
  type BookFilter,
  type BookRow,
  type BookSort,
} from "@/lib/switchboard/book";
import { MOUNT_LABEL, ZONE_LABEL } from "@/lib/switchboard/mount";
import { saveDeviceModel } from "../actions";

const KAYNAK_ETIKET: Record<string, string> = {
  katalog: "Katalog",
  elle: "Elle",
  tahmin: "Tahmin",
  eksik: "Ölçüsü yok",
};

function sayi(v: number): string {
  return v.toLocaleString("tr-TR");
}

function olcuMetni(r: BookRow): string {
  if (r.widthMm === null || r.heightMm === null || r.depthMm === null) return "—";
  const yuvarla = (v: number) => (Number.isInteger(v) ? v : Number(v.toFixed(1)));
  return `${yuvarla(r.widthMm)} × ${yuvarla(r.heightMm)} × ${yuvarla(r.depthMm)}`;
}

export function DefterView({
  projectId,
  docNo,
  projectName,
  canEdit,
  rows,
  bookSize,
}: {
  projectId: string;
  docNo: string;
  projectName: string;
  canEdit: boolean;
  rows: BookRow[];
  bookSize: number;
}) {
  const router = useRouter();
  const [suzgec, setSuzgec] = useState<BookFilter>(EMPTY_BOOK_FILTER);
  const [duzenlenen, setDuzenlenen] = useState<string>("");

  const gosterilen = useMemo(() => filterBook(rows, suzgec), [rows, suzgec]);
  const sayaclar = useMemo(() => bookCounts(rows), [rows]);

  const markalar = useMemo(
    () => [...new Set(rows.map((r) => r.supplier).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr")),
    [rows]
  );
  const kategoriler = useMemo(
    () => [...new Set(rows.map((r) => r.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr")),
    [rows]
  );

  function sirala(key: BookSort) {
    setSuzgec((f) => ({ ...f, sort: key, desc: f.sort === key ? !f.desc : true }));
  }

  return (
    <main className="grid gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="ghost" asChild>
          <Link href={`/projects/${projectId}/pano`}>
            <ArrowLeft className="size-3.5" /> Pano Yerleşimi
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">
          <BookOpen className="mr-1.5 inline size-4" />
          Ürün Ölçü Defteri
          <span className="ml-2 font-mono text-sm font-normal text-muted-foreground">
            {docNo} {projectName}
          </span>
        </h1>
        <Button size="sm" variant="outline" asChild className="ml-auto">
          <Link href={`/projects/${projectId}/pano`}>
            <LayoutGrid className="size-3.5" /> Yerleşime dön
          </Link>
        </Button>
      </div>

      {/* ————————————————————————————————————— sayaçlar */}
      <section className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <Sayac etiket="Defterdeki ürün" deger={sayi(bookSize)} />
          <Sayac etiket="Panoya giren" deger={sayi(sayaclar.panoya)} />
          <Sayac etiket="Ölçüldü" deger={sayi(sayaclar.olculdu)} iyi />
          <Sayac etiket="Tahmin" deger={sayi(sayaclar.tahmin)} uyari={sayaclar.tahmin > 0} />
          <Sayac etiket="Ölçüsü yok" deger={sayi(sayaclar.eksik)} uyari={sayaclar.eksik > 0} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Ölçü ÜRÜNE yazılır, projeye değil: bir kez girilen ölçü bütün projelerde geçerlidir.
          Tahmin defterde SAKLANMAZ — kural tabanlı üretilir ve şemada taralı çizilir; onu
          onaylamak ayrı bir iddiadır ve “elle” olarak girer.
        </p>
      </section>

      {/* ————————————————————————————————————— süzgeç */}
      <FilterBar
        gorunen={gosterilen.length}
        toplam={rows.length}
        temiz={bookFilterIsEmpty(suzgec)}
        onTemizle={() => setSuzgec(EMPTY_BOOK_FILTER)}
      >
        <SearchBox
          value={suzgec.q}
          onChange={(v) => setSuzgec((f) => ({ ...f, q: v }))}
          placeholder="Marka, tip no, tanım…"
          className="sm:w-64"
        />
        <select
          value={suzgec.source}
          onChange={(e) => setSuzgec((f) => ({ ...f, source: e.target.value }))}
          className="oc-tap h-9 max-w-44 rounded-md border bg-background px-2 text-base pointer-fine:text-sm"
          aria-label="Ölçü kaynağı süzgeci"
        >
          <option value="">Bütün kaynaklar</option>
          <option value="katalog">Katalog</option>
          <option value="elle">Elle</option>
          <option value="tahmin">Tahmin</option>
          <option value="eksik">Ölçüsü yok</option>
        </select>
        <select
          value={suzgec.supplier}
          onChange={(e) => setSuzgec((f) => ({ ...f, supplier: e.target.value }))}
          className="oc-tap h-9 max-w-48 rounded-md border bg-background px-2 text-base pointer-fine:text-sm"
          aria-label="Marka süzgeci"
        >
          <option value="">Bütün markalar</option>
          {markalar.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          value={suzgec.category}
          onChange={(e) => setSuzgec((f) => ({ ...f, category: e.target.value }))}
          className="oc-tap h-9 max-w-56 rounded-md border bg-background px-2 text-base pointer-fine:text-sm"
          aria-label="Kategori süzgeci"
        >
          <option value="">Bütün kategoriler</option>
          {kategoriler.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <select
          value={suzgec.mountType}
          onChange={(e) => setSuzgec((f) => ({ ...f, mountType: e.target.value }))}
          className="oc-tap h-9 max-w-44 rounded-md border bg-background px-2 text-base pointer-fine:text-sm"
          aria-label="Montaj tipi süzgeci"
        >
          <option value="">Bütün montaj tipleri</option>
          {(Object.keys(MOUNT_LABEL) as (keyof typeof MOUNT_LABEL)[]).map((k) => (
            <option key={k} value={k}>
              {MOUNT_LABEL[k]}
            </option>
          ))}
        </select>
        <label className="oc-tap flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={suzgec.onlyInProject}
            onChange={(e) => setSuzgec((f) => ({ ...f, onlyInProject: e.target.checked }))}
          />
          Yalnız bu projede
        </label>
        <label className="oc-tap flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={suzgec.onlyUnverified}
            onChange={(e) => setSuzgec((f) => ({ ...f, onlyUnverified: e.target.checked }))}
          />
          Yalnız doğrulanmamış
        </label>
      </FilterBar>

      {/* ————————————————————————————————————— tablo */}
      <div className="rounded-lg border bg-card">
        <Table className="oc-tablet-table table-fixed">
          <TableHeader>
            <TableRow>
              <SortableHead sortKey="marka" current={suzgec.sort} desc={suzgec.desc} onSort={sirala} className="w-[13%]">
                Marka
              </SortableHead>
              <SortableHead sortKey="tip" current={suzgec.sort} desc={suzgec.desc} onSort={sirala} className="w-[16%]">
                Tip No
              </SortableHead>
              <TableHead className="w-[19%]">Tanım</TableHead>
              <SortableHead sortKey="kategori" current={suzgec.sort} desc={suzgec.desc} onSort={sirala} className="w-[14%]">
                Kategori
              </SortableHead>
              <TableHead className="w-[9%]">Montaj</TableHead>
              <TableHead className="w-[13%]">Ölçü (mm)</TableHead>
              <SortableHead sortKey="kaynak" current={suzgec.sort} desc={suzgec.desc} onSort={sirala} className="w-[8%]">
                Kaynak
              </SortableHead>
              <SortableHead sortKey="etki" current={suzgec.sort} desc={suzgec.desc} onSort={sirala} className="w-[8%]" align="right">
                Etki
              </SortableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gosterilen.map((r) =>
              duzenlenen === r.lookupKey ? (
                <OlcuSatiri
                  key={r.lookupKey}
                  projectId={projectId}
                  row={r}
                  onKapat={() => setDuzenlenen("")}
                  onBitti={() => {
                    setDuzenlenen("");
                    router.refresh();
                  }}
                />
              ) : (
                <TableRow key={r.lookupKey} className="border-b last:border-0">
                  <td className="truncate px-3 py-1.5" data-label="Marka" title={r.supplier}>
                    {r.supplier || "—"}
                  </td>
                  <td className="truncate px-3 py-1.5 font-mono" data-label="Tip No" title={r.typeNo}>
                    {r.typeNo || "—"}
                  </td>
                  <td className="truncate px-3 py-1.5 text-muted-foreground" data-label="Tanım" title={r.designation}>
                    {r.designation || "—"}
                  </td>
                  <td className="truncate px-3 py-1.5" data-label="Kategori" title={r.category}>
                    {r.category || "—"}
                  </td>
                  <td className="truncate px-3 py-1.5 text-xs" data-label="Montaj">
                    {r.mountType ? MOUNT_LABEL[r.mountType] : "—"}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums" data-label="Ölçü (mm)">
                    {olcuMetni(r)}
                  </td>
                  <td className="px-3 py-1.5" data-label="Kaynak">
                    <KaynakRozeti kova={bookSourceBucket(r)} />
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums" data-label="Etki">
                    <span title={`${r.deviceCount} aygıt · ${r.unitCount} birim`}>
                      {r.railMm > 0 ? `${sayi(Math.round(r.railMm))} mm` : r.deviceCount > 0 ? "—" : "·"}
                    </span>
                    {canEdit && r.needsDimensions && (
                      <button
                        type="button"
                        className="oc-tap-square ml-2 text-muted-foreground hover:text-foreground"
                        title="Ölçüyü düzenle"
                        onClick={() => setDuzenlenen(r.lookupKey)}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    )}
                  </td>
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
        {gosterilen.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Süzgece uyan ürün yok.
          </p>
        )}
      </div>
    </main>
  );
}

function Sayac({
  etiket,
  deger,
  iyi,
  uyari,
}: {
  etiket: string;
  deger: string;
  iyi?: boolean;
  uyari?: boolean;
}) {
  return (
    <div className="grid gap-0.5">
      <span className="text-[10px] tracking-wide text-muted-foreground uppercase">{etiket}</span>
      <span
        className={`font-mono text-lg tabular-nums ${
          uyari ? "text-destructive" : iyi ? "text-emerald-600 dark:text-emerald-400" : ""
        }`}
      >
        {deger}
      </span>
    </div>
  );
}

function KaynakRozeti({ kova }: { kova: string }) {
  if (kova === "katalog" || kova === "elle") {
    return <Badge variant="secondary">{KAYNAK_ETIKET[kova]}</Badge>;
  }
  if (kova === "tahmin") {
    return (
      <Badge variant="outline" className="border-amber-500/60 text-amber-600">
        Tahmin
      </Badge>
    );
  }
  return <Badge variant="destructive">Ölçüsü yok</Badge>;
}

/**
 * SATIR İÇİ ÖLÇÜ GİRİŞİ — `source` daima `elle`dir.
 *
 * Bu bir tahminin ONAYLANMASI değil AYRI BİR İDDİADIR (PANO-12): tahmin
 * defterde hiç saklanmaz, girilen değer mühendisin beyanıdır. Boş bırakılan
 * kutu `null` üretir, `0` değil (değişmez md. 4/5).
 */
function OlcuSatiri({
  projectId,
  row,
  onKapat,
  onBitti,
}: {
  projectId: string;
  row: BookRow;
  onKapat: () => void;
  onBitti: () => void;
}) {
  const [en, setEn] = useState<number | null>(row.widthMm);
  const [boy, setBoy] = useState<number | null>(row.heightMm);
  const [derinlik, setDerinlik] = useState<number | null>(row.depthMm);
  const [montaj, setMontaj] = useState<string>(row.mountType ?? "");
  const [bolge, setBolge] = useState<string>(row.zone ?? "");
  const [bekle, setBekle] = useState(false);

  async function kaydet() {
    setBekle(true);
    const sonuc = await saveDeviceModel({
      projectId,
      supplier: row.supplier || "—",
      typeNo: row.typeNo,
      widthMm: en,
      heightMm: boy,
      depthMm: derinlik,
      mountType: (montaj || null) as Parameters<typeof saveDeviceModel>[0]["mountType"],
      zone: (bolge || null) as Parameters<typeof saveDeviceModel>[0]["zone"],
      note: row.note,
    });
    setBekle(false);
    if ("error" in sonuc) {
      toast.error(sonuc.error);
      return;
    }
    toast.success(`${row.typeNo} deftere yazıldı; bütün projelerde geçerli.`);
    onBitti();
  }

  return (
    <TableRow className="border-b bg-muted/40 last:border-0">
      <td className="truncate px-3 py-2" data-label="Marka">
        {row.supplier || "—"}
      </td>
      <td className="truncate px-3 py-2 font-mono" data-label="Tip No">
        {row.typeNo}
      </td>
      <td className="px-3 py-2" colSpan={2} data-label="Ölçü">
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-0.5 text-[10px] text-muted-foreground">
            En
            <SayiKutusu value={en} onChange={setEn} className="h-8 w-20" />
          </label>
          <label className="grid gap-0.5 text-[10px] text-muted-foreground">
            Yükseklik
            <SayiKutusu value={boy} onChange={setBoy} className="h-8 w-20" />
          </label>
          <label className="grid gap-0.5 text-[10px] text-muted-foreground">
            Derinlik
            <SayiKutusu value={derinlik} onChange={setDerinlik} className="h-8 w-20" />
          </label>
        </div>
      </td>
      <td className="px-3 py-2" data-label="Montaj">
        <select
          value={montaj}
          onChange={(e) => setMontaj(e.target.value)}
          className="oc-tap h-8 w-full rounded-md border bg-background px-1 text-sm"
          aria-label="Montaj tipi"
        >
          <option value="">Otomatik</option>
          {(Object.keys(MOUNT_LABEL) as (keyof typeof MOUNT_LABEL)[]).map((k) => (
            <option key={k} value={k}>
              {MOUNT_LABEL[k]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2" data-label="Bölge">
        <select
          value={bolge}
          onChange={(e) => setBolge(e.target.value)}
          className="oc-tap h-8 w-full rounded-md border bg-background px-1 text-sm"
          aria-label="Bölge"
        >
          <option value="">Otomatik</option>
          {(Object.keys(ZONE_LABEL) as (keyof typeof ZONE_LABEL)[]).map((k) => (
            <option key={k} value={k}>
              {ZONE_LABEL[k]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2" colSpan={2} data-label="">
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" disabled={bekle} onClick={() => void kaydet()}>
            <Check className="size-3.5" /> Yaz
          </Button>
          <Button size="sm" variant="ghost" disabled={bekle} onClick={onKapat}>
            <X className="size-3.5" />
          </Button>
        </div>
      </td>
    </TableRow>
  );
}
