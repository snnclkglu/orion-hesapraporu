// BORDRO ÇEKİRDEĞİ — SAF. Yasal brüt↔net dönüşümü, kümülatif gelir vergisi
// matrahı ve asgari ücret istisnası.
//
// ═══════════════════════════════════════════════ FİRMA NETTEN ANLAŞIYOR
// Kayıtlarda NET maaş var (devralınan Excel de öyleydi). Bordro ise BRÜTten
// başlar: brüt → kesintiler → net. Yani brüt TÜRETİLMEK zorundadır ve bu
// düz bir çarpma değildir — gelir vergisi kümülatif matraha bağlı, matrah
// brüte bağlı, brüt de nete. Denklem kapalı biçimde çözülemez; `brutBul`
// ikili arama ile çözer (kuruş hassasiyetinde, ~40 adım).
//
// ═══════════════════════════════════════ PARAMETRELER KODA GÖMÜLMEZ
// Asgari ücret, SGK tavanı, dilimler ve istisnalar her yıl (bazen yılda iki
// kez) değişir. `hr_payroll_params` tablosundan gelir ve bordro satırı hangi
// parametre kümesiyle hesaplandığını SAKLAR (`params_valid_from`): geçmiş bir
// bordro yeniden basıldığında aynı sayıyı vermelidir.
//
// PARAMETRE YOKSA HESAP YAPILMAZ. Uydurulmuş bir orana düşmek, bordroyu
// olduğundan resmî gösterirdi; çekirdek `null` döner ve belge yalnız
// saklananı basar.

/** Gelir vergisi dilimi: `ust`u geçmeyen matraha `oran` uygulanır. */
export interface TaxBracket {
  /** Dilimin üst sınırı (kümülatif matrah); son dilimde `null`. */
  ust: number | null;
  oran: number;
}

export interface PayrollParams {
  validFrom: string;
  label: string;
  /** Aylık brüt asgari ücret — istisnaların dayanağı. */
  minWageGross: number;
  /** SGK primine esas kazanç ÜST sınırı (brüt asgarinin 9 katı). */
  sgkCeiling: number;
  sgkEmployeeRate: number;
  unemploymentEmployeeRate: number;
  sgkEmployerRate: number;
  unemploymentEmployerRate: number;
  stampTaxRate: number;
  brackets: TaxBracket[];
  /** Asgari ücrete isabet eden GELİR VERGİSİ — çalışandan kesilmez. */
  incomeTaxExemption: number;
  /** Asgari ücrete isabet eden DAMGA VERGİSİ — çalışandan kesilmez. */
  stampTaxExemption: number;
  source: string;
  verified: boolean;
}

/** Bir ayın tam yasal dökümü. Bütün tutarlar TL. */
export interface BordroBreakdown {
  /** Aylık brüt ücret (netten türetilmiştir). */
  gross: number;
  /** SGK primine esas kazanç — tavanla kelepçeli. */
  sgkBase: number;
  sgkEmployee: number;
  unemploymentEmployee: number;
  /** Gelir vergisi matrahı = brüt − (SGK + işsizlik) işçi payları. */
  incomeTaxBase: number;
  /** Dilim uygulanmış HAM gelir vergisi (istisna düşülmeden). */
  incomeTaxGross: number;
  /** Asgari ücret gelir vergisi istisnası (kesilmeyen kısım). */
  incomeTaxExemption: number;
  /** Fiilen kesilen gelir vergisi. */
  incomeTax: number;
  stampTaxGross: number;
  stampTaxExemption: number;
  stampTax: number;
  /** İşçiden yapılan bütün kesintiler. */
  totalDeductions: number;
  /** Ele geçen. */
  net: number;
  /** Yılbaşından bu dönem DÂHİL biriken gelir vergisi matrahı. */
  cumulativeTaxBase: number;
  /** Bu dönemde uygulanan en yüksek dilim oranı — bordroda gösterilir. */
  appliedRate: number;
  // ——— İŞVEREN MALİYETİ: netten düşülmez, bilgi olarak basılır.
  sgkEmployer: number;
  unemploymentEmployer: number;
  /** Brüt + işveren payları = firmanın o kişiye o ayki toplam maliyeti. */
  employerCost: number;
}

const KURUS = 0.005;

