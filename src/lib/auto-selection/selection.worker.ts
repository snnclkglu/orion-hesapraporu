import { solveSelection } from "./orchestrator";
import type { EquipmentRow, SelectionRequest } from "./types";

self.onmessage = (event: MessageEvent<{ request: SelectionRequest; rows: EquipmentRow[] }>) => {
  try {
    const proposal = solveSelection(event.data.request, event.data.rows, progress => self.postMessage({ type: "progress", progress }));
    self.postMessage({ type: "result", proposal });
  } catch (error) {
    self.postMessage({ type: "error", message: error instanceof Error ? error.message : "Seçim çalışması tamamlanamadı." });
  }
};
