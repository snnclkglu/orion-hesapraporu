// Tarihsel doğrulama fikstürü — eski hesap tablosu dökümü ↔ motorun semantik
// anahtarları arasındaki eşleme katmanı.
//
// ÖNEMLİ: Bu dosya TEST katmanına aittir; üretim kodu buradan hiçbir şey içe
// aktarmaz. Motorun hesap yöntemi standartlara dayanır (FEM 1.001 / DIN 15018 /
// DIN 15400 / CMAA 70); buradaki eşleme yalnızca ilk portun sayısal birikimini
// regresyon ağı olarak kullanılabilir tutar. Ayrıntı için bu klasördeki
// README.md'ye bakın.
//
// Eşleme yönü tek yönlüdür: eski döküm hücresi → semantik anahtar. Ters yön
// (semantik anahtar → hücre) bilinçli olarak sağlanmaz; motorun anahtarları
// tarihsel bir adresleme düzenine bağlanmamalıdır.

import type { ModuleKey } from "../../presentation/module-family";
import type { AnyCheck } from "../../types";

/**
 * Motorun ürettiği büyüklük anahtarı — `<blok>.<büyüklük>` biçimi.
 * Örnek: `rope.load`, `drum.minDia`, `drumShaft.reactionGearbox`,
 * `gearbox.requiredTorque`, `fatigue.combined`.
 */
export type SemanticKey = string;

/** Eski döküm hücre adresi → motorun semantik anahtarı (modül başına). */
export type AliasMap = Record<string, SemanticKey>;

import { HOIST_ALIASES } from "./alias-hoist";
import { HOOKBLOCK_ALIASES } from "./alias-hookblock";
import { TROLLEY_ALIASES, BRIDGE_ALIASES } from "./alias-travel";
import {
  GIRDER_ALIASES,
  BUCKLING_ALIASES,
  ENDCARRIAGE_ALIASES,
} from "./alias-structural";

/**
 * Modül başına eşleme tabloları — tarihsel dökümün hücre adresi → motorun
 * semantik anahtarı. Haritalar modül modül ayrı dosyalarda tutulur; burada
 * yalnız tek bir erişim noktasında birleştirilir.
 *
 * Eşlemesi olmayan bir hücrede `resolveLegacyCell` `undefined` döner; modül
 * testleri bu durumu KAPSAM_DISI / SAPMA sözlükleriyle açıkça karşılar, yani
 * hiçbir hücre sessizce karşılaştırma dışında kalmaz.
 */
export const EXCEL_ALIASES: Partial<Record<ModuleKey, AliasMap>> = {
  main: HOIST_ALIASES,
  aux: HOIST_ALIASES,
  hookBlock: HOOKBLOCK_ALIASES,
  trolley: TROLLEY_ALIASES,
  bridge: BRIDGE_ALIASES,
  girder: GIRDER_ALIASES,
  buckling: BUCKLING_ALIASES,
  endCarriage: ENDCARRIAGE_ALIASES,
};

/** Hücre adresini normalleştirir: boşluk kırpılır, harfler büyütülür. */
function normalizeCell(cell: string): string {
  return cell.trim().toUpperCase();
}

/**
 * Eski döküm hücresinin motordaki karşılığını çözer.
 *
 * @param moduleKey  modül anahtarı (main / aux / trolley / …)
 * @param cell       eski dökümdeki hücre adresi
 * @param cells      motorun ürettiği değerler (semantik anahtar → değer)
 * @returns          eşleşen değer; eşleme ya da değer yoksa `undefined`
 */
export function resolveLegacyCell(
  moduleKey: ModuleKey,
  cell: string,
  cells: Record<string, number | string>
): number | string | undefined {
  const aliases = EXCEL_ALIASES[moduleKey];
  if (!aliases) return undefined;
  const key = aliases[normalizeCell(cell)];
  if (key === undefined) return undefined;
  return cells[key];
}

/**
 * Bir modülde kaç hücrenin eşlemesi tanımlı — fikstür kapsamını raporlamak için.
 */
export function aliasCoverage(moduleKey: ModuleKey): number {
  return Object.keys(EXCEL_ALIASES[moduleKey] ?? {}).length;
}

/**
 * Eski tablodaki tik/çarpı hücrelerinin motordaki karşılığı.
 *
 * Motorda böyle bir hücre YOKTUR: kontrol sonucu `Check.pass` alanından
 * türetilir. Bu yardımcı yalnızca tarihsel dökümle karşılaştırma yapılabilsin
 * diye o gösterimi üretir; üretim kodu bu karakterleri hiç üretmez.
 *
 * @returns kontrol geçtiyse tik, kaldıysa çarpı; kontrol bulunamazsa `undefined`
 */
export function tickFromCheck(
  checks: AnyCheck[],
  checkId: string
): "ü" | "û" | undefined {
  const found = checks.find((c) => c.id === checkId);
  if (!found) return undefined;
  return found.pass ? "ü" : "û";
}
