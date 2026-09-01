// Sadece development: AÇILIŞ PANOSUNU auth olmadan görsel test etmek için.
// Production'da 404 döner. (sales-preview / worklog-preview ile aynı desen.)
//
// FİKSTÜR GERÇEK BÜYÜKLÜKLERDEDİR ve bu bilinçlidir (personel önizlemesinin
// dersi): "MUHTELİF VİNÇLER" gibi kısa bir adla panoya bakmak, gerçek
// hayattaki "İSDEMİR AMONYUM SÜLFAT TESİSİ 2M³ KAPASİTELİ KEPÇELİ ÇİFT
// KİRİŞLİ TAVAN VİNCİ" satırının telefonda ne yaptığını GÖSTERMEZ. Uzun ad,
// çok kayıtlı gün ve geciken tarih burada bilerek vardır.
//
// SAYFA İKİ ROLÜ ÜST ÜSTE BASAR: yönetici (bütün bölümler, satış ve satın
// alma sinyalleri) ve teknik ressam (dar menü, sinyalsiz, "sana ait" dolu).
// Rol bazlı bir ekranı tek bir rolle sınamak, kesilen tarafı hiç görmemektir.
// Üçüncü blok İSKELETLERİ basar — Suspense yer tutucuları da görsel dilin
// parçasıdır ve zıplama (CLS) burada göz ile denetlenir.
//
// Bölümler `PanelView`in yuvalarına FİKSTÜRLE basılır — gerçek sayfa aynı
// yuvalara Suspense'li yükleyicileri koyar. Arama kutusuna `hits` fikstürü
// verilir: auth'suz sayfada `/api/command-index` 401 dönerdi.

import { notFound } from "next/navigation";
import { PanelView } from "@/app/(app)/panel/panel-view";
import { VARSAYILAN_PANEL_PREFS } from "@/lib/panel-prefs";
import { PanelSearch } from "@/app/(app)/panel/panel-search";
import { WorkspaceSection } from "@/app/(app)/panel/sections/workspace";
import { SignalsSection } from "@/app/(app)/panel/sections/signals";
import { AgendaSection } from "@/app/(app)/panel/sections/agenda";
import {
  NotificationsSection,
  type PanelNotificationRow,
} from "@/app/(app)/panel/sections/notifications";
import { MyDayRegion } from "@/app/(app)/panel/sections/my-day";
import type { MyTaskRow } from "@/app/(app)/panel/sections/my-tasks";
import { TodoWidget } from "@/app/(app)/panel/sections/todo-widget";
import type { TodoRow } from "@/lib/todos";
import { QuickActionsSection } from "@/app/(app)/panel/sections/quick-actions";
import {
  ActivitySection,
  type ActivityRow,
} from "@/app/(app)/panel/sections/activity";
import { SectionSkeleton } from "@/app/(app)/panel/sections/skeletons";
import type { MineRow, SectionCounts } from "@/app/(app)/panel/data";
import {
  panelSinyalleri,
  type PanelDate,
  type PanelHit,
} from "@/lib/panel";

const BUGUN = "2026-08-13";

const HITS: PanelHit[] = [
  {
    kind: "job",
    code: "0055",
    label: "İSDEMİR AMONYUM SÜLFAT TESİSİ 2M³ KAPASİTELİ KEPÇELİ ÇİFT KİRİŞLİ TAVAN VİNCİ",
    hint: "İSDEMİR A.Ş. · Aktif",
    href: "/jobs/1",
  },
  { kind: "job", code: "0057", label: "MUHTELİF VİNÇLER", hint: "ASTOR A.Ş. · Aktif", href: "/jobs/2" },
  {
    kind: "item",
    code: "0057-06",
    label: "1,0 T KAPASİTELİ PERGEL VİNÇ",
    hint: "MUHTELİF VİNÇLER",
    href: "/jobs/2",
  },
  { kind: "customer", code: "ASTOR", label: "ASTOR A.Ş.", hint: "9 iş", href: "/jobs" },
  {
    kind: "project",
    code: "0055-00",
    label: "AMONYUM SÜLFAT TESİSİ VİNCİ",
    href: "/projects/1",
  },
  { kind: "package", code: "0043-00-0000", label: "MTC PASLANMAZ", href: "/drawings/1" },
  {
    kind: "group",
    code: "0043-00-1000",
    label: "ELEKTRİK PANOSU",
    hint: "MTC PASLANMAZ",
    href: "/drawings/1/parts",
  },
];

