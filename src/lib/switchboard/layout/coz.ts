// TEK PANONUN ÇÖZÜMÜ — ayırma, en araması, bölme (PANO-8 · PANO-9 · PANO-10).

import { ROOM_GRID, type LineupGrid, doorConfigFor, plateCapacityHeightMm } from "../sizes";
import { ZONE_ORDER } from "../mount";
import { naturalCompare } from "../panels";
import type {
  DeviceBox,
  DoorConfig,
  LayoutSettings,
  LineupPrefs,
  PanelKind,
  PanelLayout,
  PanelOverride,
  Placement,
  Unplaced,
  Zone,
} from "../types";
import { paketle, type PackResult } from "./paketle";

/** Bir panonun yerleştirmeye giren hâli. */
export interface PanelInput {
  code: string;
  name: string;
  kind: PanelKind;
  devices: DeviceBox[];
  override: PanelOverride | null;
}

/** Ölçüsü tam olan aygıt mı? */
function olculuMu(d: DeviceBox): boolean {
  return d.widthMm !== null && d.heightMm !== null && d.depthMm !== null;
}

interface Ayirma {
  plaka: DeviceBox[];
  /**
   * ÇİZİLMEYEN AMA PANODA OLAN aygıtlar: gövde gereci, kapak üstü, zemin.
   *
   * Üçü de `PanelLayout.bodyDevices` listesine girer ve montaj tipleri
   * korunur — cihaz listesi "Kapak (çizilmez)" ile "Pano zemini"ni ayrı
   * gösterir (PANO-37).
   */
  govde: DeviceBox[];
  /** Pano YANINA asılanlar — yerleşmez ama çizilir. */
  yan: DeviceBox[];
  disari: Unplaced[];
}

/** Aygıtları montaj tipine göre ayırır; yerleşemeyeni SEBEBİYLE kaydeder. */
function ayir(devices: DeviceBox[]): Ayirma {
  const out: Ayirma = { plaka: [], govde: [], yan: [], disari: [] };
  for (const d of devices) {
    // ÜRÜNSÜZ SATIR SINIFLANMAMIŞ DEĞİLDİR. Sınıflandırıcıya kızmanın anlamı
    // yok: ortada sınıflanacak bir ürün yok. Ayrı bir kova, gerçek eksiklerin
    // (ölçüsüz sürücü) görünürlüğünü korur.
    if (d.mountType === null && !d.supplier && !d.typeNo && !d.partNo) {
      out.disari.push({
        device: d,
        reason: "urunsuz",
        note: "Aygıt etiketi var ama malzeme satırında ürün yok",
      });
      continue;
    }
    if (d.mountType === null) {
      out.disari.push({
        device: d,
        reason: "siniflanmamis",
        note: "Kategori 'Diğer'; montaj tipi tahmin edilmedi",
      });
      continue;
    }
    if (d.mountType === "saha") {
      out.disari.push({ device: d, reason: "saha", note: "Pano dışı ekipman" });
      continue;
    }
    // ÇİZİLMEYENLER TEK KOVADA (PANO-37): gövde gereci, kapak üstü ve zemine
    // oturan trafo. Montaj tipleri korunur, yalnız plakada yer kaplamazlar.
    if (d.mountType === "govde" || d.mountType === "kapak" || d.mountType === "zemin") {
      out.govde.push(d);
      continue;
    }
    // PANO YANI KUYRUĞA DÜŞMEZ, LİSTEYE GİRER. Ölçüsü bilinmese de görünür:
    // bir sirenin eni panoyu büyütmez, o yüzden burada ölçü aranmaz.
    if (d.mountType === "yan") {
      out.yan.push(d);
      continue;
    }
    if (!olculuMu(d)) {
      out.disari.push({
        device: d,
        reason: "olcusuz",
        note: "En, boy veya derinlik bilinmiyor",
      });
      continue;
    }
    out.plaka.push(d);
  }
  return out;
}

/**
 * Panonun gerektirdiği derinlik [mm] — ızgaraya yuvarlanmadan önce.
 *
 * KAPAK KATKISI KALKTI (PANO-37): kapak cihazları artık yerleştirilmiyor.
 * `doorGapMm` ayarı yerinde duruyor — kapak yerleşimi bir gün geri gelirse
 * kullanılacak olan odur.
 */
function derinlikIhtiyaci(plaka: Placement[], s: LayoutSettings): number {
  const enDerin = plaka.reduce((m, p) => Math.max(m, p.depthMm), 0);
  return enDerin + s.backGapMm;
}

