"use client";

// ELEKTRİK LİSTESİNİN TABLOSU — malzeme ve aygıt görünümleri.
//
// TABLO YATAYDA KAYMAZ, SIĞAR (kullanıcı bildirimi, 19.08.2026). Üç kural
// birlikte çalışır ve biri eksik olursa öteki ikisi işe yaramaz:
//
//   1. `table-fixed` + YÜZDE genişlikler — otomatik yerleşimde tarayıcı
//      genişliği İÇERİĞE göre paylaştırıyordu: "5SL6210-7" taşıyan Tip No
//      sütunu tablonun yarısını alıyor, 40 karakterlik Tanım üç satıra
//      sarıyordu (ekran görüntüsü). Yüzde pay bunu içerikten bağımsız kılar.
//   2. Her hücre `truncate` — sarma YOK, satır boyu SABİT. Sabit satır boyu
//      bir estetik tercih değil: 726 satırlık bir listede göz ancak eşit
//      yükseklikteki satırları tarayabilir.
//   3. Kesilen metin `title` ile tam hâlini verir — bilgi kaybolmaz, gizlenir.
//
// TELEFONDA TABLO KATLANIR (değişmez md. 10): `md` altında satırlar kart
// listesine döner. Sekiz sütunu 375 pikselde göstermenin yolu yok; katlama,
// yatay kaydırmanın tek dürüst alternatifidir.
//
// SÜZGEÇ VE SIRALAMA `lib/electrical/filter.ts`TEDİR — Excel çıktısı da onu
// çağırır (bkz. o dosyanın başlığı: kullanıcının süzüp indirdiği dosya
// ekranda gördüğünden başka satır taşıyamaz).

import type { ReactNode } from "react";
import { BookOpen, FileText } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableHead } from "@/app/(app)/drawings/sortable-head";
import type {
  MaterialSortKey,
  PartSortKey,
} from "@/lib/electrical/filter";
import type { ElectricalMaterialRow, ElectricalPart } from "@/lib/electrical/types";
import type { ElectricalCatalogReference } from "@/lib/electrical/catalogs";

/** Okunamayan sayı EKRANDA "—"DİR; `0` yazmak yalan olurdu (md. 4·5). */
const say = (n: number | null): string => (n === null ? "—" : String(n));

/** Boş metin de "—" basar; hücre hiç boş kalmaz, hizalama bozulmaz. */
const yaz = (s: string): string => (s.trim() ? s : "—");

/**
 * Kesilen hücre.
 *
 * `title` HER ZAMAN TAM METNİ taşır, kesilmiş olsun olmasın: kesilip
 * kesilmediğini ölçmek bir yeniden yerleşim (reflow) ister ve 726 satırda o
 * ölçüm sayfayı kilitler. Kesilmemiş bir hücrede tooltip zararsızdır.
 */
function Hucre({
  children,
  mono,
  sag,
  className,
  etiket,
  span,
}: {
  children: string;
  mono?: boolean;
  sag?: boolean;
  className?: string;
  /** Katlanmış kartta hücrenin başlığı (`.oc-tablet-table td::before`). */
  etiket: string;
  /** Kartta tam satırı kaplasın mı. */
  span?: "full";
}) {
  return (
    <TableCell
      title={children}
      data-label={etiket}
      data-mobile-span={span}
      className={`truncate max-lg:overflow-visible max-lg:whitespace-normal ${
        mono ? "font-mono text-xs" : ""
      } ${sag ? "text-right tabular-nums" : ""} ${className ?? ""}`}
    >
      {children}
    </TableCell>
  );
}


function CatalogButtons({ reference }: { reference?: ElectricalCatalogReference }) {
  if (!reference?.technicalDocumentId && !reference?.catalogDocumentId) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="flex items-center justify-end gap-1">
      {reference.technicalDocumentId && (
        <a
          href={`/api/electrical-catalog/${reference.technicalDocumentId}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Teknik föyü yeni sekmede aç"
          className="oc-tap inline-flex items-center gap-1 rounded border bg-background px-1.5 py-1 text-[11px] font-medium leading-none text-primary hover:bg-muted"
        >
          <FileText className="size-3" /> Föy
        </a>
      )}
      {reference.catalogDocumentId && (
        <a
          href={`/api/electrical-catalog/${reference.catalogDocumentId}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Tam kataloğu yeni sekmede aç"
          className="oc-tap inline-flex items-center gap-1 rounded border bg-background px-1.5 py-1 text-[11px] font-medium leading-none text-primary hover:bg-muted"
        >
          <BookOpen className="size-3" /> Kat.
        </a>
      )}
    </div>
  );
}

// —————————————————————————————————————————————————————— malzeme tablosu