const YONETICI_SINYALLER = panelSinyalleri([
  {
    key: "po-overdue",
    count: 3,
    label: "siparişin termini geçti, teslim alınmadı",
    href: "/purchasing/teslimat",
    tone: "uyari",
  },
  {
    key: "review",
    count: 12,
    label: "üretim kaydı revizyon sonrası kontrol bekliyor",
    href: "/drawings",
    tone: "uyari",
  },
  {
    key: "sales-unpriced",
    count: 18,
    label: "iş kaleminin fiyatı girilmedi",
    href: "/sales",
    tone: "bilgi",
  },
  // Sıfır sayan sinyal listeye GİRMEMELİ — önizleme bunu da gösterir.
  { key: "doc-expiry", count: 0, label: "personel belgesi", href: "/personnel", tone: "uyari" },
]);

// Ajanda HAM tarih listesi alır (pencereleme + tür çipleri bölümün içinde) —
// yedi türden altısı burada, çip şeridi ve gün sınırı göz ile denetlenir.
const YONETICI_TARIHLER: PanelDate[] = [
  // GECİKME: şeridin en üstünde ve kehribar.
  { date: "2026-08-10", kind: "Teslim", label: "SIP-2026-118", hint: "YILMAZ REDÜKTÖR", href: "/purchasing/teslimat" },
  { date: "2026-08-11", kind: "Görev", label: "0057", hint: "HALAT SİPARİŞİ TAKİBİ", href: "/jobs/2/gorevler" },
  { date: "2026-08-13", kind: "Termin", label: "0057-03", hint: "5 T KAPASİTELİ MONORAY VİNÇ", href: "/sales" },
  { date: "2026-08-14", kind: "Sevk", label: "0040-00", hint: "PANEL İMALATI", href: "/sales" },
  { date: "2026-08-14", kind: "Teslim", label: "SIP-2026-131", hint: "SIBRE", href: "/purchasing/teslimat" },
  { date: "2026-08-14", kind: "Yapılacak", label: "TEKLİF REVİZYONU — İSDEMİR EK KAPSAM", href: "/" },
  { date: "2026-08-14", kind: "İş Teslimi", label: "0059", hint: "GEZER VİNÇ", href: "/jobs/3" },
  { date: "2026-08-14", kind: "Atölye Çıkışı", label: "0060", hint: "MONORAY", href: "/jobs/4" },
  { date: "2026-08-14", kind: "Görev", label: "0055", hint: "KEPÇE HİDROLİK DEVRE ŞEMASI KONTROLÜ", href: "/jobs/1/gorevler" },
  { date: "2026-08-14", kind: "Termin", label: "0061-00", hint: "PERGEL VİNÇ", href: "/sales" },
  { date: "2026-08-18", kind: "Termin", label: "0055-00", hint: "İSDEMİR AMONYUM SÜLFAT TESİSİ VİNCİ", href: "/sales" },
  { date: "2026-09-02", kind: "Teslim", label: "SIP-2026-140", hint: "CONDUCTIX-WAMPFLER", href: "/purchasing/teslimat" },
];

const YONETICI_SAYAC: SectionCounts = {
  "/jobs": "62 iş · 4 aktif",
  "/projects": "31 rapor",
  "/drawings": "3 paket",
  "/purchasing": "17 açık sipariş",
  "/worklog": "212 kayıt · bu ay",
  "/sales": "88 kalem",
  "/personnel": "38 çalışan",
  "/admin": "5 kullanıcı",
};

// Ressamın satış ve satın alma sinyali YOKTUR; kalan tek sinyal teknik resim.
const RESSAM_SINYALLER = panelSinyalleri([
  {
    key: "review",
    count: 12,
    label: "üretim kaydı revizyon sonrası kontrol bekliyor",
    href: "/drawings",
    tone: "uyari",
  },
]);