export interface PanelSolve {
  layout: PanelLayout;
  /** Bu ende/yükseklikte sığdırılamayan aygıtlar. */
  unplaced: Unplaced[];
  fits: boolean;
  /**
   * Ray yığınının plaka yüksekliğine oranı [0..1].
   *
   * "Sığdı mı" sorusunun cevabı `fits`tir; bu ise "RAHAT MI sığdı" sorusunun
   * cevabıdır ve küçük gövdeyi seçip seçmeyeceğimizi o belirler (PANO-9).
   */
  heightFill: number;
}

/**
 * Tek bir panoyu verilen yükseklikte çözer: en ızgarasında EN KÜÇÜK SIĞANI arar.
 *
 * Kullanıcı eni kilitlediyse arama yapılmaz; sığmıyorsa uyarı verilir ve plan
 * yine de çizilir. Hiçbir aday sığdıramıyorsa EN AZ SIĞMAYAN BIRAKAN seçilir
 * ki ekran yine de bir şey gösterebilsin.
 */
export function solvePanel(
  input: PanelInput,
  heightMm: number,
  s: LayoutSettings,
  prefs: LineupPrefs,
  izgara: LineupGrid = ROOM_GRID
): PanelSolve {
  const { plaka, govde, yan, disari } = ayir(input.devices);
  const yukseklikKapasitesi = plateCapacityHeightMm(heightMm, s);

  const kilitliEn = input.override?.widthLocked ? input.override.widthMm : null;
  const adaylar = kilitliEn ? [kilitliEn] : [...izgara.widths];

  let enIyi: { en: number; paket: PackResult } | null = null;

  for (const en of adaylar) {
    const paket = paketle(plaka, en, s);
    const sigdi = paket.unplaced.length === 0 && paket.totalHeightMm <= yukseklikKapasitesi;
    if (sigdi) {
      enIyi = { en, paket };
      break;
    }
    if (
      !enIyi ||
      paket.unplaced.length < enIyi.paket.unplaced.length ||
      (paket.unplaced.length === enIyi.paket.unplaced.length &&
        paket.totalHeightMm < enIyi.paket.totalHeightMm)
    ) {
      enIyi = { en, paket };
    }
  }

  const enTaban = izgara.widths[0];
  const secilen = enIyi ?? { en: enTaban, paket: paketle(plaka, enTaban, s) };
  const gerekliDerinlik = derinlikIhtiyaci(secilen.paket.placements, s);

  const warnings: string[] = [];
  const tasti = secilen.paket.totalHeightMm > yukseklikKapasitesi;
  if (tasti) {
    warnings.push(
      `Ray yüksekliği ${Math.round(secilen.paket.totalHeightMm)} mm; plakada ${Math.round(yukseklikKapasitesi)} mm var.`
    );
  }
  if (kilitliEn && (tasti || secilen.paket.unplaced.length > 0)) {
    warnings.push(`En ${kilitliEn} mm olarak kilitli; arama yapılmadı.`);
  }
  const doluluk =
    secilen.paket.capacityMm > 0 ? secilen.paket.usedMm / secilen.paket.capacityMm : 0;
  if (doluluk > s.fillWarnRatio) {
    warnings.push(
      `Ray doluluğu %${Math.round(doluluk * 100)} — ilave için pay kalmıyor (hedef %${Math.round(s.fillWarnRatio * 100)}).`
    );
  }
  // UYGULANAMAYAN SABİTLEME SESSİZ KALMAZ (PANO-38): kullanıcı bir cihazı
  // taşıdı ve o taşıma tutmadıysa sebebi burada okunur.
  for (const u of secilen.paket.pinIssues) {
    const ad = input.devices.find((d) => d.key === u.key)?.label ?? u.key;
    warnings.push(`${ad} sabitlemesi uygulanamadı: ${u.sebep}.`);
  }

  const kapakSecimi: DoorConfig = doorConfigFor(secilen.en, input.override?.doorConfig ?? null);

  const layout: PanelLayout = {
    code: input.code,
    name: input.override?.name || input.name || input.code,
    kind: input.kind,
    widthMm: secilen.en,
    heightMm,
    depthMm: 0, // ortak derinlik sonra yazılır
    baseMm: input.override?.baseMm ?? prefs.baseMm,
    doorConfig: kapakSecimi,
    widthLocked: Boolean(input.override?.widthLocked),
    heightLocked: Boolean(input.override?.heightLocked),
    depthLocked: Boolean(input.override?.depthLocked),
    rails: secilen.paket.rails,
    placements: secilen.paket.placements,
    order: secilen.paket.order,
    // KAPAK YERLEŞİMİ ÇİZİLMEZ (PANO-37, kullanıcı kararı 09.09.2026).
    doorPlacements: [],
    bodyDevices: govde,
    sideDevices: yan,
    requiredDepthMm: gerekliDerinlik,
    fillRatio: doluluk,
    splitOf: null,
    warnings,
  };

  return {
    layout,
    unplaced: [...disari, ...secilen.paket.unplaced],
    fits: !tasti && secilen.paket.unplaced.length === 0,
    heightFill:
      yukseklikKapasitesi > 0 ? secilen.paket.totalHeightMm / yukseklikKapasitesi : 0,
  };
}

