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
import { ChevronDown, ChevronUp, ChevronsUpDown, X } from "lucide-react";
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
import type { JobOption } from "./new-project-dialog";
import { cn } from "@/lib/utils";

export interface ProjectRow {
  id: string;
  doc_no: string;
  name: string;
  customer: string;
  crane_type: string;
  /** projects.status — "active" | "archived" */
  status: string;
  created_at: string;
  job_id: string | null;
  job_no: string | null;
  lastRevNo: number | null;
  lastRevStatus: string | null;
  hasIssuedRevision: boolean;
}

/** "Tümü" seçeneği — Select bileşeni boş string değere izin vermez. */
const ALL = "__all__";
const ACTIVE = "active";
const ARCHIVED = "archived";

/** Projenin yılı — kayıt tarihinden. */
export function projectYear(p: Pick<ProjectRow, "created_at">): string {
  return /^(\d{4})/.exec(p.created_at ?? "")?.[1] ?? "";
}

type SortKey = "job_no" | "doc_no" | "name" | "customer" | "crane_type" | "rev" | "status";

const SORT_VALUE: Record<SortKey, (p: ProjectRow) => string | number> = {
  job_no: (p) => p.job_no ?? "",
  doc_no: (p) => p.doc_no,
  name: (p) => p.name,
  customer: (p) => p.customer,
  crane_type: (p) => p.crane_type,
  rev: (p) => p.lastRevNo ?? -1,
  status: (p) => (p.status === ARCHIVED ? "Arşiv" : "Aktif"),
};

