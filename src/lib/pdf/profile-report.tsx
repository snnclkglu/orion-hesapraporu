// YÖNETİM PROFİL RAPORLARI — kullanıcı etkinliği ve müşteri ilişkisi.
//
// İki belge aynı Orion marka anatomisini kullanır: kırmızı omurga, onaylı
// lockup, Archivo/Plex Mono, künye ve folio. Web profilleriyle aynı saf analiz
// çekirdeklerini çağırır; ekrandaki puan ile indirilen PDF ayrışamaz.

import { Document, Image, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import {
  BRAND,
  BrandBand,
  BrandPage,
  FONTS,
  PageHeader,
  SectionTag,
  T,
  trUpper,
  type CompanyInfo,
} from "@/lib/pdf/brand";
import { roleLabel } from "@/lib/roles";
import {
  USAGE_DEVICE_LABELS,
  USAGE_SECTION_LABELS,
  auditActionLabel,
  buildUsageAnalytics,
  formatUsageDuration,
  type UsageMetricRow,
} from "@/lib/usage";
import type { ManagedUserProfile, UserAuditEvent } from "@/app/(app)/admin/users/[id]/user-profile-view";
import type { UserScoreSettings, CustomerScoreSettings } from "@/lib/profile-scoring";
import { buildCustomerProfileAnalytics, type CustomerProfileDataset, type CustomerProfileOffer } from "@/lib/customer-profile";
import { OFFER_STATUS_LABELS, offerStatusOf } from "@/lib/offers/status";
import { JOB_STATUS_LABELS, jobStatusOf } from "@/lib/job-status";

const S = StyleSheet.create({
  identity: { flexDirection: "row", alignItems: "stretch", marginBottom: 12 },
  identityMain: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, backgroundColor: BRAND.paper100, padding: 12 },
  identityMark: { width: 78, flexShrink: 0, alignItems: "center", justifyContent: "center", backgroundColor: BRAND.ink },
  initials: { fontFamily: FONTS.sans, fontSize: 22, fontWeight: 800, color: BRAND.paper100 },
  identityName: { fontFamily: FONTS.sans, fontSize: 15, fontWeight: 800, color: BRAND.ink, lineHeight: 1.15 },
  identityMeta: { ...T.caption, marginTop: 4 },
  scorePanel: { width: 110, flexShrink: 0, padding: 10, justifyContent: "center", alignItems: "flex-end", borderLeftWidth: 3, borderLeftColor: BRAND.red, backgroundColor: BRAND.paper50 },
  scoreValue: { fontFamily: FONTS.mono, fontSize: 22, fontWeight: 600, color: BRAND.red },
  scoreLabel: { ...T.kickerInk, marginTop: 2 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  metric: { width: "32.3%", minHeight: 47, borderWidth: 1, borderColor: BRAND.line300, padding: 7 },
  metricLabel: { ...T.kickerInk, fontSize: 6.1 },
  metricValue: { fontFamily: FONTS.mono, fontSize: 13, fontWeight: 600, color: BRAND.ink, marginTop: 4 },
  metricHint: { ...T.micro, marginTop: 2 },
  split: { flexDirection: "row", gap: 12 },
  half: { flexGrow: 1, flexBasis: 0 },
  scoreRow: { marginBottom: 8 },
  scoreRowHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  scoreTrack: { height: 5, backgroundColor: BRAND.paper200 },
  scoreFill: { height: 5, backgroundColor: BRAND.red },
  note: { ...T.caption, backgroundColor: BRAND.paper100, borderLeftWidth: 2, borderLeftColor: BRAND.steel, padding: 7, marginTop: 8 },
  table: { borderWidth: 1, borderColor: BRAND.line300, marginBottom: 12 },
  tableHeader: { flexDirection: "row", backgroundColor: BRAND.ink },
  tableHead: { fontFamily: FONTS.mono, fontSize: 6.2, fontWeight: 600, color: BRAND.paper100, letterSpacing: 0.5, paddingVertical: 4, paddingHorizontal: 4 },
  tableRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: BRAND.hairline, minHeight: 22 },
  tableCell: { ...T.caption, paddingVertical: 4, paddingHorizontal: 4 },
  monoCell: { fontFamily: FONTS.mono, fontSize: 7, color: BRAND.ink, paddingVertical: 4, paddingHorizontal: 4 },
  stripRow: { marginBottom: 7 },
  stripHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  stripTrack: { height: 6, backgroundColor: BRAND.paper200 },
  stripRed: { height: 6, backgroundColor: BRAND.red },
  stripSteel: { height: 6, backgroundColor: BRAND.steel },
  dayChart: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 92, borderBottomWidth: 1, borderBottomColor: BRAND.line350, paddingTop: 8 },
  dayColumn: { flexGrow: 1, flexBasis: 0, justifyContent: "flex-end", alignItems: "stretch", height: "100%" },
  dayBar: { backgroundColor: BRAND.red, minHeight: 1 },
  dayLabel: { ...T.micro, fontSize: 4.9, textAlign: "center", marginTop: 3 },
  currencyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  currency: { width: "32.3%", borderLeftWidth: 3, borderLeftColor: BRAND.red, backgroundColor: BRAND.paper100, padding: 8 },
  contact: { borderWidth: 1, borderColor: BRAND.line300, padding: 7, marginBottom: 5 },
  contactHead: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  tag: { fontFamily: FONTS.mono, fontSize: 6, fontWeight: 600, color: BRAND.redDeep, backgroundColor: BRAND.redPale, paddingVertical: 2, paddingHorizontal: 4 },
});

