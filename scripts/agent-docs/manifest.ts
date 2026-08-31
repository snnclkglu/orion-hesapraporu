/**
 * BÖLME PLANI — hangi madde hangi alan dosyasına gider, hangi dosyalara dokununca yüklenir.
 *
 * Bu dosya TEK KAYNAKtır: alan dosyaları, `.claude/rules/` yol kapsamlı
 * işaretçileri ve `AGENTS.md`teki harita tablosu üçü de buradan üretilir. Üçünü
 * elle yazmak, birinde düzeltilen bir yolun ötekilerde kalması demekti.
 *
 * MADDE KİMLİĞİ NUMARA DEĞİL BAŞLIKtır. Numaralar bölümden bölüme tekrar
 * ediyor — `md. 15` bugün üç ayrı maddedir (feston · roller · telefonda ana
 * tablo) ve kodda o numaraya yapılmış 50 atfın hangisini kastettiği
 * okunamıyor. Bölme bu yüzden başlıktan tanır; numara korunur, önünde ALAN
 * ÖNEKİ taşır (`ROL-15`) ve belirsizlik biter.
 */

export type Alan = {
  /** `docs/agent/<dosya>.md` ve `.claude/rules/<dosya>.md`. */
  dosya: string;
  /** Madde kimliği öneki (`ROL` → `ROL-15`). Bölümlük dosyalarda boş. */
  onek: string;
  /** Alan dosyasının `# ` başlığı. */
  baslik: string;
  /** Haritadaki tek satırlık tarif — ajan buradan hangi dosyayı okuyacağına karar verir. */
  ozet: string;
  /**
   * Bu yollara dokunulduğunda kural bağlama girer (`.claude/rules` `paths:`).
   * Boşsa kural dosyası ÜRETİLMEZ (yalnız haritadan bulunur).
   */
  yollar: string[];
  /**
   * Taşınacak bloklar: `## ` bölüm adı ya da `bolum|madde-kimliği-öneki`.
   * Kimlik eşleşmesi BAŞTAN yapılır ve tr-küçük harfe indirgenir.
   */
  al: string[];
  /**
   * `md. N` atıflarında bu alan N numarasının VARSAYILAN sahibiyse true.
   * Yalnız belirsiz numaralarda (birden çok alanda aynı numara) kullanılır.
   */
  varsayilan?: boolean;
};

/** Kök `AGENTS.md`te KALACAK bloklar — her oturumda yüklenirler, kısa olmalılar. */
export const KOKTE_KALAN = [
  "Temel ilke: hesap yöntemi standartlara dayanır, bir tabloya değil",
  "Stack",
  "Güvenlik",
];

/**
 * Yalnız KAP olan bölüm başlıkları — kendi gövdeleri yoktur, maddeleri
 * alanlara dağılır. Başlık satırı bölmede düşer; maddeleri ayrıca taşınır.
 * Gövdesi olan bir başlık buraya konursa bölme kayıp verir ve denetim yakalar.
 */
export const KAP_BOLUMLER = ["Mimari ilkeler"];

/**
 * Numaralı satırları MADDE değil ADIM olan bölümler — kimlik almazlar, liste
 * biçiminde aynen taşınırlar. "Yeni bir hesap eklerken" bir kontrol listesidir;
 * adımlarına `HESAP-4` demek onları Mimari ilkeler'in 4. maddesiyle çarpıştırır
 * (ölçüldü) ve kodda `md. 4` yazan yorum iki ayrı yere birden gider.
 */
export const PROSEDUR_BOLUMLER = ["Yeni bir hesap eklerken"];

