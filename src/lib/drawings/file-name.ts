// Dosya adı ve yol çözümleme.
//
// TEK REGEX YERİNE PARÇA PARÇA ÇÖZÜMLEME. Gerçek teslimlerde aynı bilgi farklı
// SIRALARLA yazılıyor:
//
//     S235JR - 10MM - 0057-00-0510-04 - (2 ADET).dxf   malzeme, kalınlık, kod, adet
//     BDS - 3,6MM - 0043-00-0400-02 - (2 ADET).dxf     malzeme deseni S'li DEĞİL
//     0043-00-0300-01 - TEKER - (4 ADET).pdf           kod, ad, adet
//     0043-00-0600-01 - (2 ADET) - KANCA ASKI SACI.dwg kod, adet, ad
//     0043-00-0100 - ANA KIRIS BIRLESTIRME SAC DET.dwg kod, ad
//     0057-00-0700-11 - (2 ADET).pdf                   kod, adet
//     0057-00-0510-01.dwg                              yalnız kod
//
// Bunların hepsini karşılayan bir regex ya yazılamaz ya da okunamaz. Ad " - "
// ile bölünür, HER PARÇA KENDİ BAŞINA sınıflandırılır (kod mu, adet mi,
// kalınlık mı, metin mi) ve sıra hiç önemsenmez. Yeni bir sıralama geldiğinde
// hiçbir şey yapmak gerekmez — zaten çalışır.
//
// YOL DA SEMANTİKTİR ama BEYANDIR: `S235JR-6MM` klasörünün içinde adı
// `S355JR - 6MM` diyen dosyalar var ve BOM dosya adını doğruluyor. İKİ GERÇEK
// PAKETTE DE aynı durum çıktı — tesadüf değil, desen. Kural: çelişkide DOSYA
// ADI KAZANIR, klasör beyanı ayrıca saklanır ve çelişki rapora düşer.

import { findPartCode, parsePartCode } from "./part-code";
import { isBukumKlasoru, isIptalKlasoru, trKatla, trSayi, trTarih } from "./tr-text";
import type { BomSourceKind, FileLifecycle, FileRole, ParsedFile } from "./types";

/** Uzantı → rol sözlüğü. Listede olmayan uzantı `diger`dir, hata değil. */
const UZANTI_ROL: Record<string, FileRole> = {
  dwg: "model",
  pdf: "resim",
  dxf: "kesim",
  xlsx: "bom",
  xlsm: "bom",
  xls: "bom",
  stp: "model3d",
  step: "model3d",
  igs: "model3d",
  iges: "model3d",
};

/**
 * Baştan hariç tutulan uzantılar.
 *
 * `.bak` AutoCAD'in otomatik yedeğidir ve MTC paketinde 10 tane var —
 * `0043-00-0000.bak` gerçek çizimin tam yanında duruyor. Deftere girse aynı
 * parça iki kez sayılırdı. Ressamdan klasörünü temizlemesini istemek yerine
 * sistem bunları tanır, yükler ve sayımların dışında tutar.
 */
const HARIC_UZANTILAR = new Set(["bak", "dwl", "dwl2", "tmp", "db", "ini"]);

/** `0057-00-1000_Sheet.dwg` — Inventor'ın açınım çalışma dosyası; PDF eşi yok. */
const CALISMA_SONEKI = /_sheet$/i;

const ADET_KALIBI = /^\(\s*(\d+)\s*ADET\s*\)$/;
const KALINLIK_KALIBI = /^(\d+(?:[.,]\d+)?)\s*MM$/;
/** `S235JR-8MM`, `BDS-3,6MM` — malzeme deseni DAYATILMAZ, ne yazıyorsa odur. */
const MALZEME_KLASORU = /^(.+?)-(\d+(?:[.,]\d+)?)\s*MM$/;

export interface PathHints {
  lifecycle: FileLifecycle | null;
  role: FileRole | null;
  material: string;
  thicknessMm: number | null;
}

/** Klasör segmentlerinden okunan ipuçları. Hiçbiri zorunlu değil. */
export function pathHints(folders: readonly string[]): PathHints {
  const h: PathHints = { lifecycle: null, role: null, material: "", thicknessMm: null };
  for (const seg of folders) {
    if (isIptalKlasoru(seg)) h.lifecycle = "iptal";
    if (isBukumKlasoru(seg)) h.role = "bukum";
    const m = seg.match(MALZEME_KLASORU);
    if (m) {
      h.material = m[1].trim();
      h.thicknessMm = trSayi(m[2]);
    }
  }
  return h;
}

interface Parcalar {
  code: string;
  codeNormalized: boolean;
  material: string;
  thicknessMm: number | null;
  qty: number | null;
  label: string;
  /** Parçalardan kod çıktı mı? */
  byTokens: boolean;
}

/**
 * Adı " - " ile böler ve her parçayı kendi başına sınıflandırır.
 *
 * Kod hiçbir parçadan çıkmazsa ADIN TAMAMINDA aranır: `2.0057-00-0500_DEPO_…`
 * gibi ayraçsız adlar da böylece kimliğini verir.
 */