const RESSAM_MINE: MineRow[] = [
  { code: "0100", name: "KÖPRÜ YÜRÜTME GRUBU", status: "ciziliyor", project: "AMONYUM SÜLFAT TESİSİ VİNCİ", href: "/projects/1" },
  { code: "0200", name: "ANA KİRİŞ", status: "kontrol", project: "AMONYUM SÜLFAT TESİSİ VİNCİ", href: "/projects/1" },
  { code: "1500", name: "ANA ARABA KOMPLESİ", status: "bekliyor", project: "MTC PASLANMAZ ÇİFT KİRİŞLİ TAVAN VİNCİ", href: "/projects/2" },
];

const RESSAM_SAYAC: SectionCounts = {
  "/jobs": "62 iş · 4 aktif",
  "/projects": "31 rapor",
  "/drawings": "3 paket",
};

// Benim Günüm fikstürü: geciken görev (kehribar), tarihsiz görev, favori —
// gecikme vurgusu ve kesilme burada göz ile denetlenir.
const GOREVLER: MyTaskRow[] = [
  {
    taskId: "t1",
    title: "HALAT SİPARİŞİ TAKİBİ — TEDARİKÇİ TEYİDİ ALINACAK",
    dueDate: "2026-08-11",
    jobId: "2",
    jobNo: "0057",
    jobTitle: "MUHTELİF VİNÇLER",
  },
  {
    taskId: "t2",
    title: "KEPÇE HİDROLİK DEVRE ŞEMASI KONTROLÜ",
    dueDate: "2026-08-15",
    jobId: "1",
    jobNo: "0055",
    jobTitle: "İSDEMİR AMONYUM SÜLFAT TESİSİ 2M³ KAPASİTELİ KEPÇELİ ÇİFT KİRİŞLİ TAVAN VİNCİ",
  },
  {
    taskId: "t3",
    title: "MONTAJ EKİBİ PLANI",
    dueDate: null,
    jobId: "2",
    jobNo: "0057",
    jobTitle: "MUHTELİF VİNÇLER",
  },
];

// Yapılacaklar fikstürü: geciken (kehribar), vadesiz ve tamamlanmış madde —
// üç hâl de göz ile denetlenir.
const MADDELER_ACIK: TodoRow[] = [
  {
    id: "m1",
    title: "TEKLİF REVİZYONU — İSDEMİR EK KAPSAM",
    note: "",
    dueDate: "2026-08-11",
    doneAt: null,
    sort: 0,
  },
  { id: "m2", title: "FUAR KAYDI", note: "", dueDate: null, doneAt: null, sort: 1 },
];
const MADDELER_TAMAM: TodoRow[] = [
  {
    id: "m3",
    title: "SİGORTA POLİÇESİ YENİLEME",
    note: "",
    dueDate: "2026-08-12",
    doneAt: "2026-08-12T15:00:00+03:00",
    sort: 2,
  },
];

// Son Hareketler fikstürü: durum geçişi (birincil), silinmiş iş (bağlantısız
// satır) ve görev olayı — üç hâl göz ile denetlenir.
const HAREKETLER: ActivityRow[] = [
  {
    id: "e1",
    jobId: "2",
    jobNo: "0057",
    event: "durum",
    detail: { from: "active", to: "completed" },
    actorName: "A. Kelleci",
    at: "2026-08-13T10:15:00+03:00",
  },
  {
    id: "e2",
    jobId: "1",
    jobNo: "0055",
    event: "gorev_atandi",
    detail: { title: "KEPÇE HİDROLİK DEVRE ŞEMASI KONTROLÜ" },
    actorName: "Sinan Çolakoğlu",
    at: "2026-08-13T09:40:00+03:00",
  },
  {
    id: "e3",
    jobId: null,
    jobNo: "0031",
    event: "silindi",
    detail: {},
    actorName: "Sinan Çolakoğlu",
    at: "2026-08-12T17:20:00+03:00",
  },
];

// Bildirim fikstürü: okunmamış (kalın + "yeni") ve okunmuş satır bir arada —
// vurgu farkı burada göz ile denetlenir.
const BILDIRIMLER: PanelNotificationRow[] = [
  {
    id: "b1",
    title: "0057 MUHTELİF VİNÇLER işinde size görev atandı: HALAT SİPARİŞİ TAKİBİ",
    href: "/jobs/2/gorevler",
    createdAt: "2026-08-13T09:12:00+03:00",
    readAt: null,
  },
  {
    id: "b2",
    title: "A. Kelleci bir yorumda sizi andı — 0055 İSDEMİR AMONYUM SÜLFAT TESİSİ VİNCİ",
    href: "/jobs/1/akis",
    createdAt: "2026-08-12T16:40:00+03:00",
    readAt: "2026-08-12T17:05:00+03:00",
  },
];

