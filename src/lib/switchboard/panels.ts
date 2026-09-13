// AYGIT KUTULARI ve PANO LİSTESİ — malzeme satırlarından fiziksel nesnelere.
//
// `electrical_parts` satır başınadır ve aynı aygıt birden çok satırda geçebilir
// (bir aygıt, birkaç sipariş kalemi: kontaktör + yardımcı kontak + kol). Panoya
// giren şey satır değil AYGITTIR; bu yüzden satırlar yerleştirmeden ÖNCE aygıt
// etiketine göre gruplanır — bir etiket bir fiziksel kutudur.
//
// ANAHTAR AYGIT ETİKETİDİR, SATIR KİMLİĞİ DEĞİL. `electrical_parts` her yeniden
// okumada silinip yeniden üretilir (ELEKTRIK-6); satır UUID'sine bağlanan bir
// düzeltme ilk yeniden okumada koparadı. Etiket ise EPLAN'ın kendi kimliğidir
// ve yeniden dışa aktarımda aynı çıkar.

import { materialCatalogIdentity, catalogIdentityPart } from "@/lib/electrical/catalogs";
import { electricalCategory } from "@/lib/electrical/category";
import type { ElectricalPart } from "@/lib/electrical/types";
import { footprintFor } from "./footprint";
import { aksesuarYonu, mountRuleFor } from "./mount";
import { deviceModelLookup } from "./registry";
import type {
  DeviceBox,
  DeviceModel,
  LayoutSettings,
  PanelKind,
  PanelOverride,
  PlacementOverride,
} from "./types";

/**
 * Aygıtın kararlı anahtarı: `tesis|konum|aygıt`.
 *
 * Etiketi tanınmayan satır (aygıt parçası boş) anahtar ÜRETMEZ — `sort`tan
 * anahtar türetmek yeniden okumada kayardı ve düzeltme yanlış aygıta yapışırdı.
 */
export function deviceKeyOf(part: {
  installation: string;
  location: string;
  device: string;
}): string | null {
  const aygit = catalogIdentityPart(part.device);
  if (!aygit) return null;
  return [
    catalogIdentityPart(part.installation),
    catalogIdentityPart(part.location),
    aygit,
  ].join("|");
}

/** Kod ön ekten SAHA panosu mu (öntanım `TB`)? Kullanıcı seçimi üstündür. */
export function panelKindFor(
  code: string,
  settings: LayoutSettings,
  override: PanelOverride | null
): PanelKind {
  if (override?.kind) return override.kind;
  const kod = catalogIdentityPart(code);
  return settings.fieldPrefixes.some((p) => kod.startsWith(catalogIdentityPart(p)))
    ? "saha"
    : "oda";
}

/**
 * DOĞAL SIRALAMA: `F2` `F10`dan ÖNCE gelir.
 *
 * Alfabetik sıra elektrikçinin okuduğu sırayı bozar — şemada `-F10`u `-F2`nin
 * üstünde görmek, panoda numaranın anlamsız olduğunu düşündürür.
 */
export function naturalCompare(a: string, b: string): number {
  const parcala = (s: string) => s.match(/\d+|\D+/g) ?? [];
  const pa = parcala(a);
  const pb = parcala(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i];
    const y = pb[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const sx = /^\d/.test(x);
    const sy = /^\d/.test(y);
    if (sx && sy) {
      const d = Number(x) - Number(y);
      if (d !== 0) return d;
    } else {
      const d = x.localeCompare(y, "tr");
      if (d !== 0) return d;
    }
  }
  return 0;
}

export interface BuildInput {
  parts: ElectricalPart[];
  models: Map<string, DeviceModel>;
  placementOverrides: Map<string, PlacementOverride>;
  panelOverrides: Map<string, PanelOverride>;
  settings: LayoutSettings;
}

export interface BuildResult {
  /** Yerleştirilecek aygıtlar, pano koduna göre. */
  byPanel: Map<string, DeviceBox[]>;
  /** Aygıt etiketi okunamayan satırlar. */
  untagged: ElectricalPart[];
  /** Panoda geçen bütün konum kodları, doğal sırada. */
  codes: string[];
}

