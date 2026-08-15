// SİPARİŞİN TÜRÜ — hammadde mi ekipman mı? (saf; DB/UI yok)
//
// Kullanıcı kararı (15.08.2026): *"Hammadde bölümündeki siparişler sayfasını
// Satın Alma Siparişler sayfasıyla birleştirsek. İki ayrı siparişler sayfası
// olmasa güzel olur. … Siparişler sayfasının yapısını hem ekipman hem
// hammaddeye uygun planla. Hammadde ve ekipman satırların arka planı farklı
// renk olsun, göze çarpsın. Filtre olsun."*
//
// ═══════════════════════════════════════ NEDEN İKİNCİ BİR EKRAN VARDI, NEDEN KALKTI
//
// `/purchasing/hammadde/siparisler` bir sipariş defteri DEĞİLDİ; aynı defterin
// (`loadSiparisler`) süzülmüş bir okunuşuydu ve gerekçesi şuydu: hammaddede
// sorulan şey KİLODUR ("bu ay kaç ton sac aldık"), ticari ekranda o sayı hiç
// yoktu. Gerekçe ÇÜRÜMEDİ, KARŞILANDI — kilo artık ortak ekranda da var. Geriye
// yalnız ikinci ekranın maliyeti kalmıştı: yazma yolu orada yok, kullanıcı
// düzenlemek için öbür ekrana gönderiliyordu ve iki liste aynı soruya iki
// yerden cevap veriyordu.
//
// ═══════════════════════════════════════ TÜR BİR SÜTUN DEĞİL, SATIRLARDAN TÜREV
//
// Veritabanında "bu sipariş hammaddedir" diye bir alan YOKTUR ve açılmadı:
// sipariş satırlarının ne olduğu zaten adlarında yazıyor ve ikinci bir alan,
// düzeltilmiş bir kalem adından sonra sessizce yalan söylerdi (md. 21'in
// "iki gerçek" kuralı). Tür her okumada `alimKategorisi` ile TÜRETİLİR — aynı
// fonksiyon, hammadde alım analizinin kullandığının ta kendisi.
//
// **KARMA GERÇEK BİR HÂLDİR, bir hata değil.** Bir siparişte hem sac hem rulman
// olabilir (aynı firmadan alınıyorsa doğrusu da budur). Üçüncü bir değer
// vermeseydik o sipariş ya hammadde süzgecinde ya ekipman süzgecinde
// kaybolurdu; şimdi İKİSİNDE DE görünür ve kendi rengini taşır.
//
// **SINIFLANDIRMA BİR GÖRÜNÜMDÜR, BİR KİLİT DEĞİL.** `alimKategorisi` ada
// bakar ve yanılabilir ("KARE SOMUN" profil kalıbına takılır). Bedeli
// ölçülüdür ve kabul edilmiştir: yanlış sınıflanan sipariş yanlış RENKTE
// görünür, KAYBOLMAZ — eski ekranda ise aynı yanılgı siparişi listeden
// tamamen düşürüyordu.

import { alimKategorisi } from "./hammadde/alim-analizi";

export type SiparisTuru = "hammadde" | "ekipman" | "karma";

export const SIPARIS_TURU_ETIKET: Record<SiparisTuru, string> = {
  hammadde: "Hammadde",
  ekipman: "Ekipman",
  karma: "Karma",
};

/**
 * Türün TON AÇISI — renk TANIMI `globals.css`tedir (md. 14'ün kuralı).
 *
 * Hammadde kehribar-turuncu (ham demir), ekipman mavi (makine), karma mor
 * (ikisinin arası). Doygunluk ve parlaklık tema başına CSS'te verilir; burada
 * yalnız açı durur, yoksa aynı renk açık ve koyu temada birden okunmazdı.
 */
export const SIPARIS_TURU_TONU: Record<SiparisTuru, number> = {
  hammadde: 35,
  ekipman: 235,
  karma: 290,
};

/** Bir satır hammadde mi? `DIGER` = hammadde ailelerinden hiçbiri. */
export function hammaddeSatiriMi(tanim: string): boolean {
  return alimKategorisi(tanim) !== "DIGER";
}

/**
 * Siparişin türü — satırlarından.
 *
 * SATIRI OLMAYAN SİPARİŞ "ekipman" SAYILMAZ, "karma" da: kanıt yoktur ve
 * varsayılan en az iddialı olandır. `ekipman` döner çünkü hammadde bir
 * ISTISNA'dır (defterin çoğunluğu ekipmandır) ve boş bir kaydı hammadde
 * saymak, kilo toplamına sahte bir satır sokardı.
 */
export function siparisTuru(satirlar: readonly { sample: string }[]): SiparisTuru {
  if (satirlar.length === 0) return "ekipman";
  let ham = 0;
  for (const l of satirlar) if (hammaddeSatiriMi(l.sample)) ham += 1;
  if (ham === 0) return "ekipman";
  if (ham === satirlar.length) return "hammadde";
  return "karma";
}

/**
 * Süzgeç eşleşmesi — KARMA hem hammaddeye hem ekipmana girer.
 *
 * "Hammadde" süzgecini açan kullanıcı *"bu ay ne kadar sac aldım"* diye
 * soruyor; içinde sac olan karma bir sipariş o sorunun cevabının parçasıdır ve
 * dışarıda bırakmak toplamı eksik gösterirdi.
 */
export function turSuzgeciUyuyor(tur: SiparisTuru, secilenler: readonly string[]): boolean {
  if (secilenler.length === 0) return true;
  if (secilenler.includes(tur)) return true;
  return tur === "karma" && (secilenler.includes("hammadde") || secilenler.includes("ekipman"));
}

/**
 * KİLO TOPLAMI — yalnız KİLO BİRİMLİ satırlardan.
 *
 * Sacda ticari miktar kilodur (md. 24) ama profilde BOY, rulmanda ADET olabilir
 * ve üçünü toplamak tonajı sessizce şişirirdi. Kilo dışı satırlar AYRICA
 * sayılır ve ekranda "+n" olarak görünür — sessizce düşürülmezler.
 */
export function siparisKilosu(
  satirlar: readonly { qty: number; unit: string }[]
): { kg: number; kiloDisiSatir: number } {
  let kg = 0;
  let kiloDisiSatir = 0;
  for (const l of satirlar) {
    if (l.unit.trim().toLocaleLowerCase("tr-TR") === "kg") kg += l.qty;
    else kiloDisiSatir += 1;
  }
  return { kg, kiloDisiSatir };
}
