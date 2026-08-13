// Ücret planı çekirdeği — SAF. DB/UI bağımlılığı yoktur.
//
// KULLANICI KARARI (13.08.2026): "Yıllık net maaşların belirlendiği bir sayfa
// olsun istiyorum. Çünkü biz yıl başında zam yapıyoruz; örneğin kişinin net
// maaşının 50 bin TL olduğu belirleniyor, sonra kişi yıl boyunca o maaşı
// alıyor. O bölümde zamları da ayarlayabileyim — %5 10 15 20 25 veya kendi
// istediğim oran. Yıl içinde bazen nadiren ayarlama yapabilirim, düzenleme
// seçeneği olsun. Şimdiki maaş bölümüne de bu bölümden Net Maaş verisi gelsin."
//
// MODEL: bir satır "şu tarihten itibaren bu kişinin net ücreti şudur" der ve
// BİTİŞ TAŞIMAZ — bir sonraki satır zaten bitirir. İki uçlu aralık tutmak
// "boşluk mu var, çakışma mı var" diye ikinci bir tutarlılık sorusu doğururdu
// ve o soruyu kimse cevaplayamazdı.

/** Ücret kararının türü — neden değişti? */
export const RAISE_REASONS = ["ilk", "yillik", "ara", "duzeltme"] as const;
export type RaiseReason = (typeof RAISE_REASONS)[number];

export const RAISE_REASON_LABELS: Record<RaiseReason, string> = {
  ilk: "İlk ücret",
  yillik: "Yıl başı zammı",
  ara: "Yıl içi ayarlama",
  duzeltme: "Düzeltme",
};

/**
 * HAZIR ZAM ORANLARI — kullanıcının kendi listesi (%5 · 10 · 15 · 20 · 25).
 *
 * LİSTE KAPALI DEĞİLDİR: ekranda ayrıca serbest oran kutusu vardır ("veya
 * kendi istediğim oranda"). Buradakiler yalnız en sık basılan düğmelerdir;
 * %30'luk bir yıl geldiğinde kullanıcı onu yazar, uygulama bir dağıtım
 * beklemez.
 */
export const RAISE_PRESETS = [5, 10, 15, 20, 25] as const;

/**
 * YUVARLAMA — zam sonucu ekrana yazılmadan önce buradan geçer.
 *
 * Gerekçe: 47.500 ₺'ye %13 zam 53.675 ₺ eder ve firma bu sayıyı bordroya
 * yazmaz; yuvarlar. Yuvarlamayı kullanıcıya bırakmak (kutuyu elle düzelttirmek)
 * kırk kişilik bir listede kırk düzeltme demekti.
 *
 * Varsayılan 100 ₺'dir: devralınan 566 maaş satırının tamamı yüzlüğe
 * yuvarlıydı — kural veriden okundu, uydurulmadı.
 */
export const ROUND_STEPS = [1, 10, 100, 500, 1000] as const;
export type RoundStep = (typeof ROUND_STEPS)[number];
export const DEFAULT_ROUND_STEP: RoundStep = 100;

/** Ondalıksız, adımına yuvarlanmış tutar. `adim = 1` yuvarlamayı kapatır. */
export function yuvarla(tutar: number, adim: number = DEFAULT_ROUND_STEP): number {
  if (!Number.isFinite(tutar)) return 0;
  const a = Number.isFinite(adim) && adim >= 1 ? adim : 1;
  return Math.round(tutar / a) * a;
}

/**
 * Zam uygular: `taban × (1 + oran/100)`, sonra yuvarlar.
 *
 * ORAN YÜZDE OLARAK VERİLİR (15 = %15), kesir olarak değil: ekranda kullanıcı
 * "15" yazar ve iki farklı birimi aynı fonksiyonda taşımak, sıfır bir zamla
 * ücreti yüzde bir küçültmenin en kolay yoludur.
 */
export function zamliUcret(
  taban: number | null | undefined,
  oranYuzde: number | null | undefined,
  adim: number = DEFAULT_ROUND_STEP
): number {
  const t = Number(taban);
  if (!Number.isFinite(t) || t <= 0) return 0;
  const o = Number(oranYuzde);
  return yuvarla(t * (1 + (Number.isFinite(o) ? o : 0) / 100), adim);
}