export const ALANLAR: Alan[] = [
  {
    dosya: "hesap",
    onek: "HESAP",
    baslik: "Hesap motoru ve modüller",
    ozet: "Hesap motoru, modüller, revizyon snapshot'ı, vinç topolojisi, kesitler, birimler",
    varsayilan: true,
    yollar: [
      "src/lib/calc/**",
      "src/lib/standards/**",
      "src/lib/diagrams/**",
      "src/lib/revision-*.ts",
      "src/lib/crane-types.ts",
      "src/app/(app)/projects/**",
    ],
    al: [
      "Mimari ilkeler|hesap motoru saftır",
      "Mimari ilkeler|4 değer rolü",
      "Mimari ilkeler|semantik anahtarlar",
      "Mimari ilkeler|kontrol tipolojisi",
      "Mimari ilkeler|ortak hesap kütüphaneleri",
      "Mimari ilkeler|alan öbekleri",
      "Mimari ilkeler|standart referansları tıklanabilir",
      "Mimari ilkeler|revizyon = snapshot",
      "Mimari ilkeler|vinç topolojisi",
      "Mimari ilkeler|köprü iki ya da dört kirişli",
      "Mimari ilkeler|ana kirişte ray altına t profil",
      "Mimari ilkeler|kaldırma kirişi x · y · z",
      "Mimari ilkeler|kanca tanımı bir seçimdir",
      "Mimari ilkeler|ağırlıklar teknik özelliktir",
      "Mimari ilkeler|otomatik girdiler",
      "Mimari ilkeler|teker yükleri yol kirişinin",
      "Mimari ilkeler|buruşma ana kirişin bir kontrolüdür",
      "Mimari ilkeler|feston bir katalog ürünüdür",
      "Mimari ilkeler|kabin ve elektrik odası kendi bölümüdür",
      "Mimari ilkeler|mahal iklimlendirme yükü hesaplanır",
      "Yeni bir hesap eklerken",
      "Birimler",
    ],
  },
  {
    dosya: "katalog",
    onek: "KATALOG",
    baslik: "Üretici katalogları ve katalog sayfaları",
    ozet: "Katalog ürünü ↔ kullanım grubu, katalog sayfası defteri, ek belge (mühendisin kendi yaprağı)",
    yollar: [
      "src/lib/catalog-mapping.ts",
      "src/lib/catalog-sheets.ts",
      "src/lib/catalog-sheets/**",
      "src/lib/equipment-attachments.ts",
      "src/app/(app)/katalog/**",
      "src/app/api/catalog-sheet/**",
      "src/components/catalog-*.tsx",
      "scripts/catalog-sheets.py",
      "scripts/seed-catalog.ts",
    ],
    al: [
      "Mimari ilkeler|katalog ürünü kullanım grubuna bağlıdır",
      'Mimari ilkeler|"ek belge" mühendisin kendi katalog',
    ],
  },
  {
    dosya: "satinalma",
    onek: "SATIN",
    baslik: "Satın Alma",
    ozet: "Talep havuzu (ekipman), teklif/sipariş/teslim, fiyat arşivi, sarf gideri, KDV, tedarikçi defteri",
    yollar: [
      "src/lib/purchasing/*.ts",
      "src/app/(app)/purchasing/*.ts",
      "src/app/(app)/purchasing/*.tsx",
      "src/app/(app)/purchasing/siparisler/**",
      "src/app/(app)/purchasing/teslimat/**",
      "src/app/(app)/purchasing/fiyatlar/**",
      "src/app/(app)/purchasing/sarf/**",
      "src/app/(app)/purchasing/export/**",
      "src/app/(app)/admin/suppliers/**",
      "src/app/(app)/admin/consumables/**",
    ],
    al: ["Mimari ilkeler|satın alma paketin üstünde bir katmandır"],
  },
  {
    dosya: "hammadde",
    onek: "HAM",
    baslik: "Hammadde Havuzu",
    ozet: "Ayıklama dilbilgisi, beş sınıf, sac plaka yerleşimi, teklif partisi/talebi, alım analizi",
    yollar: [
      "src/lib/purchasing/hammadde/**",
      "src/app/(app)/purchasing/hammadde/**",
      "src/lib/pdf/nesting-plan.tsx",
      "src/lib/diagrams/nesting.ts",
      "scripts/gen-profile-sections.py",
      "scripts/test-hammadde*.ts",
      "scripts/test-alim-analizi.ts",
    ],
    al: ["Mimari ilkeler|hammadde havuzu ekipman havuzunun"],
  },
  {
    dosya: "personel",
    onek: "PERSONEL",
    baslik: "Personel",
    ozet: "Dönemli kayıt, fazla mesai, ücret planı, bordro, özlük dosyası, döviz kuru",
    yollar: [
      "src/lib/personnel/**",
      "src/lib/fx/**",
      "src/app/(app)/personnel/**",
      "src/app/api/cron/fx/**",
      "scripts/test-payroll-docs.ts",
      "scripts/test-fx-source.ts",
    ],
    al: ["Mimari ilkeler|personel: kişi bir satır değil"],
  },
  {
    dosya: "resimler",
    onek: "RESIM",
    baslik: "Teknik Resimler",
    ozet: "Paket yükleme ve tanıma, hoşgörü ilkeleri, defter/ilerleme, Teknik Resim Takibi planı",
    yollar: [
      "src/lib/drawings/**",
      "src/lib/drawing-plan.ts",
      "src/lib/drawing-plan-data.ts",
      "src/lib/drawings.ts",
      "src/app/(app)/drawings/**",
      "scripts/test-drawings*.ts",
      "scripts/test-normalize.ts",
    ],
    al: [
      "Mimari ilkeler|teknik resimler hoşgörülü anlar",
      "Mimari ilkeler|teknik resim takibi plandır",
    ],
  },
  {
    dosya: "isler",
    onek: "IS",
    baslik: "İşler ve iş kalemleri",
    ozet: "İş emri → kalem → rapor bağı, doküman no, BÜYÜK HARF kuralı, müşteri defteri, İşler hub'ı",
    yollar: [
      "src/lib/jobs/**",
      "src/lib/job-items.ts",
      "src/lib/job-status.ts",
      "src/lib/tags.ts",
      "src/app/(app)/jobs/**",
      "src/app/(app)/admin/customers/**",
      "src/components/command-palette.tsx",
      "src/lib/panel-index.ts",
    ],
    al: [
      "Mimari ilkeler|hesap raporu işe değil iş kalemine",
      "Mimari ilkeler|işler bir hub'dır",
    ],
  },
  {
    dosya: "teklif",
    onek: "TEKLIF",
    baslik: "Teklif",
    ozet: "Teklif numarası, revizyon snapshot'ı, gizleme, defter (offer_options), takip sayacı, analiz",
    yollar: [
      "src/lib/offers/**",
      "src/app/(app)/offers/**",
      "src/lib/pdf/offer.tsx",
      "scripts/gen-offer-seed.ts",
      "scripts/test-offer-pdf.ts",
    ],
    // Kök `AGENTS.md`te taşınacak bir bloğu YOK: bölüm alan dosyası düzenine
    // GEÇTİKTEN SONRA açıldı, yani kuralları hiç kökte yaşamadı.
    al: [],
  },
  {
    // MALİYET TEKLİFİN ALTINDA DEĞİL, YANINDA bir alandır. `teklif.md`e
    // eklenseydi o dosya ikiye katlanır ve her oturumda teklife dokunan
    // herkes ağırlık modelini de yüklerdi; ayrıca iki alanın en pahalı
    // hataları BİRBİRİNİN TERSİDİR (teklifte "gizlenen satır belgeye
    // girmesin", maliyette "maliyet müşteri belgesine hiç girmesin") ve
    // aynı dosyada yan yana durmaları ikisini de bulanıklaştırırdı.
    dosya: "maliyet",
    onek: "MALIYET",
    baslik: "Maliyet Çalışması",
    ozet: "Ayrı revizyon zinciri, ağırlık/boyutlandırma modeli, dört ana başlık, oran tabanı, iç belge",
    yollar: [
      "src/lib/offers/cost/**",
      "src/app/(app)/offers/cost-*.ts",
      "src/app/(app)/offers/[id]/costs/**",
      "src/app/(app)/offers/[id]/cost-panel.tsx",
      "src/lib/pdf/offer-cost.tsx",
      // EXCEL ÇIKTISI DA BU ALANDADIR: PDF ile aynı `costOverview`i okur ve
      // ikisinin ayrışması MALIYET-24'ün yasakladığı şeydir — biri kural
      // dosyasının kapsamında, öteki dışında olsaydı ayrışma davet edilirdi.
      "src/lib/xlsx/offer-cost.ts",
      "scripts/test-offer-cost-pdf.ts",
      "scripts/test-offer-cost-excel.ts",
    ],
    al: [],
  },
  {
    dosya: "satis",
    onek: "SATIS",
    baslik: "Satış Takibi",
    ozet: "job_item_sales, kur satırda donar, fiyatsız Güncel İş Listesi",
    yollar: ["src/app/(app)/sales/**", "src/lib/pdf/job-list.tsx"],
    al: ["Mimari ilkeler|satış takibi iş kalemine bağlanır"],
  },
  {
    dosya: "worklog",
    onek: "WORKLOG",
    baslik: "İş Takibi",
    ozet: "GÜN × KALEM × PARÇA × TÜR çizelgesi, parça/tür defteri, ortak süzgeç tanımı",
    yollar: ["src/lib/work-log.ts", "src/app/(app)/worklog/**"],
    al: ["Mimari ilkeler|iş takibi bir gün × kalem"],
  },
  {
    dosya: "panel",
    onek: "PANEL",
    baslik: "Açılış Panosu",
    ozet: "Kök adres, LANDING_PATH, arama (trKatla), sinyal süzgeci, yaklaşan şeridi",
    yollar: [
      "src/lib/panel.ts",
      "src/app/(app)/panel/**",
      "src/app/(app)/page.tsx",
    ],
    al: ["Mimari ilkeler|açılış panosu giriş sonrası ilk ekrandır"],
  },
  {
    dosya: "roller",
    onek: "ROL",
    baslik: "Roller ve yetki",
    ozet: "Sekiz rol, yetki SORUSU (liste değil), RLS, WORKSPACE_SECTIONS, yetki ızgarası",
    yollar: [
      "src/lib/roles.ts",
      "src/proxy.ts",
      "src/app/(app)/admin/**",
      "src/app/(auth)/**",
      "supabase/migrations/**",
    ],
    al: ["Mimari ilkeler|roller yetki sorusuyla sorulur"],
  },
  {
    dosya: "arayuz",
    onek: "MOBIL",
    baslik: "Dokunmatik ve dar ekran",
    ozet: "44px hedef, dvh, pencere kelepçesi, sütun önceliklendirme, telefonda tablo katlama",
    yollar: [
      "src/components/**",
      "src/app/globals.css",
      "src/app/(app)/layout.tsx",
    ],
    al: ["Dokunmatik ve dar ekran ilkeleri"],
  },
  {
    dosya: "belge",
    onek: "BELGE",
    baslik: "Belge kimliği, PDF ve Excel",
    ozet: "BrandBand/CompanyBlock, doküman kimliği, vinç plakası ve güvenli müşteri portalı",
    yollar: [
      "src/lib/pdf/**",
      "src/lib/excel/**",
      "src/lib/product-portal/**",
      "src/components/customer-portal/**",
      "src/app/(app)/projects/[id]/product-portal/**",
      // `paylas/vinc/**` DİYE BİR DİZİN YOKTUR — bu işaretçi ölü bir yolu
      // gösteriyordu ve gerçek portal kodu hiçbir kural dosyasının kapsamında
      // değildi. Vinç portalının HTML ve işlem yüzleri Vercel fonksiyon bütçesi
      // yüzünden mevcut teknik-resim paylaşım fonksiyonunda çalışır (rewrite).
      "src/app/(public)/paylas/resim/**",
      "scripts/check-pdf-layout.py",
    ],
    al: ["Belge kimliği ve dosya adı"],
  },
  {
    dosya: "elektrik",
    onek: "ELEKTRIK",
    baslik: "Elektrik Projesi",
    ozet: "EPLAN PDF'inin arşivi ve okunması: malzeme listesi, sayfa dizini, künye, panel dökümü",
    yollar: [
      "src/lib/electrical/**",
      "src/app/(app)/projects/[id]/electrical/**",
      "scripts/test-electrical-read.ts",
    ],
    al: ["Elektrik Projesi"],
  },
  {
    dosya: "elkitabi",
    onek: "KITAP",
    baslik: "İşletme ve Bakım El Kitabı",
    ozet: "Bölüm ağacı, standart metin, gizleme, otomatik tablolar, ekler ve iki çıktı",
    yollar: [
      "src/lib/manual/**",
      "src/lib/pdf/manual.tsx",
      "src/app/(app)/projects/[id]/manual/**",
      "scripts/test-manual-pdf.ts",
    ],
    al: ["İşletme ve Bakım El Kitabı"],
  },
  {
    dosya: "komutlar",
    onek: "",
    baslik: "Komutlar ve duman testleri",
    ozet: "Bütün npm/tsx/python betikleri ve ne sınadıkları",
    yollar: [],
    al: ["Komutlar"],
  },
  {
    dosya: "dizin",
    onek: "",
    baslik: "Dizin haritası",
    ozet: "Hangi kavram hangi dosyada — dosya dosya tarif",
    yollar: [],
    al: ["Dizin haritası"],
  },
];
