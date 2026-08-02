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

import type { CalcInput, CalcResult } from "@/lib/calc/engine";
import type { ModuleResult } from "@/lib/calc/types";
import type { ModuleKey } from "@/lib/calc/presentation/module-family";
import type { HoistCtx } from "@/lib/calc/presentation/hoistSections";
import type { HookBlockCtx } from "@/lib/calc/presentation/hookBlockSections";
import type { TravelCtx } from "@/lib/calc/presentation/travelSections";
import type { GirderCtx } from "@/lib/calc/presentation/girderSections";
import type { BucklingCtx } from "@/lib/calc/presentation/bucklingSections";
import type { EndCarriageCtx } from "@/lib/calc/presentation/endCarriageSections";
import type { ModuleDepsBundle } from "@/app/(app)/projects/[id]/revisions/[revId]/module-adapters";

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
  switch (key) {
    case "main":
      return input.mainHoist;
    case "aux":
      return input.auxHoist;
    case "hookBlock":
      return input.hookBlock;
    case "trolley":
      return input.trolley;
    case "bridge":
      return input.bridge;
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
  switch (key) {
    case "main":
      return result.mainHoist;
    case "aux":
      return result.auxHoist;
    case "hookBlock":
      return result.hookBlock;
    case "trolley":
      return result.trolley;
    case "bridge":
      return result.bridge;
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
  if (!modulePresent(input, key)) return undefined;
  const mr = moduleResult(result, key);
  const c = mr?.cells ?? {};
  const specs = input.specs;

  switch (key) {
    case "main":
    case "aux": {
      const st = key === "main" ? input.mainHoist! : input.auxHoist!;
      const ctx: HoistCtx = { c, inp: st.inputs, sel: st.selections, specs, which: key };
      return ctx;
    }
    case "hookBlock": {
      // Bu modüllerin bağlamı hesaplanmış değer kümesini (values) gerektirir;
      // sonuç yoksa bağlam da yoktur.
      if (!result.hookBlock) return undefined;
      const st = input.hookBlock!;
      const ctx: HookBlockCtx = {
        c,
        v: result.hookBlock.values,
        inp: st.inputs,
        sel: st.selections,
        deps: deps.hookBlock,
        specs,
      };
      return ctx;
    }
    case "trolley":
    case "bridge": {
      const st = key === "trolley" ? input.trolley! : input.bridge!;
      const travelResult = key === "trolley" ? result.trolley : result.bridge;
      if (!travelResult) return undefined;
      const ctx: TravelCtx = {
        c,
        v: travelResult.values,
        inp: st.inputs,
        sel: st.selections,
        specs,
        deps: deps.travel,
        which: key,
      };
      return ctx;
    }
    case "girder": {
      const st = input.girder!;
      const ctx: GirderCtx = {
        c,
        inp: st.inputs,
        sel: st.selections,
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
      const st = input.endCarriage!;
      const ctx: EndCarriageCtx = {
        c,
        inp: st.inputs,
        sel: st.selections,
        deps: deps.endCarriage,
        specs,
      };
      return ctx;
    }
  }
}
