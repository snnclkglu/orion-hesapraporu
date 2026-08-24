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
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ProjectDetailHeader } from "@/app/(app)/projects/[id]/project-header";
import { ProjectTabsNav } from "@/app/(app)/projects/[id]/project-tabs";
import { EquipmentRevisionsTable } from "@/app/(app)/projects/[id]/equipment-revisions-table";
import { DrawingPlanCard } from "@/app/(app)/projects/[id]/drawing-plan-card";
import type { DrawingAuthor, DrawingPlanRow } from "@/lib/drawing-plan";
import { ElectricalCard } from "@/app/(app)/projects/[id]/electrical/electrical-card";
import type { ElectricalDoc } from "@/lib/electrical/data";
import type { ElectricalPart, ElectricalSheet } from "@/lib/electrical/types";

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


/**
 * ELEKTRİK PROJESİ FİKSTÜRÜ — gerçek 185/40T dışa aktarımından ALINMIŞ satırlar.
 *
 * Uydurma kısa metinler bu ekranı sınamaz: sorun tam olarak UZUN hücrelerdi
 * (kullanıcı bildirimi, 19.08.2026 — satırlar üç sıraya sarıyordu). Fikstür bu
 * yüzden gerçeğin en uzun tanımlarını, en uzun tedarikçi adını ("Hans Turck
 * GmbH & Co KG") ve çok panolu bir malzemeyi taşır; kesme, tooltip ve sütun
 * payları ancak bunlarla gözle sınanabilir.
 */
const EL_SAYFALAR: ElectricalSheet[] = [
  { page: 1, installation: "185T", location: "", sheetNo: "1", title: "Başlık / kapak sayfası" },
  { page: 2, installation: "185T", location: "SD1", sheetNo: "1", title: "Ana Dağıtım" },
  { page: 3, installation: "185T", location: "LVD01", sheetNo: "0", title: "LVD01 ANA VE YRD BESLEME" },
  { page: 12, installation: "185T", location: "LVD01", sheetNo: "12", title: "Ana Besleme/ CU320 I/O Kontrol-1" },
  { page: 19, installation: "185T", location: "LVD01", sheetNo: "21", title: "Yardımcı Besleme/ Projektör Besleme" },
  { page: 53, installation: "185T", location: "LVD10", sheetNo: "0", title: "ANA PLC PANELİ" },
];

const EL_PARCALAR: ElectricalPart[] = [
  { deviceTag: "=185T+SD1-Q12", installation: "185T", location: "SD1", device: "Q12", qty: 1, designation: "SIRCO 3x1250A 0-I Load Break Switch", typeNo: "26003121", supplier: "SOCOMEC", partNo: "SOC.26003121", page: 145 },
  { deviceTag: "=185T+LVD01-A111", installation: "185T", location: "LVD01", device: "A111", qty: 1, designation: "SINAMICS S120 CONTROL UNIT CU320-2 PN", typeNo: "6SL3040-1MA01-0AA0", supplier: "Siemens", partNo: "SIE.6SL3040-1MA01-0AA0", page: 145 },
  { deviceTag: "=185T+LVD01-E211", installation: "185T", location: "LVD01", device: "E211", qty: 1, designation: "250W 5000K 230VAC LED Floodlight", typeNo: "N1000-P-2/250W.5000K", supplier: "Niki Electronics", partNo: "NIKI.N1000-P-2/250W.5000K", page: 145 },
  { deviceTag: "=185T+LVD01-F31", installation: "185T", location: "LVD01", device: "F31", qty: 9, designation: "CIRCUIT BREAKER 400V 6KA, 2POLE, C, 10A", typeNo: "5SL6210-7", supplier: "Siemens", partNo: "SIE.5SL6210-7", page: 146 },
  { deviceTag: "=185T+LVD10-A351", installation: "185T", location: "LVD10", device: "A351", qty: 1, designation: "SIMATIC S7-1500 CPU 1511-1 PN", typeNo: "6ES7511-1AL03-0AB0", supplier: "Siemens", partNo: "SIE.6ES7511-1AL03-0AB0", page: 155 },
  { deviceTag: "=185T+LVD10-A352", installation: "185T", location: "LVD10", device: "A352", qty: 1, designation: "FRONTCONNECTOR SCREW TYPE (35MM MOD.)", typeNo: "6ES7592-1AM00-0XB0", supplier: "Siemens", partNo: "SIE.6ES7592-1AM00-0XB0", page: 155 },
  { deviceTag: "=185T+LVD10-B12", installation: "185T", location: "LVD10", device: "B12", qty: 14, designation: "Inductive proximity switch, flush, PNP NO", typeNo: "1635100", supplier: "Hans Turck GmbH & Co KG", partNo: "TUR.1635100", page: 153 },
  { deviceTag: "=185T+TB1-X1", installation: "185T", location: "TB1", device: "X1", qty: 24, designation: "Feed-through terminal block PT 2,5", typeNo: "PT 2,5", supplier: "Phoenix Contact", partNo: "PXC.3209510", page: 157 },
  { deviceTag: "=185T+TB2-X4", installation: "185T", location: "TB2", device: "X4", qty: 24, designation: "Feed-through terminal block PT 2,5", typeNo: "PT 2,5", supplier: "Phoenix Contact", partNo: "PXC.3209510", page: 157 },
  { deviceTag: "=185T+CB2-S15", installation: "185T", location: "CB2", device: "S15", qty: null, designation: "Humidifiers-switch 1 pole ON/OFF-complete product", typeNo: "NML0100121", supplier: "Schneider Electric", partNo: "SE.NML0100121", page: 157 },
];

