// AĞIRLIK DÖKÜMÜ — veri modeli.
//
// Döküm bir HESAP DEĞİL bir DOĞRULAMADIR (bkz. `docs/agent/hesap.md`, HESAP-35).
// Hesap motoru bu tipleri hiç görmez; hiçbir kontrol onlardan beslenmez ve
// hiçbir kesit onlarla onaylanmaz. Tek işi, teknik özelliklerde TASARIMDAN ÖNCE
// girilen tahmini ağırlığı, rapor ilerledikçe ortaya çıkan gerçek parçalarla
// yan yana koymaktır.

/**
 * Bir kalemin kilosunun NEREDEN geldiği.
 *
 * Değerler Türkçedir — `checkKind` (`"standart" | "uretici" | "firma" | "bilgi"`,
 * HESAP-4) aynı deseni kurar ve rozet metni doğrudan haritadan gelir.
 *
 * Güven sırası soldan sağa azalır: `hesap` kesitin kendi geometrisinden çıkar,
 * `katalog` üreticinin yayımladığı sayıdır, `tahmin` firma imalat geçmişine
 * dayanan bir kabuldür, `elle` mühendisin o işe özel bilgisidir.
 */
export type AgirlikKaynagi = "hesap" | "katalog" | "tahmin" | "elle";

export const AGIRLIK_KAYNAKLARI: readonly AgirlikKaynagi[] = [
  "hesap",
  "katalog",
  "tahmin",
  "elle",
];

export const AGIRLIK_KAYNAK_ETIKETLERI: Record<AgirlikKaynagi, string> = {
  hesap: "Hesap",
  katalog: "Katalog",
  tahmin: "Tahmin",
  elle: "Elle",
};

/**
 * Rozetin OKLCH TON AÇISI — renk HEX değil AÇIdır (değişmez md. 6); doygunluk
 * ve parlaklık `globals.css`teki `.oc-tag` kuralından, tema başına gelir.
 *
 * RENK TEK TAŞIYICI DEĞİLDİR: rozet kaynağın adını da yazar.
 */
export const AGIRLIK_KAYNAK_TONLARI: Record<AgirlikKaynagi, number> = {
  hesap: 150,
  katalog: 255,
  tahmin: 65,
  elle: 310,
};

/** Dökümün karşılaştırdığı teknik özellik kutuları. */
export const AGIRLIK_SPEC_ANAHTARLARI = [
  "bridgeWeightT",
  "mainTrolleyWeightT",
  "auxTrolleyWeightT",
  "mono1TrolleyWeightT",
  "mono2TrolleyWeightT",
] as const;

export type AgirlikSpecAnahtari = (typeof AGIRLIK_SPEC_ANAHTARLARI)[number];

/**
 * Tahmin ile döküm arasındaki farkın "dikkat" eşiği (kullanıcı kararı,
 * 01.09.2026: %10).
 *
 * Maliyet tarafındaki `COST_DEVIATION_LIMIT` (%5) YENİDEN KULLANILMAZ ve
 * kopyalanmaz: orada soru *"teklifte söz verilen ekipman hesaptan çıkanla aynı
 * mı"*, burada *"tasarım öncesi tahmin tuttu mu"*dur. Bir bant toplamındaki
 * %10 sapma bir teker boyunu ya da bir motor kademesini genellikle kaydırmaz.
 */
export const AGIRLIK_SAPMA_SINIRI = 0.1;

