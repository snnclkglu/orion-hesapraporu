// Sadece development: proje detayının iki etkileşimli parçasını auth olmadan
// görsel test etmek için. Production'da 404 döner.
//
// Sayfanın KENDİ markup'ı kopyalanmaz — buradaki bileşenler gerçek sayfanın
// kullandığı bileşenlerin ta kendisidir; kopya bir düzen zamanla gerçeğinden
// ayrışır ve önizleme yanlış güven verirdi. Sunucu eylemleri sahte kimlikle
// hata döner; amaç yerleşim ve metinlerin gözle doğrulanmasıdır.

import { notFound } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { revisionStatusLabel, revisionStatusVariant } from "@/lib/revision-status";
import { ProjectSignatoryCard, type SignatoryOption } from "@/app/(app)/projects/[id]/signatory-card";
import { DeleteRevisionButton } from "@/app/(app)/projects/[id]/delete-revision-button";
import { Tabs } from "@/components/ui/tabs";
import { ProjectDetailHeader } from "@/app/(app)/projects/[id]/project-header";
import { ProjectTabsNav } from "@/app/(app)/projects/[id]/project-tabs";
import { DrawingPlanCard } from "@/app/(app)/projects/[id]/drawing-plan-card";
import type { DrawingAuthor, DrawingPlanRow } from "@/lib/drawing-plan";

const PEOPLE: SignatoryOption[] = [
  { id: "p1", full_name: "Alkım Kelleci", role: "engineer" },
  { id: "p2", full_name: "Sinan Çolakoğlu", role: "admin" },
];

// Başlık bloğu gerçek sayfadakiyle AYNI genişlik kabında ölçülmelidir:
// `/projects/<id>` geniş sayfa DEĞİLDİR, app-shell ona `max-w-6xl` (1152px)
// verir. Eylem şeridinin sağa dayanması tam da bu genişlikte sınanır.
/**
 * Teknik Resim Takibi fikstürü — gerçek 0055 antedinden. DÖRT bandı da taşır ki
 * bant başlıkları ve kod aralıkları gözle görülebilsin; durumlar da farklıdır,
 * yoksa başlıktaki ilerleme çubuğu ya %0 ya %100 görünür ve ara değerin nasıl
 * çizildiği hiç sınanmazdı.
 */
const DRAWING_AUTHORS: DrawingAuthor[] = [
  // ÖNCE RESSAMLAR — gerçek sıra `loadDrawingAuthors`tan gelir; fikstür onu
  // taklit eder ki grup başlıklarının düzeni gözle sınanabilsin.
  { id: "p1", name: "Mehmet Yıldız", role: "draftsman" },
  { id: "p2", name: "Zeynep Arslan", role: "draftsman" },
  { id: "p3", name: "Alkım Kelleci", role: "engineer" },
];

const DRAWING_PLAN: DrawingPlanRow[] = [
  { id: "d1", code: "0100", name: "KÖPRÜ YÜRÜTME GRUBU", status: "cizildi", drawnBy: "p1", drawnByName: "Mehmet Yıldız", note: "" },
  { id: "d2", code: "0200", name: "ANA KİRİŞ", status: "kontrol", drawnBy: "p1", drawnByName: "Mehmet Yıldız", note: "2 adet" },
  { id: "d3", code: "0300", name: "BAŞKİRİŞ", status: "ciziliyor", drawnBy: "p2", drawnByName: "Zeynep Arslan", note: "" },
  { id: "d4", code: "1500", name: "ANA ARABA KOMPLESİ", status: "revize", drawnBy: "p3", drawnByName: "Alkım Kelleci", note: "" },
  { id: "d5", code: "1600", name: "ARABA YÜRÜTME GRUBU", status: "bekliyor", drawnBy: null, drawnByName: "", note: "" },
  { id: "d6", code: "2300", name: "YARDIMCI ARABA KOMPLESİ", status: "bekliyor", drawnBy: null, drawnByName: "", note: "" },
  // LİSTEDEN DÜŞMÜŞ ÇİZEN: rolü değişmiş bir kişi. Seçici onu "Listede Değil"
  // başlığı altında korumalı, alan boş görünmemeli.
  { id: "d7", code: "3000", name: "MEKANİK KEPÇE", status: "bekliyor", drawnBy: "p9", drawnByName: "Eski Ressam", note: "" },
];

const PROJECT = {
  id: "dev",
  doc_no: "0055-00",
  name: "AMONYUM SÜLFAT TESİSİ VİNCİ",
  customer: "İSDEMİR A.Ş.",
  crane_type: "Çift Kirişli Gezer Köprülü Vinç",
  archived: false,
};