export default function PanelPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    // KABUK KELEPÇESİ TAKLİT EDİLİR: pano gerçekte `max-w-6xl` içinde
    // yaşıyor ve bölüm rayı o genişlikte ölçülmelidir.
    <main className="mx-auto grid max-w-6xl gap-12 p-4 sm:p-6">
      <section>
        <p className="oc-kicker mb-4 text-muted-foreground">Önizleme · Yönetici</p>
        {/* RAY YALNIZ BU KOPYADA: `prefs` verilince yuvalar çıpa kimliği
            alır ve sayfada iki `PanelView` olduğu için ikinci kopyada
            aynı kimlikler ÇAKIŞIRDI (`getElementById` hep ilkini bulur). */}
        <PanelView
          role="admin"
          prefs={VARSAYILAN_PANEL_PREFS}
          displayName="Sinan Çolakoğlu"
          today={BUGUN}
          search={<PanelSearch hits={HITS} />}
          sections={{
            hizli: <QuickActionsSection role="admin" />,
            gunum: (
              <MyDayRegion
                tasks={GOREVLER}
                taskTotal={7}
                favorites={[
                  { id: "1", jobNo: "0055", title: "İSDEMİR AMONYUM SÜLFAT TESİSİ VİNCİ" },
                  { id: "2", jobNo: "0057", title: "MUHTELİF VİNÇLER" },
                ]}
                mine={[]}
                today={BUGUN}
                todos={
                  <TodoWidget
                    acik={MADDELER_ACIK}
                    tamamlanan={MADDELER_TAMAM}
                    today={BUGUN}
                  />
                }
              />
            ),
            alan: <WorkspaceSection role="admin" counts={YONETICI_SAYAC} />,
            sinyal: <SignalsSection signals={YONETICI_SINYALLER} />,
            ajanda: <AgendaSection dates={YONETICI_TARIHLER} today={BUGUN} />,
            bildirim: <NotificationsSection rows={BILDIRIMLER} unreadCount={1} />,
            akis: <ActivitySection rows={HAREKETLER} />,
          }}
        />
      </section>

      <hr className="border-t-2 border-dashed" />

      <section>
        <p className="oc-kicker mb-4 text-muted-foreground">Önizleme · Teknik Ressam</p>
        <PanelView
          role="draftsman"
          displayName="Mehmet Yıldız"
          today={BUGUN}
          search={<PanelSearch hits={HITS} />}
          sections={{
            // Ressam yalnız herkese açık + çizim eylemlerini görür.
            hizli: <QuickActionsSection role="draftsman" />,
            // Ressamda görev/favori yok, yalnız "sana ait" resimler dolu —
            // bölgenin tek çeyrekli hâli burada sınanır.
            gunum: (
              <MyDayRegion
                tasks={[]}
                taskTotal={0}
                favorites={[]}
                mine={RESSAM_MINE}
                today={BUGUN}
              />
            ),
            alan: <WorkspaceSection role="draftsman" counts={RESSAM_SAYAC} />,
            sinyal: <SignalsSection signals={RESSAM_SINYALLER} />,
            // Tarihli kayıtların tamamı satış/satın alma tarafındadır:
            // ressamın şeridi BOŞTUR ve boş durum burada sınanır.
            ajanda: <AgendaSection dates={[]} today={BUGUN} />,
            // Boş bildirim ve boş akış durumları burada sınanır.
            bildirim: <NotificationsSection rows={[]} unreadCount={0} />,
            akis: <ActivitySection rows={[]} />,
          }}
        />
      </section>

      <hr className="border-t-2 border-dashed" />

      <section>
        <p className="oc-kicker mb-4 text-muted-foreground">Önizleme · İskeletler</p>
        <div className="grid gap-8">
          <SectionSkeleton baslik="Çalışma Alanı" rows={6} satir="h-16" />
          <div className="grid items-start gap-8 lg:grid-cols-2">
            <SectionSkeleton baslik="Dikkat İsteyenler" rows={3} />
            <SectionSkeleton baslik="Yaklaşan" rows={4} />
          </div>
        </div>
      </section>
    </main>
  );
}
