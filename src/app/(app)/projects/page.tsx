import {
  Archive,
  CircleCheck,
  Clock3,
  FolderKanban,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { NewProjectDialog, type JobItemOption } from "./new-project-dialog";
import { ProjectsTable, type ProjectRow } from "./projects-table";
import { getReportSettings } from "@/lib/settings";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: projects }, { data: jobsData }, settings] = await Promise.all([
    supabase
      .from("projects")
      .select("id, doc_no, name, customer, crane_type, status, created_at, job_id, jobs:job_id(job_no), revisions(rev_no, status)")
      .order("created_at", { ascending: false }),
    supabase
      .from("jobs")
      .select("id, job_no, title, customer, job_items(id, item_no, product_name, quantity, project_id)")
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    getReportSettings(supabase),
  ]);

  // Silme yalnızca yöneticide: projects DELETE politikası is_admin() ister,
  // yetkisiz kullanıcıya buton hiç gösterilmez.
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const isAdmin = profile?.role === "admin";
  // Yeni rapor / kopyalama / işe bağlama dialoglarında kalemler de gerekir.
  const jobs = (jobsData ?? []).map((j) => ({
    id: j.id,
    job_no: j.job_no,
    title: j.title,
    customer: j.customer,
    items: (j.job_items ?? []) as unknown as JobItemOption[],
  }));

  const list = projects ?? [];
  const allRevs = list.flatMap((p) => p.revisions ?? []);
  const draftCount = allRevs.filter((r) => r.status === "draft").length;
  const issuedCount = allRevs.filter((r) => r.status === "issued").length;
  const archivedCount = list.filter((p) => p.status === "archived").length;

  // Süzme ve sıralama İSTEMCİDE yapılır (`ProjectsTable`); sunucu yalnız
  // satırları düz bir biçime indirir. Revizyonların tamamı listeye taşınmaz —
  // ekranda görünen tek şey SON revizyondur ve "yayınlanmışı var mı" sorusu
  // silme penceresinin uyarısı içindir.
  const rows: ProjectRow[] = list.map((p) => {
    const lastRev = [...(p.revisions ?? [])].sort((a, b) => b.rev_no - a.rev_no)[0];
    return {
      id: p.id,
      doc_no: p.doc_no,
      name: p.name,
      customer: p.customer,
      crane_type: p.crane_type,
      status: p.status,
      created_at: p.created_at,
      job_id: (p.job_id as string | null) ?? null,
      job_no: (p.jobs as unknown as { job_no: string } | null)?.job_no ?? null,
      lastRevNo: lastRev?.rev_no ?? null,
      lastRevStatus: lastRev?.status ?? null,
      hasIssuedRevision: (p.revisions ?? []).some((r) => r.status === "issued"),
    };
  });

  return (
    <div className="grid gap-4">
      <PageHeader title="Mühendislik" hint="Hesap raporu projeleri ve revizyon arşivi">
        <NewProjectDialog defaultCraneType={settings.default_crane_type} jobs={jobs} />
      </PageHeader>

      {/* İstatistik kartları SÜZGEÇTEN ETKİLENMEZ: portföyün tamamını
          özetlerler ve filtre değiştikçe oynayan bir "toplam proje" sayısı
          kartı anlamsız kılardı. Süzgecin sonucu tablonun üstündeki
          "x / y" sayacındadır.

          Dördüncü kart ARŞİVDİR — "arşivlediğim proje nereye gitti?"
          sorusunun cevabı budur (kullanıcı sorusu, 11.08.2026): hiçbir yere
          gitmez, aynı listede kalır ve Durum süzgeciyle ayrı görülür. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Toplam Proje"
          value={String(list.length)}
          hint={`${list.length - archivedCount} Aktif`}
          icon={FolderKanban}
        />
        <StatCard
          label="Taslak Revizyon"
          value={String(draftCount)}
          hint="Düzenlemeye Açık"
          icon={Clock3}
        />
        <StatCard
          label="Yayınlanan Revizyon"
          value={String(issuedCount)}
          hint="Kilitli Snapshot"
          icon={CircleCheck}
        />
        <StatCard
          label="Arşivlenen Proje"
          value={String(archivedCount)}
          hint={
            archivedCount > 0
              ? "Listede kalır — Durum süzgecinden görülür"
              : "Arşivlenmiş proje yok"
          }
          icon={Archive}
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
            [ HENÜZ PROJE YOK ]
          </h2>
          <p className="max-w-sm bg-card px-3 py-1 text-sm text-foreground/70">
            İlk hesap raporu projenizi oluşturun; her proje revizyon arşivi ve
            yayınlanabilir PDF raporlarla birlikte gelir.
          </p>
          <NewProjectDialog defaultCraneType={settings.default_crane_type} jobs={jobs} />
        </div>
      ) : (
        <ProjectsTable projects={rows} jobs={jobs} canDelete={isAdmin} />
      )}
    </div>
  );
}
