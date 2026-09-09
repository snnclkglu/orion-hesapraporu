// ELEKTRİK PROJESİ KARTINDAKİ TEK SATIRLIK PANO ÖZETİ (PANO-35).
//
// Brief "sistem her elektrik projesi yüklemesinden sonra yerleşimi çalıştırsın"
// diyor. Plan SAKLANMADIĞI için (PANO-14) "çalıştırmak" kalıcı bir şey
// üretmez — kullanıcının gerçekten istediği HABERDAR OLMAKTIR: belge okundu,
// kaç pano çıktı, bir sorun var mı.
//
// Bugüne kadar kart yalnız "N malzeme satırı" diyordu; ölçüsü bilinmeyen bir
// sürücü ya da düşen bir denetim ancak pano sayfası açılıp sekme değiştirilince
// görülüyordu.
//
// ÖZET AYNI SAF ÇEKİRDEKTEN GELİR (`computeSwitchboardLayout`). İkinci bir
// "hızlı hesap" yazmak, kartla sayfanın ayrışmasının en kısa yoludur
// (değişmez md. 8).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ElectricalPart } from "@/lib/electrical/types";
import { computeSwitchboardLayout } from "@/lib/switchboard/compute";
import { normalizeSettings } from "@/lib/switchboard/settings";
import {
  loadApproval,
  loadDeviceModels,
  loadPanelOverrides,
  loadPlacementOverrides,
  loadSavedSettings,
} from "@/lib/switchboard-data";

export interface PanoOzeti {
  odaSayisi: number;
  sahaSayisi: number;
  /** Oda dizisinin toplam eni [mm] — imalatçıya giden sayı. */
  odaEniMm: number;
  /** Ölçüsü DOĞRULANMAMIŞ (tahmin) yerleşim sayısı — sipariş kapısı (PANO-12). */
  tahminSayisi: number;
  /** Hiçbir panoya yerleşmemiş, gerçekten EKSİK olan aygıt sayısı. */
  eksikSayisi: number;
  /** Düşen denetim sayısı. */
  hataliDenetim: number;
}

/**
 * Kart için pano özetini çıkarır; hesaplanamıyorsa `null`.
 *
 * ÖLÇÜ DEFTERİ ZORUNLUDUR: defter olmadan hesaplanan bir özet "tahmin 0" derdi
 * ve olmayan bir güveni bildirirdi (değişmez md. 4). Defter zaten tek ve
 * paylaşılan bir tablodur, proje başına sorgu değildir.
 */
export async function panoOzetiCikar(
  supabase: SupabaseClient,
  projectId: string,
  parcalar: ElectricalPart[]
): Promise<PanoOzeti | null> {
  if (parcalar.length === 0) return null;

  const [modeller, panoKararlari, yerlesimKararlari, onay, kayitliAyar] = await Promise.all([
    loadDeviceModels(supabase),
    loadPanelOverrides(supabase, projectId),
    loadPlacementOverrides(supabase, projectId),
    loadApproval(supabase, projectId),
    loadSavedSettings(supabase, projectId),
  ]);

  // AYAR SAYFADAKİYLE AYNI OKUNUR (PANO-34): kart 1800 mm derken sayfanın
  // 2000 mm demesi, iki ayrı doğruluk üretirdi.
  const sonuc = computeSwitchboardLayout({
    parts: parcalar,
    models: modeller,
    panelOverrides: panoKararlari,
    placementOverrides: yerlesimKararlari,
    settings: normalizeSettings(kayitliAyar ?? onay?.settings),
  });

  // "EKSİK" DAR TANIMLIDIR. `saha` bir eksik değil bir KARARDIR (pano dışı
  // ekipman) ve `urunsuz` malzeme listesinin boşluğudur; ikisini de kırmızı
  // saymak gerçek eksiği (ölçüsüz sürücü, sığmayan cihaz) gölgelerdi — bu
  // ayrımı pano sayfası da aynı biçimde yapıyor.
  const eksikSayisi = sonuc.unplaced.filter(
    (u) => u.reason === "olcusuz" || u.reason === "sigmadi" || u.reason === "siniflanmamis"
  ).length;

  return {
    odaSayisi: sonuc.room.length,
    sahaSayisi: sonuc.field.length,
    odaEniMm: sonuc.room.reduce((t, p) => t + p.widthMm, 0),
    tahminSayisi: sonuc.estimatedCount,
    eksikSayisi,
    hataliDenetim: sonuc.audits.filter((a) => !a.result.ok).length,
  };
}
