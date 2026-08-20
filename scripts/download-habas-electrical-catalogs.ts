/**
 * HABAŞ 50T elektrik malzemeleri için üretici dokümanlarını indirir ve
 * `Elektrik Katalogları/HABAŞ 50T` altında izlenebilir bir eşleme defteri üretir.
 *
 * Ağdan gelen her dosya PDF imzası ile doğrulanır. Bu betik hiçbir zaman
 * üretici belgesi görünümünde yardımcı/özet PDF üretmez; kısa teknik föyler
 * yalnız gerçek üretici kataloğunun doğrulanmış sayfalarından çıkarılır.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "..");
const WORKSPACE = path.resolve(REPO, "..");
const CATALOG_ROOT = path.join(WORKSPACE, "Elektrik Katalogları");
const OUTPUT_DIR = path.join(CATALOG_ROOT, "HABAŞ 50T");
const MATERIALS_JSON = path.join(REPO, ".tmp", "habas-materials.json");
const PRIOR_INDEX = path.join(CATALOG_ROOT, "00 - İÇİNDEKİLER ve MALZEME EŞLEŞMESİ.md");
const OUTPUT_INDEX = path.join(OUTPUT_DIR, "00 - HABAŞ 50T MALZEME ve DOKÜMAN EŞLEŞMESİ.md");
const OUTPUT_SOURCES = path.join(OUTPUT_DIR, "00 - HABAŞ 50T KAYNAK MANİFESTOSU.json");

interface Material {
  supplier: string;
  type_no: string;
  designation: string;
  part_no: string;
  qty: number;
}

interface DownloadSpec {
  fileName: string;
  url: string;
  publisher: string;
  sourceType: "manufacturer" | "authorized" | "distributor";
  note: string;
}

interface DownloadResult extends DownloadSpec {
  bytes: number;
  sha256: string;
  status: "downloaded" | "existing";
}

function identity(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function safeName(value: string): string {
  return value.replace(/[<>:"/\\|?*]/g, "_").replace(/\s+/g, " ").trim();
}

function relativeOutput(fileName: string): string {
  return path.join("HABAŞ 50T", fileName);
}

function parsePriorMappings(text: string): Map<string, string[]> {
  const result = new Map<string, string[]>();
  let inProducts = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^##\s+2\b/.test(line)) {
      inProducts = true;
      continue;
    }
    if (inProducts && /^##\s+3\b/.test(line)) break;
    if (!inProducts) continue;
    const row = /^\|\s*`([^`]+)`\s*\|\s*([^|]*)\|\s*([^|]*)\|\s*(.*?)\s*\|\s*$/.exec(line);
    if (!row) continue;
    const files = row[4]
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/\*\*/g, "")
      .split("\n")
      .map((value) => value.trim())
      .filter((value) => /\.pdf$/i.test(value) && !/[—-]\s*belge yok/i.test(value));
    if (files.length) result.set(identity(row[1]), files);
  }
  return result;
}

const downloads: DownloadSpec[] = [];

function addDownload(spec: DownloadSpec): string {
  const existing = downloads.find((item) => item.fileName === spec.fileName);
  if (!existing) downloads.push(spec);
  return relativeOutput(spec.fileName);
}

function manufacturer(fileName: string, url: string, note: string): string {
  return addDownload({ fileName, url, publisher: fileName.split(" - ")[0], sourceType: "manufacturer", note });
}

