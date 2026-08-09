// Rol yetki soruları — her soru AYRI cevaplanır, hiyerarşi yoktur.
//
// Bu testler rol kümelerini dondurur: bir yetkiyi genişletmek isteyen, hangi
// rollerin etkilendiğini burada görerek yapar. RLS karşılıkları
// `is_admin()` · `can_see_sales()` · `can_edit_reports()`; ekrandaki gizleme
// tek başına yeterli değildir, ikisi birlikte değişmelidir.

import { describe, expect, it } from "vitest";
import * as rolesModule from "../roles";
import {
  USER_ROLES,
  canEditDrawings,
  canEditReports,
  canSeeSales,
  canSeeWorkLog,
  isAdminRole,
  roleLabel,
  roleOf,
} from "../roles";

/** Sorunun "evet" dediği roller — küme olarak sabitlenir. */
const evetDiyenler = (soru: (v: string) => boolean) =>
  USER_ROLES.filter((r) => soru(r));

describe("yetki soruları", () => {
  it("yönetim paneli yalnız Yöneticide", () => {
    expect(evetDiyenler(isAdminRole)).toEqual(["admin"]);
  });

  it("satış rakamları Yönetici ve Müdürde", () => {
    expect(evetDiyenler(canSeeSales)).toEqual(["admin", "manager"]);
  });

  it("iş takibi Yönetici ve Müdürde", () => {
    expect(evetDiyenler(canSeeWorkLog)).toEqual(["admin", "manager"]);
  });

  it("hesap raporu yazma (taslak revizyon silme) Yönetici ve Mühendiste", () => {
    // Mühendis kendi açtığı taslağı temizleyebilmeli; müdür ve teknik ressam
    // hesap raporu yazmaz.
    expect(evetDiyenler(canEditReports)).toEqual(["admin", "engineer"]);
  });

  it("teknik resim yükleme Yönetici, Mühendis ve Teknik Ressamda", () => {
    // Ressam paketi üretir; mühendis yanlış kaleme düşmüş paketi düzeltmek
    // için ressamı beklememelidir. Bu küme diğer üçünün hiçbirine eşit değil.
    expect(evetDiyenler(canEditDrawings)).toEqual(["admin", "engineer", "draftsman"]);
  });

  it("teknik resim yetkisi Müdürde YOKTUR", () => {
    expect(canEditDrawings("manager")).toBe(false);
  });

  it("teknik resmi GÖRME sorusu yoktur — okuma herkese açıktır", () => {
    // Belge niteliğinde bir iddia: `canSeeDrawings` eklemek isteyen önce
    // `canEditDrawings` docblock'unu okur. Teknik resim atölyenin ortak
    // gerçeğidir; satış rakamı gibi gizlenecek bir yanı yoktur.
    expect(Object.keys(rolesModule).filter((k) => /^canSeeDrawings$/.test(k))).toEqual([]);
  });

  it("roller hiyerarşi DEĞİLDİR — müdür rapor yazamaz, mühendis satış görmez", () => {
    expect(canEditReports("manager")).toBe(false);
    expect(canSeeSales("engineer")).toBe(false);
    expect(isAdminRole("manager")).toBe(false);
    // Teknik ressam da hiyerarşinin altı değil: kendi işinde tam yetkili,
    // başkasının işinde hiç yetkisiz.
    expect(canEditDrawings("draftsman")).toBe(true);
    expect(canEditReports("draftsman")).toBe(false);
    expect(canSeeWorkLog("draftsman")).toBe(false);
  });
});

describe("roleOf", () => {
  it("bilinmeyen/boş değer güvenli role düşer", () => {
    // Enum'a sonradan değer eklenirse arayüz çökmemeli.
    expect(roleOf("bilinmeyen")).toBe("engineer");
    expect(roleOf(null)).toBe("engineer");
    expect(roleOf(undefined)).toBe("engineer");
  });

  it("bilinmeyen rol YÖNETİCİ sayılmaz", () => {
    // Güvenli düşüş yetki VERMEMELİ.
    expect(isAdminRole("bilinmeyen")).toBe(false);
    expect(canSeeSales(null)).toBe(false);
  });

  it("etiketler Türkçedir", () => {
    expect(roleLabel("admin")).toBe("Yönetici");
    expect(roleLabel("engineer")).toBe("Mühendis");
  });
});
