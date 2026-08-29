"use client";

import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  Clock3,
  Download,
  Eye,
  Gauge,
  History,
  Laptop,
  Monitor,
  MousePointerClick,
  ShieldCheck,
  Smartphone,
  Tablet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { PdfDownloadLink } from "@/components/pdf-download-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { TimeBarChart, type ChartColumn, type ChartSeries } from "@/components/charts";
import { roleLabel } from "@/lib/roles";
import type { UserScoreSettings } from "@/lib/profile-scoring";
import { cn } from "@/lib/utils";
import {
  USAGE_DEVICE_LABELS,
  USAGE_SECTION_LABELS,
  auditActionLabel,
  buildUsageAnalytics,
  formatUsageDuration,
  type UsageDeviceClass,
  type UsageMetricRow,
} from "@/lib/usage";

export interface ManagedUserProfile {
  id: string;
  fullName: string;
  email: string;
  title: string;
  role: string;
  createdAt: string;
}

export interface UserAuditEvent {
  id: number | string;
  action: string;
  createdAt: string;
}

const dateTimeFormat = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  dateStyle: "medium",
  timeStyle: "short",
});
const dateFormat = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  dateStyle: "medium",
});
const shortDayFormat = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "UTC",
  day: "2-digit",
  month: "short",
});

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTimeFormat.format(date);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormat.format(date);
}

function initials(name: string, email: string): string {
  const source = name.trim() || email.split("@")[0] || "K";
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("tr-TR");
}

function relativeSeen(lastSeenAt: string | null, now: Date): string {
  if (!lastSeenAt) return "Henüz kullanım kaydı yok";
  const elapsedMinutes = Math.max(0, Math.round((now.getTime() - new Date(lastSeenAt).getTime()) / 60_000));
  if (elapsedMinutes < 2) return "Şu anda aktif";
  if (elapsedMinutes < 60) return `${elapsedMinutes} dk önce aktifti`;
  const hours = Math.round(elapsedMinutes / 60);
  if (hours < 24) return `${hours} sa önce aktifti`;
  const days = Math.round(hours / 24);
  return `${days} gün önce aktifti`;
}

function deviceIcon(device: UsageDeviceClass) {
  if (device === "mobile") return Smartphone;
  if (device === "tablet") return Tablet;
  return Monitor;
}

