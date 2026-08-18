// Rol yetki soruları — her soru AYRI cevaplanır, hiyerarşi yoktur.
//
// Bu testler rol kümelerini dondurur: bir yetkiyi genişletmek isteyen, hangi
// rollerin etkilendiğini burada görerek yapar. RLS karşılıkları
// `is_admin()` · `can_see_sales()` · `can_edit_reports()`; ekrandaki gizleme
// tek başına yeterli değildir, ikisi birlikte değişmelidir.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as rolesModule from "../roles";
import {
  DRAWING_AUTHOR_ROLES,
  LANDING_PATH,
  USER_ROLES,
  canBeDrawingAuthor,
  canEditConsumableExpenses,
  canEditDrawings,
  canEditOffers,
  canEditJobs,
  canEditPersonnel,
  canEditPurchasing,
  canEditReports,
  canSeeConsumableExpenses,
  canSeeOffers,
  canSeePersonnel,
  canSeePurchasing,
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

  it("İŞ EMRİ YAZMA Yönetici ve Müdürde — MÜHENDİS DEĞİL", () => {
    // Kullanıcı kararı (18.08.2026): İşler herkese açılırken yazma daraldı.
    // Mühendisin bu yetkiyi kaybetmesi açık bir karardır; hesap raporu yazma
    // yetkisi (`canEditReports`) ondan bağımsızdır ve mühendiste kalır.
    expect(evetDiyenler(canEditJobs)).toEqual(["admin", "manager"]);
    expect(canEditJobs("engineer")).toBe(false);
    expect(canEditReports("engineer")).toBe(true);
  });

  it("iş takibi Yönetici ve Müdürde", () => {
    expect(evetDiyenler(canSeeWorkLog)).toEqual(["admin", "manager"]);
  });

  it("personel bölümü Yönetici ve Müdürde", () => {
    // Kullanıcı kararı (11.08.2026): "Admin yönetici ve müdürlere açık
    // olsun." (Bölümün adı 12.08.2026'da Finans → Personel oldu.) Küme satış ve iş takibiyle AYNIdır ama soru
    // ayrıdır: personel özlük dosyası ile ciro rakamı farklı iki bilgidir ve
    // biri açılırken öbürü kapalı kalabilmelidir.
    expect(evetDiyenler(canSeePersonnel)).toEqual(["admin", "manager"]);
  });

  it("personel yazma bugün görmeyle aynı kümededir ama AYRI bir sorudur", () => {
    for (const r of USER_ROLES) expect(canEditPersonnel(r)).toBe(canSeePersonnel(r));
  });

  it("mühendis ve teknik ressam personel/maaş verisini GÖRMEZ", () => {
    // Kişisel veri (TC kimlik no, IBAN, sağlık raporu) bu iki rolde yoktur.
    expect(canSeePersonnel("engineer")).toBe(false);
    expect(canSeePersonnel("draftsman")).toBe(false);
    expect(canEditPersonnel("engineer")).toBe(false);
  });

  it("teklif bölümü Yönetici ve Müdürde — MÜHENDİS DEĞİL", () => {
    // Kullanıcı kararı (17.08.2026). Teklif MÜŞTERİ FİYATI taşır; mühendis
    // bugün satış rakamını da görmüyor ve aynı sınır burada korunur. Bölümü
    // mühendise açmak AYRI bir karardır ve bu satırın değişmesiyle olur.
    expect(evetDiyenler(canSeeOffers)).toEqual(["admin", "manager"]);
    expect(canSeeOffers("engineer")).toBe(false);
  });

  it("teklif yazma bugün görmeyle aynı kümededir ama AYRI bir sorudur", () => {
    expect(evetDiyenler(canEditOffers)).toEqual(evetDiyenler(canSeeOffers));
  });

  it("hesap raporu yazma (taslak revizyon silme) Yönetici ve Mühendiste", () => {
    // Mühendis kendi açtığı taslağı temizleyebilmeli; müdür ve teknik ressam
    // hesap raporu yazmaz.
    expect(evetDiyenler(canEditReports)).toEqual(["admin", "engineer"]);
  });

  it("teknik resim yükleme Yönetici, Mühendis ve Teknik Ressamda", () => {
    // Ressam paketi üretir; mühendis yanlış kaleme düşmüş paketi düzeltmek
    // için ressamı beklememelidir. Bu küme diğerlerinin hiçbirine eşit değil.
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
    expect(canSeePurchasing("bilinmeyen")).toBe(false);
  });

  it("etiketler Türkçedir", () => {
    expect(roleLabel("admin")).toBe("Yönetici");
    expect(roleLabel("engineer")).toBe("Mühendis");
    expect(roleLabel("purchasing")).toBe("Satın Alma");
    expect(roleLabel("planning")).toBe("Planlama");
    expect(roleLabel("quality")).toBe("Kalite");
    expect(roleLabel("production")).toBe("Üretim");
  });
});

