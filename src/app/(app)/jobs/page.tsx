import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { configToState, writeJobsViewState } from "@/lib/jobs/view-state";
import { jobStatusOf } from "@/lib/job-status";
import type { JobRow } from "./jobs-table";
import { JobsViews } from "./jobs-views";
import type { JobExtras } from "./board-view";
import { MineStrip, type MyTaskRow } from "./mine-strip";
import { canEditJobs, canSeeSales } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { JobsSummary } from "./jobs-summary";

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

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // KAYITLI GÖRÜNÜMLER + AÇILIŞ VARSAYILANI: sayfa PARAMETRESİZ açıldıysa
  // kullanıcının varsayılan görünümü adrese çevrilir (redirect). Parametreli
  // giriş — paylaşılan bağlantı, geri tuşu — ASLA ezilmez.
  const { data: savedViewRows } = user
    ? await supabase
        .from("user_saved_views")
        .select("id, name, config, is_default")
        .eq("user_id", user.id)
        .order("sort", { ascending: true })
    : { data: null };
  if (Object.keys(sp).length === 0) {
    const varsayilan = (savedViewRows ?? []).find(
      (v) => (v as { is_default?: boolean }).is_default
    );
    if (varsayilan) {
      const state = configToState((varsayilan as { config: unknown }).config);
      if (state) {
        const p = new URLSearchParams();
        for (const [k, v] of Object.entries(writeJobsViewState(state))) {
          if (v) p.set(k, v);
        }
        const qs = p.toString();
        // Tamamı varsayılan olan bir fotoğraf boş adres üretir; yönlendirme
        // o zaman sonsuz döngü olurdu — atlanır.
        if (qs) redirect(`/jobs?${qs}`);
      }
    }
  }

  const [{ data: jobs }, { data: profile }, { data: myTaskRows }] = await Promise.all([
    supabase
      .from("jobs")
      // Kısaltma ve renk DEFTERDEN gelir, iş emrinin metin alanından değil:
      // müşteri kısaltmasını sonradan düzeltmek eski işlerin görünümünü de
      // düzeltmelidir (unvan fotoğrafı ise iş emrinde olduğu gibi kalır).
      // Sorgu metni TEK PARÇA yazılır — birleştirilmiş dizgide Supabase'in tip
      // çıkarımı çalışmaz ve satırlar `GenericStringError` olur.
      //
      // SAYIMLAR COUNT İLE GELİR, gömülü kimlik dizileriyle DEĞİL: iki tamsayı
      // için bütün kalem/proje satırlarını taşımak fiyat arşivinde ölçülen
      // anti-kalıptı ("kaç satır çiziliyor" değil "kaç bayt taşınıyor").
      .select(
        `id, job_no, title, customer, status, work_order_date, created_at, job_leader,
         workshop_exit_date, delivery_date,
         customers(short_name, color_hue), job_items(count), projects(count)`
      )
      .order("created_at", { ascending: false }),
    // Silme yalnızca yöneticide: jobs DELETE politikası is_admin() ister,
    // yetkisiz kullanıcıya buton hiç gösterilmez.
    user
      ? supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    // "Benim işlerim" şeridi: bana atanan AÇIK görevler. Tablo migration'ı
    // uygulanmamışsa sorgu hata döner ve şerit hiç çizilmez (data null).
    user
      ? supabase
          .from("job_tasks")
          .select("id, title, due_date, job_id, jobs(job_no, title)")
          .eq("assignee", user.id)
          .is("done_at", null)
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(6)
      : Promise.resolve({ data: null }),
  ]);

  // Favorilerim: yıldız göstergesi (tablo) + şeritteki Favoriler bölümü.
  const { data: favRows } = user
    ? await supabase
        .from("job_favorites")
        .select("job_id, jobs(job_no, title)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
    : { data: null };
  const favSet = new Set(
    ((favRows ?? []) as { job_id: string }[]).map((r) => r.job_id)
  );

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
      itemCount: one<{ count: number }>(j.job_items as unknown)?.count ?? 0,
      craneCount: one<{ count: number }>(j.projects as unknown)?.count ?? 0,
      favori: favSet.has(j.id),
      jobLeader: (j as { job_leader?: string | null }).job_leader ?? null,
      workshopExitDate:
        (j as { workshop_exit_date?: string | null }).workshop_exit_date ?? null,
      deliveryDate:
        (j as { delivery_date?: string | null }).delivery_date ?? null,
    };
  });

  // Pano kartlarının TÜREV zenginleştirmeleri: iş başına açık görev sayısı
  // (herkese) ve en yakın termin (YALNIZ canSeeSales — yetki iki kez sorulur;
  // rol geçmeden sorgu hiç koşmaz, boş sonuç "termin yok" sanılmaz).
  const extras: JobExtras = { tasks: {}, termin: null, taskDates: [], salesDates: null };
  {
    const { data: acikGorevler } = await supabase
      .from("job_tasks")
      .select("job_id, title, due_date")
      .is("done_at", null);
    const bugun = new Date();
    const p2 = (n: number) => String(n).padStart(2, "0");
    const bugunIso = `${bugun.getFullYear()}-${p2(bugun.getMonth() + 1)}-${p2(bugun.getDate())}`;
    for (const g of (acikGorevler ?? []) as {
      job_id: string | null;
      title: string | null;
      due_date: string | null;
    }[]) {
      if (!g.job_id) continue;
      const kayit = (extras.tasks[g.job_id] ??= { open: 0, overdue: 0 });
      kayit.open += 1;
      if (g.due_date && g.due_date < bugunIso) kayit.overdue += 1;
      if (g.due_date)
        extras.taskDates.push({
          jobId: g.job_id,
          title: g.title ?? "",
          dueDate: g.due_date,
        });
    }
    if (canSeeSales((profile as { role?: string } | null)?.role)) {
      const { data: terminler } = await supabase
        .from("job_item_sales")
        .select("due_date, shipment_date, job_items!inner(job_id)");
      const enYakin: Record<string, string> = {};
      const satisTarihleri: NonNullable<JobExtras["salesDates"]> = [];
      for (const t of (terminler ?? []) as {
        due_date: string | null;
        shipment_date: string | null;
        job_items: { job_id: string | null } | { job_id: string | null }[] | null;
      }[]) {
        const jobId = one<{ job_id: string | null }>(t.job_items as unknown)?.job_id;
        if (!jobId) continue;
        if (t.due_date && (!enYakin[jobId] || t.due_date < enYakin[jobId])) {
          enYakin[jobId] = t.due_date;
        }
        if (t.due_date || t.shipment_date) {
          satisTarihleri.push({
            jobId,
            dueDate: t.due_date,
            shipmentDate: t.shipment_date,
          });
        }
      }
      extras.termin = enYakin;
      extras.salesDates = satisTarihleri;
    }
  }

  const myTasks: MyTaskRow[] = ((myTaskRows ?? []) as {
    id: string;
    title: string;
    due_date: string | null;
    job_id: string | null;
    jobs: { job_no: string; title: string } | { job_no: string; title: string }[] | null;
  }[]).map((t) => {
    const is = one<{ job_no: string; title: string }>(t.jobs as unknown);
    return {
      taskId: t.id,
      title: t.title,
      dueDate: t.due_date,
      jobId: t.job_id ?? "",
      jobNo: is?.job_no ?? "",
      jobTitle: is?.title ?? "",
    };
  });

  const craneCount = list.reduce((sum, j) => sum + j.craneCount, 0);
  const customers = new Set(list.map((j) => j.customer)).size;
  const lastCreated = list[0]?.created_at
    ? new Date(list[0].created_at).toLocaleDateString("tr-TR")
    : "—";
  const activeCount = list.filter((j) => jobStatusOf(j.status) === "active").length;
  // İŞLER HERKESE GÖRÜNÜR, YAZMA YÖNETİCİ VE MÜDÜRDEDİR (ROL-15 / canEditJobs).
  // Düğmeyi gizlemek yalnız görgü kuralıdır; asıl engel RLS ve server
  // action'ın kapısıdır (`yazmaIzni`).
  const rol = (profile as { role?: string } | null)?.role;
  const canEdit = canEditJobs(rol);

  return (
    <div className="grid gap-4">
      <PageHeader title="İşler" hint="İş emirleri ve içerdikleri vinçler">
        {canEdit && <NewJobButton />}
      </PageHeader>

      <JobsSummary
        total={list.length}
        active={activeCount}
        craneCount={craneCount}
        customerCount={customers}
        lastCreated={lastCreated}
        lastJobNo={list[0]?.job_no ?? "kayıt yok"}
      />

      {/* Kişiye özel şerit: bana atanan görevler + favoriler + son
          bakılanlar. Hepsi boşsa bileşen kendini hiç çizmez. */}
      <MineStrip
        myTasks={myTasks}
        favorites={((favRows ?? []) as {
          job_id: string;
          jobs:
            | { job_no: string; title: string }
            | { job_no: string; title: string }[]
            | null;
        }[])
          .map((r) => {
            const is = one<{ job_no: string; title: string }>(r.jobs as unknown);
            return { id: r.job_id, jobNo: is?.job_no ?? "", title: is?.title ?? "" };
          })
          .filter((f) => f.jobNo)}
      />

      {list.length === 0 ? (
        <EmptyState
          title="HENÜZ İŞ YOK"
          description={
            canEdit
              ? "İlk iş emrini oluşturun; her iş birden çok vinç, hesap raporu ve teknik çizim takibi içerir."
              : "Henüz iş emri açılmamış. İş emri açma yetkisi Yönetici ve Müdürdedir."
          }
        >
          {canEdit && <NewJobButton />}
        </EmptyState>
      ) : (
        <JobsViews
          jobs={list}
          canDelete={rol === "admin"}
          canEdit={canEdit}
          extras={extras}
          savedViews={((savedViewRows ?? []) as {
            id: string;
            name: string;
            config: unknown;
            is_default: boolean;
          }[]).map((v) => ({
            id: v.id,
            name: v.name,
            config: v.config,
            isDefault: v.is_default,
          }))}
        />
      )}
    </div>
  );
}