const EL_BELGE: ElectricalDoc = {
  id: "e1",
  projectId: "dev",
  fileName: "028.00 185-40T Şarj Vinci Elektrik Projeleri_rev3.pdf",
  revision: "rev3",
  storagePath: "dev/e1.pdf",
  sizeBytes: 12_405_795,
  pageCount: 157,
  titleBlock: {
    projectName: "028.00 185-40T Şarj Vinci",
    projectDescription: "185/40T ŞARJ VİNCİ",
    jobNumber: "028.00",
    company: "KARÇEL A.Ş.",
    location: "KARDEMİR",
    drawnBy: "H.ORAN",
    declaredPages: 157,
    dateIso: "2026-06-27",
  },
  sheets: EL_SAYFALAR,
  partsPages: [145, 146, 153, 155, 157],
  note: "",
  parsedAt: "2026-08-19T12:00:00.000Z",
  isCurrent: true,
  createdAt: "2026-08-19T12:00:00.000Z",
};

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
          // ŞARTNAME YÜKLENMEMİŞ HÂLİ ÖNİZLENİR: eylem şeridinde bakılacak
          // şey kırmızı düğmenin öteki iki bağlantıyla aynı yükseklikte ve
          // aynı dokunma payında durup durmadığıdır (MOBIL-1).
          spec={null}
          canEditSpec
        />

        <ProjectSignatoryCard
          projectId="dev"
          people={PEOPLE}
          preparedBy="p1"
          checkedBy="p2"
        />

        {/* Bölüm rayı ve ekipman sürüm defteri GERÇEK bileşenlerdir. Ekipman
            listeleri hesabın yanında görünmeli ve Vn ↔ Hesap Vn bağı dar
            ekranda da okunmalıdır. */}
        <Tabs defaultValue="equipment">
          <ProjectTabsNav
            revisionCount={REVISIONS.length}
            equipmentCount={REVISIONS.length}
            electricalPartCount={726}
            drawingPlanCount={DRAWING_PLAN.length}
            manualRevisionCount={2}
          />
          <TabsContent value="equipment">
            <EquipmentRevisionsTable
              projectId="dev"
              revisions={REVISIONS.map((revision) => ({
                id: revision.id,
                revNo: revision.rev_no,
                label: revision.label,
                status: revision.status,
                createdAt: revision.rev_no === 1 ? "2026-08-08T10:00:00.000Z" : "2026-07-18T10:00:00.000Z",
                createdBy: revision.who,
              }))}
            />
          </TabsContent>
        </Tabs>

        {/* Gerçek sayfada "Elektrik Projesi" sekmesindedir. Burada bakılacak
            şey TABLONUN SIĞMASIDIR: hiçbir sütun taşmamalı, satırlar tek
            satır boyunda kalmalı, kesilen metin "…" ile bitmeli. */}
        <ElectricalCard
          projectId="dev"
          docs={[EL_BELGE]}
          current={EL_BELGE}
          parts={EL_PARCALAR}
          catalogReferences={[
            {
              materialKey: "SOC.26003121",
              productId: "catalog-product-1",
              technicalDocumentId: "technical-document-1",
              catalogDocumentId: "catalog-document-1",
            },
            {
              materialKey: "SIE.6SL3040-1MA01-0AA0",
              productId: "catalog-product-2",
              technicalDocumentId: "technical-document-2",
              catalogDocumentId: null,
            },
          ]}
          canEdit
        />

        {/* Gerçek sayfada "Teknik Resim Takibi" sekmesinin en üstündedir;
            önizleme sekme kabuğunu değil KARTIN KENDİSİNİ gösterir. */}
        <DrawingPlanCard
          projectId="dev"
          itemNo="0055-00"
          initialRows={DRAWING_PLAN}
          authors={DRAWING_AUTHORS}
          canEdit
        />

        <div className="relative overflow-hidden rounded-lg border bg-card">
          <Table containerClassName="oc-mobile-table-wrap oc-tablet-table-wrap" className="oc-mobile-table oc-tablet-table oc-compact-mobile-table oc-engineering-revisions-table">
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
                  <TableCell data-label="Revizyon" data-mobile-revision data-mobile-hide-label className="font-mono text-primary">
                    V{r.rev_no}
                  </TableCell>
                  <TableCell
                    data-label="Etiket"
                    data-mobile-span="full"
                    data-mobile-primary
                    data-mobile-hide-label
                    className="whitespace-normal"
                  >
                    {r.label}
                    <div className="mt-0.5 text-[11px] whitespace-normal text-muted-foreground md:hidden">
                      {r.date} · {r.who}
                    </div>
                  </TableCell>
                  <TableCell data-label="Durum" data-mobile-status data-mobile-hide-label>
                    <Badge variant={revisionStatusVariant(r.status)}>
                      {revisionStatusLabel(r.status)}
                    </Badge>
                  </TableCell>
                  <TableCell data-label="Oluşturan" className="hidden text-sm md:table-cell">
                    {r.who}
                  </TableCell>
                  <TableCell
                    data-label="Tarih"
                    className="hidden font-mono text-sm tabular-nums text-muted-foreground md:table-cell"
                  >
                    {r.date}
                  </TableCell>
                  <TableCell
                    data-label="Motor"
                    className="hidden font-mono text-xs text-muted-foreground lg:table-cell"
                  >
                    0.4.0
                  </TableCell>
                  <TableCell
                    data-label="İşlem"
                    data-mobile-span="full"
                    data-mobile-hidden={r.status !== "draft" || undefined}
                    data-mobile-actions
                    data-mobile-hide-label
                    className="text-right"
                  >
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
