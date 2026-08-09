// Paket farkı — aynı (kalem, grup) ikinci kez yüklendiğinde NE DEĞİŞTİ.
//
// SAFTIR: DB, HTTP, dosya sistemi yok. İki tarafın dosya listesi ve parça
// defteri verilir, fark döner. Sürümler ekranı bunu canlı hesaplar; kural
// geliştikçe eski paketlerin farkı da düzelir (RECONCILER_VERSION'ın öğrettiği
// ders: türetilmiş özeti saklamak, kural değişince yalan söylemektir).
//
// ————————————————————————————————————————————————— NEDEN `register_key` DEĞİL
//
// Şemadaki `register_key` kodsuz satırlarda KONUMSALDIR: `'SATIR:' || bom_seq`.
// MONORAY'ın ikinci teslimine iki satın alma kalemi eklenmiş ve o günden sonraki
// bütün `SATIR:n` anahtarları bir kaymış. Konumsal anahtarla ölçtük: 46 "değişen
// parça" çıkıyor ve bunun 40'ı SAHTE — aynı cıvata bir sonraki satır numarasına
// oturduğu için "tanımı değişmiş" görünüyor.
//
// Bu yüzden anahtar İÇERİKTEN kurulur: kodu olanda PARÇA KODU, olmayanda
// katlanmış TANIM. Aynı veride sonuç 48 eşleşen / 2 yeni / 0 silinen / 7 gerçek
// değişen — yani gerçeğin kendisi.
//
// MALZEME ANAHTARA GİRMEZ ve bu da ölçülmüştür: `tanım + malzeme` imzasıyla
// MONORAY 20 yeni + 18 silinen veriyor (gerçek: 2 yeni, 0 silinen). Sebep
// dairesel — rapor etmek istediğimiz alanın kendisi (`PUL RONDELA M8 DIN125`
// malzemesi "FST" → "") kimliği bozuyor ve DEĞİŞEN bir parçayı sil+ekle çiftine
// dönüştürüyor. Kimlik yalnız tanımdan kurulur.
//
// ————————————————————————————————————————————— NEDEN ALTI ALAN, DAHA ÇOĞU DEĞİL
//
// `item_path` ve `assembly_title` BİLİNÇLİ OLARAK dışarıdadır. MTC'de tek bir
// montaj eklemesi 124 `item_path` ve 74 başlık kaydırıyor; bunu parça başına
// basmak raporu okunmaz yapar ve okunmayan rapor güvenini kaybeder. Yanlış
// alarm bu modülün en büyük düşmanıdır.

import { parseBomFileName } from "./file-name";
import { trKatla } from "./tr-text";
import type { FileLifecycle, FileRole } from "./types";

/** Karşılaştırılan alanlar — TEK DOĞRULUK KAYNAĞI. */
export const DIFF_FIELDS = [
  "adet",
  "malzeme",
  "agirlik",
  "kalinlik",
  "kategori",
  "tanim",
] as const;
export type DiffField = (typeof DIFF_FIELDS)[number];

/**
 * Alan etiketleri çekirdekte durur (`types.ts`teki `FILE_ROLE_LABELS` ile aynı
 * gerekçe): alan listesi ile etiketleri ayrı dosyalarda tutmak, yeni bir alan
 * eklendiğinde etiketin unutulmasına ve arayüzde ham anahtarın görünmesine yol
 * açar.
 */
export const DIFF_FIELD_LABELS: Record<DiffField, string> = {
  adet: "Adet",
  malzeme: "Malzeme",
  agirlik: "Ağırlık",
  kalinlik: "Kalınlık",
  kategori: "Kategori",
  tanim: "Tanım",
};

/**
 * Sayısal alanların ÖLÇEĞİ.
 *
 * `numeric` sütunlar supabase-js'ten METİN olarak dönebilir: "1498.4570" ile
 * 1498.457 aynı ağırlıktır ama `String(a) !== String(b)` onları farklı sayar.
 * Gerçek veride ağırlık 119 satırda değişiyor; buraya yuvarlama gürültüsü
 * karışırsa gerçek değişiklik ayırt edilemez.
 */
