"use client";

// İşler listesi — süzgeç durumu ADRESTE, süzme İSTEMCİDE.
//
// Süzme SUNUCUDA DEĞİL burada yapılır: iş sayısı onlarla ölçülür, tamamı tek
// istekte gelir ve filtre değiştikçe sayfa yeniden yüklenmez. Süzgeç KURALI
// ise bu dosyada değildir — `lib/jobs/filter.ts` ekran ile Excel indirme
// ucunun ORTAK çekirdeğidir (İş Takibi dersi: iki yazım sessizce ayrışır).
//
// Durum adreste taşınır (adres-suzgec kalıbı, `history.replaceState`):
// filtrelenmiş görünümün bağlantısı paylaşılabilir ve yenilemede kaybolmaz.
// ARAMA YAZIMI ANINDA SÜZER, adrese 350 ms gecikmeyle yazar — bellek süzmesi
// ucuzdur ve geciktirmek yazmayı hantal gösterirdi; geciktirilen yalnız
// adres yazımıdır.
//
// TELEFONDA ANA TABLO YATAY KAYMAZ (dokunmatik MOBIL-15): `sm` altında İş No
// sütunu birincil hücrenin İLK SATIRINA katlanır, müşteri · tarih · sayaçlar
// alt satıra iner; kalan üç sütun (birincil + durum + işlem) 375px'e sığar.
// Kart markup'ı ÇOĞALTILMAZ — aynı hücre, kırılıma göre satır kazanır.

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Copy, FileDown, MoreHorizontal, Pencil, Star, Trash2 } from "lucide-react";
import { bulkSetJobStatus, deleteJob } from "./actions";
import { bulkSetFavorite, toggleJobFavorite } from "./favorite-actions";
import {
  JOB_STATUSES,
  JOB_STATUS_LABELS,
  type JobStatus,
} from "@/lib/job-status";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JobStatusMenu } from "./job-status-menu";
import {
  fmtJobDate,
  naturalDesc,
  sortJobs,
  type JobListRow,
} from "@/lib/jobs/filter";
import {
  readJobsViewState,
  serializeJobSort,
  type JobSortKey,
} from "@/lib/jobs/view-state";
import { adreseYaz } from "@/app/(app)/purchasing/adres-suzgec";
import { SortableHead } from "@/app/(app)/drawings/sortable-head";
import { Button } from "@/components/ui/button";
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
  DropdownMenuSeparator,
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
import { customerTag } from "@/lib/tags";
import { cn } from "@/lib/utils";

export interface JobRow extends JobListRow {
  id: string;
  /** Müşteri defterindeki renk (OKLCH ton açısı). */
  customerHue?: number | null;
  /** Bu kullanıcının favorisi mi (kişiye özel yıldız). */
  favori?: boolean;
  /** Panonun "İş Lideri" gruplaması için (serbest metin alan). */
  jobLeader?: string | null;
  /** Takvim ve zaman çizelgesi için iş-tarihleri. */
  workshopExitDate?: string | null;
  deliveryDate?: string | null;
}

/**
 * Sütun tanımı TEK dizidedir: başlık, hücre ve boş-durum `colSpan`ı hep
 * buradan türer (hammadde tablosunun dersi — elle sayılan sütun kayar).
 * "İşlem" sütunu sıralanamaz, dizide değildir; `colSpan` onu +1 ile sayar.
 */
const SUTUNLAR: readonly {
  key: JobSortKey;
  label: string;
  className?: string;
}[] = [
  // İş No `sm` altında kendi sütununu bırakır, birincil hücreye katlanır.
  { key: "job_no", label: "İş No", className: "hidden w-[7rem] sm:table-cell" },
  { key: "title", label: "İşin Adı" },
  // Kısaltma sütunu dar: kazanılan yer "İşin Adı"na gider.
  { key: "customer", label: "Müşteri", className: "hidden w-[11rem] md:table-cell" },
  { key: "itemCount", label: "Kalem", className: "hidden w-[5.5rem] lg:table-cell" },
  { key: "craneCount", label: "Rapor", className: "hidden w-[5.5rem] lg:table-cell" },
  { key: "date", label: "Tarih", className: "hidden w-[7.5rem] md:table-cell" },
  { key: "status", label: "Durum", className: "md:w-[10rem]" },
];

