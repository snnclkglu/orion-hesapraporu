import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { sonrakiIsNo } from "@/lib/jobs/is-emri";
import { canEditJobs } from "@/lib/roles";
import { JobForm } from "../job-form";
import { loadJobFormData } from "../form-data";
// EMPTY_JOB `schema.ts`tendir, job-form'dan DEĞİL: bu bir sunucu bileşenidir ve
// bir istemci modülünün dışa aktarımını YAYAMAZ (bkz. schema.ts'teki not).
import { EMPTY_JOB, type JobInput } from "../schema";

// İŞ KOPYALAMA (kullanıcı onayı, 16.08.2026): `?kaynak=<id>` verilirse form o
// işin kalemleri, kapsamı ve müşteri bilgileriyle DOLU açılır — tekrarlayan
// müşteri siparişinde formu sıfırdan doldurmak biter.
//
// KOPYALANMAYANLAR bilinçlidir:
// · İş no kaynaktan kopyalanmaz — defterdeki son numaranın bir fazlası ÖNERİLİR
//   (`sonrakiIsNo`, kullanıcı isteği 18.08.2026) ve kullanıcı değiştirebilir;
//   kalemlerin `item_no`su boş bırakılır (otomatik anahtar yeni numaradan üretir).
// · Tarihler (iş emri · sözleşme · atölye çıkış · teslim) KOPYALANMAZ:
//   tekrarlayan siparişte değişen şey tam da onlardır ve eski tarihi sessizce
//   taşımak yanlış termin yazdırmanın en kısa yoludur.
// · Sözleşme PDF'i kopyalanmaz — o belge ESKİ işin sözleşmesidir.


/**
 * FORM SAYFASI YAZMA YETKİSİ İSTER (canEditJobs, 18.08.2026).
 *
 * Sessizce `/jobs`a yönlendirmek YERİNE sayfa NEDENİ SÖYLER: adres elle
 * yazılmış ya da eski bir yer iminden gelinmiş olabilir ve boş bir yönlendirme
 * kullanıcıya "bağlantı bozuk" dedirtirdi. Asıl engel yine RLS'tir; bu ekran
 * yalnız kapıyı görünür kılar.
 */
function YetkiYok({ geriHref, geriEtiket }: { geriHref: string; geriEtiket: string }) {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <Link
        href={geriHref}
        className="-ml-1 inline-flex min-h-9 items-center gap-1 px-1 text-sm text-muted-foreground hover:text-foreground pointer-coarse:min-h-10"
      >
        <ChevronLeft className="size-4" /> {geriEtiket}
      </Link>
      <div className="mt-3 border bg-card p-6">
        <h1 className="text-lg font-semibold tracking-tight">Yetki yok</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          İş emri açma ve düzenleme yetkisi yalnız Yönetici ve Müdürdedir. İş
          emrini görüntüleyebilir, PDF olarak indirebilir, görev ve yorum
          ekleyebilirsiniz.
        </p>
      </div>
    </div>
  );
}

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ kaynak?: string }>;
}) {
  const { kaynak } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profil } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  if (!canEditJobs((profil as { role?: string } | null)?.role)) {
    return <YetkiYok geriHref="/jobs" geriEtiket="İşler" />;
  }
  const [{ customers, people }, { data: mevcutNolar }] = await Promise.all([
    loadJobFormData(),
    // ÖNERİ SUNUCUDA HESAPLANIR: numara defterin TAMAMINDAN çıkar ve defteri
    // istemciye göndermenin anlamı yok. Sütun tek, satır 63 — sorgu ucuzdur.
    supabase.from("jobs").select("job_no"),
  ]);
  const oneriIsNo = sonrakiIsNo(
    ((mevcutNolar ?? []) as { job_no: string | null }[]).map((r) => r.job_no)
  );

  let initial: JobInput = { ...EMPTY_JOB, job_no: oneriIsNo };
  let kaynakNo: string | null = null;

  if (kaynak) {
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
        ...initial,
        title: src.title ?? "",
        customer: src.customer ?? "",
        customer_id: src.customer_id ?? null,
        customer_address: src.customer_address ?? "",
        customer_tax_office: src.customer_tax_office ?? "",
        customer_tax_no: src.customer_tax_no ?? "",
        customer_phone: src.customer_phone ?? "",
        customer_fax: src.customer_fax ?? "",
        contract_exists: Boolean(src.contract_exists),
        // Sevk/montaj adresi KOPYALANIR (tarihlerin tersine): tekrarlayan
        // siparişte değişen şey termin, değişmeyen şey teslim yeridir.
        shipping_address: src.shipping_address ?? "",
        assembly_address: src.assembly_address ?? "",
        quantity_text: src.quantity_text ?? "",
        job_leader: src.job_leader ?? "",
        project_manager: src.project_manager ?? "",
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
              <span className="font-mono">{kaynakNo}</span> kopyalandı — tarihler
              boş bırakıldı, iş no <span className="font-mono">{oneriIsNo}</span>{" "}
              önerildi; kontrol edip yenilerini verin.
            </>
          ) : (
            <>
              FR.11.02 iş emri formu — müşteri, iş kalemleri, kapsam ve teslim
              bilgileri. İş no{" "}
              <span className="font-mono">{oneriIsNo}</span> olarak önerildi,
              değiştirebilirsiniz.
            </>
          )}
        </p>
      </div>
      <JobForm mode="create" initial={initial} customers={customers} people={people} />
    </div>
  );
}
