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
  DEFAULT_SETTINGS,
  ROOM_GRID,
  type LineupGrid,
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
 * Bir panonun ray satırlarını kurar — MÜMKÜN OLDUĞUNCA SIKI (PANO-37).
 *
 * ═══════════════════════════════════════════ BÖLGE ARTIK RAY AÇMAZ
 *
 * İlk sürüm bölge değişince yeni ray açıyordu ("bir ray tek işleve aittir").
 * Ölçüldü ve kullanıcı gördü (09.09.2026): beş bölge beş ray demekti ve her
 * rayın sağında metrelerce boşluk kalıyordu — bir bölgede tek cihaz varsa o
 * cihaz 1010 mm'lik bir rayı tek başına işgal ediyordu. Kullanıcının cümlesi:
 * *"gruplandırmaya gerek yok, yan yana koyulabilir; mümkün olduğunca
 * sığdırmaya çalışacağız."*
 *
 * Bölge sırası KORUNUR (`sirala`) — cihazlar hâlâ giriş → güç → motor →
 * kumanda → klemens sırasında dizilir; yalnız o sıra bir RAY SINIRI değildir.
 *
 * ═══════════════════════════════════════════ DIN ile PLAKA AYRI KALIR
 *
 * Bu bir gruplama değil FİZİKTİR: DIN rayına oturan cihaz 35 mm'lik profilin
 * üstündedir, plakaya vidalanan cihaz plakanın kendisindedir. İkisini aynı
 * satıra koymak, kontaktörü sürücünün üstüne asmak olurdu.
 *
 * ═══════════════════════════════════════════ İLK SIĞAN RAY (first-fit)
 *
 * Bir cihaz o anki rayın sonuna sığmıyorsa ÖNCEKİ raylara bakılır. Koşul
 * dardır ve bilinçlidir: cihaz ancak o rayın MEVCUT yüksekliğini büyütmüyorsa
 * oraya konur. Büyütseydi altındaki bütün rayların yeri kayardı ve
 * kullanıcının şemada gördüğü sıra her yerleştirmede zıplardı.
 *
 * ═══════════════════════════════════════════ İKİ GEÇİŞ
 *
 * Önce cihazlar raylara DAĞITILIR, sonra ray yükseklikleri ve y konumları
 * hesaplanır. Tek geçişte yapılamaz: bir raya sonradan cihaz eklenebildiği
 * için rayın yüksekliği ancak dağıtım bittiğinde kesinleşir.
 */
interface RayTaslagi {
  index: number;
  zone: Zone;
  kind: "din" | "plaka";
  x: number;
  /** Bu raydaki en yüksek ısı payı dâhil yükseklik ihtiyacı [mm]. */
  yukseklik: number;
  /** Rayın son cihazının renk grubu — aile payı için. */
  sonGrup: string | null;
  yerlesimler: {
    d: DeviceBox;
    dilim: number;
    xMm: number;
    adet: number;
  }[];
}