const REVISIONS = [
  { id: "r1", rev_no: 1, label: "V1", status: "draft" as const, who: "Sinan Çolakoğlu", date: "08.08.2026" },
  { id: "r0", rev_no: 0, label: "V0", status: "issued" as const, who: "Sinan Çolakoğlu", date: "18.07.2026" },
];

export default function ProjectPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-12 items-center border-b bg-background/90 px-4">
        <div className="text-sm font-medium">Proje Detayı Önizleme (dev · sahte veri)</div>
      </header>
      {/* `content-start`: ızgara artan boşlukta satırları GERMESİN — gerçek
          sayfada kap `flex-1` taşımıyor, önizleme onu taklit etmezse bileşen
          olduğundan yüksek ölçülür. */}
      <div className="mx-auto grid w-full max-w-6xl flex-1 content-start gap-6 px-4 py-6 lg:px-8">
        <ProjectDetailHeader
          project={PROJECT}
          // Kırıntı yolu "İşler / 0055 / 0055-00" okur: son durak İŞ KALEMİ
          // numarasıdır, mühendisin yazdığı belge kodu değil.
          itemNo="0055-00"
          job={{ id: "j1", job_no: "0055" }}
          summary={{
            id: PROJECT.id,
            doc_no: PROJECT.doc_no,
            name: PROJECT.name,
            customer: PROJECT.customer,
            job_id: "j1",
            job_no: "0055",
            hasIssuedRevision: true,
          }}
          jobs={[]}
          canDelete
          latestRev={REVISIONS[0]}
          isFirstRevision={false}
        />

        <ProjectSignatoryCard
          projectId="dev"
          people={PEOPLE}
          preparedBy="p1"
          checkedBy="p2"
        />

        {/* Bölüm rayı GERÇEK bileşendir (`project-tabs.tsx`); iki paneli de
            burada basmak sayfanın markup'ını kopyalamak olurdu — ray tek
            başına sınanır: sekmelerin belirginliği, sayaçlar ve ekipman
            bağlantısının sağa dayanması. */}
        <Tabs defaultValue="drawings">
          <ProjectTabsNav
            revisionCount={REVISIONS.length}
            drawingPlanCount={DRAWING_PLAN.length}
            equipmentHref="/projects/dev/revisions/r1/equipment"
            equipmentLabel="Ekipman Listesi (V1)"
          />
        </Tabs>

        {/* Gerçek sayfada "Teknik Resim Takibi" sekmesinin en üstündedir;
            önizleme sekme kabuğunu değil KARTIN KENDİSİNİ gösterir. */}
        <DrawingPlanCard
          projectId="dev"
          itemNo="0055-00"
          initialRows={DRAWING_PLAN}
          authors={DRAWING_AUTHORS}
          canEdit
        />

        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              {/* Sütun önceliklendirmesi gerçek sayfadakiyle AYNI olmalı
                  (projects/[id]/page.tsx): önizleme dar ekran davranışını
                  sınamak için var, ayrışırsa yanlış güven verir. */}
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>Revizyon</TableHead>
                <TableHead>Etiket</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="hidden md:table-cell">Oluşturan</TableHead>
                <TableHead className="hidden md:table-cell">Tarih</TableHead>
                <TableHead className="hidden lg:table-cell">Motor</TableHead>
                <TableHead className="w-12 text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {REVISIONS.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-primary">V{r.rev_no}</TableCell>
                  <TableCell className="whitespace-normal">
                    {r.label}
                    <div className="mt-0.5 text-[11px] whitespace-normal text-muted-foreground md:hidden">
                      {r.date} · {r.who}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={revisionStatusVariant(r.status)}>
                      {revisionStatusLabel(r.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-sm md:table-cell">{r.who}</TableCell>
                  <TableCell className="hidden font-mono text-sm tabular-nums text-muted-foreground md:table-cell">
                    {r.date}
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground lg:table-cell">
                    0.4.0
                  </TableCell>
                  <TableCell className="text-right">
                    {/* Yayınlanmış satırda düğme HİÇ görünmez. */}
                    {r.status === "draft" && (
                      <DeleteRevisionButton
                        projectId="dev"
                        revisionId={r.id}
                        revNo={r.rev_no}
                        fallbackRevNo={
                          REVISIONS.filter((o) => o.id !== r.id).reduce<number | null>(
                            (max, o) => (max === null || o.rev_no > max ? o.rev_no : max),
                            null
                          )
                        }
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