const OLCEK: Partial<Record<DiffField, number>> = {
  adet: 0,
  kalinlik: 2,
  agirlik: 3,
};

/** Sayısal alanlar — arayüz bunları kendi biçimleyicisiyle basar. */
export function isNumericDiffField(field: DiffField): boolean {
  return OLCEK[field] !== undefined;
}

/** Veritabanından metin de gelebilen sayısal alan. */
export type Sayisal = number | string | null | undefined;

export interface DiffFile {
  relPath: string;
  checksum: string;
  size: number;
  role: FileRole;
  lifecycle: FileLifecycle;
}

export interface DiffPart {
  registerKey: string;
  partCode: string;
  description: string;
  qty: Sayisal;
  material: string;
  weightKg: Sayisal;
  thicknessMm: Sayisal;
  category: string;
}

export interface PackageSide {
  files: DiffFile[];
  parts: DiffPart[];
}

export interface ChangedFile {
  eski: DiffFile;
  yeni: DiffFile;
  /** `yol` — aynı göreli yol · `belge` — aynı BOM belgesi, adı değişmiş */
  matchedBy: "yol" | "belge";
  /** İmza değişti mi? (adı değişip içeriği aynı kalmış olabilir) */
  contentChanged: boolean;
  /** Adı/yolu değişti mi? */
  renamed: boolean;
  /** yeni.size − eski.size — "içerik değişti" ile "6 KB büyüdü" ayrı bilgilerdir */
  sizeDelta: number;
}

export interface PartFieldChange {
  field: DiffField;
  /** Gösterime hazır metin; sayısal alanlarda ondalık ayracı NOKTADIR */
  eski: string;
  yeni: string;
  /** Sayısal alanlarda yuvarlanmış değer; metin alanlarında null */
  eskiNum: number | null;
  yeniNum: number | null;
}

export interface ChangedPart {
  /** Eşleşme anahtarı — `KOD:…` · `TANIM:…` · `SIRA:…` */
  key: string;
  eski: DiffPart;
  yeni: DiffPart;
  changes: PartFieldChange[];
}

export interface DiffSummary {
  yeniDosya: number;
  silinenDosya: number;
  degisenDosya: number;
  yeniParca: number;
  silinenParca: number;
  degisenParca: number;
  /** Hangi alan kaç parçada değişti — özet satırının anlamı budur */
  alanSayaci: Record<DiffField, number>;
  /** Hiçbir fark yok mu? */
  bos: boolean;
}

export interface PackageDiff {
  yeniDosyalar: DiffFile[];
  silinenDosyalar: DiffFile[];
  degisenDosyalar: ChangedFile[];
  yeniParcalar: DiffPart[];
  silinenParcalar: DiffPart[];
  degisenParcalar: ChangedPart[];
  ozet: DiffSummary;
}

export interface DiffOptions {
  /**
   * BOM Excel'lerini yol yerine (kod, tür) çiftiyle eşle. Varsayılan AÇIK.
   *
   * `1.0057-00-0500_DEPO_02.07.2026.xlsx` ile
   * `2.0057-00-0500_DEPO_31.07.2026.xlsx` aynı belgenin iki sürümüdür; düz yol
   * karşılaştırması onu 1 silinen + 1 yeni sayar ve sürüm farkı KAYBOLUR.
   */
  bomBelgeEslemesi?: boolean;
  /**
   * Parça anahtarı. `registerKey` YALNIZ regresyon testi içindir — konumsal
   * olduğu için gerçek veride onlarca sahte değişiklik üretir.
   */
  partKey?: "akilli" | "registerKey";
}

// ————————————————————————————————————————————————————————————— yardımcılar

/** Metin ya da sayı gelen alanı sayıya çevirir; çevrilemezse null. */
function sayi(value: Sayisal): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

function yuvarla(n: number, basamak: number): number {
  const k = 10 ** basamak;
  return Math.round(n * k) / k;
}

/** Sayısal alanın gösterim metni — yuvarlanmış, gereksiz sıfırsız. */
function sayiMetni(n: number | null): string {
  return n == null ? "" : String(n);
}

function metin(value: string | null | undefined): string {
  return (value ?? "").trim();
}