// ═════════════════════════ SATIN ALMA · PLANLAMA · ÜRETİM ROLLERİ (12.08.2026)
//
// Bu üçü bir gün önce ÇOK DEĞERLİ görev etiketleriydi (`profiles.tags`) ve
// kullanıcı kararıyla ROL oldu: *"görev etiketi olarak değil direkt Rol olarak
// … görev etiketine gerek yok."* Aşağıdaki testler iki şeyi birden dondurur:
// (a) kümenin kendisi taşınırken DEĞİŞMEDİ, (b) etiket mekanizması gerçekten
// kalktı — yarısı kalmış bir geçiş, aynı yetkinin iki yerden sorulması demek
// olurdu.

describe("satın alma rolleri", () => {
  it("Satın Alma: Yönetici · Satın Alma · Planlama — MÜDÜR DEĞİL", () => {
    // Küme etiket döneminden AYNEN devralındı. Müdür listede YOKTUR ve bu bir
    // gözden kaçma değildir: müdür satış rakamını görür, satın alma tedarikçi
    // fiyatı ve ödeme vadesi taşır.
    expect(evetDiyenler(canSeePurchasing)).toEqual(["admin", "purchasing", "planning"]);
  });

  it("yazma bugün görmeyle aynı kümedir ama AYRI bir sorudur", () => {
    for (const r of USER_ROLES) expect(canEditPurchasing(r)).toBe(canSeePurchasing(r));
  });

  it("sarf giderlerini Satın Alma ile aynı roller görür", () => {
    expect(evetDiyenler(canSeeConsumableExpenses)).toEqual([
      "admin",
      "purchasing",
      "planning",
    ]);
    for (const r of USER_ROLES) {
      expect(canSeeConsumableExpenses(r), r).toBe(canSeePurchasing(r));
    }
  });

  it("sarf giderini yalnız Yönetici ve Satın Alma düzenler — Planlama salt okunur", () => {
    expect(evetDiyenler(canEditConsumableExpenses)).toEqual(["admin", "purchasing"]);
    expect(canSeeConsumableExpenses("planning")).toBe(true);
    expect(canEditConsumableExpenses("planning")).toBe(false);
  });

  it("KALİTE ve ÜRETİM rolleri bugün ek bir kapı AÇMAZ", () => {
    // `uretim` etiketi de öyle tanımlıydı ("bugün ek bir kapı açmaz") ve rol
    // olurken sessizce genişletilmedi; Kalite aynı gün aynı tanımla eklendi.
    // Birine ekran açmak AYRI bir karardır ve o gün buraya tek satır yazılır.
    for (const rol of ["quality", "production"]) {
      expect(canSeePurchasing(rol), rol).toBe(false);
      expect(canSeeConsumableExpenses(rol), rol).toBe(false);
      expect(canEditConsumableExpenses(rol), rol).toBe(false);
      expect(canEditDrawings(rol), rol).toBe(false);
      expect(canSeeSales(rol), rol).toBe(false);
      expect(canSeeWorkLog(rol), rol).toBe(false);
      expect(canSeePersonnel(rol), rol).toBe(false);
      expect(canEditReports(rol), rol).toBe(false);
      expect(isAdminRole(rol), rol).toBe(false);
    }
  });

  it("rol kümesi dondurulmuştur", () => {
    expect([...USER_ROLES]).toEqual([
      "admin",
      "manager",
      "engineer",
      "draftsman",
      "purchasing",
      "planning",
      "quality",
      "production",
    ]);
  });

  it("GÖREV ETİKETİ MEKANİZMASI KALDIRILDI", () => {
    // Yarım bırakılmış bir geçiş en pahalı sonuçtur: aynı yetki iki yerden
    // sorulabilir hâle gelir. Modülde etiketten kalan hiçbir dışa aktarım
    // OLMAMALIDIR.
    for (const ad of ["USER_TAGS", "USER_TAG_LABELS", "USER_TAG_HINTS", "tagsOf", "tagLabel", "hasTag"]) {
      expect(Object.keys(rolesModule), `${ad} hâlâ dışa aktarılıyor`).not.toContain(ad);
    }
  });
});

