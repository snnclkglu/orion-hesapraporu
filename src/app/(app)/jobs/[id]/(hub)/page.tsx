// GENEL BAKIŞ — iş hub'ının ilk sekmesi.
//
// Kimlik, durum ve eylemler `(hub)/layout.tsx`tedir; bu sayfa işin GÖVDESİNİ
// basar: kalemler + resim çarpanı + müşteri/iş bilgileri + notlar + kaleme
// bağlanmamış raporlar. Hesap raporu İŞE değil İŞ KALEMİNE bağlanır (IS-14).

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { revisionStatusLabel, revisionStatusVariant } from "@/lib/revision-status";
import { fmtJobDate } from "@/lib/jobs/filter";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { DrawingQtyCard } from "../drawing-qty-card";

const SCOPE_LABELS: [string, string][] = [
  ["proje", "Proje"], ["devreyeAlma", "Devreye Alma"], ["malzeme", "Malzeme"],
  ["nakliye", "Nakliye"], ["imalat", "İmalat"], ["montaj", "Montaj"],
];

function KV({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: string | null;
  mono?: boolean; // tarih/sayı gibi teknik değerler mono dizilir
}) {
  return (
    // 128px'lik sabit etiket sütunu telefonda değere yalnız ~180px bırakıyor,
    // adres gibi uzun alanlar okunmaz hâle geliyordu: mobilde etiket üstte,
    // değer altta; `sm`den itibaren eski iki sütunlu düzen.
    <div className="grid grid-cols-1 gap-0.5 border-b py-1.5 last:border-0 sm:flex sm:gap-2 sm:py-1">
      <span className="text-xs text-muted-foreground sm:w-32 sm:shrink-0">{label}</span>
      <span className={cn("min-w-0 break-words", mono ? "font-mono text-sm tabular-nums" : "text-sm")}>
        {value && String(value).trim() ? value : "—"}
      </span>
    </div>
  );
}

/**
 * İş kalemi satırının okunan yüzü.
 *
 * `qty` / `shares_drawings_with` İSTEĞE BAĞLIDIR: sorgu iki denemede okunur ve
 * migration uygulanmadan önce o iki alan hiç gelmez (bkz. aşağıdaki not).
 */
interface ItemRow {
  id: string;
  item_no: string;
  product_name: string;
  quantity: string;
  project_id: string | null;
  projects: LinkedReport | LinkedReport[] | null;
  qty?: number | null;
  shares_drawings_with?: string | null;
}

/** Kaleme bağlı hesap raporunun özeti (son revizyon rozetiyle) */
interface LinkedReport {
  id: string;
  doc_no: string;
  name: string;
  status: string;
  revisions?: { rev_no: number; status: string }[] | null;
}

function ReportCell({ report }: { report: LinkedReport | null }) {
  if (!report) {
    return (
      <span className="text-xs text-muted-foreground/70">
        Rapor bağlı değil
      </span>
    );
  }
  const lastRev = [...(report.revisions ?? [])].sort((a, b) => b.rev_no - a.rev_no)[0];
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Link
        href={`/projects/${report.id}`}
        className="font-mono text-sm font-medium text-primary hover:underline"
      >
        {report.doc_no}
      </Link>
      {lastRev && (
        // 10px içerik metni için fazla küçük — 11px taban.
        <Badge variant={revisionStatusVariant(lastRev.status)} className="text-[11px]">
          V{lastRev.rev_no} · {revisionStatusLabel(lastRev.status)}
        </Badge>
      )}
    </span>
  );
}

