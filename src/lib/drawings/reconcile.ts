// Eşleştirme — dosyalar ile BOM satırlarını tek bir PARÇA DEFTERİne çevirir
// ve insanın bakması gereken yerleri bulgu olarak yazar.
//
// SAFTIR: DB, HTTP, dosya sistemi yok. Girdisi bir anlık görüntü, çıktısı
// defter + bulgular. Bu sayede kural değiştiğinde 200 MB'lık paketi yeniden
// indirmeden yeniden çalıştırılabilir ve iki gerçek pakete karşı test edilir.
//
// HİÇBİR BULGU ENGELLEYİCİ DEĞİLDİR. Bu dosyada "reddet" diye bir kavram
// yoktur; en kötü durumda defter boş kalır ve paket bir dosya arşivi olarak
// çalışmaya devam eder.

import {
  comparePartCodes,
  compareItemPaths,
  parentCode as ustKod,
  parentItemPath,
  parsePartCode,
} from "./part-code";
import { parseBomFileName } from "./file-name";
import { trBuyuk, trKatla, trSayi } from "./tr-text";
import type { BomRow, Finding, ParsedFile, PartKind } from "./types";
import type { FolderName } from "./folder-name";

/**
 * Eşleştirme kuralları sürümü — hesap motorundaki `ENGINE_VERSION` ile aynı
 * ruhta. Paket bu damgayı saklar; sürüm ilerlediğinde liste ekranı "kural
 * sürümü eski" çipi basar ve tek tıkla yeniden eşleştirilir. Tanıyıcı listesi
 * büyüdükçe ESKİ PAKETLER DE İYİLEŞİR — hoşgörülü tasarımın asıl kazancı bu.
 */
export const RECONCILER_VERSION = 1;

export interface PackageSnapshot {
  /** Kök klasörün ham adı */
  folderName: string;
  /** Çözülebildiyse klasör kimliği */
  folder: FolderName | null;
  files: ParsedFile[];
  bom: BomRow[];
  /** Kullanıcının birleştirdiği gruplar: {"0901": "0900"} */
  groupMap?: Record<string, string>;
  /** Sistemdeki güncel kalem no (kaymışsa bilgi bulgusu basılır) */
  systemItemNo?: string;
}

export interface RegisterPart {
  registerKey: string;
  partCode: string;
  bomSeq: number | null;
  bomRef: { file: string; sheet: string; rowNo: number } | null;
  parentCode: string;
  itemPath: string;
  level: number;
  kind: PartKind;
  name: string;
  description: string;
  assemblyTitle: string;
  material: string;
  materialRaw: string;
  category: string;
  qty: number | null;
  cutLengthMm: number | null;
  thicknessMm: number | null;
  weightKg: number | null;
  hasModel: boolean;
  hasSheet: boolean;
  hasCut: boolean;
  has3d: boolean;
  sheetRelPath: string;
  cutRelPath: string;
  sort: number;
}

export interface ReconcileResult {
  parts: RegisterPart[];
  findings: Finding[];
  /** Dosyaların yaşam döngüsü kararları — çağıran bunları kayda geçirir */
  fileDecisions: {
    relPath: string;
    lifecycle: ParsedFile["lifecycle"];
    supersedesRelPath: string;
    duplicateOfRelPath: string;
  }[];
  recognition: {
    pct: number;
    recognizedFiles: number;
    /** `haric` dışındaki dosya sayısı */
    totalFiles: number;
    unrecognized: string[];
  };
}

/** Malzeme yerine konmuş, malzeme OLMAYAN değerler. */
const MALZEME_YOK = new Set(["", "-", "GENERIC", "STEEL, MILD", "STEEL MILD", "N/A", "YOK"]);

/** Kesim yöntemi olan kategoriler — bunların bir DXF'i beklenir. */
const KESIM_KATEGORILERI = new Set(["PLAZMA", "LAZER"]);

