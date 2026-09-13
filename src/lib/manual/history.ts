import type { ManualPayload } from "./types";
export interface ManualHistory { past: ManualPayload[]; present: ManualPayload; future: ManualPayload[] }
export type ManualHistoryAction = { type: "set"; value: ManualPayload | ((previous: ManualPayload) => ManualPayload) } | { type: "undo" | "redo" };
export function manualHistory(state: ManualHistory, action: ManualHistoryAction): ManualHistory {
  if(action.type === "undo") return state.past.length ? {past:state.past.slice(0,-1),present:state.past.at(-1)!,future:[state.present,...state.future]} : state;
  if(action.type === "redo") return state.future.length ? {past:[...state.past,state.present],present:state.future[0],future:state.future.slice(1)} : state;
  if(action.type !== "set")return state;
  const next=typeof action.value === "function" ? action.value(state.present) : action.value;
  if(next===state.present)return state;
  return {past:[...state.past,state.present].slice(-50),present:next,future:[]};
}
