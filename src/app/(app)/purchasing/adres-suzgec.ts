// SÜZGEÇ DURUMU ADRESTE — üç ekranın (Havuz · Siparişler · Teslim Takvimi)
// ortak yardımcısı.
//
// Kullanıcı kararı (16.08.2026): filtrelenmiş görünümün bağlantısı
// paylaşılabilmeli ve sayfa yenilenince süzgeç kaybolmamalı.
//
// SÜZME İSTEMCİDE KALIR (md. 6: "bir veya daha fazla işi seçebilmeliyim" —
// çoklu seçim gidiş-dönüşsüz olmalı). Bu yüzden adres `router.replace` ile
// DEĞİL `window.history.replaceState` ile yazılır: Next'in kendi belgelediği
// yol (single-page-applications.md, "Shallow routing on the client") — çağrı
// router'a entegredir, `useSearchParams` senkron kalır ve SUNUCUYA HİÇBİR
// İSTEK GİTMEZ. `router.replace` her süzgeç tıklamasında bir RSC turu, yani
// havuzun yeniden kurulması demekti.
//
// `replaceState` SEÇİMİ BİLİNÇLİDİR (`pushState` değil): her çoklu-seçim
// tıklaması bir tarih kaydı üretseydi geri tuşu on tıklamayı tek tek geri
// sarardı; geri tuşunun işi önceki SAYFAYA dönmektir, önceki süzgece değil.
//
// DEĞERLER VİRGÜLLE DİZİLİR — Fiyat Arşivi'nin `kat`/`ted` parametreleriyle
// aynı sözleşme; iki ekran iki ayrı kodlama konuşmasın.

/** `?ad=a,b,c` → ["a","b","c"]; parametre yoksa boş liste. */
export function listeOku(params: URLSearchParams, ad: string): string[] {
  const v = params.get(ad);
  return v ? v.split(",").filter(Boolean) : [];
}

/**
 * Verilen alanları adrese yazar; `undefined` alanı SİLER, diğer parametrelere
 * DOKUNMAZ (aynı sayfada yaşayan başka bir durum ezilmesin).
 */
export function adreseYaz(alanlar: Record<string, string | undefined>): void {
  const p = new URLSearchParams(window.location.search);
  for (const [k, v] of Object.entries(alanlar)) {
    if (v) p.set(k, v);
    else p.delete(k);
  }
  const q = p.toString();
  window.history.replaceState(null, "", q ? `?${q}` : window.location.pathname);
}