const dateFormat = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "medium" });
const dateTimeFormat = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "short", timeStyle: "short" });
const numberFormat = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });
const percentFormat = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 1 });

function dateText(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormat.format(date);
}

function dateTimeText(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTimeFormat.format(date);
}

function initials(name: string, fallback: string): string {
  return (name.trim() || fallback.split("@")[0] || "K")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("tr-TR");
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={S.metric} wrap={false}>
      <Text style={S.metricLabel}>{trUpper(label)}</Text>
      <Text style={S.metricValue}>{value}</Text>
      {hint ? <Text style={S.metricHint}>{hint}</Text> : null}
    </View>
  );
}

function ScoreRow({ label, value, max, hint }: { label: string; value: number; max: number; hint: string }) {
  const width = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <View style={S.scoreRow} wrap={false}>
      <View style={S.scoreRowHead}>
        <Text style={T.body}>{label}</Text>
        <Text style={T.data}>{value} / {max}</Text>
      </View>
      <View style={S.scoreTrack}><View style={[S.scoreFill, { width: `${width}%` }]} /></View>
      <Text style={{ ...T.micro, marginTop: 2 }}>{hint}</Text>
    </View>
  );
}

function ProfilePage({
  title,
  kicker,
  docCode,
  generatedAt,
  company,
  children,
}: {
  title: string;
  kicker: string;
  docCode: string;
  generatedAt: string;
  company: CompanyInfo;
  children: React.ReactNode;
}) {
  return (
    <BrandPage docLine={trUpper(`Orion Cranes · ${title}`)} docCode={docCode} company={company}>
      <BrandBand docCode={docCode} lines={[generatedAt]} logoWidth={130} />
      <PageHeader kicker={kicker} title={title} meta={generatedAt} />
      {children}
    </BrandPage>
  );
}

export interface UserProfilePdfProps {
  profile: ManagedUserProfile;
  usageRows: UsageMetricRow[];
  auditEvents: UserAuditEvent[];
  actionCount30: number;
  nowIso: string;
  scoring: UserScoreSettings;
  company: CompanyInfo;
}