/**
 * Parçanın kimlik anahtarı.
 *
 * Kodsuz parçanın TANIMI değişirse anahtar da değişir ve tek bir "değişen"
 * yerine 1 silinen + 1 yeni çıkar. Bu BİLİNÇLİ bir sapmadır: alternatifi
 * bulanık eşleşmedir ve o, iki farklı DIN kalemini birbirine bağlayarak satın
 * alma listesini bozar. Yanlış eşleşme, eşleşmemekten pahalıdır.
 */
export function partDiffKey(part: DiffPart, mode: "akilli" | "registerKey" = "akilli"): string {
  if (mode === "registerKey") return `KEY:${part.registerKey}`;
  const kod = metin(part.partCode);
  if (kod) return `KOD:${trKatla(kod)}`;
  const tanim = metin(part.description);
  if (tanim) return `TANIM:${trKatla(tanim)}`;
  return `SIRA:${part.registerKey}`;
}

/**
 * Aynı anahtardan birden çok satır varsa SIRA SIRA çiftlenir.
 *
 * Tekillik kısıtı `drawing_parts`ta var ama fark çekirdeği kısıta güvenmez:
 * anahtar burada içerikten kuruluyor ve iki farklı kodsuz satır aynı tanımı
 * taşıyabilir. Çokluyu düşürmek sessiz veri kaybı olurdu.
 */
function coklukEsle<T>(
  eski: T[],
  yeni: T[],
  anahtar: (x: T) => string
): { ciftler: [T, T][]; yalnizEski: T[]; yalnizYeni: T[] } {
  const eskiKume = new Map<string, T[]>();
  for (const x of eski) {
    const k = anahtar(x);
    const liste = eskiKume.get(k);
    if (liste) liste.push(x);
    else eskiKume.set(k, [x]);
  }

  const ciftler: [T, T][] = [];
  const yalnizYeni: T[] = [];
  for (const y of yeni) {
    const liste = eskiKume.get(anahtar(y));
    const e = liste?.shift();
    if (e) ciftler.push([e, y]);
    else yalnizYeni.push(y);
  }

  const yalnizEski: T[] = [];
  for (const liste of eskiKume.values()) yalnizEski.push(...liste);

  return { ciftler, yalnizEski, yalnizYeni };
}

/**
 * BOM Excel'inin BELGE kimliği: `<kod>|<tür>`.
 *
 * Yeni bir ayrıştırıcı YAZILMAZ — `parseBomFileName` zaten kodu, türü, tarihi
 * ve ressamın elle tuttuğu sürüm önekini veriyor.
 */
function belgeAnahtari(f: DiffFile): string {
  if (f.role !== "bom") return "";
  const ad = f.relPath.split("/").pop() ?? f.relPath;
  const b = parseBomFileName(ad);
  if (!b.code) return "";
  const klasor = f.relPath.slice(0, f.relPath.length - ad.length);
  // KAPSAM anahtara girer: MTC'de aynı kod iki ayrı alt klasörde geçebilir ve
  // farklı belgelerdir. Klasör atlanırsa fark yanlış çifti eşler.
  return `${klasor}|${b.code}|${b.kind}`;
}

function alanFarki(eski: DiffPart, yeni: DiffPart): PartFieldChange[] {
  const cikti: PartFieldChange[] = [];

  const sayisalFark = (field: DiffField, a: Sayisal, b: Sayisal) => {
    const basamak = OLCEK[field] ?? 0;
    const ham1 = sayi(a);
    const ham2 = sayi(b);
    const n1 = ham1 == null ? null : yuvarla(ham1, basamak);
    const n2 = ham2 == null ? null : yuvarla(ham2, basamak);
    if (n1 === n2) return;
    cikti.push({
      field,
      eski: sayiMetni(n1),
      yeni: sayiMetni(n2),
      eskiNum: n1,
      yeniNum: n2,
    });
  };

  const metinFarki = (field: DiffField, a: string, b: string) => {
    const m1 = metin(a);
    const m2 = metin(b);
    // Eşleştirme KATLAMAYLA yapılır: `LIMIT…` ile `LİMİT…` aynı metindir ve
    // yazımın düzelmesi bir değişiklik değildir.
    if (trKatla(m1) === trKatla(m2)) return;
    cikti.push({ field, eski: m1, yeni: m2, eskiNum: null, yeniNum: null });
  };

  sayisalFark("adet", eski.qty, yeni.qty);
  metinFarki("malzeme", eski.material, yeni.material);
  sayisalFark("agirlik", eski.weightKg, yeni.weightKg);
  sayisalFark("kalinlik", eski.thicknessMm, yeni.thicknessMm);
  metinFarki("kategori", eski.category, yeni.category);
  metinFarki("tanim", eski.description, yeni.description);

  // Çıktı `DIFF_FIELDS` sırasındadır: arayüz sıralamayı kendi kurmasın.
  const sira = new Map(DIFF_FIELDS.map((f, i) => [f, i]));
  return cikti.sort((a, b) => (sira.get(a.field) ?? 0) - (sira.get(b.field) ?? 0));
}

