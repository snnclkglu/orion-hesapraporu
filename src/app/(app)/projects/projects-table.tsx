"use client";

// Mühendislik listesi — hızlı filtreler + arama + satır eylemleri.
//
// Süzme SUNUCUDA DEĞİL burada yapılır (İşler ve Satış Takibi ile aynı gerekçe):
// rapor sayısı onlarla ölçülür, tamamı tek istekte gelir ve süzgeç değiştikçe
// sayfa yeniden yüklenmez.
//
// YIL VARSAYILANI "TÜMÜ"DÜR — İşler listesindekinin aksine. Orada aranan iş
// hemen her zaman bu yılındır; burada ise iki yıl önceki bir vincin hesap
// raporuna revizyon açmak sıradan bir iştir ve süzgeç sessizce onu gizlerse
// kullanıcı raporu "silinmiş" sanır.
//
// ARŞİV DE BU LİSTEDEDİR. Arşivlemek bir SİLME DEĞİL bir işarettir: proje
// listede kalır, "Arşiv" rozetiyle görünür ve tek tıkla geri alınır. "Arşivli
// projeleri nerede görüyoruz?" sorusunun cevabı bu yüzden ayrı bir ekran değil,
// buradaki Durum süzgecidir (kullanıcı sorusu, 11.08.2026).

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Files,
  X,
} from "lucide-react";
import { revisionStatusLabel, revisionStatusVariant } from "@/lib/revision-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ProjectRowActions } from "./project-actions";
import type { CustomerOption, JobOption } from "./new-project-dialog";
import { cn } from "@/lib/utils";
import {
  ENGINEERING_REPORT_CONTEXT,
  OFFER_REPORT_CONTEXT,
  type ReportContext,
} from "@/lib/report-context";
import {
  buildProjectListEntries,
  projectEntryCraneLabel,
  projectEntryCraneTypes,
  projectEntryCustomer,
  projectEntryDocLabel,
  projectEntryIsArchived,
  projectEntryJobNo,
  projectEntryMatches,
  projectEntryName,
  projectEntryRevisionLabel,
  projectEntrySortValue,
  projectEntryStatusLabel,
  projectYear,
  type ProjectListSortKey,
  type ProjectRow,
} from "@/lib/project-list";

export type { ProjectRow } from "@/lib/project-list";

/** "Tümü" seçeneği — Select bileşeni boş string değere izin vermez. */
const ALL = "__all__";
const ACTIVE = "active";
const ARCHIVED = "archived";

/*
 * SÜTUN GENİŞLİKLERİ — kullanıcı bildirimi (20.08.2026): *"listede isimlerin
 * çok uzun olma problemini çözer misin… tablo her zaman yatayda sayfaya
 * sığsın, yatay kaydırma olmasın."*
 *
 * Tablo düzeni `auto`dur ve bir sütunun EN DAR hâli içeriğinin tamamı kadardır.
 * Kelepçesiz `whitespace-nowrap` taşıyan Müşteri sütunu tek başına 414px'e
 * çıkıyor, Proje sütunu ise sarmak zorunda kalıp satırı 177px'e uzatıyordu
 * (ölçüldü, 1024px: kap 703px, tablo 1208px — sayfa 505px yatay kayıyordu).
 *
 * ÜÇ KURAL BİRLİKTE ÇALIŞIR:
 *
 * 1. **Esnek sütun HÜCREDE kelepçelenir** (`max-w-*`). `max-width` bir tablo
 *    hücresinde TAVAN DEĞİL TABANDIR: sütunun içsel en dar hâlini o değere
 *    indirir ama yer varken sütun yine de büyür (1920px'te Proje 598px'e
 *    çıkar, metin de o genişliğe kadar okunur). Bu yüzden kelepçe kırılım
 *    kırılım açılmaz — tek ve DAR bir değer yeter, geniş ekranda kendiliğinden
 *    genişler. Değerler en dar kaba göre seçilmiştir (aşağıdaki tabloya bak).
 * 2. **Kırpma `md`den başlar** (`md:truncate` + `title`). Telefonda ad SARAR;
 *    orada kırpılmış metni okutacak bir fare yoktur (kabuk kuralı 7).
 * 3. **Sabit sütunlar `w-px` ile ÇİVİLENİR.** Aksi hâlde artan yer bütün
 *    sütunlara oransal dağılıyor ve "0063" taşıyan İş No sütunu 1920px'te
 *    114px'e şişip yeri Proje'den çalıyordu. `w-px` içeriğin altına inemez,
 *    yani sütun en dar hâline oturur ve artan yer esnek sütunlara kalır.
 *
 * EN DAR KAP HER KIRILIMDA AYNI DEĞİL — `lg`, `md`den DARDIR. Kenar çubuğu
 * (15rem + 14px omurga) tam 1024px'te belirir:
 *     375px  → kap 351px   (4 sütun)
 *     768px  → kap 736px   (6 sütun — kenar çubuğu YOK)
 *     1024px → kap 703px   (6 sütun — kenar çubuğu belirdi, kap DARALDI)
 *     1280px → kap 962px   (8 sütun)
 * Müşteri ve Vinç Tipi bu yüzden `lg`de değil `xl`de açılır: 1024px'te sekiz
 * sütunun yalnız başlıkları 674px tutuyor, veriye 29px kalıyordu.
 */
