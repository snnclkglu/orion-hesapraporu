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

export const COMPANY_NAME = "ORION Cranes";

/** Logo altındaki kicker ve giriş sayfası künyesi. */
export const APP_NAME = "İş Yönetim Sistemi";

/** Tarayıcı sekmesi. */
export const APP_TITLE = `${COMPANY_NAME} — ${APP_NAME}`;

/** Sekme açıklaması ve giriş sayfasının tek cümlesi. */
export const APP_TAGLINE =
  "Vinç işlerinin tek yerden takibi: iş emri, mühendislik, imalat ve satış.";