/**
 * Resmi BEKLENMEYEN kategoriler.
 *
 * `Testere` standart profilin boya kesilmesidir: `NPL 50x50x5 L=23500`,
 * `KARE DEMİR 30x40x24000`, `DİKİŞLİ BORU Ø33,7x3,25 L=424`. TANIMIN KENDİSİ
 * imalat talimatıdır — testereciye verilecek başka bir bilgi yoktur.
 *
 * MTC paketinde bu ayrım yapılmayınca 13 "eksik resim" bulgusunun 12'si yanlış
 * alarm çıktı. Bir kez güvenini kaybeden rapora kimse bakmaz; sessizlik burada
 * doğruluktur. (Ressam yine de resim çizerse sorun yok — MONORAY'da `MİL Ø40
 * L=169,3` hem Testere hem resimli.)
 */
const RESIM_BEKLENMEYEN_KATEGORILER = new Set(["TESTERE"]);

function malzemeNormalize(raw: string): string {
  const k = trKatla(raw);
  if (MALZEME_YOK.has(k)) return "";
  // Yalnız sayıdan ibaret değerler (civata sınıfı "8.8" gibi) malzeme değildir.
  if (/^[\d.,]+$/.test(k)) return "";
  return trBuyuk(raw.trim());
}

/** "SAC 15x240x285" → 15. Kalınlık tanımın BAŞ SAYISIDIR. */
function kalinlikTanimdan(description: string): number | null {
  const m = description.match(/^\s*[A-ZÇĞİÖŞÜa-zçğıöşü]*\s*(\d+(?:[.,]\d+)?)\s*[xX×]/);
  return m ? trSayi(m[1]) : null;
}

/**
 * Kirli `QTY` sütunundan kesim boyu.
 *
 * `Testere` satırlarında bu sütun adet değil BOYdur ("169,3 mm"). Kaynak
 * Excel'de görünmeyen, satınalmaya doğrudan giren bir bilgi — ham değeri
 * sayıya zorlayan bir okuyucu bunu sessizce yok ederdi.
 */
function kesimBoyu(qtyRaw: string): number | null {
  return /^[\d.,]+\s*mm$/i.test(qtyRaw.trim()) ? trSayi(qtyRaw) : null;
}

function tamSayi(raw: string): number | null {
  const n = trSayi(raw);
  return n != null && Number.isFinite(n) ? Math.round(n) : null;
}

/**
 * BOM satırlarını birleştirir.
 *
 * Aynı parça birden çok sayfada geçebilir: MTC'de ÜRÜN AĞACI 246 satır,
 * DEPO'nun `Sayfa1`i 139 satır ve ikisi büyük ölçüde ÖRTÜŞÜR. Üst üste
 * eklemek defteri ikiye katlardı.
 *
 * İki ayrı kural, çünkü iki ayrı risk var:
 *   · KODLU satırlar birleştirilir — aynı kod aynı parçadır, alanlar
 *     tamamlanır (ağırlık ÜRÜN AĞACI'ndan, kategori DEPO'dan gelebilir) ve
 *     adet TOPLANMAZ, en büyüğü alınır.
 *   · KODSUZ satırlar (civata, segman, rulman) YALNIZ TEK BİR SAYFADAN alınır.
 *     Tanım+malzemeye göre birleştirmek iki farklı montajdaki aynı cıvatayı
 *     tek satıra indirir; iki sayfadan toplamak ise aynı cıvatayı iki kez
 *     saydırırdı. En çok kodsuz satır taşıyan sayfa "satın alma kaynağı"
 *     seçilir — o zaten satınalmaya giden listedir.
 */
