import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyDrawingPlanState, type DrawingPlanDocument } from "../types";
import {
  NEW_WORK_TEMPLATE,
  NEW_WORK_DISABLED_MODULES,
} from "../../calc/defaults";
vi.mock("server-only", () => ({}));
vi.mock("../../drawing-plan-data", () => ({
  loadDrawingPlanDocument: vi.fn(),
}));
import { loadDrawingPlanDocument } from "../../drawing-plan-data";
import { syncDrawingPlanAfterSave } from "../../drawing-plan-service";

let document: DrawingPlanDocument;
const rpc = vi.fn(async (_name: string, args: Record<string, unknown>) => {
  document = {
    rows: args.p_rows as DrawingPlanDocument["rows"],
    state: {
      ...(args.p_state as DrawingPlanDocument["state"]),
      version: document.state.version + 1,
    },
  };
  return { data: document.state.version, error: null };
});
const source = {
  id: "revision",
  label: "V1",
  updated_at: "2026-09-12T12:00:00Z",
  inputs: {
    specs: NEW_WORK_TEMPLATE.specs,
    disabledModules: NEW_WORK_DISABLED_MODULES,
  },
  selections: null,
};
const client = {
  rpc,
  from: (table: string) => {
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      limit: () => query,
      maybeSingle: async () => ({
        data:
          table === "projects"
            ? { report_context: "engineering", crane_type: "" }
            : source,
        error: null,
      }),
    };
    return query;
  },
} as unknown as SupabaseClient;
beforeEach(() => {
  document = { rows: [], state: emptyDrawingPlanState() };
  vi.mocked(loadDrawingPlanDocument).mockReset();
  vi.mocked(loadDrawingPlanDocument).mockImplementation(async () =>
    structuredClone(document),
  );
  rpc.mockClear();
});

describe("hesap kaydı eşitlemesi", () => {
  it("ilk kayıtta üretir; aynı kapsam ikinci kayıtta çoğalmaz", async () => {
    await syncDrawingPlanAfterSave(client, "project", "revision");
    const ids = document.rows.map((r) => r.id);
    expect(ids.length).toBeGreaterThan(0);
    await syncDrawingPlanAfterSave(client, "project", "revision");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(document.rows.map((r) => r.id)).toEqual(ids);
    expect(rpc.mock.calls[0][1].p_source_updated_at).toBe(source.updated_at);
  });
  it("eski revizyon güncel kaynak seçimini değiştiremez", async () => {
    document.state.sourceRevisionId = "other";
    expect(
      await syncDrawingPlanAfterSave(client, "project", "revision"),
    ).toContain("başka bir revizyon");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("kaynağı olmayan dolu defteri sessiz dönüştürmez", async () => {
    document.rows = [
      {
        id: "old",
        code: "0950",
        name: "ELEKTRİK GRUBU",
        status: "cizildi",
        note: "KORUNACAK",
        drawnBy: null,
        drawnByName: "",
      },
    ];
    await syncDrawingPlanAfterSave(client, "project", "revision");
    expect(rpc).not.toHaveBeenCalled();
    expect(document.rows[0].code).toBe("0950");
  });
  it("okuma hatasını boş defter sayıp kayıt yapmaz", async () => {
    vi.mocked(loadDrawingPlanDocument).mockRejectedValueOnce(
      new Error("BAĞLANTI"),
    );
    await expect(
      syncDrawingPlanAfterSave(client, "project", "revision"),
    ).rejects.toThrow("BAĞLANTI");
    expect(rpc).not.toHaveBeenCalled();
  });
});