function parcalaraAyir(base: string): Parcalar {
  const parcalar = base.split(/\s+-\s+/).map((p) => p.trim()).filter(Boolean);

  let code = "";
  let codeNormalized = false;
  let qty: number | null = null;
  let thicknessMm: number | null = null;
  let kalinlikIdx = -1;
  const metinler: { idx: number; text: string }[] = [];

  parcalar.forEach((p, idx) => {
    const buyuk = trKatla(p);

    const adet = buyuk.match(ADET_KALIBI);
    if (adet) {
      qty = Number(adet[1]);
      return;
    }

    const kalinlik = buyuk.match(KALINLIK_KALIBI);
    if (kalinlik) {
      thicknessMm = trSayi(kalinlik[1]);
      kalinlikIdx = idx;
      return;
    }

    const kod = parsePartCode(p);
    if (kod && !code) {
      code = kod.code;
      codeNormalized = kod.normalized;
      return;
    }

    metinler.push({ idx, text: p });
  });

  // Malzeme, kalınlığın HEMEN ÖNÜNDEKİ metindir. Konum kuralı burada geçerli
  // çünkü ikisi bir bütün: "S235JR - 10MM". Başka hiçbir yerde konuma
  // bakılmaz.
  let material = "";
  if (kalinlikIdx > 0) {
    const onceki = metinler.find((m) => m.idx === kalinlikIdx - 1);
    if (onceki) material = onceki.text;
  }

  const label = metinler
    .filter((m) => m.text !== material)
    .map((m) => m.text)
    .join(" - ");

  if (!code) {
    const bulunan = findPartCode(base);
    if (bulunan) {
      code = bulunan.code;
      codeNormalized = bulunan.normalized;
      return { code, codeNormalized, material, thicknessMm, qty, label: "", byTokens: false };
    }
  }

  return { code, codeNormalized, material, thicknessMm, qty, label, byTokens: Boolean(code) };
}

export interface FileInput {
  /** Kök klasör atılmış, NFC, "/" ayraçlı yol */
  relPath: string;
  size?: number;
  checksum?: string;
}

/** Bir dosyayı yolundan ve adından çözer. Hiçbir koşulda fırlatmaz. */
export function parseFile(input: FileInput): ParsedFile {
  const relPath = input.relPath.normalize("NFC").replace(/\\/g, "/");
  const segmentler = relPath.split("/").filter(Boolean);
  const fileName = segmentler[segmentler.length - 1] ?? relPath;
  const folders = segmentler.slice(0, -1);
  const folder = folders.join("/");

  const nokta = fileName.lastIndexOf(".");
  const ext = nokta > 0 ? fileName.slice(nokta + 1).toLowerCase() : "";
  let base = nokta > 0 ? fileName.slice(0, nokta) : fileName;

  const ipuclari = pathHints(folders);

  let lifecycle: FileLifecycle = ipuclari.lifecycle ?? "canli";
  if (HARIC_UZANTILAR.has(ext)) lifecycle = "haric";
  if (CALISMA_SONEKI.test(base)) {
    lifecycle = "haric";
    base = base.replace(CALISMA_SONEKI, "");
  }

  let role: FileRole = UZANTI_ROL[ext] ?? "diger";
  // BÜKÜM klasöründeki PDF bir resim değil tezgâh çıktısıdır; DWG ya da DXF
  // oraya düşerse kendi rolünü korur.
  if (ipuclari.role === "bukum" && role === "resim") role = "bukum";

  const p = parcalaraAyir(base);

  // Malzeme ve kalınlık: DOSYA ADI ÖNCE, klasör beyanı yedek.
  const material = p.material || ipuclari.material;
  const thicknessMm = p.thicknessMm ?? ipuclari.thicknessMm;

  let recognizedBy = "";
  if (role === "bom") recognizedBy = p.code ? "dosya.bom" : "";
  else if (p.code) recognizedBy = p.byTokens ? "dosya.parcali" : "dosya.taramali";

  return {
    relPath,
    folder,
    fileName,
    ext,
    role,
    lifecycle,
    partCode: p.code,
    codeNormalized: p.codeNormalized,
    material,
    thicknessMm,
    qty: p.qty,
    label: role === "bom" ? "" : p.label,
    recognizedBy,
    folderMaterial: ipuclari.material,
    folderThicknessMm: ipuclari.thicknessMm,
    size: input.size ?? 0,
    checksum: input.checksum ?? "",
  };
}

export interface BomFileName {
  /** Dosya adındaki kod: "0057-00-0500". Yoksa "" */
  code: string;
  kind: BomSourceKind;
  /** ISO tarih; çözülemezse null */
  date: string | null;
  /** Ressamın elle tuttuğu sürüm sayacı: "2." → 2 */
  revPrefix: number | null;
}

/**
 * BOM Excel'inin dosya adı: `{n}.{kod}_{TÜR}_{GG.AA.YYYY}.xlsx`
 *
 *     2.0057-00-0500_DEPO_31.07.2026.xlsx
 *     1.0043-01-0000_URUN AGACI_25.02.2026.xlsx
 *     1.0043-00-0050_DEPO_04,06,2026.xlsx      ← tarih ayracı VİRGÜL
 *
 * Ayraç şart koşulmaz, tür bilinmezse `bilinmiyor` olur ve dosya YİNE OKUNUR:
 * türü sınıflandıramamak içeriğini okuyamamak demek değildir.
 */
export function parseBomFileName(fileName: string): BomFileName {
  const base = fileName.normalize("NFC").replace(/\.[^.]+$/, "");
  const buyuk = trKatla(base);

  let kind: BomSourceKind = "bilinmiyor";
  if (buyuk.includes("URUN AGACI")) kind = "urun_agaci";
  else if (buyuk.includes("DEPO")) kind = "depo";

  const revEsi = base.match(/^(\d+)\./);
  const kod = findPartCode(base);

  return {
    code: kod?.code ?? "",
    kind,
    date: trTarih(base),
    revPrefix: revEsi ? Number(revEsi[1]) : null,
  };
}