function bomBirlestir(bom: BomRow[]): Map<string, BomRow[]> {
  const oncelik = (r: BomRow) => (r.sourceKind === "urun_agaci" ? 0 : 1);

  const kodlu = bom.filter((r) => r.partNumber.trim());
  const kodsuz = bom.filter((r) => !r.partNumber.trim());

  const sayfaSayaci = new Map<string, number>();
  for (const r of kodsuz) {
    const k = `${r.fileRelPath}#${r.sheetName}`;
    sayfaSayaci.set(k, (sayfaSayaci.get(k) ?? 0) + 1);
  }
  let satinalmaSayfasi = "";
  let enCok = 0;
  for (const [k, n] of sayfaSayaci) {
    if (n > enCok) {
      enCok = n;
      satinalmaSayfasi = k;
    }
  }

  const gruplar = new Map<string, BomRow[]>();
  const ekle = (anahtar: string, r: BomRow) => {
    const liste = gruplar.get(anahtar);
    if (liste) liste.push(r);
    else gruplar.set(anahtar, [r]);
  };

  for (const r of kodlu) {
    const kod = parsePartCode(r.partNumber.trim());
    ekle(kod ? kod.code : trKatla(r.partNumber), r);
  }

  let sira = 0;
  for (const r of kodsuz) {
    if (`${r.fileRelPath}#${r.sheetName}` !== satinalmaSayfasi) continue;
    sira += 1;
    ekle(`SATIR:${sira}`, r);
  }

  for (const liste of gruplar.values()) liste.sort((a, b) => oncelik(a) - oncelik(b));
  return gruplar;
}

/** Grubun ilk dolu değerini alır (öncelik sırası zaten uygulanmış). */
function ilkDolu(liste: BomRow[], sec: (r: BomRow) => string): string {
  for (const r of liste) {
    const v = sec(r).trim();
    if (v) return v;
  }
  return "";
}

