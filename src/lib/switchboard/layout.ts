// RAY YERLEŞTİRİCİ ve GÖVDE ARAMASI (PANO-4 · PANO-8 · PANO-9 · PANO-10).
//
// ═══════════════════════════════════════════════ NEDEN MaxRects DEĞİL
//
// Sac plaka yerleşimi (`lib/purchasing/hammadde/nesting.ts`) MaxRects kullanır
// ve doğrusu odur: parça plakada istediği yerde durabilir. PANODA DURAMAZ.
// Modüler cihaz 35 mm'lik TS35 rayına oturur ve ray YATAYDIR; serbest bir 2B
// paketleyici bir kontaktörü iki rayın arasında havada bırakırdı. Raf (shelf)
// paketleme burada %60'ta kalan bir uzlaşma değil, fiziksel gerçeğin kendisidir.
//
// `nesting.ts`ten alınan şey algoritma değil DİSİPLİNDİR: tam belirli sıralama,
// payın parçaya eklenmesi, ve sonucu ayrı ölçen bir denetçi (`audit.ts`).
//
// ═══════════════════════════════════════════════ DETERMİNİZM BİR ŞARTTIR
//
// Aynı girdi iki kez yerleştirildiğinde aynı plan çıkmalıdır; yoksa ekrandaki
// resim ile imalatçıya giden çıktı ayrışır. Sıralama tam belirlidir
// (bölge → ana şalter → renk grubu → doğal aygıt kodu → belge sırası) ve
// hiçbir yerde rastgelelik yoktur.

import {
  AUTO_HEIGHTS_MM,
  DEFAULT_SETTINGS,
  PREFERRED_HEIGHT_MM,
  PANEL_DEPTHS_MM,
  PANEL_WIDTHS_MM,
  ceilToGrid,
  doorConfigFor,
  plateCapacityHeightMm,
  railCapacityMm,
} from "./sizes";
import { ZONE_ORDER, isMainSwitch } from "./mount";
import { naturalCompare } from "./panels";
import type {
  DeviceBox,
  DoorConfig,
  LayoutSettings,
  LineupPrefs,
  PanelKind,
  PanelLayout,
  PanelOverride,
  Placement,
  Rail,
  Unplaced,
  Zone,
} from "./types";

/** Bir panonun yerleştirmeye giren hâli. */
export interface PanelInput {
  code: string;
  name: string;
  kind: PanelKind;
  devices: DeviceBox[];
  override: PanelOverride | null;
}

interface PackResult {
  rails: Rail[];
  placements: Placement[];
  unplaced: Unplaced[];
  totalHeightMm: number;
  usedMm: number;
  capacityMm: number;
}

/**
 * ÜST SINIR — ölçüldü: 0019-00'da en kalabalık pano (LVD10) 659 parça taşıyor
 * ve bunların çoğu klemenstir. 4000 birim, o panonun altı katıdır; sınırın
 * kendisi bir kısıt değil, bozuk bir adetin (ör. birim hatası yüzünden 10^6)
 * tarayıcıyı kilitlemesine karşı bir emniyettir.
 */
export const MAX_UNITS = 4000;

/**
 * Aygıtları bölge → ana şalter → renk → doğal kod sırasına dizer, sonra
 * KULLANICININ SABİTLEDİĞİ sıraları yerine oturtur (PANO-23).
 *
 * Sabitleme SIRAYI korur, KOORDİNATI değil: bir aygıtı şemada taşımak onu o
 * KOMŞULUĞA taşımaktır. Koordinat her yerleştirmede yeniden hesaplanır, çünkü
 * komşu bir cihazın eni değişince bu cihazın yeri de değişmelidir; donmuş bir
 * koordinat bir sonraki turda çakışma üretirdi.
 */
