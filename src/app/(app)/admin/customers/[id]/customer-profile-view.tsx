"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  Download,
  FileChartColumn,
  FolderKanban,
  Gauge,
  Mail,
  MapPin,
  Phone,
  Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TimeBarChart, SplitBar, type ChartColumn, type ChartSeries, type RankItem } from "@/components/charts";
import { PdfDownloadLink } from "@/components/pdf-download-link";
import { StatCard } from "@/components/stat-card";
import { CustomerTag } from "@/components/tags";
import { cn } from "@/lib/utils";
import { tagStyle } from "@/lib/tags";
import { buildCustomerProfileAnalytics, type CustomerProfileDataset } from "@/lib/customer-profile";
import type { CustomerScoreSettings } from "@/lib/profile-scoring";
import { OFFER_STATUS_HUES, OFFER_STATUS_LABELS, offerStatusOf } from "@/lib/offers/status";
import { JOB_STATUS_LABELS, jobStatusOf } from "@/lib/job-status";

const dateFormat = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "medium" });
const dateTimeFormat = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "medium", timeStyle: "short" });
const monthFormat = new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", month: "short", year: "2-digit" });
const numberFormat = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });
const percentFormat = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 1 });

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormat.format(date);
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTimeFormat.format(date);
}

function ScorePart({ label, value, max, hint, hue }: { label: string; value: number; max: number; hint: string; hue: number }) {
  const width = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span>{label}</span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{value}/{max}</span>
      </div>
      <div className="h-2 overflow-hidden bg-muted" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
        <div className="oc-series-bg h-full" style={{ ...tagStyle(hue), width: `${width}%` }} />
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="border border-dashed p-5 text-center text-sm text-muted-foreground">{children}</p>;
}