function yuvarla(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Kümülatif matraha göre dilimli gelir vergisi.
 *
 * DİLİM YILBAŞINDAN BERİ BİRİKEN MATRAHA GÖRE YÜKSELİR: aynı maaş ocakta
 * %15, kasımda %27 vergilenebilir. Bu yüzden hesap "bu ayın matrahı" değil
 * "[önceki kümülatif, önceki + bu ay]" ARALIĞI üzerinden yapılır.
 */
export function dilimliVergi(
  oncekiKumulatif: number,
  matrah: number,
  brackets: readonly TaxBracket[]
): { vergi: number; uygulananOran: number } {
  if (!(matrah > 0)) return { vergi: 0, uygulananOran: brackets[0]?.oran ?? 0 };
  let kalan = matrah;
  let alt = Math.max(0, oncekiKumulatif);
  let vergi = 0;
  let uygulananOran = brackets[0]?.oran ?? 0;
  for (const b of brackets) {
    if (kalan <= 0) break;
    const tavan = b.ust ?? Infinity;
    if (alt >= tavan) continue;
    const dilimde = Math.min(kalan, tavan - alt);
    if (dilimde > 0) {
      vergi += dilimde * b.oran;
      uygulananOran = b.oran;
      kalan -= dilimde;
      alt += dilimde;
    }
  }
  return { vergi: yuvarla(vergi), uygulananOran };
}

/**
 * BRÜTten NETe — bordronun asıl yönü.
 *
 * `oncekiKumulatif` yılbaşından bu döneme KADARKİ (bu dönem hariç) matrahtır.
 */
export function brutten(
  gross: number,
  oncekiKumulatif: number,
  p: PayrollParams
): BordroBreakdown {
  const brut = Math.max(0, gross);
  // SGK TAVANI: tavanı aşan kazançtan prim alınmaz. Kelepçe yazılmasaydı
  // yüksek maaşlarda kesinti olduğundan büyük çıkar ve net eksik görünürdü.
  const sgkBase = Math.min(brut, p.sgkCeiling);
  const sgkEmployee = yuvarla(sgkBase * p.sgkEmployeeRate);
  const unemploymentEmployee = yuvarla(sgkBase * p.unemploymentEmployeeRate);

  const incomeTaxBase = yuvarla(brut - sgkEmployee - unemploymentEmployee);
  const { vergi: incomeTaxGross, uygulananOran } = dilimliVergi(
    oncekiKumulatif,
    incomeTaxBase,
    p.brackets
  );
  // İSTİSNA VERGİDEN DÜŞÜLÜR, MATRAHTAN DEĞİL: 7349 sayılı kanun asgari
  // ücrete isabet eden vergiyi çalışandan almaz. Hesaplanan vergi istisnadan
  // küçükse tamamı düşer (eksi vergi diye bir şey yoktur).
  const incomeTaxExemption = Math.min(incomeTaxGross, p.incomeTaxExemption);
  const incomeTax = yuvarla(incomeTaxGross - incomeTaxExemption);

  const stampTaxGross = yuvarla(brut * p.stampTaxRate);
  const stampTaxExemption = Math.min(stampTaxGross, p.stampTaxExemption);
  const stampTax = yuvarla(stampTaxGross - stampTaxExemption);

  const totalDeductions = yuvarla(
    sgkEmployee + unemploymentEmployee + incomeTax + stampTax
  );
  const sgkEmployer = yuvarla(sgkBase * p.sgkEmployerRate);
  const unemploymentEmployer = yuvarla(sgkBase * p.unemploymentEmployerRate);

  return {
    gross: yuvarla(brut),
    sgkBase: yuvarla(sgkBase),
    sgkEmployee,
    unemploymentEmployee,
    incomeTaxBase,
    incomeTaxGross,
    incomeTaxExemption: yuvarla(incomeTaxExemption),
    incomeTax,
    stampTaxGross,
    stampTaxExemption: yuvarla(stampTaxExemption),
    stampTax,
    totalDeductions,
    net: yuvarla(brut - totalDeductions),
    cumulativeTaxBase: yuvarla(oncekiKumulatif + incomeTaxBase),
    appliedRate: uygulananOran,
    sgkEmployer,
    unemploymentEmployer,
    employerCost: yuvarla(brut + sgkEmployer + unemploymentEmployer),
  };
}

/**
 * NETten BRÜTe — "brütleştirme".
 *
 * Kapalı çözüm yoktur (vergi dilimi brüte, brüt de nete bağlı). İKİLİ ARAMA
 * kullanılır: net brüte göre KESİN ARTANDIR, yani arama daima yakınsar.
 * Newton yöntemi dilim sınırında türevi sıçradığı için burada güvenilir değil.
 *
 * Üst sınır net'in 3 katıdır: en yüksek dilimde bile (%40 + %15 SGK/işsizlik)
 * brüt netin ~2,2 katını geçmez; 3 kat rahat bir tavandır.
 */
export function brutBul(
  net: number,
  oncekiKumulatif: number,
  p: PayrollParams
): BordroBreakdown {
  const hedef = Math.max(0, net);
  if (hedef === 0) return brutten(0, oncekiKumulatif, p);

  let alt = hedef;
  let ust = hedef * 3 + p.minWageGross;
  // 60 adım: aralık her turda yarılanır, 3 kat netten kuruşa inmek için
  // fazlasıyla yeter ve sonsuz döngü ihtimalini kapatır.
  for (let i = 0; i < 60; i++) {
    const orta = (alt + ust) / 2;
    const s = brutten(orta, oncekiKumulatif, p);
    if (Math.abs(s.net - hedef) < KURUS) return { ...s, net: yuvarla(hedef) };
    if (s.net < hedef) alt = orta;
    else ust = orta;
  }
  // Yakınsamadıysa (olmamalı) en yakın brütle döner — sessizce sıfır dönmez.
  const son = brutten((alt + ust) / 2, oncekiKumulatif, p);
  return { ...son, net: yuvarla(hedef) };
}

// —————————————————————————————————————————————————— kümülatif matrah

export interface PayrollLike {
  period: string;
  netSalary: number;
  overtimeAmount: number;
  bonus: number;
}

/**
 * BORDROYA GİREN AYLIK NET KAZANÇ.
 *
 * Harcirah ve avans BURAYA GİRMEZ ve bu bilinçlidir: harcirah bir ücret değil
 * MASRAF KARŞILIĞIDIR (GVK md. 24 sınırları içinde vergiden müstesnadır),
 * avans ise zaten ödenmiş ücretin mahsubudur — ikisi de vergi matrahını
 * değiştirmez. Bordroda ayrı kalemler olarak görünürler.
 */
export function bordroyaGirenNet(r: PayrollLike): number {
  return (
    (Number(r.netSalary) || 0) +
    (Number(r.overtimeAmount) || 0) +
    (Number(r.bonus) || 0)
  );
}

/**
 * Bir kişinin YIL İÇİNDEKİ kümülatif matrahını dönem dönem üretir.
 *
 * Sıra ZORUNLUDUR: matrah birikimlidir, aralara bir ay eklenirse sonraki
 * bütün ayların vergisi değişir. Bu yüzden hesap her seferinde YILIN BAŞINDAN
 * yapılır — satıra yazılmış eski bir kümülatif değere güvenilmez.
 */
export function yilKumulatifi(
  rows: readonly PayrollLike[],
  p: PayrollParams
): Map<string, BordroBreakdown> {
  const sirali = [...rows].sort((a, b) => a.period.localeCompare(b.period));
  const out = new Map<string, BordroBreakdown>();
  let kumulatif = 0;
  for (const r of sirali) {
    const net = bordroyaGirenNet(r);
    const b = brutBul(net, kumulatif, p);
    kumulatif = b.cumulativeTaxBase;
    out.set(r.period, b);
  }
  return out;
}

/** Dönem için geçerli parametre satırı — en yeni `validFrom` kazanır. */
export function gecerliParametre(
  params: readonly PayrollParams[],
  period: string
): PayrollParams | null {
  const ayinSonu = `${period.slice(0, 7)}-28`;
  const uygun = params
    .filter((p) => p.validFrom <= ayinSonu)
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom));
  return uygun[0] ?? null;
}

