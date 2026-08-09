import Link from "next/link";
import { Briefcase, Building2, Construction, History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { jobStatusOf } from "@/lib/job-status";
import { JobsTable, type JobRow } from "./jobs-table";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";

/** Supabase gömülü ilişkiyi tekil ya da dizi olarak dönebilir; ikisini de karşıla. */
function one<T>(v: unknown): T | null {
  if (Array.isArray(v)) return (v[0] as T) ?? null;
  return (v as T) ?? null;
}

function NewJobButton() {
  return (
    <Button asChild>
      <Link href="/jobs/new">Yeni İş</Link>
    </Button>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 leading-tight">
        <div className="oc-kicker text-muted-foreground">{label}</div>
        <div className="mt-0.5 font-mono text-xl font-semibold tabular-nums tracking-tight">
          {value}
        </div>
        {hint && (
          <div className="mt-0.5 truncate text-[11px] text-foreground/70" title={hint}>
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}

export default async function JobsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: jobs }, { data: profile }] = await Promise.all([
    supabase
      .from("jobs")
      // Kısaltma ve renk DEFTERDEN gelir, iş emrinin metin alanından değil:
      // müşteri kısaltmasını sonradan düzeltmek eski işlerin görünümünü de
      // düzeltmelidir (unvan fotoğrafı ise iş emrinde olduğu gibi kalır).
      // Sorgu metni TEK PARÇA yazılır — birleştirilmiş dizgide Supabase'in tip
      // çıkarımı çalışmaz ve satırlar `GenericStringError` olur.
      .select(
        `id, job_no, title, customer, status, work_order_date, created_at,
         customers(short_name, color_hue), projects(id), job_items(id)`
      )
      .order("created_at", { ascending: false }),
    // Silme yalnızca yöneticide: jobs DELETE politikası is_admin() ister,
    // yetkisiz kullanıcıya buton hiç gösterilmez.
    user
      ? supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const list: JobRow[] = (jobs ?? []).map((j) => {
    // PostgREST gömülü ilişkiyi tekil ya da dizi olarak dönebilir.
    const book = one<{ short_name: string | null; color_hue: number | null }>(
      j.customers as unknown
    );
    return {
      id: j.id,
      job_no: j.job_no,
      title: j.title,
      customer: j.customer ?? "",
      customerShort: book?.short_name ?? null,
      customerHue: book?.color_hue ?? null,
      status: j.status,
      work_order_date: j.work_order_date ?? null,
      created_at: j.created_at,
      itemCount: j.job_items?.length ?? 0,
      craneCount: j.projects?.length ?? 0,
    };
  });

  const craneCount = list.reduce((sum, j) => sum + j.craneCount, 0);
  const customers = new Set(list.map((j) => j.customer)).size;
  const lastCreated = list[0]?.created_at
    ? new Date(list[0].created_at).toLocaleDateString("tr-TR")
    : "—";
  const activeCount = list.filter((j) => jobStatusOf(j.status) === "active").length;

  return (
    <div className="grid gap-4">
      <PageHeader title="İşler" hint="İş emirleri ve içerdikleri vinçler">
        <NewJobButton />
      </PageHeader>

      {/* İstatistik kartları */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Toplam İş"
          value={String(list.length)}
          hint={`${activeCount} Aktif`}
          icon={Briefcase}
        />
        <StatCard
          label="Bağlı Vinç"
          value={String(craneCount)}
          hint="iş emirlerine bağlı"
          icon={Construction}
        />
        <StatCard
          label="Müşteri"
          value={String(customers)}
          hint="farklı müşteri"
          icon={Building2}
        />
        <StatCard
          label="Son İş"
          value={lastCreated}
          hint={list[0]?.job_no ?? "kayıt yok"}
          icon={History}
        />
      </div>

      {list.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-4 border bg-card px-6 py-16 text-center"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, var(--muted) 0 10px, transparent 10px 20px)",
          }}
        >
          <h2 className="border bg-background px-3 py-1.5 font-mono text-xs font-medium tracking-[0.15em]">
            [ HENÜZ İŞ YOK ]
          </h2>
          <p className="max-w-sm bg-card px-3 py-1 text-sm text-foreground/70">
            İlk iş emrini oluşturun; her iş birden çok vinç, hesap raporu ve
            teknik çizim takibi içerir.
          </p>
          <NewJobButton />
        </div>
      ) : (
        <JobsTable jobs={list} canDelete={profile?.role === "admin"} />
      )}
    </div>
  );
}
