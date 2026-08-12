// Uygulamanın kimliği — TEK KAYNAK.
//
// Ad kabukta (logo altındaki kicker), giriş sayfasında ve tarayıcı sekmesinde
// aynı olmalıdır; üç yerde ayrı yazıldığında biri güncellenmeden kalır.
//
// NEDEN "Hesap Raporu Sistemi" DEĞİL: o ad ilk sürümün kapsamıydı. Sistem
// bugün iş emirlerini, teknik çizimleri, ekipman listelerini, satış takibini
// ve atölye çalışma saatlerini de kapsıyor — hesap raporu artık bölümlerden
// BİRİDİR. Yeni ad uygulamanın omurgasını söyler: her kayıt bir İŞE bağlanır
// (iş emri → ürün → hesap/çizim/imalat/sevk), bölüm adları da o dili konuşur.

import { adBuyuk } from "./tr-text";

export const COMPANY_NAME = "ORION Cranes";

/** Logo altındaki kicker ve giriş sayfası künyesi. */
export const APP_NAME = "İş Yönetim Sistemi";

/**
 * Tarayıcı sekmesi — BÜYÜK HARF (kullanıcı kararı, 12.08.2026).
 *
 * Kabukta bu ad zaten büyük görünüyordu ama harfleri CSS büyütüyordu
 * (`.oc-kicker { text-transform: uppercase }`); sekme başlığına, yer imine ve
 * telefondaki uygulama adına ise metnin KENDİSİ gidiyor ve orada "İş Yönetim
 * Sis…" diye küçük harfle duruyordu. Dönüşüm bu yüzden veride yapılır.
 *
 * `adBuyuk` (tr-TR) kullanılır, düz `toUpperCase()` DEĞİL: o "İş"i "IS" yapar.
 * Marka adında Türkçe'ye özgü harf yok, yani `kimlikBuyuk` ile aynı sonucu
 * verir — ikisinden birini seçmek gerekti ve cümlenin baskın dili Türkçe.
 */
export const APP_TITLE = adBuyuk(`${COMPANY_NAME} — ${APP_NAME}`);

/**
 * Ana ekran kısayolunun altındaki ad.
 *
 * Android ikonun altında ~12 karakter gösterir, gerisini kırpar; iOS de
 * benzer davranır. Tam başlık orada "ORION CRANES —…" olurdu — kısayolun
 * kimliği markanın kendisidir.
 */
export const APP_SHORT_NAME = "ORION";

/** Sekme açıklaması ve giriş sayfasının tek cümlesi. */
export const APP_TAGLINE =
  "Vinç işlerinin tek yerden takibi: iş emri, mühendislik, imalat ve satış.";

/**
 * Kabuğun üst şeridindeki SAYFA BAŞLIĞI YUVASI.
 *
 * Sayfa başlığı, açıklaması ve eylem düğmeleri kendi satırlarında değil bu
 * yuvada durur (`components/page-header.tsx` portalla taşır). Gerekçe yer:
 * üst şerit zaten her sayfada 48 px yer kaplıyordu ve içinde yalnız bölüm adı
 * ile bir standart künyesi vardı; başlık satırı ise ayrıca ~64 px alıyordu.
 * İkisi birleşince her sayfada bir başlık satırı boyu içerik kazanılır.
 */
export const APP_HEADER_SLOT_ID = "sayfa-baslik-yuvasi";

/**
 * Kabuğun SAYFA EYLEMLERİ YUVASI — başlık yuvasından AYRIDIR.
 *
 * `lg` üstünde bu yuva başlık şeridinin sağ ucundadır ve görünüm bir tek
 * satırdır. `lg` ALTINDA kendi satırına iner ve yatay kayar.
 *
 * NEDEN İKİ YUVA: eylemler başlıkla aynı 48 px'lik satırda duruyordu ve kap
 * `shrink-0` olduğu için KÜÇÜLEMİYORDU. Hesap raporu ekranında altı eylem
 * (durum şeridi · PDF Rapor · Ekipman Listesi · rozetler · Yayınla) doğal
 * genişlikte ~520-560 px tutuyor; 375 px'lik telefonda şerit taşıyor, belge
 * yatay kayıyor ve `position: sticky` YALNIZ DİKEY sabitlediği için sağa
 * kaydırınca şeridin zemini ekrandan çıkıyordu ("üst bar kayıyor").
 * İki ayrı yuva, eylemleri tek bir DOM örneği olarak taşımanın tek yoludur:
 * aynı düğümleri iki yere birden portallamak `EDITOR_STATUS_SLOT_ID` gibi
 * `getElementById` hedeflerini ikizleyip sessizce bozardı.
 */
export const APP_ACTIONS_SLOT_ID = "sayfa-eylem-yuvasi";