export function reconcile(snap: PackageSnapshot): ReconcileResult {
  const findings: Finding[] = [];
  const ekle = (f: Finding) => findings.push(f);

  // ————————————————————————————————————————————— 1. Dosya kararları
  const kullanilir = snap.files.filter((f) => f.lifecycle !== "haric");
  const kararlar = new Map<
    string,
    { lifecycle: ParsedFile["lifecycle"]; supersedesRelPath: string; duplicateOfRelPath: string }
  >();
  for (const f of snap.files) {
    kararlar.set(f.relPath, {
      lifecycle: f.lifecycle,
      supersedesRelPath: "",
      duplicateOfRelPath: "",
    });
  }

  for (const f of snap.files.filter((x) => x.lifecycle === "haric")) {
    ekle({
      code: "YEDEK_DOSYA",
      kind: "bilgi",
      subject: f.relPath,
      title: `${f.fileName} bir çalışma/yedek dosyası — deftere alınmadı.`,
      detail: "Dosya arşivde duruyor; yalnız parça sayımlarının dışında tutuldu.",
      hintId: "Ö-8",
    });
  }

  // Kopya dosyalar: aynı imza, farklı yol. BÜKÜM klasöründeki PDF'ler DWG
  // altındakilerin BAYT BAYT AYNISI — tezgâh için yeniden etiketlenmiş kopya.
  const imzaGruplari = new Map<string, ParsedFile[]>();
  for (const f of kullanilir) {
    if (!f.checksum) continue;
    const g = imzaGruplari.get(f.checksum);
    if (g) g.push(f);
    else imzaGruplari.set(f.checksum, [f]);
  }
  for (const grup of imzaGruplari.values()) {
    if (grup.length < 2) continue;
    // Aslı, kopya rolü TAŞIMAYAN olandır; hepsi kopyaysa yolca ilki.
    const sirali = [...grup].sort((a, b) => {
      const ab = a.role === "bukum" ? 1 : 0;
      const bb = b.role === "bukum" ? 1 : 0;
      return ab - bb || a.relPath.localeCompare(b.relPath, "tr");
    });
    const asil = sirali[0];
    for (const k of sirali.slice(1)) {
      // AYNI İÇERİK, FARKLI PARÇA masum bir kopya DEĞİLDİR.
      //
      // MTC'de `0043-00-0400-04.pdf` ile `0043-00-0400-02.pdf` bayt bayt aynı:
      // iki ayrı parça, tek bir resim. Ressam büyük olasılıkla yanlış görünümü
      // dışa aktarmış ve `-04` hiç çizilmemiş. Bunu "kopya" sayıp birini
      // sayımdan düşürmek, hangisinin yanlış olduğunu BİLDİĞİMİZİ varsaymak
      // olurdu — bilmiyoruz. İkisi de canlı kalır, çelişki insana bırakılır.
      const ayriParca =
        k.partCode && asil.partCode && k.partCode !== asil.partCode;

      if (ayriParca) {
        ekle({
          code: "AYNI_ICERIK_FARKLI_PARCA",
          kind: "celiski",
          subject: k.partCode,
          title: `${k.fileName} ile ${asil.fileName} bayt bayt aynı ama farklı parçalar.`,
          detail:
            "Biri yanlış dışa aktarılmış olabilir; hangisi olduğunu sistem bilemez, ikisi de canlı bırakıldı.",
          data: { digerParca: asil.partCode, digerDosya: asil.relPath },
          hintId: "Ö-4",
        });
        continue;
      }

      const karar = kararlar.get(k.relPath)!;
      karar.lifecycle = "kopya";
      karar.duplicateOfRelPath = asil.relPath;
      ekle({
        code: "KOPYA_DOSYA",
        kind: "bilgi",
        subject: k.relPath,
        title: `${k.fileName} bayt bayt ${asil.fileName} ile aynı.`,
        detail: "Kopya olarak işaretlendi; sayımlarda bir kez geçer.",
      });
    }
  }

  // İPTAL: canlıda aynı adlı dosya varsa bu onun ESKİ SÜRÜMÜdür.
  const canliAdlar = new Map<string, ParsedFile>();
  for (const f of kullanilir) {
    if (kararlar.get(f.relPath)!.lifecycle === "canli") canliAdlar.set(f.fileName, f);
  }
  for (const f of kullanilir.filter((x) => x.lifecycle === "iptal")) {
    const canli = canliAdlar.get(f.fileName);
    if (canli) {
      const karar = kararlar.get(f.relPath)!;
      karar.lifecycle = "superse";
      karar.supersedesRelPath = canli.relPath;
      ekle({
        code: "IPTAL_SURUM",
        kind: "bilgi",
        subject: f.relPath,
        title: `${f.fileName} canlı sürümün eski hâli — süperse edildi.`,
        detail: `Canlı sürüm: ${canli.relPath}`,
        hintId: "Ö-5",
      });
    } else {
      ekle({
        code: "IPTAL_YETIM",
        kind: "bilgi",
        subject: f.relPath,
        title: `${f.fileName} İPTAL altında ama canlı bir karşılığı yok.`,
        detail: "Vazgeçilmiş bir parça olabilir; deftere alınmadı.",
        hintId: "Ö-5",
      });
    }
  }

  // Klasör malzeme beyanı ile dosya adı çelişkisi.
  for (const f of kullanilir) {
    if (!f.material || !f.folderMaterial) continue;
    if (trKatla(f.material) === trKatla(f.folderMaterial)) continue;
    ekle({
      code: "DXF_KLASOR_CELISKISI",
      kind: "celiski",
      subject: f.relPath,
      title: `Klasör ${f.folderMaterial} diyor, dosya adı ${f.material}.`,
      detail: "Dosya adı esas alındı — iki gerçek pakette de BOM dosya adını doğruladı.",
      hintId: "Ö-6",
    });
  }

  // Tanınmayan dosyalar — arşivde duruyorlar, elle bağlanabilirler.
  for (const f of kullanilir.filter((x) => !x.partCode)) {
    ekle({
      code: "TANINMADI",
      kind: "bilgi",
      subject: f.relPath,
      title: `${f.fileName} bir parça koduna bağlanamadı.`,
      detail: "Dosya arşivde duruyor. Raporda elle bir koda bağlayabilirsiniz.",
      hintId: "Ö-2",
    });
  }

  for (const f of kullanilir.filter((x) => x.codeNormalized)) {
    ekle({
      code: "AD_DUZELTILDI",
      kind: "bilgi",
      subject: f.relPath,
      title: `${f.fileName} adındaki iş numarası ${f.partCode} olarak düzeltildi.`,
      detail: "Fazladan sıfır ayıklandı; dosya deftere doğru kodla girdi.",
      hintId: "Ö-2",
    });
  }

  // ————————————————————————————————————————————— 2. Dosyaları koda göre topla
  const gecerli = kullanilir.filter((f) => kararlar.get(f.relPath)!.lifecycle === "canli");
  const koduDosyalar = new Map<string, ParsedFile[]>();
  for (const f of gecerli) {
    if (!f.partCode) continue;
    const g = koduDosyalar.get(f.partCode);
    if (g) g.push(f);
    else koduDosyalar.set(f.partCode, [f]);
  }

  // ————————————————————————————————————————————— 3. Defteri kur
  const gruplar = bomBirlestir(snap.bom);
  const parts = new Map<string, RegisterPart>();

  const bosPart = (registerKey: string, partCode: string): RegisterPart => ({
    registerKey,
    partCode,
    bomSeq: null,
    bomRef: null,
    parentCode: partCode ? ustKod(partCode) : "",
    itemPath: "",
    level: parsePartCode(partCode)?.level ?? 0,
    kind: "bilinmiyor",
    name: "",
    description: "",
    assemblyTitle: "",
    material: "",
    materialRaw: "",
    category: "",
    qty: null,
    cutLengthMm: null,
    thicknessMm: null,
    weightKg: null,
    hasModel: false,
    hasSheet: false,
    hasCut: false,
    has3d: false,
    sheetRelPath: "",
    cutRelPath: "",
    sort: 0,
  });

  for (const [anahtar, satirlar] of gruplar) {
    const kodsuz = anahtar.startsWith("SATIR:");
    const kod = kodsuz ? "" : anahtar;
    const p = bosPart(anahtar, kod);

    const ilk = satirlar[0];
    p.bomRef = { file: ilk.fileRelPath, sheet: ilk.sheetName, rowNo: ilk.rowNo };
    p.bomSeq = kodsuz ? Number(anahtar.slice(6)) : null;

    p.description = ilkDolu(satirlar, (r) => r.description);
    p.assemblyTitle = ilkDolu(satirlar, (r) => r.title);
    p.materialRaw = ilkDolu(satirlar, (r) => r.materialRaw);
    p.material = malzemeNormalize(p.materialRaw);
    p.category = ilkDolu(satirlar, (r) => r.category);
    p.itemPath = ilkDolu(satirlar, (r) => r.itemPath);

    // Adet TOPLANMAZ: aynı parça iki sayfada da geçebilir.
    const adetler = satirlar.map((r) => tamSayi(r.itemQtyRaw) ?? tamSayi(r.qtyRaw)).filter(
      (n): n is number => n != null
    );
    p.qty = adetler.length ? Math.max(...adetler) : null;

    for (const r of satirlar) {
      p.cutLengthMm ??= kesimBoyu(r.qtyRaw);
      p.weightKg ??= r.massRaw ? trSayi(r.massRaw) : null;
    }
    p.thicknessMm = kalinlikTanimdan(p.description);

    const yapi = trKatla(ilkDolu(satirlar, (r) => r.bomStructure));
    if (yapi === "PURCHASED") p.kind = "satinalma";
    else if (trKatla(p.category) === "KOMPLE") p.kind = "montaj";
    else if (yapi === "NORMAL") p.kind = "imalat";

    parts.set(anahtar, p);
  }

  // BOM'da olmayan ama dosyası olan kodlar — bunlar MONTAJLARIN KENDİSİdir.
  // Bir parça listesinde montajın satırı olmaması doğrudur; bulgu BASILMAZ.
  for (const kod of koduDosyalar.keys()) {
    if (parts.has(kod)) continue;
    const p = bosPart(kod, kod);
    p.kind = "montaj";
    parts.set(kod, p);
  }

  // ————————————————————————————————————————————— 4. Dosyaları deftere bağla
  for (const p of parts.values()) {
    if (!p.partCode) continue;
    const dosyalar = koduDosyalar.get(p.partCode) ?? [];
    for (const f of dosyalar) {
      if (f.role === "model") p.hasModel = true;
      if (f.role === "resim" || f.role === "bukum") {
        p.hasSheet = true;
        if (!p.sheetRelPath || f.role === "resim") p.sheetRelPath = f.relPath;
      }
      if (f.role === "kesim") {
        p.hasCut = true;
        p.cutRelPath = f.relPath;
        p.thicknessMm ??= f.thicknessMm;
        if (!p.material) p.material = malzemeNormalize(f.material);
      }
      if (f.role === "model3d") p.has3d = true;
      if (!p.name && f.label) p.name = f.label;
    }
  }

  // Çocuğu olan her kod bir montajdır — BOM ne derse desin.
  const cocukluKodlar = new Set<string>();
  for (const p of parts.values()) if (p.parentCode) cocukluKodlar.add(p.parentCode);
  for (const p of parts.values()) {
    if (p.partCode && cocukluKodlar.has(p.partCode) && p.kind !== "satinalma") p.kind = "montaj";
    if (p.kind === "bilinmiyor" && p.partCode) p.kind = "imalat";
  }

  // ————————————————————————————————————————————— 5. Ağaç: iki kaynak
  const kodluParts = [...parts.values()].filter((p) => p.partCode);
  const itemPathVar = kodluParts.some((p) => p.itemPath);
  if (itemPathVar) {
    const yolaGoreKod = new Map<string, string>();
    for (const p of kodluParts) if (p.itemPath) yolaGoreKod.set(p.itemPath, p.partCode);
    for (const p of kodluParts) {
      if (!p.itemPath) continue;
      const ustYol = parentItemPath(p.itemPath);
      const ustKodItem = ustYol ? yolaGoreKod.get(ustYol) ?? "" : "";
      if (ustKodItem && p.parentCode && ustKodItem !== p.parentCode) {
        ekle({
          code: "AGAC_CELISKISI",
          kind: "celiski",
          subject: p.partCode,
          title: `Ürün ağacı üstü ${ustKodItem}, kod üstü ${p.parentCode} diyor.`,
          detail: "Ürün ağacı esas alındı — Inventor montaj yapısının kendisidir.",
        });
      }
      if (ustKodItem) p.parentCode = ustKodItem;
    }
  }

  // ————————————————————————————————————————————— 6. Defter bulguları
  for (const p of parts.values()) {
    const dosyaVar = p.hasModel || p.hasSheet || p.hasCut || p.has3d;

    // İMALAT parçası ama hiç dosyası yok. Satın alınanlar, montajlar ve
    // testere kalemleri KAPSAM DIŞIDIR: DIN cıvatasının resmi olmaması da,
    // 23,5 metrelik köşebendin resmi olmaması da doğrudur.
    if (
      p.kind === "imalat" &&
      p.partCode &&
      !dosyaVar &&
      !RESIM_BEKLENMEYEN_KATEGORILER.has(trKatla(p.category))
    ) {
      ekle({
        code: "PARCA_RESIMSIZ",
        kind: "eksik",
        subject: p.partCode,
        title: `${p.partCode} imalat parçası ama hiçbir resmi yok.`,
        detail: `${p.description || "Tanım yok"} — üretilecek ama çizimi pakette bulunamadı.`,
        data: { description: p.description, category: p.category },
        hintId: "Ö-9",
      });
    }

    // Montaj kapsam dışı: MTC'de `TAMBUR SEHBASI` kategorisi Plazma yazılmış
    // ama altı parçalı bir alt montaj — ondan DXF beklemek yanlış alarmdır.
    if (
      p.partCode &&
      p.kind !== "montaj" &&
      KESIM_KATEGORILERI.has(trKatla(p.category)) &&
      !p.hasCut
    ) {
      ekle({
        code: "DXF_BEKLENEN_YOK",
        kind: "eksik",
        subject: p.partCode,
        title: `${p.partCode} ${p.category} ile kesilecek ama DXF'i yok.`,
        detail: "Kesimciye gidecek dosya pakette bulunamadı.",
        hintId: "Ö-8",
      });
    }

    if (p.hasCut && !p.hasSheet) {
      ekle({
        code: "KESIM_RESIMSIZ",
        kind: "eksik",
        subject: p.partCode,
        title: `${p.partCode} kesim dosyası var ama ölçülü resmi yok.`,
        detail: "Parça kesilebilir ama kontrol edilecek bir resmi yok.",
        hintId: "Ö-4",
      });
    }

    if (p.hasModel && !p.hasSheet) {
      ekle({
        code: "RESIM_ESI_YOK",
        kind: "eksik",
        subject: p.partCode,
        title: `${p.partCode} için DWG var ama PDF eşi yok.`,
        detail: "Üretime inen PDF'tir; modelin yazdırılmış eşi pakette bulunamadı.",
        hintId: "Ö-4",
      });
    }

    if (p.partCode && p.kind !== "montaj" && p.materialRaw && !p.material) {
      ekle({
        code: "MALZEME_BELIRSIZ",
        kind: "bilgi",
        subject: p.partCode,
        title: `${p.partCode} malzemesi "${p.materialRaw}" olarak yazılmış.`,
        detail: "Malzeme olarak okunamadı; sac ihtiyacı hesabına girmez.",
      });
    }
  }

  // Aynı adı taşıyan iki grup (0900 + 0901 = DENGE MAKARASI).
  const adaGoreGrup = new Map<string, Set<string>>();
  for (const p of parts.values()) {
    if (!p.partCode || !p.assemblyTitle) continue;
    const grup = parsePartCode(p.partCode)?.segments[0] ?? "";
    if (!grup) continue;
    const k = trKatla(p.assemblyTitle);
    const s = adaGoreGrup.get(k);
    if (s) s.add(grup);
    else adaGoreGrup.set(k, new Set([grup]));
  }
  for (const [ad, gruplarSeti] of adaGoreGrup) {
    // KURAL DAR TUTULUR: tam İKİ grup ve numaraları BİTİŞİK.
    //
    // Gözlenen desen budur — MONORAY'da ressamın DENGE MAKARASI'na ikinci bir
    // sayfa gerekince grup numarasını bir artırması (0900 → 0901). Gevşek
    // kural (aynı adı taşıyan her grup) MTC'de yedi bulgu üretti ve hepsi
    // yanlıştı: 0051/0052/0053 zaten 0050'nin alt montajları, hepsinin aynı
    // başlığı taşıması doğru davranış. Yedi yanlışa bir doğru feda edilmez.
    if (gruplarSeti.size !== 2) continue;
    const [a, b] = [...gruplarSeti].map(Number).sort((x, y) => x - y);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b - a !== 1) continue;
    ekle({
      code: "GRUP_BOLUNMUS",
      kind: "bilgi",
      subject: [...gruplarSeti].sort().join(" + "),
      title: `"${ad}" adı bitişik iki grup numarasında geçiyor.`,
      detail: "Aynı montaj iki sayfaya bölünmüş olabilir; isterseniz birleştirin.",
    });
  }

  // ————————————————————————————————————————————— 7. Paket düzeyi bulgular
  const paketKalem = snap.folder?.itemNo ?? "";
  if (snap.systemItemNo && paketKalem && snap.systemItemNo !== paketKalem) {
    ekle({
      code: "KALEM_NO_KAYDI",
      kind: "bilgi",
      subject: paketKalem,
      title: `Paket ${paketKalem} diyor; sistemde bu iş artık ${snap.systemItemNo}.`,
      detail: "Kodlar yeniden çizilmediği sürece bu normaldir; içerik değiştirilmedi.",
    });
  }

  const bomKalemleri = new Set(
    snap.bom.map((r) => parsePartCode(r.partNumber)?.itemNo ?? "").filter(Boolean)
  );
  for (const kalem of bomKalemleri) {
    if (paketKalem && kalem !== paketKalem) {
      ekle({
        code: "BOM_KALEM_FARKI",
        kind: "celiski",
        subject: kalem,
        title: `BOM satırları ${kalem} diyor, klasör ${paketKalem} diyor.`,
        detail: "Klasör adı esas alındı; BOM satırları yine deftere girdi.",
        hintId: "Ö-7",
      });
    }
  }

  // Excel DOSYA ADINDAKİ kod ile içeriği tutuyor mu?
  //
  // MTC'de dosya adı `1.0043-01-0000_DEPO_…` diyor ama içindeki bütün satırlar
  // ve klasörün kendisi `0043-00` diyor. Ad yanlış, içerik doğru. Bu ayrımı
  // yalnız dosya adı ile satırları AYRI AYRI karşılaştırınca görebiliriz;
  // sessiz kalırsa bir gün yanlış kaleme aranan bir Excel kaybolur.
  for (const f of kullanilir.filter((x) => x.role === "bom")) {
    const adKodu = parseBomFileName(f.fileName).code;
    const adKalem = adKodu ? parsePartCode(adKodu)?.itemNo ?? "" : "";
    if (!adKalem || !paketKalem || adKalem === paketKalem) continue;
    ekle({
      code: "EXCEL_ADI_KALEM_FARKI",
      kind: "celiski",
      subject: f.relPath,
      title: `${f.fileName} adı ${adKalem} diyor; klasör ve satırlar ${paketKalem} diyor.`,
      detail: "İçerik esas alındı; dosya adındaki kalem eki büyük olasılıkla yazım hatası.",
      hintId: "Ö-7",
    });
  }

  if (snap.folder?.statusHint) {
    ekle({
      code: "URETIM_IPUCU",
      kind: "bilgi",
      subject: snap.folder.code || snap.folderName,
      title: `Klasör adında "${snap.folder.statusHint}" yazıyor.`,
      detail: "Üretim durumu notu olarak kaydedildi.",
    });
  }

  // ————————————————————————————————————————————— 8. Tanıma oranı
  const tanindi = kullanilir.filter((f) => f.recognizedBy).length;
  const toplam = kullanilir.length;
  const recognition = {
    pct: toplam === 0 ? 100 : Math.round((tanindi / toplam) * 100),
    recognizedFiles: tanindi,
    totalFiles: toplam,
    unrecognized: kullanilir.filter((f) => !f.recognizedBy).map((f) => f.relPath),
  };

  // ————————————————————————————————————————————— 9. Sırala
  const sirali = [...parts.values()].sort((a, b) => {
    if (a.itemPath && b.itemPath) return compareItemPaths(a.itemPath, b.itemPath);
    if (a.partCode && b.partCode) return comparePartCodes(a.partCode, b.partCode);
    if (a.partCode) return -1;
    if (b.partCode) return 1;
    return (a.bomSeq ?? 0) - (b.bomSeq ?? 0);
  });
  sirali.forEach((p, i) => {
    p.sort = i;
  });

  return {
    parts: sirali,
    findings,
    fileDecisions: [...kararlar.entries()].map(([relPath, k]) => ({ relPath, ...k })),
    recognition,
  };
}
