// EL KİTABI DEFTERLERİNİN OKUMA KATMANI — panel katmanı Supabase'ten.
//
// ÇEKİRDEK DB OKUMAZ (değişmez md. 7). `maintenance-rules.ts` ve
// `lubrication-rules.ts` saf kalır; defteri BURASI okur ve birleştirilmiş
// listeyi çekirdeğe GEÇİRİR. Böylece kural motoru testte bir dizi kuralla
// koşturulabilir ve veritabanı olmadan sınanabilir.
//
// BİRLEŞTİRME TEK YERDEDİR (`mergeMaintenanceRules` / `mergeLubricationPoints`):
// panelde kapatılan bir kural ekranda, PDF'te ve yayım dondurmasında AYNI ANDA
// düşmelidir. İkinci bir birleştirme yazılsaydı biri kapalı biri açık olurdu.
//
// DEFTER OKUNAMAZSA KOD DEFTERİ KULLANILIR. Bir tablo hatası yüzünden bakım
// çizelgesinin hiç basılmaması, standart satırların basılmasından kötüdür.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MAINTENANCE_RULE_BOOK,
  mergeMaintenanceRules,
  type BakimDurum,
  type BakimKisi,
  type BakimSiklik,
  type MaintenanceRule,
} from "./maintenance-rules";
import {
  LUBRICATION_POINT_BOOK,
  mergeLubricationPoints,
  type LubricationPoint,
} from "./lubrication-rules";
import { withManualDefaults } from "./payload";
import type { ManualBlock } from "./types";

const metin = (v: unknown): string => (typeof v === "string" ? v : "");

/** Panel satırındaki kod, kod defterindeki değerlerden biri olmalı. */
function kod<T extends string>(v: unknown, gecerli: readonly T[], ontanim: T): T {
  const s = metin(v) as T;
  return gecerli.includes(s) ? s : ontanim;
}

export interface ManualBooks {
  maintenance: MaintenanceRule[];
  lubrication: LubricationPoint[];
}

/** Panel katmanındaki ham bakım satırlarını çekirdeğin tipine çevirir. */
function bakimSatiri(r: Record<string, unknown>): MaintenanceRule {
  return {
    id: metin(r.rule_id),
    ...(metin(r.match_pattern) ? { match: metin(r.match_pattern) } : {}),
    part: metin(r.part),
    task: metin(r.task),
    person: kod<BakimKisi>(r.person, ["F", "E", "MA", "I"], "MA"),
    freq: kod<BakimSiklik>(r.freq, ["d", "w", "2w", "m", "2m", "y", "2y"], "m"),
    state: kod<BakimDurum>(r.state, ["R", "AR", "LR"], "AR"),
    basis: metin(r.basis),
    ...(metin(r.min_group) ? { minGroup: metin(r.min_group) } : {}),
    ...(r.disabled === true ? { disabled: true as const } : {}),
  };
}

function yaglamaSatiri(r: Record<string, unknown>): LubricationPoint {
  return {
    id: metin(r.point_id),
    ...(metin(r.match_pattern) ? { match: metin(r.match_pattern) } : {}),
    place: metin(r.place),
    klass: metin(r.klass),
    basis: metin(r.basis),
    ...(r.disabled === true ? { disabled: true as const } : {}),
  };
}

/**
 * Kod defteri + panel defteri — türetim çekirdeğine geçirilecek son liste.
 *
 * ÜZERİNE BİNEN SATIRDA BOŞ ALAN, ALANI SİLMEZ. Panel formu bir alanı boş
 * bıraktığında kod kuralının o alanı korunur; aksi hâlde tek bir sıklığı
 * değiştirmek için bütün satırı yeniden yazmak gerekirdi.
 */
export async function loadManualBooks(supabase: SupabaseClient): Promise<ManualBooks> {
  const [bakim, yaglama] = await Promise.all([
    supabase
      .from("manual_maintenance_rules")
      .select("rule_id, match_pattern, part, task, person, freq, state, basis, min_group, disabled")
      .order("sort", { ascending: true })
      .order("rule_id", { ascending: true }),
    supabase
      .from("manual_lubrication_points")
      .select("point_id, match_pattern, place, klass, basis, disabled")
      .order("sort", { ascending: true })
      .order("point_id", { ascending: true }),
  ]);

  const bakimHam = (bakim.data ?? []) as Record<string, unknown>[];
  const yaglamaHam = (yaglama.data ?? []) as Record<string, unknown>[];

  const bakimUst = bakimHam
    .filter((r) => metin(r.rule_id))
    .map((r) => {
      const satir = bakimSatiri(r);
      const kodKurali = MAINTENANCE_RULE_BOOK.find((k) => k.id === satir.id);
      if (!kodKurali) return satir;
      // Boş alan kod kuralınınkini KORUR.
      const temiz: Partial<MaintenanceRule> = { id: satir.id };
      if (satir.match) temiz.match = satir.match;
      if (satir.part) temiz.part = satir.part;
      if (satir.task) temiz.task = satir.task;
      if (metin(r.person)) temiz.person = satir.person;
      if (metin(r.freq)) temiz.freq = satir.freq;
      if (metin(r.state)) temiz.state = satir.state;
      if (satir.basis) temiz.basis = satir.basis;
      if (satir.minGroup) temiz.minGroup = satir.minGroup;
      if (satir.disabled) temiz.disabled = true;
      return temiz as MaintenanceRule;
    });

  const yaglamaUst = yaglamaHam
    .filter((r) => metin(r.point_id))
    .map((r) => {
      const satir = yaglamaSatiri(r);
      const kodNoktasi = LUBRICATION_POINT_BOOK.find((k) => k.id === satir.id);
      if (!kodNoktasi) return satir;
      const temiz: Partial<LubricationPoint> = { id: satir.id };
      if (satir.match) temiz.match = satir.match;
      if (satir.place) temiz.place = satir.place;
      if (satir.klass) temiz.klass = satir.klass;
      if (satir.basis) temiz.basis = satir.basis;
      if (satir.disabled) temiz.disabled = true;
      return temiz as LubricationPoint;
    });

  return {
    maintenance: mergeMaintenanceRules(MAINTENANCE_RULE_BOOK, bakimUst),
    lubrication: mergeLubricationPoints(LUBRICATION_POINT_BOOK, yaglamaUst),
  };
}

// ————————————————————————————————————————————————————— metin parçaları

export interface ManualSnippetRow {
  id: string;
  title: string;
  category: string;
  sectionHint: string;
  block: ManualBlock;
}

/**
 * Metin parçaları defteri.
 *
 * BLOK ÇEKİRDEĞİN OKUYUCUSUNDAN GEÇİRİLİR (KITAP-10 ilkesi): veritabanındaki
 * serbest JSON doğrudan editöre verilseydi bozuk bir kayıt bütün defteri
 * açılmaz yapardı. Okunamayan parça listeden DÜŞER, defter düşmez.
 */
export async function loadManualSnippets(
  supabase: SupabaseClient
): Promise<ManualSnippetRow[]> {
  const { data } = await supabase
    .from("manual_snippets")
    .select("id, title, category, section_hint, block")
    .order("category", { ascending: true })
    .order("title", { ascending: true });

  const out: ManualSnippetRow[] = [];
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const okunan = withManualDefaults({
      sections: [{ id: "s", title: "", blocks: [r.block], children: [] }],
    });
    const blok = okunan.sections[0]?.blocks[0];
    if (!blok) continue;
    out.push({
      id: metin(r.id),
      title: metin(r.title),
      category: metin(r.category),
      sectionHint: metin(r.section_hint),
      block: blok,
    });
  }
  return out;
}
