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