// ══════════════════════════════════════════════ TEKNİK RESMİ ÇİZEN (md. 4)

describe("çizen rolleri", () => {
  it("Teknik Ressam ve Mühendis — ÖNCE RESSAMLAR", () => {
    // Kullanıcı kararı (12.08.2026): "Ressam ve Mühendis rolündekiler
    // listelensin. Önce ressamlar." SIRA testin konusudur; bir küme değil bir
    // dizidir ve seçici listeyi bu sırada basar.
    expect([...DRAWING_AUTHOR_ROLES]).toEqual(["draftsman", "engineer"]);
  });

  it("başka hiçbir rol çizen olarak listelenmez", () => {
    expect(evetDiyenler(canBeDrawingAuthor)).toEqual(["engineer", "draftsman"]);
    expect(canBeDrawingAuthor("admin")).toBe(false);
    expect(canBeDrawingAuthor("production")).toBe(false);
  });
});

// ═════════════════════════════════ YETKİ IZGARASI — ÜÇ DEĞERLİ HÜCRE (13.08)
//
// `/admin/access` üç tablodan tek bir rol × bölüm ızgarasına indi. Hücre
// hesaplanır (`sectionAccess`) ve ÜÇ değerlidir: "görür" ile "görür ve
// değiştirir" arasındaki fark bu uygulamanın en sık sorulan sorusudur ve tek
// bir ✓ onu gizlerdi.

