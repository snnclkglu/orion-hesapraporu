// Kullanıcı rolleri — etiketler ve yetki soruları tek yerde.
//
// Roller HİYERARŞİ DEĞİLDİR: her yetki kendi sorusuyla sorulur (`isAdmin`,
// `canSeeSales`). Böylece "müdür yöneticinin yapabildiği her şeyi yapar" gibi
// sessiz bir varsayım oluşmaz; satış rakamlarını müdür görür ama katalog ve
// kullanıcı yönetimine giremez.
//
// Veritabanı karşılığı `public.user_role` enum'udur; RLS tarafında `is_admin()`,
// `can_see_sales()` ve `can_edit_reports()` fonksiyonları aynı ayrımı uygular
// (arayüzdeki gizleme tek başına yeterli değildir).
//
// ═══════════════════════════════════ GÖREV ETİKETLERİ KALDIRILDI (12.08.2026)
//
// Satın Alma · Planlama · Üretim bir süre `profiles.tags` altında ÇOK DEĞERLİ
// görev etiketleriydi; gerekçesi "bir kişi hem Müdür hem Planlama olabilir" idi.
// KULLANICI KARARI bunu tersine çevirdi: *"Satın Alma, Planlama ve Üretim'i
// görev etiketi olarak değil direkt Rol olarak eklemek istiyorum. Görev
// etiketine gerek yok."* — ve aynı turda dördüncüsü eklendi: *"Hatta Kalite de
// olsun toplam 4 olsun."*
//
// KALİTE VE ÜRETİM BUGÜN EK BİR KAPI AÇMAZ. İkisi de herkese açık bölümleri
// (İşler · Mühendislik · Teknik Resimler) görür ve başka hiçbir şeyi. Bu bir
// eksiklik değil bir KURALDIR: bir rol açılırken ona ne verileceği ayrı bir
// karardır ve sessizce genişletilmez — `uretim` etiketi de tam olarak bu
// tanımla açılmıştı. Kalite'ye ileride kendi ekranı gerektiğinde soru
// `canSeeQuality` olarak buraya tek satırla eklenir.
//
// Bedeli bilerek kabul edilmiştir ve burada yazılıdır: rol TEK DEĞERLİdir, yani
// Planlama rolündeki bir kişi aynı anda Müdür OLAMAZ — satış takibini, iş
// takibini ve personel bölümünü göremez. İki kimlik gerekiyorsa karar
// kullanıcınındır: kişi hangi rolde duracaksa o role alınır. Etiket mekanizması
// (`profiles.tags`, `has_tag()`) hem koddan hem veritabanından KALDIRILDI —
// yanında bırakılsaydı aynı yetki iki ayrı yerden sorulabilir hâle gelirdi.

export const USER_ROLES = [
  "admin",
  "manager",
  "engineer",
  "draftsman",
  "purchasing",
  "planning",
  "quality",
  "production",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: "Yönetici",
  manager: "Müdür",
  engineer: "Mühendis",
  draftsman: "Teknik Ressam",
  purchasing: "Satın Alma",
  planning: "Planlama",
  quality: "Kalite",
  production: "Üretim",
};

/** Rolün ne yapabildiğini kullanıcıya bir cümleyle anlatan açıklama. */
export const USER_ROLE_HINTS: Record<UserRole, string> = {
  admin: "Tüm yetkiler: yönetim paneli, kullanıcılar, katalog ve satış.",
  manager: "Satış, iş takibi ve personel bölümlerini görür; yönetim paneline giremez.",
  engineer: "Hesap raporu ve iş emri; taslak revizyonu siler, satış rakamlarını göremez.",
  draftsman: "Teknik resim paketlerini yükler ve içe aktarır; satış rakamlarını göremez.",
  purchasing: "Satın Alma bölümünü görür ve düzenler: teklif, sipariş, teslim, ödeme.",
  planning: "Satın Alma bölümünü görür ve düzenler; iş sırasını planlar.",
  quality: "Kalite kontrol tarafındaki kişi; işler, mühendislik ve teknik resimleri görür.",
  production: "Üretim tarafındaki kişi; işler, mühendislik ve teknik resimleri görür.",
};