/** Döküm satırı — bir ürün ya da bir yapı parçası. */
export interface AgirlikKalemi {
  /** `<bant>.<grup>.<kalem>` — TEKİL (koruma testi). */
  key: string;
  label: string;
  kaynak: AgirlikKaynagi;
  /**
   * Adet — kaynağı EKİPMAN SATIRIDIR (`EqRow.qty`) ve burada EZİLEMEZ.
   * İkinci bir adet açmak HESAP-21'in kapattığı kapıyı yeniden açardı.
   */
  adet: number | null;
  /** Adet başına ağırlık [kg]; bilinmiyorsa `null` — `0` DEĞİL (md. 4). */
  birimKg: number | null;
  /** Katalog aralık verdiyse birim ağırlığın üst sınırı [kg]. */
  birimKgUst?: number;
  /** Satır toplamı [kg] = adet × birim, ya da ezilmiş değer. */
  kg: number | null;
  /** Aralığın üst ucundan hesaplanan satır toplamı [kg]. */
  kgUst?: number;
  /** Kısa formül metni — adın yanındaki bilgi açılırında görünür. */
  formul?: string;
  /** Boşsa NEDEN boş, tahminse hangi kabul — MALIYET-13'ün cümlesi. */
  gerekce?: string;
  /** Hangi hesap bölümünden geldi (satırdan bölüme atlamak için). */
  moduleKey?: string;
  /** Ekipman satırı kimliği (`main:drum`) — not/ek/gizleme ile aynı uzay. */
  rowKey?: string;
  /** Elle ezildi mi; ezildiyse özgün kaynak `kaynakOnce`dedir. */
  ezildi?: boolean;
  kaynakOnce?: AgirlikKaynagi;
  /** Otomatik değer — ezme geri alınınca buraya dönülür. */
  otomatikKg?: number | null;
  /** Gizlenen bir alt bölümden geldi (anahtar açıkken solgun görünür). */
  gizliBolumden?: boolean;
  /**
   * ORTA SÜTUNA basılan KISA DURUM (kullanıcı isteği, 02.09.2026, md. 6):
   * *"'2 kalem eksik' gibi yazılar ağırlığın yanında değil satır ortasında bir
   * sütun gibi yazsın."*
   *
   * `gerekce`nin kısaltması DEĞİL, onun yerine geçen bir ETİKETtir: gerekçe bir
   * cümledir ve satıra sığmaz, bu ise iki-üç kelimedir ("katalogda yok",
   * "hat tahminine dâhil"). Uzun metin adın açılırında kalır.
   */
  kisaDurum?: string;
  /**
   * PENCEREDEN ELLE AÇILAN SATIRIN kimliği (`serbest-3`).
   *
   * Ezilen bir kalemden ayrıdır: ezme MEVCUT bir satırın kilosunu değiştirir,
   * bu ise vincin üzerinde olup hiçbir bölümün üretmediği bir parçayı listeye
   * SOKAR (kullanıcı isteği, 02.09.2026, md. 7). Adı ve kilosu düzenlenebilir,
   * satır silinebilir — otomatik satırlarda ikisi de yapılamaz.
   */
  serbestId?: string;
  /**
   * AĞIRLIĞI BAŞKA BİR KALEM KAPSIYOR — "eksik" sayılmaz.
   *
   * Feston kablo arabasının kilosu katalogda yayımlanmamıştır ama TAHMİN kalemi
   * hattın tamamını (ray + taşıyıcılar + kablo) zaten tartar. İki satırı da
   * toplasaydık çift sayardık; katalog satırını eksik saysaydık ekran olmayan
   * bir boşluk gösterirdi.
   */
  kapsandi?: boolean;
}

export interface AgirlikGrubu {
  key: string;
  label: string;
  kalemler: AgirlikKalemi[];
  /** Bilinen kalemlerin toplamı; hiçbiri bilinmiyorsa `null`. */
  kg: number | null;
  /** Ağırlığı bilinmeyen kalem adedi — toplam "≥" ile basılır. */
  eksikKalemSayisi: number;
  /** Grup toplamı elle verildi (kalemler listede solgun kalır, toplama girmez). */
  ezildi?: boolean;
  tahminIcerir: boolean;
  /** Gizli alt bölüm yüzünden listeden düşen satır adedi. */
  gizliDusenSayisi: number;
  /**
   * BANDIN TEKNİK ÖZELLİK TOPLAMINA GİRMEZ (bugün yalnız portal ayakları).
   *
   * Kullanıcı isteği ayakları KÖPRÜ grubunda istiyor (02.09.2026, md. 8) ve
   * grup gerçekten oradadır — ama `bridgeWeightT` kutusunu ana kiriş (ölü yük
   * payı) ve teker yükleri OKUR. Ayaklar ana kirişe binmez, ana kirişi TAŞIR;
   * kilosu o kutuya yazılsaydı kiriş sehimi ve teker yükü sessizce büyürdü —
   * bir doğrulama aracının ürettiği gerçek bir hesap hatası olurdu.
   *
   * Bu yüzden grup bandın İÇİNDE görünür, `bant.kg`ye girmez ve `bant.disKg`de
   * ayrıca toplanır; vincin TOPLAM ağırlığı ikisini de sayar.
   */
  bantToplaminaGirmez?: boolean;
}

export interface AgirlikBandi {
  key: string;
  label: string;
  /** Hangi teknik özellik kutusuyla karşılaştırılır; yoksa yazma düğmesi çizilmez. */
  specKey?: AgirlikSpecAnahtari;
  /** O kutunun bugünkü değeri [kg] — teknik özellik TON tutar, burada kg'a çevrilir. */
  tahminiKg: number | null;
  gruplar: AgirlikGrubu[];
  /** Teknik özellik kutusuyla KARŞILAŞTIRILAN toplam (`bantToplaminaGirmez` hariç). */
  kg: number | null;
  /**
   * Kutuya girmeyen grupların toplamı [kg] — bugün yalnız portal ayakları.
   * Vincin toplam ağırlığı bunu da sayar, teknik özellik kutusu saymaz.
   */
  disKg: number | null;
  eksikKalemSayisi: number;
  tahminIcerir: boolean;
  /** (döküm − tahmini) / tahmini; ikisinden biri yoksa `null`. */
  farkOrani: number | null;
}

