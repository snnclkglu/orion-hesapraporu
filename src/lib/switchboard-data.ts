// PANO YERLEŞİMİNİN OKUMA/YAZMA KATMANI — Supabase ile saf çekirdek arasındaki
// TEK geçit (`lib/electrical/data.ts` ile aynı ilke).
//
// Ekran, SVG ucu ve PDF ucu üçü de buradan okur. Üç ayrı sorgu yazılsaydı biri
// `is_current` süzgecini ya da düzeltmeleri unutur ve indirilen belge ekranda
// görünenden başka bir pano anlatırdı.

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AnchorSide,
  DeviceModel,
  LayoutSettings,
  MountType,
  PanelKind,
  PanelOverride,
  PlacementOverride,
  Zone,
} from "./switchboard/types";

const MOUNT_TIPLERI: MountType[] = [
  "din",
  "plaka",
  "zemin",
  "kapak",
  "govde",
  "yan",
  "saha",
];
const BOLGELER: Zone[] = ["giris", "guc", "motor", "kumanda", "klemens"];
const PANO_TURLERI: PanelKind[] = ["oda", "saha", "haric"];
const KAPAKLAR: ("tek" | "cift")[] = ["tek", "cift"];
const YONLER: AnchorSide[] = ["once", "sonra"];

function metinVeyaNull(v: unknown): string | null {
  const s = v === null || v === undefined ? "" : String(v);
  return s ? s : null;
}

