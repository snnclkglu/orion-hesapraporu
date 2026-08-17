// TEKLİF TALEBİ ÇEKİRDEĞİ — saf (DB/HTTP/React yok).
//
// Kullanıcı kararı (15.08.2026): *"Bu teklifler bölümde istediğim tekliflerin
// buraya düşmesi. Birkaç firmadan aynı teklifi aldığımda burada görebileyim.
// Teklifin üstüne tıkladığımda bir pop up açılsın ve hangi firma ne teklif
// verdi görebileyim."*
//
// ═══════════════════════════════════════ EKRANDA "TEKLİF" DEDİĞİMİZ ŞEY DEĞİŞTİ
//
// 15.08.2026 sabahı bir TEKLİF, bir firmanın verdiği fiyat listesiydi
// (`purchase_quote_batches`, `TK0007`). Kullanıcının bu cümlesi başka bir
// şeyden bahsediyor: *aynı* teklif birkaç firmadan alınabilen bir şeydir —
// yani ekranda satır olması gereken şey FİRMANIN CEVABI değil, SORULAN SORUdur.
//
//   TALEP (TT0003)  ·  "3 plaka için fiyat sorduk"
//     ├── TK0006  EAG DEMİR      38,00 · 13.680 · 20 gün
//     ├── TK0007  RZK ÇELİK      37,50 · 13.500 · Hazır
//     └── TK0009  HAKAN SAC      42,50 · 15.300 · Hazır
//
// Parti KALDIRILMADI ve kaldırılamazdı: "hangi firma ne dedi" sorusunun cevabı
// odur ve fiyat arşivi, kazanan işareti, iptal damgası hep ona bağlı. Talep
// ONUN ÜSTÜNE bir kat eklenir.
//
// ═══════════════════════════════════════ EŞLEŞME KENDİLİĞİNDEN OLUR
//
// Kullanıcı "bu teklif hangi talebe ait" diye SORULMAK istemiyor — üç firmaya
// aynı listeyi gönderip üç kez fiyat giriyor ve üçünün yan yana gelmesini
// bekliyor. Bu yüzden talep, teklifin KALEM KÜMESİNDEN türetilir: aynı kalem
// kümesi = aynı talep. Küme tutmadığında (bir firma yalnız iki kaleme fiyat
// verdiyse) ayrı bir talep açılır ve kullanıcı ekrandan BİRLEŞTİRİR — kullanıcı
// zaten o düğmeyi istedi ve elle eşleştirme, her teklif girişine bir soru
// eklemekten ucuzdur.

/**
 * TALEP İMZASI — kalem kümesinin kanonik metni.
 *
 * Tekilleştirilir ve SIRALANIR: aynı üç kaleme başka sırayla girilmiş iki
 * teklif AYNI taleptir. Ayraç `\n`dir çünkü `match_key` içinde her noktalama
 * geçebilir ama satır sonu geçemez (`trKatla` boşlukları katlar).
 *
 * KARŞILIĞI SQL'DE DE VARDIR (migration 20260815000007'nin geri doldurması):
 * `string_agg(distinct match_key collate "C", E'\n' order by …)`. İki tarafın
 * ayrışması ZARARSIZDIR — eşleşmeyen bir imza yalnız yeni bir talep açar ve
 * kullanıcı onu birleştirir; sessiz bir veri kaybı üretmez.
 */
export function talepImzasi(anahtarlar: readonly string[]): string {
  return [...new Set(anahtarlar.map((a) => a.trim()).filter(Boolean))].sort().join("\n");
}

/**
 * TALEBİN ADI — kalemlerden türetilir, uydurulmaz.
 *
 * *"SAC 12 X 1500 X 3000 S235JR + 2 kalem"*. İlk kalem listeyi tanıtır (kesim
 * planından gelen bir plaka teklifi ile bir profil teklifi listede birbirine
 * karışmasın), sayı büyüklüğünü verir. Kullanıcı adı DEĞİŞTİREBİLİR; o zaman
 * bu türev kullanılmaz — insanın verdiği ad her zaman daha iyidir.
 */
export function talepBasligi(tanimlar: readonly string[]): string {
  const liste = tanimlar.map((t) => t.trim()).filter(Boolean);
  if (liste.length === 0) return "Teklif";
  const ilk = liste[0];
  return liste.length > 1 ? `${ilk} + ${liste.length - 1} kalem` : ilk;
}

/**
 * TEKLİFİN MİKTARI — havuz konuşuyorsa O, susuyorsa teklifin kendi kaydı.
 *
 * ═════════════════════════════ HAM-24'ün "TEKLİFTE ADET SORULMAZ" KURALININ
 *                               TEK İSTİSNASI VE GEREKÇESİ
 *
 * Kuralın dayanağı şuydu: *"adet zaten havuzda yazar; iki yerde adet tutmak
 * «hangisi doğru» sorusunu doğururdu."* Dayanak PLAKADA ÇÖKER — plakanın
 * havuzda karşılığı YOKTUR ve olmamalıdır (havuz `SAC 10 MM S355JR` bir
 * İHTİYAÇ, plaka `SAC 10 X 1500 X 6000 ST37` bir ÜRÜNdür ve ölçüsü ancak
 * yerleşim yapılınca bilinir). Miktar hiçbir yerde saklanmazsa karşılaştırma
 * tablosunun "Tutar" sütunu plakada kalıcı olarak boş kalır ve karar yalnız
 * birim fiyattan verilir; oysa 3.537 kg'lık bir kalemde kuruşluk bir fark
 * gerçek paradır.
 *
 * İKİ KAYNAK YİNE YOKTUR: havuzda karşılığı olan kalemde teklifin kendi
 * miktarı OKUNMAZ (havuz otoriterdir, çünkü parça değiştikçe o değişir);
 * yalnız havuz susuyorsa teklifle birlikte donmuş sayı kullanılır. Sıra
 * sabittir ve tek yerdedir — bu fonksiyon.
 */
export function teklifMiktari(
  havuzMiktari: number | null | undefined,
  teklifMiktar: number | null | undefined
): number | null {
  if (havuzMiktari != null && havuzMiktari > 0) return havuzMiktari;
  if (teklifMiktar != null && teklifMiktar > 0) return teklifMiktar;
  return null;
}
