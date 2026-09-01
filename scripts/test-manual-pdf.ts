// İşletme ve Bakım El Kitabı PDF'inin duman testi.
//
// Şablondan doğan bir belge, sahte kaynak verisiyle basılır ve METNİ ölçülür.
// Bileşen ağacına bakmak, seviyenin gerçekten belgeye yansıdığını GÖSTERMEZ
// (`docs/agent/belge.md`, rapor seviyeleri dersi) — bu yüzden çıktı bir dosya
// olarak da yazılır ve göz kontrolü mümkün kalır.
//
//   npx tsx scripts/test-manual-pdf.ts [cikti.pdf] [ek.pdf] [--turet] [--sema] [--paket=<key>]
//
// `--turet` TÜRETİM ÇEKİRDEĞİNİ de koşturur (bakım çizelgesi ~200 satır,
// yağlama tablosu). Yerleşimin asıl sınandığı yer burasıdır: `atomuBol` uzun
// bir tabloyu sütunlar arasında bölmek zorunda kalır ve dilim başlıkları
// tekrar eder. `--paket` teslim paketini uygular (standart · detayli ·
// tamTeknik) ve ek sırasının kapsama göre değiştiğini gösterir.

import { readFileSync, writeFileSync } from "node:fs";
import { renderToBuffer } from "@react-pdf/renderer";
import { ManualPdf, manualAppendixOrder } from "@/lib/pdf/manual";
import { MANUAL_DOC_TITLE, manualDocCode } from "@/lib/manual/naming";
import { manualFromTemplate, flattenManual, numberManual, printedManual } from "@/lib/manual/payload";
import { pdfEkleriYerlestir } from "@/lib/pdf/merge";
import { MANUAL_APPENDIX_LABELS } from "@/lib/manual/types";
import { manualAssetsFor } from "@/lib/manual/asset-bytes";
import { manualUsedAssetKeys } from "@/lib/manual/assets";
import { allBlocks } from "@/lib/manual/payload";
import { NEW_WORK_TEMPLATE } from "@/lib/calc/defaults";
import { runCalc } from "@/lib/calc/engine";
import { diagramsForSection } from "@/lib/diagrams/select";
import { applyAutofill } from "@/lib/manual/autofill";
import { applyManualPackage } from "@/lib/manual/packages";
import { isManualPackageKey } from "@/lib/manual/packages";
import type { ManualEquipmentRow, ManualSourceData } from "@/lib/manual/sources";
import type { ReportCoverSpec } from "@/lib/pdf/report";

/**
 * TÜRETİM FİKSTÜRÜ — gerçek bir vincin ekipman listesi mertebesinde.
 *
 * Küçük bir liste bakım çizelgesini de küçük yapar ve `atomuBol` hiç
 * çalışmazdı; oysa bu betiğin varlık sebebi tam olarak o yolu sınamaktır.
 */
const TURETIM_EKIPMANI: ManualEquipmentRow[] = [
  ...["Ana Kaldırma", "Yardımcı Kaldırma", "Araba", "Köprü"].flatMap((group) =>
    [
      ["Motor", "SIEMENS", "1LE1001"],
      ["Redüktör", "YILMAZ", "MRD 90"],
      ["Fren", "EMG", "EBD 250"],
      ["Motor kaplini", "", ""],
      ["Tekerlek", "", ""],
      ["Teker rulmanı", "SKF", "22215"],
    ].map(([component, brand, model]) => ({
      component,
      brand,
      model,
      qty: "2",
      group,
    }))
  ),
  { component: "Tambur", brand: "", model: "", qty: "1", group: "Ana Kaldırma" },
  { component: "Tambur rulman yatağı", brand: "SKF", model: "SNL 520", qty: "2", group: "Ana Kaldırma" },
  { component: "Çelik halat", brand: "GÜVEN", model: "6x36 WS", qty: "2", group: "Ana Kaldırma" },
  { component: "Halat makarası", brand: "", model: "", qty: "8", group: "Ana Kaldırma" },
  { component: "Makara rulmanı", brand: "SKF", model: "22213", qty: "8", group: "Ana Kaldırma" },
  { component: "Kanca", brand: "PEWAG", model: "RSN 16", qty: "1", group: "Ana Kaldırma" },
  { component: "Kanca (eksenel) rulmanı", brand: "SKF", model: "29320", qty: "1", group: "Ana Kaldırma" },
  { component: "Tampon", brand: "", model: "", qty: "4", group: "Köprü" },
  { component: "Operatör kabini", brand: "", model: "", qty: "1", group: "Operatör Kabini" },
  { component: "Elektrik panosu", brand: "", model: "", qty: "2", group: "Elektrik Odası" },
];