function sayiVeyaNull(v: unknown): number | null {
  // NULL SIFIR DEĞİLDİR (değişmez md. 4).
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function secenek<T extends string>(v: unknown, izin: T[]): T | null {
  const s = metinVeyaNull(v);
  return s && (izin as string[]).includes(s) ? (s as T) : null;
}

// ═══════════════════════════════════════════════════ ÜRÜN ÖLÇÜ DEFTERİ

const MODEL_SUTUNLARI =
  "lookup_key, supplier, type_no, width_mm, height_mm, depth_mm, module_units, mount_type, zone, clearance_top_mm, clearance_bottom_mm, heat_w, source, note";

/**
 * HAM SATIR → ÇEKİRDEK TİPİ dönüştürücüler DIŞA AÇIKTIR ve saftır.
 *
 * Aynı satırı iki taraf okur: uygulama (Supabase) ve ölçüm betiği
 * (`scripts/test-switchboard-layout.ts --kararlar`, canlı döküm). Betik kendi
 * dönüştürücüsünü yazsaydı `width_locked`ı bir gün unutur ve yerelde
 * yeniden üretilen plan canlıdakinden ayrışırdı (Plan F0).
 */
export function deviceModelFromRow(r: Record<string, unknown>): DeviceModel {
  return {
    lookupKey: String(r.lookup_key ?? ""),
    supplier: String(r.supplier ?? ""),
    typeNo: String(r.type_no ?? ""),
    widthMm: sayiVeyaNull(r.width_mm),
    heightMm: sayiVeyaNull(r.height_mm),
    depthMm: sayiVeyaNull(r.depth_mm),
    moduleUnits: sayiVeyaNull(r.module_units),
    mountType: secenek(r.mount_type, MOUNT_TIPLERI),
    zone: secenek(r.zone, BOLGELER),
    clearanceTopMm: sayiVeyaNull(r.clearance_top_mm),
    clearanceBottomMm: sayiVeyaNull(r.clearance_bottom_mm),
    heatW: sayiVeyaNull(r.heat_w),
    source: r.source === "elle" ? "elle" : "katalog",
    note: String(r.note ?? ""),
  };
}

/**
 * Ürün ölçü defterinin tamamı.
 *
 * SAYFALAMA ZORUNLU: PostgREST öntanımlı olarak 1000 satır döndürür
 * (ELEKTRIK-8). Defter bütün projelerin ürünlerini biriktirir ve o eşiği
 * geçtiğinde liste SESSİZCE kesilir; kesilen ürünler ekranda "ölçüsü yok"
 * görünür ve mühendis ölçüyü ikinci kez girerdi.
 */
export async function loadDeviceModels(supabase: SupabaseClient): Promise<DeviceModel[]> {
  const out: DeviceModel[] = [];
  const ADIM = 1000;
  for (let ofset = 0; ; ofset += ADIM) {
    const { data } = await supabase
      .from("electrical_device_models")
      .select(MODEL_SUTUNLARI)
      .order("lookup_key", { ascending: true })
      .range(ofset, ofset + ADIM - 1);
    const satirlar = (data ?? []) as unknown as Record<string, unknown>[];
    for (const r of satirlar) out.push(deviceModelFromRow(r));
    if (satirlar.length < ADIM) break;
  }
  return out;
}

// ═══════════════════════════════════════════════════════ PANO KARARLARI

const PANO_SUTUNLARI =
  "code, name, kind, width_mm, height_mm, depth_mm, base_mm, door_config, order_index, width_locked, height_locked, depth_locked, note";

export async function loadPanelOverrides(
  supabase: SupabaseClient,
  projectId: string
): Promise<PanelOverride[]> {
  const { data } = await supabase
    .from("switchboard_panels")
    .select(PANO_SUTUNLARI)
    .eq("project_id", projectId)
    .order("order_index", { ascending: true, nullsFirst: false });

  return ((data ?? []) as unknown as Record<string, unknown>[]).map(panelOverrideFromRow);
}

export function panelOverrideFromRow(r: Record<string, unknown>): PanelOverride {
  return {
    code: String(r.code ?? ""),
    name: String(r.name ?? ""),
    kind: secenek(r.kind, PANO_TURLERI),
    widthMm: sayiVeyaNull(r.width_mm),
    heightMm: sayiVeyaNull(r.height_mm),
    depthMm: sayiVeyaNull(r.depth_mm),
    baseMm: sayiVeyaNull(r.base_mm),
    doorConfig: secenek(r.door_config, KAPAKLAR),
    orderIndex: sayiVeyaNull(r.order_index),
    widthLocked: r.width_locked === true,
    heightLocked: r.height_locked === true,
    depthLocked: r.depth_locked === true,
    note: String(r.note ?? ""),
  };
}

// ═══════════════════════════════════════════════════ AYGIT DÜZELTMELERİ

const YERLESIM_SUTUNLARI =
  "device_key, panel_code, mount_type, zone, rail_index, order_in_rail, anchor_device_key, anchor_side, width_mm, height_mm, depth_mm, pinned, note";

export async function loadPlacementOverrides(
  supabase: SupabaseClient,
  projectId: string
): Promise<PlacementOverride[]> {
  const out: PlacementOverride[] = [];
  const ADIM = 1000;
  for (let ofset = 0; ; ofset += ADIM) {
    const { data } = await supabase
      .from("switchboard_placements")
      .select(YERLESIM_SUTUNLARI)
      .eq("project_id", projectId)
      .order("device_key", { ascending: true })
      .range(ofset, ofset + ADIM - 1);
    const satirlar = (data ?? []) as unknown as Record<string, unknown>[];
    for (const r of satirlar) out.push(placementOverrideFromRow(r));
    if (satirlar.length < ADIM) break;
  }
  return out;
}

export function placementOverrideFromRow(r: Record<string, unknown>): PlacementOverride {
  return {
    deviceKey: String(r.device_key ?? ""),
    panelCode: metinVeyaNull(r.panel_code),
    mountType: secenek(r.mount_type, MOUNT_TIPLERI),
    zone: secenek(r.zone, BOLGELER),
    railIndex: sayiVeyaNull(r.rail_index),
    orderInRail: sayiVeyaNull(r.order_in_rail),
    anchorDeviceKey: metinVeyaNull(r.anchor_device_key),
    anchorSide: secenek(r.anchor_side, YONLER),
    widthMm: sayiVeyaNull(r.width_mm),
    heightMm: sayiVeyaNull(r.height_mm),
    depthMm: sayiVeyaNull(r.depth_mm),
    pinned: r.pinned === true,
    note: String(r.note ?? ""),
  };
}

// ═════════════════════════════════════════════════ KAYDEDİLMİŞ AYARLAR

/**
 * Projenin KAYDEDİLMİŞ sipariş tercihleri — onaydan bağımsız (PANO-34).
 *
 * Onay tablosundaki `settings` bir SNAPSHOT'tır: "onaylandığı anda ayar buydu"
 * der. Burası ise bugünkü karardır ve onay olmadan da yaşar. Kullanıcı bir
 * yükseklik seçip sayfayı yenilediğinde seçiminin kaybolmasının sebebi, tek
 * kalıcı yerin onay satırı olmasıydı.
 */
export async function loadSavedSettings(
  supabase: SupabaseClient,
  projectId: string
): Promise<unknown> {
  // TABLO YOKSA UYGULAMA ÇÖKMEZ: migration uygulanmamış bir ortamda okuma
  // sessizce boş döner ve ekran öntanım ayarlarla çalışır.
  const { data } = await supabase
    .from("switchboard_settings")
    .select("settings")
    .eq("project_id", projectId)
    .maybeSingle();
  return (data as { settings?: unknown } | null)?.settings ?? null;
}

// ═══════════════════════════════════════════════════════════════ ONAY

export interface SwitchboardApproval {
  inputFingerprint: string;
  /**
   * Onaylandığı andaki AYAR — ham jsonb, biçimi ZAMANLA DEĞİŞMİŞTİR.
   *
   * 08.09.2026 öncesi satırlar ölçüyü düz taşıyor. Okuyan taraf
   * `switchboard/settings.ts` içindeki `normalizeSettings` ile geçirir; burada
   * hiçbir şey varsayılmaz (`revision-load.ts` ilkesi).
   */
  settings: unknown;
  note: string;
  approvedBy: string | null;
  approvedAt: string;
}

export async function loadApproval(
  supabase: SupabaseClient,
  projectId: string
): Promise<SwitchboardApproval | null> {
  const { data } = await supabase
    .from("switchboard_approvals")
    .select("input_fingerprint, settings, note, approved_by, approved_at")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!data) return null;
  const r = data as unknown as Record<string, unknown>;
  return {
    inputFingerprint: String(r.input_fingerprint ?? ""),
    // JSONB serbest biçimlidir; okuma GÜVENLİ olmalı (`revision-load.ts` ilkesi).
    settings: r.settings ?? {},
    note: String(r.note ?? ""),
    approvedBy: metinVeyaNull(r.approved_by),
    approvedAt: String(r.approved_at ?? ""),
  };
}