/**
 * SIĞMAYAN PANO BÖLÜNÜR (PANO-10).
 *
 * Bölme sınırı BÖLGE SINIRIDIR, cihazın ortası değil: bir gözde giriş ve güç,
 * ötekinde kumanda ve klemens durur.
 */
export function splitPanel(input: PanelInput): PanelInput[] {
  const bolgeler = new Map<Zone, DeviceBox[]>();
  for (const d of input.devices) {
    const z = (d.zone ?? "kumanda") as Zone;
    const liste = bolgeler.get(z);
    if (liste) liste.push(d);
    else bolgeler.set(z, [d]);
  }
  const sirali = ZONE_ORDER.filter((z) => bolgeler.has(z));

  let a: DeviceBox[];
  let b: DeviceBox[];

  if (sirali.length >= 2) {
    const orta = Math.ceil(sirali.length / 2);
    a = sirali.slice(0, orta).flatMap((z) => bolgeler.get(z) ?? []);
    b = sirali.slice(orta).flatMap((z) => bolgeler.get(z) ?? []);
  } else {
    // TEK BÖLGE DE BÖLÜNEBİLMELİDİR (0019 LVD10: 195 parçanın hepsi klemens).
    // Sınır aygıt sırasının ORTASIDIR; -X1…-X20 ile -X21…-X40 ayrılır.
    const hepsi = [...input.devices].sort((x, y) => naturalCompare(x.label, y.label) || x.sort - y.sort);
    if (hepsi.length < 2) return [input];
    const orta = Math.ceil(hepsi.length / 2);
    a = hepsi.slice(0, orta);
    b = hepsi.slice(orta);
  }

  if (a.length === 0 || b.length === 0) return [input];

  return [
    { ...input, code: `${input.code}-A`, name: `${input.name} (A)`, devices: a, override: null },
    { ...input, code: `${input.code}-B`, name: `${input.name} (B)`, devices: b, override: null },
  ];
}

/**
 * Sığana kadar böler — en çok `MAX_SPLIT` tur. Tur sınırı özyinelemenin
 * durma garantisidir.
 */
const MAX_SPLIT = 4;

export function bolerekCoz(
  panels: PanelInput[],
  heightMm: number,
  s: LayoutSettings,
  prefs: LineupPrefs,
  izgara: LineupGrid
): { girdiler: PanelInput[]; cozumler: PanelSolve[] } {
  let girdiler = panels;
  let cozumler = girdiler.map((p) => solvePanel(p, heightMm, s, prefs, izgara));

  for (let tur = 0; tur < MAX_SPLIT; tur++) {
    if (cozumler.every((c) => c.fits)) break;
    const yeni: PanelInput[] = [];
    let degisti = false;
    for (let i = 0; i < girdiler.length; i++) {
      // Kilitli enli pano BÖLÜNMEZ: kullanıcı o gövdeyi bilerek seçmiştir
      // (Plan S1); sistem onu ikiye ayırırsa verilen sipariş ile plan ayrışır.
      if (cozumler[i].fits || girdiler[i].override?.widthLocked) {
        yeni.push(girdiler[i]);
        continue;
      }
      const parcalar = splitPanel(girdiler[i]);
      if (parcalar.length > 1) degisti = true;
      yeni.push(...parcalar);
    }
    if (!degisti) break;
    girdiler = yeni;
    cozumler = girdiler.map((p) => solvePanel(p, heightMm, s, prefs, izgara));
  }

  return { girdiler, cozumler };
}