function sirala(devices: DeviceBox[]): DeviceBox[] {
  const temel = siralaTuretilmis(devices);
  const sabitli = temel
    .filter((d) => d.pinnedOrder !== null)
    .sort((a, b) => (a.pinnedOrder ?? 0) - (b.pinnedOrder ?? 0) || naturalCompare(a.label, b.label));
  if (sabitli.length === 0) return temel;

  // Sabitlenmiş aygıtlar istedikleri indekse OTURTULUR; gerisi aradaki
  // boşlukları sırayla doldurur. Aynı indeksi isteyen iki aygıt olursa doğal
  // kod sırası ayırır — belirsizlik bırakılmaz (PANO-11: determinizm).
  const serbest = temel.filter((d) => d.pinnedOrder === null);
  const sonuc: (DeviceBox | null)[] = new Array(temel.length).fill(null);
  for (const d of sabitli) {
    let i = Math.max(0, Math.min(temel.length - 1, d.pinnedOrder ?? 0));
    while (sonuc[i] !== null) i = (i + 1) % temel.length;
    sonuc[i] = d;
  }
  let j = 0;
  for (let i = 0; i < sonuc.length; i++) {
    if (sonuc[i] === null) sonuc[i] = serbest[j++] ?? null;
  }
  return sonuc.filter((d): d is DeviceBox => d !== null);
}

/** Sabitleme olmadan türetilen sıra. */
function siralaTuretilmis(devices: DeviceBox[]): DeviceBox[] {
  return [...devices].sort((a, b) => {
    const za = ZONE_ORDER.indexOf(a.zone as Zone);
    const zb = ZONE_ORDER.indexOf(b.zone as Zone);
    if (za !== zb) return za - zb;

    // Ana şalter kendi bandının EN BAŞINDA durur: kapak kolu oradan çıkar ve
    // altındaki dağıtım bankasına giden bara en kısa yolu görür.
    const ma = isMainSwitch(a) ? 0 : 1;
    const mb = isMainSwitch(b) ? 0 : 1;
    if (ma !== mb) return ma - mb;

    if (a.colorGroup !== b.colorGroup) return a.colorGroup.localeCompare(b.colorGroup);
    const n = naturalCompare(a.label, b.label);
    if (n !== 0) return n;
    return a.sort - b.sort;
  });
}

/** Ölçüsü tam olan aygıt mı? */
function olculuMu(d: DeviceBox): boolean {
  return d.widthMm !== null && d.heightMm !== null && d.depthMm !== null;
}

/**
 * Bir panonun ray satırlarını kurar.
 *
 * BÖLGE DEĞİŞİNCE YENİ RAY AÇILIR. Bu bir yerden tasarruf değil bir okunurluk
 * ve kablolama kuralıdır: gerçek panoda bir ray tek işleve aittir ve kanal
 * ondan çıkar. Karışık bir rayda hangi kablonun nereye gittiği ancak şemadan
 * bulunur — panonun kapağını açan kişi onu okuyamaz.
 */
