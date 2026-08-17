"use client";

// Paket listesi — arama, süzgeç, sıralama.
//
// Süzgeç tanımı `filters.ts`te; bu dosya yalnız durumu tutar ve basar.
// Sütun önceliklendirme (AGENTS dokunmatik MOBIL-7): düşük öncelikli sütunlar
// HEM `th` HEM `td` üzerinde gizlenir, gizlenenin kritik olanı birincil
// hücrenin içinde `md:hidden` ikinci satıra iner. İkinci bir kart markup'ı
// YAZILMAZ — sıralama ve süzme mantığını ikiye böler.
//
// TELEFONDA TABLO LİSTEYE KATLANIR (kullanıcı kararı, 16.08.2026: "mobilde
// yatayda kaydırma olmasın; uygulama gibi davransın" — kabuk kuralı 15).
// `sm` altında yalnız Kalem No · Paket · Durum kalır; Tanıma ve Bulgu birincil
// hücrenin alt satırına iner. İki yerde görünen öğe (`Tanima`, `BulguRozetleri`)
// TEK bileşendir — iki yazım, birinde düzeltilen etiketin ötekinde kalmasıydı.

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
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
import { PACKAGE_STATUSES } from "@/lib/drawings/types";
import { PACKAGE_STATUS_LABELS, formatNum, recognitionClass } from "@/lib/drawings/labels";
import { RECONCILER_VERSION } from "@/lib/drawings/reconcile";
import { storageState, type PackageRow } from "./data";
import {
  ALL,
  EMPTY_PACKAGE_FILTERS,
  groupPackages,
  matchesPackage,
  sortPackages,
  type PackageFilters,
  type PackageSortKey,
} from "./filters";
import { FilterBar, SearchBox, SortableHead } from "./sortable-head";

/** Tablodaki sütun sayısı — grup başlığının `colSpan`ı buradan okunur. */
const SUTUN = 8;

/**
 * Grup başlığı ancak bir kalemin EN AZ bu kadar paketi varken basılır.
 *
 * Gruplama artık ilk açılışta devrede olduğu için başlık artık istisna değil
 * kural olurdu: tek paketli her kaleme de başlık koymak satır sayısını ikiye
 * katlar ve o başlık, satırın kendi hücrelerinde ZATEN yazan sayıları tekrar
 * ederdi. Başlığın taşıdığı asıl bilgi "bu iş PARÇA PARÇA teslim edildi"dir —
 * tek paketli bir kalemde böyle bir bilgi yoktur, dolayısıyla başlık da yoktur.
 */
const GRUP_BASLIK_ESIGI = 2;

