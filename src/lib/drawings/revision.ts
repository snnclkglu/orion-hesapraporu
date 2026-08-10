// Revizyon devri — dosyalar yenilenir, ATÖLYENİN KAYDI kaybolmaz.
//
// SAFTIR: DB, HTTP, dosya sistemi yok. Girdisi eski paketin üretim kayıtları +
// iki sürümün farkı, çıktısı kayıt başına TEK BİR KARAR.
//
// ————————————————————————————————————————————————— NEDEN BU DOSYA VAR
//
// Kaybolmama zaten tasarımdaydı: `drawing_part_progress` (item_no, part_code,
// stage) ile anahtarlanır — PAKETE DEĞİL PARÇAYA bağlıdır. Yeni bir revizyon
// eski kayıtları silmez. Eksik olan DEVRİN KENDİSİ, DENETİMİ ve DÜRÜSTLÜĞÜYDÜ.
//
// Üç sonuç var ve üçü de görünür:
//
//   ayni          Parça aynı → kayıt aynen devrolur, bağı yeni pakete taşınır.
//   gozdenGecir   Parça İMALATI ETKİLEYECEK biçimde değişti → kayıt devrolur
//                 ama işaretlenir. Sac büyüdüyse eskiden kesilen parça artık
//                 yanlıştır; "kesildi" demeyi sürdürmek atölyeye yalan
//                 söylemektir. SİLMEK de yanlıştır — belki hâlâ kullanılabilir,
//                 kararı insan verir.
//   karsiliksiz   Parça yeni revizyonda YOK → kayıt durur, listelenir. Sessizce
//                 yok edilmez: belki kod değişti, belki gerçekten iptal edildi.
//
// Hangi alanın "imalatı etkilediği" BURADA DEĞİL `diff.ts`teki
// `MANUFACTURING_DIFF_FIELDS`tedir — fark tanımıyla devir kararı tek listeden
// beslenmezse ikisi zamanla ayrışır ve işaret anlamını yitirir.

import {
  DIFF_FIELD_LABELS,
  MANUFACTURING_DIFF_FIELDS,
  partDiffKey,
  type DiffField,
  type DiffPart,
  type PackageDiff,
  type PartFieldChange,
} from "./diff";
import { PURCHASE_PREFIX } from "./progress";
import { trKatla } from "./tr-text";

export const CARRY_OUTCOMES = ["ayni", "gozdenGecir", "karsiliksiz"] as const;
export type CarryOutcome = (typeof CARRY_OUTCOMES)[number];

export const CARRY_OUTCOME_LABELS: Record<CarryOutcome, string> = {
  ayni: "Taşındı",
  gozdenGecir: "Gözden geçirilmeli",
  karsiliksiz: "Karşılıksız",
};

/** Bir üretim kaydının devir için gereken en az bilgisi. */
export interface ProgressRef {
  /** `drawing_part_progress.id` — devri yazan taraf satırı bununla bulur */
  id: string;
  itemNo: string;
  /** Kodlu parçada kod, kodsuzda `SATINALMA:<katlanmış tanım>` */
  partCode: string;
  stage: string;
}

export interface CarryDecision {
  progress: ProgressRef;
  outcome: CarryOutcome;
  /** İşaretlenmişse NEDEN — tek Türkçe cümle, kaydın kendisine yazılır */
  reason: string;
  /** İmalatı etkileyen değişen alanlar (yalnız `gozdenGecir`de dolu) */
  changedFields: DiffField[];
}

export interface CarrySummary {
  tasinan: number;
  gozdenGecir: number;
  karsiliksiz: number;
  toplam: number;
}

/**
 * Devir kararları.
 *
 * `diff` YENİ paketin ESKİ pakete göre farkıdır (`packageDiff(eski, yeni)`).
 * Karar YALNIZ parça kodundan verilir: üretim kaydının anahtarı da odur ve
 * `partDiffKey` kodu olan parçada zaten `KOD:<katlanmış>` üretir. Kodsuz
 * (satın alma) kalemleri `SATINALMA:` önekiyle taşınır ve fark tarafında
 * `TANIM:` anahtarına düşer; ikisi aynı katlanmış tanımdan kurulduğu için
 * eşleşirler.
 */
export function carryDecisions(
  marks: ProgressRef[],
  diff: PackageDiff,
  /**
   * YENİ paketin defterindeki parçalar.
   *
   * FARKTAN TÜRETİLEMEZ ve denemek bir hataydı: DEĞİŞMEYEN parça farkın
   * hiçbir listesinde durmaz, dolayısıyla "silinenlerde yoksa yeni tarafta
   * vardır" varsayımı aynı anahtardan ÇOK SATIR olduğunda çöker. Kodsuz
   * (satın alma) satırlarda çokluk KURALDIR — MTC'de aynı somun dört ayrı
   * montajda geçiyor. Dördünden biri düşse `coklukEsle` onu "silinen"e atar,
   * kalan üçü hiçbir listede görünmez ve hâlâ defterde duran bir parça
   * "karşılıksız" ilan edilirdi. Yeni tarafın kendisini sormak bu sınıfın
   * tamamını kapatır.
   */
  newParts: readonly DiffPart[]
): CarryDecision[] {
  const yeniAnahtarlar = new Set(newParts.map((p) => partDiffKey(p)));

  // Anahtar → imalatı etkileyen değişiklikler.
  const degisenler = new Map<string, PartFieldChange[]>();
  for (const d of diff.degisenParcalar) {
    const etkileyen = d.changes.filter((c) => MANUFACTURING_DIFF_FIELDS.includes(c.field));
    if (etkileyen.length) degisenler.set(partDiffKey(d.eski), etkileyen);
  }

  return marks.map((m) => {
    const anahtar = markAnahtari(m);

    const etkileyen = degisenler.get(anahtar);
    if (etkileyen?.length) {
      return {
        progress: m,
        outcome: "gozdenGecir" as const,
        reason: degisiklikCumlesi(etkileyen),
        changedFields: etkileyen.map((c) => c.field),
      };
    }

    if (!yeniAnahtarlar.has(anahtar)) {
      return {
        progress: m,
        outcome: "karsiliksiz" as const,
        reason: "Bu parça yeni revizyonun defterinde yok.",
        changedFields: [],
      };
    }

    return { progress: m, outcome: "ayni" as const, reason: "", changedFields: [] };
  });
}