function paketle(
  devices: DeviceBox[],
  panelWidthMm: number,
  panelHeightMm: number,
  s: LayoutSettings
): PackResult {
  const kapasite = railCapacityMm(panelWidthMm, s);
  const rails: Rail[] = [];
  const placements: Placement[] = [];
  const unplaced: Unplaced[] = [];

  let y = s.edgeGapMm;
  let aktif: Rail | null = null;
  let aktifX = 0;
  let aktifBolge: Zone | null = null;
  let aktifTur: "din" | "plaka" | null = null;
  let aktifYukseklik = 0;
  let sonGrup: string | null = null;

  const rayiKapat = () => {
    if (!aktif) return;
    aktif.heightMm = aktifYukseklik + aktif.ductMm;
    aktif.usedMm = aktifX;
    y += aktif.heightMm;
    aktif = null;
    aktifX = 0;
    aktifYukseklik = 0;
    sonGrup = null;
  };

  const rayiAc = (zone: Zone, tur: "din" | "plaka"): Rail => {
    rayiKapat();
    const yeni: Rail = {
      index: rails.length,
      zone,
      kind: tur,
      yMm: y,
      heightMm: 0,
      usedMm: 0,
      capacityMm: kapasite,
      ductMm: s.railDuctMm,
    };
    rails.push(yeni);
    aktif = yeni;
    aktifBolge = zone;
    aktifTur = tur;
    return yeni;
  };

  for (const d of sirala(devices)) {
    const zone = (d.zone ?? "kumanda") as Zone;
    const tur: "din" | "plaka" = d.mountType === "plaka" ? "plaka" : "din";
    const birimEn = d.widthMm ?? 0;
    const boy = d.heightMm ?? 0;
    // Isı payı ray satırının yüksekliğine girer — bölge sırasının değil
    // ÜRETİCİ ÖLÇÜSÜNÜN dayattığı bir kısıttır (PANO-7).
    const yukseklikIhtiyaci = boy + d.clearanceTopMm + d.clearanceBottomMm;

    let kalan = Math.min(d.unitCount, MAX_UNITS);
    let dilim = 0;

    while (kalan > 0) {
      const ray: Rail =
        aktif === null || aktifBolge !== zone || aktifTur !== tur
          ? rayiAc(zone, tur)
          : aktif;

      // Farklı aileden iki cihaz arasında pay bırakılır; aynı ailenin modüler
      // cihazları yan yana YAPIŞIR (PANO-8).
      const pay = aktifX > 0 && sonGrup !== null && sonGrup !== d.colorGroup ? s.familyGapMm : 0;
      const bosluk = ray.capacityMm - aktifX - pay;

      const sigan = birimEn > 0 ? Math.floor(bosluk / birimEn) : 0;
      const konacak = d.splittable ? Math.min(kalan, sigan) : sigan >= kalan ? kalan : 0;

      if (konacak <= 0) {
        if (aktifX === 0) {
          // Boş rayda bile sığmıyor: bu gövde bu ene yetmiyor.
          unplaced.push({
            device: d,
            reason: "sigmadi",
            note: `${Math.round(birimEn * (d.splittable ? 1 : kalan))} mm, ray kapasitesi ${Math.round(ray.capacityMm)} mm`,
          });
          kalan = 0;
          break;
        }
        rayiAc(zone, tur);
        continue;
      }

      const x = aktifX + pay;
      placements.push({
        deviceKey: d.key,
        label: dilim === 0 ? d.label : `${d.label}/${dilim + 1}`,
        panelCode: d.panelCode,
        colorGroup: d.colorGroup,
        mountType: d.mountType === "plaka" ? "plaka" : "din",
        zone,
        railIndex: ray.index,
        xMm: x,
        yMm: ray.yMm + d.clearanceTopMm,
        widthMm: birimEn * konacak,
        heightMm: boy,
        depthMm: d.depthMm ?? 0,
        unitCount: konacak,
        dimSource: d.dimSource ?? "tahmin",
        pinned: d.pinned,
      });

      aktifX = x + birimEn * konacak;
      aktifYukseklik = Math.max(aktifYukseklik, yukseklikIhtiyaci);
      sonGrup = d.colorGroup;
      kalan -= konacak;
      dilim++;
    }
  }
  rayiKapat();

  const usedMm = rails.reduce((t, r) => t + r.usedMm, 0);
  const capacityMm = rails.reduce((t, r) => t + r.capacityMm, 0);
  return {
    rails,
    placements,
    unplaced,
    totalHeightMm: y + s.edgeGapMm,
    usedMm,
    capacityMm,
  };
}

/** Kapak üstü aygıtları ızgaraya dizer (ayrı görünüş). */
function kapagaDiz(
  devices: DeviceBox[],
  panelWidthMm: number,
  panelHeightMm: number,
  s: LayoutSettings
): Placement[] {
  const out: Placement[] = [];
  const kenar = 60;
  const adim = 90;
  const kapasite = panelWidthMm - 2 * kenar;
  const sutun = Math.max(1, Math.floor(kapasite / adim));
  let i = 0;
  for (const d of sirala(devices)) {
    if (!olculuMu(d)) continue;
    const satir = Math.floor(i / sutun);
    const kolon = i % sutun;
    const y = kenar + satir * adim;
    if (y + adim > panelHeightMm - kenar) break;
    out.push({
      deviceKey: d.key,
      label: d.label,
      panelCode: d.panelCode,
      colorGroup: d.colorGroup,
      mountType: "kapak",
      zone: (d.zone ?? "kumanda") as Zone,
      railIndex: satir,
      xMm: kenar + kolon * adim,
      yMm: y,
      widthMm: d.widthMm ?? 0,
      heightMm: d.heightMm ?? 0,
      depthMm: d.depthMm ?? 0,
      unitCount: 1,
      dimSource: d.dimSource ?? "tahmin",
      pinned: false,
    });
    i++;
  }
  return out;
}

interface Ayirma {
  plaka: DeviceBox[];
  kapak: DeviceBox[];
  govde: DeviceBox[];
  /** Pano YANINA asılanlar — yerleşmez ama çizilir. */
  yan: DeviceBox[];
  disari: Unplaced[];
}

