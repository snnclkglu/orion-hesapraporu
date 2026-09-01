// Sadece development: EL KİTABI editörünü ve KÂĞIT ÖNİZLEMESİNİ auth olmadan
// görsel test etmek için (değişmez md. 11: "ekran değiştirdiysen
// `/dev/*-preview` sayfasına ÖNCE bak"). Production'da 404 döner.
//
// FİKSTÜR GERÇEKTİR: gövde şablondan doğar (`manualFromTemplate`), kaynak
// tabloları `scripts/test-manual-pdf.ts`teki sahte veriyle aynıdır. Böylece
// ekranda görülen belge ile duman testinin bastığı PDF aynı şeyi anlatır.

import { notFound } from "next/navigation";
import { ManualEditor } from "@/app/(app)/projects/[id]/manual/[revId]/manual-editor";
import { MANUAL_DOC_TITLE } from "@/lib/manual/naming";
import { manualFromTemplate } from "@/lib/manual/payload";
import type { ManualSourceData } from "@/lib/manual/sources";

const SOURCES: ManualSourceData = {
  classes: [
    { label: "Çelik Yapı Sınıfı", value: "A8" },
    { label: "Kaldırma Grubu", value: "M8" },
  ],
  characteristics: [
    { label: "Kaldırma Kapasitesi", value: "185 t" },
    { label: "Köprü Açıklığı", value: "18.288 mm" },
  ],
  speeds: [{ label: "Kaldırma Hızı", value: "6,3 m/dk" }],
  equipment: [
    { component: "Tambur rulmanı", brand: "SKF", model: "22320", qty: "4", group: "Ana Kaldırma" },
    { component: "Çelik halat", brand: "—", model: "6x36 WS", qty: "2", group: "Ana Kaldırma" },
  ],
  electricalParts: [
    {
      deviceTag: "=185T+SD1-F15",
      installation: "185T",
      location: "SD1",
      device: "F15",
      qty: 1,
      designation: "CIRCUIT BREAKER 400V 6KA, 3POLE, C, 63A",
      typeNo: "5SL6363-7",
      supplier: "Siemens",
      partNo: "SIE.5SL6363-7",
      page: 145,
    },
  ],
  electricalSheets: [
    { page: 2, installation: "185T", location: "SD1", sheetNo: "1", title: "Ana Dağıtım" },
  ],
  drawings: [{ no: "0019-00-0100", name: "GENEL MONTAJ", status: "Çizildi" }],
};

export default function ManualPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  const payload = manualFromTemplate({
    manufacturer: "ORION CRANES",
    product: "ŞARJ VİNCİ",
    craneType: "GEZER KÖPRÜ VİNCİ",
    customer: "ÖRNEK MÜŞTERİ",
    site: "ÇELİK ÜRETİM TESİSİ",
    productionYear: "2026",
  });
  payload.docTitle = MANUAL_DOC_TITLE;
  payload.coverTitle = "ŞARJ VİNCİ";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 flex h-12 items-center border-b bg-background/90 px-4">
        <div className="text-sm font-medium">El Kitabı Editörü — Önizleme (dev)</div>
      </header>
      <div className="mx-auto w-full flex-1 px-4 py-6 lg:px-8">
        <ManualEditor
          projectId="dev"
          revisionId="dev"
          revNo={1}
          status="draft"
          label="Ön Tasarım"
          initialPayload={payload}
          projectTitle="185/40 T X 18,28 M KAPASİTELİ DÖRT KİRİŞLİ KÖPRÜLÜ ŞARJ VİNCİ"
          sources={SOURCES}
          images={[]}
          snippets={[]}
          itemNo="0019-00"
          identitySources={{}}
          firmalar={[]}
          firmaLogolari={{}}
          projectBrandName=""
          projectBrandId=""
          canEdit
        />
      </div>
    </div>
  );
}