const staticFiles = {
  abb104: manufacturer(
    "ABB - ACS880-104 İnverter Modülleri Donanım Kılavuzu (EN).pdf",
    "https://library.e.abb.com/public/db015309f18047c688c68cc88496271e/EN_ACS880-104_HW_Q.pdf",
    "ABB Library; ACS880-104 order codes, dimensions, control units, filters and accessories."
  ),
  abb204: manufacturer(
    "ABB - ACS880-204 IGBT Besleme Modülleri Donanım Kılavuzu (EN).pdf",
    "https://library.e.abb.com/public/2eb247cb87074d0d83efd19d72633530/EN_ACS880-204_HW_N.pdf",
    "ABB Library; ACS880-204 supply modules and associated hardware."
  ),
  abbBcu: manufacturer(
    "ABB - BCU-02 BCU-12 BCU-22 Kontrol Üniteleri Donanım Kılavuzu (EN).pdf",
    "https://library.e.abb.com/public/b9bc510b3af047b5aca66dfcef1dee76/EN_BCU-x2_HW_E_A4.pdf",
    "ABB Library; BCU-02/12/22 hardware manual."
  ),
  abbFen: manufacturer(
    "ABB - FEN-31 HTL Enkoder Arayüzü Kullanım Kılavuzu (EN).pdf",
    "https://library.e.abb.com/public/8914f25fdad041ef97cab3ce87c870e8/EN_FEN-31_UM_D.pdf",
    "ABB Library; FEN-31 user manual."
  ),
  abbFena: manufacturer(
    "ABB - FENA-01 FENA-11 FENA-21 Ethernet Adaptörü Kılavuzu (EN).pdf",
    "https://library.e.abb.com/public/d6a31af1808043ba8ef53980031041ea/EN_FENA01_11_21_UM_E_A4.pdf",
    "ABB Library; FENA-21 is explicitly covered."
  ),
  abbFpno: manufacturer(
    "ABB - FPNO-21 PROFINET Adaptörü Kullanım Kılavuzu (EN).pdf",
    "https://library.e.abb.com/public/f834941bb4df47548ac2963dfc24fc81/EN_FPNO_21_QG_A5_B.pdf",
    "ABB Library; FPNO-21 PROFINET IO adapter installation and start-up guide."
  ),
  abbAf30: manufacturer(
    "ABB - AF30 Kontaktör Teknik Föyü (EN).pdf",
    "https://library.e.abb.com/public/735eb8e58d9cddabc125786100381680/1SBC101411D0201.pdf",
    "ABB Library; AF contactor technical data."
  ),
  abbNoch: manufacturer(
    "ABB - ACS580 ve NOCH du-dt Filtreleri Kataloğu (EN).pdf",
    "https://library.e.abb.com/public/64e27ad791ce484ab2ba0b2efece5a8d/ACS580_Catalog_3AUA0000145061_RevR_EN%2010-04-2026.pdf?x-sign=pvsNZUgo0buEpt4pdunir%2BndF6UccahXhGLiIDeoNci4E13WDu84tB%2FyfDKrELK%2F",
    "ABB Library; NOCH output filter selection data."
  ),
  abbPtc: manufacturer(
    "ABB - Asenkron Motorlar ve PTC Termistörler Kılavuzu (EN).pdf",
    "https://library.e.abb.com/public/92c7bc73c5ce4d27882cd418d389bc28/Manual%20for%20Induction%20Motors%20and%20Generators_EN.pdf",
    "ABB Library; motor protection and PTC thermistor guidance."
  ),
  abbOs: addDownload({
    fileName: "ABB - OS160GD04F Sigortalı Yük Ayırıcı Teknik Föyü (EN).pdf",
    url: "https://ita-sacchi.mo.cloudinary.net/PRODUCT/DOCUMENT/hlr-system/ABB/MD22_BMECAT_20240410/ELEE%2520735%25205.PDF",
    publisher: "ABB",
    sourceType: "authorized",
    note: "ABB product-details PDF distributed by an electrical wholesaler."
  }),
  abbOfaa: addDownload({
    fileName: "ABB - OFAA000GG25 NH000 25A Sigorta Teknik Föyü (EN).pdf",
    url: "https://f.machineryhost.com/bf98d32d2a962606c791e5807ebee169/OFAA000GG25%20%7C%20ABB.pdf",
    publisher: "ABB",
    sourceType: "authorized",
    note: "ABB product-details PDF distributed by an electrical wholesaler."
  }),
  bannerManual: manufacturer(
    "BANNER - T30R Radar Sensör Kullanım Kılavuzu (EN).pdf",
    "https://info.bannerengineering.com/cs/groups/public/documents/literature/217048.pdf",
    "Banner Engineering official literature; T30R series instructions."
  ),
  bannerCatalog: manufacturer(
    "BANNER - T30R Radar Sensörleri Broşürü (EN).pdf",
    "https://info.bannerengineering.com/cs/groups/public/documents/literature/b_51944191.pdf",
    "Banner Engineering official T30R product brochure."
  ),
  bemisBb1: manufacturer(
    "BEMIS - BB1-0731-0003 Plastik Buat Teknik Föyü (TR).pdf",
    "https://www.bemis.com.tr/downloadPDF/609",
    "Bemis official generated product PDF."
  ),
  bemisCatalog: manufacturer(
    "BEMIS - Genel Ürün Kataloğu 2026 (EN).pdf",
    "https://www.bemis.com.tr/resimler/bemis/dokumanlar/fiyat-listesi/bemis-catalog-2026.pdf",
    "Bemis official 2026 catalogue, including enclosure boxes and industrial plugs."
  ),
  eatonFuse: manufacturer(
    "EATON BUSSMANN - Yüksek Hızlı Sigortalar Tam Katalog (EN).pdf",
    "https://www.eaton.com/content/dam/eaton/products/electrical-circuit-protection/fuses/bussmann-series-high-speed-fuses/bus-ele-cat-10506-hsf.pdf",
    "Eaton Bussmann official high-speed fuse catalogue."
  ),
  eatonFak: manufacturer(
    "EATON - FAK Avuç İçi Şalterleri Katalog Bölümü (EN).pdf",
    "https://www.eaton.com/content/dam/eaton/products/industrialcontrols-drives-automation-sensors/catalog-volumes/operator-interface-vol09-tab04.pdf",
    "Eaton official operator-interface catalogue section."
  ),
  eurowestList: manufacturer(
    "EUROWEST - Pano Aksesuarları Fiyat ve Ürün Listesi 2026 (TR).pdf",
    "https://www.eurowest.com.tr/wp-content/uploads/2026/02/EUROWEST-2026-Fiyat-Listesi.pdf",
    "Eurowest official 2026 product list; EPT-M thermostat is listed."
  ),
  mersenUs27: manufacturer(
    "MERSEN - Modulostar US27 Sigorta Yuvaları Teknik Kataloğu (EN).pdf",
    "https://www.mersen.com/sites/default/files/medias/PIM/files/DS-Fuse-Holders-Modulostar-CMS27-Ultrasafe-US27-EN.pdf",
    "Mersen official product datasheet; US271MI is explicitly listed."
  ),
  hubner: manufacturer(
    "JOHANNES HÜBNER - FGHJ 2 Enkoder Montaj ve Kullanım Kılavuzu (EN).pdf",
    "https://huebner-giessen.com/fileadmin/media/operating-and-assembly-instructions/fghj2-user-manual-en.pdf",
    "Johannes Hübner official FGHJ 2 manual."
  ),
  motronaManual: addDownload({
    fileName: "MOTRONA - GV210 Sinyal Dağıtıcı Kullanım Kılavuzu (EN).pdf",
    url: "https://www.hmkdirect.com/downloads/motrona_10products/gv210_pdf/gv210_e_manual.pdf",
    publisher: "Motrona",
    sourceType: "authorized",
    note: "Manufacturer manual mirrored by an industrial sensor distributor."
  }),
  motronaData: addDownload({
    fileName: "MOTRONA - GV210 Teknik Veri Sayfası (EN).pdf",
    url: "https://www.hmkdirect.com/downloads/motrona_10products/gv210_pdf/gv210_dse.pdf",
    publisher: "Motrona",
    sourceType: "distributor",
    note: "Motrona GV210 datasheet mirrored by an instrumentation distributor."
  }),
  niki: manufacturer(
    "NIKI - N1000 P-2 160W LED Projektör Teknik Föyü (TR).pdf",
    "https://nikielektronik.com/wp-content/uploads/2025/06/P-2-T80.pdf",
    "Niki Elektronik official P-2 family technical sheet."
  ),
  omron: manufacturer(
    "OMRON - G2RV-SR G3RV-SR Slim Röle Teknik Föyü (EN).pdf",
    "https://assets.omron.eu/downloads/latest/datasheet/en/g2rv-sr_g3rv-sr_slim_i_o_relay_datasheet_en.pdf",
    "Omron official G2RV-SR datasheet; G2RV-SR700 DC24 is explicitly listed."
  ),
  schneiderXb5: manufacturer(
    "SCHNEIDER ELECTRIC - Harmony XB5 Plastik Kumanda Ürünleri Kataloğu (EN).pdf",
    "https://download.schneider-electric.com/files?filename=Catalog&p_Doc_Ref=DIA5ED2121213EN",
    "Schneider Electric official Harmony XB5 catalogue."
  ),
  schneiderXck: manufacturer(
    "SCHNEIDER ELECTRIC - XCKMR54D1H29 Limit Şalteri Talimat Föyü (EN).pdf",
    "https://iportal.se.com/Contents/docs/SQD-XCKMR54D1H29_INSTRUCTION%20SHEET.PDF",
    "Schneider/Telemecanique official instruction sheet."
  ),
  schneiderXs: manufacturer(
    "SCHNEIDER ELECTRIC - XS612B1MAL2 Endüktif Sensör Teknik Föyü (EN).pdf",
    "https://iportal.se.com/Contents/docs/SQD-XS612B1MAL2_DATA%20SHEET.PDF",
    "Schneider Electric official product data sheet."
  ),
  segerCatalog: addDownload({
    fileName: "SEGER - Korna Ürün Kataloğu (EN).pdf",
    url: "https://ruyaotomotiv.com.tr/data/katalog/segerhorn.pdf",
    publisher: "Seger",
    sourceType: "distributor",
    note: "Manufacturer-branded Seger horn catalogue mirrored by an automotive distributor."
  }),
  sibreEldro: addDownload({
    fileName: "SIBRE - ELDRO Elektrohidrolik İtici Teknik Verileri (EN).pdf",
    url: "https://sibre.com.au/wp-content/uploads/ELDRO-Electrohydraulic-Thruster-Technical-Data.pdf",
    publisher: "SIBRE",
    sourceType: "manufacturer",
    note: "SIBRE ELDRO technical data; Ed 23/5 and Ed 80/6 ratings are explicitly listed."
  }),
  socomec125: addDownload({
    fileName: "SOCOMEC - 95233012 ATyS r 3P 125A Teknik Föyü (EN).pdf",
    url: "https://www.nhp.com.au/public/assets/pim/Original/10031/95233012-AU-ATYS-TRANSFER-SWITCH-NO-LOGIC-3P-Datasheet.pdf",
    publisher: "Socomec / NHP",
    sourceType: "authorized",
    note: "Exact 95233012 manufacturer-branded product datasheet from Socomec distributor NHP."
  }),
  socomec400: addDownload({
    fileName: "SOCOMEC - 95233040 ATyS r 3P 400A Teknik Föyü (EN).pdf",
    url: "https://prdsccdnstorage.blob.core.windows.net/techdatasheets/95233040-97253-datasheet.pdf?se=2050-02-24T14%3A36%3A22Z&sig=ZYSSzNvPIpdF2duj%2B0Q%2Fxscgj9MvyEATcIdm%2Bn6Urmc%3D&sp=rwdlac&spr=https&srt=sco&ss=b&st=2020-02-24T06%3A36%3A22Z&sv=2019-02-02",
    publisher: "Socomec / NHP",
    sourceType: "authorized",
    note: "Exact 95233040 manufacturer-branded product datasheet from Socomec distributor NHP."
  }),
  socomecTechnical: addDownload({
    fileName: "SOCOMEC - ATyS Serisi Transfer Şalterleri 125-3200A Kataloğu (EN).pdf",
    url: "https://www.nhp.com.au/public/assets/pim/Original/10027/Socomec-ATyS-Automatic-Transfer-Switch-Equipment-125A-to-3200A-Flyer.pdf",
    publisher: "Socomec / NHP",
    sourceType: "authorized",
    note: "Manufacturer-branded ATyS series catalogue from Socomec distributor NHP; both exact references are listed."
  }),
  spohn: addDownload({
    fileName: "SPOHN+BURKHARDT - VNS0 Kumanda Kolları Ürün Kataloğu (EN).pdf",
    url: "https://www.elmatechnology.com/wp-content/uploads/2017/01/Spobu_product_catalog_Joysticks_English.pdf",
    publisher: "Spohn+Burkhardt",
    sourceType: "authorized",
    note: "Manufacturer catalogue mirrored by an industrial control distributor; VNS0 range is covered."
  }),
  teleRadio: manufacturer(
    "TELE RADIO - Tiger G2 TG-R4-6 Alıcı Kullanım Kılavuzu (EN-FR).pdf",
    "https://www.tele-radio.com/app/uploads/MANUEL-Manuel-basique-TIGER-1.pdf",
    "Tele Radio official Tiger manual; TG-R4-6 receiver is covered."
  ),
  vem: manufacturer(
    "VEM - Alçak Gerilim Motorları Ana Kataloğu (EN).pdf",
    "https://www.vem-group.com/files/downloads/kataloge/niederspannung/VEM-Hauptkatalog_KAP2_en.pdf",
    "VEM official low-voltage motors main catalogue; K21R and W4 ranges."
  ),
};