function SortHead({
  label, sortKey, active, dir, onSort, className,
}: {
  label: string;
  sortKey: SortKey;
  active: boolean;
  dir: "asc" | "desc";
  onSort: (key: SortKey) => void;
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
  canDelete,
}: {
  projects: ProjectRow[];
  jobs: JobOption[];
  canDelete: boolean;
}) {
  const [year, setYear] = useState(ALL);
  const [customer, setCustomer] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "doc_no",
    dir: "desc",
  });

  const years = useMemo(() => {
    const set = new Set(projects.map(projectYear).filter(Boolean));
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [projects]);

  const customers = useMemo(() => {
    const set = new Set(projects.map((p) => p.customer.trim()).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, "tr"));
  }, [projects]);

  function toggleSort(key: SortKey) {
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
    const q = query.trim().toLocaleLowerCase("tr");
    const rows = projects.filter((p) => {
      if (year !== ALL && projectYear(p) !== year) return false;
      if (customer !== ALL && p.customer.trim() !== customer) return false;
      if (status === ACTIVE && p.status === ARCHIVED) return false;
      if (status === ARCHIVED && p.status !== ARCHIVED) return false;
      // Arama PROJE ADINI, doküman noyu, müşteriyi, iş noyu ve vinç tipini
      // birlikte tarar: kullanıcı ekranda hangisini görüyorsa onu yazar.
      const hay = [p.name, p.doc_no, p.customer, p.job_no ?? "", p.crane_type].join(" ");
      if (q && !hay.toLocaleLowerCase("tr").includes(q)) return false;
      return true;
    });
    const sign = sort.dir === "asc" ? 1 : -1;
    return rows.sort((a, b) => {
      const va = SORT_VALUE[sort.key](a);
      const vb = SORT_VALUE[sort.key](b);
      const c =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "tr", { numeric: true });
      return sign * c;
    });
  }, [projects, year, customer, status, query, sort]);

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

        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
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
            <SelectTrigger size="sm" className="col-span-2 w-full sm:w-[150px]">
              <SelectValue placeholder="Durum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tüm Durumlar</SelectItem>
              <SelectItem value={ACTIVE}>Aktif</SelectItem>
              <SelectItem value={ARCHIVED}>Arşiv</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Proje Adı, Doküman No veya Müşteri Ara…"
          className="h-10 w-full flex-1 sm:h-8 sm:w-auto sm:min-w-[220px] sm:pointer-coarse:h-10"
        />

        <div className="flex w-full items-center justify-between gap-2 sm:w-auto">
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {filtered.length} / {projects.length}
          </span>
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={clearFilters}>
              <X className="size-3.5" /> Temizle
            </Button>
          )}
        </div>
      </div>

      {/* Proje listesi yıllarla BÜYÜR: `oc-table-clamp` + `oc-sticky-head`
          uzun listede başlığı tepede tutar (md üstü). Kap `.oc-scrollx`tır —
          telefonda katlama sayesinde kaymaz ama tablet ara genişlikleri hâlâ
          taşabilir (kabuk kuralı 8/15). */}
      <div className="oc-scrollx oc-table-clamp rounded-lg border bg-card [--oc-scroll-bg:var(--card)]">
        <Table>
          <TableHeader className="oc-sticky-head">
            {/* SÜTUN ÖNCELİKLENDİRME — sekiz sütunluk satır telefonda kabın
                (~341px) bir buçuk katıydı ve sağdaki Durum/İşlem hiç
                görünmüyordu. Mobilde yalnız Doküman No · Proje · Durum ·
                İşlem kalır; gizlenenlerin kritik olanları proje adının altına
                iner (aşağıdaki md:hidden satır). */}
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <SortHead label="İş No" sortKey="job_no" className="hidden md:table-cell"
                active={sort.key === "job_no"} dir={sort.dir} onSort={toggleSort} />
              <SortHead label="Doküman No" sortKey="doc_no"
                active={sort.key === "doc_no"} dir={sort.dir} onSort={toggleSort} />
              <SortHead label="Proje" sortKey="name"
                active={sort.key === "name"} dir={sort.dir} onSort={toggleSort} />
              <SortHead label="Müşteri" sortKey="customer" className="hidden md:table-cell"
                active={sort.key === "customer"} dir={sort.dir} onSort={toggleSort} />
              <SortHead label="Vinç Tipi" sortKey="crane_type" className="hidden lg:table-cell"
                active={sort.key === "crane_type"} dir={sort.dir} onSort={toggleSort} />
              <SortHead label="Son Revizyon" sortKey="rev" className="hidden md:table-cell"
                active={sort.key === "rev"} dir={sort.dir} onSort={toggleSort} />
              <SortHead label="Durum" sortKey="status"
                active={sort.key === "status"} dir={sort.dir} onSort={toggleSort} />
              <TableHead className="w-12 text-right">İşlem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  Süzgeçlere uyan proje yok — bir filtreyi temizleyip tekrar deneyin.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id} className="relative cursor-pointer">
                  <TableCell className="hidden font-mono text-sm text-muted-foreground md:table-cell">
                    {p.job_no && p.job_id ? (
                      <Link
                        href={`/jobs/${p.job_id}`}
                        className="relative z-10 inline-flex min-h-9 items-center text-primary hover:underline pointer-coarse:min-h-10"
                      >
                        {p.job_no}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground/60">bağımsız</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm font-medium text-primary">
                    <Link href={`/projects/${p.id}`} className="after:absolute after:inset-0">
                      {p.doc_no}
                    </Link>
                  </TableCell>
                  {/* `break-words`: proje adı veriden gelir; boşluksuz uzun bir
                      jeton telefonda hücreyi kendi genişliğine çekmesin. */}
                  <TableCell className="font-medium break-words whitespace-normal">
                    {p.name}
                    {/* Mobilde gizlenen sütunların kritik olanları — kart
                        markup'ı çoğaltmadan, aynı hücrenin ikinci satırı. */}
                    <div className="mt-0.5 text-[11px] font-normal whitespace-normal text-muted-foreground md:hidden">
                      {/* İş no BURADA DA BAĞLANTIDIR: sütunu gizlemek bilgiyi
                          korur ama iş emrine geçişi telefonda tümüyle
                          kaybettiriyordu. `relative z-10` satırın tamamını
                          kaplayan proje bağlantısının üstünde kalmasını
                          sağlar (aksi hâlde dokunuş projeye giderdi). */}
                      {p.job_no && p.job_id ? (
                        <>
                          <Link
                            href={`/jobs/${p.job_id}`}
                            className="relative z-10 font-mono text-primary hover:underline"
                          >
                            {p.job_no}
                          </Link>
                          {" · "}
                        </>
                      ) : null}
                      {p.customer}
                      {p.lastRevNo !== null
                        ? ` · V${p.lastRevNo} ${revisionStatusLabel(p.lastRevStatus ?? "")}`
                        : ""}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {p.customer}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                    {p.crane_type}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {p.lastRevNo !== null ? (
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
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <span
                        className={cn(
                          "size-2",
                          p.status === ARCHIVED ? "bg-muted-foreground/40" : "bg-success"
                        )}
                      />
                      {p.status === ARCHIVED ? "Arşiv" : "Aktif"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <ProjectRowActions
                      project={{
                        id: p.id,
                        doc_no: p.doc_no,
                        name: p.name,
                        customer: p.customer,
                        crane_type: p.crane_type,
                        job_id: p.job_id,
                        job_no: p.job_no,
                        hasIssuedRevision: p.hasIssuedRevision,
                      }}
                      jobs={jobs}
                      canDelete={canDelete}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