/**
 * Bilinmeyen/eski değeri güvenli role çevirir. Veritabanından gelen `role`
 * `string` tipindedir; enum'a sonradan değer eklenirse arayüz çökmemelidir.
 */
export function roleOf(value: string | null | undefined): UserRole {
  return (USER_ROLES as readonly string[]).includes(value ?? "")
    ? (value as UserRole)
    : "engineer";
}

export function roleLabel(value: string | null | undefined): string {
  return USER_ROLE_LABELS[roleOf(value)];
}

/** Yönetim paneli, kullanıcı ve katalog yönetimi, silme yetkileri. */
export function isAdminRole(value: string | null | undefined): boolean {
  return roleOf(value) === "admin";
}

/** Satış Takibi sayfası: fiyat, ciro ve kâr rakamları. */
export function canSeeSales(value: string | null | undefined): boolean {
  const r = roleOf(value);
  return r === "admin" || r === "manager";
}

/**
 * Hesap raporu yazan roller — TASLAK revizyon silme yetkisi buna bağlıdır.
 *
 * `isAdminRole` YETMEZ: revizyonu açan ve düzenleyen mühendistir, yanlış
 * açılmış bir taslağı temizlemek için yöneticiyi beklememelidir. Müdür ve
 * teknik ressam kapsam dışıdır; ikisi de hesap raporu yazmaz.
 *
 * YAYINLANMIŞ revizyonun silinemezliği bu soruyla İLGİSİZDİR ve veritabanındaki
 * `guard_issued_revision` tetikleyicisindedir: bu soru KİMİN, tetikleyici NEYİN
 * silinebileceğini söyler. Veritabanı karşılığı `can_edit_reports()`.
 */
export function canEditReports(value: string | null | undefined): boolean {
  const r = roleOf(value);
  return r === "admin" || r === "engineer";
}

/**
 * İş Takibi bölümü: atölye çalışma saatleri, adam·saat toplamları ve analizi.
 *
 * Bugün `canSeeSales` ile AYNI rol kümesini döndürür ama AYRI bir sorudur:
 * satış rakamı ile atölye verimliliği farklı iki bilgidir ve biri açılırken
 * öbürü kapalı kalabilmelidir. Tek satırlık bir kopya, ileride ikisini
 * ayırmak için bütün çağrı yerlerini gözden geçirme borcunu ortadan kaldırır.
 * Veritabanı karşılığı `can_see_work_log()`.
 */
export function canSeeWorkLog(value: string | null | undefined): boolean {
  const r = roleOf(value);
  return r === "admin" || r === "manager";
}

/**
 * PERSONEL bölümü: künye ve özlük dosyaları, maaş ve fazla mesai kayıtları,
 * bordro, harcirah tarifesi ve kurlar.
 *
 * BÖLÜMÜN ADI ÖNCE "FİNANS"TI (12.08.2026'da değişti). Kullanıcının gerekçesi:
 * "Finans'ta farklı şeyler yaparız; bu bölüm tamamen personelle ilgili oldu."
 * Yani `/finance` adresi ve `fin_` öneki ileride açılacak gerçek finans
 * bölümüne ayrıldı — ad yalnız ekranda değiştirilseydi o gün iki bölümün
 * tabloları birbirine karışırdı.
 *
 * Kullanıcı kararı (11.08.2026): "Admin yönetici ve müdürlere açık olsun."
 * Yani `canSeeSales`/`canSeeWorkLog` ile AYNI rol kümesi — ama yine AYRI bir
 * soru (o ikisinin gerekçesiyle birebir aynı: üç bölüm ileride ayrışabilir ve
 * o gün tek satır değişmesi yeter).
 *
 * Bu bölüm diğerlerinden BİR AÇIDAN FARKLIDIR ve fark yetki tanımını değil
 * yaklaşımı belirler: burada KİŞİSEL VERİ vardır (TC kimlik no, doğum tarihi,
 * IBAN, sağlık raporu). Menüden gizlemek her zamanki gibi yalnız görgü
 * kuralıdır; asıl engel RLS'tir ve BURADA DEPO POLİTİKASI DA aynı soruyu
 * sorar (`personnel` bucket'ı `drawings` düzeyindedir, gevşek değil) —
 * imzalı bağlantı uygulama katmanındaki rolü taşımaz, bir özlük dosyasında
 * bu fark gerçek bir sızıntı demektir.
 *
 * Veritabanı karşılığı `can_see_personnel()`.
 */