/**
 * KAPAK KÜNYESİ FİKSTÜRÜ — kullanıcının teslim ettiği 0026-01 vincinin gerçek
 * satırları. Kapak spec tablosu duman testinde HİÇ basılmıyordu ve en uzun
 * satırın ("ÇİFT KİRİŞLİ GEZER KÖPRÜLÜ VİNÇ") değer sütununu taşırdığı ancak
 * kâğıda bakınca görülüyor.
 */
const KAPAK_OZELLIKLERI: ReportCoverSpec[] = [
  { label: "VİNÇ TİPİ", value: "ÇİFT KİRİŞLİ GEZER KÖPRÜLÜ VİNÇ" },
  { label: "KAPASİTE", value: "100 t" },
  { label: "AÇIKLIK", value: "14,85 m" },
  { label: "KALDIRMA YÜKSEKLİĞİ", value: "8,8 m" },
  { label: "FEM SINIFI", value: "FEM 2M / ISO M5" },
  { label: "YÜK GRUBU", value: "H2/B3" },
  { label: "ÇELİK KONSTRÜKSİYON SINIFI", value: "A5" },
  { label: "KANCA TİPİ", value: "DIN 15402 ÇİFT AĞIZ KANCA" },
];

async function main() {
  const argv = process.argv.slice(2);
  const bayraklar = argv.filter((a) => a.startsWith("--"));
  const konumlu = argv.filter((a) => !a.startsWith("--"));
  const hedef = konumlu[0] ?? "tmp/el-kitabi-ornek.pdf";
  const turet = bayraklar.includes("--turet");
  const sema = bayraklar.includes("--sema");
  const paketAdi = bayraklar.find((a) => a.startsWith("--paket="))?.slice("--paket=".length) ?? "";

  const payload = manualFromTemplate({
    manufacturer: "ORION CRANES",
    product: "ŞARJ VİNCİ",
    craneType: "GEZER KÖPRÜ VİNCİ",
    customer: "ÖRNEK MÜŞTERİ",
  });
  payload.docTitle = MANUAL_DOC_TITLE;
  payload.coverTitle = "ŞARJ VİNCİ";

  // SAHTE KAYNAK: gerçek veri yok, ama tabloların BASILDIĞI görülmeli.
  const sources: ManualSourceData = {
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

  if (turet) sources.equipment = TURETIM_EKIPMANI;

  // PAKET ÖNCE, TÜRETİM SONRA: paket otomatik blokların varyantını yazar ve
  // bölümleri gizler; türetim yalnız GÖRÜNEN bölümlere blok üretmez ama gizli
  // bölümde üretilen blok da belgeye girmez — sıra bu yüzden okunur kalsın.
  if (paketAdi) {
    if (!isManualPackageKey(paketAdi)) throw new Error(`Bilinmeyen paket: ${paketAdi}`);
    const sonuc = applyManualPackage(payload, paketAdi, { at: "2026-08-30T00:00:00.000Z" });
    payload.sections = sonuc.payload.sections;
    payload.scope = sonuc.payload.scope;
    console.log(`Paket: ${paketAdi} · değişen ${sonuc.degisen}`);
  }
  if (turet) {
    sources.hoistGroup = "M8";
    const sonuc = applyAutofill(payload, { sources });
    payload.sections = sonuc.payload.sections;
    console.log(`Türetim: ${sonuc.uretilen} blok yazıldı, ${sonuc.korunan} blok korundu`);
  }

  // ŞEMA BLOĞU GERÇEK BİR DİYAGRAMLA SINANIR. Uydurma bir model yerleşimi
  // ölçer ama ÇİZİMİ sınamaz; asıl soru `PdfDiagram`ın el kitabı kabında
  // doğru boyda basılıp basılmadığıdır.
  if (sema) {
    const girdi = NEW_WORK_TEMPLATE;
    const hesap = runCalc(girdi);
    const secilenler: [string, string][] = [
      ["main", "2.5"],
      ["main", "2.2.3"],
      ["wheelLoads", "10.2"],
    ];
    const bloklar = secilenler.flatMap(([modul, bolum], i) => {
      const d = diagramsForSection(modul, bolum, girdi, hesap)[0];
      if (!d) return [];
      return [
        {
          id: `sema${i}`,
          kind: "diagram" as const,
          diagramKey: `${modul}:${bolum}`,
          diagram: {
            width: d.width,
            height: d.height,
            els: d.els as unknown[],
            ...(d.x0 !== undefined ? { x0: d.x0 } : {}),
            ...(d.y0 !== undefined ? { y0: d.y0 } : {}),
          },
          caption: `Şema ${modul} ${bolum}`,
        },
      ];
    });
    const hedefBolum = payload.sections.find((b) => b.key === "tanim");
    if (hedefBolum) hedefBolum.blocks.push(...bloklar);
    console.log(`Şema: ${bloklar.length} diyagram eklendi`);
  }

  // ŞABLON VARLIKLARI İNDİRME UCUNDAKİ GİBİ YÜKLENİR. Yüklenmezse yerleşim
  // görselleri ÖLÇER ama çizim onları BASMAZ ve ortaya bomboş bir yaprak
  // çıkar — bu betik tam olarak o ayrışmayı yakalamak için var.
  const gorseller = manualAssetsFor(manualUsedAssetKeys(allBlocks(payload.sections)));

  const belgeKodu = manualDocCode("0019-00", 1);
  const buf = await renderToBuffer(
    ManualPdf({
      payload,
      sources,
      images: gorseller,
      docCode: belgeKodu,
      docLine: `ORION CRANES · ${MANUAL_DOC_TITLE} · V1 · 2026`,
      company: { company: "ORION CRANES", address: "ANKARA · TÜRKİYE", web: "orioncranes.com" },
      bandLines: ["V1", "19.08.2026"],
      coverSpecs: KAPAK_OZELLIKLERI,
      craneLocation: "FIRIN HOLÜ",
      includedAppendices: [],
    })
  );

  writeFileSync(hedef, buf);

  const basilan = printedManual(payload);
  const duz = flattenManual(numberManual(basilan.sections));
  const ekKapsayici = duz.find((b) => b.children.some((c) => c.appendix)) ?? null;
  const govdeBasliklari = duz.filter((b) => !b.appendix && b.id !== ekKapsayici?.id);
  console.log(`PDF: ${hedef} · ${(buf.byteLength / 1024).toFixed(0)} KB · ${gorseller.length} şablon görseli`);
  console.log(`Yazılan bölüm: ${flattenManual(numberManual(payload.sections)).length}`);
  console.log(`BASILAN bölüm: ${duz.length}`);
  console.log(`Ek sırası: ${manualAppendixOrder(payload).join(" · ")}`);
  console.log(
    "İlk on başlık:\n  " +
      duz
        .slice(0, 10)
        .map((b) => `${b.number || "—"} ${b.title}`)
        .join("\n  ")
  );

  // EK YERLEŞTİRME SÖZLEŞMESİ SINANIR: temel belgenin SON n sayfası, eklerle
  // AYNI SIRADAKİ n kapak olmalıdır. Bu modüldeki en kırılgan varsayım budur —
  // bozulursa ek YANLIŞ KAPAĞIN altına düşer ve bunu ancak belgeyi açan
  // müşteri görür. İkinci argüman verilirse o PDF "Elektrik Projeleri" eki
  // olarak yerleştirilir ve birleşik belge de yazılır.
  const ekYolu = konumlu[1];
  // BEKLENEN BAŞLIKLAR yerleşim denetçisine yazılır: iki sütunlu akışta
  // "kayıp içerik" gözle görülmez, ancak belgeyi geri okuyup aranarak
  // yakalanır (`scripts/check-manual-layout.py`).
  writeFileSync(
    hedef.replace(/\.pdf$/, "-basliklar.json"),
    JSON.stringify(govdeBasliklari.map((b) => b.title), null, 1)
  );

  if (ekYolu) {
    const ekBytes = new Uint8Array(readFileSync(ekYolu));
    const tamTemel = await renderToBuffer(
      ManualPdf({
        payload,
        sources,
        images: gorseller,
        docCode: belgeKodu,
        docLine: `ORION CRANES · ${MANUAL_DOC_TITLE} · V1 · 2026`,
        company: { company: "ORION CRANES", address: "ANKARA · TÜRKİYE", web: "orioncranes.com" },
        bandLines: ["V1", "19.08.2026"],
        coverSpecs: KAPAK_OZELLIKLERI,
        craneLocation: "FIRIN HOLÜ",
        includedAppendices: ["elektrikProje"],
        deferFolio: true,
      })
    );
    const sonuc = await pdfEkleriYerlestir(
      new Uint8Array(tamTemel),
      [{ ad: MANUAL_APPENDIX_LABELS.elektrikProje, bytes: ekBytes }],
      { finalFolio: true }
    );
    console.log(
      `Ek yerleştirme: ${sonuc.eklenen} ek · ${sonuc.eklenenSayfa} sayfa eklendi · atlanan ${sonuc.atlananlar.length}`
    );
    const tamYol = hedef.replace(/\.pdf$/, "-tam.pdf");
    writeFileSync(tamYol, sonuc.bytes);
    console.log(`Tam sürüm: ${tamYol}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
