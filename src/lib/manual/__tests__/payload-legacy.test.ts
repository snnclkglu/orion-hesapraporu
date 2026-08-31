// TESLİM EDİLMİŞ BİR KILAVUZ BAŞKALAŞAMAZ — sözleşmenin kilidi.
//
// `manual_revisions.payload` belgenin TAMAMIDIR ve yayımlanmış revizyon
// veritabanında `guard_issued_manual_revision` ile kilitlidir (KITAP-2). Ama
// kilit YAZMAYI engeller, OKUMAYI değil: model büyüdükçe `withManualDefaults`
// eski kaydı bugüne taşır ve o taşımada bir alan sessizce düşerse, teslim
// edilmiş bir kılavuz bir daha aynı belgeyi basmaz. Vincin yanında asılı duran
// bir güvenlik belgesinin sessizce değişmesi bu bölümün en pahalı hatasıdır.
//
// Bu yüzden fikstür DONMUŞTUR (`fixtures/manual-v1.json`): şablondan yeniden
// ÜRETİLMEZ, şablon büyüdüğünde DEĞİŞMEZ. Test onu bugünün okuyucusundan
// geçirir ve süzgeç + numaralama çıktısını buradaki dondurulmuş listeyle
// karşılaştırır. Kapsam (`scope`), türetilmiş blok (`derived`) ve şema bloğu
// eklenirken bu test HER FAZDA koşar; kırmızıysa faz teslim edilmez.

import { describe, expect, it } from "vitest";
import fixture from "./fixtures/manual-v1.json";
import {
  allBlocks,
  flattenManual,
  numberManual,
  printedManual,
  usedAppendices,
  withManualDefaults,
} from "../payload";

const payload = withManualDefaults(fixture);

/** Basılan ağacın "numara + başlık" dökümü — belgenin iskeletinin imzası. */
function basilanIskelet(): string[] {
  return flattenManual(numberManual(printedManual(payload).sections)).map((s) =>
    s.number ? `${s.number} ${s.title}` : s.title
  );
}

describe("v1 el kitabı bugünün okuyucusundan geçtiğinde", () => {
  it("künye ve kapak alanlarını AYNEN korur", () => {
    expect(payload.v).toBe(1);
    expect(payload.docTitle).toBe("İŞLETME VE BAKIM EL KİTABI");
    expect(payload.coverTitle).toBe("60/12,5 TON KAPASİTELİ GEZER KÖPRÜ VİNCİ");
    expect(payload.coverImageId).toBe("img-kapak");
    expect(payload.partnerLogos.centerImageId).toBe("img-orta");
    expect(payload.partnerLogos.rightImageId).toBeUndefined();
    expect(payload.templateVersion).toBe(1);
    expect(payload.identity).toEqual({
      manufacturer: "ORION CRANES",
      product: "60/12,5 Ton Gezer Köprü Vinci",
      craneType: "Gezer Köprü Vinci",
      serialNo: "0042.00",
      productionYear: "2026",
      customer: "ÖRNEK SANAYİ A.Ş.",
      site: "DÖKÜMHANE",
      manufacturerAddress: "ORION CRANES\nAnkara",
      customerDocNo: "0042.00-BK01",
      customerRevision: "0.0",
      preparedOn: "01.03.2026",
      revisedOn: "",
      copyright: "Bu belgenin çoğaltılması üreticinin iznine bağlıdır.",
    });
  });

  it("TANINMAYAN ALANI DÜŞÜRÜR, belgeyi düşürmez", () => {
    expect("_neden" in payload).toBe(false);
    expect(payload.sections).toHaveLength(6);
  });

  it("gizlenen bölüm ve blokları AĞAÇTA TUTAR — gizlemek silmek değildir", () => {
    const duz = flattenManual(numberManual(payload.sections));
    expect(duz.some((s) => s.id === "s2b" && s.hidden)).toBe(true);
    expect(allBlocks(payload.sections).some((b) => b.id === "b12" && b.hidden)).toBe(true);
    expect(allBlocks(payload.sections)).toHaveLength(13);
  });

  it("basılan iskelet DONMUŞ listeyle birebir aynıdır", () => {
    expect(basilanIskelet()).toEqual([
      "1 Kullanıcı Notları",
      "1.1 Dokümanın Amacı",
      "1.2 Bu kılavuzda kullanılan uyarılar",
      "2 Temel Güvenlik Notları ve Talimatları",
      "2.1 Kullanım Amacı",
      "3 Makine Tanımı",
      "3.1 Teknik Bilgiler",
      "3.1.1 Sınıflandırma",
      "3.1.2 Karakteristik Özellikler",
      "4 Kullanım",
      "4.1 Operatör Kabini",
      "4.2 Frenler",
      "Ekler",
      "EK-A Mekanik Hesaplamalar",
      "EK-B Elektrik Projeleri",
    ]);
  });

  it("SATIRSIZ TABLO bölümü belgeden düşürür (9. bölüm basılmaz)", () => {
    expect(basilanIskelet().some((s) => s.includes("Yedek Parça"))).toBe(false);
    expect(basilanIskelet().some((s) => s.includes("Yağ Keçesi"))).toBe(false);
  });

  it("boş paragraf ve gizli blok basılmaz, görsel ve tablo basılır", () => {
    const basilan = printedManual(payload);
    const kabin = flattenManual(numberManual(basilan.sections)).find((s) => s.id === "s4a")!;
    expect(kabin.blocks.map((b) => b.id)).toEqual(["b10"]);
    const frenler = flattenManual(numberManual(basilan.sections)).find((s) => s.id === "s4b")!;
    expect(frenler.blocks.map((b) => b.id)).toEqual(["b11"]);
  });

  it("EK SIRASI gizlenen eki atlar ve harfler kaymadan sürer", () => {
    expect(usedAppendices(printedManual(payload).sections)).toEqual([
      "mekanikHesap",
      "elektrikProje",
    ]);
  });

  it("okuyucu ÖZDEŞTİR: ikinci geçiş aynı sonucu verir", () => {
    expect(withManualDefaults(payload)).toEqual(payload);
  });
});
