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
// `normalize.ts` yalnız `tr-text`e bağlıdır; bu yön tek yönlüdür ve çember
// üretmez (çekirdeğin saflık kuralı bozulmaz).
import { firmaKabulleri } from "./normalize";
import type { DxfHeader } from "./dxf-header";
import type { SheetBomRow, TitleBlock } from "./titleblock";
import { trBuyuk, trKatla, trSayi } from "./tr-text";
import type { BomRow, Finding, ParsedFile, PartKind } from "./types";
import type { FolderName } from "./folder-name";

/**
 * Eşleştirme kuralları sürümü — hesap motorundaki `ENGINE_VERSION` ile aynı
 * ruhta. Paket bu damgayı saklar; sürüm ilerlediğinde liste ekranı "kural
 * sürümü eski" çipi basar ve tek tıkla yeniden eşleştirilir. Tanıyıcı listesi
 * büyüdükçe ESKİ PAKETLER DE İYİLEŞİR — hoşgörülü tasarımın asıl kazancı bu.
 *
 * SÜRÜM 2 (13.08.2026) — İKİ KURAL DÜZELDİ, İKİSİ DE SATIN ALMAYA AKIYOR:
 *   · kodsuz satırların kazanan sayfası PAKET değil GRUP başına seçiliyor
 *     (`bomBirlestir`); başka grupların satın alma listesi düşüyordu.
 *   · "satın alınıyor" değer sözlüğü Türkçe yazımları da tanıyor
 *     (`SATIN_ALMA_YAPISI`); sütun başlığı zaten iki dilliydi.
 *
 * SÜRÜM 3 (13.08.2026, aynı gün) — DEFTERİN İÇERİĞİ DEĞİŞTİ:
 *   · kodsuz satırın GRUBU ürün ağacının `Item` yolundan çözülüyor ve
 *     `parentCode`/`assemblyTitle` olarak deftere YAZILIYOR; kökteki satır
 *     paketin kendi grubuna bağlanıyor.
 *   · FİRMA KABULLERİ satıra işleniyor (`firmaKabulleri`): cıvata/somun
 *     kalitesi ve galvaniz eki, yaylı rondela malzemesi.
 *
 * Sürümü ilerletmek ZORUNLUDUR: depoda duran paketler eski kuralla
 * eşleştirildi ve defterleri eksik. Yükseltme onlara "kural sürümü eski"
 * çipini bastırır ve tek tıkla yeniden eşleştirilmelerini sağlar — yeniden
 * yükleme GEREKMEZ, `reconcile` saf olduğu için baytlara dokunulmaz.
 *
 * SÜRÜM 3'TE BİR BEDEL VAR ve sessiz değildir: galvaniz eki alan kodsuz
 * satırın ilerleme anahtarı (katlanmış tanım) değişir, yani o kalemin eski
 * "satın alındı" işareti yetim kalır. `orphanMarks` onları gösterir.
 */
export const RECONCILER_VERSION = 3;

/**
 * Bir dosyanın OKUNMUŞ içeriği (`drawing_files.meta`).
 *
 * İçerik okuma İSTEĞE BAĞLIDIR: `content` hiç verilmezse defter yalnız addan
 * ve Excel'den kurulur ve hiçbir bulgu değişmez. Verildiğinde YALNIZ BOŞ ALANI
 * DOLDURUR — Excel'den gelen bir ağırlığı antetteki değerle EZMEZ. Öncelik
 * ürün ağacı > depo > antet, çünkü ilk ikisi ressamın onayladığı listedir,
 * antet ise modelin anlık hâli.
 */