/**
 * İki ücret arasındaki oran (yüzde). Uçlardan biri yoksa `null` —
 * SIFIR DEĞİL: "zam yok" ile "taban bilinmiyor" aynı şey değildir ve sıfır
 * yazmak ilk ücreti "%0 zam almış" gibi gösterirdi.
 *
 * `null`/`undefined` AÇIKÇA elenir, `Number()`a bırakılmaz: `Number(null)`
 * sıfırdır ve sıfır sonlu bir sayıdır, yani henüz YAZILMAMIŞ bir yeni ücret
 * "%−100 zam" olarak okunurdu. Kutusu boş kırk kişilik bir listede ortalama
 * zam ekranda −%100'e yakın çıkardı.
 */
export function zamOrani(
  taban: number | null | undefined,
  yeni: number | null | undefined
): number | null {
  if (taban === null || taban === undefined || yeni === null || yeni === undefined) return null;
  const t = Number(taban);
  const y = Number(yeni);
  if (!Number.isFinite(t) || t <= 0 || !Number.isFinite(y)) return null;
  return (y / t - 1) * 100;
}

// ————————————————————————————————————————————————————————— plan çözümlemesi

/** Ücret planı satırının çekirdek görünümü (arayüz tipi `schema.ts`tedir). */
export interface SalaryPlanLike {
  employeeId: string;
  /** Geçerliliğin başladığı dönem — `yyyy-aa` ya da `yyyy-aa-01`. */
  effectiveFrom: string;
  netSalary: number;
}

/** `2026-08-01` / `2026-08` → `2026-08`. */
function ay(v: string): string {
  return v.slice(0, 7);
}

/**
 * Bir kişinin BİR DÖNEMDE geçerli ücreti.
 *
 * Kural: dönemden SONRA başlayan satırlar elenir, kalanların EN YENİSİ kazanır.
 * Hiç satır yoksa `null` döner — sıfır değil: "planı yok" ile "ücreti sıfır"
 * aynı şey değildir ve maaş ekranı ikincisini bir veri sanardı.
 *
 * Liste sıralı gelmek ZORUNDA DEĞİLDİR; fonksiyon kendi tarar. Sıralı gelmesini
 * şart koşmak, çağıran tarafın unuttuğu gün sessizce yanlış ücret verirdi.
 */
export function gecerliUcret<T extends SalaryPlanLike>(
  plans: readonly T[],
  employeeId: string,
  period: string
): T | null {
  const hedef = ay(period);
  let kazanan: T | null = null;
  for (const p of plans) {
    if (p.employeeId !== employeeId) continue;
    const bas = ay(p.effectiveFrom);
    if (bas > hedef) continue;
    if (!kazanan || bas > ay(kazanan.effectiveFrom)) kazanan = p;
  }
  return kazanan;
}

/**
 * Bir YILIN başında geçerli olan ücret — zam ekranının TABANI.
 *
 * Zam "bir önceki yılın son ücreti"nin üstüne yapılır, o yılın ORTALAMASININ
 * değil: kişi eylülde ara ayarlama aldıysa yıl başı zammı o ayarlanmış ücretin
 * üstünedir. Bu yüzden taban, hedef yılın ARALIK ayında geçerli olan ücrettir.
 */
export function yilBasiTabani<T extends SalaryPlanLike>(
  plans: readonly T[],
  employeeId: string,
  yil: number
): T | null {
  return gecerliUcret(plans, employeeId, `${yil - 1}-12`);
}

/** `2026` → `2026-01-01`. Yıl başı kararının geçerlilik günü. */
export function yilBasi(yil: number): string {
  return `${String(yil).padStart(4, "0")}-01-01`;
}

/**
 * PLAN İLE ÖDENEN ARASINDAKİ SAPMA.
 *
 * Maaş ekranı bunu bir UYARI olarak gösterir, bir ENGEL olarak değil: eksik
 * gün, ücretsiz izin ve ay ortası giriş meşru sapmalardır. Uygulama hangisi
 * olduğunu bilemez; sayıyı gösterir, kararı insan verir.
 *
 * Eşik bir KURUŞ değil BİR LİRADIR: yuvarlama artığı yüzünden her satırı
 * uyarıya boğmak, uyarıyı anlamsız kılardı.
 */
export function planSapmasi(
  planlanan: number | null | undefined,
  odenen: number | null | undefined
): number | null {
  const p = Number(planlanan);
  const o = Number(odenen);
  if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(o)) return null;
  const fark = o - p;
  return Math.abs(fark) < 1 ? null : fark;
}
