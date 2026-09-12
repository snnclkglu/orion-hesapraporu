import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CAD_JOB_STATES, deviceAvailability, safeCadName, sourceSchema, validateCadResult, artifactSchema, type CadDevice } from "../contracts";
import { canProcessCad, USER_ROLES, WORKSPACE_SECTIONS } from "@/lib/roles";
import verified from "../fixtures/verified-drawing.json";

const now = Date.parse("2026-09-12T12:00:00Z");
const ready: CadDevice = { id: "device", name: "OFİS", state: "ready", autocad_version: "25", helper_version: "1.0.0", protocol: 1, last_seen_at: new Date(now - 10000).toISOString(), revoked_at: null, message: "" };
const files = verified.paftalar.map(s => ({ name: s.pdf, kind: "pdf" as const }));
describe("CAD cihaz ve yetki sınırları", () => {
  it("yardımcıya ulaşamamak AutoCAD yok demek değildir", () => {
    expect(deviceAvailability(undefined, now).label).toContain("bağlayın");
    expect(deviceAvailability({ ...ready, last_seen_at: null }, now)).toEqual({ ready: false, label: "Yardımcıya ulaşılamıyor." });
    expect(deviceAvailability({ ...ready, state: "autocad_missing" }, now).label).toContain("AutoCAD bulunamadı");
  });
  it("90 saniyelik eski nabız, bozuk tarih, iptal ve protokol uyuşmazlığı kapatır", () => {
    for (const change of [{ last_seen_at: new Date(now - 90001).toISOString() }, { last_seen_at: "bozuk" }, { revoked_at: "2026-09-12" }, { protocol: 2 }, { state: "attention" as const }]) expect(deviceAvailability({ ...ready, ...change }, now).ready).toBe(false);
    expect(deviceAvailability(ready, now).ready).toBe(true);
    expect(deviceAvailability({ ...ready, state: "busy" }, now).ready).toBe(true);
  });
  it("bilinmeyen profil dahil yalnız belirlenen roller işler", () => {
    expect(USER_ROLES.filter(canProcessCad)).toEqual(["admin", "engineer", "draftsman"]);
    expect(canProcessCad(undefined)).toBe(false);
    expect(canProcessCad("bilinmeyen")).toBe(false);
    expect(WORKSPACE_SECTIONS.find(s => s.href === "/cad")?.yazabilir).toBe(canProcessCad);
  });
});
describe("CAD dosya ve sonuç doğrulaması", () => {
  it.each(["../gizli.dwg", "C:\\test.dwg", "NUL.dwg", "a/b.pdf", "a:stream.pdf", " dosya.dwg", "a.pdf.", "con", "a\u0000.dwg"])("tehlikeli dosya adını reddeder: %s", name => expect(safeCadName(name)).toBe(false));
  it("Türkçe dosya adını kabul eder", () => expect(safeCadName("0026 - BAŞKİRİŞ.dwg")).toBe(true));
  it("dosya boyutu ve açık çalışma onayı zorunludur", () => {
    const input = { id: "7bc7a450-d7f5-4d58-91c1-a9243cd3a833", deviceId: "f96eb1e8-12ba-469a-ab29-2f26261a2e61", name: "a.dwg", size: 10, sha256: "a".repeat(64), options: {}, acknowledged: true };
    expect(sourceSchema.safeParse(input).success).toBe(true);
    expect(sourceSchema.safeParse({ ...input, acknowledged: false }).success).toBe(false);
    expect(sourceSchema.safeParse({ ...input, size: 101 * 1024 * 1024 }).success).toBe(false);
  });
  it("çıktı uzantısı ve sonuç raporu boyutu denetlenir", () => {
    expect(artifactSchema.safeParse({ name: "x.exe", size: 1, sha256: "a".repeat(64), kind: "pdf" }).success).toBe(false);
    expect(artifactSchema.safeParse({ name: "result.json", size: 3 * 1024 * 1024, sha256: "a".repeat(64), kind: "result" }).success).toBe(false);
  });
  it("gerçek çıktı sözleşmesi korunur; boş, eksik ve yinelenen PDF başarısızdır", () => {
    expect(validateCadResult(verified, files).ozet.pafta).toBe(2);
    expect(() => validateCadResult(verified, files.slice(1))).toThrow();
    expect(() => validateCadResult({ ...verified, ozet: { ...verified.ozet, hata: 1 } }, files)).toThrow();
    expect(() => validateCadResult({ ...verified, paftalar: [verified.paftalar[0], verified.paftalar[0]] }, files)).toThrow();
    expect(() => validateCadResult({ ...verified, malzeme: [] }, files)).toThrow();
  });
  it("SQL ile web durum sözlüğü ayrışmaz ve cihaz ucu tekil muafiyettir", () => {
    const sql = readFileSync("supabase/migrations/20260912120000_cad_processing.sql", "utf8");
    for (const state of CAD_JOB_STATES) expect(sql).toContain(`'${state}'`);
    expect(sql).toContain("revoke all on public.cad_devices,public.cad_device_secrets,public.cad_jobs,public.cad_artifacts from anon, authenticated");
    expect(sql).toContain("lease_until>now()");
    const proxy = readFileSync("src/proxy.ts", "utf8");
    expect(proxy).toContain('pathname === "/api/cad/worker"');
    expect(proxy).not.toContain('pathname.startsWith("/api/cad/")');
  });
});
