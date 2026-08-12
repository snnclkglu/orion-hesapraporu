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
  canEditFinance,
  canEditReports,
  canSeeFinance,
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

  it("finans Yönetici ve Müdürde", () => {
    // Kullanıcı kararı (11.08.2026): "Finans bölümü Admin yönetici ve
    // müdürlere açık olsun." Küme satış ve iş takibiyle AYNIdır ama soru
    // ayrıdır: personel özlük dosyası ile ciro rakamı farklı iki bilgidir ve
    // biri açılırken öbürü kapalı kalabilmelidir.
    expect(evetDiyenler(canSeeFinance)).toEqual(["admin", "manager"]);
  });

  it("finans yazma bugün görmeyle aynı kümededir ama AYRI bir sorudur", () => {
    for (const r of USER_ROLES) expect(canEditFinance(r)).toBe(canSeeFinance(r));
  });

  it("mühendis ve teknik ressam personel/maaş verisini GÖRMEZ", () => {
    // Kişisel veri (TC kimlik no, IBAN, sağlık raporu) bu iki rolde yoktur.
    expect(canSeeFinance("engineer")).toBe(false);
    expect(canSeeFinance("draftsman")).toBe(false);
    expect(canEditFinance("engineer")).toBe(false);
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

// ═══════════════════════════════════════════ GÖREV ETİKETLERİ (11.08.2026)
//
// Etiket rolün YERİNE geçmez, YANINA gelir. Aşağıdaki testler o sözü
// dondurur: bir etiket eklemek hiçbir mevcut yetkiyi DEĞİŞTİRMEMELİDİR.

describe("görev etiketleri", () => {
  const { USER_TAGS, canSeePurchasing, canEditPurchasing, hasTag, tagsOf } = rolesModule;

  it("etiket YALNIZ KAPI AÇAR, hiçbirini kapatmaz", () => {
    const rolsuz = { role: "engineer", tags: [] as string[] };
    const etiketli = { role: "engineer", tags: ["satinalma"] };
    // Etiketten önce ve sonra DİĞER yetkiler aynı kalır.
    for (const y of [rolsuz, etiketli]) {
      expect(canEditReports(y.role)).toBe(true);
      expect(canSeeSales(y.role)).toBe(false);
      expect(isAdminRole(y.role)).toBe(false);
    }
    // Değişen tek şey satın almadır.
    expect(canSeePurchasing(rolsuz)).toBe(false);
    expect(canSeePurchasing(etiketli)).toBe(true);
  });

  it("Satın Alma: Yönetici + «satinalma» + «planlama» — MÜDÜR DEĞİL", () => {
    // Kullanıcı kararı: "Yönetici Admin Satın Alma ve Planlama bölümlerine
    // açık olsun." Müdür listede YOKTUR ve bu bir gözden kaçma değildir.
    expect(canSeePurchasing({ role: "admin", tags: [] })).toBe(true);
    expect(canSeePurchasing({ role: "manager", tags: [] })).toBe(false);
    expect(canSeePurchasing({ role: "engineer", tags: ["satinalma"] })).toBe(true);
    expect(canSeePurchasing({ role: "manager", tags: ["planlama"] })).toBe(true);
    expect(canSeePurchasing({ role: "draftsman", tags: ["uretim"] })).toBe(false);
  });

  it("yazma bugün görmeyle aynı kümedir ama AYRI bir sorudur", () => {
    for (const y of [
      { role: "admin", tags: [] },
      { role: "engineer", tags: ["satinalma"] },
      { role: "draftsman", tags: [] },
    ]) {
      expect(canEditPurchasing(y)).toBe(canSeePurchasing(y));
    }
  });

  it("tagsOf bilinmeyeni düşürür ve SIRAYI sabitler", () => {
    expect(tagsOf(["uretim", "satinalma", "yok"])).toEqual(["satinalma", "uretim"]);
    expect(tagsOf(null)).toEqual([]);
    expect(tagsOf(undefined)).toEqual([]);
  });

  it("etiket kümesi dondurulmuştur", () => {
    expect([...USER_TAGS]).toEqual(["satinalma", "planlama", "uretim"]);
  });

  it("hasTag boş listede yetki vermez", () => {
    expect(hasTag({ role: "admin", tags: [] }, "satinalma")).toBe(false);
  });
});

describe("WORKSPACE_SECTIONS — menü ile yetki matrisi TEK KAYNAK", () => {
  const { WORKSPACE_SECTIONS, visibleSections } = rolesModule;

  it("her bölümün insan okunur bir yetki özeti vardır", () => {
    // Matris `kime` alanını basar; boş bırakılan bir bölüm ekranda "—" olur
    // ve kullanıcı yetkiyi hiç öğrenemez.
    for (const s of WORKSPACE_SECTIONS) {
      expect(s.kime.trim(), `${s.href} için 'kime' boş`).not.toBe("");
      expect(s.hint.trim(), `${s.href} için 'hint' boş`).not.toBe("");
    }
  });

  it("Yönetici bütün bölümleri görür", () => {
    expect(visibleSections({ role: "admin", tags: [] })).toHaveLength(
      WORKSPACE_SECTIONS.length
    );
  });

  it("Teknik Ressam satış, iş takibi, satın alma, finans ve yönetimi GÖRMEZ", () => {
    const gorunen = visibleSections({ role: "draftsman", tags: [] }).map((s) => s.href);
    expect(gorunen).toContain("/drawings");
    expect(gorunen).toContain("/jobs");
    expect(gorunen).not.toContain("/sales");
    expect(gorunen).not.toContain("/worklog");
    expect(gorunen).not.toContain("/purchasing");
    expect(gorunen).not.toContain("/finance");
    expect(gorunen).not.toContain("/admin");
  });

  it("Müdür finansı görür, Mühendis görmez", () => {
    expect(visibleSections({ role: "manager", tags: [] }).map((s) => s.href)).toContain(
      "/finance"
    );
    expect(visibleSections({ role: "engineer", tags: [] }).map((s) => s.href)).not.toContain(
      "/finance"
    );
  });

  it("her bölümün ikonu ikon defterinde VARDIR", async () => {
    // `WorkspaceSection.icon` `string` tipindedir ve `app-shell.tsx`te
    // `as BrandIconName` ile cast edilir: yanlış yazılmış bir ikon adı
    // derlemeyi GEÇER ve menüde boş bir <svg> çizilir. Bağı ancak bir test
    // koruyabilir.
    const { BrandIconNames } = await import("@/components/brand-icon");
    for (const s of WORKSPACE_SECTIONS) {
      expect(BrandIconNames, `${s.href} ikonu (${s.icon}) defterde yok`).toContain(s.icon);
    }
  });

  it("«satinalma» etiketi YALNIZ Satın Alma'yı ekler", () => {
    const once = visibleSections({ role: "draftsman", tags: [] }).map((s) => s.href);
    const sonra = visibleSections({ role: "draftsman", tags: ["satinalma"] }).map((s) => s.href);
    expect(sonra).toEqual([...once, "/purchasing"].sort((a, b) =>
      WORKSPACE_SECTIONS.findIndex((s) => s.href === a) -
      WORKSPACE_SECTIONS.findIndex((s) => s.href === b)
    ));
  });
});