export function PackagesTable({ packages }: { packages: PackageRow[] }) {
  const [f, setF] = useState<PackageFilters>(EMPTY_PACKAGE_FILTERS);
  // GRUPLAMA ÖNTANIMLI AÇIKTIR ve bedeli ÖNTANIMLI SIRALAMADIR.
  //
  // Gruplama yazılmıştı ama liste tarihe göre açılıyordu; kullanıcı "Kalem No"
  // başlığına tıklamadan gruplamayı hiç görmüyordu. Var olan ama keşfedilmeyen
  // bir özellik, olmayan özelliktir.
  //
  // İki yol vardı: (a) öntanımlı sıralamayı kaleme çevirmek, (b) gruplamayı
  // sıralamadan bağımsız bir aç/kapa yapmak. (a) SEÇİLDİ:
  //   · Gruplama bir görüntü tercihi değil VERİNİN GERÇEĞİDİR. Bir iş 3–5 ayrı
  //     teslimle gelir ve mühendisin aklında tuttuğu kimlik kalem numarasıdır
  //     ("0057-00'ın köprüsü"). Listenin ilk cevaplaması gereken soru "bu iş
  //     için ne var"dır; ölçüye göre sıralama ikincil bir sorudur.
  //   · (b) düzeltmeye çalıştığımız kusurun bir eşini üretirdi: keşfedilmesi,
  //     hatırlanması ve kalıcılaştırılması gereken İKİNCİ bir denetim. Üstelik
  //     o anahtarın ilginç konumu zaten YANLIŞTIR — "parça"ya göre sıralarken
  //     gruplamak, "en çok parçalı paket hangisi" sorusunun cevabını grup
  //     başlıklarının arasına dağıtır. Tek doğru konumu olan bir anahtar,
  //     anahtar değildir.
  //
  // Tarih sırası kaybolmuyor, bir tık uzakta (Durum başlığı). "Ne yeni geldi"
  // sorusunun asıl cevabı da zaten tablonun ÜSTÜNDEKİ iki karttır: yarım
  // kalmış yükleme ve eşleşmemiş paket.
  //
  // KABUL EDİLEN SONUÇ: kalem numarası boş paketler artan sırada BAŞA düşer ve
  // "kalem eşleşmemiş" başlığı altında toplanır. Modülün kuralı eşleşmeyeni
  // gizlemek değil GÖRÜNÜR kılmaktır; listenin başında durmaları bu kurala
  // aykırı değildir. (Sona alınmaları istenirse yeri burası değil
  // `filters.ts`teki `PACKAGE_SORTS.kalem` karşılaştırıcısıdır.)
  const [sortKey, setSortKey] = useState<PackageSortKey>("kalem");
  const [desc, setDesc] = useState(false);

  const gorunen = useMemo(
    () => sortPackages(packages.filter((p) => matchesPackage(p, f)), sortKey, desc),
    [packages, f, sortKey, desc]
  );

  // Gruplama KALEM SIRALAMASINA bağlı kalır (yukarıdaki karar): başka bir
  // sütuna göre sıralarken gruplamak kullanıcının istediği sırayı bozar. Kalem
  // sıralaması ise aynı işin satırlarını zaten yan yana getirir — gruplama
  // orada yalnız görüneni ADLANDIRIR, sırayı değiştirmez.
  const gruplu = sortKey === "kalem";
  const gruplar = useMemo(() => (gruplu ? groupPackages(gorunen) : []), [gruplu, gorunen]);

  function sirala(key: PackageSortKey) {
    if (key === sortKey) setDesc((d) => !d);
    else {
      setSortKey(key);
      setDesc(key === "tarih" || key === "dosya" || key === "parca");
    }
  }

  const temiz = JSON.stringify(f) === JSON.stringify(EMPTY_PACKAGE_FILTERS);

  return (
    <div className="grid gap-3">
      <FilterBar
        gorunen={gorunen.length}
        toplam={packages.length}
        temiz={temiz}
        onTemizle={() => setF(EMPTY_PACKAGE_FILTERS)}
      >
        <SearchBox
          value={f.query}
          onChange={(v) => setF((s) => ({ ...s, query: v }))}
          placeholder="Kalem No, Paket Adı, Grup Ara…"
          className="w-[min(22rem,calc(100vw-4rem))]"
        />
        <Select value={f.status} onValueChange={(v) => setF((s) => ({ ...s, status: v }))}>
          <SelectTrigger size="sm" className="w-auto min-w-[8rem] text-base pointer-fine:text-sm">
            <SelectValue placeholder="Durum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Durum: Tümü</SelectItem>
            {PACKAGE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {PACKAGE_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={f.eslesme} onValueChange={(v) => setF((s) => ({ ...s, eslesme: v }))}>
          <SelectTrigger size="sm" className="w-auto min-w-[9rem] text-base pointer-fine:text-sm">
            <SelectValue placeholder="Eşleşme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Eşleşme: Tümü</SelectItem>
            <SelectItem value="eslesmis">İş kalemine bağlı</SelectItem>
            <SelectItem value="eslesmemis">Eşleşmemiş</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      {gorunen.length === 0 ? (
        <div className="border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Bu süzgeçle eşleşen paket yok. Süzgeci temizleyip yeniden deneyin.
          </p>
        </div>
      ) : (
        // `oc-table-clamp` + `oc-sticky-head`: paket listesi teslimlerle
        // BÜYÜYEN bir defterdir; uzun kaydırmada başlık kayıpsa "bu sayı
        // hangi sütundu" sorusu geri gelir (demand-table deseni).
        <div className="oc-scrollx oc-table-clamp overflow-x-auto border bg-card [--oc-scroll-bg:var(--card)]">
          <Table>
            <TableHeader className="oc-sticky-head">
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <SortableHead sortKey="kalem" current={sortKey} desc={desc} onSort={sirala}>
                  Kalem No
                </SortableHead>
                <SortableHead sortKey="paket" current={sortKey} desc={desc} onSort={sirala}>
                  Paket
                </SortableHead>
                <TableHead className="hidden lg:table-cell">Grup</TableHead>
                <SortableHead
                  sortKey="dosya"
                  current={sortKey}
                  desc={desc}
                  onSort={sirala}
                  align="right"
                  className="hidden md:table-cell"
                >
                  Depoda
                </SortableHead>
                <SortableHead
                  sortKey="parca"
                  current={sortKey}
                  desc={desc}
                  onSort={sirala}
                  align="right"
                  className="hidden md:table-cell"
                >
                  Parça
                </SortableHead>
                <SortableHead
                  sortKey="tanima"
                  current={sortKey}
                  desc={desc}
                  onSort={sirala}
                  align="right"
                  className="hidden sm:table-cell"
                >
                  Tanıma
                </SortableHead>
                <TableHead className="hidden sm:table-cell">Bulgu</TableHead>
                <SortableHead sortKey="tarih" current={sortKey} desc={desc} onSort={sirala}>
                  Durum
                </SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gruplu
                ? gruplar.map((g) => (
                    <Fragment key={g.itemNo || "(kalemsiz)"}>
                      {/* GRUP BAŞLIĞI — bir işin bütün paketleri bir arada.
                          Bazı projeler grup grup çiziliyor ve bir iş için 3–5
                          ayrı yükleme geliyor; liste onları birbirinden
                          bağımsız satırlar olarak gösteriyordu. Başlık ÇOK
                          PAKETLİ kalemlerde çizilir (`GRUP_BASLIK_ESIGI`):
                          tek paketli işe başlık koymak bilgi vermez, yalnız
                          listeyi iki katına çıkarırdı. */}
                      {g.rows.length >= GRUP_BASLIK_ESIGI && (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={SUTUN} className="py-1.5">
                            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                              <span className="font-mono text-sm font-semibold">
                                {g.itemNo || "Kalem Eşleşmemiş"}
                              </span>
                              <span className="font-mono text-[11px] text-muted-foreground">
                                {formatNum(g.rows.length)} Paket ·{" "}
                                <span className={g.missing > 0 ? "text-destructive" : undefined}>
                                  {formatNum(g.storedCount)}/{formatNum(g.fileCount)} Dosya Depoda
                                </span>{" "}
                                · {formatNum(g.partCount)} Parça
                              </span>
                              {g.rows[0]?.jobs?.title && (
                                <span className="truncate text-[11px] text-muted-foreground">
                                  {g.rows[0].jobs.title}
                                </span>
                              )}
                            </span>
                          </TableCell>
                        </TableRow>
                      )}
                      {g.rows.map((p) => (
                        <PaketSatiri key={p.id} p={p} />
                      ))}
                    </Fragment>
                  ))
                : gorunen.map((p) => <PaketSatiri key={p.id} p={p} />)}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function PaketSatiri({ p }: { p: PackageRow }) {
  const eskiKural = p.reconciler_version > 0 && p.reconciler_version < RECONCILER_VERSION;
  const depo = storageState(p);
  return (
    <TableRow className="relative">
      <TableCell className="font-mono text-sm">
        <Link href={`/drawings/${p.id}`} className="absolute inset-0" aria-label={p.folder_name} />
        {p.item_no || <span className="text-muted-foreground">—</span>}
      </TableCell>

      <TableCell className="min-w-0">
        {/* Telefonda ad SARAR (kırpma `sm`den başlar, kabuk kuralı 7):
            kırpılmış adı okutacak bir fare orada yok. `break-words` gerçek
            veri içindir — boşluksuz uzun klasör adı tabloyu itmesin. */}
        <span
          className="block break-words whitespace-normal font-medium sm:truncate"
          title={p.folder_name}
        >
          {p.description || p.folder_name}
          {p.capacity && <span className="ml-1 text-muted-foreground">({p.capacity})</span>}
        </span>
        <span className="mt-0.5 block break-words font-mono text-[11px] whitespace-normal text-muted-foreground sm:truncate md:hidden">
          {[
            p.group_code && `Grup ${p.group_code}`,
            `${formatNum(depo.stored)}/${formatNum(depo.expected)} Dosya`,
            `${formatNum(p.part_count)} Parça`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        {/* TELEFON KATMANI (sm altı): gizlenen Tanıma ve Bulgu buraya iner —
            tablo listeye katlanır, yatay kaymaz (kabuk kuralı 15). */}
        <span className="mt-1 flex flex-wrap items-center gap-1.5 sm:hidden">
          <Tanima p={p} />
          <BulguRozetleri p={p} bosIsaret={false} />
        </span>
      </TableCell>

      <TableCell className="hidden font-mono text-sm text-muted-foreground lg:table-cell">
        {p.group_code || "—"}
      </TableCell>

      {/* DOSYA SÜTUNU BEYANI DEĞİL ÖLÇÜMÜ BASAR. `file_count` paket açılırken
          bir kez yazılıyor ve bir daha güncellenmiyor; depoya hiçbir bayt
          ulaşmasa bile aynı sayıyı gösterirdi. */}
      <TableCell className="hidden text-right font-mono text-sm md:table-cell">
        <span className={depo.missing > 0 ? "font-semibold text-destructive" : undefined}>
          {formatNum(depo.stored)}/{formatNum(depo.expected)}
        </span>
      </TableCell>

      <TableCell className="hidden text-right font-mono text-sm md:table-cell">
        {formatNum(p.part_count)}
      </TableCell>

      <TableCell className="hidden text-right sm:table-cell">
        <Tanima p={p} />
      </TableCell>

      <TableCell className="hidden sm:table-cell">
        <BulguRozetleri p={p} />
      </TableCell>

      <TableCell>
        <span className="flex flex-wrap items-center gap-1">
          <span className="border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
            {PACKAGE_STATUS_LABELS[p.status]}
          </span>
          {p.rev_no > 1 && (
            <span className="border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
              R{String(p.rev_no).padStart(2, "0")}
            </span>
          )}
          {eskiKural && (
            <span
              className="relative z-10 border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[11px] text-amber-700 dark:text-amber-400"
              title="Tanıma kuralları güncellendi; yeniden eşleştirilebilir."
            >
              kural eski
            </span>
          )}
        </span>
      </TableCell>
    </TableRow>
  );
}

/** Tanıma yüzdesi — masaüstünde kendi sütununda, telefonda birincil hücrede. */
function Tanima({ p }: { p: PackageRow }) {
  return (
    <span className={`font-mono text-sm font-medium ${recognitionClass(p.recognition_pct)}`}>
      {p.recognition_pct == null ? "—" : `%${p.recognition_pct}`}
    </span>
  );
}

/**
 * Bulgu rozetleri — iki yerde görünür, TEK bileşende kurulur (kabuk kuralı 15).
 * `bosIsaret` yalnız masaüstü sütununda açıktır: telefonda temiz satırın
 * altına bir "—" basmak gürültü olurdu.
 */
function BulguRozetleri({ p, bosIsaret = true }: { p: PackageRow; bosIsaret?: boolean }) {
  const eksik = p.finding_counts?.eksik ?? 0;
  const celiski = p.finding_counts?.celiski ?? 0;
  const depo = storageState(p);
  return (
    <span className="flex flex-wrap gap-1">
      {depo.missing > 0 && (
        <span
          className="relative z-10 border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 font-mono text-[11px] text-destructive"
          title="Kayıt var, bayt yok. “Depoyu Doğrula” ile ölçülür, “Eksikleri Yükle” ile tamamlanır."
        >
          {formatNum(depo.missing)} depoda yok
        </span>
      )}
      {eksik > 0 && (
        <span className="border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 font-mono text-[11px] text-destructive">
          {eksik} eksik
        </span>
      )}
      {celiski > 0 && (
        <span className="border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[11px] text-amber-700 dark:text-amber-400">
          {celiski} çelişki
        </span>
      )}
      {bosIsaret && depo.missing === 0 && eksik === 0 && celiski === 0 && (
        <span className="font-mono text-[11px] text-muted-foreground">—</span>
      )}
    </span>
  );
}
