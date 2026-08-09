"use client";

// İşler listesi — hızlı filtreler + satır eylemleri.
//
// Süzme SUNUCUDA DEĞİL burada yapılır: iş sayısı onlarla ölçülür, tamamı tek
// istekte gelir ve filtre değiştikçe sayfa yeniden yüklenmez. Yıl filtresi
// varsayılan olarak İÇİNDE BULUNULAN YILA gelir — günlük kullanımda aranan
// hemen her iş bu yılındır; geçmiş yıllar tek tıkla açılır.

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDown, ChevronUp, ChevronsUpDown, FileDown, MoreHorizontal, Pencil, Trash2, X,
} from "lucide-react";
import { deleteJob } from "./actions";
import { JobStatusMenu } from "./job-status-menu";
import { JOB_STATUSES, JOB_STATUS_LABELS, jobStatusOf } from "@/lib/job-status";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CustomerTag } from "@/components/tags";
import { customerTag } from "@/lib/tags";
import { cn } from "@/lib/utils";

export interface JobRow {
  id: string;
  job_no: string;
  title: string;
  /** İş emrindeki resmî unvan (basıldığı andaki fotoğraf) */
  customer: string;
  /** Müşteri defterindeki kısaltma — listelerde bu görünür */
  customerShort?: string | null;
  /** Müşteri defterindeki renk (OKLCH ton açısı) */
  customerHue?: number | null;
  status: string;
  work_order_date: string | null;
  created_at: string;
  itemCount: number;
  craneCount: number;
}

/** "Tümü" seçeneği — Select bileşeni boş string değere izin vermez. */
const ALL = "__all__";