/**
 * Satırları aygıt kutularına indirir.
 *
 * BİR ETİKET BİR KUTUDUR: aynı etiketin ikinci satırı ölçüyü BÜYÜTMEZ, yalnız
 * ilk satır ürün kimliğini belirler. Aksi hâlde bir kontaktörün yardımcı
 * kontak bloğu ayrı bir kutu olur ve panoda iki kere yer kaplardı.
 */
export function buildDeviceBoxes(input: BuildInput): BuildResult {
  const { parts, models, placementOverrides, panelOverrides, settings } = input;

  // Defterde arama TEK TANIMDIR (`registry.ts`): tam anahtar, sonra tip
  // numarasıyla yedek arama. Ekran ve yerleşim aynı sonucu görmek zorundadır.
  const modelBul = deviceModelLookup(models.values());

  const kutular = new Map<string, DeviceBox>();
  const untagged: ElectricalPart[] = [];

  // ALT AYGIT ANA AYGITIN İÇİNDEDİR (PANO-24). `=100T+LVD0-U20-U15` bir aygıt
  // değil, `-U20` sürücüsünün yuvasına takılan bir karttır; `-M21-B21` motorun
  // içindeki PTC'dir. Bunlara ayrı kutu açmak, sürücünün enkoder kartını
  // montaj plakasında AYRI yer isteyen bir cihaz yapardı.
  //
  // ÖKSÜZ ALT AYGIT KENDİ KUTUSUDUR: 0026'da `-M36-1G12` enkoderi var ama
  // `-M36` motoru malzeme listesinde yok; onu yutacak bir gövde olmadığı için
  // kendi başına durur ve saha kuyruğunda görünür.
  const tumAnahtarlar = new Set<string>();
  for (const p of parts) {
    const k = deviceKeyOf(p);
    if (k) tumAnahtarlar.add(k);
  }
  const anaAygitVar = (part: ElectricalPart): boolean => {
    const kesme = part.device.lastIndexOf("-");
    if (kesme <= 0) return false;
    const ana = deviceKeyOf({ ...part, device: part.device.slice(0, kesme) });
    return ana !== null && tumAnahtarlar.has(ana);
  };

  for (let sira = 0; sira < parts.length; sira++) {
    const part = parts[sira];
    const key = deviceKeyOf(part);
    if (!key) {
      untagged.push(part);
      continue;
    }
    const category = electricalCategory({
      designation: part.designation,
      typeNo: part.typeNo,
      supplier: part.supplier,
      partNo: part.partNo,
    });

    // AYNI ETİKETİN İKİNCİ SATIRI: çoğu zaman bir aksesuardır ve gövdeyi
    // BÜYÜTMEZ — bir kontaktörün önden takılan yardımcı kontağı, bir rölenin
    // soketi (o zaten takımın kendisidir). Ama YANDAN takılan aksesuar toplam
    // eni gerçekten büyütür ve saymamak panoyu dar hesaplatır (PANO-26).
    //
    // AKSESUAR ANA AYGITIN DÜZELTMESİNİ ALMAZ: `placementOverrides` aygıt
    // anahtarına bağlıdır ve kullanıcı ana aygıta bir en yazdıysa o en
    // aksesuara da uygulanır, yani en İKİ KEZ sayılırdı.
    const mevcut = kutular.get(key);
    if (mevcut) {
      const yon = aksesuarYonu({ category, designation: part.designation, typeNo: part.typeNo });
      if (yon === "yan" && mevcut.widthMm !== null) {
        const ek = footprintFor(
          {
            category,
            designation: part.designation,
            typeNo: part.typeNo,
            supplier: part.supplier,
            partNo: part.partNo,
            mountType: mevcut.mountType,
          },
          modelBul(materialCatalogIdentity(part).lookupKey),
          null
        );
        if (ek.widthMm !== null && ek.widthMm > 0) {
          mevcut.widthMm += ek.widthMm;
          // KAYNAK EN ZAYIF HALKAYA GÖRE (PANO-12): katalogdan gelen bir
          // gövdeye tahmin edilmiş bir aksesuar eklenirse toplam TAHMİNDİR.
          if (ek.source === "tahmin" && mevcut.dimSource !== "tahmin") {
            mevcut.dimSource = "tahmin";
          }
        }
      }
      continue;
    }
    if (anaAygitVar(part)) continue;
    const kural = mountRuleFor({
      category,
      designation: part.designation,
      typeNo: part.typeNo,
    });
    const kimlik = materialCatalogIdentity(part);
    const model = modelBul(kimlik.lookupKey);
    const override = placementOverrides.get(key) ?? null;
    // Montaj tipi ÖLÇÜDEN ÖNCE çözülür: tahmin kuralı cihazın nereye takıldığını
    // bilmek zorunda (`footprint.ts` — pano yanı ve saha tahmin edilmez).
    const mountType = override?.mountType ?? model?.mountType ?? kural.mountType;
    const olcu = footprintFor(
      {
        category,
        designation: part.designation,
        typeNo: part.typeNo,
        supplier: part.supplier,
        partNo: part.partNo,
        mountType,
      },
      model,
      override
    );

    const panelOverride = panelOverrides.get(part.location) ?? null;

    // ŞERİT AİLESİNDE ADET ENDİR. `=185T+LVD10-X1` adet 200 ile tek satırdır
    // ama panoda 200 klemens yer kaplar (200 x 5,2 = 1040 mm). Öteki
    // ailelerde adet yedek/aksesuar sayısıdır ve gövdeyi büyütmez.
    // ISI PAYI HER CİHAZA VERİLMEZ. Ray satırlarını zaten kablo kanalı ayırır;
    // her şaltere 100 mm üst ve alt boşluk eklemek ölçüldü ve LVD10'da 4330 mm
    // ray yüksekliği üretti (plakada 1850 mm var). Serbest yükseklik yalnız ISI
    // ÜRETEN ekipmanın şartıdır — sürücü, trafo, reaktör (PANO-7).
    const isiPayi =
      kural.colorGroup === "surucu" || kural.mountType === "plaka"
        ? settings.defaultClearanceMm
        : 0;

    const seritMi = category === "Fiş, Priz, Klemens ve Bağlantı";
    const adet = seritMi && typeof part.qty === "number" && part.qty > 0
      ? Math.round(part.qty)
      : 1;

    kutular.set(key, {
      key,
      label: part.device,
      panelCode: override?.panelCode ?? part.location,
      designation: part.designation,
      typeNo: part.typeNo,
      supplier: part.supplier,
      partNo: part.partNo,
      category,
      colorGroup: kural.colorGroup,
      mountType,
      zone: override?.zone ?? model?.zone ?? kural.zone,
      widthMm: olcu.widthMm,
      heightMm: olcu.heightMm,
      depthMm: olcu.depthMm,
      clearanceTopMm: olcu.clearanceTopMm ?? isiPayi,
      clearanceBottomMm: olcu.clearanceBottomMm ?? isiPayi,
      dimSource: olcu.source,
      unitCount: adet,
      splittable: seritMi,
      sort: sira,
      // SABİTLEME DÜZELTMEDEN GELİR (PANO-23). Kullanıcı şemada bir cihazı
      // taşıdığında bıraktığı sıra buraya girer; yerleştirici o SIRAYI korur,
      // koordinatı yeniden hesaplar.
      pinned: override?.pinned ?? false,
      pinnedOrder: override?.orderInRail ?? null,
      pinnedRail: override?.railIndex ?? null,
      // KOMŞUYA BAĞLI SABİTLEME (PANO-38): "bu aygıt şunun yanına".
      anchorKey: override?.anchorDeviceKey ?? null,
      anchorSide: override?.anchorSide ?? null,
    });

    // `panelOverride` yalnız pano ADININ/türünün kaynağıdır; kutuya girmez.
    void panelOverride;
  }

  const byPanel = new Map<string, DeviceBox[]>();
  for (const kutu of kutular.values()) {
    const liste = byPanel.get(kutu.panelCode);
    if (liste) liste.push(kutu);
    else byPanel.set(kutu.panelCode, [kutu]);
  }
  for (const liste of byPanel.values()) {
    liste.sort((a, b) => naturalCompare(a.label, b.label) || a.sort - b.sort);
  }

  const codes = [...byPanel.keys()].sort(naturalCompare);
  return { byPanel, untagged, codes };
}

