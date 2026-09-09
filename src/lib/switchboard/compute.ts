// PANO YERLEŞİMİNİN TEK GİRİŞ NOKTASI — saf, deterministik, saklanmaz.
//
// PLAN SAKLANMAZ (`purchasing/hammadde/yerlesim` ile aynı doktrin): girdi ve
// kullanıcının düzeltmeleri saklanır, plan her açılışta yeniden hesaplanır.
// Bir tabloya konsaydı elektrik projesi yeniden okunduğunda (ELEKTRIK-6:
// satırlar SİLİNİP yeniden üretilir) sessizce eskirdi ve imalatçı eski plana
// bakarak pano keserdi.
//
// Onayın eskidiğini bir PARMAK İZİ gösterir: onay kaydı, onaylandığı andaki
// girdinin hash'ini taşır; bugünkü hash tutmuyorsa ekranda uyarı çıkar.

import type { ElectricalPart } from "@/lib/electrical/types";
import { auditLineup, type AuditResult } from "./audit";
import { solveLineup, type PanelInput } from "./layout";
import {
  buildDeviceBoxes,
  fingerprintOf,
  fingerprintParts,
  naturalCompare,
  panelKindFor,
} from "./panels";
import { DEFAULT_SETTINGS, FIELD_GRID, ROOM_GRID } from "./sizes";
import type {
  DeviceBox,
  DeviceModel,
  LayoutResult,
  LayoutSettings,
  LineupPrefs,
  PanelOverride,
  PlacementOverride,
  Unplaced,
} from "./types";

/**
 * Kısmi ayar girdisi — iç içe dizi tercihleri de PARÇALI verilebilir.
 *
 * `Partial<LayoutSettings>` YETMEZ: kullanıcı yalnız oda yüksekliğini
 * seçtiğinde `{ room: { heightMm: 2000 } }` gelir ve `baseMm` alanı eksiktir.
 */
export interface LayoutSettingsInput
  extends Partial<Omit<LayoutSettings, "room" | "field">> {
  room?: Partial<LineupPrefs>;
  field?: Partial<LineupPrefs>;
}

export interface ComputeInput {
  parts: ElectricalPart[];
  models?: DeviceModel[];
  panelOverrides?: PanelOverride[];
  placementOverrides?: PlacementOverride[];
  settings?: LayoutSettingsInput;
}

export interface ComputeResult extends LayoutResult {
  audits: { code: string; result: AuditResult }[];
}

/**
 * Kısmi ayarları öntanımla birleştirir.
 *
 * BİRLEŞTİRME İKİ KATLIDIR. Sığ bir yayma (`{...DEFAULT, ...partial}`)
 * `room` nesnesinin TAMAMINI değiştirirdi: kullanıcı yalnız yüksekliği
 * seçtiğinde `baseMm` `undefined` kalır, o değer panonun `baseMm` alanına
 * geçer ve çizimde "Baza undefined mm" yazar, sipariş tablosuna boş girer.
 */
export function resolveSettings(partial?: LayoutSettingsInput): LayoutSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...(partial ?? {}),
    room: { ...DEFAULT_SETTINGS.room, ...(partial?.room ?? {}) },
    field: { ...DEFAULT_SETTINGS.field, ...(partial?.field ?? {}) },
  };
}

/**
 * Elektrik projesinin okunmuş satırlarından bütün pano dizilimini üretir.
 *
 * İKİ AYRI DİZİ ÇÖZÜLÜR (PANO-2): oda panoları ve saha panoları. Ortak
 * yükseklik/derinlik kuralı her dizinin KENDİ İÇİNDE işler — saha panosu
 * elektrik odasına girmez ve odadaki 600 mm derinliği ona dayatmak, duvara
 * asılan bir klemens kutusunu gereksizce büyütürdü.
 */
