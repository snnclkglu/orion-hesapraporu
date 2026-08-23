// BAĞLANTILAR — işin öteki modüllerdeki izleri tek sayfada.
//
// Teknik resim, atölye saati, sipariş ve ticari kayıt zaten bu işe bağlı
// duruyordu (FK'ler ilk günden vardı) ama iş detayı hiçbirini göstermiyordu;
// kullanıcı panodan arayarak geziniyordu. Bu sayfa sayaç + derin bağlantı
// verir — defter satırı düzeni (kart ızgarası değil, panel kuralı).
//
// YETKİ İKİ KEZ SORULUR: rolün görmediği bölüm 0 olarak ÇİZİLMEZ
// (`hub-data.ts` null döndürür, satır hiç basılmaz).

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fmtJobDate } from "@/lib/jobs/filter";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { loadJobBaglari, type JobItemRef } from "../../hub-data";

function BagSatiri({
  href,
  title,
  count,
  hint,
}: {
  href: string;
  title: string;
  count: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <span className="shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
        {count}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
    </Link>
  );
}

export default async function JobBaglantilarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: job }, { data: profile }, { data: items }] = await Promise.all([
    supabase.from("jobs").select("id, job_no").eq("id", id).single(),
    user
      ? supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("job_items")
      .select("id, item_no, product_name")
      .eq("job_id", id)
      .order("sort", { ascending: true }),
  ]);
  if (!job) notFound();

  const itemRefs = (items ?? []) as JobItemRef[];
  const baglar = await loadJobBaglari(supabase, {
    jobId: id,
    role: (profile as { role?: string } | null)?.role,
    items: itemRefs,
  });

  return (
    <div className="grid gap-4">
      <div className="divide-y border bg-card">
        <BagSatiri
          href="/drawings"
          title="Teknik Resimler"
          hint="Bu işe bağlanmış teslim paketleri"
          count={`${baglar.drawings} paket`}
        />
        {baglar.worklog !== null && (
          <BagSatiri
            href="/worklog/records"
            title="İş Takibi"
            hint="Atölyenin bu işe yazdığı çalışma kayıtları"
            count={`${baglar.worklog} kayıt`}
          />
        )}
        {baglar.purchasing !== null && (
          <BagSatiri
            href="/purchasing/siparisler"
            title="Satın Alma"
            hint="Kalem numarasıyla eşleşen sipariş satırları"
            count={`${baglar.purchasing} sipariş kalemi`}
          />
        )}
      </div>

      {baglar.purchasing !== null && (
        <p className="text-xs text-muted-foreground">
          Sipariş satırları kalem numarasıyla eşleştirilir; kalem numarası
          taşımayan siparişler (ör. plaka siparişi) bu sayıya girmez.
        </p>
      )}

      {/* Ticari tarihler — yalnız Satış'ı gören rollere (RLS + rol sorusu). */}
      {baglar.sales !== null && (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2">
            <span className="text-sm font-semibold">Termin ve Sevk</span>
            <Link
              href="/sales"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Satış Takibi →
            </Link>
          </div>
          {baglar.sales.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              Bu işte kalem yok — termin ve sevk kalem başına izlenir.
            </p>
          ) : (
            <Table className="oc-mobile-table" containerClassName="oc-mobile-table-wrap">
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-[8.5rem]">İş Kalemi No</TableHead>
                  <TableHead>Ürün Adı</TableHead>
                  <TableHead className="w-[7.5rem]">Termin</TableHead>
                  <TableHead className="w-[7.5rem]">Sevk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {baglar.sales.map((s) => (
                  <TableRow key={s.itemNo + s.productName}>
                    <TableCell data-label="İş Kalemi No" className="font-mono text-sm text-primary">
                      {s.itemNo || "—"}
                    </TableCell>
                    <TableCell data-label="Ürün Adı" data-mobile-span="full" className="font-medium break-words whitespace-normal">
                      {s.productName}
                    </TableCell>
                    <TableCell data-label="Termin" className="font-mono text-sm tabular-nums">
                      {fmtJobDate(s.dueDate)}
                    </TableCell>
                    <TableCell data-label="Sevk" className="font-mono text-sm tabular-nums">
                      {fmtJobDate(s.shipmentDate)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}