function ScorePart({ label, value, max, hint }: { label: string; value: number; max: number; hint: string }) {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {value}/{max}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${ratio * 100}%` }} />
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
    </div>
  );
}

export function UserProfileView({
  profile,
  usageRows,
  usageAvailable,
  auditEvents,
  actionCount30,
  nowIso,
  scoring,
  pdfHref,
}: {
  profile: ManagedUserProfile;
  usageRows: UsageMetricRow[];
  usageAvailable: boolean;
  auditEvents: UserAuditEvent[];
  actionCount30: number;
  nowIso: string;
  scoring: UserScoreSettings;
  pdfHref?: string;
}) {
  const now = new Date(nowIso);
  const analytics = buildUsageAnalytics(usageRows, now, scoring);
  const dayColumns: ChartColumn[] = analytics.daily14.map((day) => ({
    key: day.date,
    label: shortDayFormat.format(new Date(`${day.date}T00:00:00Z`)),
    total: day.activeSeconds,
    parts: { active: day.activeSeconds },
  }));
  const daySeries: ChartSeries[] = [{ key: "active", label: "Aktif süre", hue: 7 }];

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5">
          <Link href="/admin/users">
            <ArrowLeft className="size-4" /> Kullanıcılara dön
          </Link>
        </Button>
        {pdfHref ? (
          <PdfDownloadLink
            href={pdfHref}
            fallbackFileName={`${profile.fullName || profile.email} - Kullanıcı Profil Raporu.pdf`}
            shareTitle="Kullanıcı Profil Raporu"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            <Download className="size-4" /> PDF İndir
          </PdfDownloadLink>
        ) : null}
      </div>

      <section className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-6">
        <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 font-heading text-lg font-bold text-primary sm:size-16">
          {initials(profile.fullName, profile.email)}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="break-words text-xl font-semibold tracking-tight sm:text-2xl">
              {profile.fullName || profile.email || "Kullanıcı"}
            </h2>
            <Badge variant="outline">{roleLabel(profile.role)}</Badge>
            {analytics.currentlyActive && <Badge>Aktif</Badge>}
          </div>
          <p className="mt-1 break-all text-sm text-muted-foreground">{profile.email || "—"}</p>
          <p className="mt-1 text-sm text-foreground/80">{profile.title || "Unvan belirtilmemiş"}</p>
        </div>
        <div className="grid gap-1 text-sm sm:text-right">
          <span className="font-medium">{relativeSeen(analytics.lastSeenAt, now)}</span>
          <span className="text-xs text-muted-foreground">
            Son kayıt: {formatDateTime(analytics.lastSeenAt)}
          </span>
          <span className="text-xs text-muted-foreground">
            Hesap açılışı: {formatDate(profile.createdAt)}
          </span>
        </div>
      </section>

      {!usageAvailable && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Kullanım ölçümü tablosu okunamadı. Profil bilgileri ve kayıtlı işlem geçmişi gösterilmeye devam ediyor.
        </div>
      )}

      {usageAvailable && analytics.allTime.pageViews === 0 && (
        <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
          Bu kullanıcı için henüz kullanım kaydı oluşmadı. Takip, yeni sürümden sonraki ilk uygulama ziyaretinde başlar; geçmiş süre geriye dönük üretilmez.
        </div>
      )}

      <section className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Aktif Süre · 30 Gün"
          value={formatUsageDuration(analytics.last30.activeSeconds)}
          hint="Arka plan ve boşta süre hariç"
          icon={Clock3}
          responsiveCompact
        />
        <StatCard
          label="Aktif Gün"
          value={analytics.last30.activeDays.toLocaleString("tr-TR")}
          hint="Son 30 takvim günü"
          icon={CalendarDays}
          responsiveCompact
        />
        <StatCard
          label="Oturum"
          value={analytics.last30.sessionCount.toLocaleString("tr-TR")}
          hint="30 dk boşlukta yenilenir"
          icon={Activity}
          responsiveCompact
        />
        <StatCard
          label="Sayfa Geçişi"
          value={analytics.last30.pageViews.toLocaleString("tr-TR")}
          hint="İçerik değil geçiş sayılır"
          icon={Eye}
          responsiveCompact
        />
        <StatCard
          label="Kayıtlı İşlem"
          value={actionCount30.toLocaleString("tr-TR")}
          hint="Denetim izindeki son 30 gün"
          icon={MousePointerClick}
          responsiveCompact
        />
        <StatCard
          label="Kullanım Skoru"
          value={analytics.score ? `${analytics.score.total}/100` : "—"}
          hint={analytics.score?.label ?? "Veri bekleniyor"}
          icon={Gauge}
          responsiveCompact
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.75fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Son 14 Günün Aktif Kullanımı</CardTitle>
            <CardDescription>
              Sekme görünürken ve son kullanıcı etkileşiminin üzerinden beş dakikadan az geçmişken sayılan süre.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TimeBarChart
              columns={dayColumns}
              series={daySeries}
              height={210}
              valueLabel="aktif süre"
              format={formatUsageDuration}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kullanım Skoru</CardTitle>
            <CardDescription>
              İş performansı veya verimlilik puanı değildir; yalnız uygulamaya dönüş düzenini özetler.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            {analytics.score ? (
              <>
                <div className="flex items-end gap-3">
                  <span className="font-mono text-4xl font-semibold tabular-nums">
                    {analytics.score.total}
                  </span>
                  <span className="pb-1 text-sm text-muted-foreground">/ 100 · {analytics.score.label}</span>
                </div>
                <ScorePart
                  label="Güncellik"
                  value={analytics.score.recency}
                  max={scoring.recencyWeight}
                  hint="Son kullanım ne kadar yakınsa yükselir."
                />
                <ScorePart
                  label="Düzenlilik"
                  value={analytics.score.consistency}
                  max={scoring.consistencyWeight}
                  hint={`Son 30 gündeki aktif gün sayısını ölçer; ${scoring.activeDaysTarget} günde tavana ulaşır.`}
                />
                <ScorePart
                  label="Aktif kullanım"
                  value={analytics.score.engagement}
                  max={scoring.engagementWeight}
                  hint={`Arka plan hariç aktif süreyi ölçer; ${scoring.activeHoursTarget.toLocaleString("tr-TR")} saatte tavana ulaşır.`}
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                İlk kullanım kaydı geldikten sonra skor ve alt bileşenleri burada görünür.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bölüm Dağılımı · 30 Gün</CardTitle>
            <CardDescription>Aktif sürenin uygulama bölümlerine dağılımı.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {analytics.sections30.map((item) => (
              <div key={item.section} className="grid gap-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{USAGE_SECTION_LABELS[item.section]}</span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {formatUsageDuration(item.activeSeconds)} · {item.pageViews.toLocaleString("tr-TR")} geçiş
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(item.ratio * 100, item.activeSeconds > 0 ? 1 : 0)}%` }}
                  />
                </div>
              </div>
            ))}
            {analytics.sections30.length === 0 && (
              <p className="text-sm text-muted-foreground">Henüz bölüm kullanımı yok.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cihaz Dağılımı · 30 Gün</CardTitle>
            <CardDescription>Cihaz sınıfı yalnız ekran genişliğine göre belirlenir.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {analytics.devices30.map((item) => {
              const Icon = deviceIcon(item.device);
              return (
                <div key={item.device} className="flex items-center gap-3 rounded-lg border p-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{USAGE_DEVICE_LABELS[item.device]}</span>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        %{Math.round(item.ratio * 100)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatUsageDuration(item.activeSeconds)} · {item.sessionCount.toLocaleString("tr-TR")} oturum
                    </div>
                  </div>
                </div>
              );
            })}
            {analytics.devices30.length === 0 && (
              <p className="text-sm text-muted-foreground">Henüz cihaz verisi yok.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Son Oturumlar</CardTitle>
            <CardDescription>Oturum başına ana bölüm, cihaz, süre ve sayfa geçişi.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {analytics.recentSessions.map((session) => {
              const Icon = deviceIcon(session.device);
              return (
                <div
                  key={session.sessionId}
                  className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1.35fr_1fr_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {USAGE_SECTION_LABELS[session.primarySection]}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {formatDateTime(session.startedAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Icon className="size-4" /> {USAGE_DEVICE_LABELS[session.device]}
                  </div>
                  <div className="text-sm sm:text-right">
                    <div className="font-mono tabular-nums">{formatUsageDuration(session.activeSeconds)}</div>
                    <div className="text-xs text-muted-foreground">
                      {session.pageViews.toLocaleString("tr-TR")} geçiş
                    </div>
                  </div>
                </div>
              );
            })}
            {analytics.recentSessions.length === 0 && (
              <p className="text-sm text-muted-foreground">Henüz oturum kaydı yok.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kayıtlı İşlem Geçmişi</CardTitle>
            <CardDescription>
              Uygulamanın denetim izine yazdığı son işlemler; kullanım süresinden bağımsızdır.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-3">
              {auditEvents.map((event) => (
                <li key={event.id} className="grid grid-cols-[auto_1fr] gap-3">
                  <span className="mt-0.5 flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <History className="size-3.5" />
                  </span>
                  <div className="min-w-0 border-b pb-3 last:border-b-0 last:pb-0">
                    <div className="text-sm font-medium">{auditActionLabel(event.action)}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {formatDateTime(event.createdAt)}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            {auditEvents.length === 0 && (
              <p className="text-sm text-muted-foreground">Denetim izinde bu kullanıcıya ait kayıt yok.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <Card size="sm" className="bg-muted/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" /> Ölçüm Kapsamı ve Mahremiyet
          </CardTitle>
          <CardDescription>
            Yönetici ekranındaki sayılar, çalışanın iş kalitesine ilişkin bir hüküm üretmez.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm text-muted-foreground md:grid-cols-3">
          <div>
            <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
              <Laptop className="size-4" /> Tutulanlar
            </div>
            Ana bölüm, aktif saniye, sayfa geçişi, oturum zamanı ve cihaz sınıfı.
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
              <ShieldCheck className="size-4" /> Tutulmayanlar
            </div>
            Tam adres, kayıt kimliği, belge/müşteri/personel adı, arama ve form içeriği.
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
              <Clock3 className="size-4" /> Aktif süre
            </div>
            Arka plan sekmesi sayılmaz; beş dakika etkileşim olmazsa sayaç durur.
          </div>
        </CardContent>
      </Card>

      {analytics.trackingStartedAt && (
        <p className="text-center text-xs text-muted-foreground">
          Kullanım ölçümü bu kullanıcı için {formatDateTime(analytics.trackingStartedAt)} tarihinde başladı.
        </p>
      )}
    </div>
  );
}
