// İşletme ve Bakım El Kitabı PDF'inin duman testi.
//
// Şablondan doğan bir belge, sahte kaynak verisiyle basılır ve METNİ ölçülür.
// Bileşen ağacına bakmak, seviyenin gerçekten belgeye yansıdığını GÖSTERMEZ
// (`docs/agent/belge.md`, rapor seviyeleri dersi) — bu yüzden çıktı bir dosya
// olarak da yazılır ve göz kontrolü mümkün kalır.
//
//   npx tsx scripts/test-manual-pdf.ts [cikti.pdf]

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
import type { ManualSourceData } from "@/lib/manual/sources";

async function main() {
  const hedef = process.argv[2] ?? "tmp/el-kitabi-ornek.pdf";

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
    })
  );

  writeFileSync(hedef, buf);

  const basilan = printedManual(payload);
  const duz = flattenManual(numberManual(basilan.sections));
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
  const ekYolu = process.argv[3];
  const sira = manualAppendixOrder(payload);
  const ekler = sira.map((tur) => ({
    ad: MANUAL_APPENDIX_LABELS[tur],
    bytes:
      ekYolu && tur === "elektrikProje"
        ? new Uint8Array(readFileSync(ekYolu))
        : new Uint8Array(0),
  }));
  const sonuc = await pdfEkleriYerlestir(new Uint8Array(buf), ekler);
  console.log(
    `Ek yerleştirme: ${sonuc.eklenen} ek · ${sonuc.eklenenSayfa} sayfa eklendi · atlanan ${sonuc.atlananlar.length} (kapakları da silindi)`
  );
  // BEKLENEN BAŞLIKLAR yerleşim denetçisine yazılır: iki sütunlu akışta
  // "kayıp içerik" gözle görülmez, ancak belgeyi geri okuyup aranarak
  // yakalanır (`scripts/check-manual-layout.py`).
  writeFileSync(
    hedef.replace(/\.pdf$/, "-basliklar.json"),
    JSON.stringify(duz.map((b) => b.title), null, 1)
  );

  if (ekYolu) {
    const tamYol = hedef.replace(/\.pdf$/, "-tam.pdf");
    writeFileSync(tamYol, sonuc.bytes);
    console.log(`Tam sürüm: ${tamYol}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