const AD_KELEPCE = "max-w-[15rem]";
const MUSTERI_KELEPCE = "max-w-[10rem]";
const VINC_KELEPCE = "max-w-[6rem]";
/** İçeriği sabit boydaki sütun: en dar hâline çivilenir, artan yeri almaz. */
const CIVI = "w-px";

function SortHead({
  label, sortKey, active, dir, onSort, className,
}: {
  label: string;
  sortKey: ProjectListSortKey;
  active: boolean;
  dir: "asc" | "desc";
  onSort: (key: ProjectListSortKey) => void;
  className?: string;
}) {
  const Icon = !active ? ChevronsUpDown : dir === "asc" ? ChevronUp : ChevronDown;
  return (
    <TableHead
      className={className}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      {/* Düğme hücrenin TAMAMINI kaplar — yalnız yazı yüksekliğinde (~21px)
          olduğu sürece parmakla sıralama değiştirmek neredeyse imkânsızdı. */}
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "-mx-2 flex h-10 w-full items-center gap-1 rounded px-2 transition-colors hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        <Icon className={cn("size-3 shrink-0", !active && "opacity-40")} />
      </button>
    </TableHead>
  );
}

export function ProjectsTable({
  projects,
  jobs,
  customerOptions = [],
  canDelete,
  basePath = "/projects",
  reportContext = ENGINEERING_REPORT_CONTEXT,
  groupByJob = reportContext === ENGINEERING_REPORT_CONTEXT,
  showJobColumn = reportContext !== OFFER_REPORT_CONTEXT,
  jobGroupBasePath = "/projects/jobs",
  defaultSort = { key: "doc_no", dir: "desc" },
}: {
  projects: ProjectRow[];
  jobs: JobOption[];
  customerOptions?: CustomerOption[];
  canDelete: boolean;
  basePath?: string;
  reportContext?: ReportContext;
  /** Ana Mühendislik defterinde aynı işin birden çok dokümanını tek satıra katlar. */
  groupByJob?: boolean;
  /** İşin iç sayfasında iş numarası tekrarını gizlemek için. */
  showJobColumn?: boolean;
  /** Geliştirme önizlemesi gerçek iç sayfaya gitmeden aynı gezinmeyi sınayabilir. */
  jobGroupBasePath?: string;
  defaultSort?: { key: ProjectListSortKey; dir: "asc" | "desc" };
}) {
  const [year, setYear] = useState(ALL);
  const [customer, setCustomer] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(defaultSort);

  const entries = useMemo(
    () => buildProjectListEntries(projects, groupByJob),
    [projects, groupByJob]
  );

  const years = useMemo(() => {
    const set = new Set(projects.map(projectYear).filter(Boolean));
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [projects]);

  const customers = useMemo(() => {
    const set = new Set(projects.map((p) => p.customer.trim()).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, "tr"));
  }, [projects]);

  function toggleSort(key: ProjectListSortKey) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : {
            key,
            dir:
              key === "name" || key === "customer" || key === "crane_type" || key === "status"
                ? "asc"
                : "desc",
          }
    );
  }

  const filtered = useMemo(() => {
    const rows = entries.filter((entry) =>
      projectEntryMatches(entry, {
        year: year === ALL ? undefined : year,
        customer: customer === ALL ? undefined : customer,
        status:
          status === ACTIVE ? ACTIVE : status === ARCHIVED ? ARCHIVED : undefined,
        query,
      })
    );
    const sign = sort.dir === "asc" ? 1 : -1;
    return rows.sort((a, b) => {
      const va = projectEntrySortValue(a, sort.key);
      const vb = projectEntrySortValue(b, sort.key);
      const c =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "tr", { numeric: true });
      return sign * c;
    });
  }, [entries, year, customer, status, query, sort]);

  const filteredDocumentCount = filtered.reduce(
    (sum, entry) => sum + entry.projects.length,
    0
  );

  const activeFilters =
    (year !== ALL ? 1 : 0) + (customer !== ALL ? 1 : 0) + (status !== ALL ? 1 : 0) +
    (query.trim() ? 1 : 0);

  function clearFilters() {
    setYear(ALL);
    setCustomer(ALL);
    setStatus(ALL);
    setQuery("");
  }

  return (
    <div className="grid gap-3">
      {/* Hızlı filtreler — İşler listesindeki şeridin aynısı; sabit genişlikli
          tetikleyiciler telefonda yan yana sığmadığı için mobilde ikişerli
          ızgaraya girerler. */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2">
        <span className="oc-kicker mr-1 hidden text-muted-foreground sm:inline">Filtre</span>

        <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:items-center">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger size="sm" className="w-full sm:w-[120px]">
              <SelectValue placeholder="Yıl" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tüm Yıllar</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={customer} onValueChange={setCustomer}>
            <SelectTrigger size="sm" className="w-full sm:w-[200px]">
              <SelectValue placeholder="Müşteri" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tüm Müşteriler</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger size="sm" className="w-full sm:w-[150px]">
              <SelectValue placeholder="Durum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tüm Durumlar</SelectItem>
              <SelectItem value={ACTIVE}>Aktif</SelectItem>
              <SelectItem value={ARCHIVED}>Arşiv</SelectItem>
            </SelectContent>
          </Select>

          {/* Kart görünümünde tablo başlığı gizlenir; sıralama işlevi de
              kaybolmasın diye telefon için doğrudan erişilen bir seçim. */}
          <Select
            value={`${sort.key}:${sort.dir}`}
            onValueChange={(value) => {
              const [key, dir] = value.split(":") as [
                ProjectListSortKey,
                "asc" | "desc",
              ];
              setSort({ key, dir });
            }}
          >
            <SelectTrigger size="sm" className="w-full md:hidden" aria-label="Projeleri sırala">
              <SelectValue placeholder="Sırala" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="doc_no:desc">Doküman No · Yeni</SelectItem>
              <SelectItem value="doc_no:asc">Doküman No · Eski</SelectItem>
              <SelectItem value="name:asc">Proje Adı · A-Z</SelectItem>
              <SelectItem value="customer:asc">Müşteri · A-Z</SelectItem>
              <SelectItem value="rev:desc">Son Revizyon</SelectItem>
              <SelectItem value="status:asc">Durum</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="İş No, Proje Adı, Doküman No veya Müşteri Ara…"
          className="h-10 w-full flex-1 sm:h-8 sm:w-auto sm:min-w-[220px] sm:pointer-coarse:h-10"
        />

        <div className="flex w-full items-center justify-between gap-2 sm:w-auto">
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {filtered.length} / {entries.length} kayıt
            {groupByJob ? ` · ${filteredDocumentCount} / ${projects.length} doküman` : ""}
          </span>
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={clearFilters}>
              <X className="size-3.5" /> Temizle
            </Button>
          )}
        </div>
      </div>

      {/* Telefonda her proje kendi kartına katlanır; proje adı artık dört dar
          sütun arasına sıkışmaz. Masaüstünde aynı işaretleme tablo ve yapışkan
          başlık olarak çalışmayı sürdürür. */}
      <Table
        containerClassName="oc-mobile-table-wrap oc-tablet-table-wrap oc-table-clamp rounded-lg border bg-card [--oc-scroll-bg:var(--card)]"
        className="oc-mobile-table oc-tablet-table oc-compact-mobile-table oc-engineering-projects-table"
      >
          <TableHeader className="oc-sticky-head">
            {/* SÜTUN ÖNCELİKLENDİRME — sekiz sütunluk satır telefonda kabın
                (~341px) bir buçuk katıydı ve sağdaki Durum/İşlem hiç
                görünmüyordu; sekizi 1024px'e sığdırmak da mümkün değil (bkz.
                yukarıdaki kelepçe notu). Sütunlar ekran büyüdükçe açılır:
                  <md  Doküman No · Proje · Durum · İşlem
                  md   + İş No · Son Revizyon
                  xl   + Müşteri · Vinç Tipi
                Henüz açılmamış olanların kritikleri proje adının ALTINDA
                durur (aşağıdaki ikinci satır); kart markup'ı çoğaltılmaz. */}
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <SortHead label="İş No" sortKey="job_no" className={cn(CIVI, "hidden", showJobColumn && "md:table-cell")}
                active={sort.key === "job_no"} dir={sort.dir} onSort={toggleSort} />
              {/* Telefonda İKİ SATIRA SARAR: "Doküman No" tek satırdayken
                  sütunun tabanını 115px'e çekiyordu ve o 21px doğrudan proje
                  adından çalınıyordu (veri "0063-00", yani 78px yeterli). */}
              <SortHead label="Doküman No" sortKey="doc_no" className={cn(CIVI, "max-sm:whitespace-normal")}
                active={sort.key === "doc_no"} dir={sort.dir} onSort={toggleSort} />
              {/* Proje ÇİVİLENMEZ: artan yerin çoğunu alması gereken sütun bu. */}
              <SortHead label="Proje" sortKey="name" className={AD_KELEPCE}
                active={sort.key === "name"} dir={sort.dir} onSort={toggleSort} />
              <SortHead label="Müşteri" sortKey="customer"
                className={cn(MUSTERI_KELEPCE, "hidden xl:table-cell")}
                active={sort.key === "customer"} dir={sort.dir} onSort={toggleSort} />
              <SortHead label="Vinç Tipi" sortKey="crane_type"
                className={cn(VINC_KELEPCE, "hidden xl:table-cell")}
                active={sort.key === "crane_type"} dir={sort.dir} onSort={toggleSort} />
              <SortHead label="Son Revizyon" sortKey="rev" className={cn(CIVI, "hidden md:table-cell")}
                active={sort.key === "rev"} dir={sort.dir} onSort={toggleSort} />
              <SortHead label="Durum" sortKey="status" className={CIVI}
                active={sort.key === "status"} dir={sort.dir} onSort={toggleSort} />
              <TableHead className="w-12 text-right">İşlem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={8}
                  data-mobile-span="full"
                  data-mobile-hide-label
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Süzgeçlere uyan kayıt yok — bir filtreyi temizleyip tekrar deneyin.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((entry) => {
                const p = entry.projects[0];
                if (!p) return null;
                const grouped = entry.kind === "job";
                const name = projectEntryName(entry);
                const customerName = projectEntryCustomer(entry);
                const jobNo = projectEntryJobNo(entry);
                const docLabel = projectEntryDocLabel(entry);
                const revisionLabel = projectEntryRevisionLabel(entry);
                const fullStatusLabel = projectEntryStatusLabel(entry);
                const archived = projectEntryIsArchived(entry);
                const craneTypes = projectEntryCraneTypes(entry);
                const craneLabel = projectEntryCraneLabel(entry);
                const targetHref = grouped
                  ? `${jobGroupBasePath}/${entry.jobId}`
                  : `${basePath}/${p.id}`;
                // Mühendislik kendi defterinde kalır: çok dokümanlı iş satırı
                // yalnız Mühendislikteki iç doküman tablosuna açılır. Tek
                // dokümanlı satırın iş numarası İşler detayına geçiş vermez;
                // satırın kendisi hesap raporu projesine açılmaya devam eder.
                const jobHref = grouped ? targetHref : null;

                return (
                <TableRow
                  key={entry.key}
                  data-project-group={grouped || undefined}
                  className={cn(
                    "relative cursor-pointer",
                    grouped && "bg-muted/20 hover:bg-muted/45"
                  )}
                >
                  <TableCell
                    data-label="İş No"
                    className={cn(
                      CIVI,
                      "hidden font-mono text-sm text-muted-foreground",
                      showJobColumn && "md:table-cell"
                    )}
                  >
                    {jobNo && jobHref ? (
                      // Dokunma hedefi `.oc-tap` ile 44px'e tamamlanır, KUTU
                      // büyümez (kabuk kuralı 1). Eskiden `min-h-9` idi ve o
                      // 36px'i her satıra taşıyıp satır boyunu tek başına
                      // 53px'te tutuyordu — kullanıcının "satır yüksekliği bu
                      // kadar büyümesin" dediği yerin bir parçası.
                      <Link
                        href={jobHref}
                        className="oc-tap relative z-10 text-primary hover:underline"
                      >
                        {jobNo}
                      </Link>
                    ) : jobNo ? (
                      <span className="text-primary">{jobNo}</span>
                    ) : (
                      <span className="text-muted-foreground/60">bağımsız</span>
                    )}
                  </TableCell>
                  <TableCell
                    data-label="Doküman No"
                    data-mobile-doc
                    data-mobile-hide-label
                    className={cn(
                      CIVI,
                      "text-sm font-medium text-primary",
                      !grouped && "font-mono"
                    )}
                  >
                    <Link href={targetHref} className="after:absolute after:inset-0">
                      {grouped ? (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap font-sans text-xs">
                          <Files className="size-3.5" />
                          {docLabel}
                        </span>
                      ) : (
                        docLabel
                      )}
                    </Link>
                  </TableCell>
                  {/* Kelepçe HÜCREDEDİR, kırpma İÇTEKİ BLOKTA: hücre yer varken
                      büyümeye devam eder, blok da o genişliğin tamamını kullanır
                      (kelepçeyi bloğa yazsaydık geniş ekranda ad boş yerin
                      ortasında erkenden kesilirdi). `whitespace-normal` hücrede
                      kalır — `TableCell` varsayılanı `nowrap`tır ve alttaki
                      bilgi satırı telefonda sarmak zorundadır (kabuk kuralı 15). */}
                  <TableCell
                    data-label="Proje"
                    data-mobile-span="full"
                    data-mobile-primary
                    data-mobile-hide-label
                    className={cn(
                      AD_KELEPCE,
                      // `max-sm:[overflow-wrap:anywhere]` — kabuk kuralı 15'in
                      // ölçülmüş tuzağı: `break-words` (`break-word`) bir
                      // sütunun MIN-CONTENT genişliğini KÜÇÜLTMEZ, yalnız
                      // `anywhere` küçültür. O olmadan 375px'te tablo en uzun
                      // KELİME kadar yer istiyor ve kap 46px taşıyordu.
                      "font-medium whitespace-normal max-sm:[overflow-wrap:anywhere]"
                    )}
                  >
                    {/* `break-words` MİRASI EZER: kelepçe hücrede olsa da bu
                        span kendi `overflow-wrap: break-word`ünü kurar ve
                        `anywhere` etkisiz kalır (375px'te 9px taşma olarak
                        ölçüldü) — kural bu yüzden AYNI öğede tekrarlanır. */}
                    <span
                      className="block break-words max-sm:[overflow-wrap:anywhere] md:truncate"
                      title={name}
                    >
                      {name}
                    </span>
                    {/* Henüz açılmamış sütunların kritik olanları — kart
                        markup'ı çoğaltmadan, aynı hücrenin ikinci satırı.
                        Müşteri `xl`e kadar BURADADIR, iş no ve revizyon
                        `md`ye kadar. */}
                    <div
                      className="mt-0.5 text-[11px] font-normal text-muted-foreground md:truncate xl:hidden"
                      title={
                        grouped
                          ? `${customerName} · ${entry.projects.length} doküman · ${revisionLabel} · ${fullStatusLabel}`
                          : customerName
                      }
                    >
                      {/* İş no BURADA DA BAĞLANTIDIR: sütunu gizlemek bilgiyi
                          korur ama iş emrine geçişi telefonda tümüyle
                          kaybettiriyordu. `relative z-10` satırın tamamını
                          kaplayan proje bağlantısının üstünde kalmasını
                          sağlar (aksi hâlde dokunuş projeye giderdi). */}
                      {showJobColumn && jobNo && jobHref ? (
                        <span className="lg:hidden">
                          <Link
                            href={jobHref}
                            className="relative z-10 font-mono text-primary hover:underline"
                          >
                            {jobNo}
                          </Link>
                          {" · "}
                        </span>
                      ) : null}
                      {customerName}
                      <span className="lg:hidden">
                        {grouped
                          ? ` · ${entry.projects.length} doküman · ${revisionLabel} · ${fullStatusLabel}`
                          : `${
                              p.lastRevNo !== null
                                ? ` · V${p.lastRevNo} ${revisionStatusLabel(p.lastRevStatus ?? "")}`
                                : ""
                            } · ${archived ? "Arşiv" : "Aktif"}`}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell
                    data-label="Müşteri"
                    className={cn(MUSTERI_KELEPCE, "hidden truncate text-muted-foreground xl:table-cell")}
                    title={customerName}
                  >
                    {customerName}
                  </TableCell>
                  <TableCell
                    data-label="Vinç Tipi"
                    className={cn(VINC_KELEPCE, "hidden truncate text-sm text-muted-foreground xl:table-cell")}
                    title={craneTypes.join(" · ")}
                  >
                    {craneLabel}
                  </TableCell>
                  <TableCell data-label="Son Revizyon" className={cn(CIVI, "hidden md:table-cell")}>
                    {grouped ? (
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {revisionLabel}
                      </span>
                    ) : p.lastRevNo !== null ? (
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <span className="font-mono">V{p.lastRevNo}</span>
                        <Badge variant={revisionStatusVariant(p.lastRevStatus ?? "")}>
                          {revisionStatusLabel(p.lastRevStatus ?? "")}
                        </Badge>
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell data-label="Durum" data-mobile-status data-mobile-hide-label data-mobile-hidden className={CIVI}>
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <span
                        className={cn(
                          "size-2 shrink-0",
                          archived ? "bg-muted-foreground/40" : "bg-success"
                        )}
                      />
                      <span title={grouped ? fullStatusLabel : undefined}>
                        {archived ? "Arşiv" : "Aktif"}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell data-label="İşlem" data-mobile-actions data-mobile-hide-label className="text-right">
                    {grouped ? (
                      <Link
                        href={targetHref}
                        aria-label={`${jobNo || "İş"} dokümanlarını aç`}
                        title="İşin dokümanlarını aç"
                        className="oc-tap-square relative z-10 ml-auto grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <ChevronRight className="size-4" />
                      </Link>
                    ) : (
                      <ProjectRowActions
                        project={{
                          id: p.id,
                          doc_no: p.doc_no,
                          name: p.name,
                          customer: p.customer,
                          crane_type: p.crane_type,
                          crane_location: p.crane_location,
                          report_brand_customer_id: p.report_brand_customer_id,
                          end_customer_id: p.end_customer_id,
                          job_id: p.job_id,
                          job_no: p.job_no,
                          hasIssuedRevision: p.hasIssuedRevision,
                        }}
                        jobs={jobs}
                        customers={customerOptions}
                        canDelete={canDelete}
                        reportContext={reportContext}
                      />
                    )}
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
      </Table>
    </div>
  );
}