export function canSeePersonnel(value: string | null | undefined): boolean {
  const r = roleOf(value);
  return r === "admin" || r === "manager";
}

/**
 * Personel kaydı YAZMA yetkisi — personel açma/kapatma, maaş girme, belge
 * yükleme, kur tazeleme.
 *
 * Bugün GÖRME ile aynı kümedir ama AYRI bir sorudur (`canEditPurchasing` ile
 * aynı gerekçe): "müdür görür, yalnız yönetici yazar" ayrımı istenirse bütün
 * çağrı yerlerini gözden geçirme borcu doğmasın.
 *
 * Veritabanı karşılığı `can_edit_personnel()`.
 */
export function canEditPersonnel(value: string | null | undefined): boolean {
  return canSeePersonnel(value);
}

/**
 * Teknik Resimler bölümü: paket yükleme, yeniden eşleştirme, elle bağlama.
 *
 * GÖRME SORULMAZ ve bu bilinçlidir — teknik resim atölyenin ortak gerçeğidir;
 * hesabı yapan mühendis de, işi izleyen müdür de aynı resme bakar. Satış
 * rakamından farklı olarak gizlenecek bir yanı yoktur, RLS'te okuma `true`dur.
 * `canSeeDrawings` diye bir soru EKLEMEYİN; önce bu paragrafı çürütün.
 *
 * YAZMA üç roldedir ve bu küme uygulamadaki DİĞER KÜMELERİN HİÇBİRİNE eşit
 * değildir — sorunun ayrı sorulma sebebi budur:
 *   · Teknik Ressam paketi ÜRETEN kişidir (rolün tanımı zaten bu).
 *   · Mühendis yanlış kaleme düşmüş bir paketi düzeltip yeniden
 *     eşleştirebilmelidir; ressamı beklemek imalatı durdurur.
 *   · Müdür mühendislik ürünü yazmaz (satış rakamını görür, resmi çizmez).
 *
 * ÜRETİM ROLÜ DE BURADA YOKTUR (12.08.2026): rol etiketten devralındı ve
 * etiket "bugün ek bir kapı açmaz" diye tanımlıydı. Atölyenin üretim tahtasına
 * yazması isteniyorsa bu ayrı bir karardır ve burada tek satırla verilir —
 * rol açılırken sessizce genişletilmez.
 *
 * PAKETİ SİLMEK bu soruya DÂHİL DEĞİLDİR: silme 450'yi aşkın depo nesnesini
 * birlikte götürür ve yalnız Yöneticidedir (`is_admin()`), tıpkı projeyi
 * silmek gibi. Veritabanı karşılığı `can_edit_drawings()`.
 */
export function canEditDrawings(value: string | null | undefined): boolean {
  const r = roleOf(value);
  return r === "admin" || r === "engineer" || r === "draftsman";
}

/**
 * Satın Alma bölümü: talep havuzu, teklifler, siparişler, teslim ve ödeme
 * takvimi, fiyat arşivi.
 *
 * Kullanıcı kararı (11.08.2026): "Yönetici, Satın Alma ve Planlama". Küme
 * 12.08.2026'da ETİKETTEN ROLE taşındı ama DEĞİŞMEDİ — müdür burada hâlâ
 * yoktur ve bu bir gözden kaçma değildir: müdür satış rakamını görür, satın
 * alma ise tedarikçi fiyatı ve ödeme vadesi taşır; ikisi ayrı bilgidir.
 *
 * Veritabanı karşılığı `can_see_purchasing()`; menüden gizlemek yalnız görgü
 * kuralıdır, asıl engel RLS'tir.
 */
export function canSeePurchasing(value: string | null | undefined): boolean {
  const r = roleOf(value);
  return r === "admin" || r === "purchasing" || r === "planning";
}

/**
 * Satın alma kaydı YAZMA yetkisi.
 *
 * Bugün GÖRME ile aynı kümedir ama AYRI bir sorudur (`canSeeWorkLog` ile aynı
 * gerekçe): ileride "planlama görür, yalnız satınalma yazar" ayrımı istenirse
 * bütün çağrı yerlerini gözden geçirme borcu doğmasın.
 */