export function carrySummary(kararlar: CarryDecision[]): CarrySummary {
  const ozet: CarrySummary = { tasinan: 0, gozdenGecir: 0, karsiliksiz: 0, toplam: kararlar.length };
  for (const k of kararlar) {
    if (k.outcome === "gozdenGecir") ozet.gozdenGecir++;
    else if (k.outcome === "karsiliksiz") ozet.karsiliksiz++;
    else ozet.tasinan++;
  }
  return ozet;
}

/**
 * Kullanıcıya gösterilen TEK CÜMLELİK özet.
 *
 * Devir sessiz olmaz: atölyenin kaydına dokunan bir işlem, sonucunu bir
 * cümleyle söylemek zorundadır.
 */
export function carrySummaryText(o: CarrySummary, revNo: number): string {
  if (o.toplam === 0) return "Taşınacak üretim kaydı yoktu.";
  const parcalar = [
    `${o.tasinan + o.gozdenGecir} üretim kaydı R${iki(revNo)}'${yonelmeEki(revNo)} taşındı`,
  ];
  if (o.gozdenGecir > 0) parcalar.push(`${o.gozdenGecir}'i gözden geçirilmeli`);
  if (o.karsiliksiz > 0) parcalar.push(`${o.karsiliksiz}'i karşılıksız kaldı`);
  return `${parcalar.join(" · ")}.`;
}

/** "R02" — belge kodundaki revizyon yazımıyla aynı. */
export function iki(n: number): string {
  return String(Math.max(0, Math.trunc(n))).padStart(2, "0");
}

/**
 * Sayıya gelen YÖNELME EKİ — "R02'ye" ama "R03'e".
 *
 * Ek rakamın kendisine değil OKUNUŞUNA bağlıdır: 2 "iki"dir ve ünlüyle bittiği
 * için kaynaştırma harfi alır, 3 "üç"tür ve almaz. Uygulamanın tamamı Türkçe
 * olduğu için bunu "her zaman 'ye" diye geçiştirmek, atölyenin okuyacağı her
 * devir cümlesinde bir yazım hatası bırakırdı.
 *
 * Belirleyici SON OKUNAN SÖZCÜKTÜR: 42 "kırk iki"dir, eki "iki"den alır.
 */
const YONELME: Record<number, string> = {
  0: "a", // sıfır
  1: "e", // bir
  2: "ye", // iki
  3: "e", // üç
  4: "e", // dört
  5: "e", // beş
  6: "ya", // altı
  7: "ye", // yedi
  8: "e", // sekiz
  9: "a", // dokuz
  10: "a", // on
  20: "ye", // yirmi
  30: "a", // otuz
  40: "a", // kırk
  50: "ye", // elli
  60: "a", // altmış
  70: "e", // yetmiş
  80: "e", // seksen
  90: "a", // doksan
};

export function yonelmeEki(n: number): string {
  const sayi = Math.max(0, Math.trunc(n));
  const birler = sayi % 10;
  // Son okunan sözcük: birler basamağı sıfır değilse odur, sıfırsa onlar.
  if (sayi < 10) return YONELME[sayi] ?? "e";
  if (birler !== 0) return YONELME[birler] ?? "e";
  const onlar = sayi % 100;
  return YONELME[onlar] ?? "e";
}

/**
 * Üretim kaydının fark anahtarı.
 *
 * `progress.ts` satın alma kalemlerini `SATINALMA:<katlanmış tanım>` olarak
 * anahtarlar; farkta aynı kalem `TANIM:<katlanmış tanım>` olur. Önek oradan
 * İÇE AKTARILIR, burada ikinci bir kopyası yazılmaz: iki dosyada iki dizgi
 * dursaydı biri değiştiğinde devir sessizce hiçbir satın alma kalemini
 * eşleştiremez olurdu.
 */
function markAnahtari(m: ProgressRef): string {
  if (m.partCode.startsWith(PURCHASE_PREFIX)) {
    return `TANIM:${m.partCode.slice(PURCHASE_PREFIX.length)}`;
  }
  return `KOD:${trKatla(m.partCode)}`;
}

/** "Adet 2 → 4 · Kalınlık 8 → 10" */
function degisiklikCumlesi(changes: PartFieldChange[]): string {
  return changes
    .map((c) => `${DIFF_FIELD_LABELS[c.field]} ${c.eski || "—"} → ${c.yeni || "—"}`)
    .join(" · ");
}
