import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { CadWorkspace } from "@/app/(app)/cad/workspace";
import type { CadDevice } from "../contracts";
vi.mock("@/app/(app)/cad/actions", () => ({ cadAction: vi.fn(), cadSnapshot: vi.fn() }));
vi.mock("@/app/(app)/cad/export-actions", () => ({ cadExportStart: vi.fn(), cadExportFile: vi.fn(), cadExportFinish: vi.fn(), cadItemOptions: vi.fn() }));
it.each(["attention", "autocad_missing", "unpaired"] as const)("%s durumunda dosya ve klasör seçilir, işleme gönderme kilitli kalır", state => {
  const device: CadDevice = { id: "test", name: "TEST PC", state, autocad_version: "", helper_version: "1.0.1", protocol: 1, last_seen_at: new Date().toISOString(), revoked_at: null, message: "" };
  const html = renderToStaticMarkup(<CadWorkspace initial={{ canWrite: true, devices: [device], jobs: [], selected: null, artifacts: [] }} preview />);
  const pickers = html.match(/<input[^>]*type="file"[^>]*>/g) ?? [];
  expect(pickers).toHaveLength(2);
  for (const picker of pickers) { expect(picker).not.toContain("disabled"); expect(picker).toContain("multiple"); }
  expect(pickers[1]).toContain("webkitdirectory");
  expect(html).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*?İşleme gönder<\/button>/);
  if (state !== "unpaired") {
    expect(html).toContain("Bilgisayar bağlantınız kayıtlı");
    expect(html).toContain("Başka bilgisayar bağla");
  }
});
