// YERLEŞTİRİCİNİN DIŞ KAPISI — gövdeler `layout/` altındadır (Plan F7).
//
//   layout/sirala.ts   sıra ve sabitleme (PANO-23 · PANO-38)
//   layout/paketle.ts  bant + cep + DIN rayları (PANO-4 · PANO-37 · PANO-39)
//   layout/coz.ts      tek panonun çözümü, en araması, bölme (PANO-9 · PANO-10)
//   layout/dizi.ts     ortak yükseklik/derinlik, harfleme (PANO-2 · PANO-33 · PANO-41)
//
// Bu dosya yalnız yeniden dışa aktarır; mevcut içe aktarımlar kırılmaz.

export { MAX_UNITS } from "./layout/paketle";
export { solvePanel, splitPanel, type PanelInput, type PanelSolve } from "./layout/coz";
export { solveLineup, type SolveAllInput, type SolveAllResult } from "./layout/dizi";
export { DEFAULT_SETTINGS } from "./sizes";