function paketle(
  devices: DeviceBox[],
  panelWidthMm: number,
  panelHeightMm: number,
  s: LayoutSettings
): PackResult {
  const kapasite = railCapacityMm(panelWidthMm, s);
  const unplaced: Unplaced[] = [];
  const raylar: RayTaslagi[] = [];

  const rayAc = (zone: Zone, kind: "din" | "plaka"): RayTaslagi => {
    const yeni: RayTaslagi = {
      index: raylar.length,
      zone,
      kind,
      x: 0,
      yukseklik: 0,
      sonGrup: null,
      yerlesimler: [],
    };
    raylar.push(yeni);
    return yeni;
  };

  /** Bu rayda, aile payı düşülmüş, kaç birim daha yer var? */
  const bosluk = (r: RayTaslagi, d: DeviceBox): number => {
    const pay = r.x > 0 && r.sonGrup !== null && r.sonGrup !== d.colorGroup ? s.familyGapMm : 0;
    return kapasite - r.x - pay;
  };

  const koy = (r: RayTaslagi, d: DeviceBox, dilim: number, adet: number, birimEn: number) => {
    const pay = r.x > 0 && r.sonGrup !== null && r.sonGrup !== d.colorGroup ? s.familyGapMm : 0;
    r.yerlesimler.push({ d, dilim, xMm: r.x + pay, adet });
    r.x += pay + birimEn * adet;
    r.sonGrup = d.colorGroup;
    r.yukseklik = Math.max(r.yukseklik, (d.heightMm ?? 0) + d.clearanceTopMm + d.clearanceBottomMm);
  };

  // ── 1. GEÇİŞ: cihazları raylara dağıt ──────────────────────────────────
  for (const d of sirala(devices)) {
    const zone = (d.zone ?? "kumanda") as Zone;
    const kind: "din" | "plaka" = d.mountType === "plaka" ? "plaka" : "din";
    const birimEn = d.widthMm ?? 0;
    // Isı payı ray satırının yüksekliğine girer (PANO-7).
    const yukseklikIhtiyaci = (d.heightMm ?? 0) + d.clearanceTopMm + d.clearanceBottomMm;

    let kalan = Math.min(d.unitCount, MAX_UNITS);
    let dilim = 0;
    let guvenlik = 0;

    while (kalan > 0) {
      if (++guvenlik > MAX_UNITS + raylar.length + 8) break;

      // AYNI TÜRDEN son ray etkin raydır; yoksa yeni açılır.
      let hedef: RayTaslagi | null = null;
      for (let i = raylar.length - 1; i >= 0; i--) {
        if (raylar[i].kind === kind) {
          hedef = raylar[i];
          break;
        }
      }
      if (!hedef) hedef = rayAc(zone, kind);

      let sigan = birimEn > 0 ? Math.floor(bosluk(hedef, d) / birimEn) : 0;
      let konacak = d.splittable ? Math.min(kalan, sigan) : sigan >= kalan ? kalan : 0;

      // ÖNCEKİ RAYLARDAKİ BOŞLUKLAR — yalnız rayı BÜYÜTMEYEN cihaz girer.
      if (konacak <= 0) {
        for (const r of raylar) {
          if (r === hedef || r.kind !== kind) continue;
          if (yukseklikIhtiyaci > r.yukseklik) continue;
          const n = birimEn > 0 ? Math.floor(bosluk(r, d) / birimEn) : 0;
          const k = d.splittable ? Math.min(kalan, n) : n >= kalan ? kalan : 0;
          if (k > 0) {
            hedef = r;
            sigan = n;
            konacak = k;
            break;
          }
        }
      }

      if (konacak <= 0) {
        // Hiçbir rayda yer yok. Etkin ray BOŞSA cihaz bu gövdeye hiç sığmıyor
        // demektir; doluysa yeni bir ray açılır.
        if (hedef.x === 0) {
          unplaced.push({
            device: d,
            reason: "sigmadi",
            note: `${Math.round(birimEn * (d.splittable ? 1 : kalan))} mm, ray kapasitesi ${Math.round(kapasite)} mm`,
          });
          break;
        }
        rayAc(zone, kind);
        continue;
      }

      koy(hedef, d, dilim, konacak, birimEn);
      kalan -= konacak;
      dilim++;
    }
  }

  // ── 2. GEÇİŞ: ray yükseklikleri, y konumları, yerleşimler ──────────────
  const rails: Rail[] = [];
  const placements: Placement[] = [];
  let y = s.edgeGapMm;

  for (const r of raylar) {
    const ray: Rail = {
      index: r.index,
      zone: r.zone,
      kind: r.kind,
      yMm: y,
      heightMm: r.yukseklik + s.railDuctMm,
      usedMm: r.x,
      capacityMm: kapasite,
      ductMm: s.railDuctMm,
    };
    rails.push(ray);

    for (const { d, dilim, xMm, adet } of r.yerlesimler) {
      placements.push({
        deviceKey: d.key,
        label: dilim === 0 ? d.label : `${d.label}/${dilim + 1}`,
        panelCode: d.panelCode,
        colorGroup: d.colorGroup,
        mountType: d.mountType === "plaka" ? "plaka" : "din",
        zone: (d.zone ?? "kumanda") as Zone,
        railIndex: ray.index,
        xMm,
        yMm: ray.yMm + d.clearanceTopMm,
        widthMm: (d.widthMm ?? 0) * adet,
        heightMm: d.heightMm ?? 0,
        depthMm: d.depthMm ?? 0,
        unitCount: adet,
        dimSource: d.dimSource ?? "tahmin",
        pinned: d.pinned,
      });
    }
    y += ray.heightMm;
  }

  // BOŞ RAY KALMAZ: `rayAc` sonrası cihaz konamadığı durumda boş bir taslak
  // kalabilir ve o ray şemada boş bir şerit olarak çizilirdi.
  const doluIndeks = new Map<number, number>();
  const doluRaylar: Rail[] = [];
  let yy = s.edgeGapMm;
  for (const ray of rails) {
    if (ray.usedMm <= 0) continue;
    doluIndeks.set(ray.index, doluRaylar.length);
    doluRaylar.push({ ...ray, index: doluRaylar.length, yMm: yy });
    yy += ray.heightMm;
  }
  const kaymis = placements.map((y2) => {
    const yeniIndeks = doluIndeks.get(y2.railIndex);
    if (yeniIndeks === undefined) return y2;
    const eski = rails[y2.railIndex];
    const yeni = doluRaylar[yeniIndeks];
    return { ...y2, railIndex: yeniIndeks, yMm: y2.yMm - eski.yMm + yeni.yMm };
  });

  const usedMm = doluRaylar.reduce((t, r) => t + r.usedMm, 0);
  const capacityMm = doluRaylar.reduce((t, r) => t + r.capacityMm, 0);
  return {
    rails: doluRaylar,
    placements: kaymis,
    unplaced,
    totalHeightMm: yy + s.edgeGapMm,
    usedMm,
    capacityMm,
  };
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
    //
    // Kapak: kullanıcı kararı 09.09.2026 — "kapak üzerinde veya pano içerisinde
    // priz, aydınlatma, buton vs ekipmanlar yerleşimde olmaz ve kapakta da
    // görünmesine gerek yok."
    // Zemin: trafo panonun tabanındadır, montaj plakasında değil.
    if (d.mountType === "govde" || d.mountType === "kapak" || d.mountType === "zemin") {
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
    out.plaka.push(d);
  }
  return out;
}

