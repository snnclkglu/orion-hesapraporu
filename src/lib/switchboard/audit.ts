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

  // 1 — Hiçbir parça ray kapasitesini aşmıyor.
  const tasan = panel.placements.filter((p) => p.xMm + p.widthMm > kapasite + EPS);
  checks.push({
    key: "ray-kapasitesi",
    label: "Hiçbir cihaz ray kapasitesini aşmıyor",
    ok: tasan.length === 0,
    detail:
      tasan.length === 0
        ? `${panel.placements.length} parça, kapasite ${Math.round(kapasite)} mm`
        : tasan.map((p) => `${p.label} (${Math.round(p.xMm + p.widthMm)} mm)`).join(", "),
  });

  // 2 — Hiçbir parça sol kenarın solunda değil.
  const negatif = panel.placements.filter((p) => p.xMm < -EPS || p.yMm < -EPS);
  checks.push({
    key: "negatif-koordinat",
    label: "Hiçbir cihaz plakanın dışına taşmıyor",
    ok: negatif.length === 0,
    detail: negatif.length === 0 ? "tamam" : negatif.map((p) => p.label).join(", "),
  });

  // 3 — Aynı raydaki iki cihaz ÇAKIŞMIYOR.
  const cakisma: string[] = [];
  for (const ray of panel.rails) {
    const uzerinde = panel.placements
      .filter((p) => p.railIndex === ray.index)
      .sort((a, b) => a.xMm - b.xMm);
    for (let i = 1; i < uzerinde.length; i++) {
      const onceki = uzerinde[i - 1];
      const simdiki = uzerinde[i];
      if (simdiki.xMm + EPS < onceki.xMm + onceki.widthMm) {
        cakisma.push(`${ray.index}: ${onceki.label} ↔ ${simdiki.label}`);
      }
    }
  }
  checks.push({
    key: "cakisma",
    label: "Aynı raydaki cihazlar çakışmıyor",
    ok: cakisma.length === 0,
    detail: cakisma.length === 0 ? `${panel.rails.length} ray denetlendi` : cakisma.join(" · "),
  });

  // 4 — Ray satırları üst üste binmiyor ve plakadan taşmıyor.
  let binme = "";
  let beklenenY = s.edgeGapMm;
  for (const ray of panel.rails) {
    if (Math.abs(ray.yMm - beklenenY) > EPS) {
      binme = `Ray ${ray.index}: y=${Math.round(ray.yMm)} mm, beklenen ${Math.round(beklenenY)} mm`;
      break;
    }
    beklenenY += ray.heightMm;
  }
  const toplamYukseklik = beklenenY + s.edgeGapMm;
  checks.push({
    key: "ray-dizilimi",
    label: "Ray satırları üst üste binmiyor",
    ok: binme === "",
    detail: binme || `${panel.rails.length} ray, toplam ${Math.round(toplamYukseklik)} mm`,
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

  // 6 — Kapak cihazı plakaya, plaka cihazı kapağa düşmemiş.
  const yanlisYuz =
    panel.placements.filter((p) => p.mountType === "kapak").length +
    panel.doorPlacements.filter((p) => p.mountType !== "kapak").length;
  checks.push({
    key: "yuz-ayrimi",
    label: "Kapak cihazı yalnız kapakta, plaka cihazı yalnız plakada",
    ok: yanlisYuz === 0,
    detail: yanlisYuz === 0 ? `${panel.doorPlacements.length} kapak cihazı` : `${yanlisYuz} hatalı`,
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

  const beklenenKapak = new Set(
    expected.filter((d) => d.mountType === "kapak").map((d) => d.key)
  );
  const yerlesenKapak = new Set(panels.flatMap((p) => p.doorPlacements.map((y) => y.deviceKey)));
  const eksikKapak = [...beklenenKapak].filter((k) => !yerlesenKapak.has(k));

  // ÇİZİLMEYEN AYGIT DA SAYILIR. Gövde gereci (fan, termostat, pano lambası)
  // ve pano yanı ekipmanı (siren, projektör) montaj plakasına girmez ve
  // yerleşimi çizilmez — ama SİPARİŞ EDİLİR. Denetim yalnız plaka ve kapağı
  // ölçseydi, bu iki aile `ayir()` içinde bir daldan düşse hiçbir şey haber
  // vermezdi; sessiz kayıp, yanlış yerleşimden tehlikelidir (PANO-10).
  const sayimi = (
    tip: "govde" | "yan",
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
      key: "kapak-eksiksizlik",
      label: "Kapağa giren her aygıt yerleşti",
      ok: eksikKapak.length === 0,
      detail:
        eksikKapak.length === 0
          ? `${beklenenKapak.size} aygıt`
          : `eksik ${eksikKapak.length} (${eksikKapak.slice(0, 5).join(", ")})`,
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