export function UserProfileDocument(props: UserProfilePdfProps) {
  const now = new Date(props.nowIso);
  const analytics = buildUsageAnalytics(props.usageRows, now, props.scoring);
  const generatedAt = dateTimeText(props.nowIso);
  const docCode = `ORC-KP-${props.profile.id.slice(0, 8).toLocaleUpperCase("tr-TR")}`;
  const peak = Math.max(1, ...analytics.daily14.map((day) => day.activeSeconds));
  return (
    <Document title={`${props.profile.fullName || props.profile.email} — Kullanıcı Profil Raporu`} author="Orion Cranes" subject={docCode}>
      <ProfilePage title="Kullanıcı Profil Raporu" kicker="Yönetim · Etkinlik Özeti" docCode={docCode} generatedAt={generatedAt} company={props.company}>
        <View style={S.identity} wrap={false}>
          <View style={S.identityMark}><Text style={S.initials}>{initials(props.profile.fullName, props.profile.email)}</Text></View>
          <View style={S.identityMain}>
            <Text style={S.identityName}>{props.profile.fullName || props.profile.email || "Kullanıcı"}</Text>
            <Text style={S.identityMeta}>{props.profile.email || "—"}</Text>
            <Text style={S.identityMeta}>{props.profile.title || "Unvan belirtilmemiş"} · {roleLabel(props.profile.role)}</Text>
            <Text style={S.identityMeta}>Hesap açılışı · {dateText(props.profile.createdAt)}</Text>
          </View>
          <View style={S.scorePanel}>
            <Text style={S.metricLabel}>KULLANIM PUANI</Text>
            <Text style={S.scoreValue}>{analytics.score ? `${analytics.score.total}/100` : "—"}</Text>
            <Text style={S.scoreLabel}>{analytics.score?.label ?? "VERİ BEKLENİYOR"}</Text>
          </View>
        </View>
        <View style={S.metricGrid}>
          <Metric label="Aktif Süre · 30 Gün" value={formatUsageDuration(analytics.last30.activeSeconds)} hint={`${formatUsageDuration(analytics.allTime.activeSeconds)} toplam`} />
          <Metric label="Aktif Gün" value={String(analytics.last30.activeDays)} hint="Son 30 takvim günü" />
          <Metric label="Oturum" value={String(analytics.last30.sessionCount)} hint="30 dk boşlukta yenilenir" />
          <Metric label="Sayfa Geçişi" value={String(analytics.last30.pageViews)} hint="Tam adres saklanmaz" />
          <Metric label="Kayıtlı İşlem" value={String(props.actionCount30)} hint="Denetim izinde son 30 gün" />
          <Metric label="Son Görülme" value={dateTimeText(analytics.lastSeenAt)} hint={analytics.currentlyActive ? "Şu anda aktif" : "Son etkin sinyal"} />
        </View>
        <View style={S.split}>
          <View style={S.half}>
            <SectionTag no="01" title="14 Günlük Aktif Süre" />
            <View style={S.dayChart}>
              {analytics.daily14.map((day, index) => (
                <View key={day.date} style={S.dayColumn}>
                  <View style={[S.dayBar, { height: `${Math.max((day.activeSeconds / peak) * 100, day.activeSeconds > 0 ? 2 : 0)}%` }]} />
                  <Text style={S.dayLabel}>{index % 2 === 0 ? day.date.slice(5) : ""}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={S.half}>
            <SectionTag no="02" title="Puan Bileşenleri" />
            {analytics.score ? (
              <>
                <ScoreRow label="Güncellik" value={analytics.score.recency} max={props.scoring.recencyWeight} hint="Son kullanımın yakınlığı." />
                <ScoreRow label="Düzenlilik" value={analytics.score.consistency} max={props.scoring.consistencyWeight} hint={`Tam puan: ${props.scoring.activeDaysTarget} aktif gün.`} />
                <ScoreRow label="Aktif kullanım" value={analytics.score.engagement} max={props.scoring.engagementWeight} hint={`Tam puan: ${props.scoring.activeHoursTarget} aktif saat.`} />
              </>
            ) : <Text style={T.caption}>İlk kullanım kaydı bekleniyor.</Text>}
          </View>
        </View>
        <Text style={S.note}>Bu puan iş performansı veya verimlilik notu değildir. Yalnız uygulamaya dönüş düzeni ile arka plan ve boşta kalma süresi çıkarılmış etkin kullanımı özetler.</Text>
      </ProfilePage>

      <ProfilePage title="Kullanım Dağılımı" kicker="Kullanıcı Profili · Bölüm ve Cihaz" docCode={docCode} generatedAt={generatedAt} company={props.company}>
        <View style={S.split}>
          <View style={S.half}>
            <SectionTag no="03" title="Bölümler · Son 30 Gün" />
            {analytics.sections30.length ? analytics.sections30.map((item) => (
              <View key={item.section} style={S.stripRow} wrap={false}>
                <View style={S.stripHead}><Text style={T.caption}>{USAGE_SECTION_LABELS[item.section]}</Text><Text style={T.data}>{formatUsageDuration(item.activeSeconds)} · %{Math.round(item.ratio * 100)}</Text></View>
                <View style={S.stripTrack}><View style={[S.stripRed, { width: `${Math.max(item.ratio * 100, 1)}%` }]} /></View>
              </View>
            )) : <Text style={T.caption}>Kullanım kaydı yok.</Text>}
          </View>
          <View style={S.half}>
            <SectionTag no="04" title="Cihazlar · Son 30 Gün" />
            {analytics.devices30.length ? analytics.devices30.map((item) => (
              <View key={item.device} style={S.stripRow} wrap={false}>
                <View style={S.stripHead}><Text style={T.caption}>{USAGE_DEVICE_LABELS[item.device]}</Text><Text style={T.data}>{formatUsageDuration(item.activeSeconds)} · {item.sessionCount} oturum</Text></View>
                <View style={S.stripTrack}><View style={[S.stripSteel, { width: `${Math.max(item.ratio * 100, 1)}%` }]} /></View>
              </View>
            )) : <Text style={T.caption}>Cihaz kaydı yok.</Text>}
          </View>
        </View>
        <SectionTag no="05" title="Yakın Oturumlar" />
        <View style={S.table}>
          <View style={S.tableHeader} fixed>
            <Text style={[S.tableHead, { width: "23%" }]}>BAŞLANGIÇ</Text><Text style={[S.tableHead, { width: "23%" }]}>SON SİNYAL</Text><Text style={[S.tableHead, { width: "17%" }]}>SÜRE</Text><Text style={[S.tableHead, { width: "17%" }]}>CİHAZ</Text><Text style={[S.tableHead, { width: "20%" }]}>ANA BÖLÜM</Text>
          </View>
          {analytics.recentSessions.map((session) => (
            <View key={session.sessionId} style={S.tableRow} wrap={false}>
              <Text style={[S.monoCell, { width: "23%" }]}>{dateTimeText(session.startedAt)}</Text><Text style={[S.monoCell, { width: "23%" }]}>{dateTimeText(session.lastSeenAt)}</Text><Text style={[S.monoCell, { width: "17%" }]}>{formatUsageDuration(session.activeSeconds)}</Text><Text style={[S.tableCell, { width: "17%" }]}>{USAGE_DEVICE_LABELS[session.device]}</Text><Text style={[S.tableCell, { width: "20%" }]}>{USAGE_SECTION_LABELS[session.primarySection]}</Text>
            </View>
          ))}
        </View>
        <Text style={S.note}>Gizlilik sınırı: tam sayfa adresi, kayıt kimliği, müşteri/proje adı, arama metni ve form içeriği toplanmaz. Takip yalnız ana bölüm, cihaz sınıfı, sayfa geçişi ve etkin saniye tutar.</Text>
      </ProfilePage>

      <ProfilePage title="İşlem Geçmişi" kicker="Kullanıcı Profili · Denetim İzi" docCode={docCode} generatedAt={generatedAt} company={props.company}>
        <SectionTag no="06" title="Yakın Kayıtlı İşlemler" />
        <View style={S.table}>
          <View style={S.tableHeader} fixed><Text style={[S.tableHead, { width: "30%" }]}>TARİH</Text><Text style={[S.tableHead, { width: "70%" }]}>ÖZET</Text></View>
          {props.auditEvents.length ? props.auditEvents.map((event) => (
            <View key={String(event.id)} style={S.tableRow} wrap={false}><Text style={[S.monoCell, { width: "30%" }]}>{dateTimeText(event.createdAt)}</Text><Text style={[S.tableCell, { width: "70%" }]}>{auditActionLabel(event.action)}</Text></View>
          )) : <View style={S.tableRow}><Text style={[S.tableCell, { width: "100%" }]}>Kayıtlı işlem yok.</Text></View>}
        </View>
        <SectionTag no="07" title="Yorumlama Sınırı" />
        <Text style={T.body}>Etkin süre, sayfanın görünür olduğu ve kullanıcının son beş dakika içinde klavye, dokunma veya kaydırma etkileşimi bulunduğu aralıktır. Arka plan sekmeleri ile boşta geçen süre hesaba katılmaz. Otuz dakikalık boşluk yeni bir oturum başlatır.</Text>
        <Text style={S.note}>Rapor yönetim amaçlı bir kullanım görünümüdür. Çalışanın üretkenliği, iş kalitesi veya kuruma katkısı hakkında tek başına karar vermek için kullanılamaz.</Text>
      </ProfilePage>
    </Document>
  );
}

export interface CustomerProfilePdfProps {
  data: CustomerProfileDataset;
  nowIso: string;
  scoring: CustomerScoreSettings;
  company: CompanyInfo;
  customerLogo?: Buffer | null;
}

function chunksOf<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result.length ? result : [[]];
}

function OfferTable({ offers, emptyText = "Bu müşteriye bağlı teklif yok." }: { offers: CustomerProfileOffer[]; emptyText?: string }) {
  return (
    <View style={S.table}>
      <View style={S.tableHeader}>
        <Text style={[S.tableHead, { width: "17%" }]}>TEKLİF NO</Text>
        <Text style={[S.tableHead, { width: "38%" }]}>KONU</Text>
        <Text style={[S.tableHead, { width: "14%" }]}>DURUM</Text>
        <Text style={[S.tableHead, { width: "15%" }]}>TARİH</Text>
        <Text style={[S.tableHead, { width: "16%", textAlign: "right" }]}>TUTAR</Text>
      </View>
      {offers.length ? offers.map((offer) => (
        <View key={offer.id} style={S.tableRow} wrap={false}>
          <Text style={[S.monoCell, { width: "17%" }]}>{offer.offerNo || "—"}</Text>
          <Text style={[S.tableCell, { width: "38%" }]}>{offer.subject || "—"}</Text>
          <Text style={[S.tableCell, { width: "14%" }]}>{OFFER_STATUS_LABELS[offerStatusOf(offer.status)]}</Text>
          <Text style={[S.monoCell, { width: "15%" }]}>{dateText(offer.issuedOn || offer.issueDate || offer.createdAt)}</Text>
          <Text style={[S.monoCell, { width: "16%", textAlign: "right" }]}>{offer.latestTotal === null ? "—" : `${numberFormat.format(offer.latestTotal)} ${offer.currency}`}</Text>
        </View>
      )) : <View style={S.tableRow}><Text style={[S.tableCell, { width: "100%" }]}>{emptyText}</Text></View>}
    </View>
  );
}

export function CustomerProfileDocument(props: CustomerProfilePdfProps) {
  const analytics = buildCustomerProfileAnalytics(props.data, new Date(props.nowIso), props.scoring);
  const generatedAt = dateTimeText(props.nowIso);
  const docCode = `ORC-MP-${props.data.customer.id.slice(0, 8).toLocaleUpperCase("tr-TR")}`;
  const c = props.data.customer;
  const score = analytics.score;
  const offerChunks = chunksOf(props.data.offers, 15);
  return (
    <Document title={`${c.name} — Müşteri Profil Raporu`} author="Orion Cranes" subject={docCode}>
      <ProfilePage title="Müşteri Profil Raporu" kicker="Yönetim · Ticari İlişki Özeti" docCode={docCode} generatedAt={generatedAt} company={props.company}>
        <View style={S.identity} wrap={false}>
          <View style={[S.identityMark, { backgroundColor: BRAND.paper100 }]}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- React-PDF Image is not a browser img element. */}
            {props.customerLogo ? <Image src={props.customerLogo} style={{ width: 62, height: 52, objectFit: "contain" }} /> : <Text style={{ ...S.initials, color: BRAND.ink }}>{initials(c.shortName || c.name, "M")}</Text>}
          </View>
          <View style={S.identityMain}>
            <Text style={S.identityName}>{c.name}</Text>
            <Text style={S.identityMeta}>{c.address || "Adres belirtilmemiş"}</Text>
            <Text style={S.identityMeta}>{[c.taxOffice, c.taxNo].filter(Boolean).join(" · ") || "Vergi bilgisi belirtilmemiş"}</Text>
            <Text style={S.identityMeta}>{[c.phone, c.fax].filter(Boolean).join(" · ") || "Telefon belirtilmemiş"}</Text>
          </View>
          <View style={S.scorePanel}>
            <Text style={S.metricLabel}>İLİŞKİ PUANI</Text><Text style={S.scoreValue}>{score.total}/100</Text><Text style={S.scoreLabel}>{trUpper(score.label)}</Text>
          </View>
        </View>
        <View style={S.metricGrid}>
          <Metric label="Teklif" value={String(props.data.offers.length)} hint={`${analytics.annualOfferCount} adedi son 12 ay`} />
          <Metric label="Kazanılan" value={String(analytics.wonOfferCount)} hint="Kazanıldı durumundaki teklifler" />
          <Metric label="Kazanım" value={analytics.conversionRatio === null ? "—" : percentFormat.format(analytics.conversionRatio)} hint="Kazanılan / sonuçlanan" />
          <Metric label="Aktif İş" value={String(analytics.activeJobCount)} hint={`${props.data.jobs.length} bağlı iş`} />
          <Metric label="Mühendislik Projesi" value={String(props.data.projects.length)} hint="Bağlı işler üzerinden" />
          <Metric label="Kayıt Bütünlüğü" value={`${analytics.completenessFilled}/${analytics.completenessTotal}`} hint={analytics.completenessMissing.length ? `Eksik ${analytics.completenessMissing.length} alan` : "Temel bilgiler tamam"} />
        </View>
        <View style={S.split}>
          <View style={S.half}>
            <SectionTag no="01" title="Puan Bileşenleri" />
            <ScoreRow label="Güncellik" value={score.recency} max={props.scoring.recencyWeight} hint={`Pencere ${props.scoring.recencyWindowDays} gün; son hareket ${dateText(analytics.lastActivityAt)}.`} />
            <ScoreRow label="Teklif etkinliği" value={score.offerActivity} max={props.scoring.offerActivityWeight} hint={`Tam puan: son 12 ay ${props.scoring.annualOfferTarget} teklif.`} />
            <ScoreRow label="Kazanım" value={score.conversion} max={props.scoring.conversionWeight} hint={analytics.conversionRatio === null ? "Sonuçlanan teklif yok." : percentFormat.format(analytics.conversionRatio)} />
            <ScoreRow label="Aktif işler" value={score.activeWork} max={props.scoring.activeWorkWeight} hint={`Tam puan: ${props.scoring.activeJobTarget} aktif iş.`} />
            <ScoreRow label="Kayıt bütünlüğü" value={score.completeness} max={props.scoring.completenessWeight} hint={analytics.completenessMissing.join(", ") || "Temel bilgiler tamam."} />
          </View>
          <View style={S.half}>
            <SectionTag no="02" title="Firma Künyesi" />
            {[
              ["Kısaltma", c.shortName], ["Vergi dairesi", c.taxOffice], ["Vergi no", c.taxNo], ["Telefon", c.phone], ["Faks", c.fax], ["Deftere eklenme", dateText(c.createdAt)], ["Son güncelleme", dateText(c.updatedAt)],
            ].map(([label, value]) => <View key={label} style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BRAND.hairline, paddingVertical: 4 }}><Text style={{ ...T.kickerInk, width: "42%" }}>{trUpper(label)}</Text><Text style={{ ...T.body, width: "58%" }}>{value || "—"}</Text></View>)}
            <Text style={S.note}>Puan finansal risk, ödeme davranışı veya müşteri memnuniyeti değerlendirmesi değildir.</Text>
          </View>
        </View>
      </ProfilePage>

      <ProfilePage title="Teklif Analizi" kicker="Müşteri Profili · Ticari Kayıt" docCode={docCode} generatedAt={generatedAt} company={props.company}>
        <SectionTag no="03" title="Para Birimi Bazında Teklif Tutarları" />
        <View style={S.currencyGrid}>
          {analytics.quotedTotalsByCurrency.length ? analytics.quotedTotalsByCurrency.map((item) => (
            <View key={item.currency} style={S.currency} wrap={false}><Text style={S.metricLabel}>{item.currency} · {item.count} TEKLİF</Text><Text style={S.metricValue}>{numberFormat.format(item.total)} {item.currency}</Text></View>
          )) : <Text style={T.caption}>Tutarı bulunan teklif yok.</Text>}
        </View>
        <SectionTag no="04" title="Teklif Durum Dağılımı" />
        {Object.entries(analytics.offerStatusCounts).filter(([, value]) => value > 0).map(([status, value]) => (
          <View key={status} style={S.stripRow} wrap={false}><View style={S.stripHead}><Text style={T.caption}>{OFFER_STATUS_LABELS[status as keyof typeof OFFER_STATUS_LABELS]}</Text><Text style={T.data}>{value} · %{Math.round((value / Math.max(props.data.offers.length, 1)) * 100)}</Text></View><View style={S.stripTrack}><View style={[S.stripRed, { width: `${Math.max((value / Math.max(props.data.offers.length, 1)) * 100, 1)}%` }]} /></View></View>
        ))}
        <SectionTag no="05" title="Teklifler" />
        <OfferTable offers={offerChunks[0]} />
      </ProfilePage>

      {offerChunks.slice(1).map((offers, index) => (
        <ProfilePage key={`offers-${index + 2}`} title={`Teklifler · Devam ${index + 2}`} kicker="Müşteri Profili · Ticari Kayıt" docCode={docCode} generatedAt={generatedAt} company={props.company}>
          <SectionTag no={`05.${index + 2}`} title="Teklif Listesi Devam" />
          <OfferTable offers={offers} />
        </ProfilePage>
      ))}

      <ProfilePage title="İşler ve Projeler" kicker="Müşteri Profili · Operasyon" docCode={docCode} generatedAt={generatedAt} company={props.company}>
        <SectionTag no="06" title="Alınan İşler" />
        <View style={S.table}>
          <View style={S.tableHeader} fixed><Text style={[S.tableHead, { width: "18%" }]}>İŞ NO</Text><Text style={[S.tableHead, { width: "47%" }]}>İŞİN ADI</Text><Text style={[S.tableHead, { width: "17%" }]}>DURUM</Text><Text style={[S.tableHead, { width: "18%" }]}>İŞ EMRİ</Text></View>
          {props.data.jobs.length ? props.data.jobs.map((job) => <View key={job.id} style={S.tableRow} wrap={false}><Text style={[S.monoCell, { width: "18%" }]}>{job.jobNo || "—"}</Text><Text style={[S.tableCell, { width: "47%" }]}>{job.title || "—"}</Text><Text style={[S.tableCell, { width: "17%" }]}>{JOB_STATUS_LABELS[jobStatusOf(job.status)]}</Text><Text style={[S.monoCell, { width: "18%" }]}>{dateText(job.workOrderDate || job.createdAt)}</Text></View>) : <View style={S.tableRow}><Text style={[S.tableCell, { width: "100%" }]}>Bağlı iş yok.</Text></View>}
        </View>
        <SectionTag no="07" title="Mühendislik Projeleri" />
        <View style={S.table}>
          <View style={S.tableHeader} fixed><Text style={[S.tableHead, { width: "22%" }]}>DOKÜMAN NO</Text><Text style={[S.tableHead, { width: "48%" }]}>PROJE</Text><Text style={[S.tableHead, { width: "15%" }]}>DURUM</Text><Text style={[S.tableHead, { width: "15%" }]}>AÇILIŞ</Text></View>
          {props.data.projects.length ? props.data.projects.map((project) => <View key={project.id} style={S.tableRow} wrap={false}><Text style={[S.monoCell, { width: "22%" }]}>{project.docNo || "—"}</Text><Text style={[S.tableCell, { width: "48%" }]}>{project.name || "—"}</Text><Text style={[S.tableCell, { width: "15%" }]}>{project.status === "archived" ? "Arşiv" : "Aktif"}</Text><Text style={[S.monoCell, { width: "15%" }]}>{dateText(project.createdAt)}</Text></View>) : <View style={S.tableRow}><Text style={[S.tableCell, { width: "100%" }]}>Bağlı mühendislik projesi yok.</Text></View>}
        </View>
        <Text style={S.note}>Projeler ad benzerliğiyle değil, yalnız müşteriye bağlı iş kimlikleri üzerinden listelenir. Bu sınır benzer unvanlı müşteri kayıtlarının karışmasını önler.</Text>
      </ProfilePage>

      <ProfilePage title="İletişim ve Notlar" kicker="Müşteri Profili · Firma Defteri" docCode={docCode} generatedAt={generatedAt} company={props.company}>
        <SectionTag no="08" title="İletişim Kişileri" />
        {props.data.contacts.length ? props.data.contacts.map((contact) => (
          <View key={contact.id} style={[S.contact, !contact.active ? { opacity: 0.55 } : {}]} wrap={false}>
            <View style={S.contactHead}><Text style={T.subhead}>{contact.name}</Text><View style={{ flexDirection: "row", gap: 4 }}>{contact.isPrimary ? <Text style={S.tag}>BİRİNCİL</Text> : null}{!contact.active ? <Text style={S.tag}>PASİF</Text> : null}</View></View>
            <Text style={{ ...T.caption, marginTop: 2 }}>{[contact.title, contact.department].filter(Boolean).join(" · ") || "Unvan/bölüm belirtilmemiş"}</Text>
            <Text style={{ ...T.micro, marginTop: 3 }}>{[contact.phone, contact.email].filter(Boolean).join(" · ") || "İletişim bilgisi belirtilmemiş"}</Text>
            {contact.note ? <Text style={{ ...T.caption, marginTop: 3 }}>{contact.note}</Text> : null}
          </View>
        )) : <Text style={T.caption}>İletişim kişisi kaydı yok.</Text>}
        <SectionTag no="09" title="Müşteri Notu" />
        <Text style={T.body}>{c.notes || "Müşteri notu girilmemiş."}</Text>
        <SectionTag no="10" title="Puanlama Yöntemi" />
        <Text style={T.body}>İlişki puanı güncellik, son on iki aydaki teklif etkinliği, sonuçlanmış tekliflerin kazanım oranı, aktif iş sayısı ve temel müşteri bilgilerinin doluluğundan oluşur. Ağırlıklar Yönetim › Profil Puanlama ekranından değiştirilir ve rapor üretildiği anda yeniden hesaplanır.</Text>
        <Text style={S.note}>Farklı para birimleri kur dönüşümü yapılmadan ayrı tutulur. Rapor finansal risk, ödeme davranışı veya müşteri memnuniyeti hakkında kayıt dışı varsayım üretmez.</Text>
      </ProfilePage>
    </Document>
  );
}

export function renderUserProfilePdf(props: UserProfilePdfProps): Promise<Buffer> {
  return renderToBuffer(<UserProfileDocument {...props} />);
}

export function renderCustomerProfilePdf(props: CustomerProfilePdfProps): Promise<Buffer> {
  return renderToBuffer(<CustomerProfileDocument {...props} />);
}