/**
 * Panonun gerektirdiği derinlik [mm] — ızgaraya yuvarlanmadan önce.
 *
 * KAPAK KATKISI KALKTI (PANO-37): kapak cihazları artık yerleştirilmiyor, o
 * yüzden kapağın iç yüzeyinden içeri giren bir derinlik de hesaplanmıyor.
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
 * yine de çizilir. `enIyiPlakaSecimi` ile aynı ilke: hiçbir aday sığdıramıyorsa
 * EN AZ SIĞMAYAN BIRAKAN seçilir ki ekran yine de bir şey gösterebilsin.
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

  const enTaban = izgara.widths[0];
  const secilen = enIyi ?? { en: enTaban, paket: paketle(plaka, enTaban, heightMm, s) };
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
    // KAPAK YERLEŞİMİ ÇİZİLMEZ (PANO-37, kullanıcı kararı 09.09.2026).
    // Alan tipte kalır: bir gün istenirse `ayir` kapak cihazlarını yine
    // ayırabilir ve bütün tüketiciler zaten boş listeyi doğru karşılıyor.
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
    cozumler = girdiler.map((p) => solvePanel(p, heightMm, s, prefs, izgara));
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
  /**
   * BU DİZİNİN gövde ızgarası (`ROOM_GRID` ya da `FIELD_GRID`, PANO-33).
   *
   * `prefs` ile aynı gerekçeyle çağıran verir: çözücü oda mı saha mı çözdüğünü
   * bilmez. Verilmezse oda ızgarası kullanılır — mevcut çağıranlar ve testler
   * bozulmasın diye.
   */
  izgara?: LineupGrid;
}

export interface SolveAllResult {
  layouts: PanelLayout[];
  unplaced: Unplaced[];
  /**
   * Dizinin ortak yüksekliği; ORTAK DEĞİLSE en yüksek gövdeninki.
   *
   * `sharedHeight` false iken bu sayı tek başına bir sipariş kararı DEĞİLDİR —
   * ekran ve çıktı "kutu başına" yazar. Tek bir sayı basmak, alınmamış bir
   * ortak kararı bildirmek olurdu.
   */
  heightMm: number;
  depthMm: number;
  /** Gözler ortak yükseklik paylaşıyor mu (`LineupGrid.sharedHeight`)? */
  sharedHeight: boolean;
}

/**
 * VERİLEN PANO KÜMESİ İÇİN ORTAK BİR BOY SEÇER ve sığmayanları böler.
 *
 * Ortak yükseklik isteyen dizide (oda) bütün panolarla BİR KEZ, kutu başına
 * ölçü isteyen dizide (saha) her pano için AYRI çağrılır — ikinci durumda
 * "küme" tek elemanlıdır ve dolayısıyla "ortak boy" o kutunun kendi boyudur.
 */
