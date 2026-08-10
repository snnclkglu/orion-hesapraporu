// Excel marka bandının KORUMA testi.
//
// NEDEN VAR: parça defteri aylarca marka bandını hiç basmadı ve hiçbir test
// kırılmadı — sapmayı yalnız dosyayı açan kullanıcı görüyordu. Bant görsel bir
// ayrıntı olduğu için sessizce kaybolur; burada dört çıktının da bandı bastığı
// ve bandın AYNI olduğu sayılır.

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  MODULE_PREFIX,
  ORION_RED,
  colLetter,
  writeTitleBlock,
} from "@/lib/excel/brand";
import { buildRegisterWorkbook, type RegisterMeta } from "@/lib/excel/drawing-register";
import { buildWorkLogWorkbook } from "@/lib/excel/work-log";

/**
 * Hücrenin düz dolgu rengi (yoksa undefined).
 *
 * Tip bildirimi `fill`i her zaman dolu sayar; boyanmamış hücrede ExcelJS
 * gerçekte `undefined` döndürür, bu yüzden okuma isteğe bağlı zincirle yapılır.
 */
function fillArgb(cell: ExcelJS.Cell): string | undefined {
  const fill = cell.fill as ExcelJS.FillPattern | undefined;
  return fill?.pattern === "solid" ? fill.fgColor?.argb : undefined;
}

describe("colLetter", () => {
  it("26 sütunu aşınca iki harfe geçer", () => {
    // `String.fromCharCode(64 + n)` kestirmesi burada "[" üretiyordu ve merge
    // adresi sessizce bozuluyordu.
    expect(colLetter(1)).toBe("A");
    expect(colLetter(13)).toBe("M");
    expect(colLetter(26)).toBe("Z");
    expect(colLetter(27)).toBe("AA");
    expect(colLetter(52)).toBe("AZ");
    expect(colLetter(53)).toBe("BA");
  });
});

describe("writeTitleBlock", () => {
  const yeniSayfa = (): ExcelJS.Worksheet => new ExcelJS.Workbook().addWorksheet("T");

  it("künyesiz çağrıda tablo başlığı 5. satırdır ve boş künye parçaları düşer", () => {
    const ws = yeniSayfa();
    const bas = writeTitleBlock(ws, "Kayıtlar", 4, {
      prefix: MODULE_PREFIX.workLog,
      meta: ["süzgeç yok", "", null, "10.08.2026", undefined],
    });

    expect(bas).toBe(5);
    expect(ws.getCell("A1").value).toBe("ORION — İŞ TAKİBİ · Kayıtlar");
    expect(ws.getCell("A2").value).toBe("süzgeç yok · 10.08.2026");
    expect(fillArgb(ws.getCell("A3"))).toBe(ORION_RED);
    // Kırmızı ayraç birleşik hücrenin SON kolonuna kadar boyanır.
    expect(fillArgb(ws.getRow(3).getCell(4))).toBe(ORION_RED);
  });

  it("her künye satırı tablo başlığını bir aşağı iter", () => {
    const ws = yeniSayfa();
    const bas = writeTitleBlock(ws, "EKİPMAN LİSTESİ", 6, {
      details: [
        ["Müşteri", "ACME"],
        ["Hazırlayan", "-"],
        ["Kontrol", "-"],
      ],
    });

    expect(bas).toBe(8); // 3 bant + 3 künye + 1 boş satır
    expect(ws.getCell("A1").value).toBe("EKİPMAN LİSTESİ"); // öneksiz: müşteri belgesi
    expect(ws.getRow(4).getCell(1).value).toBe("Müşteri");
    expect(ws.getRow(4).getCell(2).value).toBe("ACME");
  });
});

describe("Teknik Resimler paketi tek dil konuşur", () => {
  const meta: RegisterMeta = {
    packageTitle: "0057-00 MONORAY (1 TON)",
    folderName: "0057-00-0500",
    itemNo: "0057-00",
    groupCode: "0500",
    docCode: "ORC-TR-0057-00-0500-R01",
    filterText: "süzgeç yok (tüm satırlar)",
    generatedAt: "10.08.2026 00:00",
    preparedBy: "test",
    recognitionPct: 92,
  };

  it("parça defteri de marka bandını basar", () => {
    const ws = buildRegisterWorkbook(
      [
        {
          partCode: "0057-00-0500-001",
          description: "Yan sac",
          assemblyTitle: "Ana kiriş",
          kindLabel: "Sac",
          material: "S355",
          category: "Kesim",
          qty: 2,
          cutLengthMm: null,
          thicknessMm: 8,
          weightKg: 42.5,
          hasModel: true,
          hasSheet: true,
          hasCut: true,
          isMontaj: false,
        },
      ],
      meta
    ).getWorksheet("Parça Defteri")!;

    expect(ws.getCell("A1").value).toBe("ORION — TEKNİK RESİMLER · Parça Defteri");
    expect(String(ws.getCell("A2").value)).toContain(meta.docCode);
    expect(fillArgb(ws.getCell("A3"))).toBe(ORION_RED);
    // Tablo başlığı bandın altındadır; ilk parça satırı onun da altında.
    expect(ws.getRow(5).getCell(1).value).toBe("Kod");
    expect(ws.getRow(6).getCell(1).value).toBe("0057-00-0500-001");
    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: 5 });
  });

  it("iş takibi bandı aynı düzeni korur", () => {
    const ws = buildWorkLogWorkbook([], {
      filterText: "süzgeç yok",
      generatedAt: "10.08.2026 00:00",
      preparedBy: "test",
    }).getWorksheet("Kayıtlar")!;

    expect(ws.getCell("A1").value).toBe("ORION — İŞ TAKİBİ · Kayıtlar");
    expect(fillArgb(ws.getCell("A3"))).toBe(ORION_RED);
    expect(ws.getRow(5).getCell(1).value).toBe("Tarih");
  });
});