// ————————————————————————————————————————————————————— saatlik maliyet

/**
 * BİR KİŞİNİN SAATLİK MALİYETİ.
 *
 * `kind` ne ölçüldüğünü söyler ve bu ayrım gerçektir:
 *   · `"net"`      — çalışanın eline geçen / saat. Firmaya maliyeti DEĞİLDİR.
 *   · `"employer"` — brüt + işveren SGK payları / saat. Firmanın gerçek yükü;
 *                    yalnız o yılın parametreleri varsa hesaplanabilir.
 *
 * Payda NET ÇALIŞMA SAATİDİR (normal + fazla mesai − izin − rapor): ödenen
 * para izinli geçen saate de dağılır, o yüzden "225 × kişi" ile bölmek
 * maliyeti olduğundan DÜŞÜK gösterirdi.
 */
export interface HourlyCost {
  kind: "net" | "employer";
  /** TL/saat */
  try: number;
  /** €/saat — dönem kuru yoksa `null`. */
  eur: number | null;
  hours: number;
}

export function saatlikMaliyet(
  toplamTl: number,
  saat: number,
  eurTryRate: number | null,
  kind: "net" | "employer"
): HourlyCost | null {
  if (!(saat > 0) || !(toplamTl > 0)) return null;
  const t = toplamTl / saat;
  return {
    kind,
    try: t,
    eur: eurTryRate && eurTryRate > 0 ? t / eurTryRate : null,
    hours: saat,
  };
}