/** İşin ait olduğu yıl: iş emri tarihi varsa o, yoksa kayıt tarihi. */
export function jobYear(job: Pick<JobRow, "work_order_date" | "created_at">): string {
  const src = job.work_order_date || job.created_at;
  return /^(\d{4})/.exec(src ?? "")?.[1] ?? "";
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

// ---------------------------------------------------------------- sıralama

type SortKey = "job_no" | "title" | "customer" | "itemCount" | "craneCount" | "date" | "status";

/**
 * Sıralama anahtarları. Sayısal alanlar SAYI, metinler tr-TR sıralamasıyla
 * karşılaştırılır ("İ" ve "ı" doğru yere düşsün diye `localeCompare`).
 *
 * Varsayılan İŞ NO AZALANDIR: iş numarası kronolojik artar, dolayısıyla en
 * büyük numara en yeni iştir ve listenin başında olmalıdır.
 */
const SORT_VALUE: Record<SortKey, (j: JobRow) => string | number> = {
  job_no: (j) => j.job_no,
  title: (j) => j.title,
  // Sıralama GÖRÜNEN ada göredir: sütun kısaltmayı gösterirken tam unvana göre
  // sıralamak listeyi rastgele sıralanmış gibi gösterirdi.
  customer: (j) => customerTag({ name: j.customer, shortName: j.customerShort }).short,
  itemCount: (j) => j.itemCount,
  craneCount: (j) => j.craneCount,
  date: (j) => j.work_order_date || j.created_at,
  status: (j) => JOB_STATUS_LABELS[jobStatusOf(j.status)] ?? j.status,
};

function compareJobs(a: JobRow, b: JobRow, key: SortKey): number {
  const va = SORT_VALUE[key](a);
  const vb = SORT_VALUE[key](b);
  if (typeof va === "number" && typeof vb === "number") return va - vb;
  return String(va).localeCompare(String(vb), "tr", { numeric: true });
}

function SortHead({
  label,
  sortKey,
  active,
  dir,
  onSort,
  className,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  active: boolean;
  dir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  className?: string;
  align?: "left" | "right";
}) {
  const Icon = !active ? ChevronsUpDown : dir === "asc" ? ChevronUp : ChevronDown;
  return (
    <TableHead
      className={className}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "-mx-1 flex w-full items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-foreground",
          align === "right" && "justify-end",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        <Icon className={cn("size-3 shrink-0", !active && "opacity-40")} />
      </button>
    </TableHead>
  );
}

function DeleteJobDialog({
  job,
  open,
  onOpenChange,
}: {
  job: JobRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteJob(job.id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("İş emri silindi.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>İş Emrini Sil</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{job.job_no}</span> — {job.title} iş emri
            ve {job.itemCount} iş kalemi kalıcı olarak silinecek.
            {job.craneCount > 0 && (
              <>
                {" "}
                Bu işe bağlı {job.craneCount} hesap raporu SİLİNMEZ; bağımsız
                rapor olarak kalır.
              </>
            )}{" "}
            Bu işlem geri alınamaz.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={pending}>
            {pending ? "Siliniyor…" : "Kalıcı Olarak Sil"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function JobRowActions({ job, canDelete }: { job: JobRow; canDelete: boolean }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="relative z-10 flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="size-8 p-0">
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Satır Eylemleri</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
          <DropdownMenuItem asChild>
            <Link href={`/jobs/${job.id}/edit`}>
              <Pencil className="size-3.5" /> Düzenle
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={`/jobs/${job.id}/work-order`}>
              <FileDown className="size-3.5" /> İş Emri PDF
            </a>
          </DropdownMenuItem>
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
                <Trash2 className="size-3.5" /> Sil
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {confirming && canDelete && (
        <DeleteJobDialog job={job} open onOpenChange={(o) => !o && setConfirming(false)} />
      )}
    </div>
  );
}

export function JobsTable({
  jobs,
  canDelete,
}: {
  jobs: JobRow[];
  canDelete: boolean;
}) {
  const years = useMemo(() => {
    const set = new Set(jobs.map(jobYear).filter(Boolean));
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [jobs]);

  // Süzgeç DEĞERİ tam unvandır (iş satırındaki alanla eşleşmesi gerekir),
  // ETİKETİ kısaltmadır.
  const customers = useMemo(() => {
    const byName = new Map<string, JobRow>();
    for (const j of jobs) {
      const name = j.customer.trim();
      if (name && !byName.has(name)) byName.set(name, j);
    }
    return [...byName.entries()]
      .map(([name, j]) => ({ name, short: j.customerShort, hue: j.customerHue }))
      .sort((a, b) =>
        customerTag({ name: a.name, shortName: a.short }).short.localeCompare(
          customerTag({ name: b.name, shortName: b.short }).short,
          "tr"
        )
      );
  }, [jobs]);

  // Varsayılan yıl: içinde bulunduğumuz yıl — ama o yılda hiç iş yoksa filtre
  // boş bir liste göstermek yerine "Tümü"ne düşer.
  const thisYear = String(new Date().getFullYear());
  const [year, setYear] = useState(() => (years.includes(thisYear) ? thisYear : ALL));
  const [customer, setCustomer] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "job_no",
    dir: "desc",
  });

  /**
   * Başlığa tıklama: aynı sütunsa yön döner, başka sütunsa o sütunun DOĞAL
   * yönüyle başlar — numara/tarih/sayı alanlarında büyükten küçüğe, metinde
   * A'dan Z'ye. Her sütunda "önce artan" davranışı tarih listelerinde ters
   * hissettiriyordu.
   */
  function toggleSort(key: SortKey) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "title" || key === "customer" || key === "status" ? "asc" : "desc" }
    );
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    const rows = jobs.filter((j) => {
      if (year !== ALL && jobYear(j) !== year) return false;
      if (customer !== ALL && j.customer.trim() !== customer) return false;
      if (status !== ALL && jobStatusOf(j.status) !== status) return false;
      // Arama hem kısaltmayı hem tam unvanı tarar: kullanıcı ekranda gördüğü
      // "İSDEMİR"i de, defterdeki resmî adı da yazabilmelidir.
      const haystack = [j.job_no, j.title, j.customer, j.customerShort ?? ""].join(" ");
      if (q && !haystack.toLocaleLowerCase("tr").includes(q)) return false;
      return true;
    });
    const sign = sort.dir === "asc" ? 1 : -1;
    return rows.sort((a, b) => sign * compareJobs(a, b, sort.key));
  }, [jobs, year, customer, status, query, sort]);

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
      {/* Hızlı filtreler */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2">
        <span className="oc-kicker mr-1 text-muted-foreground">Filtre</span>

        <Select value={year} onValueChange={setYear}>
          <SelectTrigger size="sm" className="w-[120px]">
            <SelectValue placeholder="Yıl" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tüm yıllar</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={customer} onValueChange={setCustomer}>
          <SelectTrigger size="sm" className="w-[190px]">
            <SelectValue placeholder="Müşteri" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tüm müşteriler</SelectItem>
            {customers.map((c) => (
              <SelectItem key={c.name} value={c.name}>
                <CustomerTag name={c.name} shortName={c.short} hue={c.hue} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger size="sm" className="w-[150px]">
            <SelectValue placeholder="Durum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tüm durumlar</SelectItem>
            {JOB_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{JOB_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="İş no, ad veya müşteri ara…"
          className="h-8 w-full flex-1 sm:w-auto sm:min-w-[200px]"
        />

        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {filtered.length} / {jobs.length}
        </span>
        {activeFilters > 0 && (
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={clearFilters}>
            <X className="size-3.5" /> Temizle
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {(
                [
                  { label: "İş No", key: "job_no", className: "w-[7rem]" },
                  { label: "İşin Adı", key: "title" },
                  // Kısaltma sütunu artık dar: kazanılan yer "İşin Adı"na gider.
                  { label: "Müşteri", key: "customer", className: "w-[11rem]" },
                  { label: "Kalem", key: "itemCount", className: "w-[5.5rem]" },
                  { label: "Rapor", key: "craneCount", className: "w-[5.5rem]" },
                  { label: "Tarih", key: "date", className: "w-[7.5rem]" },
                  { label: "Durum", key: "status", className: "w-[10rem]" },
                ] as const
              ).map((c) => (
                <SortHead
                  key={c.key}
                  label={c.label}
                  sortKey={c.key}
                  className={"className" in c ? c.className : undefined}
                  active={sort.key === c.key}
                  dir={sort.dir}
                  onSort={toggleSort}
                />
              ))}
              <TableHead className="w-12 text-right">İşlem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  Süzgeçlere uyan iş yok — bir filtreyi temizleyip tekrar deneyin.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((j) => (
                <TableRow key={j.id} className="relative cursor-pointer">
                  <TableCell className="font-mono text-sm font-medium text-primary">
                    <Link href={`/jobs/${j.id}`} className="after:absolute after:inset-0">
                      {j.job_no}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{j.title}</TableCell>
                  <TableCell>
                    {/* Satırın tamamı bir link (after:absolute inset-0); etiket
                        onun ÜSTÜNDE kalmalı ki başlık (tam unvan) okunabilsin. */}
                    <span className="relative z-10">
                      <CustomerTag
                        name={j.customer}
                        shortName={j.customerShort}
                        hue={j.customerHue}
                      />
                    </span>
                  </TableCell>
                  <TableCell className="font-mono tabular-nums">{j.itemCount}</TableCell>
                  <TableCell
                    className={cn(
                      "font-mono tabular-nums",
                      j.craneCount === 0 && "text-muted-foreground/60"
                    )}
                  >
                    {j.craneCount}
                  </TableCell>
                  <TableCell className="font-mono text-sm tabular-nums text-muted-foreground">
                    {fmtDate(j.work_order_date || j.created_at)}
                  </TableCell>
                  <TableCell>
                    <JobStatusMenu jobId={j.id} status={j.status} />
                  </TableCell>
                  <TableCell>
                    <JobRowActions job={j} canDelete={canDelete} />
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
