// Sarf birimleri — SARF GİDERLER ESKİ VERİ.xlsx "Birimi" sütununun DAMITILMIŞ
// hâli (kullanıcı kararı, 14.08.2026: "birimleri çek ve buraya dropdown getir,
// hepsi büyük harf").
//
// Kaynakta 1364 satır yalnız ON birim kullanıyor; hepsi BÜYÜK HARFtir. Liste
// KAPALI DEĞİLDİR — hızlı girişte alan bir `Combobox`tır, kullanıcı listede
// olmayan bir birimi yazıp kullanabilir (SALE_SCOPES kuralının aynısı). Sabit
// bir tablo/FK kurulmadı: birim kümesi küçük ve durağandır, bir migration'ı hak
// etmez.

export const CONSUMABLE_UNITS = [
  "ADET",
  "KG",
  "METRE",
  "M³",
  "LİTRE",
  "TAKIM",
  "PAKET",
  "KOLİ",
  "KUTU",
  "GÜN",
] as const;