export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: job } = await supabase.from("jobs").select("*").eq("id", id).single();
  if (!job) notFound();

  // RESİM ÇARPANI SÜTUNLARI İKİ DENEMEDE OKUNUR (`due_at` kalıbının aynısı):
  // `qty` ve `shares_drawings_with` 20260812 migration'ıyla geliyor. Onlar
  // olmadan sorgunun tamamı düşerdi ve iş detayı hiç açılmazdı — bir sütunun
  // eksikliği yüzünden sayfayı kaybetmek, eksikliğin kendisinden pahalıdır.
  const ITEM_FIELDS =
    "id, item_no, product_name, quantity, project_id, " +
    "projects:project_id(id, doc_no, name, status, revisions(rev_no, status))";
  const carpanSorgusu = supabase
    .from("job_items")
    .select(`${ITEM_FIELDS}, qty, shares_drawings_with`)
    .eq("job_id", id)
    .order("sort", { ascending: true });

  // İki sorgunun DÖNÜŞ TİPİ farklıdır (biri iki sütun fazla taşır) ve
  // supabase-js onları birleştiremez; sonuç elle daraltılır. Kaçış kapısı
  // DEĞİL, iki şeklin ortak paydası: `ItemRow` alanların hepsini isteğe bağlı
  // tutar ve okuma yerleri zaten `?? ""` ile korunuyor.
  const [{ data: rawItems }, { data: cranes }] = await Promise.all([
    carpanSorgusu.then(async (r) =>
      r.error
        ? await supabase
            .from("job_items")
            .select(ITEM_FIELDS)
            .eq("job_id", id)
            .order("sort", { ascending: true })
        : r
    ),
    supabase
      .from("projects")
      .select("id, doc_no, name, crane_type, status, created_at, revisions(rev_no, status)")
      .eq("job_id", id)
      .order("doc_no", { ascending: true }),
  ]);

  const itemList = (rawItems ?? []) as unknown as ItemRow[];
  const carpanHazir = itemList.length === 0 || "qty" in itemList[0];
  const carpanKalemleri = itemList.map((it) => ({
    id: String(it.id ?? ""),
    itemNo: String(it.item_no ?? ""),
    productName: String(it.product_name ?? ""),
    quantityText: String(it.quantity ?? ""),
    qty: it.qty == null ? null : Number(it.qty),
    sharesWith: it.shares_drawings_with ?? null,
  }));
  const linkedProjectIds = new Set(
    itemList.map((it) => it.project_id).filter((v): v is string => Boolean(v))
  );
  // Kaleme bağlanmamış raporlar (eski kayıtlar ya da doğrudan işe bağlananlar)
  const unlinked = (cranes ?? []).filter((p) => !linkedProjectIds.has(p.id));
  const scope = (job.scope ?? {}) as Record<string, boolean>;
  const activeScopes = SCOPE_LABELS.filter(([k]) => scope[k]).map(([, l]) => l);

  return (
    <div className="grid gap-6">
      {/* İş kalemleri — her kalem kendi hesap raporunu taşır */}
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2">
          <span className="text-sm font-semibold">İş Kalemleri</span>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {itemList.length} kalem · {linkedProjectIds.size} rapor bağlı
          </span>
        </div>
        {itemList.length === 0 ? (
          <div
            className="flex flex-col items-center gap-2 px-4 py-8 text-center"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, var(--muted) 0 10px, transparent 10px 20px)",
            }}
          >
            <span className="border bg-background px-3 py-1.5 font-mono text-xs font-medium tracking-[0.15em]">
              [ KALEM YOK ]
            </span>
            <p className="bg-card px-3 py-1 text-sm text-foreground/70">
              Kalem yok. &quot;Düzenle&quot; ile ürün/iş no ekleyin.
            </p>
          </div>
        ) : (
          /* SÜTUN ÖNCELİKLENDİRME — beş sütun telefonda tabloyu taşırıyordu.
             Sıra numarası ve adet gizlenir (adet "Ürün Adı"nın altına iner);
             mobilde İş Kalemi No · Ürün Adı · Hesap Raporu kalır.
             Yüzde genişlikler `table-layout: auto` altında nowrap içerik
             karşısında etkisizdi; mutlak değere çevrildi. */
          <Table className="oc-mobile-table" containerClassName="oc-mobile-table-wrap">
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="hidden w-10 sm:table-cell">#</TableHead>
                <TableHead className="w-[8.5rem]">İş Kalemi No</TableHead>
                <TableHead>Ürün Adı</TableHead>
                <TableHead className="hidden w-[5rem] md:table-cell">Adet</TableHead>
                <TableHead className="sm:w-[16rem]">Hesap Raporu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemList.map((it, i) => (
                <TableRow key={i}>
                  <TableCell data-label="Sıra" className="hidden font-mono tabular-nums text-muted-foreground sm:table-cell">{i + 1}</TableCell>
                  <TableCell data-label="İş Kalemi No" className="font-mono text-sm text-primary">{it.item_no || "—"}</TableCell>
                  {/* `break-words`: ürün adı veriden gelir; boşluksuz uzun bir
                      jeton telefonda hücreyi kendi genişliğine çekmesin. */}
                  <TableCell data-label="Ürün Adı" data-mobile-span="full" className="font-medium break-words whitespace-normal">
                    {it.product_name}
                    {/* Gizlenen adet sütununun mobil karşılığı. Alan serbest
                        metindir ("3", "3 Adet", "Muhtelif"); değerin sonuna
                        birim EKLENMEZ, etiket öne konur. */}
                    <div className="mt-0.5 text-[11px] font-normal text-muted-foreground md:hidden">
                      Adet: <span className="font-mono tabular-nums">{it.quantity || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell data-label="Adet" className="hidden font-mono tabular-nums md:table-cell">{it.quantity || "—"}</TableCell>
                  <TableCell data-label="Hesap Raporu" data-mobile-span="full">
                    <ReportCell
                      report={(it.projects as unknown as LinkedReport | null) ?? null}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="border-t px-4 py-2 text-xs text-muted-foreground">
          Hesap raporu iş kalemine bağlanır. Bağlamak için Mühendislik bölümünde
          raporun satır menüsünden &quot;İşe Bağla&quot; ile bu işi ve kalemi seçin.
        </p>
      </div>

      {/* Resim çarpanı — teknik resim ve satın alma adetlerinin kaynağı.
          İş kalemleri tablosunun HEMEN ALTINDA: aynı satırların başka bir
          sorusudur ve iki tabloyu ayırmak kullanıcıyı sayfada gezdirirdi. */}
      <DrawingQtyCard jobId={id} kalemler={carpanKalemleri} hazir={carpanHazir} />

      {/* Müşteri + iş bilgileri */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">Müşteri Bilgileri</h2>
          <KV label="Adı" value={job.customer} />
          <KV label="Adresi" value={job.customer_address} />
          <KV label="Vergi Dairesi" value={job.customer_tax_office} />
          <KV label="Vergi No" value={job.customer_tax_no} mono />
          <KV label="Telefon" value={job.customer_phone} mono />
          <KV label="Faks" value={job.customer_fax} mono />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">İş Bilgileri</h2>
          <KV label="Sözleşme" value={job.contract_exists ? "VAR" : "YOK"} />
          <KV label="Sözleşme Tarihi" value={fmtJobDate(job.contract_date)} mono />
          <KV label="Atölye Çıkış" value={fmtJobDate(job.workshop_exit_date)} mono />
          <KV label="Teslim Tarihi" value={fmtJobDate(job.delivery_date)} mono />
          <KV label="Adet" value={job.quantity_text} />
          <KV label="İş Lideri" value={job.job_leader} />
          <KV label="Proje Yöneticisi" value={job.project_manager} />
          {/* Sevk/montaj adresi müşteri künyesindeki fatura adresinden ayrıdır
              (bkz. jobs/schema.ts) — bu yüzden "İş Bilgileri" kutusundadır. */}
          <KV label="Sevk Adresi" value={job.shipping_address} />
          <KV label="Montaj Adresi" value={job.assembly_address} />
          {/* SÖZLEŞME DOSYASI BURADA GÖSTERİLMEZ (18.08.2026): bu sayfayı
              herkes görür, sözleşmeyi ise yalnız Yönetici ve Müdür. Belge
              Satış Takibi'ndeki kalem satırından açılır. */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {activeScopes.length > 0 ? (
              activeScopes.map((sLabel) => (
                <Badge key={sLabel} variant="secondary" className="text-[11px]">{sLabel}</Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">Kapsam seçilmedi</span>
            )}
          </div>
        </div>
      </div>

      {(job.notes || job.prepared_by_name) && (
        <div className="rounded-lg border bg-card p-4 text-sm">
          {job.notes && <p className="whitespace-pre-line text-muted-foreground">{job.notes}</p>}
          {job.prepared_by_name && (
            <p className="mt-2 text-xs text-muted-foreground">
              Hazırlayan: <span className="font-medium text-foreground">{job.prepared_by_name}</span>
              {job.prepared_by_title ? ` — ${job.prepared_by_title}` : ""}
            </p>
          )}
        </div>
      )}

      {/* Kaleme bağlanmamış raporlar — eski kayıtlarda ya da kalem açılmadan
          bağlanan raporlarda görünür; kaleme taşınması için hatırlatıcıdır. */}
      {unlinked.length > 0 && (
        <div>
          <h2 className="mb-1 text-lg font-semibold tracking-tight">
            Kaleme Bağlanmamış Hesap Raporları
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Bu raporlar işe bağlı ama bir iş kalemine atanmamış. Mühendislik
            bölümündeki &quot;İşe Bağla&quot; ile kalem seçerek eşleştirin.
          </p>
          {/* SÜTUN ÖNCELİKLENDİRME — vinç tipi ve son revizyon telefonda
              gizlenir, ikisi de "Vinç" hücresinin altına ikinci satır olarak
              iner; mobilde Doküman No · Vinç · Durum kalır. */}
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table className="oc-mobile-table" containerClassName="oc-mobile-table-wrap">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Doküman No</TableHead>
                  <TableHead>Vinç</TableHead>
                  <TableHead className="hidden md:table-cell">Vinç Tipi</TableHead>
                  <TableHead className="hidden md:table-cell">Son Revizyon</TableHead>
                  <TableHead>Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unlinked.map((p) => {
                  const lastRev = [...(p.revisions ?? [])].sort((a, b) => b.rev_no - a.rev_no)[0];
                  return (
                    <TableRow key={p.id} className="relative cursor-pointer">
                      <TableCell data-label="Doküman No" className="font-mono text-sm font-medium text-primary">
                        <Link href={`/projects/${p.id}`} className="after:absolute after:inset-0">
                          {p.doc_no}
                        </Link>
                      </TableCell>
                      <TableCell data-label="Vinç" data-mobile-span="full" className="font-medium break-words whitespace-normal">
                        {p.name}
                        <div className="mt-0.5 text-[11px] font-normal text-muted-foreground md:hidden">
                          {p.crane_type}
                          {lastRev ? ` · V${lastRev.rev_no} ${revisionStatusLabel(lastRev.status)}` : ""}
                        </div>
                      </TableCell>
                      <TableCell data-label="Vinç Tipi" className="hidden text-sm text-muted-foreground md:table-cell">{p.crane_type}</TableCell>
                      <TableCell data-label="Son Revizyon" className="hidden md:table-cell">
                        {lastRev ? (
                          <span className="inline-flex items-center gap-1.5 text-sm">
                            <span className="font-mono">V{lastRev.rev_no}</span>
                            <Badge variant={revisionStatusVariant(lastRev.status)}>
                              {revisionStatusLabel(lastRev.status)}
                            </Badge>
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell data-label="Durum">
                        {/* Marka kuralı: köşe yuvarlaklığı sıfır — aynı işlevi
                            gören durum noktaları uygulamanın her yerinde kare. */}
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <span className={cn("size-2 shrink-0", p.status === "active" ? "bg-success" : "bg-muted-foreground/40")} />
                          {p.status === "active" ? "Aktif" : "Arşiv"}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
