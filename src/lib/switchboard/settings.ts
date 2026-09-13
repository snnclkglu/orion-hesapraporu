// KAYITLI AYARIN OKUNMASI — saf, hoşgörülü, hiçbir şey varsaymayan.
//
// `switchboard_approvals.settings` bir `jsonb` sütunudur ve şema kısıtı YOKTUR:
// oraya bir gün ne yazıldıysa o durur. 08.09.2026'dan önceki onaylar ayarı DÜZ
// biçimde taşıyor (`{ heightMm, depthMm, baseMm }`) ve o değer İKİ DİZİYE
// BİRDEN uygulanıyordu — kaldırılan kusurun kendisi.
//
// ESKİ SATIR OKUNURKEN O GÜNKÜ PLAN YENİDEN ÜRETİLİR: düz değer ikisine birden
// yazılır. Başka bir eşleme (ör. yalnız odaya yazmak) onaylanmış bir planı
// sessizce değiştirirdi ve onay parmak izinin bütün anlamı budur (PANO-14).
//
// Bir jsonb migration'ı yerine hoşgörülü okuyucu seçildi: okuyucu birim testi
// alır ve yayın sırasında eski bir sürümün yazdığı satırı da doğru okur; tek
// seferlik bir veri dönüşümü ikisini de yapamaz.

import type { LayoutSettingsInput } from "./compute";

/** Yalnız pozitif sonlu sayı; başka her şey "bilinmiyor"dur (değişmez md. 4). */
function sayi(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

function tercih(ham: unknown): Partial<{ heightMm: number; depthMm: number; baseMm: number }> {
  if (!ham || typeof ham !== "object" || Array.isArray(ham)) return {};
  const o = ham as Record<string, unknown>;
  const y = sayi(o.heightMm);
  const d = sayi(o.depthMm);
  const b = sayi(o.baseMm);
  return {
    ...(y !== null ? { heightMm: y } : {}),
    ...(d !== null ? { depthMm: d } : {}),
    ...(b !== null ? { baseMm: b } : {}),
  };
}

/**
 * Onay kaydındaki ayarı çalışma girdisine çevirir; eski DÜZ biçimi de kabul
 * eder. Bozuk satır FIRLATMAZ, boş döner — bir onay kaydının okunamaması
 * ekranı düşürmemelidir.
 */
export function normalizeSettings(ham: unknown): LayoutSettingsInput {
  if (!ham || typeof ham !== "object" || Array.isArray(ham)) {
    return { room: {}, field: {} };
  }
  const o = ham as Record<string, unknown>;

  // ESKİ DÜZ BİÇİM: üst düzeydeki ölçüler o gün İKİ DİZİYE de uygulanıyordu.
  const duz = tercih(o);

  const cikti: LayoutSettingsInput = {
    room: { ...duz, ...tercih(o.room) },
    field: { ...duz, ...tercih(o.field) },
  };

  // Paylar (plaka, kanal, kenar…) düz kalır ve biçim değiştirmedi.
  for (const alan of [
    "plateSideMm",
    "plateTopMm",
    "plateBottomMm",
    "sideDuctMm",
    "railDuctMm",
    "edgeGapMm",
    "familyGapMm",
    "defaultClearanceMm",
    "backGapMm",
    "doorGapMm",
    "fillWarnRatio",
    "minRailMm",
    "columnGapMm",
  ] as const) {
    const v = sayi(o[alan]);
    if (v !== null) (cikti as Record<string, unknown>)[alan] = v;
  }
  // Sütunlu yerleşim bir ANAHTARDIR (PANO-39); yalnız gerçek boolean okunur.
  if (typeof o.columnsEnabled === "boolean") cikti.columnsEnabled = o.columnsEnabled;

  if (Array.isArray(o.fieldPrefixes)) {
    const onekler = o.fieldPrefixes.filter((p): p is string => typeof p === "string" && p !== "");
    if (onekler.length > 0) cikti.fieldPrefixes = onekler;
  }

  return cikti;
}
