import "server-only";

// EKRAN, SVG UCU VE PDF UCU AYNI YERLEŞİMİ GÖRÜR.
//
// Üç yerde üç ayrı toplama yazılsaydı biri ölçü defterini ya da bir düzeltmeyi
// unutur ve indirilen belge ekranda onaylanandan başka bir panoyu anlatırdı —
// malzeme listesinde yapılabilecek en sinsi hatanın (ELEKTRIK-11) pano
// karşılığı budur.

import { createClient } from "@/lib/supabase/server";
import { loadCurrentElectricalDoc, loadElectricalParts } from "@/lib/electrical/data";
import {
  loadApproval,
  loadDeviceModels,
  loadPanelOverrides,
  loadPlacementOverrides,
  type SwitchboardApproval,
} from "@/lib/switchboard-data";
import { computeSwitchboardLayout, type ComputeResult } from "@/lib/switchboard/compute";
import {
  PANEL_BASE_HEIGHTS_MM,
  PANEL_DEPTHS_MM,
  PANEL_HEIGHTS_MM,
} from "@/lib/switchboard/sizes";
import type { PanelOverride } from "@/lib/switchboard/types";

/** Adresten gelen ölçü YALNIZ ızgaradaysa geçerlidir; değilse yok sayılır. */
function izgaradan(
  ham: string | string[] | undefined,
  izgara: readonly number[]
): number | null {
  const s = Array.isArray(ham) ? ham[0] : ham;
  const n = s ? Number(s) : NaN;
  return Number.isFinite(n) && izgara.includes(n) ? n : null;
}

export interface PanoVerisi {
  project: { id: string; docNo: string; name: string; customer: string };
  belgeVar: boolean;
  belgeAdi: string;
  belgeRevizyon: string;
  okunduMu: boolean;
  parcaSayisi: number;
  sonuc: ComputeResult;
  panoKararlari: PanelOverride[];
  onay: SwitchboardApproval | null;
}

/**
 * Projenin pano yerleşimini toplar ve HESAPLAR.
 *
 * `sorgu` kaydedilmemiş denemeleri taşır (`?yukseklik=2000`). Sıra önemlidir:
 * adres (deneme) → onay (kaydedilmiş ayar) → öntanım. Adres en üstte çünkü
 * kullanıcı o an bir şey denemektedir.
 */
export async function loadPanoVerisi(
  projectId: string,
  sorgu: Record<string, string | string[] | undefined> = {}
): Promise<PanoVerisi | null> {
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, doc_no, name, customer")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return null;

  const belge = await loadCurrentElectricalDoc(supabase, projectId);
  const parcalar = belge ? await loadElectricalParts(supabase, belge.id) : [];

  const [modeller, panoKararlari, yerlesimKararlari, onay] = await Promise.all([
    loadDeviceModels(supabase),
    loadPanelOverrides(supabase, projectId),
    loadPlacementOverrides(supabase, projectId),
    loadApproval(supabase, projectId),
  ]);

  const yukseklik = izgaradan(sorgu.yukseklik, PANEL_HEIGHTS_MM);
  const derinlik = izgaradan(sorgu.derinlik, PANEL_DEPTHS_MM);
  const baza = izgaradan(sorgu.baza, PANEL_BASE_HEIGHTS_MM);

  const sonuc = computeSwitchboardLayout({
    parts: parcalar,
    models: modeller,
    panelOverrides: panoKararlari,
    placementOverrides: yerlesimKararlari,
    settings: {
      ...onay?.settings,
      ...(yukseklik !== null ? { heightMm: yukseklik } : {}),
      ...(derinlik !== null ? { depthMm: derinlik } : {}),
      ...(baza !== null ? { baseMm: baza } : {}),
    },
  });

  return {
    project: {
      id: String(project.id),
      docNo: String(project.doc_no ?? ""),
      name: String(project.name ?? ""),
      customer: String(project.customer ?? ""),
    },
    belgeVar: Boolean(belge),
    belgeAdi: belge?.fileName ?? "",
    belgeRevizyon: belge?.revision ?? "",
    okunduMu: Boolean(belge?.parsedAt),
    parcaSayisi: parcalar.length,
    sonuc,
    panoKararlari,
    onay,
  };
}