// +2: soldaki seçim kutusu ve sağdaki "İşlem" sütunu dizide değildir.
const TOPLAM_SUTUN = SUTUNLAR.length + 2;

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
  const [, startTransition] = useTransition();
  const router = useRouter();

  function favoriDegistir() {
    startTransition(async () => {
      const res = await toggleJobFavorite(job.id, !job.favori);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="relative z-10 flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {/* `icon-sm` boyu dokunmatikte kendiliğinden 44px'e tamamlanır; elle
              yazılan `size-8` bu payı eziyor ve ıskalanan dokunuş satır
              bağlantısına düşüyordu. */}
          <Button variant="ghost" size="icon-sm">
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
          <DropdownMenuItem asChild>
            {/* Kopya form kalemler + kapsam + müşteriyle dolu açılır; iş no ve
                tarihler boş kalır (yeni kimliği ve terminleri kullanıcı verir). */}
            <Link href={`/jobs/new?kaynak=${job.id}`}>
              <Copy className="size-3.5" /> Kopyala
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={favoriDegistir}>
            <Star
              className={cn(
                "size-3.5",
                job.favori && "fill-amber-400 text-amber-500"
              )}
            />
            {job.favori ? "Favorilerden Çıkar" : "Favorilere Ekle"}
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
  rows,
  canDelete,
}: {
  /** SÜZÜLMÜŞ satırlar — süzgeç şeridi görünüm kabuğundadır (jobs-views). */
  rows: JobRow[];
  canDelete: boolean;
}) {
  const params = useSearchParams();
  const state = useMemo(() => readJobsViewState(params), [params]);
  const router = useRouter();

  const sorted = useMemo(() => sortJobs(rows, state.sirala), [rows, state.sirala]);

  // ÇOKLU SEÇİM (kullanıcı onayı, 16.08.2026): kutular `sm` üstünde görünür —
  // telefonda birincil sütun daralamaz (MOBIL-15) ve toplu işlem masaüstü/tablet
  // işidir. Seçim SÜZGEÇTEN BAĞIMSIZ yaşar ama "tümünü seç" yalnız GÖRÜNEN
  // satırları alır; süzgeç değişince görünmeyen seçimler bar sayacında kalır.
  const [secili, setSecili] = useState<ReadonlySet<string>>(new Set());
  const [topluDurum, setTopluDurum] = useState<JobStatus>("active");
  const [topluPending, startTopluTransition] = useTransition();

  function seciliDegistir(id: string) {
    setSecili((s) => {
      const y = new Set(s);
      if (y.has(id)) y.delete(id);
      else y.add(id);
      return y;
    });
  }
  const tumSecili = sorted.length > 0 && sorted.every((j) => secili.has(j.id));
  function tumunuDegistir() {
    setSecili(tumSecili ? new Set() : new Set(sorted.map((j) => j.id)));
  }

  function topluCalistir(
    fn: () => Promise<{ error?: string }>,
    basari: string
  ) {
    startTopluTransition(async () => {
      const res = await fn();
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(basari);
      setSecili(new Set());
      router.refresh();
    });
  }

  /**
   * Başlığa tıklama: aynı sütunsa yön döner, başka sütunsa DOĞAL yönüyle
   * başlar. Varsayılana dönen sıralama adresten SİLİNİR (temiz adres kuralı).
   */
  function toggleSort(key: JobSortKey) {
    const desc = state.sirala.key === key ? !state.sirala.desc : naturalDesc(key);
    adreseYaz({ sirala: serializeJobSort({ key, desc }) });
  }

  return (
    <>
      {/* BÜYÜYEN DEFTER TABLOSU: kap `oc-table-clamp` ile 70dvh'ye kelepçelenir
          ve başlık satırı yapışır (`oc-sticky-head`, yalnız `md` üstü). */}
      <div className="oc-table-clamp rounded-lg border bg-card">
        <Table>
          <TableHeader className="oc-sticky-head">
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="hidden w-8 sm:table-cell">
                <input
                  type="checkbox"
                  aria-label="Görünen işlerin tümünü seç"
                  checked={tumSecili}
                  onChange={tumunuDegistir}
                  className="size-4 align-middle accent-primary"
                />
              </TableHead>
              {SUTUNLAR.map((c) => (
                <SortableHead
                  key={c.key}
                  sortKey={c.key}
                  current={state.sirala.key}
                  desc={state.sirala.desc}
                  onSort={toggleSort}
                  className={c.className}
                >
                  {c.label}
                </SortableHead>
              ))}
              <TableHead className="w-12 text-right">İşlem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={TOPLAM_SUTUN}
                  className="py-10 text-center text-sm whitespace-normal text-muted-foreground"
                >
                  Süzgeçlere uyan iş yok — bir filtreyi temizleyip tekrar deneyin.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((j) => (
                <TableRow key={j.id} className="relative cursor-pointer">
                  <TableCell className="hidden sm:table-cell">
                    {/* Satır bağlantı katmanının ÜSTÜNDE kalmalı (z-10). */}
                    <input
                      type="checkbox"
                      aria-label={`${j.job_no} seç`}
                      checked={secili.has(j.id)}
                      onChange={() => seciliDegistir(j.id)}
                      className="relative z-10 size-4 align-middle accent-primary"
                    />
                  </TableCell>
                  <TableCell className="hidden font-mono text-sm font-medium text-primary sm:table-cell">
                    <span className="inline-flex items-center gap-1">
                      {j.favori && (
                        <Star
                          className="size-3 shrink-0 fill-amber-400 text-amber-500"
                          aria-label="Favori"
                        />
                      )}
                      {j.job_no}
                    </span>
                  </TableCell>
                  {/* Birincil hücre: satır bağlantısı BURADADIR (after:inset-0
                      katmanı bütün satırı kaplar). `whitespace-normal` nowrap
                      varsayılanını ezer; `max-sm:[overflow-wrap:anywhere]`
                      boşluksuz uzun bir jetonun tabloyu itmesini keser
                      (MOBIL-15'in ölçülmüş CSS tuzağı). */}
                  <TableCell className="font-medium break-words whitespace-normal max-sm:[overflow-wrap:anywhere]">
                    <div className="font-mono text-[13px] font-medium text-primary sm:hidden">
                      {j.job_no}
                    </div>
                    <Link href={`/jobs/${j.id}`} className="after:absolute after:inset-0">
                      {j.title}
                    </Link>
                    {/* Gizlenen sütunların mobil karşılığı — kart markup'ı
                        çoğaltılmadan tek kaynaktan. Sayaçlar yalnız telefonda
                        (`sm` altı) yazılır; `lg`de kendi sütunları döner. */}
                    <div className="mt-0.5 font-normal text-[11px] text-muted-foreground md:hidden">
                      {customerTag({ name: j.customer, shortName: j.customerShort }).short}
                      {" · "}
                      {fmtJobDate(j.work_order_date || j.created_at)}
                      <span className="sm:hidden">
                        {" · "}
                        {j.itemCount} kalem · {j.craneCount} rapor
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {/* Satırın tamamı bir bağlantı; etiket onun ÜSTÜNDE kalmalı
                        ki başlık (tam unvan) okunabilsin. */}
                    <span className="relative z-10">
                      <CustomerTag
                        name={j.customer}
                        shortName={j.customerShort}
                        hue={j.customerHue}
                      />
                    </span>
                  </TableCell>
                  <TableCell className="hidden font-mono tabular-nums lg:table-cell">
                    {j.itemCount}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "hidden font-mono tabular-nums lg:table-cell",
                      j.craneCount === 0 && "text-muted-foreground/60"
                    )}
                  >
                    {j.craneCount}
                  </TableCell>
                  <TableCell className="hidden font-mono text-sm tabular-nums text-muted-foreground md:table-cell">
                    {fmtJobDate(j.work_order_date || j.created_at)}
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

      {/* TOPLU İŞLEM BARI — seçim varken listenin dibinde yapışır
          (demand-table kalıbı). `env(safe-area-inset-bottom)`: iOS ana ekran
          kısayolunda alt gösterge çubuğu barın düğmelerini yiyordu. */}
      {secili.size > 0 && (
        <div
          className="sticky bottom-2 z-20 hidden flex-wrap items-center gap-2 border bg-card p-2 shadow-lg sm:flex"
          style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        >
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {secili.size} iş seçili
          </span>
          <Select
            value={topluDurum}
            onValueChange={(v) => setTopluDurum(v as JobStatus)}
          >
            <SelectTrigger size="sm" className="h-9 w-[9rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {JOB_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {JOB_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            className="h-9"
            disabled={topluPending}
            onClick={() =>
              topluCalistir(
                () => bulkSetJobStatus([...secili], topluDurum),
                "Durumlar güncellendi."
              )
            }
          >
            Durumu Uygula
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            disabled={topluPending}
            onClick={() =>
              topluCalistir(
                () => bulkSetFavorite([...secili], true),
                "Favorilere eklendi."
              )
            }
          >
            <Star className="size-3.5" /> Favorilere Ekle
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            disabled={topluPending}
            onClick={() =>
              topluCalistir(
                () => bulkSetFavorite([...secili], false),
                "Favorilerden çıkarıldı."
              )
            }
          >
            Favoriden Çıkar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-9"
            onClick={() => setSecili(new Set())}
          >
            Temizle
          </Button>
        </div>
      )}
    </>
  );
}