/**
 * GİRDİNİN PARMAK İZİ — onayın eskidiğini bu gösterir.
 *
 * Plan saklanmadığı için "onaylanan neydi" sorusunun cevabı bir hash'tir.
 * FNV-1a seçildi çünkü saf, hızlı ve platformdan bağımsızdır; burada bir
 * güvenlik özeti değil bir DEĞİŞİKLİK SEZİCİ isteniyor.
 */
export function fingerprintOf(parcalar: readonly string[]): string {
  let h = 0x811c9dc5;
  const metin = parcalar.join("\u0001");
  for (let i = 0; i < metin.length; i++) {
    h ^= metin.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Yerleşimi etkileyen her şeyi kararlı bir diziye indirir. */
export function fingerprintParts(input: BuildInput): string[] {
  const satirlar: string[] = [];
  for (const part of input.parts) {
    satirlar.push(
      [
        part.installation,
        part.location,
        part.device,
        part.supplier,
        part.typeNo,
        part.partNo,
        part.qty ?? "",
      ].join("\u0002")
    );
  }
  satirlar.sort();

  const duzeltmeler = [...input.placementOverrides.values()]
    .map((o) =>
      [
        o.deviceKey,
        o.panelCode ?? "",
        o.mountType ?? "",
        o.zone ?? "",
        o.railIndex ?? "",
        o.orderInRail ?? "",
        o.anchorDeviceKey ?? "",
        o.anchorSide ?? "",
        o.widthMm ?? "",
        o.heightMm ?? "",
        o.depthMm ?? "",
        o.pinned ? "1" : "0",
      ].join("\u0002")
    )
    .sort();

  const panolar = [...input.panelOverrides.values()]
    .map((p) =>
      [
        p.code,
        p.kind ?? "",
        p.widthMm ?? "",
        p.heightMm ?? "",
        p.depthMm ?? "",
        p.baseMm ?? "",
        p.doorConfig ?? "",
        p.orderIndex ?? "",
      ].join("\u0002")
    )
    .sort();

  const ayar = kararliJson(input.settings);

  return [...satirlar, "--", ...duzeltmeler, "--", ...panolar, "--", ayar];
}

/**
 * DERİNLİKTEN BAĞIMSIZ, ANAHTAR SIRALI JSON.
 *
 * `JSON.stringify(v, Object.keys(v).sort())` KULLANILMAZ. Dizi biçimindeki
 * ikinci argüman bir *PropertyList*tir ve şartname onu HER DÜZEYDEKİ nesneye
 * uygular. `settings` iç içe bir nesne taşıdığı anda (`room`, `field`) o
 * nesnenin alanları üst düzey listede bulunmaz ve `{}` diye serileşir — yani
 * ODA YÜKSEKLİĞİNİ DEĞİŞTİRMEK PARMAK İZİNİ DEĞİŞTİRMEZ, "onay eskidi" uyarısı
 * HİÇ ÇIKMAZ ve imalatçıya eski onayla pano sipariş edilir (PANO-14'ün tam
 * olarak engellemek için var olduğu şey).
 *
 * Diziler etkilenmiyordu — `fieldPrefixes` doğru serileşiyor — ve hata bu
 * yüzden bugüne kadar görünmedi.
 */
function kararliJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(kararliJson).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${kararliJson(o[k])}`)
    .join(",")}}`;
}
