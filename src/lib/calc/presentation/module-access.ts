// Modül erişim katmanı — sunum tüketicilerinin (editör, PDF raporu, standart
// toplayıcı, bölüm sonuç kutusu) ortak kullandığı saf yardımcılar.
//
// Aynı modül anahtarı (`main`, `girder`, ...) üç ayrı yerden okunur:
//   1) girdi/seçim durumu   -> moduleState
//   2) hesap sonucu         -> moduleResult
//   3) sunum bağlamı (ctx)  -> ctxFor
// Bu üçlü daha önce her tüketicide yeniden yazılıyordu; burada tek kaynak
// haline getirildi. Dosya saftır: React, PDF, veritabanı bağımlılığı yoktur;
// yalnızca hesap motoru tipleri ve modül adaptörü tipleri kullanılır.
//
// Çoklu kaldırma topolojisinde anahtar sayısı artar (ana/yardımcı/monoray
// kaldırma, her birinin kanca bloğu ve arabası). Anahtar → alan eşlemesi
// aşağıdaki tablolarda tek yerde durur; switch zincirleri çoğaltılmaz.

import type { CalcInput, CalcResult } from "@/lib/calc/engine";
import type { ModuleResult } from "@/lib/calc/types";
import type { ModuleKey } from "@/lib/calc/presentation/module-family";
import {
  isHoistKey,
  isHookBlockKey,
  isTravelKey,
  type HoistKey,
} from "@/lib/calc/presentation/module-family";
import type { HoistCtx } from "@/lib/calc/presentation/hoistSections";
import type { HookBlockCtx } from "@/lib/calc/presentation/hookBlockSections";
import type { TravelCtx } from "@/lib/calc/presentation/travelSections";
import type { GirderCtx } from "@/lib/calc/presentation/girderSections";
import type { BucklingCtx } from "@/lib/calc/presentation/bucklingSections";
import type { EndCarriageCtx } from "@/lib/calc/presentation/endCarriageSections";
import type { ModuleDepsBundle } from "@/app/(app)/projects/[id]/revisions/[revId]/module-adapters";

/** Kaldırma grubu anahtarı → CalcInput/CalcResult alan adı. */
export const HOIST_FIELD: Record<
  HoistKey,
  "mainHoist" | "auxHoist" | "mono1Hoist" | "mono2Hoist"
> = {
  main: "mainHoist",
  aux: "auxHoist",
  mono1: "mono1Hoist",
  mono2: "mono2Hoist",
};

/**
 * Modülün girdi/seçim durumu. Modül vince dahil değilse `undefined` döner.
 *
 * Buruşma modülünün seçim alanı yoktur; çağıranların tek tip davranabilmesi
 * için boş bir seçim nesnesiyle normalize edilir.
 */
export function moduleState(
  input: CalcInput,
  key: ModuleKey
): { inputs: object; selections: object } | undefined {
  if (isHoistKey(key)) return input[HOIST_FIELD[key]];
  if (isHookBlockKey(key)) return input[key];
  if (isTravelKey(key)) return input[key];
  switch (key) {
    case "buckling":
      return input.buckling ? { inputs: input.buckling.inputs, selections: {} } : undefined;
    case "girder":
      return input.girder;
    case "endCarriage":
      return input.endCarriage;
  }
}

/** Modülün hesap sonucu; modül hesaplanmadıysa `undefined`. */
export function moduleResult(
  result: CalcResult,
  key: ModuleKey
): ModuleResult<unknown> | undefined {
  if (isHoistKey(key)) return result[HOIST_FIELD[key]];
  if (isHookBlockKey(key)) return result[key];
  if (isTravelKey(key)) return result[key];
  switch (key) {
    case "buckling":
      return result.buckling;
    case "girder":
      return result.girder;
    case "endCarriage":
      return result.endCarriage;
  }
}

/** Modül bu hesapta var mı (girdi durumu mevcut mu). */
export function modulePresent(input: CalcInput, key: ModuleKey): boolean {
  return moduleState(input, key) !== undefined;
}

/**
 * Sunum bağlamı — her modülün kendi Ctx tipiyle kurulur; satır tanımları
 * (`read` / `subst`) bu bağlamı okur.
 *
 * Modül dahil değilse `undefined` döner: çağıran taraf zaten modülü atlar,
 * eksik modülde çökmek yerine boş sonuç üretmek doğru davranıştır. Hesap
 * sonucu henüz yoksa hücre haritası boş kabul edilir.
 */
export function ctxFor(
  key: ModuleKey,
  input: CalcInput,
  result: CalcResult,
  deps: ModuleDepsBundle
): unknown {
  const st = moduleState(input, key);
  if (!st) return undefined;
  const mr = moduleResult(result, key);
  const c = mr?.cells ?? {};
  const specs = input.specs;

  if (isHoistKey(key)) {
    const ctx: HoistCtx = { c, inp: st.inputs as never, sel: st.selections as never, specs, which: key };
    return ctx;
  }
  if (isHookBlockKey(key)) {
    // Bu modüllerin bağlamı hesaplanmış değer kümesini (values) gerektirir;
    // sonuç yoksa bağlam da yoktur.
    const r = result[key];
    if (!r) return undefined;
    const ctx: HookBlockCtx = {
      c,
      v: r.values,
      inp: st.inputs as never,
      sel: st.selections as never,
      deps: deps.hookBlock[key],
      specs,
    };
    return ctx;
  }
  if (isTravelKey(key)) {
    const r = result[key];
    if (!r) return undefined;
    const ctx: TravelCtx = {
      c,
      v: r.values,
      inp: st.inputs as never,
      sel: st.selections as never,
      specs,
      deps: deps.travel[key],
      which: key,
    };
    return ctx;
  }

  switch (key) {
    case "girder": {
      const ctx: GirderCtx = {
        c,
        inp: st.inputs as never,
        sel: st.selections as never,
        deps: deps.girder,
        specs,
      };
      return ctx;
    }
    case "buckling": {
      const ctx: BucklingCtx = { c, inp: input.buckling!.inputs };
      return ctx;
    }
    case "endCarriage": {
      const ctx: EndCarriageCtx = {
        c,
        inp: st.inputs as never,
        sel: st.selections as never,
        deps: deps.endCarriage,
        specs,
      };
      return ctx;
    }
  }
}