export function computeSwitchboardLayout(input: ComputeInput): ComputeResult {
  const settings = resolveSettings(input.settings);

  const models = new Map((input.models ?? []).map((m) => [m.lookupKey, m]));
  const panelOverrides = new Map((input.panelOverrides ?? []).map((p) => [p.code, p]));
  const placementOverrides = new Map(
    (input.placementOverrides ?? []).map((p) => [p.deviceKey, p])
  );

  const buildInput = { parts: input.parts, models, placementOverrides, panelOverrides, settings };
  const { byPanel, untagged, codes } = buildDeviceBoxes(buildInput);

  const odaGirdi: PanelInput[] = [];
  const sahaGirdi: PanelInput[] = [];
  const excluded: { code: string; devices: number }[] = [];

  const sirali = [...codes].sort((a, b) => {
    const oa = panelOverrides.get(a)?.orderIndex;
    const ob = panelOverrides.get(b)?.orderIndex;
    if (typeof oa === "number" && typeof ob === "number" && oa !== ob) return oa - ob;
    if (typeof oa === "number" && typeof ob !== "number") return -1;
    if (typeof oa !== "number" && typeof ob === "number") return 1;
    return naturalCompare(a, b);
  });

  for (const code of sirali) {
    const devices = byPanel.get(code) ?? [];
    const override = panelOverrides.get(code) ?? null;
    const kind = code ? panelKindFor(code, settings, override) : "haric";

    // BOŞ KONUM PANO DEĞİLDİR. Ölçüldü (0019-00): 26 konum kodunun 10'unda
    // yerleşecek tek bir aygıt yok — `LVD1.1`, `LVD2`, `LVD05` gibi kodlar
    // çizimde bir SAYFA BAŞLIĞIDIR, bir gövde değil. Hepsine 400 mm pano
    // açmak diziyi 10.100 mm gösteriyordu; gerçek dizi bunun yarısı kadar.
    // Gövde gereci (lamba, fan) tek başına da pano açmaz — o gereç, cihazları
    // başka bir kodla yazılmış panonun aksesuarıdır.
    const yerlesecek = devices.filter(
      (d) => d.mountType === "din" || d.mountType === "plaka" || d.mountType === "kapak"
    ).length;

    if (kind === "haric" || !code || yerlesecek === 0) {
      if (override?.kind === "oda" || override?.kind === "saha") {
        // Kullanıcı bunun bir pano olduğunu SÖYLEDİYSE boş da olsa açılır.
      } else {
        excluded.push({ code: code || "(konumsuz)", devices: devices.length });
        continue;
      }
    }
    const girdi: PanelInput = {
      code,
      name: override?.name || code,
      kind,
      devices,
      override,
    };
    if (kind === "saha") sahaGirdi.push(girdi);
    else odaGirdi.push(girdi);
  }

  // PANO AÇMAYAN KONUMUN YAN EKİPMANI KAYBOLMAZ. Bir sirenin ya da projektörün
  // yazıldığı konum kodu bir gövde açmaz (yerleşecek aygıtı yoktur), ama o
  // cihaz sipariş edilecek ve şemada görünmelidir. `panelKindFor` "oda mı saha
  // mı" sorusunu panoya gerek duymadan cevaplar.
  const oksuzYan: { oda: DeviceBox[]; saha: DeviceBox[] } = { oda: [], saha: [] };
  const acilanKodlar = new Set([...odaGirdi, ...sahaGirdi].map((g) => g.code));
  for (const { code, devices } of [...byPanel].map(([code, devices]) => ({ code, devices }))) {
    if (acilanKodlar.has(code)) continue;
    const yan = devices.filter((d) => d.mountType === "yan");
    if (yan.length === 0) continue;
    const kind = code ? panelKindFor(code, settings, panelOverrides.get(code) ?? null) : "oda";
    (kind === "saha" ? oksuzYan.saha : oksuzYan.oda).push(...yan);
  }

  // HER DİZİ KENDİ TERCİHİYLE ÇÖZÜLÜR (PANO-2). Tek bir yükseklik/derinlik
  // ayarı ikisine birden dayatıldığında, duvara asılan bir saha kutusu
  // elektrik odasındaki 2000 mm'lik gövdenin ölçüsünü alıyordu.
  //
  // IZGARA DA AYRIDIR (PANO-33, kullanıcı kararı 09.09.2026): saha kutusunun
  // boy ızgarası 300'den başlar ve gözler ortak boy paylaşmaz.
  const oda = solveLineup({ panels: odaGirdi, settings, prefs: settings.room, izgara: ROOM_GRID });
  const saha = solveLineup({ panels: sahaGirdi, settings, prefs: settings.field, izgara: FIELD_GRID });

  const unplaced: Unplaced[] = [...oda.unplaced, ...saha.unplaced];

  // Etiketi okunamayan satır YERLEŞİM YUVASI AÇMAZ ama görünür kalır: `sort`tan
  // anahtar üretmek yeniden okumada kayardı ve düzeltme yanlış aygıta yapışırdı.
  for (const part of untagged) {
    unplaced.push({
      device: {
        key: "",
        label: part.deviceTag || "(etiketsiz)",
        panelCode: part.location,
        designation: part.designation,
        typeNo: part.typeNo,
        supplier: part.supplier,
        partNo: part.partNo,
        category: "Diğer",
        colorGroup: "diger",
        mountType: null,
        zone: null,
        widthMm: null,
        heightMm: null,
        depthMm: null,
        clearanceTopMm: settings.defaultClearanceMm,
        clearanceBottomMm: settings.defaultClearanceMm,
        dimSource: null,
        unitCount: 1,
        splittable: false,
        sort: 0,
        pinned: false,
        pinnedOrder: null,
        pinnedRail: null,
      },
      reason: "etiketsiz",
      note: "Aygıt etiketi okunamadı; yerleşim yuvası açılmadı",
    });
  }

  // SİPARİŞ KAPISI: ölçüsü doğrulanmamış (tahmin) yerleşim sayısı (PANO-12).
  const tahminAnahtarlari = new Set<string>();
  for (const p of [...oda.layouts, ...saha.layouts]) {
    for (const y of [...p.placements, ...p.doorPlacements]) {
      if (y.dimSource === "tahmin") tahminAnahtarlari.add(y.deviceKey);
    }
  }

  const fingerprint = fingerprintOf(fingerprintParts(buildInput));

  return {
    room: oda.layouts,
    field: saha.layouts,
    excluded,
    unplaced,
    // AYAR EZİLMEZ: kullanıcı ne istediyse o kalır (`null` = sistem karar
    // versin). Çözülmüş ölçü her dizi için AYRI taşınır.
    settings,
    roomSize: {
      heightMm: oda.layouts.length ? oda.heightMm : null,
      depthMm: oda.layouts.length ? oda.depthMm : null,
      panelCount: oda.layouts.length,
      sharedHeight: oda.sharedHeight,
    },
    // Bütün aygıtlar — hangi kuyruğa düştüğünden bağımsız.
    devices: [...byPanel.values()].flat().sort((a, b) => naturalCompare(a.label, b.label)),
    roomSideDevices: [
      ...oda.layouts.flatMap((p) => p.sideDevices),
      ...oksuzYan.oda,
    ].sort((a, b) => naturalCompare(a.label, b.label)),
    fieldSideDevices: [
      ...saha.layouts.flatMap((p) => p.sideDevices),
      ...oksuzYan.saha,
    ].sort((a, b) => naturalCompare(a.label, b.label)),
    fieldSize: {
      heightMm: saha.layouts.length ? saha.heightMm : null,
      depthMm: saha.layouts.length ? saha.depthMm : null,
      panelCount: saha.layouts.length,
      sharedHeight: saha.sharedHeight,
    },
    estimatedCount: tahminAnahtarlari.size,
    fingerprint,
    // BEKLENEN AYGIT KÜMESİ GEÇİRİLİR: bir cihazın sessizce düşmesini
    // yakalayan tek denetim budur (PANO-11) ve dizi düzeyinde sınanır.
    audits: [
      ...auditLineup(oda.layouts, settings, odaGirdi.flatMap((g) => g.devices), "Oda dizisi"),
      ...auditLineup(saha.layouts, settings, sahaGirdi.flatMap((g) => g.devices), "Saha dizisi"),
    ],
  };
}