const schneiderMirrorUrls: Record<string, string> = {
  XB5AA21: "https://externalassets.unilogcorp.com/ASSETS/DOCUMENTS/ITEMS/EN/Schneider_Electric_XB5AA21_Specification_Sheet.pdf",
  XB5AA42: "https://externalassets.unilogcorp.com/ASSETS/DOCUMENTS/ITEMS/EN/Schneider_Electric_XB5AA42_Specification_Sheet.pdf",
  XB5AA51: "https://externalassets.unilogcorp.com/ASSETS/DOCUMENTS/ITEMS/EN/Schneider_Electric_XB5AA51_Specification_Sheet.pdf",
  XB5AVB1: "https://externalassets.unilogcorp.com/ASSETS/DOCUMENTS/ITEMS/EN/Schneider_Electric_XB5AVB1_Specification_Sheet.pdf",
  XB5AVB4: "https://externalassets.unilogcorp.com/ASSETS/DOCUMENTS/ITEMS/EN/Schneider_Electric_XB5AVB4_Specification_Sheet.pdf",
  XB5AVB5: "https://externalassets.unilogcorp.com/ASSETS/DOCUMENTS/ITEMS/EN/Schneider_Electric_XB5AVB5_Specification_Sheet.pdf",
  XB5AW33B5: "https://externalassets.unilogcorp.com/ASSETS/DOCUMENTS/ITEMS/EN/Schneider_Electric_XB5AW33B5_Specification_Sheet.pdf",
  XB5AW34B5: "https://externalassets.unilogcorp.com/ASSETS/DOCUMENTS/ITEMS/EN/Schneider_Electric_XB5AW34B5_Specification_Sheet.pdf",
  ZBZ33: "https://externalassets.unilogcorp.com/ASSETS/DOCUMENTS/ITEMS/EN/Schneider_Electric_ZBZ33_Specification_Sheet.pdf"
};