export interface AgirlikDokumu {
  bantlar: AgirlikBandi[];
  /**
   * VİNCİN TOPLAM AĞIRLIĞI — kutuya girmeyen gruplar (portal ayakları) DÂHİL.
   *
   * Bant toplamlarının toplamı DEĞİLDİR: bir bandın `kg`si yalnız teknik
   * özellik kutusuyla karşılaştırılan kısımdır. Ayakları toplamdan düşmek,
   * ekranda "toplam vinç ağırlığı" yazan bir sayının vincin bir parçasını
   * saymaması olurdu.
   */
  kg: number | null;
  eksikKalemSayisi: number;
  tahminIcerir: boolean;
  /** Ekranda gösterilecek eksik/kapsam cümleleri (MALIYET-13). */
  notlar: string[];
}

/**
 * PENCEREDEN ELLE AÇILAN SERBEST SATIR (kullanıcı isteği, 02.09.2026, md. 7).
 *
 * Ekipman listesindeki `EquipmentExtraRow` DEĞİLDİR ve oraya yazılmaz: orası
 * satın almaya giden bir belgedir, burası bir tartıdır. Bir vinçte hiçbir hesap
 * bölümünün üretmediği ama gerçekten tartan parçalar olur (kabin yürütmesi,
 * özel bir bağlantı sacı, müşteri talebi bir platform); bunlar bir ürün seçimi
 * değil MÜHENDİSİN BİLGİSİdir ve `AgirlikDokumuDurumu`da, öteki insan
 * kararlarının yanında yaşar.
 */
export interface AgirlikSerbestKalem {
  /** `serbest-<n>` — bant/grup ile birleşerek `<bant>.<grup>.serbest-<n>` olur. */
  id: string;
  bant: string;
  grup: string;
  ad: string;
  /** Adet — serbest satırın KENDİ adedidir; HESAP-21 ekipman satırını bağlar. */
  adet: number | null;
  /** Adet başına DEĞİL, satırın TOPLAM kilosu; bilinmiyorsa `null` (md. 4). */
  kg: number | null;
}

/** Serbest satır anahtarlarının ön eki — ezme/not uzayında ayrık kalsın. */
export const AGIRLIK_SERBEST_ON_EKI = "serbest-";

/** Bir revizyonda açılabilecek serbest satır tavanı (Zod kelepçesi). */
export const AGIRLIK_SERBEST_SINIRI = 100;

/**
 * Revizyonda saklanan İNSAN KARARLARI — dökümün kendisi saklanmaz, her açılışta
 * yeniden türetilir (bkz. HESAP-35).
 */
export interface AgirlikDokumuDurumu {
  /** kalem/grup anahtarı → elle yazılan kg */
  overrides?: Record<string, number>;
  /** kalem/grup anahtarı → mühendisin notu (neden ezildi) */
  notes?: Record<string, string>;
  /** Pencereden elle açılan satırlar (md. 7). */
  serbest?: AgirlikSerbestKalem[];
  /**
   * PORTAL AYAK YÜKSEKLİĞİ [m] — ray üstünden ana kiriş alt başlığına.
   *
   * Teknik özelliklere YENİ BİR KUTU EKLENMEDİ: hesap motoru bu sayıyı hiç
   * okumaz ve HESAP-35'in kendi uyarısı ("hiçbir kontrolün okumadığı bir sayı
   * yapısal bir girdi gibi görünür") tam olarak buna işaret ediyor. Ayak
   * yüksekliği dökümün kendi girdisidir ve öteki insan kararlarıyla birlikte
   * `inputs.weightBreakdown`ta durur.
   */
  ayakYuksekligiM?: number;
  /**
   * GİZLİ ALT BÖLÜMLERİ DE SAY (kullanıcı kararı, 01.09.2026).
   *
   * Gizleme iki gerekçeyle yapılır (HESAP-7): *"bazı vinçlerde bazı özellikler
   * olmuyor VEYA müşteriye göstermek istemiyorum"*. Varsayılan davranış
   * ekipman listesini izler ve kalemi DÜŞÜRÜR; ikinci gerekçede parça gerçekten
   * vardır ve tartılmalıdır — anahtar onu geri getirir.
   *
   * Bir GÖRÜNÜM tercihidir, revizyona YAZILMAZ.
   */
  gizliBolumleriSay?: boolean;
}
