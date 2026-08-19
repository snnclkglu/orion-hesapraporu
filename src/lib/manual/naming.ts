// EL KİTABININ ADI VE BELGE KODU — tek kaynak.
//
// BELGENİN ADI KULLANICI KARARIDIR (19.08.2026): *"Doküman isimlendirmesini de
// İşletme ve Bakım El Kitabı olarak istiyor."* Kaynak Word dosyasının kapağında
// "KULLANMA VE BAKIM KILAVUZU" yazıyor ve o ad artık KULLANILMAZ. Ad tek
// yerdedir ki kapak, sekme, PDF künyesi ve dosya adı ayrışamasın —
// `lib/app.ts`teki `APP_NAME` kuralının aynısı.

/** Kapakta ve sekmede basılan belge adı. */
export const MANUAL_DOC_TITLE = "İŞLETME VE BAKIM EL KİTABI";

/** Ekranda, menüde ve düğmelerde okunan hâli (cümle düzeninde). */
export const MANUAL_LABEL = "İşletme ve Bakım El Kitabı";

/**
 * `ORC-BK-0019-00-R01` — el kitabının belge kodu (BK = Bakım Kitabı).
 *
 * `docCode` İMZASI BOZULMADI ve bu bilinçli: o fonksiyonun tür kümesi
 * (`HR` · `EQ` · `TR`) hesap raporu ailesinindir ve oraya dördüncü bir harf
 * eklemek üç belgenin testini de değiştirirdi. İş emri (`workOrderDocCode`)
 * ve bordro (`payslipDocCode`) da aynı gerekçeyle kendi üreticilerini taşır.
 *
 * Doküman numarası KALEM numarasıdır (`0019-00`), proje `doc_no`su değil:
 * bir işin iki vincinin iki ayrı el kitabı olur ve ikisi aynı kodu taşıyamaz.
 */
export function manualDocCode(itemNo: string, revNo: number): string {
  return `ORC-BK-${itemNo}-R${String(revNo).padStart(2, "0")}`;
}

/**
 * Kapağın üst satırı için öneri: "185/40 TON KAPASİTELİ ŞARJ VİNCİ".
 *
 * ÖNERİDİR, KİLİT DEĞİL — `coverTitle` elle düzenlenebilir. Kapasite ve vinç
 * tipi verilmediyse ne varsa o basılır; uydurulmaz (değişmez md. 4).
 */
export function suggestCoverTitle(urunAdi: string, craneType: string): string {
  const parcalar = [urunAdi.trim(), craneType.trim()].filter(Boolean);
  return parcalar.join(" — ");
}