export function canEditPurchasing(value: string | null | undefined): boolean {
  return canSeePurchasing(value);
}

/**
 * TEKNİK RESMİ ÇİZEBİLECEK roller — Teknik Resim Takibi'ndeki "Çizen"
 * seçicisinin listesi (kullanıcı kararı, 12.08.2026: *"Ressam ve Mühendis
 * rolündekiler listelensin. Önce ressamlar."*).
 *
 * SIRA ANLAMLIDIR ve bu yüzden bir dizi döner, bir küme değil: seçici listeyi
 * bu sırada basar. Ressam işin ASIL sahibidir; mühendis çizim yaptığında
 * istisnadır ve listenin altında durur. Yönetici bilinçli olarak YOKTUR —
 * yönetici bir yetki düzeyidir, bir çizim masası değil; gerçekten çizen bir
 * yönetici varsa ona Mühendis ya da Teknik Ressam rolü verilir.
 */
export const DRAWING_AUTHOR_ROLES: readonly UserRole[] = ["draftsman", "engineer"];

export function canBeDrawingAuthor(value: string | null | undefined): boolean {
  return (DRAWING_AUTHOR_ROLES as readonly string[]).includes(roleOf(value));
}

// ——————————————————————————————————————————————————————— ÇALIŞMA ALANI

/**
 * ÇALIŞMA ALANI BÖLÜMLERİ — sol menünün ve yetki matrisinin TEK KAYNAĞI.
 *
 * Daha önce menü listesi `app-shell.tsx`in içindeydi ve "hangi bölüm kime
 * açık" sorusunun cevabı hiçbir yerde YAZILI DEĞİLDİ; kullanıcı bunu bir ekran
 * olarak istedi (md. 4). İki liste yazılsaydı biri er geç ötekinden ayrışır ve
 * matris, menünün gerçekte yaptığından başka bir şey anlatırdı — bu, yetki
 * ekranında olabilecek en kötü hatadır.
 *
 * `visible` bir ROL LİSTESİ DEĞİL bir SORUDUR: yetkinin tanımı yukarıdaki
 * fonksiyonlarda tek yerde durur, menü de matris de RLS de aynı kaynağı okur.
 * `kime` yalnız o sorunun İNSAN OKUNUR özetidir ve matriste basılır.
 *
 * `kime`/`yazma` metinlerinde FONKSİYON ADI GEÇMEZ (kullanıcı bildirimi,
 * 12.08.2026: *"yetkiler sayfası biraz karmaşık, İngilizce terimler var"*).
 * Yetki ekranını okuyan kişi yönetici, mühendis ya da müdürdür — kodun iç
 * adları ona hiçbir şey anlatmaz, yalnız ekranı okunmaz yapar.
 */
export interface WorkspaceSection {
  href: string;
  label: string;
  /** `BrandIconName` — tip bağı `app-shell.tsx`te kurulur (ikon defteri orada). */
  icon: string;
  /** Bölümün ne işe yaradığı; matriste ve menü ipucunda görünür. */
  hint: string;
  /** Görünürlük SORUSU. Verilmeyen bölüm herkese açıktır. */
  visible?: (role: string) => boolean;
  /**
   * YAZMA SORUSU. Verilmeyen bölümde görebilen herkes yazabilir.
   *
   * Bir SORU olması `visible` ile aynı gerekçedendir: yetki ekranı bunu bir
   * metinden okuyamaz, HESAPLAMALIDIR. `yazma` alanı yalnız insan okunur
   * özettir ve ızgarada ipucu olarak durur; kararı bu fonksiyon verir.
   */
  yazabilir?: (role: string) => boolean;
  /** Sorunun insan okunur özeti — sütun başlığının ipucunda görünür. */
  kime: string;
  /** Yazma yetkisinin özeti; görmekle yazmak ayrıştığında dolar. */
  yazma?: string;
}

/**
 * Bir rolün bir bölümdeki ERİŞİM DÜZEYİ — yetki ızgarasının tek hücresi.
 *
 * Üç değer, ikisi değil: "görür" ile "görür ve değiştirir" arasındaki fark bu
 * uygulamanın en sık sorulan sorusudur (mühendis teknik resmi yazar, müdür
 * yazmaz) ve tek bir ✓ onu gizlerdi.
 */