function siemensCatalogs(typeNo: string): string[] {
  const key = identity(typeNo);
  if (/^3(RH|RT|TF)/.test(key)) return ["SIEMENS - SIRIUS IC10 Kontaktorler 3RT 3RH Motor Anahtarlama (EN).pdf"];
  if (/^3(RN|UG)/.test(key)) return ["SIEMENS - SIRIUS IC10 Izleme ve Kumanda Cihazlari 3UG 3RN (EN).pdf"];
  if (/^3(RU|RV)/.test(key)) return ["SIEMENS - SIRIUS IC10 Koruma Cihazlari 3RV 3RU 3RB (EN).pdf"];
  if (/^3SK/.test(key)) return ["SIEMENS - SIRIUS IC10 Guvenlik Teknigi 3SK Guvenlik Roleleri (EN).pdf"];
  if (/^3VA/.test(key)) return ["SIEMENS - SENTRON 3VA Kompakt Salterler LV10 Katalog Ozeti (EN).pdf"];
  if (/^5SL/.test(key)) return ["SIEMENS - SENTRON 5SL Otomatik Sigortalar MCB LV10 (EN).pdf"];
  if (/^5(ST|TT)/.test(key)) return ["SIEMENS - BETA Modular Kurulum Cihazlari 5SL 5ST 5TT LV10 (EN).pdf"];
  if (/^6AV/.test(key)) return ["SIEMENS - SIMATIC HMI Operatör Panelleri Kataloğu ST 80 (EN).pdf", "SIEMENS - SIMATIC HMI Basic Panels 2. Nesil KTP1200 İşletme Kılavuzu (EN).pdf"];
  if (/^6ES/.test(key)) return ["SIEMENS - SIMATIC Ürün Kataloğu ST 70 (EN).pdf"];
  if (/^6GK/.test(key)) return ["SIEMENS - SCALANCE XB-100 Yonetilmeyen Ethernet Switchleri Kullanma Kılavuzu (EN).pdf", "SIEMENS - SCALANCE X Yonetilmeyen Ethernet Switchleri Siparis Katalogu (EN).pdf"];
  if (/^LZS/.test(key)) return ["SIEMENS - SIRIUS IC10 Yardimci Kontaktorler ve Roleler LZS (EN).pdf"];
  return ["SIEMENS - SIMATIC Ürün Kataloğu ST 70 (EN).pdf"];
}