export function MaterialTable({
  rows,
  catalogReferences,
  sortKey,
  desc,
  onSort,
}: {
  rows: readonly ElectricalMaterialRow[];
  catalogReferences: readonly ElectricalCatalogReference[];
  sortKey: MaterialSortKey;
  desc: boolean;
  onSort: (k: MaterialSortKey) => void;
}) {
  const documents = new Map(catalogReferences.map((r) => [r.materialKey, r]));
  return (
    <>
      {/* SÜTUN PAYLARI İÇERİĞİN GERÇEK ÖLÇÜSÜNDEN gelir (ölçüldü, 187 satır):
          tanım ~40 karakter, kategori ~30, malzeme kodu ~22, tip no ~18,
          tedarikçi ~14, pano listesi ~10. Belge düğmeleri sabit ve küçüktür.
          Toplam 100. */}
      <Table containerClassName="oc-table-clamp oc-tablet-table-wrap overflow-x-hidden"
        className="oc-tablet-table oc-compact-mobile-table table-fixed">
        <colgroup>
          <col className="w-[5%]" />
          <col className="w-[22%]" />
          <col className="w-[17%]" />
          <col className="w-[13%]" />
          <col className="w-[11%]" />
          <col className="w-[14%]" />
          <col className="w-[8%]" />
          <col className="w-[10%]" />
        </colgroup>
        <TableHeader className="oc-sticky-head">
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <SortableHead sortKey="qty" current={sortKey} desc={desc} onSort={onSort} align="right">
              Adet
            </SortableHead>
            <SortableHead sortKey="designation" current={sortKey} desc={desc} onSort={onSort}>
              Tanım
            </SortableHead>
            <SortableHead sortKey="category" current={sortKey} desc={desc} onSort={onSort}>
              Kategori
            </SortableHead>
            <SortableHead sortKey="typeNo" current={sortKey} desc={desc} onSort={onSort}>
              Tip No
            </SortableHead>
            <SortableHead sortKey="supplier" current={sortKey} desc={desc} onSort={onSort}>
              Tedarikçi
            </SortableHead>
            <SortableHead sortKey="partNo" current={sortKey} desc={desc} onSort={onSort}>
              Malzeme Kodu
            </SortableHead>
            <SortableHead sortKey="locations" current={sortKey} desc={desc} onSort={onSort}>
              Panolar
            </SortableHead>
            <TableHeaderCell>Doküman</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((m) => {
            const panolar = m.locations.map((l) => `+${l}`).join(" ");
            return (
              <TableRow key={m.key}>
                <Hucre etiket="Adet" sag>
                  {say(m.qty)}
                </Hucre>
                <Hucre etiket="Tanım" span="full">
                  {yaz(m.designation)}
                </Hucre>
                <Hucre etiket="Kategori">{m.category}</Hucre>
                <Hucre etiket="Tip No" mono>
                  {yaz(m.typeNo)}
                </Hucre>
                <Hucre etiket="Tedarikçi">{yaz(m.supplier)}</Hucre>
                <Hucre etiket="Malzeme Kodu" mono>
                  {yaz(m.partNo)}
                </Hucre>
                <Hucre etiket="Panolar" mono className="text-muted-foreground">
                  {yaz(panolar)}
                </Hucre>
                <TableCell data-label="Doküman" data-mobile-actions className="text-right">
                  <CatalogButtons reference={documents.get(m.key)} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
}

/** Sıralanmayan sabit başlık; `TableHead` varsayılan ritmini korur. */
function TableHeaderCell({ children }: { children: ReactNode }) {
  return <TableHead className="text-right">{children}</TableHead>;
}

// ———————————————————————————————————————————————————————— aygıt tablosu

export function PartTable({
  rows,
  sortKey,
  desc,
  onSort,
}: {
  rows: readonly ElectricalPart[];
  sortKey: PartSortKey;
  desc: boolean;
  onSort: (k: PartSortKey) => void;
}) {
  return (
    <>
      <Table containerClassName="oc-table-clamp oc-tablet-table-wrap overflow-x-hidden"
        className="oc-tablet-table oc-compact-mobile-table table-fixed">
        <colgroup>
          <col className="w-[17%]" />
          <col className="w-[6%]" />
          <col className="w-[26%]" />
          <col className="w-[16%]" />
          <col className="w-[13%]" />
          <col className="w-[16%]" />
          <col className="w-[6%]" />
        </colgroup>
        <TableHeader className="oc-sticky-head">
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <SortableHead sortKey="deviceTag" current={sortKey} desc={desc} onSort={onSort}>
              Aygıt Etiketi
            </SortableHead>
            <SortableHead sortKey="qty" current={sortKey} desc={desc} onSort={onSort} align="right">
              Adet
            </SortableHead>
            <SortableHead sortKey="designation" current={sortKey} desc={desc} onSort={onSort}>
              Tanım
            </SortableHead>
            <SortableHead sortKey="typeNo" current={sortKey} desc={desc} onSort={onSort}>
              Tip No
            </SortableHead>
            <SortableHead sortKey="supplier" current={sortKey} desc={desc} onSort={onSort}>
              Tedarikçi
            </SortableHead>
            <SortableHead sortKey="partNo" current={sortKey} desc={desc} onSort={onSort}>
              Malzeme Kodu
            </SortableHead>
            <SortableHead sortKey="page" current={sortKey} desc={desc} onSort={onSort} align="right">
              Sf.
            </SortableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p, i) => (
            <TableRow key={`${p.deviceTag}-${p.partNo}-${i}`}>
              <Hucre etiket="Aygıt Etiketi" mono>
                {p.deviceTag}
              </Hucre>
              <Hucre etiket="Adet" sag>
                {say(p.qty)}
              </Hucre>
              <Hucre etiket="Tanım" span="full">
                {yaz(p.designation)}
              </Hucre>
              <Hucre etiket="Tip No" mono>
                {yaz(p.typeNo)}
              </Hucre>
              <Hucre etiket="Tedarikçi">{yaz(p.supplier)}</Hucre>
              <Hucre etiket="Malzeme Kodu" mono>
                {yaz(p.partNo)}
              </Hucre>
              <Hucre etiket="Sayfa" sag mono className="text-muted-foreground">
                {p.page ? String(p.page) : "—"}
              </Hucre>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}

/** Süzgeç hiçbir satır bırakmadıysa — boş tablo sessiz kalmaz. */
export function BosSonuc({ onTemizle }: { onTemizle: () => void }) {
  return (
    <div className="px-4 py-10 text-center text-sm text-muted-foreground">
      Süzgece uyan satır yok.{" "}
      <button type="button" onClick={onTemizle} className="oc-tap text-primary hover:underline">
        Süzgeci temizleyin
      </button>
      .
    </div>
  );
}
