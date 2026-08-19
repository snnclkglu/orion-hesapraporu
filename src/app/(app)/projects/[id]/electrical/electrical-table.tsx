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
// listesine döner. Yedi sütunu 375 pikselde göstermenin yolu yok; katlama,
// yatay kaydırmanın tek dürüst alternatifidir.
//
// SÜZGEÇ VE SIRALAMA `lib/electrical/filter.ts`TEDİR — Excel çıktısı da onu
// çağırır (bkz. o dosyanın başlığı: kullanıcının süzüp indirdiği dosya
// ekranda gördüğünden başka satır taşıyamaz).

import { Fragment } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableHead } from "@/app/(app)/drawings/sortable-head";
import type {
  MaterialSortKey,
  PartSortKey,
} from "@/lib/electrical/filter";
import type { ElectricalMaterialRow, ElectricalPart } from "@/lib/electrical/types";

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
}: {
  children: string;
  mono?: boolean;
  sag?: boolean;
  className?: string;
}) {
  return (
    <TableCell
      title={children}
      className={`truncate ${mono ? "font-mono text-xs" : ""} ${
        sag ? "text-right tabular-nums" : ""
      } ${className ?? ""}`}
    >
      {children}
    </TableCell>
  );
}

/**
 * Telefon kartı — katlanmış satırın gövdesi.
 *
 * Kartta `truncate` YOKTUR: dar ekranda tek satırlık bir tanım okunmaz hâle
 * gelirdi ve burada satır boyu eşitliği bir değer taşımıyor (göz zaten tek
 * sütunda ilerliyor).
 */
function Kart({
  baslik,
  adet,
  satirlar,
}: {
  baslik: string;
  adet: string;
  satirlar: [string, string][];
}) {
  return (
    <div className="border-b p-3 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 flex-1 text-sm font-medium break-words">{baslik}</span>
        <span className="shrink-0 font-mono text-sm tabular-nums">{adet}</span>
      </div>
      <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        {satirlar
          .filter(([, v]) => v.trim() && v !== "—")
          .map(([k, v]) => (
            <Fragment key={k}>
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="min-w-0 font-mono break-all">{v}</dd>
            </Fragment>
          ))}
      </dl>
    </div>
  );
}

// —————————————————————————————————————————————————————— malzeme tablosu

export function MaterialTable({
  rows,
  sortKey,
  desc,
  onSort,
}: {
  rows: readonly ElectricalMaterialRow[];
  sortKey: MaterialSortKey;
  desc: boolean;
  onSort: (k: MaterialSortKey) => void;
}) {
  return (
    <>
      {/* SÜTUN PAYLARI İÇERİĞİN GERÇEK ÖLÇÜSÜNDEN gelir (ölçüldü, 187 satır):
          tanım ~40 karakter, malzeme kodu ~22, tip no ~18, tedarikçi ~14,
          pano listesi ~10. Adet iki hane. Toplam 100. */}
      <Table containerClassName="oc-table-clamp overflow-x-hidden" className="table-fixed">
        <colgroup>
          <col className="w-[7%]" />
          <col className="w-[31%]" />
          <col className="w-[17%]" />
          <col className="w-[15%]" />
          <col className="w-[18%]" />
          <col className="w-[12%]" />
        </colgroup>
        <TableHeader className="oc-sticky-head hidden md:table-header-group">
          <TableRow className="bg-muted/50 hover:bg-muted/50">
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
            <SortableHead sortKey="locations" current={sortKey} desc={desc} onSort={onSort}>
              Panolar
            </SortableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="hidden md:table-row-group">
          {rows.map((m) => {
            const panolar = m.locations.map((l) => `+${l}`).join(" ");
            return (
              <TableRow key={m.key}>
                <Hucre sag>{say(m.qty)}</Hucre>
                <Hucre>{yaz(m.designation)}</Hucre>
                <Hucre mono>{yaz(m.typeNo)}</Hucre>
                <Hucre>{yaz(m.supplier)}</Hucre>
                <Hucre mono>{yaz(m.partNo)}</Hucre>
                <Hucre mono className="text-muted-foreground">
                  {yaz(panolar)}
                </Hucre>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Telefonda aynı satırlar kart olarak — yatay kaydırma YOK. */}
      <div className="md:hidden">
        {rows.map((m) => (
          <Kart
            key={m.key}
            baslik={yaz(m.designation)}
            adet={say(m.qty)}
            satirlar={[
              ["Tip No", yaz(m.typeNo)],
              ["Tedarikçi", yaz(m.supplier)],
              ["Kod", yaz(m.partNo)],
              ["Panolar", yaz(m.locations.map((l) => `+${l}`).join(" "))],
            ]}
          />
        ))}
      </div>
    </>
  );
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
      <Table containerClassName="oc-table-clamp overflow-x-hidden" className="table-fixed">
        <colgroup>
          <col className="w-[17%]" />
          <col className="w-[6%]" />
          <col className="w-[26%]" />
          <col className="w-[16%]" />
          <col className="w-[13%]" />
          <col className="w-[16%]" />
          <col className="w-[6%]" />
        </colgroup>
        <TableHeader className="oc-sticky-head hidden md:table-header-group">
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
        <TableBody className="hidden md:table-row-group">
          {rows.map((p, i) => (
            <TableRow key={`${p.deviceTag}-${p.partNo}-${i}`}>
              <Hucre mono>{p.deviceTag}</Hucre>
              <Hucre sag>{say(p.qty)}</Hucre>
              <Hucre>{yaz(p.designation)}</Hucre>
              <Hucre mono>{yaz(p.typeNo)}</Hucre>
              <Hucre>{yaz(p.supplier)}</Hucre>
              <Hucre mono>{yaz(p.partNo)}</Hucre>
              <Hucre sag mono className="text-muted-foreground">
                {p.page ? String(p.page) : "—"}
              </Hucre>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="md:hidden">
        {rows.map((p, i) => (
          <Kart
            key={`${p.deviceTag}-${p.partNo}-${i}`}
            baslik={yaz(p.designation)}
            adet={say(p.qty)}
            satirlar={[
              ["Aygıt", p.deviceTag],
              ["Tip No", yaz(p.typeNo)],
              ["Tedarikçi", yaz(p.supplier)],
              ["Kod", yaz(p.partNo)],
              ["Sayfa", p.page ? String(p.page) : "—"],
            ]}
          />
        ))}
      </div>
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