export function CustomerProfileView({
  data,
  logoUrl,
  scoring,
  nowIso,
  pdfHref,
}: {
  data: CustomerProfileDataset;
  logoUrl: string | null;
  scoring: CustomerScoreSettings;
  nowIso: string;
  pdfHref?: string;
}) {
  const analytics = buildCustomerProfileAnalytics(data, new Date(nowIso), scoring);
  const monthlyColumns: ChartColumn[] = analytics.monthly12.map((row) => ({
    key: row.month,
    label: monthFormat.format(new Date(`${row.month}-01T00:00:00Z`)),
    total: row.offers + row.jobs + row.projects,
    parts: { offers: row.offers, jobs: row.jobs, projects: row.projects },
  }));
  const monthlySeries: ChartSeries[] = [
    { key: "offers", label: "Teklif", hue: 7 },
    { key: "jobs", label: "İş", hue: 150 },
    { key: "projects", label: "Proje", hue: 210 },
  ];
  const offerStatusItems: RankItem[] = Object.entries(analytics.offerStatusCounts)
    .filter(([, value]) => value > 0)
    .map(([status, value]) => ({
      key: status,
      label: OFFER_STATUS_LABELS[status as keyof typeof OFFER_STATUS_LABELS],
      hue: OFFER_STATUS_HUES[status as keyof typeof OFFER_STATUS_HUES],
      value,
      share: data.offers.length > 0 ? value / data.offers.length : 0,
    }));
  const primaryContact = data.contacts.find((contact) => contact.active && contact.isPrimary);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5">
          <Link href="/admin/customers"><ArrowLeft className="size-4" /> Müşterilere dön</Link>
        </Button>
        {pdfHref ? (
          <PdfDownloadLink
            href={pdfHref}
            fallbackFileName={`${data.customer.shortName || data.customer.name} - Müşteri Profil Raporu.pdf`}
            shareTitle="Müşteri Profil Raporu"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            <Download className="size-4" /> PDF İndir
          </PdfDownloadLink>
        ) : null}
      </div>

      <section className="grid gap-4 border bg-card p-4 sm:grid-cols-[96px_1fr_auto] sm:items-center sm:p-6">
        <div className="flex size-24 items-center justify-center border bg-background p-3">
          {logoUrl ? (
            // Logo dahili Storage'dan sunucuda veri URI'sine çevrilir; dış kaynağa istek ve CSP istisnası açılmaz.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={`${data.customer.name} logosu`} className="max-h-full max-w-full object-contain" />
          ) : (
            <Building2 className="size-9 text-muted-foreground" aria-hidden />
          )}
        </div>
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <CustomerTag name={data.customer.name} shortName={data.customer.shortName} hue={data.customer.colorHue} className="px-2 py-1" />
            <Badge variant="outline">Müşteri Profili</Badge>
          </div>
          <h2 className="break-words text-xl font-semibold tracking-tight sm:text-2xl">{data.customer.name}</h2>
          <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0" /> {data.customer.address || "Adres belirtilmemiş"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Son ticari hareket: {formatDate(analytics.lastActivityAt)}</p>
        </div>
        <div className="border-l-4 border-l-primary bg-primary/5 px-5 py-3 sm:text-right">
          <div className="oc-kicker text-muted-foreground">İlişki puanı</div>
          <div className="font-mono text-4xl font-semibold tabular-nums text-primary">{analytics.score.total}<span className="text-base text-muted-foreground">/100</span></div>
          <div className="text-sm font-medium">{analytics.score.label}</div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-6">
        <StatCard responsiveCompact label="Teklif" value={String(data.offers.length)} hint={`${analytics.annualOfferCount} adedi son 12 ay`} icon={Send} />
        <StatCard responsiveCompact label="Kazanılan" value={String(analytics.wonOfferCount)} hint="Kazanıldı durumundaki teklifler" icon={CheckCircle2} />
        <StatCard responsiveCompact label="Kazanım" value={analytics.conversionRatio === null ? "—" : percentFormat.format(analytics.conversionRatio)} hint="Kazanılan / sonuçlanan" icon={Gauge} />
        <StatCard responsiveCompact label="Aktif İş" value={String(analytics.activeJobCount)} hint={`${data.jobs.length} bağlı iş kaydı`} icon={BriefcaseBusiness} />
        <StatCard responsiveCompact label="Proje" value={String(data.projects.length)} hint="Bağlı işlerin mühendislik projeleri" icon={FolderKanban} />
        <StatCard responsiveCompact label="Kayıt" value={`${analytics.completenessFilled}/${analytics.completenessTotal}`} hint="Temel müşteri bilgisi doluluğu" icon={FileChartColumn} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader>
            <CardTitle>12 Aylık İlişki Akışı</CardTitle>
            <CardDescription>Yeni teklif, iş ve mühendislik projesi adetleri; para tutarı değildir.</CardDescription>
          </CardHeader>
          <CardContent><TimeBarChart columns={monthlyColumns} series={monthlySeries} height={210} valueLabel="kayıt" format={(value) => numberFormat.format(value)} /></CardContent>
        </Card>
        <Card className="border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle>Puanın Bileşenleri</CardTitle>
            <CardDescription>Yönetim › Profil Puanlama ayarlarıyla anlık hesaplanır.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ScorePart label="Güncellik" value={analytics.score.recency} max={scoring.recencyWeight} hue={7} hint={`Son hareket ${formatDate(analytics.lastActivityAt)}; pencere ${scoring.recencyWindowDays} gün.`} />
            <ScorePart label="Teklif etkinliği" value={analytics.score.offerActivity} max={scoring.offerActivityWeight} hue={25} hint={`Son 12 ay ${analytics.annualOfferCount} teklif; tam puan hedefi ${scoring.annualOfferTarget}.`} />
            <ScorePart label="Kazanım" value={analytics.score.conversion} max={scoring.conversionWeight} hue={150} hint={analytics.conversionRatio === null ? "Henüz sonuçlanan teklif yok." : `Sonuçlanan tekliflerin ${percentFormat.format(analytics.conversionRatio)} kadarı kazanıldı.`} />
            <ScorePart label="Aktif işler" value={analytics.score.activeWork} max={scoring.activeWorkWeight} hue={210} hint={`${analytics.activeJobCount} aktif iş; tam puan hedefi ${scoring.activeJobTarget}.`} />
            <ScorePart label="Kayıt bütünlüğü" value={analytics.score.completeness} max={scoring.completenessWeight} hue={270} hint={analytics.completenessMissing.length ? `Eksik: ${analytics.completenessMissing.join(", ")}.` : "Temel müşteri bilgileri tamam."} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Firma Künyesi</CardTitle><CardDescription>Defterdeki güncel genel bilgiler.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <div><div className="oc-kicker text-muted-foreground">Vergi dairesi</div><div>{data.customer.taxOffice || "—"}</div></div>
            <div><div className="oc-kicker text-muted-foreground">Vergi no</div><div className="font-mono tabular-nums">{data.customer.taxNo || "—"}</div></div>
            <div><div className="oc-kicker text-muted-foreground">Telefon</div><div>{data.customer.phone || "—"}</div></div>
            <div><div className="oc-kicker text-muted-foreground">Faks</div><div>{data.customer.fax || "—"}</div></div>
            <div className="sm:col-span-2"><div className="oc-kicker text-muted-foreground">Adres</div><div>{data.customer.address || "—"}</div></div>
            <div className="sm:col-span-2"><div className="oc-kicker text-muted-foreground">Not</div><div className="whitespace-pre-wrap">{data.customer.notes || "—"}</div></div>
            <div><div className="oc-kicker text-muted-foreground">Deftere eklendi</div><div>{formatDateTime(data.customer.createdAt)}</div></div>
            <div><div className="oc-kicker text-muted-foreground">Son güncelleme</div><div>{formatDateTime(data.customer.updatedAt)}</div></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>İletişim Kişileri</CardTitle><CardDescription>{primaryContact ? `${primaryContact.name} birincil muhatap.` : "Birincil muhatap işaretlenmemiş."}</CardDescription></CardHeader>
          <CardContent className="grid gap-2">
            {data.contacts.length === 0 ? <Empty>İletişim kişisi kaydı yok.</Empty> : data.contacts.map((contact) => (
              <div key={contact.id} className={cn("grid gap-2 border p-3 sm:grid-cols-[1fr_auto]", !contact.active && "opacity-55")}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{contact.name}</span>{contact.isPrimary && <Badge>Birincil</Badge>}{!contact.active && <Badge variant="outline">Pasif</Badge>}</div>
                  <p className="text-xs text-muted-foreground">{[contact.title, contact.department].filter(Boolean).join(" · ") || "Unvan/bölüm belirtilmemiş"}</p>
                </div>
                <div className="grid gap-1 text-xs sm:text-right">
                  <span className="flex items-center gap-1 sm:justify-end"><Phone className="size-3" /> {contact.phone || "—"}</span>
                  <span className="flex items-center gap-1 break-all sm:justify-end"><Mail className="size-3" /> {contact.email || "—"}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
        <Card>
          <CardHeader><CardTitle>Teklif Durumları</CardTitle><CardDescription>Her teklif tek bir durum grubunda gösterilir.</CardDescription></CardHeader>
          <CardContent>{offerStatusItems.length ? <SplitBar items={offerStatusItems} format={(value) => numberFormat.format(value)} valueLabel="teklif" /> : <Empty>Teklif kaydı yok.</Empty>}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Teklif Tutarları</CardTitle><CardDescription>Kur dönüşümü yapılmadan para birimi bazında güncel revizyon toplamları.</CardDescription></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {analytics.quotedTotalsByCurrency.length === 0 ? <div className="sm:col-span-2 xl:col-span-3"><Empty>Tutarı bulunan teklif yok.</Empty></div> : analytics.quotedTotalsByCurrency.map((item) => (
              <div key={item.currency} className="border-l-4 border-l-primary bg-muted/30 p-3">
                <div className="oc-kicker text-muted-foreground">{item.currency} · {item.count} teklif</div>
                <div className="mt-1 font-mono text-lg font-semibold tabular-nums">{numberFormat.format(item.total)} {item.currency}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader><CardTitle>Teklifler</CardTitle><CardDescription>En güncel kayıt üstte; tutar son revizyondan gelir.</CardDescription></CardHeader>
        <CardContent className="grid gap-2">
          {data.offers.length === 0 ? <Empty>Bu müşteriye bağlı teklif yok.</Empty> : data.offers.map((offer) => {
            const status = offerStatusOf(offer.status);
            return (
              <Link key={offer.id} href={`/offers/${offer.id}`} className="grid gap-2 border p-3 transition-colors hover:bg-muted/40 md:grid-cols-[8rem_1fr_9rem_11rem] md:items-center">
                <span className="font-mono text-sm font-medium tabular-nums">{offer.offerNo || "—"}</span>
                <span className="min-w-0 break-words text-sm">{offer.subject || "Konu belirtilmemiş"}</span>
                <span className="oc-tag justify-self-start px-2 py-0.5 text-xs" style={tagStyle(OFFER_STATUS_HUES[status])}>{OFFER_STATUS_LABELS[status]}</span>
                <span className="font-mono text-sm tabular-nums md:text-right">{offer.latestTotal === null ? "—" : `${numberFormat.format(offer.latestTotal)} ${offer.currency}`}</span>
                <span className="text-xs text-muted-foreground md:col-start-2">{formatDate(offer.issuedOn || offer.issueDate || offer.createdAt)}</span>
              </Link>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Alınan İşler</CardTitle><CardDescription>Müşteri kimliğiyle bağlı iş kayıtları.</CardDescription></CardHeader>
          <CardContent className="grid gap-2">
            {data.jobs.length === 0 ? <Empty>Bu müşteriye bağlı iş yok.</Empty> : data.jobs.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`} className="grid gap-1 border p-3 transition-colors hover:bg-muted/40 sm:grid-cols-[8rem_1fr_auto] sm:items-center">
                <span className="font-mono text-sm font-medium tabular-nums">{job.jobNo || "—"}</span>
                <span className="break-words text-sm">{job.title || "İş başlığı belirtilmemiş"}</span>
                <Badge variant="outline">{JOB_STATUS_LABELS[jobStatusOf(job.status)]}</Badge>
                <span className="text-xs text-muted-foreground sm:col-start-2">İş emri: {formatDate(job.workOrderDate || job.createdAt)}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Mühendislik Projeleri</CardTitle><CardDescription>Yalnız müşteriye bağlı işlerin altındaki projeler.</CardDescription></CardHeader>
          <CardContent className="grid gap-2">
            {data.projects.length === 0 ? <Empty>Bağlı mühendislik projesi yok.</Empty> : data.projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`} className="grid gap-1 border p-3 transition-colors hover:bg-muted/40 sm:grid-cols-[9rem_1fr_auto] sm:items-center">
                <span className="font-mono text-sm font-medium tabular-nums">{project.docNo || "—"}</span>
                <span className="break-words text-sm">{project.name || "Proje adı belirtilmemiş"}</span>
                <Badge variant="outline">{project.status === "archived" ? "Arşiv" : "Aktif"}</Badge>
                <span className="flex items-center gap-1 text-xs text-muted-foreground sm:col-start-2"><CalendarDays className="size-3" /> {formatDate(project.createdAt)}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Puanın kapsamı:</span> yalnız bu uygulamadaki kayıtlı ticari hareket ve profil bütünlüğüdür. Finansal risk, müşteri memnuniyeti veya ödeme davranışı hakkında varsayım üretmez.
      </div>
    </div>
  );
}
