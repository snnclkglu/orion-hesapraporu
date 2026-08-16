import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { JobForm, EMPTY_JOB } from "../job-form";
import { loadJobFormData } from "../form-data";
import type { JobInput } from "../schema";

// İŞ KOPYALAMA (kullanıcı onayı, 16.08.2026): `?kaynak=<id>` verilirse form o
// işin kalemleri, kapsamı ve müşteri bilgileriyle DOLU açılır — tekrarlayan
// müşteri siparişinde formu sıfırdan doldurmak biter.
//
// KOPYALANMAYANLAR bilinçlidir:
// · İş no BOŞ kalır — yeni kimliği kullanıcı verir; kalem numaraları da ondan
//   türeyeceği için kalemlerin `item_no`su boş bırakılır (otomatik anahtar
//   yeni numaradan üretir).
// · Tarihler (iş emri · sözleşme · atölye çıkış · teslim) KOPYALANMAZ:
//   tekrarlayan siparişte değişen şey tam da onlardır ve eski tarihi sessizce
//   taşımak yanlış termin yazdırmanın en kısa yoludur.
// · Sözleşme PDF'i kopyalanmaz — o belge ESKİ işin sözleşmesidir.

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ kaynak?: string }>;
}) {
  const { kaynak } = await searchParams;
  const { customers, people } = await loadJobFormData();

  let initial: JobInput = EMPTY_JOB;
  let kaynakNo: string | null = null;

  if (kaynak) {
    const supabase = await createClient();
    const [{ data: src }, { data: srcItems }] = await Promise.all([
      supabase.from("jobs").select("*").eq("id", kaynak).maybeSingle(),
      supabase
        .from("job_items")
        .select("item_no, product_name, quantity")
        .eq("job_id", kaynak)
        .order("sort", { ascending: true }),
    ]);
    if (src) {
      kaynakNo = String(src.job_no ?? "");
      initial = {
        ...EMPTY_JOB,
        title: src.title ?? "",
        customer: src.customer ?? "",
        customer_id: src.customer_id ?? null,
        customer_address: src.customer_address ?? "",
        customer_tax_office: src.customer_tax_office ?? "",
        customer_tax_no: src.customer_tax_no ?? "",
        customer_phone: src.customer_phone ?? "",
        customer_fax: src.customer_fax ?? "",
        contract_exists: Boolean(src.contract_exists),
        quantity_text: src.quantity_text ?? "",
        job_leader: src.job_leader ?? "",
        prepared_by_name: src.prepared_by_name ?? "",
        prepared_by_title: src.prepared_by_title ?? "",
        scope: {
          ...EMPTY_JOB.scope,
          ...((src.scope ?? {}) as Partial<JobInput["scope"]>),
        },
        notes: src.notes ?? "",
        items: (srcItems ?? []).map((it) => ({
          item_no: "",
          product_name: it.product_name ?? "",
          quantity: it.quantity ?? "",
        })),
      };
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-4">
        {/* Geri bağlantısı yalnız yazı yüksekliğindeydi (~20px); tıklama alanı
            asgari 36px'e (dokunmatikte 40px) yayılır, negatif kenar boşluğu
            eklenen iç boşluğu hizada tutar. */}
        <Link href="/jobs" className="-ml-1 inline-flex min-h-9 items-center gap-1 px-1 text-sm text-muted-foreground hover:text-foreground pointer-coarse:min-h-10">
          <ChevronLeft className="size-4" /> İşler
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Yeni İş Emri</h1>
        <p className="text-sm text-muted-foreground">
          {kaynakNo ? (
            <>
              <span className="font-mono">{kaynakNo}</span> kopyalandı — iş no ve
              tarihler boş bırakıldı; kontrol edip yenilerini verin.
            </>
          ) : (
            "FR.11.02 iş emri formu — müşteri, iş kalemleri, kapsam ve teslim bilgileri."
          )}
        </p>
      </div>
      <JobForm mode="create" initial={initial} customers={customers} people={people} />
    </div>
  );
}