function yukseklikSec(
  panels: PanelInput[],
  s: LayoutSettings,
  tercih: LineupPrefs,
  izgara: LineupGrid
): { h: number; girdiler: PanelInput[]; cozumler: PanelSolve[] } {
  // PANO BAŞINA KİLİTLİ YÜKSEKLİK DİZİYİ BAĞLAR (PANO-2): ortak yükseklik
  // zorunlu olduğu için kilitli en büyük değer dizinin tabanıdır. Bunu yok
  // saymak, ekranda "kilitledim" diyen bir seçimi sessizce ezerdi.
  //
  // ORTAK YÜKSEKLİK YOKSA (saha) bu işlev pano BAŞINA çağrılır ve "dizi"
  // tek gözdür; kilit yalnız kendi kutusunu bağlar.
  const kilitliYukseklikler = panels
    .map((p) => (p.override?.heightLocked ? p.override.heightMm : null))
    .filter((v): v is number => typeof v === "number" && v > 0);
  const yukseklikTabani = kilitliYukseklikler.length ? Math.max(...kilitliYukseklikler) : 0;

  // ORTAK BOY VARKEN KİLİT BİR TABANDIR, TEK KUTUDA İSE KİLİTTİR.
  //
  // Dizide bütün gözler aynı boyu paylaşmak zorunda olduğu için bir panonun
  // kilidi ancak "bundan alçak olamaz" diyebilir. Ortak boy yokken böyle bir
  // zorunluluk yoktur: kullanıcı o kutuyu 600 mm istediyse 600 mm alır, arama
  // onu 1400'e çıkarmaz — ekranda "kilitledim" diyen bir seçimi ezmek, bu
  // modülün baştan beri kaçındığı şeydir.
  const yukseklikAdaylari = tercih.heightMm
    ? [tercih.heightMm]
    : !izgara.sharedHeight && yukseklikTabani > 0
      ? [yukseklikTabani]
      : [...izgara.heights].filter((h) => h >= yukseklikTabani);

  // ═══════════════════════════════════════ TEK KUTU: EN KÜÇÜK ÖN YÜZ
  //
  // Ortak boy YOKSA (saha) kutu bir DİZİNİN GÖZÜ değil, tek başına sipariş
  // edilen bir üründür; o yüzden ölçüt de değişir. Diziyi çözerken önce boy
  // küçültülür çünkü boy bütün gözlerde ortaktır; tek kutuda böyle bir
  // ortaklık yoktur ve "önce en alçağı" ölçütü ölçüldüğü gibi ters teper:
  // 0019'un `TB3`ü 500 mm boy uğruna 800 mm'ye genişliyordu (0,40 m²), oysa
  // 400 x 600 (0,24 m²) aynı üç cihazı alıyor ve duvara asılan bir kutuda
  // asıl sıkıntı olan GENİŞLİK yarıya iniyor.
  //
  // Bu yüzden burada bütün boylar denenir ve ÖN YÜZ ALANI en küçük olan
  // seçilir; eşitlikte alçak olan kazanır. "Rahat" şartı (bölünmemiş + doluluk
  // payı korunmuş) hâlâ önceliklidir — hiçbir aday rahat değilse sığanların
  // en küçüğü alınır.
  if (!izgara.sharedHeight) {
    type Aday = {
      h: number;
      girdiler: PanelInput[];
      cozumler: PanelSolve[];
      sigmayan: number;
      rahat: boolean;
      alan: number;
    };
    const adaylar: Aday[] = [];
    for (const h of yukseklikAdaylari) {
      const deneme = bolerekCoz(panels, h, s, tercih, izgara);
      const sigmayan = deneme.cozumler.filter((c) => !c.fits).length;
      const bolundu = deneme.girdiler.length > panels.length;
      const enDoluOran = deneme.cozumler.reduce((m, c) => Math.max(m, c.heightFill), 0);
      adaylar.push({
        h,
        girdiler: deneme.girdiler,
        cozumler: deneme.cozumler,
        sigmayan,
        rahat: !bolundu && enDoluOran <= s.fillWarnRatio,
        alan: deneme.cozumler.reduce((t, c) => t + c.layout.widthMm * h, 0),
      });
    }

    const kucukten = (a: Aday, b: Aday) => a.alan - b.alan || a.h - b.h;
    const sigan = adaylar.filter((a) => a.sigmayan === 0);
    const en =
      [...sigan.filter((a) => a.rahat)].sort(kucukten)[0] ??
      [...sigan].sort(kucukten)[0] ??
      // Hiçbir boy sığdıramıyorsa en az pano bırakan seçilir ki ekran yine de
      // bir şey gösterebilsin (`enIyiPlakaSecimi` ile aynı ilke).
      [...adaylar].sort((a, b) => a.sigmayan - b.sigmayan || kucukten(a, b))[0];

    return { h: en.h, girdiler: en.girdiler, cozumler: en.cozumler };
  }

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
    const deneme = bolerekCoz(panels, h, s, tercih, izgara);
    const sigmayan = deneme.cozumler.filter((c) => !c.fits).length;

    if (sigmayan === 0) {
      const bolundu = deneme.girdiler.length > panels.length;
      const enDoluOran = deneme.cozumler.reduce((m, c) => Math.max(m, c.heightFill), 0);
      const rahat = !bolundu && enDoluOran <= s.fillWarnRatio;

      // Eşik ızgaradan gelir; `null` ise yalnız "rahat" sorulur. Kullanıcı bir
      // yükseklik verdiyse aday tektir ve eşik aranmaz.
      const esikGecildi =
        izgara.preferredHeightMm !== null && h >= izgara.preferredHeightMm;
      if (esikGecildi || rahat || yukseklikAdaylari.length === 1) {
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

  return secilen as { h: number; girdiler: PanelInput[]; cozumler: PanelSolve[] };
}

/**
 * BİR DİZİYİ çözer: ortak derinlik ve (ızgara istiyorsa) ortak yükseklik
 * burada belirlenir.
 *
 * Yükseklik adayları KÜÇÜKTEN BÜYÜĞE denenir ama 1800'ün altı bir eşiğe
 * bağlıdır (kullanıcı kararı, 06.09.2026) — ayrıntı `yukseklikSec` içinde.
 *
 * ORTAK YÜKSEKLİK IZGARAYA BAĞLIDIR (PANO-33). Odada gövdeler yan yana dizilir
 * ve üstleri hizalıdır; sahada her kutu ayrı bir duvara asılır ve ortak boy
 * dayatmak, ölçüldüğü gibi, 220 mm ray taşıyan bir kutuyu 1400 mm yaptırıyordu.
 *
 * ORTAK DERİNLİK HER İKİ DİZİDE DE KORUNUR (PANO-2): kullanıcıya sorulan
 * yalnız yükseklikti.
 *
 * PANO BAŞINA KİLİTLİ ÖLÇÜ, ORTAK OLAN NEYSE ONU BAĞLAR: kullanıcı bir panoyu
 * 600 mm derin istediyse dizideki hiçbir pano ondan sığ olamaz.
 */
export function solveLineup(input: SolveAllInput): SolveAllResult {
  const s = input.settings;
  const tercih = input.prefs;
  const izgara = input.izgara ?? ROOM_GRID;
  if (input.panels.length === 0) {
    return {
      layouts: [],
      unplaced: [],
      heightMm: tercih.heightMm ?? izgara.heights[0],
      depthMm: tercih.depthMm ?? izgara.depths[0],
      sharedHeight: izgara.sharedHeight,
    };
  }

  // HER KUTU KENDİ ÖLÇÜSÜNDE (kullanıcı kararı, 09.09.2026): ortak yükseklik
  // istenmiyorsa her pano TEK GÖZLÜ BİR DİZİ olarak çözülür ve sonuçlar
  // birleştirilir. Bölme, harfleme, boş göz düşürme ve ortak derinlik aşağıda
  // olduğu gibi çalışmaya devam eder — ayrı bir arama kodu YAZILMAZ.
  const secimler = izgara.sharedHeight
    ? [yukseklikSec(input.panels, s, tercih, izgara)]
    : input.panels.map((pano) => yukseklikSec([pano], s, tercih, izgara));

  const secilenYukseklik = Math.max(...secimler.map((x) => x.h));
  const tumGirdiler = secimler.flatMap((x) => x.girdiler);
  const tumCozumler = secimler.flatMap((x) => x.cozumler);

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
    ceilToGrid(gerekli, izgara.depths) ??
    izgara.depths[izgara.depths.length - 1];

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
  return {
    layouts,
    unplaced,
    heightMm: secilenYukseklik,
    depthMm: ortakDerinlik,
    sharedHeight: izgara.sharedHeight,
  };
}

export { DEFAULT_SETTINGS };
