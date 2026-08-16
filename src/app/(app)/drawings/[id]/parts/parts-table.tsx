"use client";

// Parçalar tablosu — arama, süzgeç, sıralama ve indirme.
//
// TABLO YATAYDA SIĞAR. `TableHead`/`TableCell` tabanı `whitespace-nowrap`tır ve
// dokuz sütunla birlikte sayfayı kendi genişliğinin iki katına çıkarıyordu;
// kullanıcı defteri okumak için sürekli yana kaydırıyordu. Metin taşıyan
// sütunlar (kod · tanım · malzeme · kategori) artık SARAR: altı segmentli bir
// kod (`0043-00-0802-00-02-06`) tirelerinden bölünüp iki satır kaplar, ki
// kırpılmış bir koddan iyidir — kırpılan kod parçayı adresleyemez.
//
// ÖLÇÜLDÜ: 1280px'de dokuz sütunun tamamı sığıyor ve tabloda yatay kaydırma
// KALMIYOR. Telefonda (375px) tablo LİSTEYE KATLANIR (kullanıcı kararı,
// 16.08.2026: "mobilde yatayda kaydırma olmasın" — kabuk kuralı 15): `sm`
// altında Tanım · Adet · Dosyalar kalır, Kod birincil hücrenin alt satırına
// iner — kırpılmış bir koddan iyidir, kod orada tam ve sarılı yazılır.
// Tablet ara genişlikleri hâlâ taşabilir; `Table`ın kendi `.oc-scrollx` kabı
// oradaki kaydırmayı GÖRÜNÜR kılar (AGENTS md. 8).
//
// SÜZGEÇ TANIMI BURADA DEĞİL `../../filters.ts`TE. İndirme uçları AYNI tanımı
// çağırır; iki yerde yazılsaydı indirilen dosya ile ekrandaki tablo sessizce
// ayrışırdı (İş Takibi'nde bir kez yaşandı, oradaki yorum bunu anlatıyor).
//
// Süzgeç adres çubuğuna YAZILMAZ ama indirme bağlantısına GEÇER: ekranda ne
// görüyorsan indirdiğinde de o gelir.