// ——————————————————————————————————————————————————————————————— çekirdek

/**
 * İki paket sürümünü karşılaştırır.
 *
 * `haric` dosyalar farka HİÇ GİRMEZ: AutoCAD'in `.bak` yedeği her kaydetmede
 * değişir ve onu "paket değişti" saymak fark raporunu gürültüye boğardı
 * (MTC'de 10 `.bak`, MONORAY'da 2 `_Sheet`).
 */
export function packageDiff(
  eski: PackageSide,
  yeni: PackageSide,
  options: DiffOptions = {}
): PackageDiff {
  const bomEsle = options.bomBelgeEslemesi !== false;
  const anahtarKipi = options.partKey ?? "akilli";

  // ——————————————————————————————————————————————————————— 1. Dosya farkı
  const eskiDosyalar = eski.files.filter((f) => f.lifecycle !== "haric");
  const yeniDosyalar = yeni.files.filter((f) => f.lifecycle !== "haric");

  const degisenDosyalar: ChangedFile[] = [];
  const eskiKalan: DiffFile[] = [];
  const yeniKalan: DiffFile[] = [];

  {
    const yol = coklukEsle(eskiDosyalar, yeniDosyalar, (f) => f.relPath);
    for (const [e, y] of yol.ciftler) {
      const icerikDegisti = e.checksum !== y.checksum;
      if (!icerikDegisti && e.size === y.size) continue;
      degisenDosyalar.push({
        eski: e,
        yeni: y,
        matchedBy: "yol",
        contentChanged: icerikDegisti,
        renamed: false,
        sizeDelta: y.size - e.size,
      });
    }
    eskiKalan.push(...yol.yalnizEski);
    yeniKalan.push(...yol.yalnizYeni);
  }

  let silinenDosyalar = eskiKalan;
  let eklenenDosyalar = yeniKalan;

  if (bomEsle) {
    // Kural YALNIZ iki tarafta da TEK aday varken uygulanır. İki aday varsa
    // hangisinin hangisine dönüştüğü BİLİNMEZ ve yanlış çift kurmak,
    // eşleştirmemekten pahalıdır.
    const say = (liste: DiffFile[]) => {
      const m = new Map<string, DiffFile[]>();
      for (const f of liste) {
        const k = belgeAnahtari(f);
        if (!k) continue;
        const g = m.get(k);
        if (g) g.push(f);
        else m.set(k, [f]);
      }
      return m;
    };
    const eskiBelge = say(silinenDosyalar);
    const yeniBelge = say(eklenenDosyalar);
    const eslesenEski = new Set<DiffFile>();
    const eslesenYeni = new Set<DiffFile>();

    for (const [k, eskiAdaylar] of eskiBelge) {
      const yeniAdaylar = yeniBelge.get(k);
      if (!yeniAdaylar || eskiAdaylar.length !== 1 || yeniAdaylar.length !== 1) continue;
      const e = eskiAdaylar[0];
      const y = yeniAdaylar[0];
      eslesenEski.add(e);
      eslesenYeni.add(y);
      degisenDosyalar.push({
        eski: e,
        yeni: y,
        matchedBy: "belge",
        contentChanged: e.checksum !== y.checksum,
        renamed: e.relPath !== y.relPath,
        sizeDelta: y.size - e.size,
      });
    }

    silinenDosyalar = silinenDosyalar.filter((f) => !eslesenEski.has(f));
    eklenenDosyalar = eklenenDosyalar.filter((f) => !eslesenYeni.has(f));
  }

  degisenDosyalar.sort((a, b) => a.yeni.relPath.localeCompare(b.yeni.relPath, "tr"));
  silinenDosyalar = [...silinenDosyalar].sort((a, b) =>
    a.relPath.localeCompare(b.relPath, "tr")
  );
  eklenenDosyalar = [...eklenenDosyalar].sort((a, b) =>
    a.relPath.localeCompare(b.relPath, "tr")
  );

  // ——————————————————————————————————————————————————————— 2. Parça farkı
  const parcaEslesme = coklukEsle(eski.parts, yeni.parts, (p) =>
    partDiffKey(p, anahtarKipi)
  );

  const degisenParcalar: ChangedPart[] = [];
  for (const [e, y] of parcaEslesme.ciftler) {
    const changes = alanFarki(e, y);
    if (!changes.length) continue;
    degisenParcalar.push({ key: partDiffKey(y, anahtarKipi), eski: e, yeni: y, changes });
  }

  const parcaSirasi = (p: DiffPart) =>
    `${p.partCode ? "0" : "1"}${p.partCode || metin(p.description)}`;
  const yeniParcalar = [...parcaEslesme.yalnizYeni].sort((a, b) =>
    parcaSirasi(a).localeCompare(parcaSirasi(b), "tr")
  );
  const silinenParcalar = [...parcaEslesme.yalnizEski].sort((a, b) =>
    parcaSirasi(a).localeCompare(parcaSirasi(b), "tr")
  );
  degisenParcalar.sort((a, b) =>
    parcaSirasi(a.yeni).localeCompare(parcaSirasi(b.yeni), "tr")
  );

  // ————————————————————————————————————————————————————————————— 3. Özet
  const alanSayaci = Object.fromEntries(DIFF_FIELDS.map((f) => [f, 0])) as Record<
    DiffField,
    number
  >;
  for (const d of degisenParcalar) {
    for (const c of d.changes) alanSayaci[c.field] += 1;
  }

  const ozet: DiffSummary = {
    yeniDosya: eklenenDosyalar.length,
    silinenDosya: silinenDosyalar.length,
    degisenDosya: degisenDosyalar.length,
    yeniParca: yeniParcalar.length,
    silinenParca: silinenParcalar.length,
    degisenParca: degisenParcalar.length,
    alanSayaci,
    bos: false,
  };
  ozet.bos =
    ozet.yeniDosya + ozet.silinenDosya + ozet.degisenDosya + ozet.yeniParca +
      ozet.silinenParca + ozet.degisenParca ===
    0;

  return {
    yeniDosyalar: eklenenDosyalar,
    silinenDosyalar,
    degisenDosyalar,
    yeniParcalar,
    silinenParcalar,
    degisenParcalar,
    ozet,
  };
}

/**
 * Özetin tek satırlık metni: "+12 dosya · −3 dosya · 5 parça değişti".
 *
 * Arayüzde DEĞİL burada üretilir: aynı cümle sürüm listesinde, paket künyesinde
 * ve ileride bildirimde kullanılacak; üç yerde ayrı yazılsa üçü ayrışır. Eksi
 * işareti gerçek eksi (U+2212) — kısa çizgi rakamların yanında tire gibi okunur.
 */
export function diffOzetMetni(ozet: DiffSummary): string {
  if (ozet.bos) return "Fark yok";
  const parcalar: string[] = [];
  if (ozet.yeniDosya) parcalar.push(`+${ozet.yeniDosya} dosya`);
  if (ozet.silinenDosya) parcalar.push(`−${ozet.silinenDosya} dosya`);
  if (ozet.degisenDosya) parcalar.push(`${ozet.degisenDosya} dosya değişti`);
  if (ozet.yeniParca) parcalar.push(`+${ozet.yeniParca} parça`);
  if (ozet.silinenParca) parcalar.push(`−${ozet.silinenParca} parça`);
  if (ozet.degisenParca) parcalar.push(`${ozet.degisenParca} parça değişti`);
  return parcalar.join(" · ");
}
