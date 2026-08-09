// Kullanıcı rolleri — etiketler ve yetki soruları tek yerde.
//
// Roller HİYERARŞİ DEĞİLDİR: her yetki kendi sorusuyla sorulur (`isAdmin`,
// `canSeeSales`). Böylece "müdür yöneticinin yapabildiği her şeyi yapar" gibi
// sessiz bir varsayım oluşmaz; satış rakamlarını müdür görür ama katalog ve
// kullanıcı yönetimine giremez.
//
// Veritabanı karşılığı `public.user_role` enum'udur; RLS tarafında `is_admin()`
// ve `can_see_sales()` fonksiyonları aynı ayrımı uygular (arayüzdeki gizleme
// tek başına yeterli değildir).

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
  engineer: "Hesap raporu ve iş emri; satış rakamlarını göremez.",
  draftsman: "Teknik çizim takibi; satış rakamlarını göremez.",
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