import { useMemo, useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
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
import { PART_KIND_LABELS, PART_KINDS } from "@/lib/drawings/types";
import { formatNum } from "@/lib/drawings/labels";
import type { FileRow, PartRow } from "../../data";
import {
  ALL,
  EMPTY_PART_FILTERS,
  kategoriGoster,
  matchesPart,
  partOptions,
  sortParts,
  type PartFilters,
  type PartSortKey,
} from "../../filters";
import { FilterBar, SearchBox, SortableHead } from "../../sortable-head";
import { FileOpenButton } from "../file-open-button";

export function PartsTable({
  packageId,
  parts,
  files,
}: {
  packageId: string;
  parts: PartRow[];
  files: FileRow[];
}) {
  const [f, setF] = useState<PartFilters>(EMPTY_PART_FILTERS);
  const [sortKey, setSortKey] = useState<PartSortKey>("kod");
  const [desc, setDesc] = useState(false);

  const dosyaKimlik = useMemo(() => new Map(files.map((d) => [d.id, d])), [files]);
  const secenekler = useMemo(() => partOptions(parts), [parts]);

  const gorunen = useMemo(() => {
    const suzulmus = parts.filter((p) => matchesPart(p, f));
    return sortParts(suzulmus, sortKey, desc);
  }, [parts, f, sortKey, desc]);

  function sirala(key: PartSortKey) {
    if (key === sortKey) setDesc((d) => !d);
    else {
      setSortKey(key);
      setDesc(false);
    }
  }

  const temiz = JSON.stringify(f) === JSON.stringify(EMPTY_PART_FILTERS);

  // Süzgeç indirme adresine taşınır — ekranda ne görüyorsan o iner.
  const sorgu = new URLSearchParams();
  if (f.query.trim()) sorgu.set("q", f.query.trim());
  if (f.kind !== ALL) sorgu.set("tur", f.kind);
  if (f.category !== ALL) sorgu.set("kategori", f.category);
  if (f.material !== ALL) sorgu.set("malzeme", f.material);
  if (f.dosya !== ALL) sorgu.set("dosya", f.dosya);
  sorgu.set("sira", sortKey);
  if (desc) sorgu.set("ters", "1");
  const indirmeEki = sorgu.toString();

  const agirlikToplam = gorunen
    .filter((p) => p.weight_kg != null && !p.parent_code)
    .reduce((t, p) => t + Number(p.weight_kg ?? 0), 0);

  return (
    <div className="grid gap-3">
      <FilterBar
        gorunen={gorunen.length}
        toplam={parts.length}
        temiz={temiz}
        onTemizle={() => setF(EMPTY_PART_FILTERS)}
      >
        <SearchBox
          value={f.query}
          onChange={(v) => setF((s) => ({ ...s, query: v }))}
          placeholder="Kod, Tanım, Malzeme Ara…"
          className="w-[min(20rem,calc(100vw-4rem))]"
        />

        <Suzgec
          value={f.kind}
          onChange={(v) => setF((s) => ({ ...s, kind: v }))}
          bos="Tür"
          secenekler={PART_KINDS.map((k) => ({ value: k, label: PART_KIND_LABELS[k] }))}
        />
        <Suzgec
          value={f.category}
          onChange={(v) => setF((s) => ({ ...s, category: v }))}
          bos="Kategori"
          secenekler={secenekler.categories.map((c) => ({ value: c, label: c }))}
        />
        <Suzgec
          value={f.material}
          onChange={(v) => setF((s) => ({ ...s, material: v }))}
          bos="Malzeme"
          secenekler={secenekler.materials.map((m) => ({ value: m, label: m }))}
        />
        <Suzgec
          value={f.dosya}
          onChange={(v) => setF((s) => ({ ...s, dosya: v }))}
          bos="Dosya"
          secenekler={[
            { value: "resimli", label: "Resmi olan" },
            { value: "resimsiz", label: "Hiç dosyası olmayan" },
            { value: "kesimli", label: "Kesim dosyası olan" },
          ]}
        />

        <span className="hidden h-5 w-px bg-border sm:block" />

        <Button asChild variant="outline" size="xs">
          <a href={`/drawings/${packageId}/parts/download?bicim=xlsx&${indirmeEki}`}>
            <FileSpreadsheet className="size-3" />
            Excel
          </a>
        </Button>
        <Button asChild variant="outline" size="xs">
          <a href={`/drawings/${packageId}/parts/download?bicim=pdf&${indirmeEki}`}>
            <FileText className="size-3" />
            PDF
          </a>
        </Button>
      </FilterBar>

      <p className="font-mono text-[11px] text-muted-foreground">
        {formatNum(gorunen.filter((p) => p.kind === "imalat").length)} İmalat ·{" "}
        {formatNum(gorunen.filter((p) => p.kind === "satinalma").length)} Satın Alma ·{" "}
        {formatNum(gorunen.filter((p) => p.kind === "montaj").length)} Montaj
        {agirlikToplam > 0 && ` · Kök Ağırlık ${formatNum(agirlikToplam, 1)} kg`}
      </p>

      {gorunen.length === 0 ? (
        <div className="border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Bu süzgeçle eşleşen satır yok. Süzgeci temizleyip yeniden deneyin.
          </p>
        </div>
      ) : (
        // İKİNCİ BİR KAYDIRMA KABI YOK. `Table` kendi kabını `.oc-scrollx` ile
        // zaten kuruyor; dıştan bir `overflow-x-auto` daha sarmak iç içe iki
        // kaydırma alanı yapardı ve telefonda parmak hangisini süreceğini
        // şaşırırdı. Bu kutu yalnız çerçeve ve zemin verir.
        <div className="border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <SortableHead sortKey="kod" current={sortKey} desc={desc} onSort={sirala}>
                  Kod
                </SortableHead>
                <SortableHead sortKey="tanim" current={sortKey} desc={desc} onSort={sirala}>
                  Tanım
                </SortableHead>
                <SortableHead sortKey="adet" current={sortKey} desc={desc} onSort={sirala} align="right">
                  Adet
                </SortableHead>
                <SortableHead
                  sortKey="malzeme"
                  current={sortKey}
                  desc={desc}
                  onSort={sirala}
                  className="hidden md:table-cell"
                >
                  Malzeme
                </SortableHead>
                <SortableHead
                  sortKey="kalinlik"
                  current={sortKey}
                  desc={desc}
                  onSort={sirala}
                  align="right"
                  className="hidden lg:table-cell"
                >
                  Kalınlık
                </SortableHead>
                <SortableHead
                  sortKey="kategori"
                  current={sortKey}
                  desc={desc}
                  onSort={sirala}
                  className="hidden lg:table-cell"
                >
                  Kategori
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
                <TableHead className="hidden xl:table-cell">Tür</TableHead>
                <TableHead>Dosyalar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gorunen.map((p) => {
                const resim = p.sheet_file_id ? dosyaKimlik.get(p.sheet_file_id) : null;
                const kesim = p.cut_file_id ? dosyaKimlik.get(p.cut_file_id) : null;
                // Montaj satırı defterde de ayırt edilir — ağaçtaki kuralın aynısı.
                const montaj = p.kind === "montaj";
                return (
                  <TableRow key={p.register_key} className={montaj ? "bg-muted/30" : undefined}>
                    <TableCell
                      className={
                        "align-top whitespace-normal " +
                        (montaj
                          ? "font-mono text-[12px] font-bold tracking-tight"
                          : "font-mono text-[12px]")
                      }
                    >
                      {p.part_code || (
                        // KODU YOKSA AİT OLDUĞU GRUP YAZILIR. Cıvatanın resmi
                        // olmaz ama bir yere takılır; "—" o soruyu cevapsız
                        // bırakıyordu (kullanıcı bildirimi, 13.08.2026). Kod
                        // ÜRÜN AĞACININ item yolundan çözülür, ağaç yoksa yine
                        // "—" kalır — uydurulmuş bir grup yazılmaz.
                        <span
                          className="font-sans text-muted-foreground"
                          title={
                            p.parent_code
                              ? `Parça numarası yok — ${p.parent_code} grubunun satın alma satırı`
                              : "Parça numarası olmayan satın alma satırı"
                          }
                        >
                          {p.parent_code ? `↳ ${p.parent_code}` : "—"}
                        </span>
                      )}
                    </TableCell>

                    {/* `overflow-wrap:anywhere` (yalnız telefonda): `break-word`
                        tablo sütununun MIN-CONTENT genişliğini küçültmez —
                        "15x240x285" jetonu sütunu 134px altına inemez kılıyor
                        ve tablo 375px'te taşıyordu (ölçüldü, md. 15). */}
                    <TableCell className="min-w-0 align-top break-words whitespace-normal max-sm:[overflow-wrap:anywhere]">
                      <span className={"block" + (montaj ? " font-medium" : "")}>
                        {p.description || p.name || p.assembly_title || "—"}
                      </span>
                      {/* Dar ekranda gizlenen sütunların kritik olanı buraya iner */}
                      <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground md:hidden">
                        {[
                          p.material,
                          p.thickness_mm != null && `${formatNum(p.thickness_mm, 1)}mm`,
                          kategoriGoster(p.category),
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </span>
                    </TableCell>

                    <TableCell className="align-top text-right font-mono text-sm">
                      {p.qty ?? "—"}
                      {p.cut_length_mm != null && (
                        // Telefonda ALT SATIRA iner: "24.000 6.000,0mm" tek
                        // satırda Adet sütununu genişletip tabloyu taşırıyordu
                        // (AGENTS md. 15 ölçümü).
                        <span
                          className="block text-[11px] text-muted-foreground sm:ml-1 sm:inline"
                          title="Kirli QTY sütunundan çözülen kesim boyu"
                        >
                          {formatNum(p.cut_length_mm, 1)}mm
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="hidden align-top font-mono text-[12px] whitespace-normal md:table-cell">
                      {p.material || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="hidden align-top text-right font-mono text-[12px] lg:table-cell">
                      {p.thickness_mm == null ? "—" : formatNum(p.thickness_mm, 1)}
                    </TableCell>
                    <TableCell className="hidden align-top text-[12px] whitespace-normal lg:table-cell">
                      {kategoriGoster(p.category) || "—"}
                    </TableCell>
                    <TableCell className="hidden align-top text-right font-mono text-[12px] xl:table-cell">
                      {p.weight_kg == null ? "—" : formatNum(p.weight_kg, 3)}
                    </TableCell>
                    <TableCell className="hidden align-top text-[12px] text-muted-foreground xl:table-cell">
                      {PART_KIND_LABELS[p.kind]}
                    </TableCell>

                    <TableCell className="align-top">
                      <span className="flex flex-wrap items-center gap-1">
                        {resim && (
                          <FileOpenButton
                            storagePath={resim.storage_path}
                            fileName={resim.file_name}
                            label="PDF"
                            title={resim.file_name}
                          />
                        )}
                        {kesim && (
                          <FileOpenButton
                            storagePath={kesim.storage_path}
                            fileName={kesim.file_name}
                            label="DXF"
                            title={kesim.file_name}
                          />
                        )}
                        {p.has_model && !resim && (
                          <span className="border px-1.5 font-mono text-[11px] text-muted-foreground">
                            DWG
                          </span>
                        )}
                        {!p.has_model && !p.has_sheet && !p.has_cut && !p.has_3d && (
                          <span className="font-mono text-[11px] text-muted-foreground">—</span>
                        )}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

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
