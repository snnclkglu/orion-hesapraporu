// MANUEL TALEP HİZMET KATEGORİLERİ — kullanıcı kararı (14.08.2026):
// *"Projelerde olmayan ama proje için satın alınan şeyleri Yeni Talep olarak
// açacağız."* Bunlar teknik resimden gelmez; katalog sınıflarından ayrı bir
// kümedir ve yalnız Yeni Talep penceresinde seçilir.
//
// Otomatik sınıflandırma (`satinAlmaSinifi`) bunlara BAKMAZ — hiçbir depo satırı
// bu kategorilere düşmez. Havuzun kategori sırasına `satinAlmaKategoriSirasi`
// ile eklenirler ki manuel satırlar bir gruba oturunca sıralama tutarlı olsun.

export const HIZMET_TALEP_KATEGORILERI = [
  "Nakliye",
  "Mobil Vinç",
  "Manlift",
  "Kalite Kontrol",
  "Boya",
  "Boya İşçiliği",
  "Büküm İşçiliği",
  "Kesim",
  "Ambalaj",
  "Bara ve Aksesuarları",
  "Cam",
  "Elektrik Otomasyon",
  "Etiket & Baskı",
  "Isıl İşlem",
  "Kablo",
  "Sürücü",
  "Sarf Malzeme",
  "Şalt Malzeme",
  "Elektrik Panosu",
  "Mekanik Montaj İşç. Fason",
  "Yağ",
  "E.Odası ve Kabin Aksesuarları",
] as const;
