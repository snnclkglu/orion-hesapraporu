// İş hub kabuğu: kimlik + durum + birincil eylemler + bölüm rayı.
//
// ROTA GRUBU `(hub)` BİLİNÇLİDİR: bu kabuk yalnız okuma ekranlarını sarar
// (Genel Bakış · Akış · Bağlantılar). `/jobs/[id]/edit` grubun DIŞINDADIR —
// form dar sayfa düzeninde kalır ve sekme rayı taşımaz; `/work-order` bir
// route handler'dır, zaten etkilenmez.
//
// Kabuk işi bir kez okur (kimlik alanları), alt sayfalar kendi verisini
// kendisi çeker — `drawings/[id]/layout.tsx` ile aynı iş bölümü.

import Link from "next/link";
import { notFound } from "next/navigation";
import { FileDown, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fmtJobDate } from "@/lib/jobs/filter";
import { revizyonHarfi } from "@/lib/jobs/is-emri";
import { canEditJobs } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { JobStatusMenu } from "../../job-status-menu";
import { FavoriButton } from "../../favori-button";
import { JobNav } from "../job-nav";
import { RecentMarker } from "../recent-marker";

export default async function JobHubLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: job }, { data: fav }, { data: profil }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, job_no, title, customer, status, work_order_date, revision")
      .eq("id", id)
      .single(),
    // Favori tablosu migration bekliyorsa hata döner → yıldız boş başlar.
    user
      ? supabase
          .from("job_favorites")
          .select("job_id")
          .eq("job_id", id)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!job) notFound();
  // İş emrini HERKES görür, DÜZENLEMEYİ Yönetici ve Müdür yapar (canEditJobs).
  const canEdit = canEditJobs((profil as { role?: string } | null)?.role);

  return (
    <div className="grid gap-4">
      {/* Ziyareti "son bakılanlar" defterine işler (cihaza özel, çizim yok). */}
      <RecentMarker id={job.id} jobNo={job.job_no} title={job.title} />
      {/* Kimlik kabuğun yapışkan üst şeridinde: uzun iş detayında aşağı
          kayarken hangi işte olunduğu ve `/jobs`a dönüş kaybolmaz. */}
      <PageHeader
        backHref="/jobs"
        backLabel={job.job_no}
        title={job.title}
        hint={job.customer}
      />

      {/* Başlık + eylemler */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {/* Kırıntı yolu `xl` altında geri okuyla yineleniyordu. */}
          <div className="hidden text-sm text-muted-foreground xl:block">
            <Link href="/jobs" className="hover:underline">İşler</Link>
            {" / "}
            <span className="font-mono">{job.job_no}</span>
          </div>
          {/* `h2`: sayfanın `h1`i kabuğun üst şeridindedir (PageHeader). */}
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">{job.title}</h2>
          <p className="text-sm text-muted-foreground">
            {job.customer} · İş Emri Tarihi:{" "}
            <span className="font-mono tabular-nums">{fmtJobDate(job.work_order_date)}</span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <JobStatusMenu jobId={job.id} status={job.status} size="md" readOnly={!canEdit} />
            {/* REVİZYON ROZETİ durumun yanındadır: ikisi de "bu iş emri şu an
                hangi hâlde" sorusunun cevabıdır ve PDF künyesinde de yan yana
                basılırlar. Rozet YALNIZ REVİZE EDİLMİŞ emirde çıkar — ilk
                yayın revizyonsuzdur ve "REV —" gibi bir yer tutucu, olmamış
                bir düzeltme geçmişi anlatırdı (md. 5). */}
            {revizyonHarfi(job.revision) && (
              <Badge variant="outline" className="font-mono" title="İş emri revizyonu">
                REV {revizyonHarfi(job.revision)}
              </Badge>
            )}
            <FavoriButton jobId={job.id} favori={Boolean(fav)} />
          </div>
        </div>
        {/* İki birincil eylem telefonda satırın sağ ucunda küçük bir çift
            olarak sıkışıyordu; mobilde satırı ikiye bölüp yayılırlar. */}
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-none">
            <a href={`/jobs/${job.id}/work-order`}>
              <FileDown className="size-3.5" /> İş Emri PDF
            </a>
          </Button>
          {canEdit && (
            <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-none">
              <Link href={`/jobs/${job.id}/edit`}>
                <Pencil className="size-3.5" /> Düzenle
              </Link>
            </Button>
          )}
        </div>
      </div>

      <JobNav jobId={job.id} />

      {children}
    </div>
  );
}
