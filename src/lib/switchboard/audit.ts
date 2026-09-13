// YERLEŞİM DENETÇİSİ — algoritmanın İDDİASINI değil SONUCU ölçer (PANO-11).
//
// Gerekçe `lib/purchasing/hammadde/nesting.ts`teki kardeşiyle aynıdır ve orada
// ölçülmüştür: yerleştirme kodunda bir işaret hatası (`+pay` yerine `-pay`)
// SESSİZDİR — plan ekranda makul görünür ve hata ancak atölyede, pano
// imalatçısının elinde ortaya çıkar. Denetçi bu yüzden yerleştiriciyi hiç
// bilmez; yalnız çıkan koordinatlara bakar.
//
// GEÇEN DENETİMLER DE LİSTELENİR. Yalnız hataları göstermek "denetim çalıştı
// mı" sorusunu cevapsız bırakır; kullanıcı geçen satırları görmezse denetimin
// hiç koşmadığı bir hatayı sessiz kabul eder.

import { plateCapacityHeightMm, railCapacityMm } from "./sizes";
import type { DeviceBox, LayoutSettings, PanelLayout } from "./types";

export interface AuditCheck {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface AuditResult {
  checks: AuditCheck[];
  ok: boolean;
}

const EPS = 0.01;

/**
 * Bir panonun yerleşimini denetler.
 *
 * `expected` verilirse "her aygıt tam bir kez yerleşti mi" de sınanır; bu,
 * yerleştiricinin bir cihazı sessizce düşürmesini yakalayan tek denetimdir.
 */
export function auditPanel(
  panel: PanelLayout,
  s: LayoutSettings,
  expected?: DeviceBox[]
): AuditResult {
  const checks: AuditCheck[] = [];
  const kapasite = railCapacityMm(panel.widthMm, s);
  const yukseklikKapasitesi = plateCapacityHeightMm(panel.heightMm, s);

  // 1 — Hiçbir parça KENDİ rayının kapasitesini aşmıyor.
  //
  // Cep rayı (PANO-39) tam enli değildir: kapasitesi cebin enidir ve sol
  // kenarı `xMm`den başlar. Tek bir gövde kapasitesiyle ölçmek cep rayındaki
  // taşmayı görmezdi.
  const rayHaritasi = new Map(panel.rails.map((r) => [r.index, r]));
  const tasan = panel.placements.filter((p) => {
    const ray = rayHaritasi.get(p.railIndex);
    const sagSinir = ray ? ray.xMm + ray.capacityMm : kapasite;
    return p.xMm + p.widthMm > sagSinir + EPS || (ray ? p.xMm < ray.xMm - EPS : false);
  });
  checks.push({
    key: "ray-kapasitesi",
    label: "Hiçbir cihaz rayının kapasitesini aşmıyor",
    ok: tasan.length === 0,
    detail:
      tasan.length === 0
        ? `${panel.placements.length} parça, gövde kapasitesi ${Math.round(kapasite)} mm`
        : tasan.map((p) => `${p.label} (${Math.round(p.xMm + p.widthMm)} mm)`).join(", "),
  });

  // 2 — Hiçbir parça plakanın dışında değil.
  const negatif = panel.placements.filter(
    (p) => p.xMm < -EPS || p.yMm < -EPS || p.xMm + p.widthMm > kapasite + EPS
  );
  checks.push({
    key: "negatif-koordinat",
    label: "Hiçbir cihaz plakanın dışına taşmıyor",
    ok: negatif.length === 0,
    detail: negatif.length === 0 ? "tamam" : negatif.map((p) => p.label).join(", "),
  });

  // 3 — Hiçbir iki cihaz İKİ BOYUTTA çakışmıyor (PANO-39).
  //
  // Eski denetim yalnız AYNI RAYDAKİ komşuları x'te kıyaslıyordu; cep rayı bir
  // sürücünün yanında durduğu için çakışma artık raylar ARASINDA da olabilir.
  const cakisma: string[] = [];
  const sirali = [...panel.placements].sort((a, b) => a.yMm - b.yMm || a.xMm - b.xMm);
  for (let i = 0; i < sirali.length; i++) {
    const a = sirali[i];
    for (let j = i + 1; j < sirali.length; j++) {
      const b = sirali[j];
      if (b.yMm >= a.yMm + a.heightMm - EPS) break;
      const xKesisir = a.xMm < b.xMm + b.widthMm - EPS && b.xMm < a.xMm + a.widthMm - EPS;
      const yKesisir = a.yMm < b.yMm + b.heightMm - EPS && b.yMm < a.yMm + a.heightMm - EPS;
      if (xKesisir && yKesisir) cakisma.push(`${a.label} ↔ ${b.label}`);
    }
  }
  checks.push({
    key: "cakisma",
    label: "Hiçbir iki cihaz çakışmıyor",
    ok: cakisma.length === 0,
    detail: cakisma.length === 0 ? `${panel.placements.length} cihaz, ${panel.rails.length} ray denetlendi` : cakisma.slice(0, 6).join(" · "),
  });

  // 4 — Ray satırları birbirine binmiyor ve plakanın içinde.
  //
  // Tam enli raylar ardışık yığılır, cep rayları bandın içinde durur; ortak
  // kural "iki rayın dikdörtgeni kesişmez ve hiçbiri plakayı aşmaz"dır.
  let binme = "";
  const raylar = [...panel.rails].sort((a, b) => a.yMm - b.yMm || a.xMm - b.xMm);
  for (let i = 0; i < raylar.length && !binme; i++) {
    const r = raylar[i];
    if (r.yMm < s.edgeGapMm - EPS || r.xMm < -EPS || r.xMm + r.capacityMm > kapasite + EPS) {
      binme = `Ray ${r.index}: plakanın dışında (x=${Math.round(r.xMm)}, y=${Math.round(r.yMm)} mm)`;
      break;
    }
    for (let j = i + 1; j < raylar.length; j++) {
      const q = raylar[j];
      // CEP RAYI BANDININ İÇİNDEDİR (PANO-39): bandın dikdörtgeniyle kesişmesi
      // tasarımdır; cihazlarıyla kesişmesi ise yukarıdaki 2B çakışma
      // denetiminde yakalanır.
      if (q.pocketOf === r.index || r.pocketOf === q.index) continue;
      const xKesisir = r.xMm < q.xMm + q.capacityMm - EPS && q.xMm < r.xMm + r.capacityMm - EPS;
      const yKesisir = r.yMm < q.yMm + q.heightMm - EPS && q.yMm < r.yMm + r.heightMm - EPS;
      if (xKesisir && yKesisir) {
        binme = `Ray ${r.index} ↔ Ray ${q.index}: y=${Math.round(q.yMm)} mm, ${Math.round(r.yMm)}–${Math.round(r.yMm + r.heightMm)} aralığına biniyor`;
        break;
      }
    }
  }
  const enAlt = panel.rails.reduce((m, r) => Math.max(m, r.yMm + r.heightMm), s.edgeGapMm);
  const toplamYukseklik = enAlt + s.edgeGapMm;
  checks.push({
    key: "ray-dizilimi",
    label: "Ray satırları üst üste binmiyor",
    ok: binme === "",
    detail: binme || `${panel.rails.length} ray, en alt ${Math.round(toplamYukseklik)} mm`,
  });

  checks.push({
    key: "plaka-yuksekligi",
    label: "Raylar montaj plakasına sığıyor",
    ok: toplamYukseklik <= yukseklikKapasitesi + EPS,
    detail: `${Math.round(toplamYukseklik)} / ${Math.round(yukseklikKapasitesi)} mm`,
  });

  // 5 — Her ray satırında kablo kanalı payı var.
  const kanalsiz = panel.rails.filter((r) => r.ductMm < s.railDuctMm - EPS);
  checks.push({
    key: "kanal",
    label: "Her ray satırının altında kablo kanalı var",
    ok: kanalsiz.length === 0,
    detail:
      kanalsiz.length === 0
        ? `${s.railDuctMm} mm kanal, ${panel.rails.length} satır`
        : kanalsiz.map((r) => `Ray ${r.index}`).join(", "),
  });

  // 6 — Plakada YALNIZ plakaya ait cihaz var.
  //
  // Kapak yerleşimi kaldırıldıktan sonra (PANO-37) sorunun yönü değişti:
  // artık "kapak cihazı kapakta mı" diye sorulmuyor, "kapak/zemin cihazı
  // plakaya SIZDI mı" diye soruluyor. Sızarsa şemada olmayan bir yere kutu
  // çizilir ve pano yanlış boyutlanır.
  const yanlisYuz = panel.placements.filter(
    (p) => p.mountType !== "din" && p.mountType !== "plaka"
  ).length;
  checks.push({
    key: "yuz-ayrimi",
    label: "Plakada yalnız raya/plakaya ait cihaz var",
    ok: yanlisYuz === 0,
    detail: yanlisYuz === 0 ? `${panel.placements.length} cihaz` : `${yanlisYuz} hatalı`,
  });

  // 7 — Derinlik: hiçbir cihaz gövdeden derin değil.
  const derinTasan = panel.placements.filter((p) => p.depthMm + s.backGapMm > panel.depthMm + EPS);
  checks.push({
    key: "derinlik",
    label: "Hiçbir cihaz gövde derinliğini aşmıyor",
    ok: derinTasan.length === 0,
    detail:
      derinTasan.length === 0
        ? `en derin ${Math.round(panel.requiredDepthMm)} mm, gövde ${panel.depthMm} mm`
        : derinTasan.map((p) => `${p.label} (${Math.round(p.depthMm)} mm)`).join(", "),
  });

  // 8 — Her beklenen aygıt TAM BİR KEZ yerleşti.
  if (expected) {
    const beklenen = new Set(
      expected.filter((d) => d.mountType === "din" || d.mountType === "plaka").map((d) => d.key)
    );
    const yerlesen = new Set(panel.placements.map((p) => p.deviceKey));
    const eksik = [...beklenen].filter((k) => !yerlesen.has(k));
    const fazla = [...yerlesen].filter((k) => !beklenen.has(k));
    checks.push({
      key: "eksiksizlik",
      label: "Her aygıt tam bir kez yerleşti",
      ok: eksik.length === 0 && fazla.length === 0,
      detail:
        eksik.length === 0 && fazla.length === 0
          ? `${beklenen.size} aygıt`
          : `eksik ${eksik.length}, fazla ${fazla.length}`,
    });
  }

  return { checks, ok: checks.every((c) => c.ok) };
}

/**
 * Bütün dizinin denetimi — pano başına bir satır, sonunda DİZİ GENELİ satırı.
 *
 * EKSİKSİZLİK DİZİ DÜZEYİNDE SINANIR, pano düzeyinde değil: sığmayan bir pano
 * ikiye bölünür (PANO-10) ve o panonun aygıtları iki göze dağılır; pano başına
 * beklenen küme tutmazdı. Dizinin tamamında ise küme korunur.
 *
 * Ölçüldü (07.09.2026): `expected` opsiyoneldi ve buradan HİÇ geçirilmiyordu —
 * yani "her aygıt tam bir kez yerleşti" denetimi, bir cihazın sessizce
 * düşmesini yakalayan TEK denetim, yalnız birim testinde koşuyordu. Ekranda ve
 * imalatçıya giden kâğıtta yoktu.
 */
export function auditLineup(
  panels: PanelLayout[],
  s: LayoutSettings,
  expected?: DeviceBox[],
  /**
   * Dizinin adı — "Oda" ya da "Saha".
   *
   * Ölçüldü (08.09.2026): iki dizi de satırını "Dizi geneli" diye
   * adlandırıyordu. İki sonuç yan yana basıldığında React aynı anahtarı iki kez
   * gördü ve satırlardan birini DÜŞÜREBİLİRDİ — imalatçının kâğıdından bir
   * denetim eksilirdi. Ayrıca okuyan, başarısız bir denetimin hangi diziye ait
   * olduğunu göremiyordu.
   */
  diziAdi = "Dizi"
): { code: string; result: AuditResult }[] {
  const satirlar = panels.map((p) => ({ code: p.code, result: auditPanel(p, s) }));
  if (!expected || panels.length === 0) return satirlar;

  const beklenen = new Set(
    expected.filter((d) => d.mountType === "din" || d.mountType === "plaka").map((d) => d.key)
  );
  const yerlesen = new Set(panels.flatMap((p) => p.placements.map((y) => y.deviceKey)));
  const eksik = [...beklenen].filter((k) => !yerlesen.has(k));
  const fazla = [...yerlesen].filter((k) => !beklenen.has(k));


  // ÇİZİLMEYEN AYGIT DA SAYILIR. Gövde gereci (fan, termostat, pano lambası)
  // ve pano yanı ekipmanı (siren, projektör) montaj plakasına girmez ve
  // yerleşimi çizilmez — ama SİPARİŞ EDİLİR. Denetim yalnız plaka ve kapağı
  // ölçseydi, bu iki aile `ayir()` içinde bir daldan düşse hiçbir şey haber
  // vermezdi; sessiz kayıp, yanlış yerleşimden tehlikelidir (PANO-10).
  const sayimi = (
    tip: "govde" | "yan" | "kapak" | "zemin",
    listeden: (p: PanelLayout) => DeviceBox[]
  ): { beklenen: number; eksik: string[] } => {
    const beklenenler = new Set(
      expected.filter((d) => d.mountType === tip).map((d) => d.key)
    );
    const listelenen = new Set(panels.flatMap((p) => listeden(p).map((d) => d.key)));
    return {
      beklenen: beklenenler.size,
      eksik: [...beklenenler].filter((k) => !listelenen.has(k)),
    };
  };
  const govde = sayimi("govde", (p) => p.bodyDevices);
  const yan = sayimi("yan", (p) => p.sideDevices);
  // Kapak ve zemin de `bodyDevices` listesindedir (PANO-37): üçü de "panoda
  // ama çizilmiyor" kovasıdır ve montaj tipleriyle ayrışırlar.
  const kapakListe = sayimi("kapak", (p) => p.bodyDevices);
  const zeminListe = sayimi("zemin", (p) => p.bodyDevices);

  const checks: AuditCheck[] = [
    {
      key: "eksiksizlik",
      label: "Plakaya giren her aygıt tam bir kez yerleşti",
      ok: eksik.length === 0 && fazla.length === 0,
      detail:
        eksik.length === 0 && fazla.length === 0
          ? `${beklenen.size} aygıt`
          : `eksik ${eksik.length}${eksik.length ? ` (${eksik.slice(0, 5).join(", ")})` : ""}, fazla ${fazla.length}`,
    },
    {
      // KAPAK CİHAZI ARTIK YERLEŞMİYOR (PANO-37) ama LİSTELENMEK ZORUNDA.
      // Denetim yön değiştirdi: "kapağa yerleşti mi" değil, "listede duruyor
      // mu". Bir aygıtın sessizce kaybolmaması bu modülün ilk kuralıdır.
      key: "kapak-eksiksizlik",
      label: "Kapak cihazlarının hepsi listelendi",
      ok: kapakListe.eksik.length === 0,
      detail:
        kapakListe.eksik.length === 0
          ? `${kapakListe.beklenen} aygıt`
          : `eksik ${kapakListe.eksik.length} (${kapakListe.eksik.slice(0, 5).join(", ")})`,
    },
    {
      key: "zemin-eksiksizlik",
      label: "Pano zeminine oturan aygıtların hepsi listelendi",
      ok: zeminListe.eksik.length === 0,
      detail:
        zeminListe.eksik.length === 0
          ? `${zeminListe.beklenen} aygıt`
          : `eksik ${zeminListe.eksik.length} (${zeminListe.eksik.slice(0, 5).join(", ")})`,
    },
    {
      key: "govde-eksiksizlik",
      label: "Gövde gereçlerinin hepsi listelendi",
      ok: govde.eksik.length === 0,
      detail:
        govde.eksik.length === 0
          ? `${govde.beklenen} gereç`
          : `eksik ${govde.eksik.length} (${govde.eksik.slice(0, 5).join(", ")})`,
    },
    {
      key: "yan-eksiksizlik",
      label: "Pano yanı ekipmanının hepsi listelendi",
      ok: yan.eksik.length === 0,
      detail:
        yan.eksik.length === 0
          ? `${yan.beklenen} ekipman`
          : `eksik ${yan.eksik.length} (${yan.eksik.slice(0, 5).join(", ")})`,
    },
  ];

  satirlar.push({
    code: `${diziAdi} geneli`,
    result: { checks, ok: checks.every((c) => c.ok) },
  });
  return satirlar;
}
