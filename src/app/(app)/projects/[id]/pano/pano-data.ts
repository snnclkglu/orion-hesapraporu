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
  loadSavedSettings,
  loadDeviceModels,
  loadPanelOverrides,
  loadPlacementOverrides,
  type SwitchboardApproval,
} from "@/lib/switchboard-data";
import { computeSwitchboardLayout, type ComputeResult } from "@/lib/switchboard/compute";
import { normalizeSettings } from "@/lib/switchboard/settings";
import {
  FIELD_GRID,
  ROOM_GRID,
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

  const [modeller, panoKararlari, yerlesimKararlari, onay, kayitliAyar] = await Promise.all([
    loadDeviceModels(supabase),
    loadPanelOverrides(supabase, projectId),
    loadPlacementOverrides(supabase, projectId),
    loadApproval(supabase, projectId),
    loadSavedSettings(supabase, projectId),
  ]);

  // İKİ DİZİ, İKİ AYRI ANAHTAR TAKIMI. Eski tekil anahtarlar (`yukseklik`,
  // `derinlik`, `baza`) ODANIN yedeği olarak kabul edilir: paylaşılmış eski bir
  // bağlantı çalışmayı sürdürsün. İkisine birden yazmak, kaldırılan bağlılığı
  // adres üzerinden geri getirirdi.
  //
  // IZGARA DA DİZİYE GÖRE DEĞİŞİR (PANO-33): adresteki `sahaYukseklik=1600`
  // odanın ızgarasında geçerli ama sahanınkinde YOKTUR ve sessizce yok
  // sayılmalıdır — sipariş edilemeyecek bir ölçü bir bağlantıdan gelemez.
  const eskiY = izgaradan(sorgu.yukseklik, ROOM_GRID.heights);
  const eskiD = izgaradan(sorgu.derinlik, ROOM_GRID.depths);
  const eskiB = izgaradan(sorgu.baza, ROOM_GRID.bases);

  const dizi = (onek: "oda" | "saha"): Partial<LineupPrefs> => {
    const oda = onek === "oda";
    const izgara = oda ? ROOM_GRID : FIELD_GRID;
    const y = izgaradan(sorgu[`${onek}Yukseklik`], izgara.heights) ?? (oda ? eskiY : null);
    const d = izgaradan(sorgu[`${onek}Derinlik`], izgara.depths) ?? (oda ? eskiD : null);
    const b = izgaradan(sorgu[`${onek}Baza`], izgara.bases) ?? (oda ? eskiB : null);
    return {
      ...(y !== null ? { heightMm: y } : {}),
      ...(d !== null ? { depthMm: d } : {}),
      ...(b !== null ? { baseMm: b } : {}),
    };
  };

  // AYAR ÜÇ KATMANDIR (PANO-34), en güçlüsü üstte:
  //   1. Adresteki DENEME — kaydedilmemiş, paylaşılabilir, yenilemede kaybolur.
  //   2. Kaydedilmiş ayar — onaydan bağımsız yaşar.
  //   3. Onay anındaki ayar — yalnız ESKİ projeler için yedek; onay tablosu
  //      08.09.2026 öncesinde tek kalıcı yerdi ve o satırlar kaybolmamalı.
  const kayitli = normalizeSettings(kayitliAyar ?? onay?.settings);

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