describe("sectionAccess — ızgaranın hücresi", () => {
  const { WORKSPACE_SECTIONS, sectionAccess } = rolesModule;
  const bolum = (href: string) => WORKSPACE_SECTIONS.find((s) => s.href === href)!;

  it("görünmeyen bölüm KAPALIdır", () => {
    expect(sectionAccess(bolum("/sales"), "engineer")).toBe("kapali");
    expect(sectionAccess(bolum("/personnel"), "draftsman")).toBe("kapali");
    expect(sectionAccess(bolum("/admin"), "manager")).toBe("kapali");
  });

  it("GÖRÜR ile YAZAR ayrımı gerçekten çıkar", () => {
    // Müdür teknik resmi ve hesap raporunu görür ama yazmaz; mühendis yazar.
    expect(sectionAccess(bolum("/drawings"), "manager")).toBe("gorur");
    expect(sectionAccess(bolum("/drawings"), "engineer")).toBe("yazar");
    expect(sectionAccess(bolum("/projects"), "manager")).toBe("gorur");
    expect(sectionAccess(bolum("/projects"), "engineer")).toBe("yazar");
    // Teknik ressam resmi yazar ama raporu yazmaz.
    expect(sectionAccess(bolum("/drawings"), "draftsman")).toBe("yazar");
    expect(sectionAccess(bolum("/projects"), "draftsman")).toBe("gorur");
  });

  it("yazma sorusu OLMAYAN bölümde gören YAZAR", () => {
    // `sales` · `worklog` politikaları yazmayı ayrıca sormaz; burada
    // "bilinmiyor" diye üçüncü bir hâl uydurmak, ekranın veriden fazlasını
    // iddia etmesi olurdu.
    expect(bolum("/sales").yazabilir).toBeUndefined();
    expect(sectionAccess(bolum("/sales"), "manager")).toBe("yazar");
    expect(sectionAccess(bolum("/worklog"), "manager")).toBe("yazar");
  });

  it("İŞLER HERKESE GÖRÜNÜR ama yazma Yönetici/Müdürdedir", () => {
    // Bölüm 18.08.2026'da yazma sorusu KAZANDI: görünürlük genişlerken yazma
    // daraldı. Izgara bu farkı basmalıdır — tek bir ✓ onu gizlerdi.
    expect(bolum("/jobs").visible).toBeUndefined();
    expect(sectionAccess(bolum("/jobs"), "production")).toBe("gorur");
    expect(sectionAccess(bolum("/jobs"), "engineer")).toBe("gorur");
    expect(sectionAccess(bolum("/jobs"), "manager")).toBe("yazar");
  });

  it("Yönetici HER bölümde yazar", () => {
    for (const s of WORKSPACE_SECTIONS) {
      expect(sectionAccess(s, "admin"), s.href).toBe("yazar");
    }
  });

  it("ızgara ile MENÜ aynı cevabı verir", () => {
    // İki listenin ayrışması bir yetki ekranında olabilecek en kötü hatadır:
    // "kapali" olmayan her hücre menüde de görünmelidir.
    for (const r of USER_ROLES) {
      const menude = new Set(rolesModule.visibleSections(r).map((s) => s.href));
      for (const s of WORKSPACE_SECTIONS) {
        expect(sectionAccess(s, r) !== "kapali", `${r} / ${s.href}`).toBe(menude.has(s.href));
      }
    }
  });

  it("yazma SORUSU olan bölümde `yazma` metni de vardır", () => {
    // Metin ızgarada sütun ipucu olarak basılır; soru varken metnin olmaması
    // kullanıcıya "neden bu hücre göz, öbürü kalem" sorusunu cevapsız bırakır.
    for (const s of WORKSPACE_SECTIONS) {
      if (s.yazabilir) expect(s.yazma?.trim(), s.href).toBeTruthy();
    }
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

  it("özet metinlerinde FONKSİYON ADI geçmez", () => {
    // Kullanıcı bildirimi (12.08.2026): "İngilizce terimler var." `kime` ve
    // `yazma` doğrudan ekrana basılır; oraya `canEditReports` gibi bir iç ad
    // yazmak, yetki ekranını okuyan yöneticiye hiçbir şey anlatmaz.
    for (const s of WORKSPACE_SECTIONS) {
      for (const metin of [s.kime, s.yazma ?? ""]) {
        expect(metin, `${s.href}: '${metin}' kod adı taşıyor`).not.toMatch(/can[A-Z]|\(\)/);
      }
    }
  });

  it("Yönetici bütün bölümleri görür", () => {
    expect(visibleSections("admin")).toHaveLength(WORKSPACE_SECTIONS.length);
  });

  it("Teknik Ressam satış, iş takibi, satın alma, personel ve yönetimi GÖRMEZ", () => {
    const gorunen = visibleSections("draftsman").map((s) => s.href);
    expect(gorunen).toContain("/drawings");
    expect(gorunen).toContain("/jobs");
    expect(gorunen).not.toContain("/sales");
    expect(gorunen).not.toContain("/worklog");
    expect(gorunen).not.toContain("/purchasing");
    expect(gorunen).not.toContain("/personnel");
    expect(gorunen).not.toContain("/admin");
  });

  it("Müdür personel bölümünü görür, Mühendis görmez", () => {
    expect(visibleSections("manager").map((s) => s.href)).toContain("/personnel");
    expect(visibleSections("engineer").map((s) => s.href)).not.toContain("/personnel");
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

  it("Satın Alma rolü YALNIZ Satın Alma'yı ekler", () => {
    // Etiket döneminin sözü ("etiket yalnız kapı açar") rol düzeninde de
    // ölçülür: Satın Alma rolü, Teknik Ressam'ın gördüklerine yalnız tek bir
    // bölüm ekler — daha fazlasını değil.
    const ressam = visibleSections("draftsman").map((s) => s.href);
    const satinalma = visibleSections("purchasing").map((s) => s.href);
    expect(satinalma).toEqual(
      [...ressam, "/purchasing"].sort(
        (a, b) =>
          WORKSPACE_SECTIONS.findIndex((s) => s.href === a) -
          WORKSPACE_SECTIONS.findIndex((s) => s.href === b)
      )
    );
  });

  it("Kalite ve Üretim rolleri Teknik Ressam ile AYNI bölümleri görür", () => {
    const ressam = visibleSections("draftsman").map((s) => s.href);
    for (const rol of ["quality", "production"]) {
      expect(visibleSections(rol).map((s) => s.href), rol).toEqual(ressam);
    }
  });
});

/*
 * GİRİŞ ADRESİ — üç kapı da AYNI yere açılır.
 *
 * Uygulamanın açılış ekranı panodur (`/`) ama adres üç ayrı yerde elle
 * yazılıydı ve ikisi panodan önceki dünyada kalmıştı: proxy oturumu olan
 * kullanıcıyı `/login`den `/projects`e, kabuktaki marka bağlantısı da yine
 * `/projects`e gönderiyordu. Kullanıcı bunu telefonda gördü (16.08.2026) —
 * orada giriş adımı sık tekrarlandığı için o dal her açılışta çalışıyordu.
 *
 * Test KAYNAK DOSYAYI okur (`terms.test.ts` / `purchasing-split.test.ts`
 * deseni): sabiti içe aktarmayan bir dosya, sabitin değişmesinden habersiz
 * kalır ve ayrışma yine sessiz olurdu.
 */
describe("giriş adresi TEK kaynaktan okunur", () => {
  const oku = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("LANDING_PATH menünün İLK satırıyla aynıdır", () => {
    const { WORKSPACE_SECTIONS } = rolesModule;
    expect(LANDING_PATH).toBe("/");
    expect(WORKSPACE_SECTIONS[0].href).toBe(LANDING_PATH);
    expect(WORKSPACE_SECTIONS[0].label).toBe("Panel");
  });

  it("proxy, giriş formu ve marka bağlantısı sabiti içe aktarır", () => {
    const kapilar = [
      "src/proxy.ts",
      "src/app/(auth)/login/page.tsx",
      "src/components/app-shell.tsx",
    ];
    for (const yol of kapilar) {
      const kaynak = oku(yol);
      expect(kaynak, `${yol} LANDING_PATH içe aktarmıyor`).toMatch(
        /import\s*\{[^}]*LANDING_PATH[^}]*\}\s*from\s*"@\/lib\/roles"/
      );
    }
  });

  it("hiçbir kapı elle bir açılış adresi yazmaz", () => {
    // Yönlendirme/gezinme hedefi olarak yazılmış her sabit adres yakalanır;
    // `href="/projects"` gibi bir MENÜ bağlantısı zaten bu dosyalarda yok.
    const yasak =
      /(?:pathname\s*=\s*|redirect\(|replace\(|push\(|href=\{?["'])["']\/projects["']/;
    for (const yol of [
      "src/proxy.ts",
      "src/app/(auth)/login/page.tsx",
      "src/components/app-shell.tsx",
    ]) {
      expect(oku(yol), `${yol} elle "/projects"e yönlendiriyor`).not.toMatch(yasak);
    }
  });
});
