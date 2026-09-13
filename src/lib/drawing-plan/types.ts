import type { DrawingPlanRow } from "../drawing-plan";

export const DRAWING_PLAN_VERSION = "1.0.0";
export const DRAWING_PLAN_LIMIT = 120;
export const DEFAULT_DRAWING_NUMBERING = { main: 1500, auxiliary: 2500 };
export type DrawingNumbering = typeof DEFAULT_DRAWING_NUMBERING;
export type DrawingOverride = "name" | "code" | "parentId" | "sortOrder";
export interface DrawingCandidate {
  key: string;
  parentKey: string | null;
  name: string;
  reason: string;
  block: "general" | "main" | "auxiliary" | "mono1" | "mono2";
  assembly?: boolean;
  optional?: boolean;
}
export interface DrawingDerivation {
  candidates: DrawingCandidate[];
  warnings: string[];
  fingerprint: string;
}
export interface DrawingPlanState {
  version: number;
  sourceRevisionId: string | null;
  sourceRevisionLabel: string;
  sourceUpdatedAt: string | null;
  fingerprint: string;
  numbering: DrawingNumbering;
}
export interface DrawingPlanDocument {
  rows: DrawingPlanRow[];
  state: DrawingPlanState;
}
export const emptyDrawingPlanState = (): DrawingPlanState => ({
  version: 0,
  sourceRevisionId: null,
  sourceRevisionLabel: "",
  sourceUpdatedAt: null,
  fingerprint: "",
  numbering: { ...DEFAULT_DRAWING_NUMBERING },
});
export interface DrawingPlanChange {
  key: string;
  kind: "add" | "move" | "rename" | "removed" | "space";
  message: string;
}
