// Klasör adı — iki gerçek pakette İKİ AYRI DİLBİLGİSİ.
//
// Bu testin varlık sebebi şu: ilk tasarım tek bir regex'e dayanıyordu ve
// `0043-00-0000_MTC PASLANMAZ` gelir gelmez kırıldı. Tanıyıcı listesi tam
// olarak bunun tekrarlanmaması için var.

import { describe, expect, it } from "vitest";
import { folderCodeFromContents, folderNameFromContents, parseFolderName } from "../folder-name";
import { MONORAY, MTC } from "./fixtures/packages";

describe("parseFolderName — gerçek paket kökleri", () => {
  it("tireli yazım: kod - AD (KAPASİTE)", () => {
    const r = parseFolderName(MONORAY.folder);
    expect(r.by).toBe("klasor.tireli");
    expect(r.value).toMatchObject({
      code: "0057-00-0500",
      itemNo: "0057-00",
      group: "0500",
      description: "MONORAY",
      capacity: "1 TON",
    });
  });

  it("alt çizgili yazım: kod_AD", () => {
    const r = parseFolderName(MTC.folder);
    expect(r.by).toBe("klasor.altcizgili");
    expect(r.value).toMatchObject({
      code: "0043-00-0000",
      itemNo: "0043-00",
      group: "0000",
      description: "MTC PASLANMAZ",
      capacity: "",
    });
  });

  it("alt paket klasörü de aynı listeyle çözülür", () => {
    expect(parseFolderName("0043-00-0050 - BARA AKIM ALMA KOLU").value).toMatchObject({
      code: "0043-00-0050",
      description: "BARA AKIM ALMA KOLU",
    });
  });

  it("yalnız kod", () => {
    const r = parseFolderName("0057-00-0500");
    expect(r.by).toBe("klasor.yalnizkod");
    expect(r.value).toMatchObject({ code: "0057-00-0500", description: "" });
  });

  it("boşluklu yazım", () => {
    expect(parseFolderName("0043-00-0700 KANCA BLOĞU").value).toMatchObject({
      code: "0043-00-0700",
      description: "KANCA BLOĞU",
    });
  });
});

describe("üretim durumu ipucu", () => {
  it("klasör adındaki KESİLDİ okunur, kavga edilmez", () => {
    // Gerçek klasör: DXF/0043-00-0100 - ANA KIRIS - KESİLDİ/
    // Atölye durumu bir yere yazma ihtiyacı duyuyor; bu bir ihtiyacın kanıtı,
    // bir kural ihlali değil.
    const r = parseFolderName("0043-00-0100 - ANA KIRIS - KESİLDİ");
    expect(r.value).toMatchObject({
      code: "0043-00-0100",
      description: "ANA KIRIS",
      statusHint: "KESİLDİ",
    });
  });

  it("durum sözcüğü yoksa açıklama bütün olarak kalır", () => {
    expect(parseFolderName("0043-00-0100 - ANA KIRIS - ALT GRUP").value).toMatchObject({
      description: "ANA KIRIS - ALT GRUP",
      statusHint: "",
    });
  });
});

describe("tanınmayan klasör adı", () => {
  it("kod yoksa null döner — bu bir hata DEĞİLDİR", () => {
    const r = parseFolderName("HALAT KLAVUZU (Ø325)");
    expect(r.value).toBeNull();
    expect(r.by).toBe("");
  });
});

describe("folderCodeFromContents — adı olmayanın kodu içeriğinden", () => {
  it("HALAT KLAVUZU (Ø325) kodunu dosyalarından verir", () => {
    // Gerçek klasör: adında hiç kod yok ama yedi dosyasının hepsi
    // 0043-00-0850… diyor. Elimizdeki cevaba bakmamak olurdu.
    const dosyalar = MTC.files
      .filter((f) => f.path.startsWith("HALAT KLAVUZU (Ø325)/DWG/"))
      .map((f) => f.path.split("/").pop() ?? "");
    expect(dosyalar.length).toBeGreaterThan(0);
    expect(folderCodeFromContents(dosyalar)).toBe("0043-00-0850");
  });

  it("çözülen kod tam bir FolderName'e dönüşür", () => {
    const r = folderNameFromContents("HALAT KLAVUZU (Ø325)", [
      "0043-00-0850.dwg",
      "0043-00-0850-01.dwg",
      "0043-00-0850-06.pdf",
    ]);
    expect(r.by).toBe("klasor.icerikten");
    expect(r.value).toMatchObject({
      code: "0043-00-0850",
      group: "0850",
      description: "HALAT KLAVUZU",
      capacity: "Ø325",
    });
  });

  it("ENİNE klasöre zorla grup atanmaz", () => {
    // İSLEME RESİMLERİ altında 0200, 0300, 0600, 0801, 0802, 0803 var —
    // ortak bir grup yok. Uydurmak yanlış bir ağaç kurardı.
    const dosyalar = MTC.files
      .filter((f) => f.path.startsWith("İSLEME RESİMLERİ/"))
      .map((f) => f.path.split("/").pop() ?? "");
    expect(dosyalar.length).toBeGreaterThan(0);
    expect(folderCodeFromContents(dosyalar)).toBeNull();
  });

  it("hiç kod yoksa null", () => {
    expect(folderCodeFromContents(["okuma.txt", "notlar.md"])).toBeNull();
  });
});
