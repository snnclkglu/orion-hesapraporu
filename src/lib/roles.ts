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

export const USER_ROLES = ["admin", "manager", "engineer", "draftsman"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: "Yönetici",
  manager: "Müdür",
  engineer: "Mühendis",
  draftsman: "Teknik Ressam",
};

/** Rolün ne yapabildiğini kullanıcıya bir cümleyle anlatan açıklama. */
export const USER_ROLE_HINTS: Record<UserRole, string> = {
  admin: "Tüm yetkiler: yönetim paneli, kullanıcılar, katalog ve satış.",
  manager: "Satış takibini görür ve düzenler; yönetim paneline giremez.",
  engineer: "Hesap raporu ve iş emri; taslak revizyonu siler, satış rakamlarını göremez.",
  draftsman: "Teknik resim paketlerini yükler ve içe aktarır; satış rakamlarını göremez.",
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
 * Teknik Resimler bölümü: paket yükleme, yeniden eşleştirme, elle bağlama.
 *
 * GÖRME SORULMAZ ve bu bilinçlidir — teknik resim atölyenin ortak gerçeğidir;
 * hesabı yapan mühendis de, işi izleyen müdür de aynı resme bakar. Satış
 * rakamından farklı olarak gizlenecek bir yanı yoktur, RLS'te okuma `true`dur.
 * `canSeeDrawings` diye bir soru EKLEMEYİN; önce bu paragrafı çürütün.
 *
 * YAZMA üç roldedir ve bu küme uygulamadaki DİĞER ÜÇ KÜMENİN HİÇBİRİNE eşit
 * değildir — sorunun ayrı sorulma sebebi budur:
 *   · Teknik Ressam paketi ÜRETEN kişidir (rolün tanımı zaten bu).
 *   · Mühendis yanlış kaleme düşmüş bir paketi düzeltip yeniden
 *     eşleştirebilmelidir; ressamı beklemek imalatı durdurur.
 *   · Müdür mühendislik ürünü yazmaz (satış rakamını görür, resmi çizmez).
 *
 * PAKETİ SİLMEK bu soruya DÂHİL DEĞİLDİR: silme 450'yi aşkın depo nesnesini
 * birlikte götürür ve yalnız Yöneticidedir (`is_admin()`), tıpkı projeyi
 * silmek gibi. Veritabanı karşılığı `can_edit_drawings()`.
 */
export function canEditDrawings(value: string | null | undefined): boolean {
  const r = roleOf(value);
  return r === "admin" || r === "engineer" || r === "draftsman";
}

// ————————————————————————————————————————————————————————————— ETİKETLER

/**
 * GÖREV ETİKETLERİ — rolün YERİNE geçmez, YANINA gelir.
 *
 * Rol kişinin uygulamadaki ana kimliğidir (mühendis, ressam, müdür) ve TEKTİR.
 * Etiket ise kişinin firmadaki İŞİDİR ve birden çok olabilir: üretim planlama
 * sorumlusu hem Müdür rolündedir hem Planlama işini yapar; satın almacı Mühendis
 * rolünde de olabilir Müdür rolünde de.
 *
 * Beşinci bir rol AÇILMADI ve bu bilinçli bir karardır. Rol tek değerlidir;
 * satınalmacıyı "Satın Alma" rolüne almak, o kişinin mühendis mi müdür mü
 * olduğunu SİLERDİ — Akif Ergüven'in hem Müdür (satış takibini görür) hem
 * Planlama (satın almayı görür) olması gerekiyor ve tek değerli bir alanda bu
 * ifade edilemez.
 *
 * Etiket YALNIZ KAPI AÇAR, kapatmaz: bir etiketi olmayan kimse bugünkü hiçbir
 * yetkisini kaybetmez. Yeni bir bölüm açılırken kural hep bu yönde kurulur.
 */
export const USER_TAGS = ["satinalma", "planlama", "uretim"] as const;

export type UserTag = (typeof USER_TAGS)[number];

export const USER_TAG_LABELS: Record<UserTag, string> = {
  satinalma: "Satın Alma",
  planlama: "Planlama",
  uretim: "Üretim",
};

export const USER_TAG_HINTS: Record<UserTag, string> = {
  satinalma: "Satın Alma bölümünü görür ve düzenler: teklif, sipariş, teslim, ödeme.",
  planlama: "Satın Alma bölümünü görür ve düzenler; iş sırasını planlar.",
  uretim: "Üretim tarafındaki kişi; bugün ek bir kapı açmaz.",
};

/**
 * Bilinmeyen değeri düşürerek etiket listesi üretir.
 *
 * Kaynak `text[]` bir sütundur ve `null` gelebilir; enum'a sonradan değer
 * eklenip sonra kaldırılırsa arayüz çökmemelidir (`roleOf` ile aynı gerekçe).
 * Sıra `USER_TAGS`in sırasına SABİTLENİR: aynı iki etiket iki kullanıcıda iki
 * ayrı düzende görünürse liste okunmaz.
 */
export function tagsOf(value: readonly string[] | null | undefined): UserTag[] {
  const küme = new Set(value ?? []);
  return USER_TAGS.filter((t) => küme.has(t));
}

export function tagLabel(value: string): string {
  return USER_TAG_LABELS[value as UserTag] ?? value;
}

/**
 * Bir kişinin yetki künyesi: rol + etiketler.
 *
 * Tek bir nesne olarak taşınır çünkü bölüm görünürlüğü artık İKİ alana birden
 * bakar ve her çağrı yerinde iki argüman taşımak, birini unutmayı kolaylaştırır
 * — unutulan argüman `undefined` olur ve kapı SESSİZCE kapanır.
 */
export interface Yetki {
  role: string;
  tags: readonly string[];
}

export function hasTag(y: Yetki, tag: UserTag): boolean {
  return (y.tags ?? []).includes(tag);
}

/**
 * Satın Alma bölümü: talep havuzu, teklifler, siparişler, teslim ve ödeme
 * takvimi, fiyat arşivi.
 *
 * Kullanıcı kararı (11.08.2026): "Yönetici, Satın Alma ve Planlama". Müdür
 * BURADA YOKTUR ve bu bir gözden kaçma değildir — müdür satış rakamını görür,
 * satın alma ise tedarikçi fiyatı ve ödeme vadesi taşır; ikisi ayrı bilgidir.
 * Müdürün girmesi gerekiyorsa ona `satinalma` etiketi verilir, kural
 * genişletilmez.
 *
 * Veritabanı karşılığı `can_see_purchasing()`; menüden gizlemek yalnız görgü
 * kuralıdır, asıl engel RLS'tir.
 */
export function canSeePurchasing(y: Yetki): boolean {
  return isAdminRole(y.role) || hasTag(y, "satinalma") || hasTag(y, "planlama");
}

/**
 * Satın alma kaydı YAZMA yetkisi.
 *
 * Bugün GÖRME ile aynı kümedir ama AYRI bir sorudur (`canSeeWorkLog` ile aynı
 * gerekçe): ileride "planlama görür, yalnız satınalma yazar" ayrımı istenirse
 * bütün çağrı yerlerini gözden geçirme borcu doğmasın.
 */
export function canEditPurchasing(y: Yetki): boolean {
  return canSeePurchasing(y);
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
 */
export interface WorkspaceSection {
  href: string;
  label: string;
  /** `BrandIconName` — tip bağı `app-shell.tsx`te kurulur (ikon defteri orada). */
  icon: string;
  /** Bölümün ne işe yaradığı; matriste ve menü ipucunda görünür. */
  hint: string;
  /** Görünürlük SORUSU. Verilmeyen bölüm herkese açıktır. */
  visible?: (y: Yetki) => boolean;
  /** Sorunun insan okunur özeti — matrisin "Kimler görür" sütunu. */
  kime: string;
  /** Yazma yetkisinin özeti; görmekle yazmak ayrıştığında dolar. */
  yazma?: string;
}

export const WORKSPACE_SECTIONS: WorkspaceSection[] = [
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
    yazma: "Yönetici · Mühendis (canEditReports)",
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
    yazma: "Yönetici · Mühendis · Teknik Ressam (canEditDrawings)",
  },
  {
    href: "/purchasing",
    label: "Satın Alma",
    icon: "cart",
    hint: "Talep havuzu, teklifler, siparişler, teslim ve ödeme takvimi",
    visible: canSeePurchasing,
    kime: "Yönetici · «Satın Alma» etiketi · «Planlama» etiketi",
    yazma: "Görenlerin tamamı (canEditPurchasing)",
  },
  {
    href: "/worklog",
    label: "İş Takibi",
    icon: "timesheet",
    hint: "Atölye çalışma saatleri ve adam·saat analizi",
    visible: (y) => canSeeWorkLog(y.role),
    kime: "Yönetici · Müdür",
  },
  {
    href: "/sales",
    label: "Satış Takibi",
    icon: "ledger",
    hint: "Sözleşme tutarları, ciro ve Güncel İş Listesi",
    visible: (y) => canSeeSales(y.role),
    kime: "Yönetici · Müdür",
  },
  {
    href: "/admin",
    label: "Yönetim",
    icon: "gauge",
    hint: "Kullanıcılar, yetkiler, kataloglar ve rapor ayarları",
    visible: (y) => isAdminRole(y.role),
    kime: "Yalnız Yönetici",
  },
];

/** Kullanıcının gerçekten görebildiği bölümler — menü ve matris bunu çağırır. */
export function visibleSections(y: Yetki): WorkspaceSection[] {
  return WORKSPACE_SECTIONS.filter((s) => !s.visible || s.visible(y));
}