function additionalFiles(material: Material): string[] {
  const type = material.type_no;
  const key = identity(type);
  const supplier = identity(material.supplier);
  const files: string[] = [];

  if (supplier === "SIEMENSAG") {
    const fileName = `SIEMENS - ${safeName(type)} Teknik Veri Sayfası (EN).pdf`;
    files.push(manufacturer(
      fileName,
      `https://support.industry.siemens.com/teddatasheet/?caller=SIOS&format=pdf&language=en&mlfbs=${encodeURIComponent(type)}`,
      `Siemens Industry Online Support TED datasheet for exact MLFB ${type}.`
    ));
    files.push(...siemensCatalogs(type));
  } else if (supplier === "SCHNEIDERELECTRIC") {
    if (key === "NML0400121") files.push("SCHNEIDER ELECTRIC - NML0400121 Nemliyer Vavien Anahtar Beyaz (TR).pdf");
    else if (key === "XCKMR54D1H29") files.push(staticFiles.schneiderXck);
    else if (key === "XS612B1MAL2") files.push(staticFiles.schneiderXs);
    else if (key === "XS618B1MAL2") files.push("TELEMECANIQUE SENSORS - XS618B1MAL2 Endüktif Sensör M18 Sn8mm Veri Sayfası (EN).pdf");
    else {
      const mirrorUrl = schneiderMirrorUrls[type];
      files.push(mirrorUrl ? addDownload({
        fileName: `SCHNEIDER ELECTRIC - ${safeName(type)} Ürün Teknik Föyü (EN).pdf`,
        url: mirrorUrl,
        publisher: "Schneider Electric",
        sourceType: "distributor",
        note: `Schneider Electric exact product data sheet for ${type}, mirrored by an industrial distributor.`
      }) : manufacturer(
        `SCHNEIDER ELECTRIC - ${safeName(type)} Ürün Teknik Föyü (EN).pdf`,
        `https://iportal.se.com/Contents/docs/SQD-${encodeURIComponent(type)}.PDF`,
        `Schneider Electric exact product data sheet for ${type}.`
      ));
    }
    if (/^XB5/.test(key)) files.push(staticFiles.schneiderXb5);
    if (/^XB4|^ZBZ/.test(key)) files.push("SCHNEIDER ELECTRIC - Harmony XB4 Metal Kumanda ve Sinyal Katalogu (EN).pdf");
    if (/^XS/.test(key)) files.push("TELEMECANIQUE SENSORS - OsiSense XS Endüktif Yaklaşım Sensörleri Kataloğu (EN).pdf");
  } else if (supplier === "ABB") {
    if (/^ACS880104/.test(key)) files.push(staticFiles.abb104);
    else if (/^ACS880204/.test(key)) files.push(staticFiles.abb204);
    else if (key === "AF303000") files.push(staticFiles.abbAf30, staticFiles.abb104);
    else if (key === "BCU02") files.push(staticFiles.abbBcu, staticFiles.abb104);
    else if (key === "FEN31") files.push(staticFiles.abbFen, staticFiles.abb104);
    else if (key === "FENA21") files.push(staticFiles.abbFena, staticFiles.abb104);
    else if (key === "FPNO21") files.push(staticFiles.abbFpno, staticFiles.abb104);
    else if (key === "MOTORPTC") files.push(staticFiles.abbPtc, staticFiles.abb104);
    else if (key === "NOCH007060") files.push(staticFiles.abbNoch, staticFiles.abb104);
    else if (key === "OFAA000GG25") files.push(staticFiles.abbOfaa, staticFiles.abb104);
    else if (key === "OS160GD04F") files.push(staticFiles.abbOs, staticFiles.abb104);
    else files.push(staticFiles.abb104, staticFiles.abb204);
  } else if (supplier === "BANNERENGINEERING") files.push(staticFiles.bannerManual, staticFiles.bannerCatalog);
  else if (supplier === "BEMIS") files.push(staticFiles.bemisCatalog, ...(key === "BB107310003" ? [staticFiles.bemisBb1] : []));
  else if (supplier === "EATON") files.push(staticFiles.eatonFuse, ...(key === "FAKSKC11I" ? [staticFiles.eatonFak] : []));
  else if (supplier === "EUROWESTELECTRIC") files.push(staticFiles.eurowestList);
  else if (supplier === "FERRAZSHAWMUT") files.push(staticFiles.mersenUs27);
  else if (supplier === "JOHANNESHUBNER") files.push(staticFiles.hubner);
  else if (supplier === "MOTRONA") files.push(staticFiles.motronaData, staticFiles.motronaManual);
  else if (supplier === "NIKIELECTRONICS") files.push(staticFiles.niki);
  else if (supplier === "OMRON") files.push(staticFiles.omron, "OMRON - Endüstriyel Röleler Broşürü G2RV (TR).pdf");
  else if (supplier === "ETA") files.push("ETA MATIS - Trafo ve Reaktor Urun Katalogu (TR).pdf");
  else if (supplier === "PELSAN") files.push("PELSAN - Aydınlatma Ürün Kataloğu (TR).pdf", "PELSAN - Sıva Üstü Wallwasher Armatür Teknik Föyü (TR).pdf");
  else if (supplier === "SEGER") files.push(staticFiles.segerCatalog);
  else if (supplier === "SIBRE") files.push(staticFiles.sibreEldro);
  else if (supplier === "SOCOMEC") {
    files.push(staticFiles.socomecTechnical);
    if (key === "95233012") files.push(staticFiles.socomec125);
    if (key === "95233040") files.push(staticFiles.socomec400);
  }
  else if (supplier === "SPOHNBURKHARDT") files.push(staticFiles.spohn);
  else if (supplier === "TELERADIO") files.push(staticFiles.teleRadio);
  else if (supplier === "VEMMOTORS") files.push(staticFiles.vem);

  return [...new Set(files)];
}