export type SectionAccess = "kapali" | "gorur" | "yazar";

export function sectionAccess(section: WorkspaceSection, role: string): SectionAccess {
  if (section.visible && !section.visible(role)) return "kapali";
  // Yazma sorusu OLMAYAN bölümde görebilen yazabilir — bugünkü davranışın
  // kendisi budur (`jobs`, `sales`, `worklog` politikaları yazmayı ayrıca
  // sormaz). Burada "bilinmiyor" diye bir üçüncü hâl uydurmak, ekranın
  // veriden fazlasını iddia etmesi olurdu.
  return !section.yazabilir || section.yazabilir(role) ? "yazar" : "gorur";
}

export const WORKSPACE_SECTIONS: WorkspaceSection[] = [
  // AÇILIŞ PANOSU LİSTENİN BAŞINDADIR ve adresi KÖKTÜR. Menüde ilk sırada
  // durması bir düzen tercihi değil bir gerçektir: giriş sonrası açılan
  // ekran odur ve "başa dön" bağlantısı da odur.
  {
    href: "/",
    label: "Panel",
    icon: "console",
    hint: "Arama, dikkat isteyenler ve yaklaşan tarihler",
    kime: "Herkes",
  },
  {
    href: "/jobs",
    label: "İşler",
    icon: "bolt",
    hint: "İş emirleri, iş kalemleri ve müşteri bilgileri",
    kime: "Herkes",
  },
  {
    href: "/projects",
    label: "Mühendislik",
    icon: "panel",
    hint: "Hesap raporu projeleri ve revizyon arşivi",
    kime: "Herkes",
    yazabilir: canEditReports,
    yazma: "Yönetici · Mühendis",
  },
  // Teknik Resimler'de `visible` YOKTUR ve bu bilinçlidir: teknik resim
  // atölyenin ortak gerçeğidir, bütün roller görür. Yazma yetkisi
  // `canEditDrawings` ile ekranın içinde sorulur.
  {
    href: "/drawings",
    label: "Teknik Resimler",
    icon: "blueprint",
    hint: "Teknik resim paketleri, parça defteri ve üretim tahtası",
    kime: "Herkes",
    yazabilir: canEditDrawings,
    yazma: "Yönetici · Mühendis · Teknik Ressam",
  },
  {
    href: "/purchasing",
    label: "Satın Alma",
    icon: "cart",
    hint: "Talep havuzu, teklifler, siparişler, teslim ve ödeme takvimi",
    visible: canSeePurchasing,
    yazabilir: canEditPurchasing,
    kime: "Yönetici · Satın Alma · Planlama",
    yazma: "Görebilenlerin tamamı",
  },
  {
    href: "/worklog",
    label: "İş Takibi",
    icon: "timesheet",
    hint: "Atölye çalışma saatleri ve adam·saat analizi",
    visible: canSeeWorkLog,
    kime: "Yönetici · Müdür",
  },
  {
    href: "/sales",
    label: "Satış Takibi",
    icon: "ledger",
    hint: "Sözleşme tutarları, ciro ve Güncel İş Listesi",
    visible: canSeeSales,
    kime: "Yönetici · Müdür",
  },
  {
    href: "/personnel",
    label: "Personel",
    icon: "wallet",
    hint: "Personel künyesi ve özlük dosyaları, maaş, bordro, harcirah ve kurlar",
    visible: canSeePersonnel,
    yazabilir: canEditPersonnel,
    kime: "Yönetici · Müdür",
    yazma: "Görebilenlerin tamamı",
  },
  {
    href: "/admin",
    label: "Yönetim",
    icon: "gauge",
    hint: "Kullanıcılar, yetkiler, kataloglar ve rapor ayarları",
    visible: isAdminRole,
    kime: "Yalnız Yönetici",
  },
];

/** Kullanıcının gerçekten görebildiği bölümler — menü ve matris bunu çağırır. */
export function visibleSections(role: string): WorkspaceSection[] {
  return WORKSPACE_SECTIONS.filter((s) => !s.visible || s.visible(role));
}
