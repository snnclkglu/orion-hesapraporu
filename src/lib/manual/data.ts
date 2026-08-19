// EL KİTABININ OKUMA KATMANI — Supabase'ten çekirdeğin tiplerine.
//
// Çekirdek (`payload.ts` · `sources.ts` · `template.ts`) SAFTIR; burası
// onunla veritabanı arasındaki tek geçittir. Ekran, editör ve PDF ucu üçü de
// buradan okur.

import type { SupabaseClient } from "@supabase/supabase-js";
import { withManualDefaults } from "./payload";
import type { ManualPayload } from "./types";

/** Depo kovası — yükleme (istemci), okuma (uç) ve silme aynı adı kullanır. */
export const MANUAL_IMAGE_BUCKET = "manual-images";

export interface ManualRow {
  id: string;
  projectId: string;
  customerDocNo: string;
  title: string;
  archived: boolean;
}

export interface ManualRevisionRow {
  id: string;
  manualId: string;
  revNo: number;
  label: string;
  status: "draft" | "issued";
  notes: string;
  createdAt: string;
  createdByName: string;
  issuedAt: string | null;
}

export interface ManualImageRow {
  id: string;
  revisionId: string;
  fileName: string;
  storagePath: string;
  width: number;
  height: number;
}

export async function loadManual(
  supabase: SupabaseClient,
  projectId: string
): Promise<ManualRow | null> {
  const { data } = await supabase
    .from("manuals")
    .select("id, project_id, customer_doc_no, title, status")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return {
    id: String(r.id),
    projectId: String(r.project_id),
    customerDocNo: String(r.customer_doc_no ?? ""),
    title: String(r.title ?? ""),
    archived: r.status === "archived",
  };
}

export async function loadManualRevisions(
  supabase: SupabaseClient,
  manualId: string
): Promise<ManualRevisionRow[]> {
  const { data } = await supabase
    .from("manual_revisions")
    .select("id, manual_id, rev_no, label, status, notes, created_at, issued_at, profiles:created_by(full_name)")
    .eq("manual_id", manualId)
    .order("rev_no", { ascending: false });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    manualId: String(r.manual_id),
    revNo: Number(r.rev_no ?? 0),
    label: String(r.label ?? ""),
    status: r.status === "issued" ? "issued" : "draft",
    notes: String(r.notes ?? ""),
    createdAt: String(r.created_at ?? ""),
    createdByName:
      (r.profiles as { full_name?: string } | null)?.full_name ?? "",
    issuedAt: r.issued_at ? String(r.issued_at) : null,
  }));
}

/** Tek revizyonun GÖVDESİ — snapshot güvenle bugüne taşınır. */
export async function loadManualRevision(
  supabase: SupabaseClient,
  revisionId: string
): Promise<{ row: ManualRevisionRow; payload: ManualPayload } | null> {
  const { data } = await supabase
    .from("manual_revisions")
    .select("id, manual_id, rev_no, label, status, notes, payload, created_at, issued_at, profiles:created_by(full_name)")
    .eq("id", revisionId)
    .maybeSingle();
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return {
    row: {
      id: String(r.id),
      manualId: String(r.manual_id),
      revNo: Number(r.rev_no ?? 0),
      label: String(r.label ?? ""),
      status: r.status === "issued" ? "issued" : "draft",
      notes: String(r.notes ?? ""),
      createdAt: String(r.created_at ?? ""),
      createdByName: (r.profiles as { full_name?: string } | null)?.full_name ?? "",
      issuedAt: r.issued_at ? String(r.issued_at) : null,
    },
    payload: withManualDefaults(r.payload),
  };
}

/** Revizyonun görselleri — `imageId` → kayıt. */
export async function loadManualImages(
  supabase: SupabaseClient,
  revisionId: string
): Promise<ManualImageRow[]> {
  const { data } = await supabase
    .from("manual_images")
    .select("id, revision_id, file_name, storage_path, width, height")
    .eq("revision_id", revisionId)
    .order("created_at", { ascending: true });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    revisionId: String(r.revision_id),
    fileName: String(r.file_name ?? ""),
    storagePath: String(r.storage_path ?? ""),
    width: Number(r.width ?? 0),
    height: Number(r.height ?? 0),
  }));
}