async function downloadPdf(spec: DownloadSpec): Promise<DownloadResult> {
  const target = path.join(OUTPUT_DIR, spec.fileName);
  try {
    const current = await readFile(target);
    if (current.subarray(0, 5).toString("ascii") === "%PDF-") {
      return { ...spec, bytes: current.byteLength, sha256: createHash("sha256").update(current).digest("hex"), status: "existing" };
    }
  } catch {
    // İndirilecek.
  }

  let response: Response | undefined;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    response = await fetch(spec.url, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
        Accept: "application/pdf,*/*",
        Referer: `${new URL(spec.url).origin}/`,
        "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });
    if (response.status !== 429 || attempt === 3) break;
    const waitMs = 15_000 * (attempt + 1);
    console.log(`${spec.fileName}: Siemens indirme sınırı, ${waitMs / 1000} sn sonra yeniden deneniyor...`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  if (!response) throw new Error(`${spec.fileName}: indirme yanıtı alınamadı (${spec.url})`);
  if (!response.ok) throw new Error(`${spec.fileName}: HTTP ${response.status} (${spec.url})`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (Buffer.from(bytes.subarray(0, 5)).toString("ascii") !== "%PDF-") {
    const contentType = response.headers.get("content-type") ?? "unknown";
    throw new Error(`${spec.fileName}: PDF yerine ${contentType} geldi (${response.url})`);
  }
  await writeFile(target, bytes);
  return { ...spec, bytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex"), status: "downloaded" };
}

async function main(): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const payload = JSON.parse(await readFile(MATERIALS_JSON, "utf8")) as { materials: Material[]; summary: unknown };
  const materials = payload.materials;
  const prior = parsePriorMappings(await readFile(PRIOR_INDEX, "utf8"));
  const mappings = materials.map((material) => {
    const files = [...(prior.get(identity(material.type_no)) ?? []), ...additionalFiles(material)];
    return { material, files: [...new Set(files)] };
  });

  const results: DownloadResult[] = [];
  for (let i = 0; i < downloads.length; i++) {
    const result = await downloadPdf(downloads[i]);
    results.push(result);
    process.stdout.write(`[${i + 1}/${downloads.length}] ${result.status}: ${result.fileName}\n`);
  }
  const grouped = new Map<string, typeof mappings>();
  for (const mapping of mappings) {
    const group = grouped.get(mapping.material.supplier) ?? [];
    group.push(mapping);
    grouped.set(mapping.material.supplier, group);
  }
  const lines = [
    "# HABAŞ 50T — ELEKTRİK KATALOGLARI VE TEKNİK FÖY EŞLEMESİ",
    "",
    `**Malzeme kapsamı:** ${materials.length} benzersiz ürün`,
    "",
    "Belgeler üretici/yetkili dokümantasyon merkezlerinden alınır. ORION tarafından oluşturulan kaynak özeti teknik föy sayılmaz; kısa föy yalnız gerçek üretici kataloğunun doğrulanmış 1–2 sayfasıdır.",
    "",
    "## 1 · KAYNAK ÖZETİ",
    "",
    `- İndirilen/yeniden kullanılan yeni kaynak: ${results.length}`,
    `- Üretici veya üretici dokümantasyon merkezi: ${results.filter((item) => item.sourceType === "manufacturer").length}`,
    `- Yetkili/dağıtıcı ayna: ${results.filter((item) => item.sourceType !== "manufacturer").length}`,
    "",
    "## 2 · MALZEME LİSTESİ VE DOSYALAR",
    "",
  ];
  for (const [supplier, group] of [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b, "tr"))) {
    lines.push(`### ${supplier}`, "", "| Tip No | Tanım | Parça No | Belgeler |", "|---|---|---|---|");
    for (const { material, files } of group.sort((a, b) => a.material.type_no.localeCompare(b.material.type_no, "tr"))) {
      const fileCell = files.map((file) => file.replace(/\\/g, "/")).join("<br>");
      lines.push(`| \`${material.type_no}\` | ${material.designation.replace(/\|/g, "-")} | ${material.part_no.replace(/\|/g, "-")} | ${fileCell} |`);
    }
    lines.push("");
  }
  lines.push("## 3 · DOĞRULAMA NOTLARI", "", "SHA-256, PDF sayfa sayısı ve ürün-kod görünürlüğü ayrı doğrulama raporunda tutulur.", "");
  await writeFile(OUTPUT_INDEX, `${lines.join("\n")}\n`, "utf8");
  await writeFile(OUTPUT_SOURCES, `${JSON.stringify({ generated_at: new Date().toISOString(), project: "HABAŞ 50T", materials: materials.length, sources: results }, null, 2)}\n`, "utf8");
  process.stdout.write(`Tamamlandı: ${materials.length} ürün, ${downloads.length} ağ PDF'i.\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