export interface FileContent {
  titleBlock?: TitleBlock;
  sheetBom?: SheetBomRow[];
  dxf?: DxfHeader;
}

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
  /** Okunmuş dosya içerikleri, `relPath` anahtarlı. Yoksa Faz 1 davranışı. */
  content?: Record<string, FileContent>;
  /**
   * DEPOYA ULAŞMAMIŞ dosyaların yolları.
   *
   * Kayıt satırı yazıldığı hâlde baytları depoda BULUNMAYAN dosyalar. Bilerek
   * atlananlar (yedek dosyalar ve bayt bayt kopyalar) BURAYA GİRMEZ — onları
   * "eksik" saymak, modülün en büyük düşmanı olan yanlış alarmı doğrudan
   * üretirdi.
   *
   * Alan İSTEĞE BAĞLIDIR ve verilmediğinde hiçbir bulgu değişmez: çekirdek saf
   * kalır, fikstürler ve betikler deponun varlığından habersiz çalışmayı
   * sürdürür. Doğruyu bilen tek yer `verifyStorage`tır ve o da burayı doldurur.
   */
  missingStorage?: string[];
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
  /** Ağırlık NEREDEN geldi — rapor ve defter bunu göstermeli. */
  weightSource: "" | "excel" | "antet";
  /** DXF kutusu (gerçek kesim ölçüsü); yalnız içerik okunduysa dolu. */
  extentsXMm: number | null;
  extentsYMm: number | null;
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
 * "Bu satır satın alınıyor" DEĞERLERİ — sütun başlığı gibi İKİ DİLLİ.
 *
 * `excel.ts`teki başlık sözlüğü `bomStructure` için zaten `BOM STRUCTURE ·
 * YAPI · TÜR` kabul ediyor; değer karşılaştırması ise yalnız İngilizce
 * `PURCHASED`ı tanıyordu. Bu asimetri sessiz ve pahalıydı: Türkçe arayüzle
 * verilmiş bir listede sütun OKUNUYOR, değeri TANINMIYOR ve satır `imalat`a
 * düşüyordu. Parça numarası dolu olduğu için `part_code = ''` kapısından da
 * geçemiyor, yani kalem Satın Alma'da HİÇ görünmeyip Üretim tahtasına
 * çıkıyordu — atölyenin kesmesi beklenen bir rulman.
 *
 * Liste UYDURMA DEĞİL ÇEVİRİDİR (md. 21'in "uydurma veri girme" kuralı):
 * her giriş `Purchased` ile birebir aynı şeyi söyleyen Türkçe yazımdır.
 * Anlamı genişleten bir değer (ör. SolidWorks'ün `Toolbox`u) BURAYA GERÇEK
 * BİR TESLİM KLASÖRÜNDE GÖRÜLMEDEN girmez.
 */
const SATIN_ALMA_YAPISI = new Set([
  "PURCHASED",
  "SATIN ALMA",
  "SATINALMA",
  "SATIN ALINAN",
  "SATIN ALINMIS",
]);

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
 *   · KODSUZ satırlar (civata, segman, rulman) HER GRUPTAN yalnız TEK BİR
 *     SAYFADAN alınır. Tanım+malzemeye göre birleştirmek iki farklı montajdaki
 *     aynı cıvatayı tek satıra indirir; AYNI GRUBUN iki sayfasından toplamak
 *     ise aynı cıvatayı iki kez saydırırdı. Grup içinde en çok kodsuz satır
 *     taşıyan sayfa "satın alma kaynağı" seçilir — o zaten satınalmaya giden
 *     listedir.
 *
 * KAZANAN SAYFA GRUP BAŞINADIR, PAKET BAŞINA DEĞİL (ölçüldü, 13.08.2026).
 * Kural bir süre bütün pakette TEK bir sayfa seçiyordu ve gerekçesi yalnız
 * ÖRTÜŞMEYİ anlatıyordu — oysa örtüşme AYNI GRUBUN iki sayfası arasındadır.
 * MTC'de ölçüm şunu verdi: düşen 76 kodsuz satırın 67'si kazananla aynı gruba
 * ait (54'ü kazanan sayfada birebir duruyor — kural orada haklı), ama 9'u
 * BAŞKA gruplarındı (`0043-00-0050` ve `0043-00-0850`) ve hiçbiri kazanan
 * sayfada YOKTU: o iki grubun satın alma listesi bütünüyle kayboluyordu.
 * Ressam grup grup Excel veriyorsa — ki firmanın numaralandırması tam olarak
 * bunu teşvik ediyor — paketin satın alma listesi tek bir gruba iner.
 */
function bomBirlestir(bom: BomRow[]): Map<string, BomRow[]> {
  const oncelik = (r: BomRow) => (r.sourceKind === "urun_agaci" ? 0 : 1);

  const kodlu = bom.filter((r) => r.partNumber.trim());
  const kodsuz = bom.filter((r) => !r.partNumber.trim());

  // Grup kimliği BOM dosyasının ADINDAN gelir (`1.0043-00-0850_DEPO_….xlsx`).
  // Kod çözülemeyen dosya KENDİ BAŞINA bir gruptur: adı okunamayan iki Excel'i
  // tek gruba toplamak, aralarında olmayan bir örtüşme varsayardı.
  const grupKodu = (r: BomRow) =>
    parseBomFileName(r.fileRelPath.split("/").pop() ?? "").code || r.fileRelPath;

  const grupSayaclari = new Map<string, Map<string, { adet: number; oncelik: number }>>();
  for (const r of kodsuz) {
    const g = grupKodu(r);
    const k = `${r.fileRelPath}#${r.sheetName}`;
    const sayac = grupSayaclari.get(g) ?? new Map<string, { adet: number; oncelik: number }>();
    const v = sayac.get(k) ?? { adet: 0, oncelik: oncelik(r) };
    v.adet += 1;
    sayac.set(k, v);
    grupSayaclari.set(g, sayac);
  }
  const satinalmaSayfalari = new Set<string>();
  for (const sayac of grupSayaclari.values()) {
    let kazanan = "";
    let enIyi = { adet: -1, oncelik: 9 };
    // ÖNCE SATIR SAYISI, BERABERLİKTE ÜRÜN AĞACI. `0043-00-0850`in DEPO'su ile
    // ÜRÜN AĞACI'nın ikisi de üçer kodsuz satır taşıyor; kazananı girdi
    // sırasına bırakmak kararı rastlantıya bırakırdı. Ürün ağacı ressamın
    // onayladığı listedir ve `oncelik` bunu zaten bir kez söylüyor.
    for (const [k, v] of sayac) {
      if (v.adet > enIyi.adet || (v.adet === enIyi.adet && v.oncelik < enIyi.oncelik)) {
        enIyi = v;
        kazanan = k;
      }
    }
    if (kazanan) satinalmaSayfalari.add(kazanan);
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
    if (!satinalmaSayfalari.has(`${r.fileRelPath}#${r.sheetName}`)) continue;
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
    weightSource: "",
    extentsXMm: null,
    extentsYMm: null,
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

    // FİRMA KABULLERİ DEFTERE YAZILIR, EKRANDA HESAPLANMAZ.
    //
    // Cıvata/somun kalitesi ve galvaniz eki ile yaylı rondela malzemesi
    // (kullanıcı kararı, 13.08.2026 — gerekçesi `normalize.ts`te). Defterin
    // KENDİSİNE yazılmalarının sebebi tek: Parçalar ekranı, paketin Satın Alma
    // sekmesi ve `/purchasing` havuzu aynı satırı okur ve üçünde farklı bir
    // tanım görmek "hangisi doğru" sorusunu doğururdu. Sunum katmanında
    // hesaplansaydı üç ayrı yerde üç kez yazılırdı.
    //
    // BEDELİ AÇIKÇA KABUL EDİLDİ: kodsuz satırın ilerleme anahtarı katlanmış
    // TANIMDIR (`progressKeyOf`), yani galvaniz eki alan bir kalemin eski
    // "satın alındı" işareti yetim kalır. Zaten `orphanMarks` onu gösterir ve
    // kazanç bunun karşılığını fazlasıyla veriyor: galvanizli ve galvanizsiz
    // yazılmış AYNI cıvata bundan sonra TEK kalemdir — firma zaten hep
    // galvanizli alıyor.
    const kabul = firmaKabulleri({
      tanim: p.description,
      malzeme: p.material,
      malzemeHam: p.materialRaw,
    });
    p.description = kabul.tanim;
    p.material = kabul.malzeme;

    // Adet TOPLANMAZ: aynı parça iki sayfada da geçebilir.
    const adetler = satirlar.map((r) => tamSayi(r.itemQtyRaw) ?? tamSayi(r.qtyRaw)).filter(
      (n): n is number => n != null
    );
    p.qty = adetler.length ? Math.max(...adetler) : null;

    for (const r of satirlar) {
      p.cutLengthMm ??= kesimBoyu(r.qtyRaw);
      if (p.weightKg == null && r.massRaw) {
        const kg = trSayi(r.massRaw);
        if (kg != null) {
          p.weightKg = kg;
          p.weightSource = "excel";
        }
      }
    }
    p.thicknessMm = kalinlikTanimdan(p.description);

    const yapi = trKatla(ilkDolu(satirlar, (r) => r.bomStructure));
    if (SATIN_ALMA_YAPISI.has(yapi)) p.kind = "satinalma";
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
        // DXF kutusu GERÇEK kesim ölçüsüdür; tanımdaki nominal ölçü yuvarlanmış
        // ya da eski olabilir (örnek klasörde Ø220 annulus "200x200" yazıyordu).
        const dxf = snap.content?.[f.relPath]?.dxf;
        if (dxf) {
          p.extentsXMm ??= dxf.extentsXMm;
          p.extentsYMm ??= dxf.extentsYMm;
        }
      }
      if (f.role === "model3d") p.has3d = true;
      if (!p.name && f.label) p.name = f.label;

      // ANTET YALNIZ BOŞ ALANI DOLDURUR. Excel'den gelen bir değeri ezmez:
      // ürün ağacı ressamın onayladığı listedir, antet modelin anlık hâli.
      const antet = snap.content?.[f.relPath]?.titleBlock;
      if (antet) {
        if (p.weightKg == null && antet.weightKg != null) {
          p.weightKg = antet.weightKg;
          p.weightSource = "antet";
        }
        if (!p.material) p.material = malzemeNormalize(antet.material);
        if (!p.name && antet.jobName) p.name = antet.jobName;
        if (!p.assemblyTitle && antet.parentProject) p.assemblyTitle = antet.parentProject;
      }
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
  const yolaGoreParca = new Map<string, RegisterPart>();
  if (itemPathVar) {
    const yolaGoreKod = new Map<string, string>();
    for (const p of kodluParts) {
      if (!p.itemPath) continue;
      yolaGoreKod.set(p.itemPath, p.partCode);
      yolaGoreParca.set(p.itemPath, p);
    }
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

  // ————————————————————————————— 5b. KODSUZ SATIRIN GRUBU DA AĞAÇTAN ÇÖZÜLÜR
  //
  // Kullanıcı bildirimi (13.08.2026): *"Depo excelde bazı parçaların hangi
  // gruba ait olduğu görülmüyor. Satın alma bunların hangi grup içerisinde
  // olduğunu görmek istiyor."* Ölçüldü ve doğru: DEPO'nun 67 kodsuz satırının
  // YALNIZ BİRİNDE `Title` dolu — cıvatanın, rulmanın montaj başlığı yok.
  //
  // ÜRÜN AĞACI o bilgiyi `Item` sütununda TAŞIYOR: "3.14" satırı "3"ün, yani
  // `0043-00-0300 KÖPRÜ YÜRÜTME GRUBU`nun altındadır. Canlı veride 96 satın
  // alma satırının 89'unda bu yol var. `derive.ts` bunu zaten çözüyordu ama
  // YALNIZ KENDİ İÇİNDE (`kaynakIzi`); `drawing_parts`a yazılmadığı için
  // Parçalar ekranı, paketin Satın Alma sekmesi ve `/purchasing` havuzu üçü de
  // grubu göremiyordu. Çözüm defterin KENDİSİNE yazılır — tek kaynak.
  //
  // ÜRÜN AĞACI YOKSA HİÇBİR ŞEY OLMAZ (kullanıcı şartı: *"Eğer ürün ağacı
  // yoksa yine sistem kilitlenmesin, DEPO exceline göre devam etsin"*).
  // `itemPathVar` false ise bu blok hiç çalışmaz; MONORAY ve PERGEL paketleri
  // bugün tam olarak öyle.
  const paketGrupKodu =
    snap.folder?.itemNo && snap.folder.group ? `${snap.folder.itemNo}-${snap.folder.group}` : "";
  if (itemPathVar) {
    for (const p of parts.values()) {
      if (p.partCode || !p.itemPath) continue;

      // ÜSTE TIRMANILIR: ara montajın defterde satırı olmayabilir ve orada
      // durmak izi tamamen silerdi (`derive.ts`teki `ustMontaj` ile aynı kural
      // — iki yerde iki farklı ağaç yürüyüşü olamaz).
      let yol = p.itemPath;
      let ust: RegisterPart | undefined;
      while (yol.includes(".")) {
        yol = yol.slice(0, yol.lastIndexOf("."));
        ust = yolaGoreParca.get(yol);
        if (ust) break;
      }

      if (ust) {
        p.parentCode = ust.partCode;
        // Başlık YALNIZ BOŞSA yazılır: Excel'in kendi `Title` sütunu bir
        // beyandır, türetilmiş ad ise bir çıkarım — beyan ezilmez.
        if (!p.assemblyTitle) p.assemblyTitle = ust.description || ust.name || "";
        continue;
      }

      // ÜRÜN AĞACININ KÖKÜNDEKİ SATIN ALMA SATIRI PAKETİN KENDİ GRUBUNA AİT.
      // MTC'de altı satır böyle (Item 9…14: gruplari birbirine bağlayan
      // cıvata, somun, rondela ve kauçuk tampon) ve gerçekten bir alt montajın
      // altında değiller — paketin genel kompleşinin parçalarıdır.
      if (!yol.includes(".") && paketGrupKodu) p.parentCode = paketGrupKodu;
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

  // DOSYA DEPODA YOK — PAKET BAŞINA TEK BULGU.
  //
  // Kayıt satırı var, baytlar yok. Bu, modülün uzun süre GÖREMEDİĞİ tek
  // durumdu: sihirbaz yalnız başarılı yolları bildiriyor, sayaçlar denemeyi
  // sayıyor ve hiçbir ekran gerçeği sormuyordu. Artık `verifyStorage` bucket'ı
  // listeliyor ve cevabı buraya taşıyor.
  //
  // TEK BULGU, çünkü dosya başına yazılsaydı 162 satır ederdi — `ICERIK_OKUNMADI`
  // dersinde bunu zaten ölçtük: bir gürültü listesine dönen rapora kimse bakmaz.
  //
  // ATLANANLAR BURAYA GİRMEZ: yedek dosyaları ve bayt bayt kopyaları bilerek
  // yüklemiyoruz, onları "eksik" diye saymak yanlış alarmın ta kendisi olurdu.
  const depodaYok = snap.missingStorage ?? [];
  if (depodaYok.length > 0) {
    ekle({
      code: "DOSYA_DEPODA_YOK",
      kind: "eksik",
      subject: snap.folder?.code || snap.folderName,
      title:
        depodaYok.length === snap.files.length
          ? `${depodaYok.length} dosyanın hiçbiri depoya ulaşmamış. Kayıtlar var, baytlar yok.`
          : `${snap.files.length} dosyanın ${depodaYok.length} tanesi depoya ulaşmamış. Kayıtlar var, baytlar yok.`,
      detail:
        "“Eksikleri Yükle” ile aynı klasör seçilir ve yalnız ulaşmayan dosyalar gönderilir; " +
        "yeni bir paket açılmaz. Bu dosyalar açılamaz ve içerikleri okunamaz.",
      data: { ornekler: depodaYok.slice(0, 5), toplam: depodaYok.length },
    });
  }

  // İÇERİK OKUNMADI — PAKET BAŞINA TEK BULGU.
  //
  // Dosya başına yazılsaydı MONORAY 104, MTC 270 satır üretirdi; bugünkü toplam
  // "bilgi" sayısı 16 ve 31. Rapor bir gürültü listesine döner ve gerçek
  // bulgular görünmez olurdu. Sayı bir cümlede söylenir, satır satır değil.
  const icerikAdaylari = kullanilir.filter((f) => f.role === "resim" || f.role === "kesim");
  const okunmus = icerikAdaylari.filter((f) => snap.content?.[f.relPath]).length;
  if (icerikAdaylari.length > 0 && okunmus < icerikAdaylari.length) {
    // BAYTLAR YOKSA "SONRA OKUNABİLİR" DEMEK YALANDIR. Eski metin okumayı bir
    // zamanlama sorunu gibi anlatıyordu; oysa dosya depoda değilse okuma hiç
    // gerçekleşemez ve kullanıcı boşuna "Yeniden Oku" düğmesine basar.
    const depoEksigiVar = depodaYok.length > 0;
    ekle({
      code: "ICERIK_OKUNMADI",
      kind: "bilgi",
      subject: snap.folder?.code || snap.folderName,
      title:
        okunmus === 0
          ? `${icerikAdaylari.length} resim/kesim dosyasının içeriği henüz okunmadı.`
          : `${icerikAdaylari.length} dosyanın ${icerikAdaylari.length - okunmus} tanesinin içeriği okunmadı.`,
      detail: depoEksigiVar
        ? "Bunların bir bölümü depoya hiç ulaşmadığı için okunamaz da; önce eksik dosyalar tamamlanmalı."
        : "Antetteki ağırlık ve DXF'in gerçek kesim ölçüsü bu okumadan gelir. " +
          "“İçerikleri Yeniden Oku” ile alınabilir; defter onsuz da çalışır.",
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