/** Aygıtları montaj tipine göre ayırır; yerleşemeyeni SEBEBİYLE kaydeder. */
function ayir(devices: DeviceBox[]): Ayirma {
  const out: Ayirma = { plaka: [], kapak: [], govde: [], yan: [], disari: [] };
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
    if (d.mountType === "govde") {
      out.govde.push(d);
      continue;
    }
    // PANO YANI KUYRUĞA DÜŞMEZ, LİSTEYE GİRER. Ölçüsü bilinmese de görünür:
    // bir sirenin eni panoyu büyütmez, o yüzden burada ölçü aranmaz — ölçü
    // denetimi `olcusuz` yalnız plakaya/kapağa GİREN cihaz için geçerlidir.
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
    if (d.mountType === "kapak") out.kapak.push(d);
    else out.plaka.push(d);
  }
  return out;
}

/** Panonun gerektirdiği derinlik [mm] — ızgaraya yuvarlanmadan önce. */
function derinlikIhtiyaci(
  plaka: Placement[],
  kapak: Placement[],
  s: LayoutSettings
): number {
  const enDerin = plaka.reduce((m, p) => Math.max(m, p.depthMm), 0);
  const kapakDerin = kapak.reduce((m, p) => Math.max(m, p.depthMm), 0);
  // Kapak cihazı kapağın İÇ yüzeyinden içeri girer; plakadaki cihazla aynı
  // hacmi paylaşmaz, ikisi ARDIŞIK durur.
  return enDerin + s.backGapMm + (kapakDerin > 0 ? kapakDerin + s.doorGapMm : 0);
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
 * yine de çizilir. `enIyiPlakaSecimi` ile aynı ilke: hiçbir aday sığdıramıyorsa
 * EN AZ SIĞMAYAN BIRAKAN seçilir ki ekran yine de bir şey gösterebilsin.
 */
export function solvePanel(
  input: PanelInput,
  heightMm: number,
  s: LayoutSettings,
  prefs: LineupPrefs
): PanelSolve {
  const { plaka, kapak, govde, yan, disari } = ayir(input.devices);
  const yukseklikKapasitesi = plateCapacityHeightMm(heightMm, s);

  const kilitliEn = input.override?.widthLocked ? input.override.widthMm : null;
  const adaylar = kilitliEn ? [kilitliEn] : [...PANEL_WIDTHS_MM];

  let enIyi: { en: number; paket: PackResult } | null = null;

  for (const en of adaylar) {
    const paket = paketle(plaka, en, heightMm, s);
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

  const secilen = enIyi ?? { en: PANEL_WIDTHS_MM[0], paket: paketle(plaka, PANEL_WIDTHS_MM[0], heightMm, s) };
  const kapakYerlesim = kapagaDiz(kapak, secilen.en, heightMm, s);
  const gerekliDerinlik = derinlikIhtiyaci(secilen.paket.placements, kapakYerlesim, s);

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
    doorPlacements: kapakYerlesim,
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
 * ötekinde kumanda ve klemens durur. Bir bölgeyi ikiye kesmek aynı işlevin
 * kablosunu iki gövde arasında gezdirirdi.
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
    // TEK BÖLGE DE BÖLÜNEBİLMELİDİR ve bu ölçülmüş bir durumdur: 0019'un
    // LVD10'unda 195 parçanın neredeyse tamamı KLEMENSTİR, yani tek bölge.
    // Bölme yalnız bölge sınırında yapılsaydı özyineleme ilerlemez ve pano
    // hiçbir zaman sığmazdı. Tek bölgede sınır aygıt sırasının ORTASIDIR;
    // sıra doğal kod sırası olduğu için -X1…-X20 ile -X21…-X40 ayrılır ve
    // aynı şeridin ortasından kesilmez.
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
 * Sığana kadar böler — en çok `MAX_SPLIT` tur.
 *
 * Bölme HARF EKLER ve tur sayısı arttıkça ad uzar (`LVD10-A-B`); bu bilerek
 * böyledir, çünkü kullanıcı kaç kez bölündüğünü addan okumalıdır. Tur sınırı
 * bir kısıt değil özyinelemenin durma garantisidir.
 */
const MAX_SPLIT = 4;

function bolerekCoz(
  panels: PanelInput[],
  heightMm: number,
  s: LayoutSettings,
  prefs: LineupPrefs
): { girdiler: PanelInput[]; cozumler: PanelSolve[] } {
  let girdiler = panels;
  let cozumler = girdiler.map((p) => solvePanel(p, heightMm, s, prefs));

  for (let tur = 0; tur < MAX_SPLIT; tur++) {
    if (cozumler.every((c) => c.fits)) break;
    const yeni: PanelInput[] = [];
    let degisti = false;
    for (let i = 0; i < girdiler.length; i++) {
      // Kilitli enli pano BÖLÜNMEZ: kullanıcı o gövdeyi bilerek seçmiştir;
      // sistem onu ikiye ayırırsa verilen sipariş ile plan ayrışır.
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
    cozumler = girdiler.map((p) => solvePanel(p, heightMm, s, prefs));
  }

  return { girdiler, cozumler };
}

export interface SolveAllInput {
  panels: PanelInput[];
  settings: LayoutSettings;
  /**
   * BU DİZİNİN sipariş tercihleri (`settings.room` ya da `settings.field`).
   *
   * Çözücü hangi diziyi çözdüğünü BİLMEZ ve bilmemelidir — çağıran söyler.
   * Tercihi `settings` içinden kendisi seçseydi, "oda mı saha mı" sorusu iki
   * ayrı yerde cevaplanır ve bir gün ayrışırdı.
   */
  prefs: LineupPrefs;
}

export interface SolveAllResult {
  layouts: PanelLayout[];
  unplaced: Unplaced[];
  heightMm: number;
  depthMm: number;
}

/**
 * BİR DİZİYİ çözer: ortak yükseklik ve ortak derinlik burada belirlenir.
 *
 * Yükseklik adayları KÜÇÜKTEN BÜYÜĞE denenir ama 1800'ün altı bir eşiğe
 * bağlıdır (kullanıcı kararı, 06.09.2026) — ayrıntı aşağıdaki blokta.
 *
 * PANO BAŞINA KİLİTLİ ÖLÇÜ DİZİNİN TAMAMINI BAĞLAR: dizide ortak yükseklik ve
 * ortak derinlik zorunludur (PANO-2), dolayısıyla bir panonun kilitlediği
 * değer dizinin TABANIDIR. Kullanıcı bir panoyu 600 mm derin istediyse
 * dizideki hiçbir pano ondan sığ olamaz.
 */
export function solveLineup(input: SolveAllInput): SolveAllResult {
  const s = input.settings;
  const tercih = input.prefs;
  if (input.panels.length === 0) {
    return {
      layouts: [],
      unplaced: [],
      heightMm: tercih.heightMm ?? AUTO_HEIGHTS_MM[0],
      depthMm: tercih.depthMm ?? PANEL_DEPTHS_MM[0],
    };
  }

  // PANO BAŞINA KİLİTLİ YÜKSEKLİK DİZİYİ BAĞLAR (PANO-2): ortak yükseklik
  // zorunlu olduğu için kilitli en büyük değer dizinin tabanıdır. Bunu yok
  // saymak, ekranda "kilitledim" diyen bir seçimi sessizce ezerdi.
  const kilitliYukseklikler = input.panels
    .map((p) => (p.override?.heightLocked ? p.override.heightMm : null))
    .filter((v): v is number => typeof v === "number" && v > 0);
  const yukseklikTabani = kilitliYukseklikler.length ? Math.max(...kilitliYukseklikler) : 0;

  const yukseklikAdaylari = tercih.heightMm
    ? [tercih.heightMm]
    : [...AUTO_HEIGHTS_MM].filter((h) => h >= yukseklikTabani);

  // ═══════════════════════════════════════════ YÜKSEKLİK NASIL SEÇİLİR
  //
  // Adaylar KÜÇÜKTEN BÜYÜĞE denenir ama 1800'ün ALTI bir eşiğe bağlıdır
  // (kullanıcı kararı, 06.09.2026): küçük bir işte 1400 yeterliyse 1400
  // seçilir, gereksiz büyük gövde alınmaz; ama sıkışan bir iş küçük gövdeye
  // TIKIŞTIRILMAZ. Üç şart birlikte aranır ve biri eksikse bir üst boya
  // geçilir:
  //
  //   1. Bütün panolar sığmalı.
  //   2. Doluluk payı korunmalı (`fillWarnRatio`, öntanım %80) — dolu bir
  //      panonun ilave yeri kalmaz ve bir sonraki revizyonda gövde değişir.
  //   3. HİÇBİR PANO BÖLÜNMEMELİ. Bu şart olmasaydı 1400, panoyu ikiye ayırıp
  //      "sığdı" derdi: yükseklikten kazanılan, EN'den iki kat geri verilirdi.
  //
  // 1800 ve üstünde eşik aranmaz; oraya zaten sığmadığı için çıkılır.
  let secilen: { h: number; girdiler: PanelInput[]; cozumler: PanelSolve[] } | null = null;

  for (const h of yukseklikAdaylari) {
    const deneme = bolerekCoz(input.panels, h, s, tercih);
    const sigmayan = deneme.cozumler.filter((c) => !c.fits).length;

    if (sigmayan === 0) {
      const bolundu = deneme.girdiler.length > input.panels.length;
      const enDoluOran = deneme.cozumler.reduce((m, c) => Math.max(m, c.heightFill), 0);
      const rahat = !bolundu && enDoluOran <= s.fillWarnRatio;

      // Kullanıcı bir yükseklik verdiyse aday tektir ve eşik aranmaz.
      if (h >= PREFERRED_HEIGHT_MM || rahat || yukseklikAdaylari.length === 1) {
        secilen = { h, girdiler: deneme.girdiler, cozumler: deneme.cozumler };
        break;
      }
      // Sığdı ama rahat değil: daha büyük gövdeye bak. Yine de elde tut —
      // hiçbir aday rahat çıkmazsa bu, sığan tek çözüm olarak kalabilir.
      if (!secilen) secilen = { h, girdiler: deneme.girdiler, cozumler: deneme.cozumler };
      continue;
    }

    // HİÇBİR YÜKSEKLİK SIĞDIRAMIYORSA en az pano bırakan seçilir ki ekran yine
    // de bir şey gösterebilsin (`enIyiPlakaSecimi` ile aynı ilke).
    const oncekiSigmayan = secilen
      ? secilen.cozumler.filter((c) => !c.fits).length
      : Number.POSITIVE_INFINITY;
    if (oncekiSigmayan > 0 && sigmayan < oncekiSigmayan) {
      secilen = { h, girdiler: deneme.girdiler, cozumler: deneme.cozumler };
    }
  }

  const { h: secilenYukseklik, girdiler: tumGirdiler, cozumler: tumCozumler } = secilen as {
    h: number;
    girdiler: PanelInput[];
    cozumler: PanelSolve[];
  };

  // BOŞ GÖZ SİPARİŞ EDİLMEZ.
  //
  // Ölçüldü (0019, 08.09.2026): bölme aygıt listesini ikiye ayırır ama bir
  // yarının bütün aygıtları PANO DIŞI (saha) çıkabilir — motor, enkoder, limit
  // şalteri. Geriye plakasında, kapağında ve gövdesinde hiçbir şey olmayan bir
  // gövde kalıyordu; gerçek belgede DÖRT böyle göz vardı ve her biri
  // 400 x 2000 x 600 mm'lik bir pano olarak imalatçıya gidiyordu.
  //
  // Aygıtları KAYBOLMAZ: saha aygıtları zaten `solvePanel` içinde kuyruğa
  // düşüyor ve o kuyruk aşağıda bütün çözümlerden toplanıyor.
  const doluMu = (c: PanelSolve): boolean =>
    c.layout.placements.length > 0 ||
    c.layout.doorPlacements.length > 0 ||
    c.layout.bodyDevices.length > 0 ||
    c.layout.sideDevices.length > 0;

  const tutulan = tumCozumler.map((c, i) => ({ c, g: tumGirdiler[i] })).filter((x) => doluMu(x.c));
  const girdiler = tutulan.map((x) => x.g);
  const cozumler = tutulan.map((x) => x.c);

  // BÖLÜNMÜŞ GÖZ SIRAYLA HARFLENİR. Özyineleme `LVD10-B-A-A` gibi adlar
  // üretiyordu; o ad kaç turda bölündüğünü anlatır ama panonun üstüne
  // yapıştırılacak etiket odur ve elektrikçi onu okuyamaz. Kaynak panonun
  // gözleri soldan sağa `-A`, `-B`, `-C` olur; bölünmemiş pano adını korur.
  const kaynakKodlari = [...new Set(input.panels.map((p) => p.code))];
  const kaynakKodu = new Map<string, string>();
  const sonKod = new Map<string, string>();
  const sayac = new Map<string, number>();

  for (const g of girdiler) {
    if (kaynakKodlari.includes(g.code)) {
      sonKod.set(g.code, g.code);
      continue;
    }
    // En UZUN eşleşen kaynak seçilir: `LVD1` ve `LVD10` birlikte varken
    // `LVD10-A` yanlışlıkla `LVD1`in gözü sayılmamalı.
    let kaynak = "";
    for (const kod of kaynakKodlari) {
      if (g.code.startsWith(`${kod}-`) && kod.length > kaynak.length) kaynak = kod;
    }
    if (!kaynak) {
      sonKod.set(g.code, g.code);
      continue;
    }
    const n = (sayac.get(kaynak) ?? 0) + 1;
    sayac.set(kaynak, n);
    const harf = String.fromCharCode(64 + n); // 1 → A
    const yeniKod = `${kaynak}-${harf}`;
    sonKod.set(g.code, yeniKod);
    kaynakKodu.set(yeniKod, kaynak);
  }

  // ORTAK DERİNLİK: en derin panonunki hepsine yazılır (PANO-2).
  //
  // PANO BAŞINA KİLİTLİ DERİNLİK DE BİR TABANDIR: kullanıcı bir panoyu 600 mm
  // istediyse dizideki hiçbir pano ondan sığ olamaz. Kilidi yok saymak, ekranda
  // yapılan bir seçimi sessizce ezerdi.
  const kilitliDerinlikler = girdiler
    .map((g) => (g.override?.depthLocked ? g.override.depthMm : null))
    .filter((v): v is number => typeof v === "number" && v > 0);
  const gerekli = Math.max(
    cozumler.reduce((m, c) => Math.max(m, c.layout.requiredDepthMm), 0),
    ...(kilitliDerinlikler.length ? kilitliDerinlikler : [0])
  );
  const ortakDerinlik =
    tercih.depthMm ??
    ceilToGrid(gerekli, PANEL_DEPTHS_MM) ??
    PANEL_DEPTHS_MM[PANEL_DEPTHS_MM.length - 1];

  const layouts = cozumler.map((c) => {
    const kod = sonKod.get(c.layout.code) ?? c.layout.code;
    const kaynak = kaynakKodu.get(kod) ?? null;
    const uyarilar = [...c.layout.warnings];
    if (kaynak) uyarilar.unshift(`${kaynak} tek gövdeye sığmadı; birden çok göze ayrıldı.`);

    // ÖLÇÜSÜ OLMAYAN CİHAZ VARSA GÖVDE ÖLÇÜSÜ EKSİK HESAPLANMIŞTIR ve bunu
    // söylemek zorunludur: sürücüsü ölçülmemiş bir pano 250 mm derinlik
    // gösterir ve o panoyu sipariş etmek sahada 400 mm eksik bırakırdı.
    const olcusuz = c.unplaced.filter((u) => u.reason === "olcusuz").length;
    if (olcusuz > 0) {
      uyarilar.push(
        `${olcusuz} cihazın ölçüsü bilinmiyor; en ve derinlik EKSİK hesaplandı.`
      );
    }

    return {
      ...c.layout,
      code: kod,
      name: kaynak ? `${kaynak} (${kod.slice(kaynak.length + 1)})` : c.layout.name,
      depthMm: ortakDerinlik,
      splitOf: kaynak,
      warnings: uyarilar,
    } satisfies PanelLayout;
  });

  // KUYRUK BÜTÜN ÇÖZÜMLERDEN TOPLANIR, yalnız tutulanlardan değil: boş göz
  // düşürülse de içindeki saha aygıtları kullanıcıya görünmeye devam eder.
  const unplaced = tumCozumler.flatMap((c) => c.unplaced);
  return { layouts, unplaced, heightMm: secilenYukseklik, depthMm: ortakDerinlik };
}

export { DEFAULT_SETTINGS };
