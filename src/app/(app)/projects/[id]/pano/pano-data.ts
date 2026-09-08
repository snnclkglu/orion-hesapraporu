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
import { normalizeSettings } from "@/lib/switchboard/settings";
import {
  PANEL_BASE_HEIGHTS_MM,
  PANEL_DEPTHS_MM,
  PANEL_HEIGHTS_MM,
} from "@/lib/switchboard/sizes";
import type { LineupPrefs, PanelOverride } from "@/lib/switchboard/types";

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

  // İKİ DİZİ, İKİ AYRI ANAHTAR TAKIMI. Eski tekil anahtarlar (`yukseklik`,
  // `derinlik`, `baza`) ODANIN yedeği olarak kabul edilir: paylaşılmış eski bir
  // bağlantı çalışmayı sürdürsün. İkisine birden yazmak, kaldırılan bağlılığı
  // adres üzerinden geri getirirdi.
  const eskiY = izgaradan(sorgu.yukseklik, PANEL_HEIGHTS_MM);
  const eskiD = izgaradan(sorgu.derinlik, PANEL_DEPTHS_MM);
  const eskiB = izgaradan(sorgu.baza, PANEL_BASE_HEIGHTS_MM);

  const dizi = (onek: "oda" | "saha"): Partial<LineupPrefs> => {
    const oda = onek === "oda";
    const y = izgaradan(sorgu[`${onek}Yukseklik`], PANEL_HEIGHTS_MM) ?? (oda ? eskiY : null);
    const d = izgaradan(sorgu[`${onek}Derinlik`], PANEL_DEPTHS_MM) ?? (oda ? eskiD : null);
    const b = izgaradan(sorgu[`${onek}Baza`], PANEL_BASE_HEIGHTS_MM) ?? (oda ? eskiB : null);
    return {
      ...(y !== null ? { heightMm: y } : {}),
      ...(d !== null ? { depthMm: d } : {}),
      ...(b !== null ? { baseMm: b } : {}),
    };
  };

  const kayitli = normalizeSettings(onay?.settings);

  const sonuc = computeSwitchboardLayout({
    parts: parcalar,
    models: modeller,
    panelOverrides: panoKararlari,
    placementOverrides: yerlesimKararlari,
    settings: {
      ...kayitli,
      room: { ...kayitli.room, ...dizi("oda") },
      field: { ...kayitli.field, ...dizi("saha") },
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
